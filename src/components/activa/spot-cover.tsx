'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import type { Place } from '@/lib/types';
import type { SpotPhoto } from '@/lib/spot-photos';
import { SpotIllustration } from './spot-illustration';
import type { SpotIllustrationArtwork } from './spot-illustration-artwork';
import styles from './spot-card.module.css';

export function SpotCover({ place, photo, artwork, german }: { place: Place; photo?: SpotPhoto; artwork?: SpotIllustrationArtwork; german: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (artwork) {
    if (failedUrl === artwork.src) return <SpotIllustration place={place} />;
    return <Image src={artwork.src} alt={`Illustration: ${german ? artwork.label.de : artwork.label.en}`}
      fill unoptimized sizes="(max-width: 767px) 80px, 400px" className={`${styles.photo} ${styles.modernIllustration}`}
      style={{ '--spot-art-position': artwork.objectPosition, '--spot-art-mobile-position': artwork.mobileObjectPosition } as CSSProperties}
      onError={() => setFailedUrl(artwork.src)} />;
  }
  if (!photo || failedUrl === photo.url) return <SpotIllustration place={place} />;
  return <>
    <SpotIllustration place={place} />
    <Image src={photo.url} alt={photo.kind === 'venue' ? (photo.alt ?? place.name) : (german ? 'Beispielfoto, zeigt nicht diesen Ort' : 'Example photo, not this venue')}
      fill unoptimized sizes="(max-width: 767px) 80px, 400px" className={styles.photo}
      style={{ objectPosition: photo.objectPosition }} onError={() => setFailedUrl(photo.url)} />
    {photo.kind === 'example' && <span className={styles.exampleLabel}>{german ? 'Beispielfoto' : 'Example photo'}</span>}
  </>;
}
