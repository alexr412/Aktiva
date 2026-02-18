'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, app } from "./client";
import { auth } from "./auth";

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
    await auth.updateCurrentUser(
      {...auth.currentUser, photoURL: downloadURL}
    )
  }
  
  return downloadURL;
};
