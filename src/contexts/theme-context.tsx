'use client';

import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';

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
  const [theme, setThemeState] = useState<Theme>('mint');

  useEffect(() => {
    // This effect runs only on the client.
    try {
      const storedTheme = localStorage.getItem('app-theme') as Theme | null;
      const initialTheme = storedTheme && themes.some(t => t.name === storedTheme) ? storedTheme : 'mint';
      setThemeState(initialTheme);
      document.documentElement.setAttribute('data-theme', initialTheme);
    } catch (e) {
      // localStorage is not available.
      document.documentElement.setAttribute('data-theme', 'mint');
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('app-theme', newTheme);
    } catch (e) {
      // localStorage is not available.
    }
    document.documentElement.setAttribute('data-theme', newTheme);
  };

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
