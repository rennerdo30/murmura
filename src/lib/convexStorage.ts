'use client';

// Convex-based storage adapter
// Replaces localStorage with Convex backend
// Uses authenticated userId from Convex Auth

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { StorageData, ModuleData, createDefaultStorageData } from './storage';
import { ReviewData, GlobalStats, ModuleStats } from '@/types';

// Valid module names matching Convex validator
type ModuleName = 'alphabet' | 'vocabulary' | 'kanji' | 'grammar' | 'reading' | 'listening';

const VALID_MODULE_NAMES: ReadonlySet<string> = new Set([
    'alphabet', 'vocabulary', 'kanji', 'grammar', 'reading', 'listening'
]);

function isValidModuleName(name: string): name is ModuleName {
    return VALID_MODULE_NAMES.has(name);
}

// Valid setting keys matching Convex validator
type SettingKey = 'theme' | 'soundEnabled' | 'ttsEnabled' | 'ttsRate' | 'ttsVolume' | 'timerEnabled' | 'timerDuration' | 'leaderboardVisible';

// Settings data structure matching Convex schema
interface SettingsData {
    theme: string;
    soundEnabled: boolean;
    ttsEnabled: boolean;
    ttsRate: number;
    ttsVolume: number;
    timerEnabled: boolean;
    timerDuration: number;
    leaderboardVisible?: boolean;
    kokoroVoice?: string;
    kokoroVoices?: {
        ja?: string;
        zh?: string;
        es?: string;
        fr?: string;
        hi?: string;
        it?: string;
        pt?: string;
        en?: string;
    };
}

// Convex user data structure (what comes back from the API)
interface ConvexUserData {
    _id: string;
    userId: string;
    modules: Record<string, ModuleData>;
    globalStats: GlobalStats;
}

// Type guard for Convex user data
function isConvexUserData(data: unknown): data is ConvexUserData {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return (
        typeof obj._id === 'string' &&
        typeof obj.userId === 'string' &&
        typeof obj.modules === 'object' &&
        obj.modules !== null &&
        typeof obj.globalStats === 'object' &&
        obj.globalStats !== null
    );
}

// Type guard for module stats
function isValidModuleStats(stats: unknown): stats is ModuleStats {
    if (!stats || typeof stats !== 'object') return false;
    const obj = stats as Record<string, unknown>;
    // At minimum, stats should have numeric values for known fields
    return (
        (obj.correct === undefined || typeof obj.correct === 'number') &&
        (obj.total === undefined || typeof obj.total === 'number') &&
        (obj.streak === undefined || typeof obj.streak === 'number')
    );
}

// Type guard for global stats
function isValidGlobalStats(stats: unknown): stats is GlobalStats {
    if (!stats || typeof stats !== 'object') return false;
    const obj = stats as Record<string, unknown>;
    return (
        typeof obj.streak === 'number' &&
        typeof obj.bestStreak === 'number' &&
        typeof obj.totalStudyTime === 'number' &&
        (obj.lastActive === null || typeof obj.lastActive === 'number') &&
        typeof obj.createdAt === 'number'
    );
}

// Default data structure
function getDefaultData(): StorageData {
    return createDefaultStorageData(null);
}

interface ConvexHooks {
    data: StorageData | null;
    isLoading: boolean;
    saveUserData: (data: StorageData) => Promise<void>;
    updateModule: (moduleName: string, moduleData: Partial<ModuleData>) => Promise<void>;
    updateGlobalStats: (stats: Partial<GlobalStats>) => Promise<void>;
}

// Hook to get user data from Convex
export function useConvexUserData() {
    const currentUser = useQuery(api.auth.getCurrentUser);
    
    // Only fetch data if user is authenticated
    const userData = useQuery(
        api.userData.getUserData,
        currentUser ? {} : "skip"
    );
    
    const saveUserData = useMutation(api.userData.saveUserData);
    const updateModule = useMutation(api.userData.updateModule);
    const updateGlobalStats = useMutation(api.userData.updateGlobalStats);
    
    // Return default data if not authenticated
    if (!currentUser) {
        return {
            data: getDefaultData(),
            isLoading: currentUser === undefined,
            isAuthenticated: false,
            saveUserData: async () => { throw new Error("Not authenticated"); },
            updateModule: async () => { throw new Error("Not authenticated"); },
            updateGlobalStats: async () => { throw new Error("Not authenticated"); },
        };
    }
    
    // Transform Convex userData to our StorageData type with proper validation
    let transformedData: StorageData | null = null;

    if (userData && isConvexUserData(userData)) {
        const defaultData = getDefaultData();
        const validGlobalStats = isValidGlobalStats(userData.globalStats)
            ? userData.globalStats
            : defaultData.globalStats;

        transformedData = {
            userId: null,
            modules: userData.modules || defaultData.modules,
            globalStats: validGlobalStats,
        };
    }

    return {
        data: transformedData || getDefaultData(),
        isLoading: userData === undefined || currentUser === undefined,
        isAuthenticated: true,
        saveUserData: async (data: StorageData) => {
            // Validate data before sending to Convex
            if (!data.modules || !data.globalStats) {
                throw new Error('Invalid data structure: missing modules or globalStats');
            }
            if (!isValidGlobalStats(data.globalStats)) {
                throw new Error('Invalid globalStats structure');
            }
            // Convex expects a specific module structure - create a compatible payload
            // The Convex schema validator will handle the actual validation
            await saveUserData({
                data: {
                    modules: data.modules as typeof data.modules,
                    globalStats: data.globalStats,
                }
            } as Parameters<typeof saveUserData>[0]);
        },
        updateModule: async (moduleName: string, moduleData: Partial<ModuleData>) => {
            if (!isValidModuleName(moduleName)) {
                throw new Error(`Invalid module name: ${moduleName}`);
            }
            await updateModule({ moduleName, moduleData });
        },
        updateGlobalStats: async (stats: Partial<GlobalStats>) => {
            await updateGlobalStats({ stats });
        },
    };
}

// Hook to get settings from Convex
export function useConvexSettings() {
    const currentUser = useQuery(api.auth.getCurrentUser);
    
    // Only fetch settings if user is authenticated
    const settings = useQuery(
        api.settings.getSettings,
        currentUser ? {} : "skip"
    );
    
    const saveSettings = useMutation(api.settings.saveSettings);
    const updateSetting = useMutation(api.settings.updateSetting);
    
    if (!currentUser) {
        return {
            settings: null,
            isLoading: currentUser === undefined,
            isAuthenticated: false,
            saveSettings: async () => { throw new Error("Not authenticated"); },
            updateSetting: async () => { throw new Error("Not authenticated"); },
        };
    }
    
    return {
        settings: settings || null,
        isLoading: settings === undefined || currentUser === undefined,
        isAuthenticated: true,
        saveSettings: async (settingsData: SettingsData) => {
            await saveSettings({ settings: settingsData });
        },
        updateSetting: async (key: SettingKey, value: string | boolean | number) => {
            await updateSetting({ key, value });
        },
    };
}

// Storage adapter that matches the existing localStorage API
export function createConvexStorageAdapter(convexHooks: ConvexHooks) {
    const { data, isLoading, saveUserData, updateModule, updateGlobalStats } = convexHooks;
    
    return {
        getAllData: () => data || getDefaultData(),
        saveAllData: async (newData: StorageData) => {
            await saveUserData(newData);
        },
        getModuleData: (moduleName: string) => {
            const allData = data || getDefaultData();
            if (!allData.modules[moduleName]) {
                allData.modules[moduleName] = getDefaultData().modules[moduleName] || {
                    learned: [],
                    reviews: {},
                    stats: {
                        correct: 0,
                        total: 0,
                        streak: 0
                    }
                };
            }
            return allData.modules[moduleName];
        },
        saveModuleData: async (moduleName: string, moduleData: Partial<ModuleData>) => {
            await updateModule(moduleName, moduleData);
        },
        getGlobalStats: () => {
            const allData = data || getDefaultData();
            return allData.globalStats;
        },
        updateGlobalStats: async (updates: Partial<GlobalStats>) => {
            await updateGlobalStats(updates);
        },
        updateModuleStats: async (moduleName: ModuleName, statUpdates: Record<string, unknown>) => {
            const moduleData = { ...(data?.modules[moduleName] || getDefaultData().modules[moduleName]) };
            moduleData.stats = { ...moduleData.stats, ...statUpdates };
            await updateModule(moduleName, moduleData);
        },
        markLearned: async (moduleName: ModuleName, itemId: string) => {
            const moduleData = { ...(data?.modules[moduleName] || getDefaultData().modules[moduleName]) };
            const learned = moduleData.learned || [];
            if (!learned.includes(itemId)) {
                moduleData.learned = [...learned, itemId];
                await updateModule(moduleName, moduleData);
            }
        },
        isLearned: (moduleName: ModuleName, itemId: string) => {
            const moduleData = data?.modules[moduleName] || getDefaultData().modules[moduleName];
            const learned = moduleData.learned || [];
            return learned.includes(itemId);
        },
        getReviewData: (moduleName: ModuleName, itemId: string) => {
            const moduleData = data?.modules[moduleName] || getDefaultData().modules[moduleName];
            const reviews = moduleData.reviews || {};
            return reviews[itemId] || null;
        },
        saveReviewData: async (moduleName: ModuleName, itemId: string, reviewData: ReviewData) => {
            const moduleData = { ...(data?.modules[moduleName] || getDefaultData().modules[moduleName]) };
            const reviews = { ...(moduleData.reviews || {}) };
            reviews[itemId] = reviewData;
            moduleData.reviews = reviews;
            await updateModule(moduleName, moduleData);
        },
        clearAllData: async () => {
            // Reset to default data
            await saveUserData(getDefaultData());
        },
    };
}
