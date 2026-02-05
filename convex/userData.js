import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// Get user data
export const getUserData = query({
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userData = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return userData;
  },
});

// Module stats validator (reusable)
const moduleStatsValidator = v.object({
  correct: v.number(),
  total: v.number(),
  streak: v.number(),
  bestStreak: v.number(),
});

// SRS Review data validator - matches the ReviewData interface in src/lib/srs.ts
const reviewDataValidator = v.object({
  interval: v.number(),
  easeFactor: v.number(),
  repetitions: v.number(),
  quality: v.array(v.number()),
  lastReview: v.number(),
  nextReview: v.number(),
});

// Reviews is a record of item IDs to ReviewData
const reviewsValidator = v.record(v.string(), reviewDataValidator);

// Module data validators
const moduleDataValidator = v.object({
  alphabet: v.object({
    learned: v.array(v.string()),
    reviews: reviewsValidator,
    stats: moduleStatsValidator,
  }),
  vocabulary: v.object({
    learned: v.array(v.string()),
    reviews: reviewsValidator,
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
    reviews: reviewsValidator,
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
    reviews: reviewsValidator,
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
});

const globalStatsValidator = v.object({
  streak: v.number(),
  bestStreak: v.number(),
  totalStudyTime: v.number(),
  lastActive: v.union(v.number(), v.null()),
  createdAt: v.number(),
});

// Save user data
export const saveUserData = mutation({
  args: {
    data: v.object({
      modules: moduleDataValidator,
      globalStats: globalStatsValidator,
    }),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        modules: args.data.modules,
        globalStats: args.data.globalStats,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("userData", {
        userId: userId,
        modules: args.data.modules,
        globalStats: args.data.globalStats,
      });
      return id;
    }
  },
});

// Stats validator for single module updates (union of all possible stats structures)
const singleModuleStatsValidator = v.object({
  correct: v.optional(v.number()),
  total: v.optional(v.number()),
  streak: v.optional(v.number()),
  bestStreak: v.optional(v.number()),
  wordsMastered: v.optional(v.number()),
  kanjiMastered: v.optional(v.number()),
  pointsMastered: v.optional(v.number()),
  textsRead: v.optional(v.number()),
  comprehensionScore: v.optional(v.number()),
  comprehensionTotal: v.optional(v.number()),
  comprehensionCorrect: v.optional(v.number()),
  totalAttempts: v.optional(v.number()),
  exercisesCompleted: v.optional(v.number()),
  accuracy: v.optional(v.number()),
});

// Single module update validator - allows partial updates
const singleModuleValidator = v.object({
  learned: v.optional(v.array(v.string())),
  completed: v.optional(v.array(v.string())),
  reviews: v.optional(reviewsValidator),
  stats: v.optional(singleModuleStatsValidator),
});

// Update module data
export const updateModule = mutation({
  args: {
    moduleName: v.union(
      v.literal("alphabet"),
      v.literal("vocabulary"),
      v.literal("kanji"),
      v.literal("grammar"),
      v.literal("reading"),
      v.literal("listening")
    ),
    moduleData: singleModuleValidator,
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userData = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userData) {
      throw new Error("User data not found");
    }

    const existingModule = userData.modules?.[args.moduleName] || {};
    const updatedModule = {
      ...existingModule,
      ...args.moduleData,
      stats: args.moduleData.stats
        ? { ...(existingModule.stats || {}), ...args.moduleData.stats }
        : existingModule.stats,
      learned: args.moduleData.learned ?? existingModule.learned,
      completed: args.moduleData.completed ?? existingModule.completed,
      reviews: args.moduleData.reviews ?? existingModule.reviews,
    };
    const updatedModules = {
      ...userData.modules,
      [args.moduleName]: updatedModule,
    };

    await ctx.db.patch(userData._id, {
      modules: updatedModules,
    });

    return { success: true };
  },
});

// Partial global stats validator for updates
const partialGlobalStatsValidator = v.object({
  streak: v.optional(v.number()),
  bestStreak: v.optional(v.number()),
  totalStudyTime: v.optional(v.number()),
  lastActive: v.optional(v.union(v.number(), v.null())),
  createdAt: v.optional(v.number()),
});

// Update global stats
export const updateGlobalStats = mutation({
  args: {
    stats: partialGlobalStatsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userData = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userData) {
      throw new Error("User data not found");
    }

    await ctx.db.patch(userData._id, {
      globalStats: {
        ...userData.globalStats,
        ...args.stats,
        lastActive: Date.now(),
      },
    });

    return { success: true };
  },
});
