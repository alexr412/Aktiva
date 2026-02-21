'use client';

import React, { createContext, useState, useEffect, useContext, type ReactNode, useCallback } from 'react';
import type { Place, FavoritePlace } from '@/lib/types';

const FAVORITES_STORAGE_KEY = 'app-favorites';

interface FavoritesContextType {
  favorites: FavoritePlace[];
  addFavorite: (place: Place) => void;
  removeFavorite: (placeId: string) => void;
  checkIsFavorite: (placeId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);

  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch (e) {
      console.error("Could not read favorites from localStorage", e);
    }
  }, []);

  const persistFavorites = (newFavorites: FavoritePlace[]) => {
    setFavorites(newFavorites);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
    } catch (e) {
      console.error("Could not save favorites to localStorage", e);
    }
  };

  const addFavorite = useCallback((place: Place) => {
    const newFavorite: FavoritePlace = {
      id: place.id,
      name: place.name,
      address: place.address,
      categories: place.categories,
      lat: place.lat,
      lon: place.lon,
    };
    persistFavorites([...favorites, newFavorite]);
  }, [favorites]);

  const removeFavorite = useCallback((placeId: string) => {
    const newFavorites = favorites.filter(fav => fav.id !== placeId);
    persistFavorites(newFavorites);
  }, [favorites]);

  const checkIsFavorite = useCallback((placeId: string) => {
    return favorites.some(fav => fav.id === placeId);
  }, [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, checkIsFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
