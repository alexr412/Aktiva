'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getUserProfile } from '@/lib/firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, UserCircle, MapPin, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        const updateData = {
          displayName: formData.displayName,
          age: formData.age ? parseInt(String(formData.age), 10) : null,
          location: formData.location,
          bio: formData.bio,
          pronouns: formData.pronouns,
          gender: formData.gender,
          socialBattery: formData.socialBattery
        };
        
        await setDoc(doc(db, "users", user.uid), updateData, { merge: true });
        toast({ title: "Profil aktualisiert", description: "Deine Änderungen wurden gespeichert." });
        router.push('/profile');
      } catch (error: any) {
        console.error("Failed to save profile:", error);
        toast({ variant: 'destructive', title: "Fehler", description: "Profil konnte nicht gespeichert werden." });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-secondary/30 overflow-y-auto">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-white/80 backdrop-blur-md px-4 shrink-0">
        <Button variant="ghost" size="icon" className="mr-2 h-10 w-10 rounded-full" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-black tracking-tight text-[#0f172a]">Profil bearbeiten</h1>
      </header>
      
      <main className="flex-1 p-4 sm:p-8 pb-24">
        <form onSubmit={handleSave} className="max-w-2xl mx-auto space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 pb-8">
              <div className="flex items-center gap-3 mb-2">
                <UserCircle className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-black">Persönliche Infos</CardTitle>
              </div>
              <CardDescription className="text-base font-medium">Aktualisiere deine öffentlichen Profilinformationen.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="displayName" className="font-black text-xs uppercase tracking-wider text-neutral-500 ml-1">Anzeigename</Label>
                <Input 
                    id="displayName" 
                    name="displayName" 
                    value={formData.displayName || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-secondary/50 border-none font-bold text-lg px-6 focus-visible:ring-primary/20"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="age" className="font-black text-xs uppercase tracking-wider text-neutral-500 ml-1">Alter</Label>
                  <Input 
                    id="age" 
                    name="age" 
                    type="number" 
                    value={formData.age || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-secondary/50 border-none font-bold text-lg px-6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pronouns" className="font-black text-xs uppercase tracking-wider text-neutral-500 ml-1">Pronomen</Label>
                  <Input 
                    id="pronouns" 
                    name="pronouns" 
                    placeholder="z.B. sie/ihr" 
                    value={formData.pronouns || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-secondary/50 border-none font-bold text-lg px-6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <Label htmlFor="location" className="font-black text-xs uppercase tracking-wider text-neutral-500">Standort</Label>
                </div>
                <Input 
                    id="location" 
                    name="location" 
                    value={formData.location || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-secondary/50 border-none font-bold text-lg px-6"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="gender" className="font-black text-xs uppercase tracking-wider text-neutral-500 ml-1">Geschlecht</Label>
                    <Select name="gender" value={formData.gender || ''} onValueChange={(value) => handleSelectChange('gender', value)}>
                        <SelectTrigger id="gender" className="h-14 rounded-2xl bg-secondary/50 border-none font-bold px-6">
                            <SelectValue placeholder="Wählen..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl font-bold">
                            <SelectItem value="not-specified">Keine Angabe</SelectItem>
                            <SelectItem value="female">Weiblich</SelectItem>
                            <SelectItem value="male">Männlich</SelectItem>
                            <SelectItem value="non-binary">Nicht-binär</SelectItem>
                            <SelectItem value="other">Anderes</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="socialBattery" className="font-black text-xs uppercase tracking-wider text-neutral-500 ml-1">Social Battery</Label>
                    <Select name="socialBattery" value={formData.socialBattery || ''} onValueChange={(value) => handleSelectChange('socialBattery', value)}>
                        <SelectTrigger id="socialBattery" className="h-14 rounded-2xl bg-secondary/50 border-none font-bold px-6">
                            <SelectValue placeholder="Wählen..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl font-bold">
                             <SelectItem value="not-specified">Keine Angabe</SelectItem>
                            <SelectItem value="introverted">Introvertiert (Kleine Gruppen)</SelectItem>
                            <SelectItem value="extroverted">Extrovertiert (Große Gruppen)</SelectItem>
                            <SelectItem value="ambiverted">Ambivertiert (Flexibel)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <Label htmlFor="bio" className="font-black text-xs uppercase tracking-wider text-neutral-500">Über mich</Label>
                </div>
                <Textarea 
                    id="bio" 
                    name="bio" 
                    value={formData.bio || ''} 
                    onChange={handleChange} 
                    rows={4} 
                    maxLength={150} 
                    placeholder="Erzähl uns etwas über dich..." 
                    className="rounded-2xl bg-secondary/50 border-none font-bold text-lg px-6 py-4 resize-none"
                />
                <p className="text-[10px] text-neutral-400 text-right font-black">{(formData.bio || '').length}/150</p>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            type="submit" 
            className="w-full h-16 text-lg font-black rounded-3xl shadow-xl shadow-primary/20 transition-transform active:scale-95" 
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
            Änderungen speichern
          </Button>
        </form>
      </main>
    </div>
  );
}
