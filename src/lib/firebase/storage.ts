'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { db, app } from "./client";
import { auth } from "./auth";
import { updateProfile } from "firebase/auth";

if (!app) {
    throw new Error("Firebase has not been initialized.");
}

const storage = getStorage(app);

export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
  if (!auth?.currentUser || auth.currentUser.uid !== userId) {
      throw new Error("You are not authorized to perform this action.");
  }
  const fileRef = ref(storage, `users/${userId}/profile.jpg`);
  
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

  // 1. Datei-Upload in gesicherten Storage-Pfad
  const storageRef = ref(storage, `kyc/${userId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const documentUrl = await getDownloadURL(storageRef);

  // 2. Nutzer-Status auf 'pending' setzen
  const userRef = doc(db!, 'users', userId);
  await updateDoc(userRef, { kycStatus: 'pending' });

  // 3. Admin-Review-Dokument erstellen
  const kycReqRef = doc(collection(db!, 'kycRequests'));
  await setDoc(kycReqRef, {
    userId,
    documentUrl,
    status: 'pending',
    submittedAt: serverTimestamp()
  });

  return documentUrl;
};
