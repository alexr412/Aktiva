'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import type { Place, Activity } from '@/lib/types';
import type { SelectedMapEntity } from '@/components/map/map-types';
import { useDiscoverPlaces } from '@/hooks/use-discover-places';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useFriendRadar } from '@/hooks/use-friend-radar';
import { useFavorites } from '@/contexts/favorites-context';
import { useLocation } from '@/contexts/location-context';
import { isPremiumActive } from '@/lib/types';
import { createActivity, joinActivity, votePlace } from '@/lib/firebase/firestore';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PlaceDetails } from '@/components/activa/place-details';
import { CreateActivityDialog } from '@/components/activa/create-activity-dialog';
import { LocationSearchDialog } from '@/components/common/LocationSearchDialog';
import { DesktopNav } from '@/components/desktop-nav';
import { AppHeader } from '@/components/app-header';
import { ChevronDown, MapPin, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const ActivaMap = dynamic(() => import('@/components/map/activa-map').then((mod) => mod.ActivaMap), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-neutral-900">
      <div className="relative w-12 h-12 animate-pulse mb-2">
        <Image src="/assets/logo-heart.png" alt="Activa" fill sizes="48px" className="object-contain" />
      </div>
      <span className="text-xs font-bold text-slate-500 dark:text-neutral-400">Karte wird geladen...</span>
    </div>
  ),
});

export default function MapPage() {
  const language = useLanguage();
  const { user, userProfile } = useAuth();
  const { checkIsFavorite, addFavorite, removeFavorite } = useFavorites();
  const { requestLocation, gateState, isLocating } = useLocation();
  const { enabled: radarEnabled, nearbyFriends } = useFriendRadar();

  const {
    places,
    communityActivities,
    userLocation,
    cityName,
    maxDistance,
  } = useDiscoverPlaces();

  const [selectedMapEntity, setSelectedMapEntity] = useState<SelectedMapEntity>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectMapEntity = (entity: SelectedMapEntity) => {
    setSelectedMapEntity(entity);
  };

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
  };

  const handleDialogClose = () => {
    setSelectedPlace(null);
  };

  const handleToggleFavorite = (place: Place) => {
    if (checkIsFavorite(place.id)) {
      removeFavorite(place.id);
    } else {
      addFavorite(place);
    }
  };

  const handleCreateActivity = async (
    startDate: Date,
    endDate: Date | undefined,
    isTimeFlexible: boolean,
    customLocationName?: string,
    maxParticipants?: number,
    isBoosted?: boolean,
    isPaid?: boolean,
    price?: number,
    category?: any,
    description?: string,
    requirements?: any,
    joinMode?: 'direct' | 'request'
  ): Promise<boolean> => {
    if (!user) return false;
    const payload = {
      startDate,
      endDate,
      isTimeFlexible,
      customLocationName,
      maxParticipants,
      isBoosted,
      isPaid,
      price,
      category: category || 'social',
      description,
      requirements,
      joinMode: joinMode || 'direct',
      user,
    };
    try {
      await createActivity(payload, typeof activityModalPlace === 'object' ? activityModalPlace : undefined);
      setActivityModalPlace(null);
      return true;
    } catch (e) {
      console.error('Failed to create activity:', e);
      return false;
    }
  };

  const handleJoin = async (activity: Activity) => {
    if (!user || !activity.id) return false;
    try {
      await joinActivity(activity.id, user);
      return true;
    } catch (e) {
      console.error('Failed to join activity:', e);
      return false;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--bottom-nav-height,66px))] lg:h-dvh w-full bg-slate-50 dark:bg-neutral-950 relative overflow-hidden">
      {/* Viewport Header */}
      <AppHeader
        className="shrink-0 z-20"
        icon={
          <Link href="/profile" className="shrink-0">
            <ProfileAvatar
              className="h-9 w-9 border-2 border-white dark:border-neutral-800 shadow-xl shadow-primary/10 transition-transform active:scale-95 cursor-pointer"
              photoURL={userProfile?.photoURL}
              displayName={userProfile?.displayName}
              isPremium={isPremiumActive(userProfile)}
              isCreator={userProfile?.isCreator}
              isSupporter={userProfile?.isSupporter}
            />
          </Link>
        }
        title="Karte"
      >
        <div className="px-4 sm:px-6 flex items-center justify-start">
          <button
            onClick={() => setIsLocationSearchOpen(true)}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800/50 py-1.5 px-3.5 rounded-full transition-all hover:bg-slate-200 dark:hover:bg-neutral-800 max-w-full min-w-0"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-widest truncate">
              {cityName}
            </span>
            <ChevronDown className="h-3 w-3 text-neutral-400 shrink-0" />
          </button>
        </div>
      </AppHeader>

      {/* Main Map Viewport */}
      <main className="flex-1 w-full relative overflow-hidden">
        <ActivaMap
          places={places}
          communityActivities={communityActivities}
          nearbyFriends={radarEnabled ? nearbyFriends : []}
          userLocation={userLocation}
          maxDistance={maxDistance}
          language={language}
          isMobile={isMobile}
          selectedEntity={selectedMapEntity}
          onSelectEntity={handleSelectMapEntity}
          onCreateActivity={(place) => setActivityModalPlace(place)}
          onJoinActivity={handleJoin}
          onPlaceSelect={handlePlaceSelect}
          checkIsFavoriteProp={checkIsFavorite}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Green Create Activity Floating Action Button (+ FAB) */}
        <div className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <Button
            variant="ghost"
            size="icon"
            className="
              relative h-14 w-14 overflow-hidden rounded-full
              bg-primary text-white shadow-xl hover:bg-emerald-600
              border border-white/40 active:scale-95 transition-transform
            "
            onClick={() => setActivityModalPlace('custom')}
            aria-label={language === 'de' ? 'Aktivität erstellen' : 'Create activity'}
          >
            <Plus className="relative z-10 h-7 w-7 text-white" strokeWidth={2.5} />
          </Button>
        </div>
      </main>

      {/* Location Search Modal */}
      <LocationSearchDialog open={isLocationSearchOpen} onOpenChange={setIsLocationSearchOpen} />

      {/* Mobile Place Details Sheet */}
      {isMobile ? (
        <Sheet open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
          <SheetContent side="bottom" className="p-0 h-[92vh] w-full border-none rounded-t-[2.5rem] overflow-hidden outline-none" hideCloseButton>
            <SheetHeader className="sr-only">
              <SheetTitle>{selectedPlace?.name}</SheetTitle>
            </SheetHeader>
            <div className="h-full w-full">
              {selectedPlace && (
                <PlaceDetails
                  place={selectedPlace}
                  onClose={handleDialogClose}
                  onCreateActivity={() => setActivityModalPlace(selectedPlace)}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        /* Desktop Place Details Dialog */
        <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogContent className="p-0 w-full max-w-4xl h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] sm:h-[88vh] sm:max-h-[88vh] flex flex-col min-h-0 gap-0 overflow-hidden border-none outline-none rounded-none sm:rounded-[2.5rem] dark:bg-neutral-900" hideCloseButton>
            <DialogTitle className="sr-only">{selectedPlace?.name || 'Ort Details'}</DialogTitle>
            <DialogDescription className="sr-only">Details zum ausgewählten Ort</DialogDescription>
            {selectedPlace && (
              <PlaceDetails
                place={selectedPlace}
                onClose={handleDialogClose}
                onCreateActivity={() => setActivityModalPlace(selectedPlace)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Create Activity Dialog */}
      <CreateActivityDialog
        place={activityModalPlace === 'custom' ? null : activityModalPlace}
        open={!!activityModalPlace}
        onOpenChange={(open) => !open && setActivityModalPlace(null)}
        onCreateActivity={handleCreateActivity}
      />
    </div>
  );
}
