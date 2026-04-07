
'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getUserProfile } from '@/lib/firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { uploadProfileImage } from '@/lib/firebase/storage';
import type { UserProfile } from '@/lib/types';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/image-utils';
import { UserPreferenceSlider } from '@/components/profile/user-preference-slider';
import { availableTabs } from '@/components/aktvia/category-filters-data';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, UserCircle, MapPin, Sparkles, Camera, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type FormData = Omit<UserProfile, 'uid' | 'email' | 'onboardingCompleted' | 'photoURL'>;

export default function EditProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [formData, setFormData] = useState<Partial<FormData>>({
    displayName: '',
    age: undefined,
    location: '',
    bio: '',
    pronouns: '',
    gender: '',
    socialBattery: '',
    interests: [],
    categoryAffinities: {}
  });

  // Cropper State
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      router.replace('/login');
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setProfilePhoto(profile.photoURL || null);
        setFormData({
          displayName: profile.displayName || '',
          age: profile.age,
          location: profile.location || '',
          bio: profile.bio || '',
          pronouns: profile.pronouns || '',
          gender: profile.gender || '',
          socialBattery: profile.socialBattery || '',
          interests: profile.interests || [],
          categoryAffinities: profile.categoryAffinities || {}
        });
      }
      setIsLoading(false);
    };

    fetchUserData();
  }, [user, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) {
        toast({ variant: 'destructive', title: 'Datei zu groß', description: 'Bitte wähle ein Bild unter 5MB.' });
        return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string);
        setIsCropModalOpen(true);
    });
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCroppedImage = async () => {
    if (!imageToCrop || !croppedAreaPixels || !user?.uid) return;

    setIsUploading(true);
    try {
        const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
        const croppedFile = new File([croppedImageBlob], 'profile.jpg', { type: 'image/jpeg' });
        
        const photoURL = await uploadProfileImage(user.uid, croppedFile);
        setProfilePhoto(photoURL);
        
        setIsCropModalOpen(false);
        setImageToCrop(null);
        toast({ title: "Profilbild aktualisiert!" });
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: error.message });
    } finally {
        setIsUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: keyof FormData, value: string) => {
    setFormData({ ...formData, [name]: value === 'not-specified' ? '' : value });
  };
  
  const handleAffinityChange = (tagId: string, newValue: number) => {
    setFormData(prev => ({
      ...prev,
      categoryAffinities: {
        ...(prev.categoryAffinities || {}),
        [tagId]: newValue
      }
    }));
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
          socialBattery: formData.socialBattery,
          categoryAffinities: formData.categoryAffinities
        };
        
        await setDoc(doc(db!, "users", user.uid), updateData, { merge: true });
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
          
          {/* Avatar Edit Section */}
          <div className="flex flex-col items-center mb-8">
            <div 
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="p-1 bg-white rounded-full shadow-lg">
                    <Avatar className="h-32 w-32 border-4 border-white">
                        <AvatarImage src={profilePhoto || undefined} />
                        <AvatarFallback className="bg-secondary text-primary font-black text-2xl">
                            {formData.displayName?.charAt(0) || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </div>
                <div className="absolute bottom-1 right-1 h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-white transform group-hover:scale-110 transition-transform">
                    <Camera className="h-5 w-5" />
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/jpeg,image/png,image/webp" 
                />
            </div>
            <p className="mt-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Profilbild ändern</p>
          </div>

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
                <Label htmlFor="displayName" className="font-semibold text-slate-700 ml-1">Anzeigename</Label>
                <Input 
                    id="displayName" 
                    name="displayName" 
                    value={formData.displayName || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold text-lg px-6 focus-visible:ring-primary/50"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="age" className="font-semibold text-slate-700 ml-1">Alter</Label>
                  <Input 
                    id="age" 
                    name="age" 
                    type="number" 
                    value={formData.age || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold text-lg px-6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pronouns" className="font-semibold text-slate-700 ml-1">Pronomen</Label>
                  <Input 
                    id="pronouns" 
                    name="pronouns" 
                    placeholder="z.B. sie/ihr" 
                    value={formData.pronouns || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold text-lg px-6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <Label htmlFor="location" className="font-semibold text-slate-700">Standort</Label>
                </div>
                <Input 
                    id="location" 
                    name="location" 
                    value={formData.location || ''} 
                    onChange={handleChange} 
                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold text-lg px-6"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="gender" className="font-semibold text-slate-700 ml-1">Geschlecht</Label>
                    <Select name="gender" value={formData.gender || ''} onValueChange={(value) => handleSelectChange('gender', value)}>
                        <SelectTrigger id="gender" className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold px-6">
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
                    <Label htmlFor="socialBattery" className="font-semibold text-slate-700 ml-1">Social Battery</Label>
                    <Select name="socialBattery" value={formData.socialBattery || ''} onValueChange={(value) => handleSelectChange('socialBattery', value)}>
                        <SelectTrigger id="socialBattery" className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold px-6">
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
                    <Label htmlFor="bio" className="font-semibold text-slate-700">Über mich</Label>
                </div>
                <Textarea 
                    id="bio" 
                    name="bio" 
                    value={formData.bio || ''} 
                    onChange={handleChange} 
                    rows={4} 
                    maxLength={150} 
                    placeholder="Erzähl uns etwas über dich..." 
                    className="rounded-2xl bg-slate-50 border-slate-100 font-bold text-lg px-6 py-4 resize-none"
                />
                <p className="text-[10px] text-neutral-400 text-right font-black">{(formData.bio || '').length}/150</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Categories & Interests Section */}
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden mt-6">
            <CardHeader className="bg-emerald-500/5 pb-8">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-6 w-6 text-emerald-500" />
                <CardTitle className="text-2xl font-black">Interessen-Gewichtung</CardTitle>
              </div>
              <CardDescription className="text-base font-medium">
                Bestimme hier, wie sehr dir bestimmte Kategorien gefallen. Dies beeinflusst direkt deinen Feed-Algorithmus.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableTabs.map((tab) => (
                <UserPreferenceSlider
                  key={tab.id}
                  label={tab.label}
                  tagKey={tab.id}
                  initialValue={formData.categoryAffinities?.[tab.id]}
                  onChange={handleAffinityChange}
                />
              ))}
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

      {/* Modal für Bildzuschnitt */}
      <Dialog open={isCropModalOpen} onOpenChange={(open) => !open && !isUploading && setIsCropModalOpen(false)}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 overflow-hidden">
              <DialogHeader>
                  <DialogTitle className="text-xl font-black">Bild zuschneiden</DialogTitle>
                  <DialogDescription className="font-medium">Wähle den perfekten Ausschnitt.</DialogDescription>
              </DialogHeader>
              
              <div className="relative h-64 w-full bg-slate-900 rounded-2xl overflow-hidden mt-4">
                  {imageToCrop && (
                      <Cropper
                          image={imageToCrop}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          cropShape="round"
                          showGrid={false}
                          onCropChange={setCrop}
                          onCropComplete={onCropComplete}
                          onZoomChange={setZoom}
                      />
                  )}
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                  <Button 
                      variant="ghost" 
                      className="rounded-xl font-bold" 
                      onClick={() => { setIsCropModalOpen(false); setImageToCrop(null); }}
                      disabled={isUploading}
                  >
                      Abbrechen
                  </Button>
                  <Button 
                      onClick={handleSaveCroppedImage} 
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black flex-1 shadow-lg shadow-emerald-100"
                      disabled={isUploading}
                  >
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Bild speichern
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
