'use client';

import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';

type Theme = 'mint' | 'violet' | 'blue' | 'yellow' | 'orange' | 'green' | 'red';
type Mode = 'light' | 'dark';

interface ThemeInfo {
  name: Theme;
  color: string;
}

export const themes: ThemeInfo[] = [
  { name: 'mint', color: 'hsl(150 60% 45%)' },
  { name: 'violet', color: 'hsl(259 92% 67%)' },
  { name: 'blue', color: 'hsl(217 91% 60%)' },
  { name: 'yellow', color: 'hsl(45 93% 47%)' },
  { name: 'orange', color: 'hsl(25 95% 53%)' },
  { name: 'green', color: 'hsl(142 76% 36%)' },
  { name: 'red', color: 'hsl(0 72% 51%)' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('mint');
  const [mode, setModeState] = useState<Mode>('light');
  const [mounted, setMounted] = useState(false);

  // Initialisierung beim Mounten
  useEffect(() => {
    // 1. Theme (Accent Color) Initialisierung
    try {
      const storedTheme = localStorage.getItem('app-theme') as Theme | null;
      const initialTheme = storedTheme && themes.some(t => t.name === storedTheme) ? storedTheme : 'mint';
      setThemeState(initialTheme);
      applyThemeClass(initialTheme);
    } catch (e) {
      applyThemeClass('mint');
    }

    // 2. Mode (Light / Dark) Initialisierung
    try {
      const storedMode = localStorage.getItem('app-mode') as Mode | null;
      if (storedMode === 'dark' || storedMode === 'light') {
        setModeState(storedMode);
        applyModeClass(storedMode);
      } else {
        const systemPrefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialMode: Mode = systemPrefersDark ? 'dark' : 'light';
        setModeState(initialMode);
        applyModeClass(initialMode);
      }
    } catch (e) {
      applyModeClass('light');
    }

    setMounted(true);
  }, []);

  const applyThemeClass = (newTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.forEach(className => {
      if (className.startsWith('theme-')) {
        root.classList.remove(className);
      }
    });
    root.classList.add(`theme-${newTheme}`);
  };

  const applyModeClass = (newMode: Mode) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (newMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('app-theme', newTheme);
    } catch (e) {
      // ignore
    }
    applyThemeClass(newTheme);
  };

  const setMode = (newMode: Mode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('app-mode', newMode);
    } catch (e) {
      // ignore
    }
    applyModeClass(newMode);
  };

  const toggleMode = () => {
    const nextMode: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode, toggleMode, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
