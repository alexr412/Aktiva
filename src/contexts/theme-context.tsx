'use client';

import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Theme = 'mint' | 'violet' | 'blue' | 'yellow' | 'orange' | 'green' | 'red';

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
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('mint');

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      if (storedTheme && themes.some(t => t.name === storedTheme)) {
        setTheme(storedTheme);
      }
    } catch (error) {
      // localStorage is not available on the server
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all theme classes
    themes.forEach(t => root.classList.remove(`theme-${t.name}`));
    // Add the current theme class
    root.classList.add(`theme-${theme}`);
    
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
        // localStorage is not available on the server
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
