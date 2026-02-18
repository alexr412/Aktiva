'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { categories } from '@/components/aktvia/category-filters';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { uploadProfileImage } from '@/lib/firebase/storage';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, ArrowLeft, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const profileSchema = z.object({
  age: z.number().min(13, "You must be at least 13 years old.").max(120, "Please enter a valid age."),
  location: z.string().min(2, "Location is required."),
  bio: z.string().max(150, "Bio must be 150 characters or less.").optional(),
  interests: z.array(z.string()).min(1, "Select at least one interest."),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const onboardingSteps = [
  { id: 1, title: "About You", fields: ['age', 'location'] },
  { id: 2, title: "Your Bio", fields: ['bio'] },
  { id: 3, title: "Your Interests", fields: ['interests'] },
  { id: 4, title: "Profile Picture" },
];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(user?.photoURL || null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      interests: [],
      bio: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const handleNext = async () => {
    const fieldsToValidate = onboardingSteps.find(s => s.id === step)?.fields as (keyof ProfileFormData)[] | undefined;
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => setStep(prev => prev - 1);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (profileImage) {
        await uploadProfileImage(user.uid, profileImage);
      }
      
      await updateUserProfile(user.uid, {
        ...data,
        onboardingCompleted: true,
      });

      toast({ title: "Profile complete!", description: "Welcome to Aktvia." });
      router.push('/explore');
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || "Failed to update profile." });
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const interestOptions = categories.filter(c => c.name !== 'Highlights').map(c => c.name);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-secondary">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="space-y-2 mb-4">
              <Progress value={(step / onboardingSteps.length) * 100} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                Step {step} of {onboardingSteps.length}
              </p>
            </div>
            <CardTitle className="text-center text-2xl font-bold">{onboardingSteps[step - 1].title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {step === 1 && (
                <div className="space-y-4">
                  <CardDescription className="text-center">Tell us a bit about yourself.</CardDescription>
                  <div>
                    <Input {...form.register('age', { valueAsNumber: true })} type="number" placeholder="Your Age" />
                    {form.formState.errors.age && <p className="text-destructive text-sm mt-1">{form.formState.errors.age.message}</p>}
                  </div>
                  <div>
                    <Input {...form.register('location')} placeholder="Your Location (e.g., City, Country)" />
                    {form.formState.errors.location && <p className="text-destructive text-sm mt-1">{form.formState.errors.location.message}</p>}
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-4">
                  <CardDescription className="text-center">A short bio helps others get to know you.</CardDescription>
                  <Textarea {...form.register('bio')} placeholder="Write something about yourself..." maxLength={150} />
                  {form.formState.errors.bio && <p className="text-destructive text-sm mt-1">{form.formState.errors.bio.message}</p>}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-4">
                   <CardDescription className="text-center">What do you enjoy doing?</CardDescription>
                    <Controller
                        control={form.control}
                        name="interests"
                        render={({ field }) => (
                            <div className="flex flex-wrap gap-2 justify-center">
                                {interestOptions.map((interest) => (
                                    <Badge
                                        key={interest}
                                        variant={field.value.includes(interest) ? 'default' : 'secondary'}
                                        onClick={() => {
                                            const newValue = field.value.includes(interest)
                                                ? field.value.filter((i) => i !== interest)
                                                : [...field.value, interest];
                                            field.onChange(newValue);
                                        }}
                                        className="cursor-pointer text-base py-1 px-3"
                                    >
                                        {interest}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    />
                   {form.formState.errors.interests && <p className="text-destructive text-sm mt-1 text-center">{form.formState.errors.interests.message}</p>}
                </div>
              )}
              {step === 4 && (
                <div className="space-y-4 flex flex-col items-center">
                  <CardDescription className="text-center">Add a profile picture so others can recognize you.</CardDescription>
                   <div className="relative">
                        <Avatar className="w-32 h-32 text-4xl">
                            <AvatarImage src={previewImage || ''} />
                            <AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <label htmlFor="profile-picture" className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90">
                           <Camera className="w-5 h-5"/>
                           <Input id="profile-picture" type="file" accept="image/*" className="hidden" onChange={handleImageChange}/>
                        </label>
                   </div>
                   <Button type="button" variant="link" onClick={() => handleNext()}>Skip for now</Button>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack} className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}
                {step < onboardingSteps.length ? (
                  <Button type="button" onClick={handleNext} className="w-full">
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Finish
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
