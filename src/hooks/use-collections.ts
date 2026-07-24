'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase/client';
import { collection, getDocs } from 'firebase/firestore';
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
    // Primary local storage lookup
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

    // Read existing collections from Firestore if available (allow read: if isOwner)
    const fetchFirestoreCollections = async () => {
      try {
        const colRef = collection(db!, 'users', user.uid, 'collections');
        const snap = await getDocs(colRef);
        const fbData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedCollection));
        
        if (fbData.length > 0) {
          localStorage.setItem('aktiva_collections', JSON.stringify(fbData));
          setCollections(fbData);
        }
      } catch (err) {
        // Read fallback silently stays on local storage
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

    toast({
      title: 'Erfolg',
      description: `Sammlung "${name}" wurde erstellt.`
    });
    return true;
  };

  const deleteCollection = async (id: string): Promise<void> => {
    const updated = collections.filter(c => c.id !== id);
    saveToLocal(updated);

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
