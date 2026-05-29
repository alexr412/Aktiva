'use client';

import { useState } from 'react';
import { useCollections } from '@/hooks/use-collections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, FolderPlus, Folder, Check, Lock, Sparkles } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { PremiumUpgradeModal } from './PremiumUpgradeModal';
import { cn } from '@/lib/utils';

interface SaveToCollectionModalProps {
  placeId: string;
  placeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveToCollectionModal({ placeId, placeName, open, onOpenChange }: SaveToCollectionModalProps) {
  const language = useLanguage();
  const {
    collections,
    createCollection,
    addPlaceToCollection,
    isPremium,
    maxCollections
  } = useCollections();

  const [newCollectionName, setNewCollectionName] = useState('');
  const [isUpsellOpen, setIsUpsellOpen] = useState(false);

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;
    const success = await createCollection(newCollectionName.trim());
    if (success) {
      setNewCollectionName('');
    }
  };

  const handleSaveToCol = async (colId: string) => {
    const success = await addPlaceToCollection(colId, placeId);
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md dark:bg-neutral-900 border-none rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl flex items-center gap-2 text-slate-800 dark:text-neutral-200">
              <FolderPlus className="h-5 w-5 text-emerald-500" />
              {language === 'de' ? 'In Sammlung speichern' : 'Save to Collection'}
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-slate-400 dark:text-neutral-400">
              {language === 'de' 
                ? `Speichere "${placeName}" in einer deiner persönlichen Listen.` 
                : `Save "${placeName}" to one of your custom lists.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {/* Create Collection Input */}
            <div className="flex gap-2 items-center">
              <Input
                placeholder={language === 'de' ? 'Neue Sammlung...' : 'New collection...'}
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                className="rounded-full bg-slate-50 dark:bg-neutral-800 border-none font-bold text-xs shadow-inner h-11"
              />
              <Button 
                onClick={handleCreate}
                className="rounded-full h-11 px-5 font-black text-xs uppercase"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {language === 'de' ? 'Erstellen' : 'Create'}
              </Button>
            </div>

            {/* Collections Limit Indicator */}
            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-neutral-500 px-1">
              <span>{language === 'de' ? 'Deine Sammlungen' : 'Your Collections'}</span>
              <span>
                {isPremium 
                  ? 'Premium Unlimited 👑' 
                  : `${collections.length} / ${maxCollections} ${language === 'de' ? 'Sammlungen' : 'Collections'}`}
              </span>
            </div>

            {/* List of existing collections */}
            <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2">
              {collections.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-slate-400 dark:text-neutral-500">
                  {language === 'de' ? 'Noch keine Sammlungen vorhanden.' : 'No collections created yet.'}
                </div>
              ) : (
                collections.map((col) => {
                  const alreadySaved = col.places.includes(placeId);
                  return (
                    <button
                      key={col.id}
                      onClick={() => !alreadySaved && handleSaveToCol(col.id)}
                      disabled={alreadySaved}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all border border-slate-100 dark:border-neutral-800 hover:border-emerald-500/20 dark:hover:border-emerald-500/20 text-left",
                        alreadySaved 
                          ? "bg-slate-50 dark:bg-neutral-800/50 opacity-60 cursor-not-allowed" 
                          : "bg-white dark:bg-neutral-800 active:scale-[0.98]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Folder className={cn("h-5 w-5", alreadySaved ? "text-slate-400" : "text-emerald-500")} />
                        <div>
                          <p className="font-bold text-xs uppercase tracking-tight text-slate-800 dark:text-neutral-200">
                            {col.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {col.places.length} {col.places.length === 1 
                              ? (language === 'de' ? 'Ort' : 'Place') 
                              : (language === 'de' ? 'Orte' : 'Places')}
                          </p>
                        </div>
                      </div>
                      {alreadySaved && <Check className="h-4 w-4 text-slate-400" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Premium Upsell Widget inside the modal */}
            {!isPremium && (
              <button
                onClick={() => setIsUpsellOpen(true)}
                className="w-full mt-2 flex items-center justify-between p-3.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 rounded-2xl border border-amber-500/20 text-left active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 p-2 rounded-xl text-white">
                    <Sparkles className="h-4 w-4 fill-white/10" />
                  </div>
                  <div>
                    <p className="font-black text-xs text-slate-800 dark:text-neutral-200 uppercase tracking-tight flex items-center gap-1">
                      Aktiva Premium
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-neutral-400 font-semibold mt-0.5">
                      {language === 'de' 
                        ? 'Unbegrenzte Listen & Orte freischalten.' 
                        : 'Unlock unlimited lists & places.'}
                    </p>
                  </div>
                </div>
                <Lock className="h-4 w-4 text-amber-500 shrink-0" />
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PremiumUpgradeModal 
        isOpen={isUpsellOpen} 
        onClose={() => setIsUpsellOpen(false)} 
      />
    </>
  );
}
