'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Bell, Palette, Info, ChevronRight, Trash2, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordReset, deleteAccount } from '@/lib/firebase/auth';
import { deleteUserDocument, updateUserProfile } from '@/lib/firebase/firestore';
import { themes, useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
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

type NotificationSettings = {
    friendRequests: boolean;
    activityInvites: boolean;
    chatMessages: boolean;
};

export default function SettingsPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const { toast } = useToast();
    const { theme, setTheme } = useTheme();
    
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const [notifications, setNotifications] = useState<NotificationSettings>({
        friendRequests: true,
        activityInvites: true,
        chatMessages: true,
    });

    useEffect(() => {
        if (userProfile?.notificationSettings) {
            setNotifications(userProfile.notificationSettings);
        }
    }, [userProfile]);

    const handleNotificationChange = async (key: keyof NotificationSettings, value: boolean) => {
        if (!user?.uid) return;

        const currentSettings = { ...notifications };
        const newSettings = { ...notifications, [key]: value };
        setNotifications(newSettings); // Optimistic update

        try {
            await updateUserProfile(user.uid, {
                notificationSettings: newSettings
            });
        } catch (error) {
            console.error("Failed to save notification settings", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not save your settings.',
            });
            setNotifications(currentSettings); // Revert on failure
        }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'No email address found for your account.' });
            return;
        }
        setIsSendingReset(true);
        try {
            await sendPasswordReset(user.email);
            toast({ title: 'Password Reset Email Sent', description: 'Check your inbox for a link to reset your password.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to send password reset email.' });
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
            toast({ title: 'Account Deleted', description: 'Your account and all data have been successfully deleted.' });
            router.push('/');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message || 'Could not delete your account. You may need to log in again.' });
        } finally {
            setIsDeleting(false);
        }
    }


    return (
        <div className="flex flex-col h-full bg-secondary">
            <header className="flex h-16 items-center border-b bg-background px-4 shrink-0">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-lg font-semibold">Settings</h1>
            </header>

            <main className="flex-1 overflow-y-auto pb-20">
                <div className="p-6 space-y-8 max-w-2xl mx-auto">
                    {/* Account Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <User className="h-5 w-5 text-primary" />
                            <span>Account</span>
                        </h2>
                        <div className="space-y-2">
                            <button onClick={() => router.push('/profile/edit')} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">Edit Profile</p>
                                    <p className="text-sm text-muted-foreground">Update your name, bio, interests, etc.</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                             <button onClick={handlePasswordReset} disabled={isSendingReset} className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">Change Password</p>
                                    <p className="text-sm text-muted-foreground">Set a new password for your account.</p>
                                </div>
                                {isSendingReset ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5 text-muted-foreground" />}
                            </button>
                        </div>
                    </div>

                    {/* Notifications Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Bell className="h-5 w-5 text-primary" />
                            <span>Notifications</span>
                        </h2>
                        <div className="space-y-2 rounded-lg border bg-card p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="friend-requests" className="font-medium">Friend Requests</Label>
                                    <p className="text-sm text-muted-foreground">Notify me about new friend requests.</p>
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
                                    <Label htmlFor="activity-invites" className="font-medium">Activity Invites</Label>
                                    <p className="text-sm text-muted-foreground">Notify me when I'm invited to an activity.</p>
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
                                    <Label htmlFor="chat-messages" className="font-medium">Chat Messages</Label>
                                    <p className="text-sm text-muted-foreground">Notify me about new messages in chats.</p>
                                </div>
                                <Switch
                                    id="chat-messages"
                                    checked={notifications.chatMessages}
                                    onCheckedChange={(checked) => handleNotificationChange('chatMessages', checked)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Palette className="h-5 w-5 text-primary" />
                            <span>Appearance</span>
                        </h2>
                         <div className="rounded-lg border bg-card p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Theme</p>
                                    <p className="text-sm text-muted-foreground">Choose your favorite accent color.</p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                                {themes.map((t) => (
                                    <button key={t.name} onClick={() => setTheme(t.name)} className={cn('h-8 w-8 rounded-full border-2 transition-all', theme === t.name ? 'border-primary scale-110' : 'border-transparent')}>
                                        <div className="h-full w-full rounded-full" style={{backgroundColor: t.color}}/>
                                        <span className="sr-only">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                     
                    {/* About Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Info className="h-5 w-5 text-primary" />
                            <span>About</span>
                        </h2>
                        <div className="space-y-2">
                           <div className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left">
                                <div>
                                    <p className="font-medium">Version</p>
                                </div>
                                <p className="text-sm text-muted-foreground">1.0.0</p>
                            </div>
                             <button className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">Privacy Policy</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                             <button className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">Terms of Service</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Danger Zone */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            <span>Danger Zone</span>
                        </h2>
                        <div className="rounded-lg border-2 border-destructive/50 bg-card p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Delete Account</p>
                                    <p className="text-sm text-muted-foreground">Permanently delete your account and all data.</p>
                                </div>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">Delete</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete your account, chats, and all other data.
                                                To confirm, please type <strong className="text-foreground">DELETE</strong> below.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <Input 
                                            value={deleteConfirmText}
                                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-muted"
                                        />
                                        <AlertDialogFooter>
                                            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteAccount}
                                                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                {isDeleting ? 'Deleting...' : 'Delete Account'}
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
