'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase/client';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { SavedCollection, hasPremiumFeature } from '@/lib/types';
import { useToast } from './use-toast';

export function useCollections() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const isPremium = hasPremiumFeature(userProfile, 'collections');
  const maxCollections = isPremium ? Infinity : 3;
  const maxItems = isPremium ? Infinity : 25;

  useEffect(() => {
    const local = localStorage.getItem('aktiva_collections');
    let localData: SavedCollection[] = [];
    if (local) {
      try {
        localData = JSON.parse(local);
        setCollections(localData);
      } catch (e) {
        console.error('Error parsing local collections:', e);
      }
    }

    if (!user || !db) {
      setLoading(false);
      return;
    }

    const fetchFirestoreCollections = async () => {
      try {
        const colRef = collection(db!, 'users', user.uid, 'collections');
        const snap = await getDocs(colRef);
        const fbData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedCollection));
        
        if (fbData.length > 0) {
          localStorage.setItem('aktiva_collections', JSON.stringify(fbData));
          setCollections(fbData);
        } else if (localData.length > 0) {
          const batch = writeBatch(db!);
          for (const col of localData) {
            const docRef = doc(db!, 'users', user.uid, 'collections', col.id);
            batch.set(docRef, {
              name: col.name,
              places: col.places,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          await batch.commit();
        }
      } catch (err) {
        console.error('Error fetching collections from Firestore:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirestoreCollections();
  }, [user]);

  const saveToLocal = (newCollections: SavedCollection[]) => {
    localStorage.setItem('aktiva_collections', JSON.stringify(newCollections));
    setCollections(newCollections);
  };

  const createCollection = async (name: string): Promise<boolean> => {
    if (collections.length >= maxCollections) {
      toast({
        variant: 'destructive',
        title: 'Limit erreicht',
        description: `Als kostenloser Nutzer kannst du maximal ${maxCollections} Sammlungen erstellen.`
      });
      return false;
    }

    const newCol: SavedCollection = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      places: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...collections, newCol];
    saveToLocal(updated);

    if (user && db) {
      try {
        const docRef = doc(db, 'users', user.uid, 'collections', newCol.id);
        await setDoc(docRef, {
          name: newCol.name,
          places: newCol.places,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Firestore save failed:', err);
      }
    }

    toast({
      title: 'Erfolg',
      description: `Sammlung "${name}" wurde erstellt.`
    });
    return true;
  };

  const deleteCollection = async (id: string): Promise<void> => {
    const updated = collections.filter(c => c.id !== id);
    saveToLocal(updated);

    if (user && db) {
      try {
        const docRef = doc(db, 'users', user.uid, 'collections', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error('Firestore delete failed:', err);
      }
    }

    toast({
      title: 'Gelöscht',
      description: 'Die Sammlung wurde gelöscht.'
    });
  };

  const addPlaceToCollection = async (collectionId: string, placeId: string): Promise<boolean> => {
    const col = collections.find(c => c.id === collectionId);
    if (!col) return false;

    if (col.places.includes(placeId)) {
      toast({
        title: 'Bereits vorhanden',
        description: 'Dieser Ort befindet sich bereits in dieser Sammlung.'
      });
      return true;
    }

    if (col.places.length >= maxItems) {
      toast({
        variant: 'destructive',
        title: 'Limit erreicht',
        description: `Als kostenloser Nutzer kannst du maximal ${maxItems} Orte pro Sammlung speichern.`
      });
      return false;
    }

    const updated = collections.map(c => {
      if (c.id === collectionId) {
        return {
          ...c,
          places: [...c.places, placeId],
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    });

    saveToLocal(updated);

    if (user && db) {
      try {
        const docRef = doc(db, 'users', user.uid, 'collections', collectionId);
        await setDoc(docRef, {
          places: [...col.places, placeId],
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error('Firestore save failed:', err);
      }
    }

    toast({
      title: 'Gespeichert',
      description: 'Ort wurde zur Sammlung hinzugefügt.'
    });
    return true;
  };

  const removePlaceFromCollection = async (collectionId: string, placeId: string): Promise<void> => {
    const col = collections.find(c => c.id === collectionId);
    if (!col) return;

    const updatedPlaces = col.places.filter(p => p !== placeId);
    const updated = collections.map(c => {
      if (c.id === collectionId) {
        return {
          ...c,
          places: updatedPlaces,
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    });

    saveToLocal(updated);

    if (user && db) {
      try {
        const docRef = doc(db, 'users', user.uid, 'collections', collectionId);
        await setDoc(docRef, {
          places: updatedPlaces,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error('Firestore save failed:', err);
      }
    }

    toast({
      title: 'Entfernt',
      description: 'Ort wurde aus der Sammlung entfernt.'
    });
  };

  return {
    collections,
    loading,
    isPremium,
    createCollection,
    deleteCollection,
    addPlaceToCollection,
    removePlaceFromCollection,
    maxCollections,
    maxItems
  };
}
