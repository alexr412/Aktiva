'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Bell, Users, Palette, Info, ChevronRight, ChevronDown, Trash2, Loader2, KeyRound, Globe, Ban, Bug, LogOut, Heart, Radar, MapPin, Sparkles, UserCheck, Star, Activity, CheckCircle2, ShieldBan, Scale, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { useActivePremium } from '@/hooks/use-active-premium';
import { useFriendRadar } from '@/hooks/use-friend-radar';
import { RadarConsentDialog } from '@/components/radar/radar-consent-dialog';
import { sendPasswordReset, deleteAccount, signOut } from '@/lib/firebase/auth';
import { deleteUserDocument, updateUserProfile, updateNotificationPreferences, submitCreatorApplication } from '@/lib/firebase/firestore';
import { type PushCapabilityState, requestAndGetFCMToken } from '@/lib/firebase/messaging';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";

type NotificationSettings = {
    friendRequests: boolean;
    activityInvites: boolean;
    chatMessages: boolean;
    localHighlights: boolean;
    nearbyFriendActivityNotifications: boolean;
};

const REQUIRED_ACTIVITIES_COUNT = 20;
const REQUIRED_AVERAGE_RATING = 4.4;
const REQUIRED_RATINGS_COUNT = 10;

const formatPermissionState = (state: string, isDe: boolean) => {
  const s = (state || '').toLowerCase();
  if (s === 'granted') return isDe ? 'Erteilt' : 'Granted';
  if (s === 'denied') return isDe ? 'Verweigert' : 'Denied';
  if (s === 'prompt') return isDe ? 'Nicht entschieden' : 'Prompt';
  if (s === 'checking') return isDe ? 'Wird geprüft' : 'Checking';
  if (s === 'unavailable') return isDe ? 'Nicht verfügbar' : 'Unavailable';
  if (s === 'unknown') return isDe ? 'Unbekannt' : 'Unknown';
  return state;
};

const formatCountdown = (totalSeconds: number) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function SettingsPage() {
    const router = useRouter();
    const { user, userProfile, loading: authLoading } = useAuth();
    const language = useLanguage();
    const { toast } = useToast();

    const { isPremium, isOrganizer } = useActivePremium(userProfile);
    const hasAccess = isPremium || isOrganizer;

    const {
      enabled: radarEnabled,
      radiusKm: radarRadius,
      permissionState: radarPermissionState,
      lastLocationUpdatedAt,
      nextAllowedLocationUpdateAt,
      activateRadar,
      deactivateRadar,
      updateLocation,
      setRadius,
      error: radarError,
      clearError: clearRadarError,
      isUpdatingLocation,
      partialFailure: radarPartialFailure,
      dismissPartialFailure
    } = useFriendRadar();

    const [consentOpen, setConsentOpen] = useState(false);
    const [localRadius, setLocalRadius] = useState(5);
    const [isRadarDetailsOpen, setIsRadarDetailsOpen] = useState(false);

    useEffect(() => {
      if (radarRadius) {
        setLocalRadius(radarRadius);
      }
    }, [radarRadius]);

    useEffect(() => {
      if (radarError) {
        toast({
          variant: 'destructive',
          title: language === 'de' ? 'Fehler' : 'Error',
          description: radarError.message
        });
        clearRadarError();
      }
    }, [radarError, language]);
    
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        if (userProfile && userProfile.onboardingCompleted === false) {
            router.replace('/onboarding');
            return;
        }
    }, [user, userProfile, authLoading, router]);

    const [isSendingReset, setIsSendingReset] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);
    
    // Creator Stats
    const [activitiesCount, setActivitiesCount] = useState(0);
    const [isApplying, setIsApplying] = useState(false);
    const [hasApplication, setHasApplication] = useState(false);
    const [pushCapability, setPushCapability] = useState<PushCapabilityState>('unsupported');
    const [isEnablingPush, setIsEnablingPush] = useState(false);

    useEffect(() => {
      import('@/lib/firebase/messaging').then(({ getPushCapabilityState }) => {
        getPushCapabilityState().then(setPushCapability);
      });
    }, []);

    const handleEnablePush = async () => {
      if (!user?.uid || isEnablingPush) return;
      setIsEnablingPush(true);
      try {
        const { requestPushPermission, registerDevicePush } = await import('@/lib/firebase/messaging');
        const permission = await requestPushPermission();
        if (permission === 'granted') {
          const res = await registerDevicePush(user.uid);
          if (res.success) {
            setPushCapability('granted');
            await updateNotificationPreferences(user.uid, { pushEnabled: true });
            toast({
              title: language === 'de' ? 'Push-Benachrichtigungen aktiv' : 'Push notifications active',
              description: language === 'de' ? 'Du erhältst jetzt wichtige Benachrichtigungen auf diesem Gerät.' : 'You will now receive push notifications on this device.'
            });
          } else {
            setPushCapability('registration-error');
            toast({
              variant: 'destructive',
              title: language === 'de' ? 'Fehler' : 'Error',
              description: language === 'de' ? 'Token-Registrierung fehlgeschlagen.' : 'Token registration failed.'
            });
          }
        } else if (permission === 'denied') {
          setPushCapability('denied');
        }
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
      } finally {
        setIsEnablingPush(false);
      }
    };

    const [notifications, setNotifications] = useState<NotificationSettings>({
        friendRequests: userProfile?.notificationSettings?.friendRequests ?? true,
        activityInvites: userProfile?.notificationSettings?.activityInvites ?? true,
        chatMessages: userProfile?.notificationSettings?.chatMessages ?? true,
        localHighlights: userProfile?.notificationSettings?.localHighlights ?? false,
        nearbyFriendActivityNotifications: userProfile?.notificationSettings?.nearbyFriendActivityNotifications ?? true,
    });

    useEffect(() => {
        if (userProfile?.notificationSettings) {
            setNotifications({
                friendRequests: userProfile.notificationSettings.friendRequests ?? true,
                activityInvites: userProfile.notificationSettings.activityInvites ?? true,
                chatMessages: userProfile.notificationSettings.chatMessages ?? true,
                localHighlights: userProfile.notificationSettings.localHighlights ?? false,
                nearbyFriendActivityNotifications: userProfile.notificationSettings.nearbyFriendActivityNotifications ?? true,
            });
        }
    }, [userProfile]);

    useEffect(() => {
      if (!user || !db) return;

      const fetchStats = async () => {
        if (!db) return;
        const q = query(collection(db, 'activities'), where('hostId', '==', user.uid), where('status', '==', 'completed'));
        const snap = await getDocs(q);
        setActivitiesCount(snap.size);

        const appQ = query(collection(db, 'creator_applications'), where('userId', '==', user.uid), where('status', '==', 'pending'));
        const appSnap = await getDocs(appQ);
        setHasApplication(!appSnap.empty);
      };

      fetchStats();
    }, [user]);

    const handleNotificationChange = async (key: keyof NotificationSettings, value: boolean) => {
        if (!user?.uid) return;

        const currentSettings = { ...notifications };
        const newSettings = { ...notifications, [key]: value };
        setNotifications(newSettings); 

        try {
            let fcmToken = userProfile?.fcmToken;
            
            // Wenn Highlights aktiviert werden, Token anfordern
            if (key === 'localHighlights' && value === true && !fcmToken) {
                fcmToken = (await requestAndGetFCMToken()) || undefined;
            }

            await updateNotificationPreferences(user.uid, newSettings);
            
            if (key === 'localHighlights' && value === true) {
                toast({ 
                    title: language === 'de' ? "Highlights aktiviert" : "Highlights activated", 
                    description: language === 'de' ? "Wir benachrichtigen dich bei Events in deiner Nähe." : "We will notify you about events near you." 
                });
            }
        } catch (error) {
            console.error("Failed to save notification settings", error);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler' : 'Error',
                description: language === 'de' ? 'Einstellungen konnten nicht gespeichert werden.' : 'Settings could not be saved.',
            });
            setNotifications(currentSettings);
        }
    };

    const handleProximityToggle = async (checked: boolean) => {
      if (!hasAccess) return;
      if (checked) {
        setConsentOpen(true);
      } else {
        try {
          await deactivateRadar();
          toast({ title: language === 'de' ? "Radar deaktiviert" : "Radar deactivated" });
        } catch (err) {
          console.error(err);
        }
      }
    };

    const handleConsentAccept = async () => {
      try {
        await activateRadar(localRadius);
        setIsRadarDetailsOpen(true);
        toast({ title: language === 'de' ? "Radar aktiviert" : "Radar activated" });
      } catch (err) {
        console.error(err);
      }
    };

    const handleApplyCreator = async () => {
      if (!user || !userProfile) return;
      setIsApplying(true);
      try {
        await submitCreatorApplication(user.uid, userProfile.displayName, userProfile.averageRating || 0, activitiesCount, userProfile.ratingCount || 0);
        setHasApplication(true);
        toast({ 
          title: language === 'de' ? "Bewerbung gesendet!" : "Application sent!", 
          description: language === 'de' ? "Wir prüfen dein Profil innerhalb von 48 Stunden." : "We will review your profile within 48 hours." 
        });
      } catch (err: any) {
        toast({ variant: 'destructive', title: language === 'de' ? "Fehler" : "Error", description: err.message });
      } finally {
        setIsApplying(false);
      }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) {
            toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: language === 'de' ? 'Keine E-Mail-Adresse für dein Konto gefunden.' : 'No email address found for your account.' });
            return;
        }
        setIsSendingReset(true);
        try {
            await sendPasswordReset(user.email);
            toast({ 
              title: language === 'de' ? 'E-Mail zum Zurücksetzen gesendet' : 'Password Reset Email Sent', 
              description: language === 'de' ? 'Überprüfe deinen Posteingang für den Link zum Zurücksetzen.' : 'Check your inbox for a link to reset your password.' 
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: error.message || (language === 'de' ? 'Senden fehlgeschlagen.' : 'Failed to send password reset email.') });
        } finally {
            setIsSendingReset(false);
        }
    };
    
    const handleDeleteAccount = async (password: string) => {
        if (!user) return;
        setIsDeleting(true);
        try {
            await deleteAccount(password);
            toast({ 
              title: language === 'de' ? 'Account gelöscht' : 'Account Deleted', 
              description: language === 'de' ? 'Dein Account und alle Daten wurden erfolgreich gelöscht.' : 'Your account and all data have been successfully deleted.' 
            });
            router.push('/signup');
        } catch (error: any) {
            const msg = error.message || (language === 'de' ? 'Konnte deinen Account nicht löschen.' : 'Could not delete your account.');
            setDeleteError(msg);
            toast({ 
              variant: 'destructive', 
              title: language === 'de' ? 'Löschen fehlgeschlagen' : 'Deletion Failed', 
              description: msg
            });
        } finally {
            setIsDeleting(false);
            setDeleteConfirmText('');
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/login');
            toast({
                title: language === 'de' ? 'Abgemeldet' : 'Logged Out',
                description: language === 'de' ? 'Du wurdest erfolgreich abgemeldet.' : 'You have been successfully signed out.',
            });
        } catch (error) {
            console.error("Logout failed", error);
            toast({
                title: language === 'de' ? "Abmelden fehlgeschlagen" : "Logout Failed",
                description: language === 'de' ? "Es gab ein Problem beim Abmelden." : "There was a problem signing you out.",
                variant: "destructive",
            });
        }
    };



    const canApply = activitiesCount >= REQUIRED_ACTIVITIES_COUNT &&
                     (userProfile?.averageRating || 0) >= REQUIRED_AVERAGE_RATING &&
                     (userProfile?.ratingCount || 0) >= REQUIRED_RATINGS_COUNT;

    if (authLoading || !user || (userProfile && userProfile.onboardingCompleted === false)) {
        return (
            <div className="flex flex-1 min-h-0 w-full items-center justify-center bg-background">
                <div className="relative w-12 h-12 animate-pulse">
                    <Image src="/assets/logo-heart.png" alt="Activa" fill sizes="48px" className="object-contain" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-secondary overflow-y-auto pb-bottom-nav-safe">
            <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()} aria-label={language === 'de' ? 'Zurück' : 'Back'}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-xl font-bold">{language === 'de' ? 'Einstellungen' : 'Settings'}</h1>
            </header>

            <div className="p-6 space-y-8 max-w-2xl mx-auto w-full">
                    {/* Fundraising Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                            <span>{language === 'de' ? 'Community Support' : 'Community Support'}</span>

                        </h2>
                        <div className="space-y-2">
                            <button onClick={() => window.open('https://paypal.me/aktiva', '_blank')} className="flex w-full items-center justify-between rounded-lg border-2 border-red-500/20 bg-red-500/5 p-4 text-left transition-colors hover:bg-red-500/10 gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-red-600 truncate">{language === 'de' ? 'Unterstütze Activa' : 'Support Activa'}</p>
                                    <p className="text-sm text-red-600/70 leading-normal">{language === 'de' ? 'Spende einen kleinen Betrag & erhalte das Supporter-Badge.' : 'Donate a small amount & get the supporter badge.'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-red-500 shrink-0" />
                            </button>
                        </div>
                    </div>

                    {/* Friends Radar Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <Radar className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Freunde-Radar' : 'Friends Radar'}</span>
                        </h2>
                        <div className="space-y-4 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-card p-5 shadow-sm">
                            {!hasAccess ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
                                    {language === 'de' ? 'Freunde-Radar' : 'Friends Radar'}
                                  </span>
                                  <Badge className="bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full">PREMIUM</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {language === 'de' 
                                    ? 'Sieh, welche bestätigten Freunde kürzlich in deiner Nähe waren. Dein genauer Standort wird anderen Nutzern nicht angezeigt. Hol dir Premium oder werde Organizer, um dieses Feature freizuschalten.' 
                                    : 'See which confirmed friends were recently near you. Your exact location is never shown. Upgrade to Premium or become an Organizer to unlock this feature.'}
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <Label htmlFor="radar-enabled" className="text-sm font-semibold cursor-pointer">
                                          {language === 'de' ? 'Radar aktivieren' : 'Enable Radar'}
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                          {language === 'de' 
                                            ? 'Zeigt Freunde in deiner Nähe an, wenn sie die App nutzen.' 
                                            : 'Show nearby friends when they use the app.'}
                                        </p>
                                    </div>
                                    <Switch
                                        id="radar-enabled"
                                        checked={radarEnabled}
                                        onCheckedChange={handleProximityToggle}
                                        className="shrink-0"
                                    />
                                </div>

                                {radarPartialFailure && (
                                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200/50 rounded-2xl space-y-2">
                                    <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-normal">
                                      {language === 'de'
                                        ? 'Einstellung aktiviert, aber Standort konnte nicht aktualisiert werden.'
                                        : 'Radar enabled, but location update failed.'}
                                    </p>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => updateLocation()} disabled={isUpdatingLocation} className="h-7 text-[10px] font-black rounded-full">
                                        {language === 'de' ? 'Erneut versuchen' : 'Retry'}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={dismissPartialFailure} className="h-7 text-[10px] font-black rounded-full text-slate-500">
                                        {language === 'de' ? 'Verwerfen' : 'Dismiss'}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                
                                {radarEnabled && (
                                  <Collapsible open={isRadarDetailsOpen} onOpenChange={setIsRadarDetailsOpen} className="w-full space-y-4 pt-1">
                                    <Separator />
                                    <CollapsibleTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex w-full items-center justify-between py-1 text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                                      >
                                        <span>{language === 'de' ? 'Einstellungen & Datenschutz' : 'Settings & Privacy'}</span>
                                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-slate-400", isRadarDetailsOpen && "rotate-180")} />
                                      </button>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent className="space-y-4 pt-2">
                                      <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-sm font-medium">{language === 'de' ? 'Radar-Radius' : 'Radar Radius'}</Label>
                                          <span className="text-primary font-bold text-sm">{localRadius} km</span>
                                        </div>
                                        <Slider
                                          value={[localRadius]}
                                          max={25}
                                          min={1}
                                          step={1}
                                          onValueChange={(val) => setLocalRadius(val[0])}
                                          onValueCommit={(val) => setRadius(val[0])}
                                        />
                                        
                                        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-neutral-800/80 text-[11px] text-slate-500 dark:text-neutral-400">
                                          <div className="flex justify-between items-center gap-2 min-w-0">
                                            <span className="truncate">{language === 'de' ? 'Berechtigungsstatus:' : 'Permission status:'}</span>
                                            <span className="font-semibold text-slate-700 dark:text-neutral-300 shrink-0 text-right">
                                              {formatPermissionState(radarPermissionState, language === 'de')}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center gap-2 min-w-0">
                                            <span className="truncate">{language === 'de' ? 'Letzte Aktualisierung:' : 'Last update:'}</span>
                                            <span className="font-semibold text-slate-700 dark:text-neutral-300 shrink-0 text-right">
                                              {lastLocationUpdatedAt ? lastLocationUpdatedAt.toLocaleTimeString() : '-'}
                                            </span>
                                          </div>
                                          {nextAllowedLocationUpdateAt && Date.now() < nextAllowedLocationUpdateAt.getTime() && (
                                            <div className="flex justify-between items-center gap-2 min-w-0 text-amber-600 dark:text-amber-500">
                                              <span className="truncate">{language === 'de' ? 'Nächstes Update in:' : 'Next update allowed in:'}</span>
                                              <span className="font-bold font-mono shrink-0 text-right">
                                                {formatCountdown(Math.ceil((nextAllowedLocationUpdateAt.getTime() - Date.now()) / 1000))}
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                                          <Button
                                            onClick={() => updateLocation()}
                                            disabled={isUpdatingLocation || (nextAllowedLocationUpdateAt && Date.now() < nextAllowedLocationUpdateAt.getTime()) ? true : false}
                                            className="w-full sm:flex-1 h-10 rounded-full text-xs font-bold text-white shadow-sm disabled:bg-emerald-500/15 dark:disabled:bg-emerald-500/20 disabled:text-emerald-700 dark:disabled:text-emerald-400 disabled:opacity-100 disabled:shadow-none"
                                          >
                                            {isUpdatingLocation ? (language === 'de' ? 'Aktualisiere...' : 'Updating...') : (language === 'de' ? 'Standort jetzt aktualisieren' : 'Update location now')}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            onClick={deactivateRadar}
                                            className="w-full sm:w-auto h-10 rounded-full text-xs font-bold border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
                                          >
                                            {language === 'de' ? 'Standortdaten löschen' : 'Delete location data'}
                                          </Button>
                                        </div>

                                        <div className="p-4 mt-3 bg-slate-50/50 dark:bg-neutral-900/30 rounded-3xl border border-slate-100 dark:border-neutral-800/50 space-y-2 text-[10px] text-slate-400 dark:text-neutral-500 leading-normal">
                                          <p className="font-black uppercase tracking-widest">{language === 'de' ? 'Datenschutzhinweise' : 'Privacy Notice'}</p>
                                          <ul className="list-disc pl-4 space-y-1">
                                            <li>{language === 'de' ? 'Standort wird nur bei aktiver Nutzung der App aktualisiert.' : 'Location is only updated while actively using the app.'}</li>
                                            <li>{language === 'de' ? 'Keine dauerhafte Hintergrundortung.' : 'No background location tracking.'}</li>
                                            <li>{language === 'de' ? 'Nur bestätigte Freunde mit gegenseitigem Radar-Opt-in können dich sehen.' : 'Only confirmed friends with mutual opt-in can see you.'}</li>
                                            <li>{language === 'de' ? 'Keine exakten Freundespositionen werden übertragen.' : 'No exact friend positions are transmitted.'}</li>
                                            <li>{language === 'de' ? 'Kein Standortverlauf wird gespeichert.' : 'No location history is saved.'}</li>
                                            <li>{language === 'de' ? 'Standortdaten werden nach 24 Stunden automatisch ungültig.' : 'Location data expires automatically after 24 hours.'}</li>
                                          </ul>
                                        </div>
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}

                                {!radarEnabled && (
                                  <Collapsible open={isRadarDetailsOpen} onOpenChange={setIsRadarDetailsOpen} className="w-full space-y-4 pt-1">
                                    <Separator />
                                    <CollapsibleTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex w-full items-center justify-between py-1 text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                                      >
                                        <span>{language === 'de' ? 'Datenschutzhinweise' : 'Privacy Notice'}</span>
                                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-slate-400", isRadarDetailsOpen && "rotate-180")} />
                                      </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-2">
                                      <div className="p-4 bg-slate-50/50 dark:bg-neutral-900/30 rounded-3xl border border-slate-100 dark:border-neutral-800/50 space-y-2 text-[10px] text-slate-400 dark:text-neutral-500 leading-normal">
                                        <p className="font-black uppercase tracking-widest">{language === 'de' ? 'Datenschutzhinweise' : 'Privacy Notice'}</p>
                                        <ul className="list-disc pl-4 space-y-1">
                                          <li>{language === 'de' ? 'Standort wird nur bei aktiver Nutzung der App aktualisiert.' : 'Location is only updated while actively using the app.'}</li>
                                          <li>{language === 'de' ? 'Keine dauerhafte Hintergrundortung.' : 'No background location tracking.'}</li>
                                          <li>{language === 'de' ? 'Nur bestätigte Freunde mit gegenseitigem Radar-Opt-in können dich sehen.' : 'Only confirmed friends with mutual opt-in can see you.'}</li>
                                          <li>{language === 'de' ? 'Keine exakten Freundespositionen werden übertragen.' : 'No exact friend positions are transmitted.'}</li>
                                          <li>{language === 'de' ? 'Kein Standortverlauf wird gespeichert.' : 'No location history is saved.'}</li>
                                          <li>{language === 'de' ? 'Standortdaten werden nach 24 Stunden automatisch ungültig.' : 'Location data expires automatically after 24 hours.'}</li>
                                        </ul>
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </>
                            )}
                        </div>
                    </div>

                    <RadarConsentDialog
                      open={consentOpen}
                      onOpenChange={setConsentOpen}
                      onAccept={handleConsentAccept}
                      onCancel={() => {
                        toast({ title: language === 'de' ? 'Aktivierung abgebrochen' : 'Activation cancelled' });
                      }}
                      language={language}
                    />

                    {/* Notifications Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <Bell className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Benachrichtigungen' : 'Notifications'}</span>
                        </h2>

                        {/* Master Push Status Card */}
                        <div className="p-4 rounded-2xl border bg-card space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm">
                                        {language === 'de' ? 'System-Push-Benachrichtigungen' : 'System Push Notifications'}
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {pushCapability === 'granted' && (language === 'de' ? 'Push-Benachrichtigungen sind für dieses Gerät aktiv.' : 'Push notifications are active on this device.')}
                                        {pushCapability === 'default' && (language === 'de' ? 'Erhalte Infos zu Chats & Events auch wenn Activa geschlossen ist.' : 'Get notifications even when Activa is closed.')}
                                        {pushCapability === 'denied' && (language === 'de' ? 'Benachrichtigungen wurden im Browser blockiert. Bitte in den Systemeinstellungen des Browsers freigeben.' : 'Notifications were blocked in your browser. Please enable them in browser settings.')}
                                        {pushCapability === 'installed-pwa-required' && (language === 'de' ? 'Füge Activa zum Home-Bildschirm hinzu, um Push auf iOS zu aktivieren.' : 'Add Activa to Home Screen to enable iOS push.')}
                                        {pushCapability === 'unsupported' && (language === 'de' ? 'Push wird auf diesem Browser/Gerät nicht unterstützt.' : 'Push is not supported on this device/browser.')}
                                        {pushCapability === 'registration-error' && (language === 'de' ? 'Fehler bei der Registrierung. Bitte erneut versuchen.' : 'Registration error. Please retry.')}
                                    </p>
                                </div>

                                {pushCapability === 'default' && (
                                    <Button size="sm" onClick={handleEnablePush} disabled={isEnablingPush} className="shrink-0 text-xs font-bold rounded-full">
                                        {isEnablingPush && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                        {language === 'de' ? 'Aktivieren' : 'Enable'}
                                    </Button>
                                )}

                                {pushCapability === 'granted' && (
                                    <span className="shrink-0 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                        {language === 'de' ? 'Aktiv' : 'Active'}
                                    </span>
                                )}
                            </div>
                        </div>

                <div className="space-y-2 rounded-lg border bg-card p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0 pr-2">
                                    <Label htmlFor="local-highlights" className="font-medium flex items-center gap-2">
                                      <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                      <span className="truncate">{language === 'de' ? 'Lokale Highlights' : 'Local Highlights'}</span>
                                    </Label>
                                    <p className="text-sm text-muted-foreground break-words">{language === 'de' ? 'Infos zu Top-Aktivitäten im 2km Umkreis.' : 'Info about top activities in a 2km radius.'}</p>
                                </div>
                                <Switch
                                    id="local-highlights"
                                    checked={notifications.localHighlights}
                                    onCheckedChange={(checked) => handleNotificationChange('localHighlights', checked)}
                                    className="shrink-0"
                                />
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0 pr-2">
                                    <Label htmlFor="nearby-friend-activities" className="font-medium flex items-center gap-2">
                                      <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                                      <span className="truncate">{language === 'de' ? 'Aktivitäten von Freunden in der Nähe' : 'Nearby Friend Activities'}</span>
                                    </Label>
                                    <p className="text-sm text-muted-foreground break-words">{language === 'de' ? 'Benachrichtigung, wenn Freunde eine Aktivität im Umkreis erstellen.' : 'Notify when friends create an activity nearby.'}</p>
                                </div>
                                <Switch
                                    id="nearby-friend-activities"
                                    checked={notifications.nearbyFriendActivityNotifications}
                                    onCheckedChange={(checked) => handleNotificationChange('nearbyFriendActivityNotifications', checked)}
                                    className="shrink-0"
                                />
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0 pr-2">
                                    <Label htmlFor="friend-requests" className="font-medium">{language === 'de' ? 'Freundesanfragen' : 'Friend Requests'}</Label>
                                    <p className="text-sm text-muted-foreground break-words">{language === 'de' ? 'Bei neuen Anfragen informieren.' : 'Notify on new friend requests.'}</p>
                                </div>
                                <Switch
                                    id="friend-requests"
                                    checked={notifications.friendRequests}
                                    onCheckedChange={(checked) => handleNotificationChange('friendRequests', checked)}
                                    className="shrink-0"
                                />
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0 pr-2">
                                    <Label htmlFor="activity-invites" className="font-medium">{language === 'de' ? 'Einladungen' : 'Invites'}</Label>
                                    <p className="text-sm text-muted-foreground break-words">{language === 'de' ? 'Bei Einladungen zu Aktivitäten informieren.' : 'Notify on activity invites.'}</p>
                                </div>
                                <Switch
                                    id="activity-invites"
                                    checked={notifications.activityInvites}
                                    onCheckedChange={(checked) => handleNotificationChange('activityInvites', checked)}
                                    className="shrink-0"
                                />
                            </div>
                             <Separator className="my-4"/>
                             <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0 pr-2">
                                    <Label htmlFor="chat-messages" className="font-medium">{language === 'de' ? 'Chat-Nachrichten' : 'Chat Messages'}</Label>
                                    <p className="text-sm text-muted-foreground break-words">{language === 'de' ? 'Bei neuen Nachrichten benachrichtigen.' : 'Notify on new chat messages.'}</p>
                                </div>
                                <Switch
                                    id="chat-messages"
                                    checked={notifications.chatMessages}
                                    onCheckedChange={(checked) => handleNotificationChange('chatMessages', checked)}
                                    className="shrink-0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Account Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <User className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Konto' : 'Account'}</span>

                        </h2>
                        <div className="space-y-2">
                            <button onClick={() => router.push('/profile/edit')} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Profil bearbeiten' : 'Edit Profile'}</p>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Aktualisiere deinen Namen, Bio, Interessen, etc.' : 'Update your name, bio, interests, etc.'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                             <button onClick={handlePasswordReset} disabled={isSendingReset} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Passwort ändern' : 'Change Password'}</p>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Lege ein neues Passwort für dich fest.' : 'Set a new password for your account.'}</p>
                                </div>
                                {isSendingReset ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5 text-muted-foreground" />}
                            </button>
                             <button onClick={() => router.push('/settings/language')} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Sprache' : 'Language'}</p>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Ändere die Sprache der App.' : 'Change application language.'}</p>
                                </div>
                                <Globe className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* Privacy & Safety Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <Ban className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Datenschutz & Sicherheit' : 'Privacy & Safety'}</span>
                        </h2>
                        <div className="space-y-2">
                             <button onClick={() => router.push('/settings/blocked')} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Blockierte Nutzer' : 'Blocked Users'}</p>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Verwalte blockierte Kontakte.' : 'Manage your blocked contacts.'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* MODUL 19: Creator Status Program */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <UserCheck className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Creator Programm' : 'Creator Program'}</span>
                        </h2>
                        <Card className="border-none shadow-sm overflow-hidden bg-card rounded-2xl">
                          <CardContent className="p-6 space-y-6">
                            <div className="space-y-1">
                              <div className="flex justify-between items-start">
                                <p className="font-bold text-foreground">{language === 'de' ? 'Monetarisierung & Wallet' : 'Monetization & Wallet'}</p>
                                <Badge variant="secondary" className="text-[9px] uppercase tracking-wider font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                  {language === 'de' ? 'Bald verfügbar' : 'Coming soon'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{language === 'de' ? 'Schalte Creator-Features frei, um bezahlte Events zu hosten.' : 'Unlock creator features to host paid events.'}</p>
                            </div>

                            {userProfile?.isCreator ? (
                              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-4 rounded-xl flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                                <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">{language === 'de' ? 'Du bist verifizierter Creator!' : 'You are a verified creator!'}</span>
                              </div>
                            ) : hasApplication ? (
                              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl flex items-center gap-3">
                                <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-500 animate-spin" />
                                <span className="font-black text-blue-700 dark:text-blue-400 text-sm">{language === 'de' ? 'Prüfung läuft...' : 'Review in progress...'}</span>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                 <div className="grid grid-cols-2 min-[380px]:grid-cols-3 gap-2">
                                   <div className={cn("py-3.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center h-full min-h-[90px]", activitiesCount >= REQUIRED_ACTIVITIES_COUNT ? "bg-primary/5 border-primary/20" : "bg-slate-50 dark:bg-neutral-900 border-slate-100 dark:border-neutral-800")}>
                                     <Activity className={cn("h-4 w-4 shrink-0", activitiesCount >= REQUIRED_ACTIVITIES_COUNT ? "text-primary" : "text-slate-400 dark:text-neutral-500")} />
                                     <span className="text-base min-[380px]:text-lg font-black text-foreground tracking-tight whitespace-nowrap">{activitiesCount} / {REQUIRED_ACTIVITIES_COUNT}</span>
                                     <span className="text-[9px] min-[380px]:text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 tracking-wider leading-tight">{language === 'de' ? 'Aktivitäten' : 'Activities'}</span>
                                   </div>
                                   <div className={cn("py-3.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center h-full min-h-[90px]", (userProfile?.averageRating || 0) >= REQUIRED_AVERAGE_RATING ? "bg-primary/5 border-primary/20" : "bg-slate-50 dark:bg-neutral-900 border-slate-100 dark:border-neutral-800")}>
                                     <Star className={cn("h-4 w-4 shrink-0", (userProfile?.averageRating || 0) >= REQUIRED_AVERAGE_RATING ? "text-amber-500 fill-amber-500" : "text-slate-400 dark:text-neutral-500")} />
                                     <span className="text-base min-[380px]:text-lg font-black text-foreground tracking-tight whitespace-nowrap">{userProfile?.averageRating?.toFixed(1) || '0.0'} / {REQUIRED_AVERAGE_RATING}</span>
                                     <span className="text-[9px] min-[380px]:text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 tracking-wider leading-tight">{language === 'de' ? 'Bewertung' : 'Rating'}</span>
                                   </div>
                                   <div className={cn("col-span-2 min-[380px]:col-span-1 py-3.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center h-full min-h-[90px]", (userProfile?.ratingCount || 0) >= REQUIRED_RATINGS_COUNT ? "bg-primary/5 border-primary/20" : "bg-slate-50 dark:bg-neutral-900 border-slate-100 dark:border-neutral-800")}>
                                     <MessageSquare className={cn("h-4 w-4 shrink-0", (userProfile?.ratingCount || 0) >= REQUIRED_RATINGS_COUNT ? "text-blue-500" : "text-slate-400 dark:text-neutral-500")} />
                                     <span className="text-base min-[380px]:text-lg font-black text-foreground tracking-tight whitespace-nowrap">{userProfile?.ratingCount || 0} / {REQUIRED_RATINGS_COUNT}</span>
                                     <span className="text-[9px] min-[380px]:text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 tracking-wider leading-tight">{language === 'de' ? 'Bewertungen' : 'Reviews'}</span>
                                   </div>
                                 </div>

                                <Button 
                                  onClick={handleApplyCreator} 
                                  disabled={!canApply || isApplying}
                                  className="w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-900 hover:bg-black dark:bg-primary dark:hover:bg-primary/90 dark:text-white text-white"
                                >
                                  {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : language === 'de' ? "Als Creator bewerben" : "Apply as Creator"}
                                </Button>
                                
                                {!canApply && (
                                  <p className="text-[10px] text-center text-slate-400 dark:text-neutral-500 font-medium">{language === 'de' ? 'Erfülle alle drei Anforderungen, um dich zu bewerben.' : 'Meet all three requirements to apply.'}</p>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <Palette className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Erscheinungsbild' : 'Appearance'}</span>
                        </h2>
                         <ThemeSelector />
                    </div>

                    {/* Support Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <Bug className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Support' : 'Support'}</span>

                        </h2>
                        <div className="space-y-2">
                             <button onClick={() => window.location.href = 'mailto:support@app.com?subject=Bug%20Report'} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Fehler melden' : 'Report a Bug'}</p>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Hilf uns die App zu verbessern.' : 'Help us improve the application.'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                     
                    {/* About Section */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3">
                            <Info className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Über' : 'About'}</span>
                        </h2>
                        <div className="space-y-2">
                           <div className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Version' : 'Version'}</p>

                                </div>
                                <p className="text-sm text-muted-foreground">1.0.0</p>
                            </div>
                             <button onClick={() => router.push('/settings/legal')} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Rechtliches' : 'Legal'}</p>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Impressum, Datenschutz, AGB & mehr' : 'Imprint, Privacy, Terms & more'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* Log out section */}
                    <div className="space-y-4 pt-4">
                         <Button variant="ghost" onClick={handleSignOut} className="w-full text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-400/10 font-bold">
                            <LogOut className="mr-2 h-5 w-5" />
                            {language === 'de' ? 'Abmelden' : 'Log Out'}
                        </Button>
                    </div>
                    
                    {/* Danger Zone */}
                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            <span>{language === 'de' ? 'Gefahrenzone' : 'Danger Zone'}</span>
                        </h2>
                        <div className="rounded-lg border-2 border-destructive/50 bg-card p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Account löschen' : 'Delete Account'}</p>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Permanent deinen Account löschen.' : 'Permanently delete your account and all data.'}</p>
                                </div>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">{language === 'de' ? 'Löschen' : 'Delete'}</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{language === 'de' ? 'Bist du sicher?' : 'Are you absolutely sure?'}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {language === 'de' 
                                                    ? 'Dieser Vorgang kann nicht rückgängig gemacht werden. Alle deine Daten werden gelöscht. Zur Sicherheit gib bitte dein Passwort ein:' 
                                                    : 'This action cannot be undone. All your data will be deleted. For security, please enter your password:'}
                                            </AlertDialogDescription>

                                        </AlertDialogHeader>
                                         <div className="space-y-4">
                                            <div className="p-4 bg-muted/50 rounded-2xl space-y-3">
                                                <Label htmlFor="delete-account-password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{language === 'de' ? 'Bestätige dein Passwort' : 'Confirm your password'}</Label>
                                                <Input 
                                                    id="delete-account-password"
                                                    type="password"
                                                    value={deleteConfirmText}
                                                    onChange={(e) => {
                                                        setDeleteConfirmText(e.target.value);
                                                        if (deleteError) setDeleteError(null);
                                                    }}
                                                    placeholder={language === 'de' ? "Passwort eingeben" : "Enter password"}
                                                    className="h-12 rounded-xl bg-background border-none shadow-sm font-bold focus-visible:ring-emerald-500/20"
                                                />
                                            </div>

                                            {deleteError ? (
                                                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2">
                                                    <p className="text-xs font-bold text-destructive text-center">{deleteError}</p>
                                                    <button 
                                                        onClick={() => {
                                                            handlePasswordReset();
                                                            setDeleteError(null);
                                                        }}
                                                        className="w-full h-10 rounded-lg bg-white/50 dark:bg-black/20 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-white/80 transition-colors"
                                                    >
                                                        {language === 'de' ? 'Passwort jetzt zurücksetzen' : 'Reset password now'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handlePasswordReset();
                                                    }}
                                                    className="w-full text-[10px] font-black uppercase tracking-widest text-primary hover:underline underline-offset-4 text-center opacity-70 hover:opacity-100 transition-all"
                                                >
                                                    {language === 'de' ? 'Passwort vergessen?' : 'Forgot password?'}
                                                </button>
                                            )}
                                         </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel onClick={() => {
                                                setDeleteConfirmText('');
                                                setDeleteError(null);
                                            }}>{language === 'de' ? 'Abbrechen' : 'Cancel'}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleDeleteAccount(deleteConfirmText);
                                                }}
                                                disabled={!deleteConfirmText || isDeleting}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                {isDeleting ? (language === 'de' ? 'Löschen...' : 'Deleting...') : (language === 'de' ? 'Löschen bestätigen' : 'Delete Account')}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    );
}
