'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { updatePresetAvatar } from '@/lib/firebase/firestore';
import {
  AvatarStudioConfig,
  DEFAULT_STUDIO_CONFIG,
  SKIN_COLOR_OPTIONS,
  TOP_OPTIONS,
  HAIR_COLOR_OPTIONS,
  CLOTHING_OPTIONS,
  CLOTHES_COLOR_OPTIONS,
  EYES_OPTIONS,
  MOUTH_OPTIONS,
  ACCESSORIES_OPTIONS,
  BACKGROUND_COLOR_OPTIONS,
  buildDicebearStudioUrl,
  getRandomAvatarConfig,
} from '@/lib/avatar-studio-options';
import { cn } from '@/lib/utils';
import { Sparkles, Shuffle, Check, Loader2, Lock, Crown } from 'lucide-react';

interface AvatarStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  isPremium?: boolean;
  onSuccess?: (photoURL: string) => void;
  onTriggerUpgrade?: () => void;
}

export function AvatarStudioDialog({
  open,
  onOpenChange,
  userId,
  isPremium = false,
  onSuccess,
  onTriggerUpgrade,
}: AvatarStudioDialogProps) {
  const language = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<AvatarStudioConfig>(DEFAULT_STUDIO_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('hair');

  const generatedUrl = buildDicebearStudioUrl(config);

  const handleRandomize = () => {
    setConfig(getRandomAvatarConfig());
  };

  const handleSave = async () => {
    if (!isPremium) {
      if (onTriggerUpgrade) {
        onTriggerUpgrade();
      } else {
        toast({
          title: language === 'de' ? 'Aktiva Premium erforderlich 👑' : 'Aktiva Premium Required 👑',
          description:
            language === 'de'
              ? 'Das Erstellen eigener Avatare ist ein exklusives Premium-Feature. Schalte Premium frei, um deinen individuellen Avatar zu speichern!'
              : 'Creating custom avatars is an exclusive Premium feature. Unlock Premium to save your unique avatar!',
        });
      }
      return;
    }

    if (!userId) return;

    setIsSaving(true);
    try {
      await updatePresetAvatar(userId, generatedUrl);
      toast({
        title: language === 'de' ? 'Dein Custom-Avatar wurde gespeichert! 🎉' : 'Your custom avatar has been saved! 🎉',
      });
      if (onSuccess) {
        onSuccess(generatedUrl);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to save studio avatar:', err);
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler beim Speichern' : 'Error saving avatar',
        description: err?.message || '',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-full max-h-[88vh] overflow-y-auto flex flex-col p-5 sm:p-7 rounded-[2.5rem] bg-neutral-900 border border-neutral-800 text-white shadow-2xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-700/70 [&::-webkit-scrollbar-thumb]:rounded-full dark">
        {/* Header */}
        <DialogHeader className="flex flex-col items-center text-center gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border-none shadow-md">
              <Crown className="w-3 h-3 mr-1 inline-block" /> Premium Studio
            </Badge>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            {language === 'de' ? 'Avatar-Studio' : 'Avatar Studio'}
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-400 font-medium max-w-sm">
            {language === 'de'
              ? 'Gestalte deinen persönlichen Avatar ganz nach deinem Geschmack.'
              : 'Customize your personal avatar to match your unique style.'}
          </DialogDescription>
        </DialogHeader>

        {/* Live Preview Stage & Controls */}
        <div className="flex flex-col items-center justify-center my-3 p-4 bg-gradient-to-b from-neutral-850 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-[2rem] relative shadow-inner shrink-0">
          <div className="relative group">
            <img
              src={generatedUrl}
              alt="Custom Avatar Preview"
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-amber-400/40 shadow-xl object-cover bg-neutral-800 transition-all duration-300 transform group-hover:scale-105"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleRandomize}
              className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-neutral-800 border border-amber-400/50 text-amber-400 hover:bg-neutral-700 hover:scale-110 active:scale-95 shadow-lg transition-all"
              title={language === 'de' ? 'Zufällige Kombination' : 'Randomize'}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Customization Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full grid grid-cols-5 bg-neutral-850 p-1 rounded-2xl border border-neutral-800 text-neutral-400 shrink-0">
            <TabsTrigger value="hair" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-neutral-700 data-[state=active]:text-white">
              {language === 'de' ? 'Haare' : 'Hair'}
            </TabsTrigger>
            <TabsTrigger value="face" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-neutral-700 data-[state=active]:text-white">
              {language === 'de' ? 'Gesicht' : 'Face'}
            </TabsTrigger>
            <TabsTrigger value="clothes" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-neutral-700 data-[state=active]:text-white">
              {language === 'de' ? 'Outfit' : 'Outfit'}
            </TabsTrigger>
            <TabsTrigger value="extras" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-neutral-700 data-[state=active]:text-white">
              {language === 'de' ? 'Extras' : 'Extras'}
            </TabsTrigger>
            <TabsTrigger value="bg" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-neutral-700 data-[state=active]:text-white">
              {language === 'de' ? 'Farbe' : 'Color'}
            </TabsTrigger>
          </TabsList>

          {/* Options Scrollable Content */}
          <div className="flex-1 overflow-y-auto mt-3 px-1 py-1 space-y-4 min-h-[160px] max-h-[230px] overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-700/70 [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* HAIR TAB */}
            <TabsContent value="hair" className="space-y-3 mt-0">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Frisur & Kopfbedeckung' : 'Hairstyle & Headwear'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TOP_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, top: item.id }))}
                      className={cn(
                        'p-2.5 text-xs font-bold rounded-xl border text-left transition-all truncate',
                        config.top === item.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                          : 'border-neutral-800 bg-neutral-850 text-neutral-300 hover:bg-neutral-800'
                      )}
                    >
                      {language === 'de' ? item.labelDe : item.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Haarfarbe' : 'Hair Color'}
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 py-1">
                  {HAIR_COLOR_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, hairColor: item.id }))}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center justify-self-center',
                        config.hairColor === item.id ? 'border-amber-400 ring-2 ring-amber-400/30 scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: item.hex }}
                      title={language === 'de' ? item.labelDe : item.labelEn}
                    >
                      {config.hairColor === item.id && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* FACE TAB */}
            <TabsContent value="face" className="space-y-3 mt-0">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Hautton' : 'Skin Tone'}
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 py-1">
                  {SKIN_COLOR_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, skinColor: item.id }))}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center justify-self-center shadow-md',
                        config.skinColor === item.id ? 'border-amber-400 ring-2 ring-amber-400/30 scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: item.hex }}
                      title={language === 'de' ? item.labelDe : item.labelEn}
                    >
                      {config.skinColor === item.id && <Check className="w-4 h-4 text-slate-900 drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Augen' : 'Eyes'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EYES_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, eyes: item.id }))}
                      className={cn(
                        'p-2 text-xs font-bold rounded-xl border text-center transition-all truncate',
                        config.eyes === item.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                          : 'border-neutral-800 bg-neutral-850 text-neutral-300 hover:bg-neutral-800'
                      )}
                    >
                      {language === 'de' ? item.labelDe : item.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Mund' : 'Mouth'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MOUTH_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, mouth: item.id }))}
                      className={cn(
                        'p-2 text-xs font-bold rounded-xl border text-center transition-all truncate',
                        config.mouth === item.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                          : 'border-neutral-800 bg-neutral-850 text-neutral-300 hover:bg-neutral-800'
                      )}
                    >
                      {language === 'de' ? item.labelDe : item.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* CLOTHES TAB */}
            <TabsContent value="clothes" className="space-y-3 mt-0">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Kleidungsstil' : 'Clothing Style'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CLOTHING_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, clothing: item.id }))}
                      className={cn(
                        'p-2.5 text-xs font-bold rounded-xl border text-left transition-all truncate',
                        config.clothing === item.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                          : 'border-neutral-800 bg-neutral-850 text-neutral-300 hover:bg-neutral-800'
                      )}
                    >
                      {language === 'de' ? item.labelDe : item.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Kleidungsfarbe' : 'Clothes Color'}
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 py-1">
                  {CLOTHES_COLOR_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, clothesColor: item.id }))}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center justify-self-center shadow-sm',
                        config.clothesColor === item.id ? 'border-amber-400 ring-2 ring-amber-400/30 scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: item.hex }}
                      title={language === 'de' ? item.labelDe : item.labelEn}
                    >
                      {config.clothesColor === item.id && <Check className="w-4 h-4 text-slate-900 drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* EXTRAS TAB */}
            <TabsContent value="extras" className="space-y-3 mt-0">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Brille / Accessoires' : 'Glasses / Accessories'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCESSORIES_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, accessories: item.id }))}
                      className={cn(
                        'p-2.5 text-xs font-bold rounded-xl border text-left transition-all truncate',
                        config.accessories === item.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                          : 'border-neutral-800 bg-neutral-850 text-neutral-300 hover:bg-neutral-800'
                      )}
                    >
                      {language === 'de' ? item.labelDe : item.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* BACKGROUND COLOR TAB */}
            <TabsContent value="bg" className="space-y-3 mt-0">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1.5 block">
                  {language === 'de' ? 'Hintergrundfarbe' : 'Background Color'}
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2.5 py-1">
                  {BACKGROUND_COLOR_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, backgroundColor: item.id }))}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center justify-self-center shadow-md',
                        config.backgroundColor === item.id ? 'border-amber-400 ring-2 ring-amber-400/30 scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: item.hex }}
                      title={language === 'de' ? item.labelDe : item.labelEn}
                    >
                      {config.backgroundColor === item.id && <Check className="w-4 h-4 text-slate-950 drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="mt-4 pt-3 border-t border-neutral-800 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="h-11 px-5 rounded-2xl font-bold text-xs text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            {language === 'de' ? 'Abbrechen' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'h-11 px-6 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 shadow-lg',
              isPremium
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 shadow-amber-500/20'
                : 'bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/30'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPremium ? (
              <Check className="w-4 h-4 stroke-[3]" />
            ) : (
              <Lock className="w-4 h-4 text-amber-400" />
            )}
            {isPremium
              ? language === 'de'
                ? 'Avatar speichern'
                : 'Save Avatar'
              : language === 'de'
                ? 'Freischalten (Premium)'
                : 'Unlock with Premium'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
