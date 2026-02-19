'use client';

import { useTheme, themes } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function ThemeSelector() {
    const { theme, setTheme, mode, toggleMode } = useTheme();

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="space-y-1">
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">Choose your favorite primary color.</p>
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

            <Separator className="my-4" />
            
            <div className="space-y-1">
                <p className="font-medium">Mode</p>
                <p className="text-sm text-muted-foreground">Toggle between light and dark mode.</p>
            </div>
            <div className="mt-4">
                <Button onClick={toggleMode} variant="outline" className="w-full justify-start gap-4 px-4 h-12">
                    {mode === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    <span>{mode === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
                </Button>
            </div>
        </div>
    );
}
