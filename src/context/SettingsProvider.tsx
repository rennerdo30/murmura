'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SettingsContextValue, ContextProviderProps, Settings } from '@/types/context';
import { SETTINGS_STORAGE_KEY } from '@/constants';

const SettingsContext = createContext<SettingsContextValue | null>(null);

const DEFAULT_SETTINGS: Settings = {
    globalTheme: 'auto',
    languageThemes: {},
    customColors: {},
    soundEnabled: true,
    ttsEnabled: true,
    ttsRate: 0.9,
    ttsVolume: 0.5,
    timerEnabled: true,
    timerDuration: 5
};

const SETTINGS_KEY = SETTINGS_STORAGE_KEY;

export function SettingsProvider({ children }: ContextProviderProps) {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [loaded, setLoaded] = useState(false);

    // Load settings on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(SETTINGS_KEY);
            if (saved) {
                try {
                    setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
                } catch (e) {
                    console.error('Error loading settings:', e);
                }
            }
            setLoaded(true);
        }
    }, []);

    const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        if (typeof window !== 'undefined') {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
        }
    };

    const value: SettingsContextValue = {
        settings,
        updateSetting,
        loaded
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
}
