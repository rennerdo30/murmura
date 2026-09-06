// Context type definitions

import { ReactNode } from 'react';
import { ModuleData, ModuleStats, ReviewData, StorageData } from './index';

export interface LanguageContextValue {
    language: string;
    changeLanguage: (langCode: string) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    isLoading: boolean;
    supportedLanguages: Array<{
        code: string;
        name: string;
        flag: string;
    }>;
}

export type ThemeOverride = 'auto' | 'light' | 'ja' | 'es' | 'de' | 'en' | 'it' | 'ko' | 'zh' | 'fr';

export interface Settings {
    globalTheme: ThemeOverride;
    languageThemes: Record<string, ThemeOverride>;
    customColors: {
        bgPrimary?: string;
        bgSecondary?: string;
        textPrimary?: string;
        accentPrimary?: string;
        accentGold?: string;
    };
    soundEnabled: boolean;
    ttsEnabled: boolean;
    ttsRate: number;
    ttsVolume: number;
    timerEnabled: boolean;
    timerDuration: number;
}

export interface SettingsContextValue {
    settings: Settings;
    updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
    loaded: boolean;
}

export interface ProgressSummary {
    totalWords: number;
    totalKanji: number;
    totalGrammar: number;
    textsRead: number;
    listeningExercises: number;
    streak: number;
    bestStreak: number;
    totalStudyTime: number;
}

export interface ProgressContextValue {
    summary: ProgressSummary | null;
    isLoading: boolean;
    initialized: boolean;
    refresh: () => void;
    updateStreak: () => number;
    getModuleProgress: (moduleName: string, totalItems: number) => number;
    recordStudyTime: (seconds: number) => void;
    getItemsDueForReview: (moduleName: string) => Array<{ itemId: string; reviewData: ReviewData }>;
    getMasteryLevel: (moduleName: string, itemId: string) => string;
    getModuleData: (moduleName: string) => ModuleData;
    updateModuleStats: (moduleName: string, stats: Partial<ModuleStats>) => void;
    updateData: (data: Partial<StorageData>) => void;
    updateModuleReview: (moduleName: string, itemId: string, reviewData: ReviewData) => void;
}

export interface ContextProviderProps {
    children: ReactNode;
}
