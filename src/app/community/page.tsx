'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { findUserByFriendCode, sendFriendRequest } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, UserPlus, Check, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CommunityPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
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

        const result = await findUserByFriendCode(searchQuery);
        
        if (result && result.uid !== user?.uid) {
            setFoundUser(result);
            // Check if a request was already sent or if they are already friends
            if (userProfile?.friendRequestsSent?.includes(result.uid) || userProfile?.friends?.includes(result.uid)) {
                setRequestSent(true);
            }
        } else if (result && result.uid === user?.uid) {
             toast({
                variant: 'default',
                title: 'That\'s you!',
                description: 'You cannot add yourself as a friend.',
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'User Not Found',
                description: 'No user found with that friend code.',
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
                title: 'Friend Request Sent!',
                description: `Your request has been sent to ${foundUser.displayName}.`,
            });
        } catch (error: any) {
            setRequestSent(false);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Could not send friend request.',
            });
        }
    };

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
                            <span>Add a Friend</span>
                        </CardTitle>
                        <CardDescription>Enter a friend's 8-digit code to send them a request.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                placeholder="A1B2C3D4"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                                className="h-12 text-base tracking-widest font-mono"
                                maxLength={8}
                            />
                            <Button type="submit" size="icon" className="h-12 w-12 flex-shrink-0" disabled={isSearching || !searchQuery}>
                                {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                            </Button>
                        </form>

                        {foundUser && (
                            <div className="mt-6 rounded-lg border bg-secondary p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar>
                                            <AvatarImage src={foundUser.photoURL || undefined} />
                                            <AvatarFallback>{foundUser.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-medium truncate">{foundUser.displayName}</div>
                                    </div>
                                    <Button onClick={handleAddFriend} disabled={requestSent} className="w-32 flex-shrink-0">
                                        {requestSent ? (
                                            <>
                                                <Check className="mr-2 h-4 w-4" />
                                                Sent
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="mr-2 h-4 w-4" />
                                                Add Friend
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                {/* Future: Add Friends List here */}
            </main>
        </div>
    );
}
