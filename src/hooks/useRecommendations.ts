'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProgressContext } from '@/context/ProgressProvider';
import { useStorage } from './useStorage';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import {
  loadLearningPathsData,
  LearningPathsData,
} from '@/lib/dataLoader';
import {
  Recommendation,
  PathProgress,
  AdaptivePathRecommendation,
  LearningStats,
  getRecommendations,
  getNextRecommendedAction,
  getAllPathsWithProgress,
  generateAdaptiveRecommendations,
  calculateLearningStats,
  getLinearPathProgress,
  getLinearPathIdForLanguage,
  getTopicTrackProgress,
  getStreakInfo,
  setDynamicPathsData,
  hasPathsData,
} from '@/lib/recommendations';
import {
  getReviewQueue,
  ReviewQueue,
  SRSSettings,
  DEFAULT_SRS_SETTINGS,
} from '@/lib/reviewQueue';
import type { UserProgress, ModuleName } from '@/lib/prerequisites';

interface UseRecommendationsReturn {
  // Recommendations
  recommendations: Recommendation[];
  topRecommendation: Recommendation | null;
  isLoading: boolean;

  // Learning stats
  stats: LearningStats | null;
  reviewQueue: ReviewQueue | null;

  // Path progress
  paths: Array<PathProgress & { description: string; descriptionTranslations?: Record<string, string>; difficulty: string; tags?: string[] }>;
  jlptProgress: PathProgress | null;
  hasPathsData: boolean;

  // Adaptive recommendations
  adaptiveRecommendations: AdaptivePathRecommendation | null;

  // Streak info
  streakInfo: {
    isActive: boolean;
    daysRemaining: number;
    message: string;
  } | null;

  // Actions
  refresh: () => void;
  getPathProgress: (pathId: string) => PathProgress | null;
}

const SRS_SETTINGS_KEY = 'murmura_srs_settings';

export function useRecommendations(): UseRecommendationsReturn {
  const { summary, getModuleData } = useProgressContext();
  const { data: storageData, isLoading: storageLoading } = useStorage();
  const { isModuleEnabled, targetLanguage } = useTargetLanguage();

  // Get list of enabled modules for current language
  const enabledModules = useMemo(() => {
    const allModules: ModuleName[] = ['alphabet', 'vocabulary', 'kanji', 'grammar', 'reading', 'listening'];
    return allModules.filter(mod => isModuleEnabled(mod));
  }, [isModuleEnabled]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  // Language whose learning-paths.json has been loaded (paths live in a module-level store)
  const [dynamicPathsLanguage, setDynamicPathsLanguage] = useState<string | null>(null);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueue | null>(null);
  const [paths, setPaths] = useState<Array<PathProgress & { description: string; descriptionTranslations?: Record<string, string>; difficulty: string; tags?: string[] }>>([]);
  const [jlptProgress, setJlptProgress] = useState<PathProgress | null>(null);
  const [adaptiveRecommendations, setAdaptiveRecommendations] = useState<AdaptivePathRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load SRS settings
  const srsSettings = useMemo((): SRSSettings => {
    if (typeof window === 'undefined') return DEFAULT_SRS_SETTINGS;

    try {
      const stored = localStorage.getItem(SRS_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SRS_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore errors
    }
    return DEFAULT_SRS_SETTINGS;
  }, []);

  // Build user progress object from storage data (filtered by enabled modules)
  const buildUserProgress = useCallback((): UserProgress => {
    const userProgress: UserProgress = { modules: {} };

    for (const module of enabledModules) {
      const moduleData = getModuleData(module);
      if (moduleData) {
        userProgress.modules[module] = {
          learned: moduleData.learned || [],
          reviews: moduleData.reviews || {},
          stats: moduleData.stats,
        };
      }
    }

    return userProgress;
  }, [getModuleData, enabledModules]);

  // Calculate all recommendations and stats
  const calculateRecommendations = useCallback(() => {
    setIsLoading(true);

    try {
      const userProgress = buildUserProgress();

      // Build module data for review queue
      const moduleData = {
        vocabulary: userProgress.modules.vocabulary,
        kanji: userProgress.modules.kanji,
        grammar: userProgress.modules.grammar,
      };

      // Get review queue
      const queue = getReviewQueue(moduleData, srsSettings);
      setReviewQueue(queue);

      // Calculate learning stats (only for enabled modules)
      const learningStats = calculateLearningStats(userProgress, queue, enabledModules);
      setStats(learningStats);

      // Get recommendations (filtered by target language)
      const recs = getRecommendations(userProgress, queue, srsSettings, 5, targetLanguage);
      setRecommendations(recs);

      // Get all paths with progress (filtered by target language)
      const allPaths = getAllPathsWithProgress(userProgress, targetLanguage);
      setPaths(allPaths);

      // Get linear path progress for the current language
      const linearPathId = getLinearPathIdForLanguage(targetLanguage);
      const linearProgress = linearPathId ? getLinearPathProgress(linearPathId, userProgress) : null;
      setJlptProgress(linearProgress);

      // Generate adaptive recommendations (filtered by target language)
      const adaptive = generateAdaptiveRecommendations(userProgress, queue, srsSettings, targetLanguage, enabledModules);
      setAdaptiveRecommendations(adaptive);

    } catch (error) {
      console.error('Failed to calculate recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [buildUserProgress, srsSettings, enabledModules]);

  // Load dynamic paths data for the current language
  useEffect(() => {
    async function loadDynamicPaths() {
      if (!targetLanguage) return;

      try {
        const dynamicPaths = await loadLearningPathsData(targetLanguage);
        // Replace (or clear) the previous language's paths so they don't leak across languages
        setDynamicPathsData(dynamicPaths);
      } catch (error) {
        console.log('Using static learning paths (no dynamic data)');
        setDynamicPathsData(null);
      }
      // Paths arrive after the first calculation; trigger a recalculation
      setDynamicPathsLanguage(targetLanguage);
    }

    loadDynamicPaths();
  }, [targetLanguage]);

  // Initial calculation
  useEffect(() => {
    if (!storageLoading) {
      calculateRecommendations();
    }
  }, [storageLoading, calculateRecommendations]);

  // Recalculate when summary changes
  useEffect(() => {
    if (summary && !storageLoading) {
      calculateRecommendations();
    }
  }, [summary, storageLoading, calculateRecommendations]);

  // Recalculate when target language changes
  useEffect(() => {
    if (!storageLoading) {
      calculateRecommendations();
    }
  }, [targetLanguage, dynamicPathsLanguage, storageLoading, calculateRecommendations]);

  // Get top recommendation
  const topRecommendation = useMemo(() => {
    return recommendations[0] || null;
  }, [recommendations]);

  // Get streak info
  const streakInfo = useMemo(() => {
    if (!summary) return null;
    return getStreakInfo(
      summary.totalStudyTime > 0 ? Date.now() : null,
      summary.streak
    );
  }, [summary]);

  // Get progress for a specific path
  const getPathProgress = useCallback((pathId: string): PathProgress | null => {
    const userProgress = buildUserProgress();

    // Check if it's a linear or topic path
    const foundPath = paths.find(p => p.pathId === pathId);
    if (foundPath) {
      return foundPath;
    }

    // Try to get fresh progress
    const linearProgress = getLinearPathProgress(pathId, userProgress);
    if (linearProgress) return linearProgress;

    const topicProgress = getTopicTrackProgress(pathId, userProgress);
    return topicProgress;
  }, [buildUserProgress, paths]);

  return {
    recommendations,
    topRecommendation,
    isLoading: isLoading || storageLoading,
    stats,
    reviewQueue,
    paths,
    jlptProgress,
    hasPathsData: hasPathsData(),
    adaptiveRecommendations,
    streakInfo,
    refresh: calculateRecommendations,
    getPathProgress,
  };
}

export default useRecommendations;
