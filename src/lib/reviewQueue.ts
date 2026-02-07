/**
 * Review Queue System
 * Manages the unified SRS review queue across all modules
 */

import {
  ReviewData,
  isDueForReview,
  getReviewPriority,
  calculateNextReview,
  getMasteryStatus,
} from './srs';

export type ReviewModuleName = 'vocabulary' | 'kanji' | 'grammar' | 'reading' | 'listening';

export interface ReviewItem {
  id: string;
  module: ReviewModuleName;
  reviewData: ReviewData | null;
  priority: number;
  dueDate: number | null;
  masteryStatus: string;
  // Item data for display
  data?: {
    front: string;
    back: string;
    reading?: string;
    audioUrl?: string;
  };
}

export interface ReviewQueue {
  total: number;
  byModule: {
    vocabulary: number;
    kanji: number;
    grammar: number;
    reading: number;
    listening: number;
  };
  urgency: 'overdue' | 'due' | 'upcoming' | 'none';
  estimatedMinutes: number;
  items: ReviewItem[];
}

export interface ReviewSessionState {
  sessionId: string;
  items: ReviewItem[];
  currentIndex: number;
  completed: ReviewItem[];
  results: {
    correct: number;
    incorrect: number;
    totalTime: number;
  };
  startTime: number;
}

export interface ModuleReviews {
  [itemId: string]: ReviewData;
}

export interface UserModuleData {
  learned: string[];
  reviews: ModuleReviews;
}

export interface SRSSettings {
  dailyNewItemsLimit: number;
  dailyReviewLimit: number;
  reviewThreshold: 'strict' | 'moderate' | 'relaxed';
  easeBonus: number;
  intervalMultiplier: number;
  lapseNewInterval: number;
  autoplayAudio: boolean;
  showReadingHints: boolean;
  requiredAccuracy: number;
  reviewReminders: boolean;
  reminderTime: string;
  reminderThreshold: number;
}

// Default SRS settings
export const DEFAULT_SRS_SETTINGS: SRSSettings = {
  dailyNewItemsLimit: 20,
  dailyReviewLimit: 100,
  reviewThreshold: 'moderate',
  easeBonus: 0,
  intervalMultiplier: 1.0,
  lapseNewInterval: 0.5,
  autoplayAudio: true,
  showReadingHints: false,
  requiredAccuracy: 0.75,
  reviewReminders: true,
  reminderTime: '09:00',
  reminderThreshold: 10,
};

// Average time per review item in seconds
const AVG_TIME_PER_ITEM = 8;

/**
 * Get urgency level based on overdue status
 */
function calculateUrgency(items: ReviewItem[]): 'overdue' | 'due' | 'upcoming' | 'none' {
  if (items.length === 0) return 'none';

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const hasOverdue = items.some(
    (item) => item.dueDate && item.dueDate < now - oneDayMs
  );
  if (hasOverdue) return 'overdue';

  const hasDueToday = items.some(
    (item) => item.dueDate && item.dueDate <= now
  );
  if (hasDueToday) return 'due';

  const hasUpcoming = items.some(
    (item) => item.dueDate && item.dueDate <= now + 3 * oneDayMs
  );
  if (hasUpcoming) return 'upcoming';

  return 'none';
}

/**
 * Build a review item from raw data
 */
export function buildReviewItem(
  id: string,
  module: ReviewModuleName,
  reviewData: ReviewData | null,
  itemData?: ReviewItem['data']
): ReviewItem {
  return {
    id,
    module,
    reviewData,
    priority: getReviewPriority(reviewData),
    dueDate: reviewData?.nextReview || null,
    masteryStatus: getMasteryStatus(reviewData),
    data: itemData,
  };
}

/**
 * Get all items due for review across all modules
 */
export function getReviewQueue(
  moduleData: {
    vocabulary?: UserModuleData;
    kanji?: UserModuleData;
    grammar?: UserModuleData;
    reading?: UserModuleData;
    listening?: UserModuleData;
  },
  settings: SRSSettings = DEFAULT_SRS_SETTINGS
): ReviewQueue {
  const items: ReviewItem[] = [];
  const byModule = {
    vocabulary: 0,
    kanji: 0,
    grammar: 0,
    reading: 0,
    listening: 0,
  };

  // Process each module
  const modules: ReviewModuleName[] = ['vocabulary', 'kanji', 'grammar', 'reading', 'listening'];

  for (const module of modules) {
    const data = moduleData[module];
    if (!data) continue;

    const reviews = data.reviews || {};
    const learned = data.learned || [];

    // Add items that are due for review
    for (const itemId of learned) {
      const reviewData = reviews[itemId] || null;

      if (isDueForReview(reviewData)) {
        items.push(buildReviewItem(itemId, module, reviewData));
        byModule[module]++;
      }
    }
  }

  // Sort by priority (highest first)
  items.sort((a, b) => b.priority - a.priority);

  // Apply daily limit if set
  const limit = settings.dailyReviewLimit || 0;
  const limitedItems = limit > 0 ? items.slice(0, limit) : items;

  return {
    total: limitedItems.length,
    byModule,
    urgency: calculateUrgency(limitedItems),
    estimatedMinutes: Math.ceil((limitedItems.length * AVG_TIME_PER_ITEM) / 60),
    items: limitedItems,
  };
}

/**
 * Get review queue for a specific module only
 */
export function getModuleReviewQueue(
  module: ReviewModuleName,
  moduleData: UserModuleData | undefined,
  settings: SRSSettings = DEFAULT_SRS_SETTINGS
): ReviewQueue {
  if (!moduleData) {
    return {
      total: 0,
      byModule: { vocabulary: 0, kanji: 0, grammar: 0, reading: 0, listening: 0 },
      urgency: 'none',
      estimatedMinutes: 0,
      items: [],
    };
  }

  const items: ReviewItem[] = [];
  const reviews = moduleData.reviews || {};
  const learned = moduleData.learned || [];

  for (const itemId of learned) {
    const reviewData = reviews[itemId] || null;

    if (isDueForReview(reviewData)) {
      items.push(buildReviewItem(itemId, module, reviewData));
    }
  }

  items.sort((a, b) => b.priority - a.priority);

  const limit = settings.dailyReviewLimit || 0;
  const limitedItems = limit > 0 ? items.slice(0, limit) : items;

  const byModule = { vocabulary: 0, kanji: 0, grammar: 0, reading: 0, listening: 0 };
  byModule[module] = limitedItems.length;

  return {
    total: limitedItems.length,
    byModule,
    urgency: calculateUrgency(limitedItems),
    estimatedMinutes: Math.ceil((limitedItems.length * AVG_TIME_PER_ITEM) / 60),
    items: limitedItems,
  };
}

/**
 * Start a new review session
 */
export function startReviewSession(
  items: ReviewItem[],
  batchSize: number = 20
): ReviewSessionState {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Take only up to batchSize items
  const sessionItems = items.slice(0, batchSize);

  return {
    sessionId,
    items: sessionItems,
    currentIndex: 0,
    completed: [],
    results: {
      correct: 0,
      incorrect: 0,
      totalTime: 0,
    },
    startTime: Date.now(),
  };
}

/**
 * Submit a review answer and get updated session state
 */
export function submitReviewAnswer(
  session: ReviewSessionState,
  quality: number,
  responseTimeMs: number
): {
  session: ReviewSessionState;
  updatedReviewData: ReviewData;
  isSessionComplete: boolean;
} {
  const currentItem = session.items[session.currentIndex];
  if (!currentItem) {
    throw new Error('No current item in session');
  }

  // Calculate new review data using SRS algorithm
  const updatedReviewData = calculateNextReview(currentItem.reviewData, quality);

  // Update session state
  const isCorrect = quality >= 3;
  const newSession: ReviewSessionState = {
    ...session,
    currentIndex: session.currentIndex + 1,
    completed: [...session.completed, { ...currentItem, reviewData: updatedReviewData }],
    results: {
      correct: session.results.correct + (isCorrect ? 1 : 0),
      incorrect: session.results.incorrect + (isCorrect ? 0 : 1),
      totalTime: session.results.totalTime + responseTimeMs,
    },
  };

  const isSessionComplete = newSession.currentIndex >= newSession.items.length;

  return {
    session: newSession,
    updatedReviewData,
    isSessionComplete,
  };
}

/**
 * Calculate session statistics
 */
export function calculateSessionStats(session: ReviewSessionState): {
  accuracy: number;
  avgTimePerItem: number;
  totalItems: number;
  correct: number;
  incorrect: number;
  duration: number;
  moduleBreakdown: Record<ReviewModuleName, { reviewed: number; correct: number }>;
} {
  const totalItems = session.completed.length;
  const accuracy = totalItems > 0 ? session.results.correct / totalItems : 0;
  const avgTimePerItem = totalItems > 0 ? session.results.totalTime / totalItems : 0;
  const duration = Date.now() - session.startTime;

  // Calculate module breakdown
  const moduleBreakdown: Record<ReviewModuleName, { reviewed: number; correct: number }> = {
    vocabulary: { reviewed: 0, correct: 0 },
    kanji: { reviewed: 0, correct: 0 },
    grammar: { reviewed: 0, correct: 0 },
    reading: { reviewed: 0, correct: 0 },
    listening: { reviewed: 0, correct: 0 },
  };

  session.completed.forEach((item, index) => {
    moduleBreakdown[item.module].reviewed++;
    // Infer correctness from quality in review data
    const wasCorrect = item.reviewData && item.reviewData.quality.length > 0
      ? item.reviewData.quality[item.reviewData.quality.length - 1] >= 3
      : false;
    if (wasCorrect) {
      moduleBreakdown[item.module].correct++;
    }
  });

  return {
    accuracy,
    avgTimePerItem,
    totalItems,
    correct: session.results.correct,
    incorrect: session.results.incorrect,
    duration,
    moduleBreakdown,
  };
}

/**
 * Get estimated time to complete review queue in minutes
 */
export function getEstimatedReviewTime(itemCount: number): number {
  return Math.ceil((itemCount * AVG_TIME_PER_ITEM) / 60);
}

/**
 * Check if user should be reminded about reviews
 */
export function shouldRemindAboutReviews(
  queue: ReviewQueue,
  settings: SRSSettings = DEFAULT_SRS_SETTINGS
): boolean {
  if (!settings.reviewReminders) return false;
  if (queue.total < settings.reminderThreshold) return false;
  if (queue.urgency === 'none') return false;

  return true;
}

/**
 * Get review count by mastery level
 */
export function getReviewCountByMastery(
  items: ReviewItem[]
): Record<string, number> {
  const counts: Record<string, number> = {
    new: 0,
    learning: 0,
    advanced: 0,
    mastered: 0,
  };

  items.forEach((item) => {
    const status = item.masteryStatus || 'new';
    counts[status] = (counts[status] || 0) + 1;
  });

  return counts;
}

/**
 * Filter review items by module
 */
export function filterReviewsByModule(
  items: ReviewItem[],
  modules: ReviewModuleName[]
): ReviewItem[] {
  return items.filter((item) => modules.includes(item.module));
}

/**
 * Get next batch of items for review
 */
export function getNextReviewBatch(
  queue: ReviewQueue,
  batchSize: number = 20,
  modules?: ReviewModuleName[]
): ReviewItem[] {
  let items = queue.items;

  if (modules && modules.length > 0) {
    items = filterReviewsByModule(items, modules);
  }

  return items.slice(0, batchSize);
}

export default {
  getReviewQueue,
  getModuleReviewQueue,
  startReviewSession,
  submitReviewAnswer,
  calculateSessionStats,
  getEstimatedReviewTime,
  shouldRemindAboutReviews,
  getReviewCountByMastery,
  filterReviewsByModule,
  getNextReviewBatch,
  buildReviewItem,
  DEFAULT_SRS_SETTINGS,
};
