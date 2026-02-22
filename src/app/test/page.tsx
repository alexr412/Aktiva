'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';


const GEOAPIFY_CATEGORIES = [
  "accommodation", "adult", "airport", "building", "catering", 
  "childcare", "commercial", "education", "emergency", "entertainment", 
  "healthcare", "heritage", "leisure", "natural", "office", 
  "parking", "public_transport", "religion", "rental", "service", 
  "sport", "tourism"
];

export default function TestPage() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleCategory = (category: string) => {
    setActiveFilters(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Geoapify Filter Matrix</h1>
      
      <div className="flex flex-wrap gap-2">
        {GEOAPIFY_CATEGORIES.map(category => (
          <Button
            key={category}
            variant={activeFilters.includes(category) ? 'default' : 'outline'}
            onClick={() => toggleCategory(category)}
            className="rounded-full"
          >
            {category}
          </Button>
        ))}
      </div>

      <Card className="mt-6 bg-muted/50">
        <CardHeader>
            <CardTitle className="text-base">Generated API String (categories=)</CardTitle>
            <CardDescription>Use this string for your API requests.</CardDescription>
        </CardHeader>
        <CardContent>
            <code className="block text-sm break-all font-mono p-4 rounded-md bg-background border">
            {activeFilters.length > 0 ? activeFilters.join(',') : 'No categories selected'}
            </code>
        </CardContent>
      </Card>
    </div>
  );
}
