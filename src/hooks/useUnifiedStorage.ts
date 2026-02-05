'use client';

/**
 * Unified Storage Hook
 *
 * Provides a single interface for user data storage that:
 * - Uses Convex when authenticated
 * - Falls back to localStorage when not authenticated
 * - Syncs localStorage data to Convex when user logs in
 */

import { useCallback, useEffect, useRef } from 'react';
import { useConvexUserData } from '@/lib/convexStorage';
import * as localStorageModule from '@/lib/storage';
import { StorageData, ModuleData, GlobalStats, ReviewData, createDefaultStorageData } from '@/lib/storage';

type ModuleName = 'alphabet' | 'vocabulary' | 'kanji' | 'grammar' | 'reading' | 'listening';

interface UnifiedStorageReturn {
  // Data
  data: StorageData;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Module operations
  getModuleData: (moduleName: string) => ModuleData;
  updateModuleStats: (moduleName: string, stats: Record<string, unknown>) => Promise<void> | void;
  markLearned: (moduleName: string, itemId: string) => Promise<void> | void;
  isLearned: (moduleName: string, itemId: string) => boolean;

  // Review operations
  getReviewData: (moduleName: string, itemId: string) => ReviewData | null;
  saveReviewData: (moduleName: string, itemId: string, reviewData: ReviewData) => Promise<void> | void;

  // Global stats
  getGlobalStats: () => GlobalStats;
  updateGlobalStats: (updates: Partial<GlobalStats>) => Promise<void> | void;

  // Full data operations
  saveAllData: (data: StorageData) => Promise<void> | void;
  clearAllData: () => Promise<void> | void;
}

export function useUnifiedStorage(): UnifiedStorageReturn {
  const convexData = useConvexUserData();
  const hasSyncedRef = useRef(false);

  // Sync localStorage to Convex when user logs in
  useEffect(() => {
    if (convexData.isAuthenticated && !convexData.isLoading && !hasSyncedRef.current) {
      hasSyncedRef.current = true;

      // Check if localStorage has data that should be synced
      const localData = localStorageModule.getAllData();
      const hasLocalData =
        localData.modules &&
        Object.values(localData.modules).some(
          (m) => (m.learned && m.learned.length > 0) || (m.completed && m.completed.length > 0)
        );

      // Check if Convex is empty (new user)
      const convexIsEmpty =
        !convexData.data.modules ||
        Object.values(convexData.data.modules).every(
          (m) => (!m.learned || m.learned.length === 0) && (!m.completed || m.completed.length === 0)
        );

      // Sync localStorage to Convex if local has data and Convex is empty
      if (hasLocalData && convexIsEmpty) {
        convexData.saveUserData(localData).catch((error) => {
          console.error('Failed to sync localStorage to Convex:', error);
        });
      }
    }
  }, [convexData.isAuthenticated, convexData.isLoading, convexData.data, convexData.saveUserData]);

  // Get module data
  const getModuleData = useCallback(
    (moduleName: string): ModuleData => {
      if (convexData.isAuthenticated) {
        const modules = convexData.data?.modules || {};
        return (
          modules[moduleName] || {
            learned: [],
            reviews: {},
            stats: { correct: 0, total: 0, streak: 0 },
          }
        );
      }
      return localStorageModule.getModuleData(moduleName);
    },
    [convexData.isAuthenticated, convexData.data]
  );

  // Update module stats
  const updateModuleStats = useCallback(
    async (moduleName: string, stats: Record<string, unknown>) => {
      if (convexData.isAuthenticated) {
        const currentModule = getModuleData(moduleName);
        await convexData.updateModule(moduleName as ModuleName, {
          ...currentModule,
          stats: { ...currentModule.stats, ...stats },
        });
      } else {
        localStorageModule.updateModuleStats(moduleName, stats);
      }
    },
    [convexData.isAuthenticated, convexData.updateModule, getModuleData]
  );

  // Mark item as learned
  const markLearned = useCallback(
    async (moduleName: string, itemId: string) => {
      if (convexData.isAuthenticated) {
        const currentModule = getModuleData(moduleName);
        const learned = currentModule.learned || [];
        if (!learned.includes(itemId)) {
          await convexData.updateModule(moduleName as ModuleName, {
            ...currentModule,
            learned: [...learned, itemId],
          });
        }
      } else {
        localStorageModule.markLearned(moduleName, itemId);
      }
    },
    [convexData.isAuthenticated, convexData.updateModule, getModuleData]
  );

  // Check if item is learned
  const isLearned = useCallback(
    (moduleName: string, itemId: string): boolean => {
      if (convexData.isAuthenticated) {
        const module = getModuleData(moduleName);
        return (module.learned || []).includes(itemId);
      }
      return localStorageModule.isLearned(moduleName, itemId);
    },
    [convexData.isAuthenticated, getModuleData]
  );

  // Get review data
  const getReviewData = useCallback(
    (moduleName: string, itemId: string): ReviewData | null => {
      if (convexData.isAuthenticated) {
        const module = getModuleData(moduleName);
        return (module.reviews || {})[itemId] || null;
      }
      return localStorageModule.getReviewData(moduleName, itemId);
    },
    [convexData.isAuthenticated, getModuleData]
  );

  // Save review data
  const saveReviewData = useCallback(
    async (moduleName: string, itemId: string, reviewData: ReviewData) => {
      if (convexData.isAuthenticated) {
        const currentModule = getModuleData(moduleName);
        const reviews = { ...(currentModule.reviews || {}) };
        reviews[itemId] = reviewData;
        await convexData.updateModule(moduleName as ModuleName, {
          ...currentModule,
          reviews,
        });
      } else {
        localStorageModule.saveReviewData(moduleName, itemId, reviewData);
      }
    },
    [convexData.isAuthenticated, convexData.updateModule, getModuleData]
  );

  // Get global stats
  const getGlobalStats = useCallback((): GlobalStats => {
    if (convexData.isAuthenticated) {
      return (
        convexData.data?.globalStats || {
          streak: 0,
          bestStreak: 0,
          totalStudyTime: 0,
          lastActive: null,
          createdAt: Date.now(),
        }
      );
    }
    return localStorageModule.getGlobalStats();
  }, [convexData.isAuthenticated, convexData.data]);

  // Update global stats
  const updateGlobalStats = useCallback(
    async (updates: Partial<GlobalStats>) => {
      if (convexData.isAuthenticated) {
        await convexData.updateGlobalStats(updates);
      } else {
        localStorageModule.updateGlobalStats(updates);
      }
    },
    [convexData.isAuthenticated, convexData.updateGlobalStats]
  );

  // Save all data
  const saveAllData = useCallback(
    async (data: StorageData) => {
      if (convexData.isAuthenticated) {
        await convexData.saveUserData(data);
      } else {
        localStorageModule.saveAllData(data);
      }
    },
    [convexData.isAuthenticated, convexData.saveUserData]
  );

  // Clear all data
  const clearAllData = useCallback(async () => {
    if (convexData.isAuthenticated) {
      await convexData.saveUserData(createDefaultStorageData(null));
    } else {
      localStorageModule.clearAllData();
    }
  }, [convexData.isAuthenticated, convexData.saveUserData]);

  return {
    data: convexData.isAuthenticated ? convexData.data : localStorageModule.getAllData(),
    isLoading: convexData.isLoading,
    isAuthenticated: convexData.isAuthenticated,
    getModuleData,
    updateModuleStats,
    markLearned,
    isLearned,
    getReviewData,
    saveReviewData,
    getGlobalStats,
    updateGlobalStats,
    saveAllData,
    clearAllData,
  };
}
