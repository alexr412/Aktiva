'use client';

import { Footprints, Mountain, Bike, ShoppingBag, Dices, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACTIVITY_IDEAS, type ActivityIdea } from '@/lib/activity-ideas';

const icons = { walk: Footprints, hike: Mountain, cycle: Bike, shopping: ShoppingBag, boardgames: Dices, coffee: Coffee };

export function ActivityIdeas({ language, onSelect }: { language: string; onSelect: (idea: ActivityIdea) => void }) {
  return (
    <section aria-labelledby="activity-ideas-heading" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <h2 id="activity-ideas-heading" className="w-full text-sm font-semibold sm:w-auto">
        {language === 'de' ? 'Ideen für ein Treffen' : 'Meetup ideas'}
      </h2>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1">
        {ACTIVITY_IDEAS.map(idea => {
          const Icon = icons[idea.id];
          const label = language === 'de' ? idea.labelDe : idea.labelEn;
          return (
            <Button key={idea.id} type="button" variant="ghost" className="h-auto min-h-11 justify-start gap-1.5 whitespace-normal rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground hover:text-foreground" onClick={() => onSelect(idea)} aria-label={language === 'de' ? `${label} planen` : `Plan: ${label}`}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
