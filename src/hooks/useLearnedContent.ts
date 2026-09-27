'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useTargetLanguage } from './useTargetLanguage';

export type ContentType = 'vocabulary' | 'grammar' | 'character' | 'reading' | 'listening';

export interface LearnedContentItem {
  contentId: string;
  contentType: ContentType;
  languageCode: string;
  fromLessonId: string;
  learnedAt: number;
  nextReviewAt: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
  preview: {
    front: string;
    back: string;
    reading?: string;
    audioUrl?: string;
  };
}

export interface ContentPreview {
  front: string;
  back: string;
  reading?: string;
  audioUrl?: string;
}

// Local storage key for offline learned content
const STORAGE_KEY = 'murmura_learned_content';

interface LocalLearnedStore {
  [contentId: string]: LearnedContentItem;
}

function getLocalLearned(): LocalLearnedStore {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveLocalLearned(content: LocalLearnedStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  } catch {
    // Storage full or not available
  }
}

export function useLearnedContent() {
  const { targetLanguage } = useTargetLanguage();
  const [localLearned, setLocalLearned] = useState<LocalLearnedStore>({});
  const [isReady, setIsReady] = useState(false);

  // Convex queries and mutations
  const convexLearned = useQuery(api.learnedContent.getLearnedContent, {
    languageCode: targetLanguage,
  });
  const learnedStats = useQuery(api.learnedContent.getLearnedStats, {
    languageCode: targetLanguage,
  });

  const addLearnedMutation = useMutation(api.learnedContent.addLearnedContent);
  const addBatchMutation = useMutation(api.learnedContent.addLearnedContentBatch);
  const recordReviewMutation = useMutation(api.learnedContent.recordReview);

  // Load local learned content on mount
  useEffect(() => {
    const stored = getLocalLearned();
    setLocalLearned(stored);
    setIsReady(true);
  }, []);

  // Get all learned content (merged local + Convex)
  const getAllLearned = useCallback((): LearnedContentItem[] => {
    const items: LearnedContentItem[] = [];
    const seen = new Set<string>();

    // Add Convex items first (they take precedence)
    if (convexLearned) {
      convexLearned.forEach((item) => {
        if (item.languageCode === targetLanguage) {
          items.push({
            contentId: item.contentId,
            contentType: item.contentType as ContentType,
            languageCode: item.languageCode,
            fromLessonId: item.fromLessonId,
            learnedAt: item.learnedAt,
            nextReviewAt: item.nextReviewAt,
            easeFactor: item.easeFactor,
            interval: item.interval,
            repetitions: item.repetitions,
            preview: item.preview,
          });
          seen.add(item.contentId);
        }
      });
    }

    // Add local items not in Convex
    Object.values(localLearned).forEach((item) => {
      if (item.languageCode === targetLanguage && !seen.has(item.contentId)) {
        items.push(item);
      }
    });

    return items;
  }, [convexLearned, localLearned, targetLanguage]);

  // Check if content is learned
  const isContentLearned = useCallback((contentId: string): boolean => {
    if (localLearned[contentId]) return true;
    if (convexLearned?.some((c) => c.contentId === contentId)) return true;
    return false;
  }, [localLearned, convexLearned]);

  // Get learned content by type
  const getLearnedByType = useCallback((contentType: ContentType): LearnedContentItem[] => {
    return getAllLearned().filter((item) => item.contentType === contentType);
  }, [getAllLearned]);

  // Add learned content from a completed lesson
  const addLearned = useCallback(async (
    contentType: ContentType,
    contentId: string,
    fromLessonId: string,
    preview: ContentPreview
  ) => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const newItem: LearnedContentItem = {
      contentId,
      contentType,
      languageCode: targetLanguage,
      fromLessonId,
      learnedAt: now,
      nextReviewAt: now + oneDayMs,
      easeFactor: 2.5,
      interval: 1,
      repetitions: 0,
      preview,
    };

    // Update local immediately
    setLocalLearned((prev) => {
      if (prev[contentId]) return prev; // Already learned
      const updated = { ...prev, [contentId]: newItem };
      saveLocalLearned(updated);
      return updated;
    });

    // Sync to Convex
    try {
      await addLearnedMutation({
        contentType,
        contentId,
        languageCode: targetLanguage,
        fromLessonId,
        preview,
      });
    } catch {
      // Offline or not authenticated
    }
  }, [targetLanguage, addLearnedMutation]);

  // Add multiple items at once (from lesson completion)
  const addLearnedBatch = useCallback(async (
    items: Array<{
      contentType: ContentType;
      contentId: string;
      fromLessonId: string;
      preview: ContentPreview;
    }>
  ) => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Update local immediately
    setLocalLearned((prev) => {
      const updated = { ...prev };
      items.forEach((item) => {
        if (!updated[item.contentId]) {
          updated[item.contentId] = {
            contentId: item.contentId,
            contentType: item.contentType,
            languageCode: targetLanguage,
            fromLessonId: item.fromLessonId,
            learnedAt: now,
            nextReviewAt: now + oneDayMs,
            easeFactor: 2.5,
            interval: 1,
            repetitions: 0,
            preview: item.preview,
          };
        }
      });
      saveLocalLearned(updated);
      return updated;
    });

    // Sync to Convex
    try {
      await addBatchMutation({
        items: items.map((item) => ({
          contentType: item.contentType,
          contentId: item.contentId,
          languageCode: targetLanguage,
          fromLessonId: item.fromLessonId,
          preview: item.preview,
        })),
      });
    } catch {
      // Offline or not authenticated
    }
  }, [targetLanguage, addBatchMutation]);

  // Record a review (SM-2 algorithm happens on server)
  const recordReview = useCallback(async (
    contentId: string,
    quality: number // 0-5 (0-2 = failure, 3-5 = success)
  ) => {
    try {
      const result = await recordReviewMutation({ contentId, quality });

      // Update local with new interval
      if (result && localLearned[contentId]) {
        setLocalLearned((prev) => {
          const updated = { ...prev };
          if (updated[contentId]) {
            updated[contentId] = {
              ...updated[contentId],
              nextReviewAt: result.nextReviewAt,
              interval: result.interval,
              easeFactor: result.easeFactor,
              repetitions: quality >= 3 ? updated[contentId].repetitions + 1 : 0,
            };
          }
          saveLocalLearned(updated);
          return updated;
        });
      }

      return result;
    } catch {
      // Offline - apply SM-2 locally
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const item = localLearned[contentId];

      if (item) {
        let { easeFactor, interval, repetitions } = item;

        if (quality < 3) {
          repetitions = 0;
          interval = 1;
        } else {
          if (repetitions === 0) interval = 1;
          else if (repetitions === 1) interval = 6;
          else interval = Math.round(interval * easeFactor);
          repetitions += 1;
        }

        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        easeFactor = Math.max(1.3, easeFactor);

        const nextReviewAt = now + (interval * oneDayMs);

        setLocalLearned((prev) => {
          const updated = {
            ...prev,
            [contentId]: {
              ...prev[contentId],
              easeFactor,
              interval,
              repetitions,
              nextReviewAt,
            },
          };
          saveLocalLearned(updated);
          return updated;
        });

        return { interval, nextReviewAt, easeFactor };
      }
    }
  }, [localLearned, recordReviewMutation]);

  const allLearned = useMemo(() => getAllLearned(), [getAllLearned]);
  const dueForReview = allLearned.filter(item => item.nextReviewAt <= Date.now());

  return {
    isReady,
    allLearned,
    isContentLearned,
    getLearnedByType,
    addLearned,
    addLearnedBatch,
    recordReview,
    dueForReview,
    dueCount: dueForReview.length,
    stats: learnedStats ?? { totalLearned: 0, byType: {}, dueForReview: 0 },
  };
}
