'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Bell, Palette, Info, ChevronRight, Trash2, Loader2, KeyRound, Globe, Ban, Bug, LogOut, Heart, Radar, MapPin, Sparkles, UserCheck, Star, Activity, CheckCircle2, ShieldBan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordReset, deleteAccount, signOut } from '@/lib/firebase/auth';
import { deleteUserDocument, updateUserProfile, submitCreatorApplication } from '@/lib/firebase/firestore';
import { requestAndGetFCMToken } from '@/lib/firebase/messaging';
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
};

const REQUIRED_ACTIVITIES = 20;
const REQUIRED_RATING = 4.4;

export default function SettingsPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const language = useLanguage();
    const { toast } = useToast();
    
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    
    // Creator Stats
    const [activitiesCount, setActivitiesCount] = useState(0);
    const [isApplying, setIsApplying] = useState(false);
    const [hasApplication, setHasApplication] = useState(false);

    const [notifications, setNotifications] = useState<NotificationSettings>({
        friendRequests: userProfile?.notificationSettings?.friendRequests ?? true,
        activityInvites: userProfile?.notificationSettings?.activityInvites ?? true,
        chatMessages: userProfile?.notificationSettings?.chatMessages ?? true,
        localHighlights: userProfile?.notificationSettings?.localHighlights ?? false,
    });

    useEffect(() => {
      if (!user || !db) return;

      const fetchStats = async () => {
        if (!db) return;
        const q = query(collection(db, 'activities'), where('hostId', '==', user.uid));
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

            await updateUserProfile(user.uid, {
                notificationSettings: newSettings,
                ...(fcmToken && { fcmToken })
            });
            
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

    const handleProximityToggle = async (enabled: boolean) => {
      if (!user?.uid) return;
      try {
        await updateUserProfile(user.uid, {
          proximitySettings: {
            ...userProfile?.proximitySettings,
            enabled,
            radiusKm: userProfile?.proximitySettings?.radiusKm || 5
          }
        });
        toast({ title: enabled 
          ? (language === 'de' ? "Radar aktiviert" : "Radar activated") 
          : (language === 'de' ? "Radar deaktiviert" : "Radar deactivated") 
        });
      } catch (err) {
        toast({ variant: 'destructive', title: language === 'de' ? "Fehler" : "Error", description: language === 'de' ? "Einstellungen konnten nicht gespeichert werden." : "Settings could not be saved." });
      }
    };

    const handleRadiusChange = async (value: number[]) => {
      if (!user?.uid) return;
      try {
        await updateUserProfile(user.uid, {
          proximitySettings: {
            ...userProfile?.proximitySettings,
            enabled: userProfile?.proximitySettings?.enabled || false,
            radiusKm: value[0]
          }
        });
      } catch (err) {
        console.error(err);
      }
    };

    const handleApplyCreator = async () => {
      if (!user || !userProfile) return;
      setIsApplying(true);
      try {
        await submitCreatorApplication(user.uid, userProfile.displayName, userProfile.averageRating || 0, activitiesCount);
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
    
    const handleDeleteAccount = async () => {
        if (!user) return;
        setIsDeleting(true);
        try {
            await deleteUserDocument(user.uid);
            await deleteAccount();
            toast({ 
              title: language === 'de' ? 'Account gelöscht' : 'Account Deleted', 
              description: language === 'de' ? 'Dein Account und alle Daten wurden erfolgreich gelöscht.' : 'Your account and all data have been successfully deleted.' 
            });
            router.push('/');
        } catch (error: any) {
            toast({ 
              variant: 'destructive', 
              title: language === 'de' ? 'Löschen fehlgeschlagen' : 'Deletion Failed', 
              description: error.message || (language === 'de' ? 'Konnte deinen Account nicht löschen. Eventuell musst du dich neu anmelden.' : 'Could not delete your account. You may need to log in again.') 
            });
        } finally {
            setIsDeleting(false);
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



    const canApply = activitiesCount >= REQUIRED_ACTIVITIES && (userProfile?.averageRating || 0) >= REQUIRED_RATING;

    return (
        <div className="flex flex-col h-full bg-secondary">
            <header className="flex h-16 items-center border-b bg-background px-4 shrink-0">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold">{language === 'de' ? 'Einstellungen' : 'Settings'}</h1>
            </header>

            <main className="flex-1 overflow-y-auto pb-20">
                <div className="p-6 space-y-8 max-w-2xl mx-auto">
                    {/* Fundraising Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                            <span>{language === 'de' ? 'Community Support' : 'Community Support'}</span>

                        </h2>
                        <div className="space-y-2">
                            <button onClick={() => window.open('https://paypal.me/aktvia', '_blank')} className="flex w-full items-center justify-between rounded-lg border-2 border-red-500/20 bg-red-500/5 p-4 text-left transition-colors hover:bg-red-500/10">
                                <div>
                                    <p className="font-bold text-red-600">{language === 'de' ? 'Unterstütze Aktvia' : 'Support Aktvia'}</p>
                                    <p className="text-sm text-red-600/70">{language === 'de' ? 'Spende einen kleinen Betrag & erhalte das Supporter-Badge.' : 'Donate a small amount & get the supporter badge.'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-red-500" />
                            </button>
                        </div>
                    </div>

                    {/* Friends Radar Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Radar className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Freunde-Radar' : 'Friends Radar'}</span>
                        </h2>
                        <div className="space-y-4 rounded-lg border bg-card p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="radar-enabled" className="font-medium">{language === 'de' ? 'Radar aktivieren' : 'Enable Radar'}</Label>
                                    <p className="text-xs text-muted-foreground">{language === 'de' ? 'Zeigt Freunde in deiner Nähe an, wenn sie die App nutzen.' : 'Show nearby friends when they use the app.'}</p>
                                </div>
                                <Switch
                                    id="radar-enabled"
                                    checked={userProfile?.proximitySettings?.enabled}
                                    onCheckedChange={handleProximityToggle}
                                />
                            </div>
                            
                            {userProfile?.proximitySettings?.enabled && (
                              <>
                                <Separator />
                                <div className="space-y-4 pt-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">{language === 'de' ? 'Radar-Radius' : 'Radar Radius'}</Label>
                                    <span className="text-primary font-bold text-sm">{userProfile.proximitySettings.radiusKm} km</span>
                                  </div>
                                  <Slider
                                    defaultValue={[userProfile.proximitySettings.radiusKm]}
                                    max={50}
                                    min={1}
                                    step={1}
                                    onValueChange={handleRadiusChange}
                                  />
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {language === 'de' ? 'Dein Standort wird nur bei App-Nutzung aktualisiert.' : 'Your location is only updated while using the app.'}
                                  </p>
                                </div>
                              </>
                            )}
                        </div>
                    </div>

                    {/* Notifications Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Bell className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Benachrichtigungen' : 'Notifications'}</span>
                        </h2>
                        <div className="space-y-2 rounded-lg border bg-card p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="local-highlights" className="font-medium flex items-center gap-2">
                                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                      {language === 'de' ? 'Lokale Highlights' : 'Local Highlights'}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Infos zu Top-Aktivitäten im 2km Umkreis.' : 'Info about top activities in a 2km radius.'}</p>
                                </div>
                                <Switch
                                    id="local-highlights"
                                    checked={notifications.localHighlights}
                                    onCheckedChange={(checked) => handleNotificationChange('localHighlights', checked)}
                                />
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="friend-requests" className="font-medium">{language === 'de' ? 'Freundesanfragen' : 'Friend Requests'}</Label>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Bei neuen Anfragen informieren.' : 'Notify on new friend requests.'}</p>
                                </div>
                                <Switch
                                    id="friend-requests"
                                    checked={notifications.friendRequests}
                                    onCheckedChange={(checked) => handleNotificationChange('friendRequests', checked)}
                                />
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="activity-invites" className="font-medium">{language === 'de' ? 'Einladungen' : 'Invites'}</Label>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Bei Einladungen zu Aktivitäten informieren.' : 'Notify on activity invites.'}</p>
                                </div>
                                <Switch
                                    id="activity-invites"
                                    checked={notifications.activityInvites}
                                    onCheckedChange={(checked) => handleNotificationChange('activityInvites', checked)}
                                />
                            </div>
                             <Separator className="my-4"/>
                             <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="chat-messages" className="font-medium">{language === 'de' ? 'Chat-Nachrichten' : 'Chat Messages'}</Label>
                                    <p className="text-sm text-muted-foreground">{language === 'de' ? 'Bei neuen Nachrichten benachrichtigen.' : 'Notify on new chat messages.'}</p>
                                </div>
                                <Switch
                                    id="chat-messages"
                                    checked={notifications.chatMessages}
                                    onCheckedChange={(checked) => handleNotificationChange('chatMessages', checked)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Account Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
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
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
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
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <UserCheck className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Creator Programm' : 'Creator Program'}</span>
                        </h2>
                        <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
                          <CardContent className="p-6 space-y-6">
                            <div className="space-y-1">
                              <p className="font-bold">{language === 'de' ? 'Monetarisierung & Wallet' : 'Monetization & Wallet'}</p>
                              <p className="text-xs text-muted-foreground">{language === 'de' ? 'Schalte Creator-Features frei, um bezahlte Events zu hosten.' : 'Unlock creator features to host paid events.'}</p>
                            </div>

                            {userProfile?.isCreator ? (
                              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                <span className="font-black text-emerald-700 text-sm">{language === 'de' ? 'Du bist verifizierter Creator!' : 'You are a verified creator!'}</span>
                              </div>
                            ) : hasApplication ? (
                              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3">
                                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                <span className="font-black text-blue-700 text-sm">{language === 'de' ? 'Prüfung läuft...' : 'Review in progress...'}</span>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className={cn("p-3 rounded-xl border flex flex-col items-center gap-1", activitiesCount >= REQUIRED_ACTIVITIES ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-slate-100")}>
                                    <Activity className={cn("h-4 w-4", activitiesCount >= REQUIRED_ACTIVITIES ? "text-primary" : "text-slate-400")} />
                                    <span className="text-xl font-black">{activitiesCount} / {REQUIRED_ACTIVITIES}</span>
                                    <span className="text-[8px] font-bold uppercase text-slate-400">{language === 'de' ? 'Aktivitäten' : 'Activities'}</span>
                                  </div>
                                  <div className={cn("p-3 rounded-xl border flex flex-col items-center gap-1", (userProfile?.averageRating || 0) >= REQUIRED_RATING ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-slate-100")}>
                                    <Star className={cn("h-4 w-4", (userProfile?.averageRating || 0) >= REQUIRED_RATING ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
                                    <span className="text-xl font-black">{userProfile?.averageRating?.toFixed(1) || '0.0'} / {REQUIRED_RATING}</span>
                                    <span className="text-[8px] font-bold uppercase text-slate-400">{language === 'de' ? 'Bewertung' : 'Rating'}</span>
                                  </div>
                                </div>

                                <Button 
                                  onClick={handleApplyCreator} 
                                  disabled={!canApply || isApplying}
                                  className="w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-900 hover:bg-black"
                                >
                                  {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : language === 'de' ? "Als Creator bewerben" : "Apply as Creator"}
                                </Button>
                                
                                {!canApply && (
                                  <p className="text-[10px] text-center text-slate-400 font-medium">{language === 'de' ? 'Erfülle beide Anforderungen, um dich zu bewerben.' : 'Meet both requirements to apply.'}</p>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Palette className="h-5 w-5 text-primary" />
                            <span>{language === 'de' ? 'Erscheinungsbild' : 'Appearance'}</span>
                        </h2>
                         <ThemeSelector />
                    </div>

                    {/* Support Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
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
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
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
                             <button className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                             <button className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">{language === 'de' ? 'Nutzungsbedingungen' : 'Terms of Service'}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* Log out section */}
                    <div className="space-y-4 pt-4">
                         <Button variant="ghost" onClick={handleSignOut} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
                            <LogOut className="mr-2 h-5 w-5" />
                            {language === 'de' ? 'Abmelden' : 'Log Out'}
                        </Button>
                    </div>
                    
                    {/* Danger Zone */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3 text-destructive">
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
                                                {language === 'de' ? 'Dieser Vorgang kann nicht rückgängig gemacht werden. Alle deine Daten werden gelöscht. Tippe ' : 'This action cannot be undone. This will permanently delete your account, chats, and all other data. To confirm, please type '}
                                                <strong className="text-foreground">DELETE</strong>
                                                {language === 'de' ? ' unten ein, um zu bestätigen.' : ' below.'}
                                            </AlertDialogDescription>

                                        </AlertDialogHeader>
                                        <Input 
                                            value={deleteConfirmText}
                                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-muted"
                                        />
                                        <AlertDialogFooter>
                                            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>{language === 'de' ? 'Abbrechen' : 'Cancel'}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteAccount}
                                                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
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
            </main>
        </div>
    );
}
