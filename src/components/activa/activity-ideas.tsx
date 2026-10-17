'use client';

import { Footprints, Mountain, Bike, ShoppingBag, Dices, Coffee } from 'lucide-react';
import styles from './spot-card.module.css';
import { ACTIVITY_IDEAS, type ActivityIdea } from '@/lib/activity-ideas';

const icons = { walk: Footprints, hike: Mountain, cycle: Bike, shopping: ShoppingBag, boardgames: Dices, coffee: Coffee };

export function ActivityIdeas({ language, onSelect }: { language: string; onSelect: (idea: ActivityIdea) => void }) {
  return (
    <section aria-labelledby="activity-ideas-heading" className={styles.ideas}>
      <h2 id="activity-ideas-heading">
        {language === 'de' ? 'Spontan unterwegs?' : 'Feeling spontaneous?'}
      </h2>
      <div className={styles.ideaList}>
        {ACTIVITY_IDEAS.map(idea => {
          const Icon = icons[idea.id];
          const label = language === 'de' ? idea.labelDe : idea.labelEn;
          return (
            <button key={idea.id} type="button" className={styles.ideaButton} onClick={() => onSelect(idea)} aria-label={language === 'de' ? `${label} planen` : `Plan: ${label}`}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
