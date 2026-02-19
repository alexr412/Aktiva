'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Bell, Palette, Info, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
    const router = useRouter();

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
                             <button className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted">
                                <div>
                                    <p className="font-medium">Change Password</p>
                                    <p className="text-sm text-muted-foreground">Set a new password for your account.</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
                                <Switch id="friend-requests" />
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="activity-invites" className="font-medium">Activity Invites</Label>
                                    <p className="text-sm text-muted-foreground">Notify me when I'm invited to an activity.</p>
                                </div>
                                <Switch id="activity-invites" defaultChecked />
                            </div>
                             <Separator className="my-4"/>
                             <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="chat-messages" className="font-medium">Chat Messages</Label>
                                    <p className="text-sm text-muted-foreground">Notify me about new messages in chats.</p>
                                </div>
                                <Switch id="chat-messages" defaultChecked />
                            </div>
                        </div>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3">
                            <Palette className="h-5 w-5 text-primary" />
                            <span>Appearance</span>
                        </h2>
                         <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                            <div>
                                <p className="font-medium">Theme</p>
                                <p className="text-sm text-muted-foreground">Dark mode is not yet supported.</p>
                            </div>
                            <Button variant="outline" disabled>Toggle Theme</Button>
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

                </div>
            </main>
        </div>
    );
}
