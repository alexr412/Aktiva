'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, setDoc, serverTimestamp, collection, getDoc } from "firebase/firestore";
import { db, app } from "./client";
import { auth } from "./auth";
import { updateProfile } from "firebase/auth";

import { getExtensionFromMimeType } from "@/lib/avatar-utils";

if (!app) {
    throw new Error("Firebase has not been initialized.");
}

const storage = getStorage(app);

export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
  if (!auth?.currentUser || auth.currentUser.uid !== userId) {
      throw new Error("You are not authorized to perform this action.");
  }

  // 1. Optional Storage cleanup of old custom avatar before uploading new one
  try {
      const userDocRef = doc(db!, "users", userId);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
          const currentPhotoURL = snap.data().photoURL;
          const { isStorageAvatarPath } = await import("@/lib/avatar-utils");
          if (isStorageAvatarPath(currentPhotoURL, userId)) {
              const { deleteObject, ref: storageRef } = await import('firebase/storage');
              const oldFileRef = storageRef(storage, currentPhotoURL);
              await deleteObject(oldFileRef);
          }
      }
  } catch (storageError) {
      // Suppress storage cleanup errors
      console.warn("Firebase Storage old avatar deletion failed:", storageError);
  }

  const extension = getExtensionFromMimeType(file.type);
  const fileRef = ref(storage, `users/${userId}/avatar/avatar.${extension}`);
  
  // 2. Clean up other extensions to prevent clutter
  const otherExtensions = ['jpg', 'png', 'webp'].filter(ext => ext !== extension);
  for (const ext of otherExtensions) {
      try {
          const oldRef = ref(storage, `users/${userId}/avatar/avatar.${ext}`);
          const { deleteObject } = await import('firebase/storage');
          await deleteObject(oldRef);
      } catch (err) {
          // Ignore if file doesn't exist
      }
  }

  await uploadBytes(fileRef, file);
  
  const downloadURL = await getDownloadURL(fileRef);
  
  const userDocRef = doc(db!, "users", userId);
  await updateDoc(userDocRef, { 
    photoURL: downloadURL 
  });

  if(auth.currentUser){
    await updateProfile(auth.currentUser, { photoURL: downloadURL });
  }
  
  return downloadURL;
};

/**
 * MODUL 14: KYC Upload-Prozess.
 * Lädt Dokumente in ein geschütztes Verzeichnis und erstellt eine Review-Anfrage für Admins.
 */
export const submitKYCDocument = async (userId: string, file: File) => {
  if (!auth?.currentUser || auth.currentUser.uid !== userId) {
    throw new Error("Nicht autorisiert.");
  }

  const extension = getExtensionFromMimeType(file.type);
  const fileName = `identity_document.${extension}`;

  // 1. Upload file to secured storage path
  const storageRef = ref(storage, `kyc/${userId}/${fileName}`);
  await uploadBytes(storageRef, file);
  const documentUrl = await getDownloadURL(storageRef);

  // 2. Create admin review document.
  // The onKycRequestCreated Cloud Function trigger will automatically set
  // kycStatus = 'pending' on the user profile server-side — no client write needed.
  const kycReqRef = doc(collection(db!, 'kycRequests'));
  await setDoc(kycReqRef, {
    userId,
    documentUrl,
    status: 'pending',
    submittedAt: serverTimestamp()
  });

  return documentUrl;
};
