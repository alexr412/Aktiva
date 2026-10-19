'use client';

import { Footprints, Mountain, Bike, ShoppingBag, Dices, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACTIVITY_IDEAS, type ActivityIdea } from '@/lib/activity-ideas';

const icons = { walk: Footprints, hike: Mountain, cycle: Bike, shopping: ShoppingBag, boardgames: Dices, coffee: Coffee };

export function ActivityIdeas({ language, onSelect }: { language: string; onSelect: (idea: ActivityIdea) => void }) {
  return (
    <section aria-labelledby="activity-ideas-heading" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 id="activity-ideas-heading" className="text-base font-semibold">
        {language === 'de' ? 'Gemeinsam etwas unternehmen' : 'Do something together'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {language === 'de' ? 'Wähle eine Idee und plane ein Treffen mit Ort und Termin.' : 'Choose an idea and plan a meetup with a place and date.'}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ACTIVITY_IDEAS.map(idea => {
          const Icon = icons[idea.id];
          const label = language === 'de' ? idea.labelDe : idea.labelEn;
          return (
            <Button key={idea.id} type="button" variant="outline" className="h-auto min-h-11 justify-start gap-2 whitespace-normal px-3 py-2 text-left" onClick={() => onSelect(idea)} aria-label={language === 'de' ? `${label} planen` : `Plan: ${label}`}>
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{label}</span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
