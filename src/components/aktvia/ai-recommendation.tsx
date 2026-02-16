'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { recommendPlace } from '@/ai/flows/place-recommendation-flow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

type AiRecommendationProps = {
  place: Place;
};

export function AiRecommendation({ place }: AiRecommendationProps) {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendation = async () => {
    setIsLoading(true);
    setError(null);
    setRecommendation(null);
    try {
      const result = await recommendPlace({
        name: place.name,
        address: place.address,
        categories: place.categories,
        rating: place.rating,
      });
      setRecommendation(result.recommendation);
    } catch (e) {
      setError('Could not generate recommendation. Please try again.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-background/50 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="text-primary" />
          <span>AI Recommendation</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recommendation && !isLoading && !error && (
          <div className="space-y-4">
             <p className="text-sm text-muted-foreground">
                Want a quick, personalized summary? Let our AI give you a recommendation for this place.
            </p>
            <Button onClick={getRecommendation} disabled={isLoading}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </div>
        )}
        {isLoading && (
            <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {recommendation && <p className="text-sm text-foreground">{recommendation}</p>}
      </CardContent>
    </Card>
  );
}
