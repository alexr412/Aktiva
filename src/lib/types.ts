import type { Timestamp } from 'firebase/firestore';

export interface Place {
  id: string;
  name: string;
  address: string;
  categories: string[];
  lat: number;
  lon: number;
  rating?: number;
  imageUrl?: string;
}

export interface Activity {
  id?: string;
  placeId: string;
  placeName: string;
  placeAddress: string;
  activityDate: Timestamp;
  creatorId: string;
  creatorName: string | null;
  creatorPhotoURL: string | null;
  participantIds: string[];
  createdAt: Timestamp;
}


export interface GeoapifyFeature {
  properties: {
    name?: string;
    address_line1: string;
    address_line2: string;
    categories: string[];
    lat: number;
    lon: number;
    place_id: string;
    datasource: {
      raw: {
        rating?: string;
      };
    };
  };
}
