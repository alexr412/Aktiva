'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getUserProfile, updateUserProfile } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';

type FormData = Omit<UserProfile, 'uid' | 'email' | 'onboardingCompleted' | 'photoURL' | 'interests'>;

export default function EditProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [formData, setFormData] = useState<Partial<FormData>>({
    displayName: '',
    age: undefined,
    location: '',
    bio: '',
    pronouns: '',
    gender: '',
    socialBattery: ''
  });

  useEffect(() => {
    if (!user?.uid) {
      router.replace('/login');
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setFormData({
          displayName: profile.displayName || '',
          age: profile.age,
          location: profile.location || '',
          bio: profile.bio || '',
          pronouns: profile.pronouns || '',
          gender: profile.gender || '',
          socialBattery: profile.socialBattery || ''
        });
      }
      setIsLoading(false);
    };

    fetchUserData();
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: keyof FormData, value: string) => {
    setFormData({ ...formData, [name]: value === 'not-specified' ? '' : value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    startSaving(async () => {
      try {
        const updateData: Partial<UserProfile> = {
          ...formData,
          age: formData.age ? parseInt(String(formData.age), 10) : undefined,
        };
        
        await updateUserProfile(user.uid, updateData);
        toast({ title: "Profile updated", description: "Your changes have been saved." });
        router.push('/profile');
        router.refresh(); // To reflect changes immediately on profile page
      } catch (error) {
        console.error("Failed to save profile:", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to save your profile." });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <header className="flex h-16 items-center border-b bg-background px-4 shrink-0">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="text-lg font-semibold">Edit Profile</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your public profile information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" name="displayName" value={formData.displayName || ''} onChange={handleChange} />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" name="age" type="number" value={formData.age || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pronouns">Pronouns</Label>
                  <Input id="pronouns" name="pronouns" placeholder="e.g. she/her" value={formData.pronouns || ''} onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" value={formData.location || ''} onChange={handleChange} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select name="gender" value={formData.gender || ''} onValueChange={(value) => handleSelectChange('gender', value)}>
                        <SelectTrigger id="gender">
                            <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="not-specified">Keine Angabe</SelectItem>
                            <SelectItem value="female">Weiblich</SelectItem>
                            <SelectItem value="male">Männlich</SelectItem>
                            <SelectItem value="non-binary">Nicht-binär</SelectItem>
                            <SelectItem value="other">Anderes</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="socialBattery">Social Battery</Label>
                    <Select name="socialBattery" value={formData.socialBattery || ''} onValueChange={(value) => handleSelectChange('socialBattery', value)}>
                        <SelectTrigger id="socialBattery">
                            <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="not-specified">Keine Angabe</SelectItem>
                            <SelectItem value="introverted">Introvertiert (Kleine Gruppen)</SelectItem>
                            <SelectItem value="extroverted">Extrovertiert (Große Gruppen)</SelectItem>
                            <SelectItem value="ambiverted">Ambivertiert (Flexibel)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" name="bio" value={formData.bio || ''} onChange={handleChange} rows={4} maxLength={150} placeholder="A short description about yourself..." />
              </div>
              
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
