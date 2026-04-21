'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, 
  Compass, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Camera,
  User,
  Loader2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { uploadProfileImage } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  displayName: z.string().min(2, { message: 'Name too short' }).optional(),
  birthDate: z.string().optional(),
  bio: z.string().max(160, { message: 'Bio too long' }).optional(),
  location: z.string().optional(),
  interests: z.array(z.string()).min(1, { message: 'Select at least one interest' }),
  radiusKm: z.number().min(1).max(100),
  photoURL: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const onboardingSteps = [
  { id: 1, title: { de: "Wo suchst du?", en: "Where are you?" }, fields: ['location', 'radiusKm'] },
  { id: 2, title: { de: "Über dich", en: "About you" }, fields: ['bio'] },
  { id: 3, title: { de: "Deine Interessen", en: "Your interests" }, fields: ['interests'] },
  { id: 4, title: { de: "Dein Gesicht", en: "Your photo" } },
  { id: 5, title: { de: "Vorschau", en: "Preview" } }
];

const categories = [
  { id: 'sport', label: { de: "Sport", en: "Sports" }, icon: "⚽" },
  { id: 'culture', label: { de: "Kultur", en: "Culture" }, icon: "🎭" },
  { id: 'food', label: { de: "Essen", en: "Food" }, icon: "🍝" },
  { id: 'nature', label: { de: "Natur", en: "Nature" }, icon: "🌲" },
  { id: 'nightlife', label: { de: "Nightlife", en: "Nightlife" }, icon: "💃" },
  { id: 'gaming', label: { de: "Gaming", en: "Gaming" }, icon: "🎮" },
  { id: 'music', label: { de: "Musik", en: "Music" }, icon: "🎵" },
  { id: 'education', label: { de: "Bildung", en: "Education" }, icon: "📚" },
];

export default function OnboardingPage() {
  const { user, userProfile } = useAuth();
  const language = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: userProfile?.displayName || userProfile?.username || '',
      birthDate: userProfile?.birthday || '',
      bio: '',
      location: userProfile?.location || '',
      interests: [],
      radiusKm: 25,
      photoURL: userProfile?.photoURL || '',
    },
  });

  useEffect(() => {
    if (userProfile) {
      if (userProfile.onboardingCompleted) {
        router.replace('/');
      }
      if (!form.getValues('displayName') && (userProfile.displayName || userProfile.username)) {
          form.setValue('displayName', userProfile.displayName || userProfile.username);
      }
      if (!form.getValues('birthDate') && userProfile.birthday) {
          form.setValue('birthDate', userProfile.birthday);
      }
      if (!form.getValues('photoURL') && userProfile.photoURL) {
          form.setValue('photoURL', userProfile.photoURL);
      }
    }
  }, [userProfile, router, form]);

  const nextStep = async () => {
    const fieldsToValidate = onboardingSteps.find(s => s.id === step)?.fields as (keyof ProfileFormData)[] | undefined;
    if (fieldsToValidate) {
      const isValid = await form.trigger(fieldsToValidate);
      if (!isValid) return;
    }
    if (step < onboardingSteps.length) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingImage(true);
    try {
      const url = await uploadProfileImage(user.uid, file);
      form.setValue('photoURL', url);
      toast({
        title: language === 'de' ? "Bild hochgeladen!" : "Image uploaded!",
        description: language === 'de' ? "Dein Profilbild wurde aktualisiert." : "Your profile picture has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: language === 'de' ? "Fehler" : "Error",
        description: language === 'de' ? "Bild-Upload fehlgeschlagen." : "Image upload failed.",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const birthDateToUse = data.birthDate || userProfile?.birthday || '';
      const nameToUse = data.displayName || userProfile?.displayName || userProfile?.username || 'Aktiva User';
      
      let ageValue = 0;
      if (birthDateToUse) {
          const birth = new Date(birthDateToUse.split('/').reverse().join('-'));
          const today = new Date();
          ageValue = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            ageValue--;
          }
      }

      await updateUserProfile(user.uid, {
        displayName: nameToUse,
        birthday: birthDateToUse,
        age: ageValue > 0 ? ageValue : (userProfile?.age || 0),
        bio: data.bio || '',
        location: data.location || 'Aachen',
        interests: data.interests || [],
        onboardingCompleted: true,
        photoURL: data.photoURL || userProfile?.photoURL || '',
        categoryAffinities: data.interests.reduce((acc, curr) => ({ ...acc, [curr]: 1 }), {}),
        proximitySettings: {
          enabled: true,
          radius: data.radiusKm * 1000,
          notifications: true
        }
      });

      toast({
        title: language === 'de' ? "Willkommen!" : "Welcome!",
        description: language === 'de' ? "Dein Profil ist jetzt bereit." : "Your profile is now ready.",
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: language === 'de' ? "Fehler" : "Error",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDisplayName = form.watch('displayName');
  const nameLength = currentDisplayName?.length || 0;
  const nameFontSizeClass = nameLength > 20 ? "text-base" : nameLength > 15 ? "text-lg" : "text-2xl";

  return (
    <div className="min-h-screen bg-[#FAF7FF] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 overflow-hidden relative border border-slate-100">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-2 flex gap-1 px-1 mt-1">
          {onboardingSteps.map((s) => (
            <div 
              key={s.id} 
              className={cn(
                "h-1 px-1 rounded-full flex-1 transition-all duration-700",
                step >= s.id ? "bg-emerald-500" : "bg-slate-100"
              )} 
            />
          ))}
        </div>

        <div className="p-8 md:p-12 pt-16">
          <header className="mb-10 text-center">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
              {language === 'de' ? onboardingSteps[step-1].title.de : onboardingSteps[step-1].title.en}
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              {language === 'de' ? `Schritt ${step} von ${onboardingSteps.length}` : `Step ${step} of ${onboardingSteps.length}`}
            </p>
          </header>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {step === 1 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] font-black uppercase tracking-widest text-emerald-600">{language === 'de' ? "Stadt / Region" : "City / Region"}</FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                                <Input placeholder={language === 'de' ? "z.B. Aachen" : "e.g. London"} {...field} className="h-16 pl-14 rounded-2xl border-2 border-slate-100 font-black" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="radiusKm"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between items-end mb-2">
                              <FormLabel className="text-[11px] font-black uppercase tracking-widest text-emerald-600">{language === 'de' ? "Suchradius" : "Search Radius"}</FormLabel>
                              <span className="text-lg font-black text-slate-900">{field.value} km</span>
                            </div>
                            <FormControl>
                              <input 
                                type="range" 
                                min="1" 
                                max="100" 
                                step="1"
                                value={field.value}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Bio</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder={language === 'de' ? "Erzähle etwas über dich..." : "Tell us something about yourself..."} 
                                {...field} 
                                className="min-h-[150px] rounded-2xl border-2 border-slate-100 p-5 font-bold resize-none" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                        {categories.map((cat) => (
                           <button
                             key={cat.id}
                             type="button"
                             onClick={() => {
                               const current = form.getValues('interests');
                               const next = current.includes(cat.id) 
                                 ? current.filter(i => i !== cat.id) 
                                 : [...current, cat.id];
                               form.setValue('interests', next, { shouldValidate: true });
                             }}
                             className={cn(
                               "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                               form.watch('interests').includes(cat.id)
                                 ? "bg-emerald-50 border-emerald-500"
                                 : "bg-white border-slate-100 hover:border-slate-200"
                             )}
                           >
                             <span className="text-2xl">{cat.icon}</span>
                             <span className={cn("text-xs font-black uppercase tracking-wider", form.watch('interests').includes(cat.id) ? "text-emerald-700" : "text-slate-400")}>
                               {language === 'de' ? cat.label.de : cat.label.en}
                             </span>
                           </button>
                        ))}
                      </div>
                      <FormMessage />
                    </div>
                  )}

                  {step === 4 && (
                    <div className="flex flex-col items-center gap-8 py-4">
                      <div className="relative group">
                        <div className="w-40 h-40 rounded-full bg-slate-50 border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center">
                          {form.watch('photoURL') ? (
                            <img src={form.getValues('photoURL')} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-20 h-20 text-slate-200" />
                          )}
                          {uploadingImage && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                               <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                            </div>
                          )}
                        </div>
                        <label className="absolute bottom-2 right-2 p-3 rounded-full bg-emerald-500 text-white shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all">
                          <Camera className="w-5 h-5" />
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                        </label>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-500 italic">
                          {language === 'de' ? "Zeig dich der Community!" : "Show yourself to the community!"}
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-8">
                       <div className="flex justify-center">
                        <div className="w-full max-w-sm rounded-[2.5rem] bg-slate-900 border border-slate-800 p-6 shadow-2xl relative overflow-hidden group">
                          {/* Saturated Mesh Effects */}
                          <div className="absolute -top-[20%] -right-[20%] w-40 h-40 bg-emerald-500/20 blur-[50px] group-hover:scale-150 transition-transform duration-1000" />
                          
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="relative">
                               <Avatar className="h-20 w-20 border-4 border-white/10">
                                   <AvatarImage src={form.watch('photoURL')} />
                                   <AvatarFallback className="bg-slate-800 text-white font-black text-2xl">
                                     {form.watch('displayName')?.charAt(0) || 'A'}
                                   </AvatarFallback>
                               </Avatar>
                               <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full border-2 border-slate-900">
                                  <Check className="w-3 h-3 text-white" strokeWidth={4} />
                               </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h3 className={cn("font-black text-white truncate", nameFontSizeClass)}>
                                {form.watch('displayName')}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="bg-emerald-500 text-black font-black text-[9px] h-5">
                                  {language === 'de' ? 'NEUES MITGLIED' : 'NEW MEMBER'}
                                </Badge>
                                <span className="text-slate-400 font-bold text-xs">📍 {form.watch('location')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
                             <p className="text-sm text-slate-300 font-medium leading-relaxed italic line-clamp-3">
                               {form.watch('bio') || (language === 'de' ? "Keine Bio angegeben..." : "No bio provided...")}
                             </p>
                          </div>

                          <div className="flex gap-2 mt-6 relative z-10 overflow-x-auto pb-2 scrollbar-hide">
                            {form.watch('interests').slice(0, 3).map((int) => (
                               <div key={int} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] text-white font-bold uppercase tracking-wider flex-shrink-0">
                                 {categories.find(c => c.id === int)?.icon} {language === 'de' ? categories.find(c => c.id === int)?.label.de : categories.find(c => c.id === int)?.label.en}
                               </div>
                            ))}
                          </div>
                        </div>
                       </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex gap-4 pt-4 border-t border-slate-50">
                {step > 1 && (
                  <Button type="button" variant="ghost" onClick={prevStep} className="h-14 w-14 rounded-2xl text-slate-300">
                    <ArrowLeft className="w-6 h-6" />
                  </Button>
                )}
                {step < onboardingSteps.length ? (
                  <Button type="button" onClick={nextStep} className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black shadow-xl">
                    {language === 'de' ? 'WEITER' : 'CONTINUE'} <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="flex-1 h-14 rounded-2xl bg-emerald-500 text-black font-black shadow-xl shadow-emerald-500/20">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'de' ? 'ABSCHLIESSEN' : 'FINISH')}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
