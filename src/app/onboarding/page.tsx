'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Camera,
  User,
  Loader2,
  LocateFixed,
  Dumbbell,
  TreePine,
  Utensils,
  Music,
  Landmark,
  Zap,
  BookOpen,
  Film,
  Library,
  Flower2,
  Waves,
  Bird,
  Coffee,
  Beer,
  ShoppingBag,
  Binoculars,
  Church,
  Ticket,
  Drumstick,
  IceCream,
  Building,
  Shuffle,
  Sparkles,
  Crown
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { updateUserProfile, isUsernameTaken } from '@/lib/firebase/firestore';
import { validateUsername } from '@/lib/moderation/blacklist';
import { uploadProfileImage } from '@/lib/firebase/storage';
import { validateAvatarFile } from '@/lib/avatar-utils';
import { reverseGeocode } from '@/lib/geoapify';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { serverTimestamp } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  displayName: z.string().min(2, { message: 'Name too short' }).optional(),
  birthDate: z.string().optional(),
  bio: z.string().max(160, { message: 'Bio too long' }).optional(),
  location: z.string().min(1, { message: 'Bitte gib einen Ort ein.' }),
  interests: z.array(z.string()).default([]),
  tinderInterests: z.array(z.string()).default([]),
  affinities: z.record(z.string(), z.number()).default({}),
  photoURL: z.string().nullable().optional(),
  username: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const onboardingSteps = [
  { id: 1, title: { de: "Wo suchst du?", en: "Where are you?" }, fields: ['location'] },
  { id: 2, title: { de: "Über dich", en: "About you" }, fields: ['username', 'bio'] },
  { id: 3, title: { de: "Deine Interessen", en: "Your interests" }, fields: ['interests'] },
  { id: 4, title: { de: "Deine Hobbys", en: "Your Hobbies" }, fields: ['tinderInterests'] },
  { id: 5, title: { de: "Dein Gesicht", en: "Your photo" }, fields: ['photoURL'] }
];

import { DEFAULT_AVATARS } from '@/lib/avatar-options';

const MAX_RANDOM_AVATAR_ROLLS = 5;

const categories = [
  { id: 'Sights', label: { de: "Kultur", en: "Culture" }, icon: Landmark },
  { id: 'Museums', label: { de: "Museen", en: "Museums" }, icon: Library },
  { id: 'theater_cinema', label: { de: "Kino", en: "Cinema" }, icon: Film },
  { id: 'Nature', label: { de: "Natur", en: "Nature" }, icon: TreePine },
  { id: 'Wellness', label: { de: "Wellness", en: "Wellness" }, icon: Flower2 },
  { id: 'Water', label: { de: "Wasser", en: "Water" }, icon: Waves },
  { id: 'Zoos', label: { de: "Zoos", en: "Zoos" }, icon: Bird },
  { id: 'Sport', label: { de: "Sport", en: "Sports" }, icon: Dumbbell },
  { id: 'ActivityParks', label: { de: "Action", en: "Action" }, icon: Zap },
  { id: 'Restaurants', label: { de: "Restaurants", en: "Restaurants" }, icon: Utensils },
  { id: 'Cafes', label: { de: "Cafés", en: "Cafes" }, icon: Coffee },
  { id: 'Nightlife', label: { de: "Bars", en: "Bars" }, icon: Beer },
  { id: 'Clubs', label: { de: "Clubs", en: "Clubs" }, icon: Music },
  { id: 'Education', label: { de: "Wissen", en: "Education" }, icon: BookOpen },
  { id: 'Shopping', label: { de: "Shopping", en: "Shopping" }, icon: ShoppingBag },
  { id: 'Viewpoints', label: { de: "Aussicht", en: "Views" }, icon: Binoculars },
  { id: 'Religion', label: { de: "Religion", en: "Religion" }, icon: Church },
  { id: 'Attractions', label: { de: "Attraktionen", en: "Attractions" }, icon: Ticket },
  { id: 'FastFood', label: { de: "Fast Food", en: "Fast Food" }, icon: Drumstick },
  { id: 'IceCream', label: { de: "Eis", en: "Ice Cream" }, icon: IceCream },
  { id: 'Coworking', label: { de: "Coworking", en: "Coworking" }, icon: Building },
];

const tinderInterestsList = [
  { id: 'sport', label: { de: "Sport & Fitness", en: "Sports & Fitness" } },
  { id: 'running', label: { de: "Laufen", en: "Running" } },
  { id: 'hiking', label: { de: "Wandern", en: "Hiking" } },
  { id: 'gaming', label: { de: "Gaming", en: "Gaming" } },
  { id: 'movies', label: { de: "Filme & Serien", en: "Movies & Shows" } },
  { id: 'music', label: { de: "Musik", en: "Music" } },
  { id: 'concerts', label: { de: "Konzerte", en: "Concerts" } },
  { id: 'festivals', label: { de: "Festivals", en: "Festivals" } },
  { id: 'cooking', label: { de: "Kochen", en: "Cooking" } },
  { id: 'foodie', label: { de: "Foodie", en: "Foodie" } },
  { id: 'coffee', label: { de: "Kaffee", en: "Coffee" } },
  { id: 'beer', label: { de: "Bier", en: "Beer" } },
  { id: 'wine', label: { de: "Wein", en: "Wine" } },
  { id: 'traveling', label: { de: "Reisen", en: "Traveling" } },
  { id: 'photography', label: { de: "Fotografie", en: "Photography" } },
  { id: 'camping', label: { de: "Camping", en: "Camping" } },
  { id: 'reading', label: { de: "Lesen", en: "Reading" } },
  { id: 'art', label: { de: "Kunst & Malen", en: "Art & Painting" } },
  { id: 'animals', label: { de: "Tiere", en: "Animals" } },
  { id: 'nature', label: { de: "Natur", en: "Nature" } },
  { id: 'shopping', label: { de: "Shopping", en: "Shopping" } },
  { id: 'fashion', label: { de: "Mode", en: "Fashion" } },
  { id: 'boardgames', label: { de: "Brettspiele", en: "Board Games" } },
  { id: 'dancing', label: { de: "Tanzen", en: "Dancing" } },
  { id: 'baking', label: { de: "Backen", en: "Baking" } },
  { id: 'wellness', label: { de: "Wellness", en: "Wellness" } },
  { id: 'comedy', label: { de: "Stand-up Comedy", en: "Stand-up Comedy" } }
];

export default function OnboardingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-white" />;
  }

  return <OnboardingContent />;
}

function OnboardingContent() {
  const { user, userProfile } = useAuth();
  const language = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<'available' | 'taken' | 'invalid' | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const needsUsername = !userProfile?.username;

  const [randomAvatarRolls, setRandomAvatarRolls] = useState(0);

  const randomAvatarLimitReached = randomAvatarRolls >= MAX_RANDOM_AVATAR_ROLLS;
  const remainingRandomAvatarRolls = Math.max(
    MAX_RANDOM_AVATAR_ROLLS - randomAvatarRolls,
    0
  );

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: userProfile?.displayName || userProfile?.username || '',
      birthDate: userProfile?.birthday || '',
      bio: userProfile?.bio || '',
      location: userProfile?.location || '',
      interests: [],
      tinderInterests: userProfile?.tinderInterests || [],
      affinities: {},
      photoURL: userProfile?.photoURL || null,
      username: userProfile?.username || '',
    },
  });

  useEffect(() => {
    if (userProfile) {
      if (userProfile.onboardingCompleted) {
        router.replace('/');
      }
      
      const displayNameState = form.getFieldState('displayName');
      if (!displayNameState.isDirty && !form.getValues('displayName') && (userProfile.displayName || userProfile.username)) {
        form.setValue('displayName', userProfile.displayName || userProfile.username);
      }

      const birthDateState = form.getFieldState('birthDate');
      if (!birthDateState.isDirty && !form.getValues('birthDate') && userProfile.birthday) {
        form.setValue('birthDate', userProfile.birthday);
      }

      const photoURLState = form.getFieldState('photoURL');
      if (!photoURLState.isDirty && !form.getValues('photoURL') && userProfile.photoURL) {
        form.setValue('photoURL', userProfile.photoURL);
      }

      const usernameState = form.getFieldState('username');
      if (!usernameState.isDirty && !form.getValues('username') && userProfile.username) {
        form.setValue('username', userProfile.username);
      }

      const locationState = form.getFieldState('location');
      if (!locationState.isDirty && !form.getValues('location') && userProfile.location) {
        form.setValue('location', userProfile.location);
      }

      const bioState = form.getFieldState('bio');
      if (!bioState.isDirty && !form.getValues('bio') && userProfile.bio) {
        form.setValue('bio', userProfile.bio);
      }

      const tinderInterestsState = form.getFieldState('tinderInterests');
      if (!tinderInterestsState.isDirty && form.getValues('tinderInterests').length === 0 && userProfile.tinderInterests?.length) {
        form.setValue('tinderInterests', userProfile.tinderInterests);
      }

      const interestsState = form.getFieldState('interests');
      if (!interestsState.isDirty && form.getValues('interests').length === 0 && userProfile.interests?.length) {
        form.setValue('interests', userProfile.interests);
      }

      const affinitiesState = form.getFieldState('affinities');
      if (!affinitiesState.isDirty && Object.keys(form.getValues('affinities')).length === 0 && userProfile.categoryAffinities) {
        form.setValue('affinities', userProfile.categoryAffinities);
      }
    }
  }, [userProfile, router, form]);

  useEffect(() => {
    const header = document.getElementById('step-header');
    if (header) {
      header.focus();
    }
  }, [step]);

  const usernameValue = form.watch('username') || '';
  const isUsernameValid = validateUsername(usernameValue);


  useEffect(() => {
    if (!needsUsername || step !== 2 || usernameValue.length < 4 || usernameValue.length > 32) {
      if (usernameAvailability !== null) setUsernameAvailability(null);
      return;
    }

    if (!isUsernameValid) {
      setUsernameAvailability('invalid');
      return;
    }

    const checkAvailability = async () => {
      setIsUsernameChecking(true);
      try {
        const isTaken = await isUsernameTaken(usernameValue);
        setUsernameAvailability(isTaken ? 'taken' : 'available');
      } catch (err) {
        console.error(err);
      } finally {
        setIsUsernameChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 600);
    return () => clearTimeout(timeoutId);
  }, [usernameValue, step, isUsernameValid, needsUsername]);

  const nextStep = async () => {
    const fieldsToValidate = onboardingSteps.find(s => s.id === step)?.fields as (keyof ProfileFormData)[] | undefined;
    if (fieldsToValidate) {
      const isValid = await form.trigger(fieldsToValidate);
      if (!isValid) {
        const errors = form.formState.errors;
        const firstErrorKey = Object.keys(errors)[0];
        if (firstErrorKey) {
          const element = document.getElementsByName(firstErrorKey)[0];
          if (element) (element as any).focus();
        }
        return;
      }
    }
    if (step === 2 && needsUsername) {
      if (usernameValue.length < 4 || usernameValue.length > 32) {
        form.setError('username', { 
          message: language === 'de' ? 'Mindestens 4 und maximal 32 Zeichen.' : 'Between 4 and 32 characters.' 
        });
        setTimeout(() => {
          const element = document.getElementsByName('username')[0];
          if (element) (element as any).focus();
        }, 10);
        return;
      }
      if (!/^[a-zA-Z0-9._]+$/.test(usernameValue)) {
        form.setError('username', {
          message: language === 'de' ? 'Nur Buchstaben, Zahlen, Punkte und Unterstriche.' : 'Only letters, numbers, dots and underscores.'
        });
        setTimeout(() => {
          const element = document.getElementsByName('username')[0];
          if (element) (element as any).focus();
        }, 10);
        return;
      }
      if (!isUsernameValid) {
        form.setError('username', {
          message: language === 'de' ? 'Dieser Benutzername ist nicht erlaubt.' : 'This username is not allowed.'
        });
        setTimeout(() => {
          const element = document.getElementsByName('username')[0];
          if (element) (element as any).focus();
        }, 10);
        return;
      }
      if (usernameAvailability === 'taken') {
        form.setError('username', {
          message: language === 'de' ? 'Dieser Username ist bereits vergeben.' : 'This username is already taken.'
        });
        setTimeout(() => {
          const element = document.getElementsByName('username')[0];
          if (element) (element as any).focus();
        }, 10);
        return;
      }
      if (usernameAvailability === 'invalid') {
        form.setError('username', {
          message: language === 'de' ? 'Dieser Benutzername ist ungültig.' : 'This username is invalid.'
        });
        setTimeout(() => {
          const element = document.getElementsByName('username')[0];
          if (element) (element as any).focus();
        }, 10);
        return;
      }
      if (usernameAvailability !== 'available') {
        setIsUsernameChecking(true);
        try {
          const isTaken = await isUsernameTaken(usernameValue);
          if (isTaken) {
            setUsernameAvailability('taken');
            form.setError('username', {
              message: language === 'de' ? 'Dieser Username ist bereits vergeben.' : 'This username is already taken.'
            });
            setTimeout(() => {
              const element = document.getElementsByName('username')[0];
              if (element) (element as any).focus();
            }, 10);
            return;
          } else {
            setUsernameAvailability('available');
          }
        } catch (err) {
          console.error(err);
          return;
        } finally {
          setIsUsernameChecking(false);
        }
      }
    }
    if (step < onboardingSteps.length) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      
      setStep(step - 1);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || uploadingImage || isSubmitting) {
      if (e.target) e.target.value = '';
      return;
    }

    const validation = validateAvatarFile(file, language);
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: language === 'de' ? "Ungültiges Bild" : "Invalid Image",
        description: validation.error,
      });
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadProfileImage(user.uid, file);
      form.setValue('photoURL', url, { shouldDirty: true, shouldValidate: true });
      toast({
        title: language === 'de' ? "Bild hochgeladen!" : "Image uploaded!",
        description: language === 'de' ? "Dein Profilbild wurde aktualisiert." : "Your profile picture has been updated.",
      });
    } catch (error: any) {
      let msg = language === 'de' ? "Bild-Upload fehlgeschlagen." : "Image upload failed.";
      if (error.code === 'storage/unauthorized') {
        msg = language === 'de' 
          ? "Upload verweigert. Das Bild entspricht möglicherweise nicht den Sicherheitsrichtlinien oder ist zu groß (max. 5MB)." 
          : "Upload denied. The image might violate security policies or is too large (max. 5MB).";
      } else if (error.code === 'storage/canceled') {
        msg = language === 'de' ? "Upload abgebrochen." : "Upload cancelled.";
      } else if (error.code === 'storage/quota-exceeded') {
        msg = language === 'de'
          ? "Speicherlimit überschritten. Bitte wähle ein kleineres Bild."
          : "Storage quota exceeded. Please choose a smaller image.";
      }
      toast({
        variant: "destructive",
        title: language === 'de' ? "Fehler" : "Error",
        description: msg,
      });
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleLocate = () => {
    if (isSubmitting || isLocating) return;
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: language === 'de' ? "Fehler" : "Error",
        description: language === 'de' ? "Geolokalisierung wird von deinem Browser nicht unterstützt." : "Geolocation is not supported by your browser.",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await reverseGeocode(latitude, longitude);
          if (result) {
            const cityName = result.address?.split(',')[0] || result.name || "";
            form.setValue('location', cityName, { shouldValidate: true, shouldDirty: true });
            setCoordinates({ lat: latitude, lng: longitude });
            toast({
              title: language === 'de' ? "Standort erkannt" : "Location detected",
              description: language === 'de' ? `Wir haben dich in ${cityName} gefunden.` : `We found you in ${cityName}.`,
            });
          }
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLocating(false);
        toast({
          variant: "destructive",
          title: language === 'de' ? "Standort-Fehler" : "Location Error",
          description: language === 'de' ? "Der Zugriff auf deinen genauen Standort wurde verweigert oder ist fehlgeschlagen." : "Access to your precise location was denied or failed.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleRandomAvatar = () => {
    if (randomAvatarLimitReached || uploadingImage || isSubmitting) return;

    // Production note: For commercial/high-traffic usage, consider self-hosting DiceBear or proxying avatar generation.
    const randomSeed = "Aktiva-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
    const url = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(randomSeed)}`;
    
    form.setValue('photoURL', url, {
      shouldDirty: true,
      shouldValidate: true,
    });

    setRandomAvatarRolls((prev) => Math.min(prev + 1, MAX_RANDOM_AVATAR_ROLLS));
  };


  const onSubmit = async (data: ProfileFormData) => {
    if (!user || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      if (needsUsername) {
        const usernameVal = data.username || '';
        if (usernameVal.length < 4 || usernameVal.length > 32 || !/^[a-zA-Z0-9._]+$/.test(usernameVal) || !validateUsername(usernameVal)) {
          form.setError('username', {
            message: language === 'de' ? 'Bitte gib einen gültigen Benutzernamen ein.' : 'Please choose a valid username.'
          });
          setStep(2);
          setTimeout(() => {
            const el = document.getElementsByName('username')[0];
            if (el) (el as any).focus();
          }, 10);
          setIsSubmitting(false);
          return;
        }
        const isTaken = await isUsernameTaken(usernameVal);
        if (isTaken) {
          form.setError('username', {
            message: language === 'de' ? 'Dieser Username ist bereits vergeben.' : 'This username is already taken.'
          });
          setStep(2);
          setTimeout(() => {
            const el = document.getElementsByName('username')[0];
            if (el) (el as any).focus();
          }, 10);
          setIsSubmitting(false);
          return;
        }
      }

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

      const updateData: any = {
        displayName: nameToUse,
        birthday: birthDateToUse,
        age: ageValue > 0 ? ageValue : (userProfile?.age || 0),
        bio: data.bio || '',
        location: data.location || 'Aachen',
        interests: data.interests || [],
        tinderInterests: data.tinderInterests || [],
        onboardingCompleted: true,
        photoURL: data.photoURL !== undefined ? data.photoURL : (userProfile?.photoURL || null),
        categoryAffinities: data.affinities || {},
        proximitySettings: {
          enabled: true,
          radiusKm: userProfile?.proximitySettings?.radiusKm || 25
        }
      };

      if (needsUsername && data.username) {
        updateData.username = data.username.toLowerCase();
      }

      if (coordinates) {
        updateData.lastLocation = {
          lat: coordinates.lat,
          lng: coordinates.lng,
          city: data.location || null,
          updatedAt: serverTimestamp()
        };
      }

      await updateUserProfile(user.uid, updateData);

      toast({
        title: language === 'de' ? "Willkommen!" : "Welcome!",
        description: language === 'de' ? "Dein Profil ist jetzt bereit." : "Your profile is now ready.",
      });
      router.push('/');
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code) {
        if (error.code === 'permission-denied') {
          errorMessage = language === 'de' 
            ? 'Zugriff verweigert. Bitte überprüfe deine Berechtigungen.' 
            : 'Permission denied. Please verify your access rights.';
        } else if (error.code === 'unavailable') {
          errorMessage = language === 'de' 
            ? 'Der Dienst ist vorübergehend nicht erreichbar. Bitte versuche es später noch einmal.' 
            : 'The service is temporarily unavailable. Please try again later.';
        }
      }
      toast({
        variant: "destructive",
        title: language === 'de' ? "Fehler" : "Error",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSparseStep = step === 1 || step === 2;

  return (
    <div
      data-onboarding-scroll-root
      className="fixed inset-0 z-50 h-dvh w-screen overflow-y-scroll overflow-x-hidden bg-white overscroll-contain antialiased"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:max-w-lg">
        {/* Progressbar */}
        <div 
          role="progressbar" 
          aria-valuenow={step} 
          aria-valuemin={1} 
          aria-valuemax={onboardingSteps.length} 
          aria-valuetext={language === 'de' ? `Schritt ${step} von ${onboardingSteps.length}` : `Step ${step} of ${onboardingSteps.length}`}
          className="w-full h-1 flex gap-1.5 px-6 mt-2 shrink-0 mb-4"
        >
          {onboardingSteps.map((s) => (
            <div
              key={s.id}
              className={cn(
                "h-1 rounded-full flex-1 transition-all duration-700",
                step >= s.id ? "bg-primary" : "bg-slate-100"
              )}
            />
          ))}
        </div>

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.warn("Onboarding form validation errors:", errors);
              if (errors.location) {
                setStep(1);
                setTimeout(() => {
                  const el = document.getElementsByName('location')[0];
                  if (el) (el as any).focus();
                }, 10);
              } else if (errors.username) {
                setStep(2);
                setTimeout(() => {
                  const el = document.getElementsByName('username')[0];
                  if (el) (el as any).focus();
                }, 10);
              } else if (errors.bio) {
                setStep(2);
                setTimeout(() => {
                  const el = document.getElementsByName('bio')[0];
                  if (el) (el as any).focus();
                }, 10);
              } else if (errors.interests) {
                setStep(3);
                setTimeout(() => {
                  const el = document.getElementById('step-header');
                  if (el) el.focus();
                }, 10);
              } else if (errors.tinderInterests) {
                setStep(4);
                setTimeout(() => {
                  const el = document.getElementById('step-header');
                  if (el) el.focus();
                }, 10);
              } else if (errors.photoURL) {
                setStep(5);
                setTimeout(() => {
                  const el = document.getElementById('step-header');
                  if (el) el.focus();
                }, 10);
              }
            })} 
            className="flex-1 flex flex-col w-full px-6 md:px-10"
          >
            <div className={cn(
              "flex flex-col w-full",
              isSparseStep ? "flex-1 justify-center py-4" : "pt-2"
            )}>
              <header className="mb-6 text-center shrink-0">
                <h1 
                  id="step-header" 
                  tabIndex={-1} 
                  className="text-2xl md:text-3xl text-slate-900 font-black outline-none"
                >
                  {language === 'de' ? onboardingSteps[step - 1].title.de : onboardingSteps[step - 1].title.en}
                </h1>
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-2">
                  {language === 'de' ? `SCHRITT ${step} VON ${onboardingSteps.length}` : `STEP ${step} OF ${onboardingSteps.length}`}
                </p>
              </header>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col justify-center"
                >
                  {step === 1 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] font-black uppercase tracking-widest text-primary">{language === 'de' ? "Stadt / Region" : "City / Region"}</FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                                <Input placeholder={language === 'de' ? "z.B. Aachen" : "e.g. London"} {...field} className="h-16 pl-14 pr-14 rounded-full border-none bg-slate-50 font-black focus-visible:ring-0" />
                                <button
                                  type="button"
                                  onClick={handleLocate}
                                  disabled={isLocating || isSubmitting}
                                  aria-label={language === 'de' ? "Standort automatisch ermitteln" : "Detect location automatically"}
                                  title={language === 'de' ? "Standort automatisch ermitteln" : "Detect location automatically"}
                                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors disabled:opacity-50"
                                >
                                  {isLocating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : (
                                    <LocateFixed className="w-5 h-5" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-6">
                      {needsUsername && (
                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[11px] font-black uppercase tracking-widest text-primary">
                                {language === 'de' ? "Dein @name" : "Your @name"}
                              </FormLabel>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-1">
                                {language === 'de'
                                  ? "So können dich Freunde finden."
                                  : "How friends can find you."}
                              </div>
                              <FormControl>
                                <div className="relative group">
                                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black pointer-events-none">@</span>
                                  <Input
                                    placeholder={language === 'de' ? "benutzername" : "username"}
                                    {...field}
                                    onChange={(e) => {
                                      const val = e.target.value.toLowerCase().replace(/\s+/g, '');
                                      field.onChange(val);
                                      if (form.formState.errors.username) {
                                        form.clearErrors('username');
                                      }
                                    }}
                                    className={cn(
                                      "h-16 pl-16 pr-14 rounded-full border-none bg-slate-50 font-black focus-visible:ring-0",
                                      usernameAvailability === 'available' && "focus-visible:ring-2 focus-visible:ring-emerald-500",
                                      usernameAvailability === 'taken' && "focus-visible:ring-2 focus-visible:ring-red-500"
                                    )}
                                  />
                                  <div className="absolute right-5 top-1/2 -translate-y-1/2" aria-live="polite">
                                    {isUsernameChecking && (
                                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                    )}
                                    {!isUsernameChecking && usernameAvailability === 'available' && (
                                      <span className="text-xs font-black uppercase text-emerald-500">{language === 'de' ? 'Frei' : 'Available'}</span>
                                    )}
                                    {!isUsernameChecking && usernameAvailability === 'taken' && (
                                      <span className="text-xs font-black uppercase text-red-500">{language === 'de' ? 'Vergeben' : 'Taken'}</span>
                                    )}
                                    {!isUsernameChecking && usernameAvailability === 'invalid' && (
                                      <span className="text-xs font-black uppercase text-red-500">{language === 'de' ? 'Ungültig' : 'Invalid'}</span>
                                    )}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] font-black uppercase tracking-widest text-primary">Bio</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={language === 'de' ? "Erzähle etwas über dich..." : "Tell us something about yourself..."}
                                {...field}
                                className="min-h-[150px] rounded-[2rem] border-none bg-slate-50 p-6 font-bold resize-none focus-visible:ring-0"
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
                      <div className="text-center pb-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                          {language === 'de'
                            ? "Keine Sorge, diese Einstellungen kannst du jederzeit im Profil anpassen."
                            : "Don't worry, you can adjust these settings at any time in your profile."}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {(() => {
                          const affinities = form.watch('affinities') || {};
                          const discreteValues = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0];
                          const defaultIndex = 4; // Index of 1.0

                          return categories.map((cat) => {
                            const affinityValue = affinities[cat.id] ?? 1.0;
                            const idx = discreteValues.indexOf(affinityValue);
                            const currentIndex = idx !== -1 ? idx : defaultIndex;
                            const Icon = cat.icon;

                            let accentColor = "#9ca3af";
                            let textColor = "text-slate-400";
                            let bgColor = "bg-white";

                            if (affinityValue > 1.0) {
                              accentColor = "hsl(var(--primary))";
                              textColor = "text-primary";
                              bgColor = "bg-primary/5";
                            } else if (affinityValue < 1.0) {
                              accentColor = "#ef4444";
                              textColor = "text-red-500";
                              bgColor = "bg-red-50/50";
                            }

                            return (
                              <div
                                key={cat.id}
                                className={cn(
                                  "relative rounded-[2rem] border-2 transition-all p-3.5 flex flex-col gap-3",
                                  affinityValue > 1.0 ? "border-primary/30" : (affinityValue < 1.0 ? "border-red-200" : "border-slate-200/60 bg-slate-50/50"),
                                  bgColor
                                )}
                              >
                                <div className="flex items-center justify-between min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn(
                                      "p-2 rounded-xl transition-all shadow-sm shrink-0",
                                      affinityValue > 1.0 ? "bg-primary text-primary-foreground" : (affinityValue < 1.0 ? "bg-red-500 text-white" : "bg-white text-slate-400")
                                    )}>
                                      <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex flex-col min-w-0 leading-tight">
                                      <span className={cn("text-[10px] font-black uppercase truncate", textColor)}>
                                        {language === 'de' ? cat.label.de : cat.label.en}
                                      </span>
                                      <span className={cn("text-[8px] font-bold opacity-60", textColor)}>
                                        {affinityValue.toFixed(2)}x
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="px-1 relative group/slider">
                                  <style jsx>{`
                                    .custom-thumb::-webkit-slider-thumb {
                                      appearance: none;
                                      width: 18px;
                                      height: 18px;
                                      background: white;
                                      border: 2px solid var(--thumb-color);
                                      border-radius: 50%;
                                      cursor: pointer;
                                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                                      transition: all 0.2s;
                                    }
                                    .custom-thumb::-webkit-slider-thumb:hover {
                                      transform: scale(1.1);
                                      box-shadow: 0 3px 6px rgba(0,0,0,0.15);
                                    }
                                  `}</style>
                                  <input
                                    type="range"
                                    min="0"
                                    max="8"
                                    step="1"
                                    value={currentIndex}
                                    aria-label={language === 'de' ? `Präferenz für ${cat.label.de}` : `Preference for ${cat.label.en}`}
                                    style={{
                                      "--thumb-color": accentColor,
                                      background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${(currentIndex / 8) * 100}%, #cbd5e1 ${(currentIndex / 8) * 100}%, #cbd5e1 100%)`
                                    } as any}
                                    onChange={(e) => {
                                      const idx = parseInt(e.target.value, 10);
                                      const val = discreteValues[idx];
                                      form.setValue(`affinities.${cat.id}`, val, { shouldDirty: true });

                                      const currentInterests = form.getValues('interests') || [];
                                      if (val > 0.1 && !currentInterests.includes(cat.id)) {
                                        form.setValue('interests', [...currentInterests, cat.id], { shouldDirty: true });
                                      } else if (val <= 0.1) {
                                        form.setValue('interests', currentInterests.filter(i => i !== cat.id), { shouldDirty: true });
                                      }
                                    }}
                                    className={cn("w-full h-2.5 rounded-full appearance-none cursor-pointer transition-all shadow-inner custom-thumb")}
                                  />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                               {form.formState.errors.interests && (
                        <p className="text-xs font-bold text-rose-500 uppercase tracking-widest text-center mt-2 animate-pulse" aria-live="assertive">
                          {form.formState.errors.interests.message}
                        </p>
                      )}
                      <FormMessage />
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-6">
                      <div className="text-center pb-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                          {language === 'de'
                            ? "Wähle einige Hobbys und Interessen, die zu dir passen (Tinder-Style)."
                            : "Choose some hobbies and interests that match you (Tinder-style)."}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 justify-center py-2">
                        {tinderInterestsList.map((interest) => {
                          const currentSelection = form.watch('tinderInterests') || [];
                          const isSelected = currentSelection.includes(interest.id);
                          
                          return (
                            <button
                              key={interest.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  form.setValue('tinderInterests', currentSelection.filter(id => id !== interest.id));
                                } else {
                                  form.setValue('tinderInterests', [...currentSelection, interest.id]);
                                }
                              }}
                              aria-pressed={isSelected}
                              className={cn(
                                "px-4 py-2.5 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-none shadow-sm shadow-primary/20"
                                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                              )}
                            >
                              {language === 'de' ? interest.label.de : interest.label.en}
                            </button>
                          );
                        })}
                      </div>

                      {form.formState.errors.tinderInterests && (
                        <p className="text-xs font-bold text-rose-500 uppercase tracking-widest text-center mt-2 animate-pulse" aria-live="assertive">
                          {form.formState.errors.tinderInterests.message}
                        </p>
                      )}
                    </div>
                  )}

                  {step === 5 && (
                    <div className="flex flex-col items-center gap-4 w-full py-2">
                      {/* 1. Profile Photo Upload block (Preview + Upload label + Remove button) */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative group">
                          <div className="w-32 h-32 rounded-full bg-slate-50 border-none overflow-hidden flex items-center justify-center">
                            {form.watch('photoURL') ? (
                              <img src={form.watch('photoURL') || undefined} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-16 h-16 text-slate-200" />
                            )}
                            {uploadingImage && (
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              </div>
                            )}
                          </div>
                          <label 
                            className={cn(
                              "absolute bottom-1 right-1 p-2.5 rounded-full bg-primary text-white shadow-none cursor-pointer hover:scale-110 active:scale-95 transition-all focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary",
                              (uploadingImage || isSubmitting) && "opacity-50 cursor-not-allowed pointer-events-none"
                            )}
                            aria-label={language === 'de' ? "Profilbild hochladen" : "Upload profile picture"}
                          >
                            <Camera className="w-4.5 h-4.5" aria-hidden="true" />
                            <input 
                              type="file" 
                              className="sr-only" 
                              accept="image/*" 
                              onChange={handleImageUpload} 
                              disabled={uploadingImage || isSubmitting} 
                              aria-label={language === 'de' ? "Bilddatei auswählen" : "Select image file"}
                            />
                          </label>
                        </div>
                        
                        {form.watch('photoURL') && (
                          <button
                            type="button"
                            disabled={uploadingImage || isSubmitting}
                            onClick={() => {
                              form.setValue('photoURL', null, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                            className="text-[10px] font-black text-rose-500 hover:underline uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            {language === 'de' ? "Foto/Avatar entfernen" : "Remove photo/avatar"}
                          </button>
                        )}
                      </div>

                      {form.formState.errors.photoURL && (
                        <p className="text-xs font-bold text-rose-500 uppercase tracking-widest text-center mt-2 animate-pulse" aria-live="assertive">
                          {form.formState.errors.photoURL.message}
                        </p>
                      )}

                      {/* 2. Avatar Grid block (Title + Grid of 8) */}
                      <div className="w-full space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                          {language === 'de' ? "Oder wähle einen Avatar:" : "Or choose an avatar:"}
                        </p>
                        <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto justify-items-center">
                          {DEFAULT_AVATARS.map((avatar) => {
                            const isSelected = form.watch('photoURL') === avatar.url;
                            return (
                              <button
                                key={avatar.id}
                                type="button"
                                disabled={uploadingImage || isSubmitting}
                                aria-label={language === 'de' ? `Avatar ${avatar.label} auswählen` : `Select avatar ${avatar.label}`}
                                aria-pressed={isSelected}
                                onClick={() => {
                                  form.setValue('photoURL', avatar.url, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                }}
                                className={cn(
                                  "w-12 h-12 rounded-full overflow-hidden border-2 bg-slate-50 hover:scale-105 active:scale-95 transition-all p-0.5 flex items-center justify-center disabled:opacity-50",
                                  isSelected ? "border-primary ring-2 ring-emerald-500/20 scale-105" : "border-transparent"
                                )}
                              >
                                <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover rounded-full" />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Random Generation block (Random Button + Counter text + Limit Reach Hint) */}
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRandomAvatar}
                          disabled={randomAvatarLimitReached || uploadingImage || isSubmitting}
                          className="h-10 px-6 rounded-full border-slate-200 text-slate-700 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                        >
                          <Shuffle className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          {language === 'de' ? "Zufälligen Avatar" : "Random avatar"}
                        </Button>

                        <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400" aria-live="polite">
                          {randomAvatarLimitReached
                            ? (language === 'de' ? "Random-Limit erreicht" : "Random limit reached")
                            : (language === 'de'
                                ? `Noch ${remainingRandomAvatarRolls} ${remainingRandomAvatarRolls === 1 ? "Vorschlag" : "Vorschläge"}`
                                : `${remainingRandomAvatarRolls} ${remainingRandomAvatarRolls === 1 ? "suggestion" : "suggestions"} left`)}
                        </p>

                        {randomAvatarLimitReached && (
                          <p className="mt-1 max-w-xs text-center text-[11px] font-medium text-slate-500 leading-relaxed">
                            {language === 'de'
                              ? "Du kannst einen Avatar auswählen oder dein Profil später mit Aktiva Supporter weiter anpassen."
                              : "You can choose an avatar or customize your profile further later with Aktiva Supporter."}
                          </p>
                        )}
                      </div>

                      {/* 4. Premium customization preview & teaser block (Crown title + Customization chips + Teaser card) */}
                      <div className="w-full flex flex-col items-center gap-3">
                        <div className="w-full space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex items-center justify-center gap-1">
                            <Crown className="w-3 h-3 text-emerald-500/70" />
                            {language === 'de' ? "Freie Gestaltung (Supporter)" : "Full Customization (Supporter)"}
                          </p>
                          <div className="flex flex-wrap gap-1.5 justify-center opacity-60">
                            {["Haare", "Gesicht", "Kleidung", "Accessoires", "Hintergrund"].map((labelDe, idx) => {
                              const labelEn = ["Hair", "Face", "Clothing", "Accessories", "Background"][idx];
                              return (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 border border-slate-200 text-[9px] font-bold uppercase tracking-wider select-none cursor-not-allowed flex items-center gap-1"
                                >
                                  {language === 'de' ? labelDe : labelEn}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Supporter Teaser */}
                        <div className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-3 flex gap-2.5 items-start text-left relative overflow-hidden">
                          <div className="p-1.5 bg-emerald-500 rounded-xl text-white shadow-sm shrink-0">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                {language === 'de' ? "Mehr Individualisierung mit Aktiva Supporter" : "More customization with Aktiva Supporter"}
                              </span>
                              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[7px] font-bold bg-emerald-500/20 text-emerald-800 uppercase tracking-widest">
                                {language === 'de' ? "Bald verfügbar" : "Coming soon"}
                              </span>
                            </div>
                            <p className="text-[10px] font-semibold text-slate-600 leading-normal">
                              {language === 'de' 
                                ? "Gestalte deinen Avatar später frei mit Frisur, Kleidung, Accessoires und Profil-Designs."
                                : "Customize your avatar with hairstyle, clothing, accessories and profile designs."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-center mt-1">
                        <p className="text-sm font-bold text-slate-500">
                          {language === 'de' ? "Zeig dich der Community!" : "Show yourself to the community!"}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className={cn(
                "mt-8 flex w-full items-center justify-between pb-4 gap-4 shrink-0",
                isSparseStep ? "mt-auto" : "mt-8"
              )}>
                {step > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={prevStep} 
                    disabled={isSubmitting || uploadingImage}
                    className="h-14 px-8 rounded-full text-slate-500 font-black uppercase tracking-widest text-[11px] hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    {language === 'de' ? 'ZURÜCK' : 'BACK'}
                  </Button>
                )}
                {step < onboardingSteps.length ? (
                  <Button 
                    key="next-btn"
                    type="button" 
                    onClick={nextStep} 
                    disabled={isSubmitting || uploadingImage}
                    className="flex-1 h-14 rounded-full font-black uppercase tracking-widest text-[11px] shadow-none transition-all active:scale-[0.98]"
                  >
                    {language === 'de' ? 'WEITER' : 'CONTINUE'}
                  </Button>
                ) : (
                  <Button 
                    key="submit-btn"
                    type="submit" 
                    disabled={isSubmitting} 
                    className="flex-1 h-14 rounded-full font-black uppercase tracking-widest text-[11px] shadow-none transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'de' ? 'ABSCHLIESSEN' : 'FINISH')}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>

        {/* Footer Legal Links */}
        <footer className="mt-auto pt-6 pb-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-slate-100">
          <Link href="/terms" className="hover:text-primary transition-colors">
            {language === 'de' ? 'AGB' : 'Terms'}
          </Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">
            {language === 'de' ? 'Datenschutz' : 'Privacy'}
          </Link>
          <Link href="/imprint" className="hover:text-primary transition-colors">
            {language === 'de' ? 'Impressum' : 'Imprint'}
          </Link>
          <Link href="/licenses" className="hover:text-primary transition-colors">
            {language === 'de' ? 'Lizenzen' : 'Licenses'}
          </Link>
          <Link href="/accessibility" className="hover:text-primary transition-colors">
            {language === 'de' ? 'Barrierefreiheit' : 'Accessibility'}
          </Link>
          <Link href="/cancellation" className="hover:text-primary transition-colors">
            {language === 'de' ? 'Widerruf' : 'Cancellation'}
          </Link>
        </footer>
      </div>
    </div>
  );
}
