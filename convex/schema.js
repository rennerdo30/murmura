import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Validator for SRS review data stored per item
const reviewDataValidator = v.object({
  interval: v.number(),
  easeFactor: v.number(),
  repetitions: v.number(),
  quality: v.array(v.number()),
  lastReview: v.number(),
  nextReview: v.number(),
});

export default defineSchema({
  // Convex Auth required tables (automatically includes users, authAccounts, sessions, etc.)
  ...authTables,

  userData: defineTable({
    userId: v.string(),
    targetLanguage: v.optional(v.string()), // 'ja', 'es', 'ko', 'zh' etc.
    anonymousName: v.optional(v.string()), // Generated display name for leaderboard
    modules: v.object({
      alphabet: v.object({
        learned: v.array(v.string()),
        reviews: v.record(v.string(), reviewDataValidator),
        stats: v.object({
          correct: v.number(),
          total: v.number(),
          streak: v.number(),
          bestStreak: v.number(),
        }),
      }),
      vocabulary: v.object({
        learned: v.array(v.string()),
        reviews: v.record(v.string(), reviewDataValidator),
        stats: v.object({
          correct: v.number(),
          total: v.number(),
          streak: v.number(),
          bestStreak: v.number(),
          wordsMastered: v.number(),
        }),
      }),
      kanji: v.object({
        learned: v.array(v.string()),
        reviews: v.record(v.string(), reviewDataValidator),
        stats: v.object({
          correct: v.number(),
          total: v.number(),
          streak: v.number(),
          bestStreak: v.number(),
          kanjiMastered: v.number(),
        }),
      }),
      grammar: v.object({
        learned: v.array(v.string()),
        reviews: v.record(v.string(), reviewDataValidator),
        stats: v.object({
          correct: v.number(),
          total: v.number(),
          streak: v.number(),
          bestStreak: v.number(),
          pointsMastered: v.number(),
        }),
      }),
      reading: v.object({
        completed: v.array(v.string()),
        stats: v.object({
          textsRead: v.number(),
          comprehensionScore: v.number(),
          correct: v.optional(v.number()),
          total: v.optional(v.number()),
          streak: v.optional(v.number()),
          bestStreak: v.optional(v.number()),
          totalAttempts: v.optional(v.number()),
          comprehensionTotal: v.optional(v.number()),
          comprehensionCorrect: v.optional(v.number()),
        }),
      }),
      listening: v.object({
        completed: v.array(v.string()),
        stats: v.object({
          exercisesCompleted: v.number(),
          accuracy: v.number(),
          correct: v.optional(v.number()),
          total: v.optional(v.number()),
          streak: v.optional(v.number()),
          bestStreak: v.optional(v.number()),
        }),
      }),
    }),
    globalStats: v.object({
      streak: v.number(),
      bestStreak: v.number(),
      totalStudyTime: v.number(),
      lastActive: v.union(v.number(), v.null()),
      createdAt: v.number(),
    }),
  })
    .index("by_userId", ["userId"]),

  userSettings: defineTable({
    userId: v.string(),
    settings: v.object({
      theme: v.string(),
      soundEnabled: v.boolean(),
      ttsEnabled: v.boolean(),
      ttsRate: v.number(),
      ttsVolume: v.number(),
      timerEnabled: v.boolean(),
      timerDuration: v.number(),
      leaderboardVisible: v.optional(v.boolean()), // Show on leaderboard (default true)
      kokoroVoice: v.optional(v.string()), // Legacy single voice (kept for backwards compat)
      // Per-language Kokoro voice preferences
      kokoroVoices: v.optional(v.object({
        ja: v.optional(v.string()), // Japanese voice (e.g., 'jf_alpha')
        zh: v.optional(v.string()), // Chinese voice (e.g., 'zf_xiaobei')
        es: v.optional(v.string()), // Spanish voice (e.g., 'ef_dora')
        fr: v.optional(v.string()), // French voice (e.g., 'ff_siwis')
        hi: v.optional(v.string()), // Hindi voice
        it: v.optional(v.string()), // Italian voice
        pt: v.optional(v.string()), // Portuguese voice
        en: v.optional(v.string()), // English voice (e.g., 'af_heart')
      })),
    }),
  })
    .index("by_userId", ["userId"]),

  // Learning Paths - tracks user enrollment and progress in learning paths
  learningPaths: defineTable({
    userId: v.string(),
    activePaths: v.array(v.object({
      pathId: v.string(),
      startedAt: v.number(),
      currentMilestone: v.number(),
      completed: v.boolean(),
      completedAt: v.optional(v.number()),
    })),
    pathPreferences: v.object({
      preferStructured: v.boolean(),
      showPrerequisiteWarnings: v.boolean(),
      autoEnrollInPaths: v.boolean(),
    }),
  })
    .index("by_userId", ["userId"]),

  // Review Sessions - tracks individual review session analytics
  reviewSessions: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    itemsReviewed: v.number(),
    accuracy: v.number(),
    moduleBreakdown: v.object({
      vocabulary: v.object({ reviewed: v.number(), correct: v.number() }),
      kanji: v.object({ reviewed: v.number(), correct: v.number() }),
      grammar: v.object({ reviewed: v.number(), correct: v.number() }),
    }),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  // SRS Settings - user-configurable spaced repetition settings
  srsSettings: defineTable({
    userId: v.string(),
    settings: v.object({
      // Review scheduling
      dailyNewItemsLimit: v.number(), // Default: 20
      dailyReviewLimit: v.number(), // Default: 100 (0 = unlimited)
      reviewThreshold: v.string(), // 'strict' | 'moderate' | 'relaxed'

      // Difficulty adjustments
      easeBonus: v.number(), // -0.2 to 0.2, default 0
      intervalMultiplier: v.number(), // 0.5 to 2.0, default 1.0
      lapseNewInterval: v.number(), // 0 to 1.0, default 0.5

      // Review modes
      autoplayAudio: v.boolean(),
      showReadingHints: v.boolean(),
      requiredAccuracy: v.number(), // 0.6 to 1.0, default 0.75

      // Notifications
      reviewReminders: v.boolean(),
      reminderTime: v.string(), // "HH:MM" format
      reminderThreshold: v.number(), // Remind when > X items due
    }),
  })
    .index("by_userId", ["userId"]),

  // Daily Activity - tracks daily study activity for streak calendar
  dailyActivity: defineTable({
    userId: v.string(),
    date: v.string(), // "YYYY-MM-DD" format
    studyTimeMinutes: v.number(),
    itemsLearned: v.number(),
    itemsReviewed: v.number(),
    modules: v.object({
      alphabet: v.optional(v.number()),
      vocabulary: v.optional(v.number()),
      kanji: v.optional(v.number()),
      grammar: v.optional(v.number()),
      reading: v.optional(v.number()),
      listening: v.optional(v.number()),
    }),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),

  // Lesson Progress - tracks user progress through curriculum lessons
  lessonProgress: defineTable({
    userId: v.string(),
    languageCode: v.string(),
    lessonId: v.string(),
    status: v.union(
      v.literal('locked'),
      v.literal('available'),
      v.literal('in_progress'),
      v.literal('completed')
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    xpEarned: v.optional(v.number()),
    attempts: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_language", ["userId", "languageCode"])
    .index("by_userId_lesson", ["userId", "lessonId"]),

  // Gamification - tracks XP, levels, streaks, and daily goals
  gamification: defineTable({
    userId: v.string(),
    level: v.number(),
    currentXP: v.number(),
    totalXP: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.string(), // "YYYY-MM-DD" format
    todayXP: v.number(),
    todayDate: v.string(), // "YYYY-MM-DD" format for tracking daily reset
    dailyGoalType: v.union(
      v.literal('xp'),
      v.literal('lessons'),
      v.literal('time')
    ),
    dailyGoalTarget: v.number(),
    dailyGoalProgress: v.number(),
  })
    .index("by_userId", ["userId"]),

  // User Achievements - tracks user's unlocked achievements
  userAchievements: defineTable({
    userId: v.string(),
    achievementId: v.string(),
    unlockedAt: v.number(), // Timestamp when unlocked
    progress: v.optional(v.number()), // Progress percentage (0-100) for progressive achievements
  })
    .index("by_userId", ["userId"])
    .index("by_userId_achievement", ["userId", "achievementId"]),

  // Review Queue - unified cross-module SRS review queue
  reviewQueue: defineTable({
    userId: v.string(),
    itemId: v.string(),           // Reference to the actual item
    itemType: v.union(
      v.literal('vocabulary'),
      v.literal('kanji'),
      v.literal('hanzi'),
      v.literal('grammar'),
      v.literal('character'),
      v.literal('reading')
    ),
    languageCode: v.string(),
    lessonId: v.optional(v.string()),
    pathId: v.optional(v.string()),
    // SRS data
    dueAt: v.number(),            // When this item is due for review
    interval: v.number(),         // Current interval in days
    easeFactor: v.number(),       // SM-2 ease factor (default 2.5)
    repetitions: v.number(),      // Number of successful repetitions
    lastReview: v.optional(v.number()),
    lastQuality: v.optional(v.number()),
    // Preview data for quick display
    preview: v.object({
      front: v.string(),
      back: v.string(),
      reading: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
    }),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_due", ["userId", "dueAt"])
    .index("by_userId_type", ["userId", "itemType"])
    .index("by_userId_item", ["userId", "itemId"]),

  // Learned Content - tracks content learned from completed lessons
  // Feeds into the user's review deck with SRS scheduling
  learnedContent: defineTable({
    userId: v.string(),
    contentType: v.union(
      v.literal('vocabulary'),
      v.literal('grammar'),
      v.literal('character'),
      v.literal('reading'),
      v.literal('listening')
    ),
    contentId: v.string(),     // Reference to content item
    languageCode: v.string(),
    fromLessonId: v.string(),  // Which lesson taught this content
    learnedAt: v.number(),     // Timestamp when learned
    // SRS fields (initialized when added to deck)
    nextReviewAt: v.number(),
    easeFactor: v.number(),    // SM-2 ease factor (default 2.5)
    interval: v.number(),      // Days until next review
    repetitions: v.number(),   // Successful review count
    // Preview data for quick display
    preview: v.object({
      front: v.string(),       // Word/character/title
      back: v.string(),        // Meaning/explanation
      reading: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
    }),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "contentType"])
    .index("by_userId_language", ["userId", "languageCode"])
    .index("by_userId_due", ["userId", "nextReviewAt"])
    .index("by_userId_content", ["userId", "contentId"]),

  // Learning Preferences - user's progression mode settings
  learningPreferences: defineTable({
    userId: v.string(),
    languageCode: v.string(),
    progressionMode: v.union(
      v.literal('linear'),     // Complete lessons in order
      v.literal('flexible'),   // Some flexibility with placement test
      v.literal('open')        // All content unlocked
    ),
    placementLevel: v.optional(v.string()),  // Level determined by placement test
    placementTakenAt: v.optional(v.number()),
    skipToLevel: v.optional(v.string()),     // If user skipped ahead
  })
    .index("by_userId", ["userId"])
    .index("by_userId_language", ["userId", "languageCode"]),

  // Weekly Reports - generated weekly summary reports
  weeklyReports: defineTable({
    userId: v.string(),
    weekStart: v.string(), // "YYYY-MM-DD" - Monday of the week
    weekEnd: v.string(), // "YYYY-MM-DD" - Sunday of the week
    generatedAt: v.number(), // Timestamp when report was generated
    stats: v.object({
      totalStudyTimeMinutes: v.number(),
      lessonsCompleted: v.number(),
      exercisesCompleted: v.number(),
      accuracy: v.number(), // 0-100
      xpEarned: v.number(),
      streakDays: v.number(),
      newWordsLearned: v.number(),
      newKanjiLearned: v.number(),
    }),
    comparison: v.optional(v.object({
      studyTimeChange: v.number(), // Percentage change from previous week
      lessonsChange: v.number(),
      accuracyChange: v.number(),
    })),
    highlights: v.optional(v.array(v.string())), // Notable achievements or milestones
  })
    .index("by_userId", ["userId"])
    .index("by_userId_weekStart", ["userId", "weekStart"]),
});
