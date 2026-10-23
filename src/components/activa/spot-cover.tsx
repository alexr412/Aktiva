'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Place } from '@/lib/types';
import type { SpotPhoto } from '@/lib/spot-photos';
import { SpotIllustration } from './spot-illustration';
import styles from './spot-card.module.css';

export function SpotCover({ place, photo, german }: { place: Place; photo?: SpotPhoto; german: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!photo || failedUrl === photo.url) return <SpotIllustration place={place} />;
  return <>
    <SpotIllustration place={place} />
    <Image src={photo.url} alt={photo.kind === 'venue' ? place.name : (german ? 'Beispielfoto, zeigt nicht diesen Ort' : 'Example photo, not this venue')}
      fill unoptimized sizes="(max-width: 767px) 80px, 400px" className={styles.photo}
      style={{ objectPosition: photo.objectPosition }} onError={() => setFailedUrl(photo.url)} />
    {photo.kind === 'example' && <span className={styles.exampleLabel}>{german ? 'Beispielfoto' : 'Example photo'}</span>}
  </>;
}
