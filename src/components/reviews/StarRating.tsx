'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  size?: number;
}

export function StarRating({ rating, onRatingChange, size = 28 }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRatingChange(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          className="p-1"
        >
          <Star
            className={cn(
              'transition-colors',
              (hoverRating || rating) >= star
                ? 'text-amber-400 fill-amber-400'
                : 'text-muted-foreground/50'
            )}
            style={{ width: size, height: size }}
          />
        </button>
      ))}
    </div>
  );
}
