'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { LogOut, User } from 'lucide-react';

export default function ProfilePage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }
    
    if (!user) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center p-6">
                 <div className="bg-primary/10 p-4 rounded-full">
                    <User className="h-10 w-10 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Join the community</h1>
                    <p className="text-muted-foreground mt-1">Sign in to create activities and connect with others.</p>
                </div>

                <div className="flex gap-4 w-full max-w-xs">
                    <Button asChild className="flex-1 h-12 text-base">
                        <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1 h-12 text-base">
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={user.photoURL || ''} />
                    <AvatarFallback className="text-3xl">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-2xl font-bold">{user.displayName || 'Welcome'}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>
            </div>

            <Button onClick={handleSignOut} variant="outline" className="w-full h-12 text-base">
                <LogOut className="mr-2" />
                Sign Out
            </Button>
        </div>
    );
}
