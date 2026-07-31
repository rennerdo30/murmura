'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LanguageContextValue, ContextProviderProps } from '@/types/context';
import englishTranslations from '@/locales/en.json';

export const LanguageContext = createContext<LanguageContextValue | null>(null);

const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' }
];

const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'murmura_language';

// Recursive type for nested translations
type TranslationValue = string | TranslationObject;
interface TranslationObject {
    [key: string]: TranslationValue;
}

export function LanguageProvider({ children }: ContextProviderProps) {
    const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
    // Seeded with English so the first paint shows real copy instead of raw
    // translation keys while the detected locale is still being fetched.
    const [translations, setTranslations] = useState<TranslationObject | null>(
        englishTranslations as TranslationObject
    );
    const [isLoading, setIsLoading] = useState(true);

    // Detect browser language on mount
    useEffect(() => {
        const detectLanguage = (): string => {
            // Check localStorage first
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && SUPPORTED_LANGUAGES.find(l => l.code === saved)) {
                return saved;
            }

            // Check browser language
            if (typeof window !== 'undefined') {
                // Type assertion for legacy IE userLanguage property
                const nav = navigator as Navigator & { userLanguage?: string };
                const browserLang = navigator.language || nav.userLanguage || '';
                const langCode = browserLang.split('-')[0];

                // Try to find exact match first
                const exactMatch = SUPPORTED_LANGUAGES.find(l => l.code === browserLang);
                if (exactMatch) return exactMatch.code;

                // Try to find language code match
                const langMatch = SUPPORTED_LANGUAGES.find(l => l.code.startsWith(langCode));
                if (langMatch) return langMatch.code;
            }

            return DEFAULT_LANGUAGE;
        };

        const detectedLang = detectLanguage();
        setLanguage(detectedLang);
        if (detectedLang === DEFAULT_LANGUAGE) {
            // Already bundled - no need for a second fetch
            setIsLoading(false);
            return;
        }
        loadTranslations(detectedLang);
    }, []);

    const loadTranslations = async (langCode: string) => {
        setIsLoading(true);
        try {
            // Dynamic import with error handling
            const module = await import(`@/locales/${langCode}.json`);
            setTranslations(module.default || module);
        } catch (error) {
            console.warn(`Failed to load translations for ${langCode}, falling back to English`, error);
            try {
                const fallback = await import(`@/locales/${DEFAULT_LANGUAGE}.json`);
                setTranslations(fallback.default || fallback);
                setLanguage(DEFAULT_LANGUAGE);
            } catch (fallbackError) {
                console.error('Failed to load fallback translations', fallbackError);
                // Set empty translations as last resort
                setTranslations({});
            }
        } finally {
            setIsLoading(false);
        }
    };

    const changeLanguage = (langCode: string) => {
        if (!SUPPORTED_LANGUAGES.find(l => l.code === langCode)) {
            console.warn(`Language ${langCode} not supported`);
            return;
        }
        setLanguage(langCode);
        localStorage.setItem(STORAGE_KEY, langCode);
        loadTranslations(langCode);
    };

    const t = (key: string, params: Record<string, string | number> = {}): string => {
        if (!translations) return key;

        const keys = key.split('.');
        let value: TranslationValue = translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = (value as TranslationObject)[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        // Replace parameters if any
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            return value.replace(/\{{1,2}(\w+)\}{1,2}/g, (match, paramKey) => {
                return params[paramKey] !== undefined ? String(params[paramKey]) : match;
            });
        }

        return typeof value === 'string' ? value : key;
    };

    const value: LanguageContextValue = {
        language,
        changeLanguage,
        t,
        isLoading,
        supportedLanguages: SUPPORTED_LANGUAGES
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}
