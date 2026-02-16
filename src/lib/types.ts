export interface Place {
  id: string;
  name: string;
  address: string;
  categories: string[];
  lat: number;
  lon: number;
  rating?: number;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  imageHint: string;
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
