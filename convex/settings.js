import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// Get settings
export const getSettings = query({
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return settings?.settings || null;
  },
});

// Per-language Kokoro voices validator
const kokoroVoicesValidator = v.optional(v.object({
  ja: v.optional(v.string()),
  zh: v.optional(v.string()),
  es: v.optional(v.string()),
  fr: v.optional(v.string()),
  hi: v.optional(v.string()),
  it: v.optional(v.string()),
  pt: v.optional(v.string()),
  en: v.optional(v.string()),
}));

// Settings validator
const settingsValidator = v.object({
  theme: v.string(),
  soundEnabled: v.boolean(),
  ttsEnabled: v.boolean(),
  ttsRate: v.number(),
  ttsVolume: v.number(),
  timerEnabled: v.boolean(),
  timerDuration: v.number(),
  leaderboardVisible: v.optional(v.boolean()),
  kokoroVoice: v.optional(v.string()), // Legacy
  kokoroVoices: kokoroVoicesValidator,
});

// Save settings
export const saveSettings = mutation({
  args: {
    settings: settingsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        settings: args.settings,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("userSettings", {
        userId: userId,
        settings: args.settings,
      });
      return id;
    }
  },
});

// Default settings for new users
const defaultSettings = {
  theme: "dark",
  soundEnabled: true,
  ttsEnabled: true,
  ttsRate: 1.0,
  ttsVolume: 1.0,
  timerEnabled: true,
  timerDuration: 5,
  leaderboardVisible: true,
  kokoroVoice: "af_heart", // Legacy
  kokoroVoices: {
    ja: "jf_alpha",
    zh: "zf_xiaobei",
    es: "ef_dora",
    fr: "ff_siwis",
    hi: "hf_alpha",
    it: "if_sara",
    pt: "pf_dora",
    en: "af_heart",
  },
};

// Allowed setting keys and their value types
const settingKeyValidator = v.union(
  v.literal("theme"),
  v.literal("soundEnabled"),
  v.literal("ttsEnabled"),
  v.literal("ttsRate"),
  v.literal("ttsVolume"),
  v.literal("timerEnabled"),
  v.literal("timerDuration"),
  v.literal("leaderboardVisible"),
  v.literal("kokoroVoice"),
  v.literal("kokoroVoices")
);

// Allowed language codes for voice preferences
const languageCodeValidator = v.union(
  v.literal("ja"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("fr"),
  v.literal("hi"),
  v.literal("it"),
  v.literal("pt"),
  v.literal("en")
);

// Update a single setting
export const updateSetting = mutation({
  args: {
    key: settingKeyValidator,
    value: v.union(v.string(), v.boolean(), v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      // Create default settings with the updated value
      const newSettings = {
        ...defaultSettings,
        [args.key]: args.value,
      };
      await ctx.db.insert("userSettings", {
        userId: userId,
        settings: newSettings,
      });
      return { success: true };
    }

    await ctx.db.patch(existing._id, {
      settings: {
        ...existing.settings,
        [args.key]: args.value,
      },
    });

    return { success: true };
  },
});

// Update voice preference for a specific language
export const updateKokoroVoice = mutation({
  args: {
    language: languageCodeValidator,
    voice: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      // Create default settings with the updated voice
      const newSettings = {
        ...defaultSettings,
        kokoroVoices: {
          ...defaultSettings.kokoroVoices,
          [args.language]: args.voice,
        },
      };
      await ctx.db.insert("userSettings", {
        userId: userId,
        settings: newSettings,
      });
      return { success: true };
    }

    await ctx.db.patch(existing._id, {
      settings: {
        ...existing.settings,
        kokoroVoices: {
          ...(existing.settings.kokoroVoices || defaultSettings.kokoroVoices),
          [args.language]: args.voice,
        },
      },
    });

    return { success: true };
  },
});
