'use client';

import { useState } from 'react';
import type { Activity, Place } from '@/lib/types';
import { Plus, Bookmark, MoreHorizontal, Info, ThumbsUp, ThumbsDown, Sparkles, Star, MapPin, Clock, X, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatOpeningHours } from '@/lib/tag-parser';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { isEntityBoosted } from '@/lib/ranking';
import { PlaceActivityPreview } from './place-activity-preview';
import { SpotCover } from './spot-cover';
import { getSpotPhoto } from '@/lib/spot-photos';
import { useLanguage } from '@/hooks/use-language';
import { formatDistance } from '@/lib/geo-utils';
import styles from './spot-card.module.css';

export type PlaceCardProps = {
  place: Place;
  onClick: () => void;
  onAddActivity: (place: Place) => void;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | 'none';
  activityCount: number;
  activityPreview?: Activity;
  activityPreviewLoading?: boolean;
  isFavorite: boolean;
  onVote: (type: 'up' | 'down' | 'none') => void;
  onBookmarkToggle: () => void;
  role?: string | null;
  weightedUpvotes?: number;
  weightedDownvotes?: number;
  compact?: boolean;
  featured?: boolean;
};

export function PlaceCard({ place, onClick, onAddActivity, userVote, activityCount, activityPreview,
  activityPreviewLoading, isFavorite, onVote, onBookmarkToggle, role, weightedUpvotes = 0,
  weightedDownvotes = 0, featured = false }: PlaceCardProps) {
  const language = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!place) return null;
  const german = language === 'de';
  const photo = getSpotPhoto(place);
  const primaryStyle = getPrimaryIconData(place, language);
  const showWeights = role === 'admin' || role === 'supporter';
  const rating = place.rating || (place as Place & { averageRating?: number }).averageRating;
  const vote = (type: 'up' | 'down') => onVote(userVote === type ? 'none' : type);
  const plan = () => onAddActivity(place);
  const detail = place.openingHours ? formatOpeningHours(place.openingHours) : place.address?.split(',').slice(0, 2).join(', ');
  const voteButtons = (withLabels = false) => (['up', 'down'] as const).map(type => {
    const label = type === 'up' ? (german ? 'Ja, passt' : 'Yes, suits me') : (german ? 'Eher nicht' : 'Not for me');
    const Icon = type === 'up' ? ThumbsUp : ThumbsDown;
    return <button key={type} type="button" className={styles.vote} aria-label={type === 'up' ? (german ? 'Gefällt mir' : 'Like') : (german ? 'Gefällt mir nicht' : 'Dislike')} aria-pressed={userVote === type}
      onClick={e => { e.stopPropagation(); vote(type); }}>
      <Icon className={userVote === type ? 'fill-current' : undefined} />
      {withLabels && <span>{label}</span>}
      {showWeights && <span>{type === 'up' ? `+${weightedUpvotes}` : `−${weightedDownvotes}`}</span>}
    </button>;
  });

  return (
    <>
      <article className={styles.card} data-spot-card onClick={event => {
        if (!(event.target as HTMLElement).closest('button, a, input, [role="button"]') && !window.getSelection()?.toString()) onClick();
      }}>
        <div className={styles.art}>
          <SpotCover place={place} photo={photo} german={german} />
          {photo && <button type="button" className={styles.photoCredit} aria-label={german ? `Bildnachweis: ${photo.author}` : `Photo credit: ${photo.author}`} title={`${photo.author} · ${photo.license}`} onClick={() => setMenuOpen(true)}><Camera aria-hidden="true" /></button>}
          <span className={styles.categoryBadge}>{primaryStyle.label}</span>
          {(featured || isEntityBoosted(place) || (rating !== undefined && rating > 0) || role === 'admin') && <div className={styles.imageMeta}>
            {(featured || isEntityBoosted(place)) && <span className={styles.recommended}><Sparkles className="h-3 w-3" aria-hidden="true" />{german ? 'Empfohlen' : 'Recommended'}</span>}
            {rating !== undefined && rating > 0 && <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" aria-hidden="true" />{rating.toFixed(1)}</span>}
            {role === 'admin' && place.relevanceScore !== undefined && <span>Score {place.relevanceScore.toFixed(1)}</span>}
          </div>}
        </div>
        <button type="button" className={styles.bookmark} aria-label={german ? (isFavorite ? `${place.name} nicht mehr merken` : `${place.name} merken`) : (isFavorite ? `Unsave ${place.name}` : `Save ${place.name}`)} aria-pressed={isFavorite}
          onClick={onBookmarkToggle}><Bookmark className={isFavorite ? 'fill-current' : undefined} /></button>
        <button type="button" className={styles.more} aria-label={german ? `Optionen für ${place.name}` : `Options for ${place.name}`} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}><MoreHorizontal /></button>
        <div className={styles.content}>
          <div className={styles.identity}>
            <h3 className={styles.name}><button type="button" title={place.name} onClick={onClick}>{place.name || (german ? 'Unbekannter Ort' : 'Unknown place')}</button></h3>
          </div>
          <p className={styles.meta}>
            {place.distance !== undefined && <span className={styles.distance}><MapPin aria-hidden="true" />{formatDistance(place.distance)}</span>}
            {detail && <span className={styles.detail} title={detail}>{place.openingHours && <Clock aria-hidden="true" />}<span>{detail}</span></span>}
          </p>
          <PlaceActivityPreview activity={activityPreview} activityCount={activityCount} loading={activityPreviewLoading} language={language} onClick={onClick} onCreate={plan} appearance="warm" />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={plan} data-tutorial-id="spot-card-create"
            aria-label={german ? `Treffen planen: ${place.name}` : `Plan a meetup: ${place.name}`}>
            <Plus aria-hidden="true" />{german ? 'Treffen planen' : 'Plan a meetup'}
          </button>
        </div>
        <div className={styles.voteFooter}><span>{german ? 'Passt der Ort für dich?' : 'Is this your kind of place?'}</span>{voteButtons()}</div>
      </article>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className={cn(styles.menu, 'max-h-[85dvh] overflow-y-auto')} hideCloseButton>
          <button type="button" className={styles.menuClose} aria-label={german ? 'Schließen' : 'Close'} onClick={() => setMenuOpen(false)}><X /></button>
          <SheetHeader className={styles.menuHeader}>
            <div className={styles.menuArt}><SpotCover place={place} photo={photo} german={german} /></div>
            <div className="min-w-0 text-left"><SheetTitle>{place.name}</SheetTitle><SheetDescription>{primaryStyle.label}{place.distance !== undefined ? ` · ${formatDistance(place.distance)}` : ''}</SheetDescription></div>
          </SheetHeader>
          <button type="button" className={styles.menuAction} aria-pressed={isFavorite} onClick={onBookmarkToggle}><Bookmark className={isFavorite ? 'fill-current' : undefined} /><span><strong>{german ? (isFavorite ? 'Ort gemerkt' : 'Ort merken') : (isFavorite ? 'Place saved' : 'Save place')}</strong><small>{german ? (isFavorite ? 'Tippen zum Entfernen' : 'Für später aufheben') : (isFavorite ? 'Tap to remove' : 'Keep for later')}</small></span></button>
          <button type="button" className={styles.menuAction} onClick={() => { setMenuOpen(false); plan(); }}><Plus /><strong>{german ? 'Eigenes Treffen planen' : 'Plan your own meetup'}</strong></button>
          <button type="button" className={styles.menuAction} onClick={() => { setMenuOpen(false); onClick(); }}><Info /><strong>{german ? 'Details ansehen' : 'View details'}</strong></button>
          <div className={styles.menuRating}><p>{german ? 'Passt der Ort für dich?' : 'Is this your kind of place?'}</p><div className={styles.menuVotes}>{voteButtons(true)}</div></div>
          {photo && <div className={styles.photoAttribution}>
            <p><strong>{german ? 'Bildnachweis' : 'Photo credit'}</strong></p>
            <p><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">{photo.author} · {photo.provider ?? 'Wikimedia Commons'}</a>{' · '}<a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a></p>
            {photo.title && <p>{photo.title}</p>}
            {photo.caption && <p>{photo.caption}</p>}
            <p>{german ? 'Darstellung als Bildausschnitt.' : 'Displayed with cropping.'}{photo.kind === 'example' && (german ? ' Beispielfoto, zeigt nicht diesen Ort.' : ' Example photo, not this venue.')}</p>
          </div>}
        </SheetContent>
      </Sheet>
    </>
  );
}
