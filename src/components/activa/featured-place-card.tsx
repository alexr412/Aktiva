'use client';

import { PlaceCard, type PlaceCardProps } from './place-card';

export function FeaturedPlaceCard(props: Omit<PlaceCardProps, 'featured' | 'compact'>) {
  return <PlaceCard {...props} featured />;
}
