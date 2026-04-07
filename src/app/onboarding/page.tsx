'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { availableTabs } from '@/components/aktvia/category-filters';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { uploadProfileImage } from '@/lib/firebase/storage';
import { updateProfile } from 'firebase/auth';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/image-utils';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Camera, ArrowLeft, Loader2, MapPin, Sparkles, X, Check, Search, Calendar, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const forbiddenWords = ['sex', 'porn', 'fuck', 'bitch', 'schlampe', 'fotze', 'hurensohn', 'wichser', 'nazi', 'hitler', 'admin', 'support'];

const profileSchema = z.object({
  displayName: z.string().min(2, "Bitte wähle einen Namen (min. 2 Zeichen).").max(30, "Maximal 30 Zeichen erlaub."),
  birthDate: z.string().min(1, "Bitte gib dein Geburtsdatum an."),
  location: z.string().min(2, "Standort ist erforderlich."),
  radiusKm: z.number().min(1).max(100),
  bio: z.string().max(150, "Die Bio darf maximal 150 Zeichen lang sein.").optional(),
  interests: z.array(z.string()).min(3, "Bitte wähle mindestens 3 Interessen aus."),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const onboardingSteps = [
  { id: 1, title: "Wer bist du?", fields: ['displayName', 'birthDate'] },
  { id: 2, title: "Wo suchst du?", fields: ['location', 'radiusKm'] },
  { id: 3, title: "Über dich", fields: ['bio'] },
  { id: 4, title: "Deine Interessen", fields: ['interests'] },
  { id: 5, title: "Dein Gesicht" },
  { id: 6, title: "So sehen dich andere" }
];

const bioTemplates = [
  "Ich liebe es, neue Orte zu entdecken und gute Gespräche zu führen.",
  "Immer auf der Suche nach dem besten Kaffee der Stadt!",
  "Sport und Natur sind meine größte Leidenschaft. 🏔️",
  "Kulturinteressiert und immer offen für neue Bekanntschaften.",
  "Lass uns gemeinsam die Highlights der Stadt erkunden!"
];

export default function OnboardingPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(user?.photoURL || null);
  const [finalImageFile, setFinalImageFile] = useState<File | null>(null);

  const [allowSuggestions, setAllowSuggestions] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      interests: [],
      bio: '',
      location: '',
      radiusKm: 25,
      birthDate: '',
    },
  });

  const bioValue = form.watch('bio') || '';
  const hasProfanityInBio = forbiddenWords.some(word => bioValue.toLowerCase().includes(word));

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && userProfile?.onboardingCompleted && !isFinishing) {
        router.replace('/');
    }
  }, [user, userProfile, authLoading, isFinishing, router]);

  // Pre-fill displayName if available late
  useEffect(() => {
    if (user?.displayName && !form.getValues('displayName')) {
      form.setValue('displayName', user.displayName);
    }
  }, [user, form]);

  const handleNext = async () => {
    const fieldsToValidate = onboardingSteps.find(s => s.id === step)?.fields as (keyof ProfileFormData)[] | undefined;
    const isValid = await form.trigger(fieldsToValidate);
    
    if (step === 3 && hasProfanityInBio) {
        toast({ variant: 'destructive', title: 'Unzulässige Sprache', description: 'Deine Bio enthält Begriffe, die nicht erlaubt sind.' });
        return;
    }

    if (step === 4 && form.watch('interests').length < 3) return;

    if (isValid) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => setStep(prev => prev - 1);
  
  const handleSkip = () => {
    if (step === 3) form.setValue('bio', '');
    setStep(prev => prev + 1);
  };

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
       const reader = new FileReader();
       reader.addEventListener('load', () => {
           setImageToCrop(reader.result as string);
           setIsCropModalOpen(true);
       });
       reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCroppedImage = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;

    try {
        const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
        const croppedFile = new File([croppedImageBlob], 'profile.jpg', { type: 'image/jpeg' });
        
        setFinalImageFile(croppedFile);
        setPreviewImage(URL.createObjectURL(croppedImageBlob));
        setIsCropModalOpen(false);
        setImageToCrop(null);
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Verarbeitung fehlgeschlagen', description: 'Bild konnte nicht zugeschnitten werden.' });
    }
  };

  const removeImage = () => {
    setFinalImageFile(null);
    setPreviewImage(null);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (step !== 6) return;
    if (!user) return;
    
    setIsSubmitting(true);
    setIsFinishing(true); 
    
    try {
      if (data.displayName !== user.displayName) {
        await updateProfile(user, { displayName: data.displayName });
      }

      if (finalImageFile) {
        await uploadProfileImage(user.uid, finalImageFile);
      }
      
      const likedTags = availableTabs
        .filter(tab => data.interests.includes(tab.label))
        .flatMap(tab => tab.query);

      const birth = new Date(data.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

      await updateUserProfile(user.uid, {
        displayName: data.displayName,
        age,
        location: data.location,
        bio: data.bio,
        interests: data.interests,
        likedTags,
        dislikedTags: [],
        proximitySettings: {
          enabled: true,
          radiusKm: data.radiusKm
        },
        onboardingCompleted: true,
      });

      toast({ title: "Profil bereit!", description: `Willkommen bei Aktvia, ${data.displayName}!` });
      router.push('/');
    } catch (error: any) {
      console.error("[SUBMIT-ERROR]", error);
      toast({ variant: 'destructive', title: 'Fehler', description: error.message || "Profil-Update fehlgeschlagen." });
      setIsSubmitting(false);
      setIsFinishing(false); 
    }
  };

  if (authLoading || !user || isFinishing) {
    return <div className="flex h-screen w-full items-center justify-center bg-neutral-950"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="flex min-h-dvh w-full flex-col bg-neutral-950 text-neutral-200">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-neutral-900/80 backdrop-blur-2xl border-neutral-800/60 shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-gradient-to-b from-primary/5 to-transparent pb-6 border-b border-neutral-800/40 relative">
            <div className="space-y-3 mb-2">
              <Progress value={(Math.min(step, 6) / onboardingSteps.length) * 100} className="h-1.5 bg-neutral-800/50" />
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 text-center">
                Schritt {Math.min(step, 6)} von {onboardingSteps.length}
              </p>
            </div>
            <CardTitle className="text-center text-3xl font-black tracking-tight text-white">
                {onboardingSteps[Math.min(step, 6) - 1]?.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 px-6 min-h-[380px] flex flex-col justify-center">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  variants={slideVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="w-full"
                >
                  {/* SCHRITT 1: NAME & ALTER */}
                  {step === 1 && (
                    <div className="space-y-6">
                      <CardDescription className="text-center font-bold text-neutral-400 mb-6">Wie sollen wir dich nennen?</CardDescription>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500 pl-1 flex items-center"><UserRound className="w-3 h-3 mr-1"/> Anzeigename</label>
                        <Input 
                            {...form.register('displayName')} 
                            placeholder="Dein Vorname oder Nickname" 
                            className="h-14 rounded-2xl bg-neutral-800/50 border-neutral-700/50 font-bold text-lg text-white" 
                        />
                        {form.formState.errors.displayName && <p className="text-red-500 text-[10px] font-bold uppercase">{form.formState.errors.displayName.message}</p>}
                      </div>
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500 pl-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> Geburtsdatum</label>
                        <input 
                          type="date" 
                          {...form.register('birthDate')}
                          className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-2xl px-4 h-14 text-lg text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                          style={{ colorScheme: 'dark' }}
                        />
                        {form.formState.errors.birthDate && <p className="text-red-500 text-[10px] font-bold uppercase">{form.formState.errors.birthDate.message}</p>}
                      </div>
                    </div>
                  )}

                  {/* SCHRITT 2: STANDORT & RADIUS */}
                  {step === 2 && (
                    <div className="space-y-6">
                      <CardDescription className="text-center font-bold text-neutral-400 mb-6">Wo suchst du nach Abenteuern?</CardDescription>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500 pl-1 flex items-center"><MapPin className="w-3 h-3 mr-1"/> Meine Stadt</label>
                        <div className="flex gap-2">
                            <Input 
                                {...form.register('location')} 
                                placeholder="z.B. Berlin, München..." 
                                className="h-14 rounded-2xl bg-neutral-800/50 border-neutral-700/50 font-bold text-lg text-white flex-1" 
                            />
                            <button 
                                type="button" 
                                onClick={detectLocation} 
                                disabled={isLocating}
                                className="h-14 w-14 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary shrink-0 flex items-center justify-center transition-colors disabled:opacity-50"
                            >
                                {isLocating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Search className="h-6 w-6" />}
                            </button>
                        </div>
                        {form.formState.errors.location && <p className="text-red-500 text-[10px] font-bold uppercase">{form.formState.errors.location.message}</p>}
                      </div>
                      
                      <div className="space-y-5 pt-6">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black uppercase tracking-wider text-neutral-500 pl-1">Aktionsradius</label>
                            <span className="text-sm font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">~ {form.watch('radiusKm')} km</span>
                        </div>
                        <Controller
                            control={form.control}
                            name="radiusKm"
                            render={({ field }) => (
                                <Slider
                                    min={5} max={100} step={5}
                                    value={[field.value]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                    className="py-2"
                                />
                            )}
                        />
                        <p className="text-[10px] uppercase text-neutral-600 font-bold text-center">Wir zeigen dir nur Aktivitäten in diesem Umkreis.</p>
                      </div>
                    </div>
                  )}

                  {/* SCHRITT 3: BIO */}
                  {step === 3 && (
                    <div className="space-y-5">
                      <CardDescription className="text-center font-bold text-neutral-400 mb-4">Ein kurzer Satz bricht sofort das Eis.</CardDescription>
                      <div className="relative">
                        <Textarea 
                            {...form.register('bio')} 
                            placeholder="Was macht dich aus?" 
                            maxLength={150} 
                            className={cn(
                                "min-h-[140px] rounded-[1.5rem] bg-neutral-800/50 border-neutral-700/50 font-bold text-lg text-white focus:ring-2 focus:ring-primary resize-none p-5",
                                hasProfanityInBio && "ring-2 ring-red-500"
                            )}
                        />
                        <div className="absolute bottom-4 right-5 text-[11px] font-black text-neutral-500">
                            {bioValue.length}/150
                        </div>
                      </div>
                      {hasProfanityInBio && <p className="text-red-500 text-[10px] font-bold uppercase">Unzulässige Begriffe erkannt.</p>}
                      
                      <div className="grid grid-cols-2 gap-3 pt-2">
                          <Button type="button" variant="outline" onClick={handleSkip} className="h-12 rounded-xl border-dashed border-neutral-700 hover:bg-neutral-800 text-neutral-400 font-bold">
                            Überspringen
                          </Button>
                          <Button type="button" variant="secondary" onClick={generateBio} className="h-12 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold">
                            <Sparkles className="mr-2 h-4 w-4" /> Inspirier mich
                          </Button>
                      </div>
                    </div>
                  )}

                  {/* SCHRITT 4: INTERESSEN */}
                  {step === 4 && (
                    <div className="space-y-6">
                       <CardDescription className="text-center font-bold text-neutral-400">Wähle mindestens 3 Kategorien, um deinen Feed zu personalisieren.</CardDescription>
                        <Controller
                            control={form.control}
                            name="interests"
                            render={({ field }) => (
                                <div className="max-h-[280px] overflow-y-auto flex flex-wrap gap-2.5 justify-center scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-2 px-1">
                                    {availableTabs.map((interest) => {
                                        const isSelected = field.value.includes(interest.label);
                                        return (
                                            <button
                                                key={interest.id}
                                                type="button"
                                                onClick={() => {
                                                    const newValue = isSelected
                                                        ? field.value.filter((i: string) => i !== interest.label)
                                                        : [...field.value, interest.label];
                                                    field.onChange(newValue);
                                                }}
                                                className={cn(
                                                    "flex items-center space-x-2 px-5 py-3 rounded-full border-2 transition-all select-none group",
                                                    isSelected 
                                                        ? "bg-primary border-primary text-neutral-950 shadow-lg shadow-primary/20 scale-[1.02]" 
                                                        : "bg-neutral-800/80 border-transparent hover:border-neutral-700 hover:bg-neutral-800 text-neutral-300"
                                                )}
                                            >
                                                <interest.icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", isSelected ? "text-neutral-950" : "text-neutral-400")} />
                                                <span className="text-sm font-black tracking-tight">{interest.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        />
                       <div className="text-center space-y-4">
                            <p className={cn(
                                "text-[11px] font-black uppercase tracking-widest transition-colors",
                                form.watch('interests').length < 3 ? "text-neutral-600" : "text-emerald-500"
                            )}>
                                {form.watch('interests').length} ausgewählt {form.watch('interests').length >= 3 && "✨"}
                            </p>
                       </div>
                    </div>
                  )}

                  {/* SCHRITT 5: BILD */}
                  {step === 5 && (
                    <div className="space-y-8 flex flex-col items-center">
                      <CardDescription className="text-center font-bold text-neutral-400 w-3/4">Gesichter schaffen Vertrauen. Zeig dich von deiner besten Seite!</CardDescription>
                       <div className="relative group mt-4">
                            <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-neutral-800 bg-neutral-900 shadow-2xl relative">
                                {previewImage ? (
                                    <img src={previewImage} alt="Vorschau" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-800/50">
                                        <UserRound className="w-12 h-12 text-neutral-600 mb-2"/>
                                    </div>
                                )}
                            </div>
                            
                            {previewImage ? (
                                <button 
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors"
                                >
                                    <X size={16} strokeWidth={3} />
                                </button>
                            ) : (
                                <label htmlFor="profile-picture" className="absolute bottom-2 -right-2 bg-primary text-neutral-950 rounded-full p-3.5 cursor-pointer hover:scale-110 transition-transform shadow-xl">
                                    <Camera className="w-6 h-6"/>
                                    <input id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange}/>
                                </label>
                            )}
                       </div>
                       
                       {!previewImage ? (
                           <div className="w-full text-center">
                               <Button type="button" variant="ghost" onClick={handleSkip} className="h-10 rounded-xl text-neutral-500 font-bold hover:bg-transparent hover:text-neutral-300">
                                  Lieber anonym bleiben (Überspringen)
                               </Button>
                           </div>
                       ) : (
                           <div className="w-full text-center h-10"><span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Sieht gut aus!</span></div>
                       )}
                    </div>
                  )}

                  {/* SCHRITT 6: PREVIEW */}
                  {step === 6 && (
                    <div className="space-y-6 flex flex-col items-center w-full">
                       <CardDescription className="text-center font-bold text-neutral-400">So werden andere dein Profil in der App sehen.</CardDescription>
                       
                       <div className="w-full max-w-sm rounded-[2rem] bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/50 p-6 shadow-xl relative overflow-hidden">
                           {/* BG Blur Blob */}
                           <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
                           
                           <div className="flex gap-5 items-center relative z-10">
                               <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 shadow-lg shrink-0 bg-neutral-800">
                                    {previewImage ? (
                                        <img src={previewImage} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-3xl font-black text-neutral-600">
                                            {form.watch('displayName').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                               </div>
                               <div>
                                   <h3 className="text-2xl font-black text-white truncate max-w-[180px]">{form.watch('displayName')}</h3>
                                   <div className="flex gap-2 items-center text-neutral-400 text-sm font-bold mt-1">
                                       <span>{form.watch('location') || 'Aus deiner Nähe'}</span>
                                       <span>•</span>
                                       <span>{new Date().getFullYear() - new Date(form.watch('birthDate') || Date.now()).getFullYear()} J.</span>
                                   </div>
                               </div>
                           </div>
                           
                           {form.watch('bio') && (
                               <div className="mt-5 bg-black/20 p-4 rounded-2xl relative z-10 border border-white/5">
                                   <p className="text-sm font-medium italic text-neutral-300">"{form.watch('bio')}"</p>
                               </div>
                           )}

                           <div className="flex flex-wrap gap-1.5 mt-5 relative z-10">
                                {form.watch('interests').slice(0, 4).map((tag, i) => (
                                    <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] uppercase font-black px-2 py-0.5 rounded-md">
                                        {tag}
                                    </Badge>
                                ))}
                           </div>
                       </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex gap-3 pt-4 border-t border-neutral-800/50">
                {step > 1 && (
                  <Button type="button" variant="ghost" onClick={handleBack} className="w-14 shrink-0 h-14 rounded-2xl font-black text-neutral-500 hover:text-neutral-200 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                {step < onboardingSteps.length ? (
                  <Button 
                    type="button" 
                    onClick={handleNext} 
                    disabled={step === 4 && form.watch('interests').length < 3}
                    className="flex-1 h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-neutral-950"
                  >
                    Weiter
                  </Button>
                ) : step === 6 ? (
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="flex-1 h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-neutral-950 tracking-wide"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    Ab in die App!
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Modal für Bildzuschnitt */}
      <Dialog open={isCropModalOpen} onOpenChange={(open) => !open && setIsCropModalOpen(false)}>
          <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800 text-neutral-200 rounded-[2rem] p-6 overflow-hidden shadow-2xl">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Bildausschnitt wählen</DialogTitle>
                  <DialogDescription className="font-medium text-neutral-400">Passe dein Bild perfekt an den Kreis an.</DialogDescription>
              </DialogHeader>
              
              <div className="relative h-72 w-full bg-black rounded-3xl overflow-hidden mt-4 ring-1 ring-white/10">
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

              <DialogFooter className="mt-8 flex gap-3">
                  <Button 
                      variant="outline" 
                      className="rounded-2xl font-bold border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white h-12 px-6" 
                      onClick={() => { setIsCropModalOpen(false); setImageToCrop(null); }}
                  >
                      Abbrechen
                  </Button>
                  <Button 
                      onClick={handleSaveCroppedImage} 
                      className="bg-primary text-neutral-950 hover:bg-primary/90 rounded-2xl font-black flex-1 h-12 text-md shadow-lg shadow-primary/20"
                  >
                      <Check className="w-5 h-5 mr-2" /> Zuschneiden
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
