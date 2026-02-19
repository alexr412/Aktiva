'use client';

import { useTheme, themes } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';

export function ThemeSelector() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">Choose your favorite primary color.</p>
                </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
                {themes.map((t) => (
                    <button 
                        key={t.name} 
                        onClick={() => setTheme(t.name)} 
                        className={cn('h-8 w-8 rounded-full border-2 transition-all', theme === t.name ? 'border-primary scale-110 ring-2 ring-ring' : 'border-transparent')}
                    >
                        <div className="h-full w-full rounded-full" style={{backgroundColor: t.color}}/>
                        <span className="sr-only">{t.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
