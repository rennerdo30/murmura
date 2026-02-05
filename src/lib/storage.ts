// localStorage wrapper for progress tracking
// Designed for easy migration to backend API

import { ModuleData, ModuleStats, GlobalStats, StorageData as TypesStorageData, ReviewData } from '@/types';

// Re-export for use by other modules
export type { ModuleData, ModuleStats, GlobalStats, ReviewData };

// Use the StorageData type from types but ensure compatibility
export type StorageData = TypesStorageData & {
    userId: string | null;
};

const STORAGE_KEY = 'murmura_data';
const USER_ID_KEY = 'murmura_user_id';

// Migrate old data formats to new Murmura keys
function migrateOldData(): void {
    if (typeof window === 'undefined') return;

    // Migrate from old japanese_trainer keys
    const oldData = localStorage.getItem('japanese_trainer_data');
    if (oldData && !localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, oldData);
        localStorage.removeItem('japanese_trainer_data');
    }

    const oldUserId = localStorage.getItem('japanese_trainer_user_id');
    if (oldUserId && !localStorage.getItem(USER_ID_KEY)) {
        localStorage.setItem(USER_ID_KEY, oldUserId);
        localStorage.removeItem('japanese_trainer_user_id');
    }

    // Also migrate from old profile-based keys (legacy format)
    const oldProfileKey = localStorage.getItem('japanese_trainer_current_profile');
    if (oldProfileKey) {
        const oldProfileDataKey = `japanese_trainer_data_${oldProfileKey}`;
        const oldProfileUserIdKey = `japanese_trainer_user_id_${oldProfileKey}`;

        const profileData = localStorage.getItem(oldProfileDataKey);
        if (profileData && !localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, profileData);
        }

        const profileUserId = localStorage.getItem(oldProfileUserIdKey);
        if (profileUserId && !localStorage.getItem(USER_ID_KEY)) {
            localStorage.setItem(USER_ID_KEY, profileUserId);
        }

        // Clean up old keys
        localStorage.removeItem(oldProfileDataKey);
        localStorage.removeItem(oldProfileUserIdKey);
        localStorage.removeItem('japanese_trainer_current_profile');
    }
}

// Generate or retrieve user ID
export function getUserId(): string {
    if (typeof window === 'undefined') return 'server-user';
    
    // Migrate old data on first access
    migrateOldData();
    
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
        userId = 'local-user-' + Date.now();
        localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
}

// Create default data structure (shared between localStorage and Convex)
export function createDefaultStorageData(userId: string | null): StorageData {
    return {
        userId,
        modules: {
            alphabet: {
                learned: [],
                reviews: {},
                stats: {
                    correct: 0,
                    total: 0,
                    streak: 0,
                    bestStreak: 0
                }
            },
            vocabulary: {
                learned: [],
                reviews: {},
                stats: {
                    correct: 0,
                    total: 0,
                    streak: 0,
                    bestStreak: 0,
                    wordsMastered: 0
                }
            },
            kanji: {
                learned: [],
                reviews: {},
                stats: {
                    correct: 0,
                    total: 0,
                    streak: 0,
                    bestStreak: 0,
                    kanjiMastered: 0
                }
            },
            grammar: {
                learned: [],
                reviews: {},
                stats: {
                    correct: 0,
                    total: 0,
                    streak: 0,
                    bestStreak: 0,
                    pointsMastered: 0
                }
            },
            reading: {
                stats: {
                    correct: 0,
                    total: 0,
                    streak: 0,
                    textsRead: 0,
                    comprehensionScore: 0,
                    totalAttempts: 0,
                    comprehensionTotal: 0,
                    comprehensionCorrect: 0
                },
                completed: []
            },
            listening: {
                stats: {
                    correct: 0,
                    total: 0,
                    streak: 0,
                    exercisesCompleted: 0,
                    accuracy: 0
                },
                completed: []
            }
        },
        globalStats: {
            streak: 0,
            bestStreak: 0,
            totalStudyTime: 0,
            lastActive: null,
            createdAt: Date.now()
        }
    };
}

// Get default data structure for localStorage
function getDefaultData(): StorageData {
    return createDefaultStorageData(getUserId());
}

// Get all stored data
export function getAllData(): StorageData {
    if (typeof window === 'undefined') return getDefaultData();

    // Migrate old data on first access
    migrateOldData();

    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : getDefaultData();
    } catch (e) {
        console.error('Error reading storage (corrupted data will be cleared):', e);
        // Clear corrupted data to prevent repeated failures
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore removal errors
        }
        return getDefaultData();
    }
}

// Save all data
export function saveAllData(data: StorageData): boolean {
    if (typeof window === 'undefined') return false;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Error saving storage:', e);
        return false;
    }
}

// Get module data
export function getModuleData(moduleName: string): ModuleData {
    const data = getAllData();
    if (!data.modules[moduleName]) {
        const defaultData = getDefaultData();
        data.modules[moduleName] = defaultData.modules[moduleName] || {
            learned: [],
            reviews: {},
            stats: {
                correct: 0,
                total: 0,
                streak: 0
            }
        };
        saveAllData(data);
    }
    return data.modules[moduleName];
}

// Save module data
export function saveModuleData(moduleName: string, moduleData: ModuleData): boolean {
    const data = getAllData();
    data.modules[moduleName] = moduleData;
    return saveAllData(data);
}

// Get global stats
export function getGlobalStats(): StorageData['globalStats'] {
    const data = getAllData();
    return data.globalStats;
}

// Update global stats
export function updateGlobalStats(updates: Partial<StorageData['globalStats']>): boolean {
    const data = getAllData();
    data.globalStats = { ...data.globalStats, ...updates };
    data.globalStats.lastActive = Date.now();
    return saveAllData(data);
}

// Update module stats
export function updateModuleStats(moduleName: string, statUpdates: Partial<ModuleStats>): boolean {
    const moduleData = getModuleData(moduleName);
    moduleData.stats = { ...moduleData.stats, ...statUpdates };
    return saveModuleData(moduleName, moduleData);
}

// Mark item as learned
export function markLearned(moduleName: string, itemId: string): boolean {
    const moduleData = getModuleData(moduleName);
    const learned = moduleData.learned || [];
    if (!learned.includes(itemId)) {
        moduleData.learned = [...learned, itemId];
        return saveModuleData(moduleName, moduleData);
    }
    return true;
}

// Check if item is learned
export function isLearned(moduleName: string, itemId: string): boolean {
    const moduleData = getModuleData(moduleName);
    const learned = moduleData.learned || [];
    return learned.includes(itemId);
}

// Get review data for an item
export function getReviewData(moduleName: string, itemId: string): ReviewData | null {
    const moduleData = getModuleData(moduleName);
    const reviews = moduleData.reviews || {};
    return reviews[itemId] || null;
}

// Save review data for an item
export function saveReviewData(moduleName: string, itemId: string, reviewData: ReviewData): boolean {
    const moduleData = getModuleData(moduleName);
    const reviews = { ...(moduleData.reviews || {}) };
    reviews[itemId] = reviewData;
    moduleData.reviews = reviews;
    return saveModuleData(moduleName, moduleData);
}

// Clear all data (for testing/reset)
export function clearAllData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_ID_KEY);
}
