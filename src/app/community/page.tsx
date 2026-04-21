'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { findUserByUsername, sendFriendRequest } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, UserPlus, Check, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/use-language';

export default function CommunityPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const language = useLanguage();
    const router = useRouter();
    const { toast } = useToast();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [requestSent, setRequestSent] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setFoundUser(null);
        setRequestSent(false);

        const result = await findUserByUsername(searchQuery);
        
        if (result) {
            setFoundUser(result);
            // Check if a request was already sent
            if (userProfile?.friendRequestsSent?.includes(result.uid)) {
                setRequestSent(true);
            }
        } else {
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Nutzer nicht gefunden' : 'User Not Found',
                description: language === 'de' ? 'Kein Nutzer mit diesem Namen gefunden.' : 'No user found with this name.',
            });
        }
        setIsSearching(false);
    };
    
    const handleAddFriend = async () => {
        if (!user || !foundUser) return;
        setRequestSent(true);
        try {
            await sendFriendRequest(user.uid, foundUser.uid);
            toast({
                title: language === 'de' ? 'Freundschaftsanfrage gesendet!' : 'Friend Request Sent!',
                description: language === 'de' ? `Deine Anfrage wurde an ${foundUser.displayName} gesendet.` : `Your request has been sent to ${foundUser.displayName}.`,
            });
        } catch (error: any) {
            setRequestSent(false);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler' : 'Error',
                description: error.message || (language === 'de' ? 'Konnte keine Freundschaftsanfrage senden.' : 'Could not send friend request.'),
            });
        }
    };

    // Status-Evaluation
    const isSelf = user?.uid === foundUser?.uid;
    const isAlreadyFriend = userProfile?.friends?.includes(foundUser?.uid || '');

    return (
        <div className="flex flex-col h-full">
            <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
                <div className="px-4 flex h-16 items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Community</h1>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                <Card className="w-full max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-6 w-6" />
                            <span>{language === 'de' ? 'Freund hinzufügen' : 'Add a Friend'}</span>
                        </CardTitle>
                        <CardDescription>{language === 'de' ? 'Gib den Username eines Nutzers ein.' : 'Enter a user\'s username.'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                placeholder="@username"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.toLowerCase().replace(/@/g, ''))}
                                className="h-12 text-base font-bold"
                                maxLength={32}
                            />
                            <Button type="submit" size="icon" className="h-12 w-12 flex-shrink-0" disabled={isSearching || !searchQuery}>
                                {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                            </Button>
                        </form>

                        {foundUser && (
                            <div className="mt-6 rounded-lg border bg-secondary/30 p-4 border-border">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar>
                                            <AvatarImage src={foundUser.photoURL || undefined} />
                                            <AvatarFallback>{foundUser.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-bold truncate">{foundUser.displayName}</div>
                                    </div>
                                    
                                    {isSelf ? (
                                        <div className="px-4 py-2 bg-red-500/10 text-red-500 font-bold text-sm rounded-lg flex items-center gap-2">
                                            <span>❤️</span>
                                            <span>{language === 'de' ? 'Du' : 'You'}</span>
                                        </div>
                                    ) : isAlreadyFriend ? (
                                        <div className="px-4 py-2 bg-secondary text-muted-foreground font-bold text-sm rounded-lg flex items-center gap-2">
                                            <Check className="w-4 h-4" />
                                            {language === 'de' ? 'Freunde' : 'Friends'}
                                        </div>
                                    ) : (
                                        <Button onClick={handleAddFriend} disabled={requestSent} className="w-32 flex-shrink-0">
                                            {requestSent ? (
                                                <>
                                                    <Check className="mr-2 h-4 w-4" />
                                                    {language === 'de' ? 'Gesendet' : 'Sent'}
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                    {language === 'de' ? 'Hinzufügen' : 'Add'}
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
