'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';

export function useLanguage(): 'de' | 'en' {
    const { userProfile } = useAuth();
    const [browserLang, setBrowserLang] = useState<'de' | 'en'>('de'); // Default DE for SSR

    useEffect(() => {
        if (typeof window !== 'undefined' && window.navigator) {
            const lang = window.navigator.language || window.navigator.languages?.[0];
            if (lang && lang.toLowerCase().startsWith('en')) {
                setBrowserLang('en');
            } else {
                setBrowserLang('de'); // Default for everything else
            }
        }
    }, []);

    return userProfile?.language || browserLang;
}
