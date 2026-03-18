'use client';

import { useTheme, themes } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { Moon, Sun, Lock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export function ThemeSelector() {
    const { theme, setTheme, mode, toggleMode } = useTheme();
    const { userProfile } = useAuth();
    const isPremium = userProfile?.isPremium || false;

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="space-y-1">
                <p className="font-medium">Appearance</p>
                <p className="text-sm text-muted-foreground">Customize your experience.</p>
            </div>
            
            <Separator className="my-4" />

            {/* Accent Color Section with Gating */}
            <div className="relative w-full p-4 border border-border rounded-xl mt-4">
                <div className="space-y-1 mb-4">
                    <p className="text-sm font-bold">Akzentfarbe</p>
                    <p className="text-xs text-muted-foreground">Choose your favorite primary color.</p>
                </div>

                {!isPremium && (
                    <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <Lock className="w-5 h-5" />
                            <span className="font-bold text-sm">Premium Feature</span>
                        </div>
                        <Button variant="default" size="sm" className="px-4 py-2 h-auto text-xs font-bold rounded-lg shadow-lg transition-transform active:scale-95">
                            Upgrade freischalten
                        </Button>
                    </div>
                )}

                <div className={cn(
                    "grid grid-cols-4 sm:grid-cols-7 gap-3 transition-all duration-500",
                    !isPremium && "opacity-40 pointer-events-none grayscale-[0.5]"
                )}>
                    {themes.map((t) => (
                        <button 
                            key={t.name} 
                            onClick={() => setTheme(t.name)} 
                            className={cn(
                                'h-10 w-10 rounded-full border-2 transition-all flex items-center justify-center',
                                theme === t.name ? 'border-primary scale-110 ring-2 ring-ring ring-offset-2' : 'border-transparent hover:scale-105'
                            )}
                        >
                            <div className="h-full w-full rounded-full shadow-inner" style={{backgroundColor: t.color}}/>
                            <span className="sr-only">{t.name}</span>
                        </button>
                    ))}
                </div>
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
