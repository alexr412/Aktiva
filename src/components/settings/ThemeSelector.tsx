'use client';

import { useTheme, themes } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { Moon, Sun } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
            
             <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode" className="flex items-center gap-2 font-medium">
                     {mode === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    <span>{mode === 'light' ? 'Light' : 'Dark'} Mode</span>
                </Label>
                <Switch 
                    id="dark-mode" 
                    checked={mode === 'dark'} 
                    onCheckedChange={toggleMode}
                />
            </div>
        </div>
    );
}
