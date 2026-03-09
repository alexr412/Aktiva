'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { availableTabs } from '@/components/aktvia/category-filters';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { uploadProfileImage } from '@/lib/firebase/storage';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, ArrowLeft, Loader2, MapPin, Sparkles, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const forbiddenWords = ['sex', 'porn', 'fuck', 'bitch', 'schlampe', 'fotze', 'hurensohn', 'wichser', 'nazi', 'hitler', 'admin', 'support'];

const profileSchema = z.object({
  birthDate: z.string().min(1, "Bitte gib dein Geburtsdatum an."),
  location: z.string().min(2, "Standort ist erforderlich."),
  bio: z.string().max(150, "Die Bio darf maximal 150 Zeichen lang sein.").optional(),
  interests: z.array(z.string()).min(3, "Bitte wähle mindestens 3 Interessen aus."),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const onboardingSteps = [
  { id: 1, title: "Über dich", fields: ['birthDate', 'location'] },
  { id: 2, title: "Deine Bio", fields: ['bio'] },
  { id: 3, title: "Deine Interessen", fields: ['interests'] },
  { id: 4, title: "Profilbild" },
];

const bioTemplates = [
  "Ich liebe es, neue Orte zu entdecken und Museen zu besuchen.",
  "Immer auf der Suche nach dem besten Kaffee der Stadt!",
  "Sport und Natur sind meine Leidenschaft.",
  "Kulturinteressiert und immer offen für neue Bekanntschaften.",
  "Lass uns gemeinsam die Highlights der Stadt erkunden!"
];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(user?.photoURL || null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      interests: [],
      bio: '',
      location: '',
      birthDate: '',
    },
  });

  const bioValue = form.watch('bio') || '';
  const hasProfanityInBio = forbiddenWords.some(word => bioValue.toLowerCase().includes(word));

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const handleNext = async () => {
    const fieldsToValidate = onboardingSteps.find(s => s.id === step)?.fields as (keyof ProfileFormData)[] | undefined;
    const isValid = await form.trigger(fieldsToValidate);
    
    if (step === 2 && hasProfanityInBio) {
        toast({ variant: 'destructive', title: 'Unzulässige Sprache', description: 'Deine Bio enthält Begriffe, die nicht erlaubt sind.' });
        return;
    }

    if (isValid) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => setStep(prev => prev - 1);
  
  const detectLocation = () => {
    if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Geolocation wird von deinem Browser nicht unterstützt.' });
        return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb;
            if (city) {
                form.setValue('location', city);
                toast({ title: 'Standort erkannt', description: `Wir haben dich in ${city} lokalisiert.` });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLocating(false);
        }
    }, (err) => {
        toast({ variant: 'destructive', title: 'Standortfehler', description: 'Zugriff verweigert oder Zeitüberschreitung.' });
        setIsLocating(false);
    });
  };

  const generateBio = () => {
    const random = bioTemplates[Math.floor(Math.random() * bioTemplates.length)];
    form.setValue('bio', random);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
       if (file.size > 5242880) {
            toast({ variant: 'destructive', title: 'Datei zu groß', description: 'Bitte wähle ein Bild unter 5MB.' });
            return;
        }
      setProfileImage(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    setPreviewImage(null);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (profileImage) {
        await uploadProfileImage(user.uid, profileImage);
      }
      
      const likedTags = availableTabs
        .filter(tab => data.interests.includes(tab.label))
        .flatMap(tab => tab.query);

      // Alter berechnen aus Geburtsdatum
      const birth = new Date(data.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
      }

      await updateUserProfile(user.uid, {
        age,
        location: data.location,
        bio: data.bio,
        interests: data.interests,
        likedTags,
        dislikedTags: [],
        onboardingCompleted: true,
      });

      toast({ title: "Profil bereit!", description: "Willkommen bei Aktvia." });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Fehler', description: error.message || "Profil-Update fehlgeschlagen." });
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center bg-neutral-950"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-neutral-950 text-neutral-200">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-neutral-900 border-neutral-800 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8 border-b border-neutral-800">
            <div className="space-y-3 mb-4">
              <Progress value={(step / onboardingSteps.length) * 100} className="h-1.5 bg-neutral-800" />
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 text-center">
                Schritt {step} von {onboardingSteps.length}
              </p>
            </div>
            <CardTitle className="text-center text-2xl font-black tracking-tight">{onboardingSteps[step - 1].title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-8 px-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {step === 1 && (
                <div className="space-y-5">
                  <CardDescription className="text-center font-medium">Erzähl uns ein wenig über dich.</CardDescription>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">Geburtsdatum</label>
                    <Input 
                        {...form.register('birthDate')} 
                        type="date" 
                        className="h-12 rounded-xl bg-neutral-800 border-none font-bold text-neutral-200 focus:ring-2 focus:ring-primary" 
                    />
                    {form.formState.errors.birthDate && <p className="text-red-500 text-[10px] font-bold uppercase">{form.formState.errors.birthDate.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">Wohnort</label>
                    <div className="flex gap-2">
                        <Input 
                            {...form.register('location')} 
                            placeholder="z.B. Berlin" 
                            className="h-12 rounded-xl bg-neutral-800 border-none font-bold text-neutral-200 flex-1" 
                        />
                        <Button 
                            type="button" 
                            size="icon" 
                            onClick={detectLocation} 
                            disabled={isLocating}
                            className="h-12 w-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-primary shrink-0"
                        >
                            {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
                        </Button>
                    </div>
                    {form.formState.errors.location && <p className="text-red-500 text-[10px] font-bold uppercase">{form.formState.errors.location.message}</p>}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <CardDescription className="text-center font-medium">Eine kurze Bio hilft anderen, dich kennenzulernen.</CardDescription>
                  <div className="relative">
                    <Textarea 
                        {...form.register('bio')} 
                        placeholder="Schreib etwas über dich..." 
                        maxLength={150} 
                        className={cn(
                            "min-h-[120px] rounded-2xl bg-neutral-800 border-none font-bold text-neutral-200 focus:ring-2 focus:ring-primary",
                            hasProfanityInBio && "ring-2 ring-red-500"
                        )}
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] font-bold text-neutral-500">
                        {bioValue.length}/150
                    </div>
                  </div>
                  {hasProfanityInBio && <p className="text-red-500 text-[10px] font-bold uppercase">Unzulässige Begriffe erkannt.</p>}
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={generateBio} 
                    className="w-full h-12 rounded-xl border-dashed border-neutral-700 hover:bg-neutral-800 font-bold gap-2"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    Bio-Vorschlag generieren
                  </Button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                   <CardDescription className="text-center font-medium">Was unternimmst du gerne?</CardDescription>
                    <Controller
                        control={form.control}
                        name="interests"
                        render={({ field }) => (
                            <div className="flex flex-wrap gap-2 justify-center max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {availableTabs.map((interest) => (
                                    <Badge
                                        key={interest.id}
                                        variant={field.value.includes(interest.label) ? 'default' : 'secondary'}
                                        onClick={() => {
                                            const newValue = field.value.includes(interest.label)
                                                ? field.value.filter((i) => i !== interest.label)
                                                : [...field.value, interest.label];
                                            field.onChange(newValue);
                                        }}
                                        className={cn(
                                            "cursor-pointer text-xs py-2 px-4 rounded-full font-bold transition-all border-none select-none",
                                            field.value.includes(interest.label) 
                                                ? "bg-primary text-white scale-105 shadow-lg shadow-primary/20" 
                                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                        )}
                                    >
                                        <interest.icon className="w-3.5 h-3.5 mr-2" />
                                        {interest.label}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    />
                   <div className="text-center">
                        <p className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            form.watch('interests').length < 3 ? "text-neutral-500" : "text-primary"
                        )}>
                            {form.watch('interests').length} / 3 ausgewählt
                        </p>
                   </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6 flex flex-col items-center">
                  <CardDescription className="text-center font-medium">Lade ein Bild hoch, damit man dich erkennt.</CardDescription>
                   <div className="relative group">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-neutral-800 bg-neutral-800 shadow-xl">
                            {previewImage ? (
                                <img src={previewImage} alt="Vorschau" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-black text-neutral-600 bg-neutral-800">
                                    {user.displayName?.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        
                        {previewImage ? (
                            <button 
                                type="button"
                                onClick={removeImage}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-colors"
                            >
                                <X size={14} strokeWidth={3} />
                            </button>
                        ) : (
                            <label htmlFor="profile-picture" className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2.5 cursor-pointer hover:scale-110 transition-transform shadow-xl">
                                <Camera className="w-5 h-5"/>
                                <Input id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange}/>
                            </label>
                        )}
                   </div>
                   <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight">Maximale Dateigröße: 5MB</p>
                </div>
              )}

              <div className="flex gap-3 pt-6">
                {step > 1 && (
                  <Button type="button" variant="ghost" onClick={handleBack} className="w-full h-14 rounded-2xl font-black text-neutral-500 hover:text-neutral-200">
                    <ArrowLeft className="mr-2 h-5 w-5" /> Zurück
                  </Button>
                )}
                {step < onboardingSteps.length ? (
                  <Button 
                    type="button" 
                    onClick={handleNext} 
                    disabled={step === 3 && form.watch('interests').length < 3}
                    className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20"
                  >
                    Weiter
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20">
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                    Abschließen
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
