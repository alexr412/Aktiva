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
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('mint');
  const [mode, setMode] = useState<Mode>('light');

  // Initialisierung beim Mounten
  useEffect(() => {
    // Theme Initialisierung
    try {
      const storedTheme = localStorage.getItem('app-theme') as Theme | null;
      const initialTheme = storedTheme && themes.some(t => t.name === storedTheme) ? storedTheme : 'mint';
      setThemeState(initialTheme);
      applyThemeClass(initialTheme);
    } catch (e) {
      applyThemeClass('mint');
    }

    // Mode Initialisierung
    try {
      const storedMode = localStorage.getItem('app-mode') as Mode | null;
      if (storedMode) {
        setMode(storedMode);
        if (storedMode === 'dark') {
          document.documentElement.classList.add('dark');
        }
      } else {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialMode = systemPrefersDark ? 'dark' : 'light';
        setMode(initialMode);
        if (initialMode === 'dark') {
          document.documentElement.classList.add('dark');
        }
      }
    } catch (e) {
      // localStorage nicht verfügbar
    }
  }, []);

  // MODUL 19: DIAGNOSTIC LOGGING
  useEffect(() => {
    const root = document.documentElement;
    console.log("THEME MUTATION: Aktuelle Klassen am HTML-Root ->", root.className);
    
    // Verzögerte Prüfung der CSS-Berechnung durch den Browser
    const timeoutId = setTimeout(() => {
      const computedPrimary = getComputedStyle(root).getPropertyValue('--primary').trim();
      console.log("THEME COMPUTED: Aufgelöster HSL-Wert für --primary ->", computedPrimary);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [theme]);

  const applyThemeClass = (newTheme: Theme) => {
    const root = document.documentElement;
    // Alte Theme-Klassen entfernen
    root.classList.forEach(className => {
      if (className.startsWith('theme-')) {
        root.classList.remove(className);
      }
    });
    // Neue Klasse hinzufügen
    root.classList.add(`theme-${newTheme}`);
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

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    try {
      localStorage.setItem('app-mode', newMode);
    } catch (e) {
      // ignore
    }
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, toggleMode }}>
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
