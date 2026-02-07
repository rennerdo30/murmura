/**
 * Data Loader - Centralized module for loading language-specific data
 *
 * This module provides HTTP fetch-based loading from public/data/.
 * To add a new language:
 * 1. Create the data files in public/data/{lang}/
 * 2. Add the language to language-configs.json (or database)
 *
 * No other code changes should be needed!
 */

import { VocabularyItem, GrammarItem } from '@/types';
import { Assessment, AssessmentQuestion, AssessmentSection, ExerciseData } from '@/types/assessment';
import { PronunciationDrill } from '@/types/pronunciation';
import { getAvailableLanguages, isLanguageAvailable, getDefaultLanguage } from './language';

// Dynamic language validation using config
// Falls back to checking if language is in available languages list
function isValidLanguageCode(code: string): boolean {
  return isLanguageAvailable(code);
}

// Get default language for fallback
function getFallbackLanguage(): string {
  return getDefaultLanguage();
}

// Track which languages have vocabulary data loaded successfully
const languagesWithVocabulary = new Set<string>();

// Cache for loaded vocabulary data
const vocabularyCache = new Map<string, VocabularyItem[]>();

// Loading state to prevent duplicate requests
const loadingPromises = new Map<string, Promise<VocabularyItem[]>>();

// Normalize a single vocabulary item to handle format differences
const normalizeVocabularyItem = (item: Record<string, unknown>): VocabularyItem => {
  // Handle audioUrl vs audio_url
  const audioUrl = (item.audioUrl as string | undefined) || (item.audio_url as string | undefined);

  // Handle examples format differences
  const rawExamples = item.examples as Array<Record<string, unknown>> | undefined;
  const examples = rawExamples?.map(ex => ({
    sentence: (ex.sentence as string) || (ex.ja as string) || (ex.example as string) || '',
    translation: (ex.translation as string) || (ex.en as string) || '',
  }));

  return {
    ...(item as unknown as VocabularyItem),
    audioUrl,
    examples,
  } as VocabularyItem;
};

// Helper to extract vocabulary array from different JSON structures
const extractVocabulary = (data: unknown): VocabularyItem[] => {
  let items: Array<Record<string, unknown>> = [];

  if (Array.isArray(data)) {
    items = data as Array<Record<string, unknown>>;
  } else if (data && typeof data === 'object' && 'vocabulary' in data) {
    items = (data as { vocabulary: Array<Record<string, unknown>> }).vocabulary;
  }

  // Normalize each item to handle format differences
  return items.map(normalizeVocabularyItem);
};

/**
 * Load vocabulary data asynchronously for a specific language.
 * Fetches from public/data/{lang}/vocabulary.json via HTTP.
 * Results are cached to avoid repeated loading.
 * Uses request deduplication to prevent concurrent duplicate requests.
 */
export async function loadVocabularyData(lang: string): Promise<VocabularyItem[]> {
  const fallbackLang = getFallbackLanguage();

  // Validate language code - use dynamic validation
  if (!isValidLanguageCode(lang)) {
    console.warn(`Unknown language code: ${lang}, falling back to '${fallbackLang}'`);
    lang = fallbackLang;
  }

  // Return cached data if available
  if (vocabularyCache.has(lang)) {
    return vocabularyCache.get(lang)!;
  }

  // Check if already loading - deduplicate concurrent requests
  if (loadingPromises.has(lang)) {
    return loadingPromises.get(lang)!;
  }

  // Create loading promise - fetch from public/data/
  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data/${lang}/vocabulary.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const vocabulary = extractVocabulary(data);
      vocabularyCache.set(lang, vocabulary);
      // Track that this language has vocabulary data
      languagesWithVocabulary.add(lang);
      return vocabulary;
    } catch (error) {
      console.error(`Failed to load vocabulary for ${lang}:`, error);
      // Fall back to default language if available
      if (lang !== fallbackLang && vocabularyCache.has(fallbackLang)) {
        return vocabularyCache.get(fallbackLang)!;
      }
      return [];
    } finally {
      loadingPromises.delete(lang);
    }
  })();

  loadingPromises.set(lang, loadPromise);
  return loadPromise;
}

/**
 * Get vocabulary data synchronously from cache.
 * Returns empty array if not loaded yet.
 * Use loadVocabularyData() to ensure data is loaded first.
 *
 * @deprecated Use loadVocabularyData() for async loading instead
 */
export function getVocabularyData(lang: string): VocabularyItem[] {
  // Check cache first
  if (vocabularyCache.has(lang)) {
    return vocabularyCache.get(lang)!;
  }

  // Trigger async load for future use
  loadVocabularyData(lang).catch(() => {
    // Error already logged in loadVocabularyData
  });

  // Return empty array synchronously - data will be available on next render
  return [];
}

/**
 * Check if vocabulary data is loaded for a language
 */
export function isVocabularyLoaded(lang: string): boolean {
  return vocabularyCache.has(lang);
}

/**
 * Check if vocabulary data exists for a language
 * Returns true if we've successfully loaded vocabulary for this language before,
 * or if it's in the available languages list (optimistic check)
 */
export function hasVocabularyData(lang: string): boolean {
  // Check if we've already loaded data for this language
  if (languagesWithVocabulary.has(lang)) {
    return true;
  }
  // Optimistically return true for available languages
  // The actual check happens during loading
  return isValidLanguageCode(lang);
}

/**
 * Get all available languages for vocabulary
 * Returns dynamically configured languages
 */
export function getVocabularyLanguages(): string[] {
  return getAvailableLanguages();
}

/**
 * Preload vocabulary data for a language (doesn't block)
 */
export function preloadVocabularyData(lang: string): void {
  if (!vocabularyCache.has(lang) && !loadingPromises.has(lang)) {
    loadVocabularyData(lang).catch(() => {
      // Error already logged in loadVocabularyData
    });
  }
}

/**
 * Get the level field name for a vocabulary item
 * Different languages may use different field names:
 * - Japanese: jlpt
 * - Korean: level (with TOPIK values)
 * - Chinese: level (with HSK values)
 * - European languages: level (with CEFR values)
 */
export function getItemLevel(item: VocabularyItem): string {
  // Check various level field names that different language data might use
  return item.jlpt || item.level || '';
}

/**
 * Filter vocabulary items by level IDs
 * Uses the levels array from language-configs.json
 */
export function filterVocabularyByLevels(
  items: VocabularyItem[],
  activeLevelIds: string[]
): VocabularyItem[] {
  if (activeLevelIds.length === 0) return [];

  return items.filter(item => {
    const itemLevel = getItemLevel(item);
    return activeLevelIds.includes(itemLevel);
  });
}

/**
 * Clear vocabulary cache (useful for testing or memory management)
 */
export function clearVocabularyCache(): void {
  vocabularyCache.clear();
}

// ============================================================================
// GRAMMAR DATA LOADING
// ============================================================================

// Cache for loaded grammar data
const grammarCache = new Map<string, GrammarItem[]>();

// Loading state to prevent duplicate requests
const grammarLoadingPromises = new Map<string, Promise<GrammarItem[]>>();

// Normalize a single grammar item to handle format differences
const normalizeGrammarItem = (item: Record<string, unknown>): GrammarItem => {
  // Handle audioUrl vs audio_url
  const audioUrl = (item.audioUrl as string | undefined) || (item.audio_url as string | undefined);

  return {
    ...(item as unknown as GrammarItem),
    audioUrl,
  } as GrammarItem;
};

// Helper to extract grammar array from different JSON structures
const extractGrammar = (data: unknown): GrammarItem[] => {
  let items: Array<Record<string, unknown>> = [];

  if (Array.isArray(data)) {
    items = data as Array<Record<string, unknown>>;
  } else if (data && typeof data === 'object' && 'grammar' in data) {
    items = (data as { grammar: Array<Record<string, unknown>> }).grammar;
  }

  // Normalize each item to handle format differences
  return items.map(normalizeGrammarItem);
};

/**
 * Load grammar data asynchronously for a specific language.
 * Fetches from public/data/{lang}/grammar.json via HTTP.
 * Results are cached to avoid repeated loading.
 */
export async function loadGrammarData(lang: string): Promise<GrammarItem[]> {
  const fallbackLang = getFallbackLanguage();

  // Validate language code
  if (!isValidLanguageCode(lang)) {
    console.warn(`Unknown language code: ${lang}, falling back to '${fallbackLang}'`);
    lang = fallbackLang;
  }

  // Return cached data if available
  if (grammarCache.has(lang)) {
    return grammarCache.get(lang)!;
  }

  // Check if already loading - deduplicate concurrent requests
  if (grammarLoadingPromises.has(lang)) {
    return grammarLoadingPromises.get(lang)!;
  }

  // Create loading promise - fetch from public/data/
  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data/${lang}/grammar.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const grammar = extractGrammar(data);
      grammarCache.set(lang, grammar);
      return grammar;
    } catch (error) {
      console.error(`Failed to load grammar for ${lang}:`, error);
      // Fall back to default language if available
      if (lang !== fallbackLang && grammarCache.has(fallbackLang)) {
        return grammarCache.get(fallbackLang)!;
      }
      return [];
    } finally {
      grammarLoadingPromises.delete(lang);
    }
  })();

  grammarLoadingPromises.set(lang, loadPromise);
  return loadPromise;
}

/**
 * Get grammar data synchronously from cache.
 * Returns empty array if not loaded yet.
 * Use loadGrammarData() to ensure data is loaded first.
 */
export function getGrammarData(lang: string): GrammarItem[] {
  // Check cache first
  if (grammarCache.has(lang)) {
    return grammarCache.get(lang)!;
  }

  // Trigger async load for future use
  loadGrammarData(lang).catch(() => {
    // Error already logged in loadGrammarData
  });

  // Return empty array synchronously - data will be available on next render
  return [];
}

/**
 * Check if grammar data is loaded for a language
 */
export function isGrammarLoaded(lang: string): boolean {
  return grammarCache.has(lang);
}

/**
 * Preload grammar data for a language (doesn't block)
 */
export function preloadGrammarData(lang: string): void {
  if (!grammarCache.has(lang) && !grammarLoadingPromises.has(lang)) {
    loadGrammarData(lang).catch(() => {
      // Error already logged in loadGrammarData
    });
  }
}

/**
 * Clear grammar cache
 */
export function clearGrammarCache(): void {
  grammarCache.clear();
}

// ============================================================================
// LESSON DATA LOADING
// ============================================================================

export interface LessonData {
  id: number;
  slug: string;
  name: string;
  type: 'alphabet' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'mixed';
  content: {
    characters?: string[];
    vocabularyIds?: string[];
    grammarIds?: string[];
    readingIds?: string[];
    listeningIds?: string[];
  };
  prerequisite_slug: string | null;
  estimated_minutes: number;
  language_id: number;
  level?: string;
  description?: string;
}

export interface CurriculumPath {
  path: {
    id: number;
    slug: string;
    name: string;
    description: string;
    type: 'linear' | 'flexible';
    estimated_hours: number;
    difficulty: string;
    language_id: number;
  };
  milestones: Array<{
    id: number;
    slug: string;
    level: string;
    name: string;
    description: string;
    module: string;
    requirement: {
      type: string;
      value?: number;
    };
    estimated_hours: number;
    path_id: number;
  }>;
}

// Cache for lessons and curriculum data
const lessonsCache = new Map<string, LessonData[]>();
const curriculumCache = new Map<string, CurriculumPath[]>();
const lessonsLoadingPromises = new Map<string, Promise<LessonData[]>>();
const curriculumLoadingPromises = new Map<string, Promise<CurriculumPath[]>>();

/**
 * Load lessons data for a specific language.
 * Fetches from public/data/{lang}/lessons.json via HTTP.
 */
export async function loadLessonsData(lang: string): Promise<LessonData[]> {
  const fallbackLang = getFallbackLanguage();
  if (!isValidLanguageCode(lang)) {
    console.warn(`Unknown language code: ${lang}, falling back to '${fallbackLang}'`);
    lang = fallbackLang;
  }

  if (lessonsCache.has(lang)) {
    return lessonsCache.get(lang)!;
  }

  if (lessonsLoadingPromises.has(lang)) {
    return lessonsLoadingPromises.get(lang)!;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data/${lang}/lessons.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const lessons = Array.isArray(data) ? data : [];
      lessonsCache.set(lang, lessons);
      return lessons;
    } catch (error) {
      console.error(`Failed to load lessons for ${lang}:`, error);
      return [];
    } finally {
      lessonsLoadingPromises.delete(lang);
    }
  })();

  lessonsLoadingPromises.set(lang, loadPromise);
  return loadPromise;
}

/**
 * Load curriculum/learning paths for a specific language.
 * Fetches from public/data/{lang}/curriculum.json via HTTP.
 */
export async function loadCurriculumData(lang: string): Promise<CurriculumPath[]> {
  const fallbackLang = getFallbackLanguage();
  if (!isValidLanguageCode(lang)) {
    console.warn(`Unknown language code: ${lang}, falling back to '${fallbackLang}'`);
    lang = fallbackLang;
  }

  if (curriculumCache.has(lang)) {
    return curriculumCache.get(lang)!;
  }

  if (curriculumLoadingPromises.has(lang)) {
    return curriculumLoadingPromises.get(lang)!;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data/${lang}/curriculum.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const curriculum = Array.isArray(data) ? data : [];
      curriculumCache.set(lang, curriculum);
      return curriculum;
    } catch (error) {
      console.error(`Failed to load curriculum for ${lang}:`, error);
      return [];
    } finally {
      curriculumLoadingPromises.delete(lang);
    }
  })();

  curriculumLoadingPromises.set(lang, loadPromise);
  return loadPromise;
}

/**
 * Get lessons ordered by prerequisites (topological sort).
 * Returns lessons in the order they should be completed.
 */
export function getOrderedLessons(lessons: LessonData[]): LessonData[] {
  const slugToLesson = new Map(lessons.map(l => [l.slug, l]));
  const ordered: LessonData[] = [];
  const visited = new Set<string>();

  function visit(lesson: LessonData) {
    if (visited.has(lesson.slug)) return;

    // Visit prerequisite first
    if (lesson.prerequisite_slug) {
      const prereq = slugToLesson.get(lesson.prerequisite_slug);
      if (prereq) visit(prereq);
    }

    visited.add(lesson.slug);
    ordered.push(lesson);
  }

  // Find root lessons (no prerequisite) and process from there
  const roots = lessons.filter(l => !l.prerequisite_slug);
  roots.forEach(visit);

  // Process any remaining lessons (in case of disconnected graphs)
  lessons.forEach(visit);

  return ordered;
}

/**
 * Get a single lesson by slug.
 */
export function getLessonBySlug(lessons: LessonData[], slug: string): LessonData | undefined {
  return lessons.find(l => l.slug === slug);
}

/**
 * Get lessons filtered by type.
 */
export function getLessonsByType(lessons: LessonData[], type: LessonData['type']): LessonData[] {
  return lessons.filter(l => l.type === type);
}

/**
 * Check if lessons data is loaded for a language.
 */
export function isLessonsLoaded(lang: string): boolean {
  return lessonsCache.has(lang);
}

/**
 * Preload lessons data for a language.
 */
export function preloadLessonsData(lang: string): void {
  if (!lessonsCache.has(lang) && !lessonsLoadingPromises.has(lang)) {
    loadLessonsData(lang).catch(() => {
      // Error already logged
    });
  }
}

/**
 * Clear all data caches.
 */
export function clearAllCaches(): void {
  vocabularyCache.clear();
  grammarCache.clear();
  lessonsCache.clear();
  curriculumCache.clear();
  learningPathsCache.clear();
  assessmentsCache.clear();
  pronunciationCache.clear();
}

// ============================================================================
// LEARNING PATHS DATA LOADING (AI-generated curriculum)
// ============================================================================

export interface LearningPathMilestone {
  id: string;
  level: string;
  name: string;
  nameTranslations?: Record<string, string>;  // UI language translations
  description: string;
  descriptionTranslations?: Record<string, string>;  // UI language translations
  module: string;
  requirement: {
    type: 'complete-all' | 'master-percentage';
    value?: number;
  };
  estimatedHours: number;
  lessons?: string[];
}

export interface LearningPath {
  id: string;
  type: 'linear' | 'topic';
  name: string;
  nameTranslations?: Record<string, string>;  // UI language translations
  description: string;
  descriptionTranslations?: Record<string, string>;  // UI language translations
  icon: string;
  language: string;
  estimatedHours: number;
  difficulty: string;
  milestones: LearningPathMilestone[];
  tags?: string[];
  prerequisites?: string[];
  items?: {
    vocabulary?: string[];
    grammar?: string[];
    reading?: string[];
    kanji?: string[];
  };
}

export interface LearningPathsData {
  paths: Record<string, LearningPath>;
  pathOrder: string[];
}

// Cache for learning paths data
const learningPathsCache = new Map<string, LearningPathsData>();
const learningPathsLoadingPromises = new Map<string, Promise<LearningPathsData | null>>();

// Cache for content availability (prevents repeated 404s)
const contentUnavailableCache = new Set<string>();

/**
 * Load learning paths data for a specific language.
 * Fetches from public/data/{lang}/learning-paths.json via HTTP.
 * This is the AI-generated curriculum data.
 */
export async function loadLearningPathsData(lang: string): Promise<LearningPathsData | null> {
  const fallbackLang = getFallbackLanguage();
  if (!isValidLanguageCode(lang)) {
    console.warn(`Unknown language code: ${lang}, falling back to '${fallbackLang}'`);
    lang = fallbackLang;
  }

  const cacheKey = `learning-paths-${lang}`;

  // Check negative cache first to prevent repeated 404s
  if (contentUnavailableCache.has(cacheKey)) {
    return null;
  }

  if (learningPathsCache.has(lang)) {
    return learningPathsCache.get(lang)!;
  }

  if (learningPathsLoadingPromises.has(lang)) {
    return learningPathsLoadingPromises.get(lang)!;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data/${lang}/learning-paths.json`);
      if (!response.ok) {
        // No AI-generated paths for this language yet - cache the negative result
        contentUnavailableCache.add(cacheKey);
        return null;
      }
      const data = await response.json();

      // Validate structure
      if (data && typeof data === 'object' && 'paths' in data) {
        learningPathsCache.set(lang, data as LearningPathsData);
        return data as LearningPathsData;
      }

      console.warn(`Invalid learning paths format for ${lang}`);
      contentUnavailableCache.add(cacheKey);
      return null;
    } catch (error) {
      console.log(`Failed to load learning paths for ${lang}:`, error);
      contentUnavailableCache.add(cacheKey);
      return null;
    } finally {
      learningPathsLoadingPromises.delete(lang);
    }
  })();

  learningPathsLoadingPromises.set(lang, loadPromise);
  return loadPromise;
}

/**
 * Check if learning paths data is loaded for a language.
 */
export function isLearningPathsLoaded(lang: string): boolean {
  return learningPathsCache.has(lang);
}

/**
 * Preload learning paths data for a language.
 */
export function preloadLearningPathsData(lang: string): void {
  if (!learningPathsCache.has(lang) && !learningPathsLoadingPromises.has(lang)) {
    loadLearningPathsData(lang).catch(() => {
      // Error already logged
    });
  }
}

// ============================================================================
// ASSESSMENT DATA LOADING
// ============================================================================

// Cache for assessment data
const assessmentsCache = new Map<string, Assessment[]>();
const assessmentsLoadingPromises = new Map<string, Promise<Assessment[]>>();

function normalizeAssessmentQuestion(question: Record<string, unknown>): AssessmentQuestion {
  const rawQuestionData = (question.questionData as Record<string, unknown> | undefined) || {};

  const normalizedQuestionData: ExerciseData = {
    ...(rawQuestionData as unknown as ExerciseData),
    id: String(rawQuestionData.id ?? ''),
    type: String(rawQuestionData.type ?? 'multiple_choice'),
    question: String(rawQuestionData.question ?? ''),
    audioUrl: (rawQuestionData.audioUrl as string | undefined) || (rawQuestionData.audio_url as string | undefined),
  };

  return {
    ...(question as unknown as AssessmentQuestion),
    id: String(question.id ?? ''),
    sectionIndex: Number(question.sectionIndex ?? 0),
    questionIndex: Number(question.questionIndex ?? 0),
    skill: (question.skill as AssessmentQuestion['skill']) || 'vocabulary',
    difficulty: (question.difficulty as AssessmentQuestion['difficulty']) || 'easy',
    questionData: normalizedQuestionData,
    points: Number(question.points ?? 1),
  };
}

function normalizeAssessment(assessment: Record<string, unknown>): Assessment {
  const rawSections = Array.isArray(assessment.sections) ? (assessment.sections as Array<Record<string, unknown>>) : [];
  const sections: AssessmentSection[] = rawSections.map((section) => {
    const rawQuestions = Array.isArray(section.questions) ? (section.questions as Array<Record<string, unknown>>) : [];
    return {
      ...(section as unknown as AssessmentSection),
      name: String(section.name ?? ''),
      skill: (section.skill as AssessmentSection['skill']) || 'vocabulary',
      weight: Number(section.weight ?? 0),
      questions: rawQuestions.map(normalizeAssessmentQuestion),
    };
  });

  return {
    ...(assessment as unknown as Assessment),
    id: String(assessment.id ?? ''),
    sections,
  };
}

/**
 * Load assessments data for a specific language.
 * Fetches from public/data/{lang}/assessments.json via HTTP.
 */
export async function loadAssessmentsData(lang: string): Promise<Assessment[]> {
  const fallbackLang = getFallbackLanguage();
  if (!isValidLanguageCode(lang)) {
    console.warn(`Unknown language code: ${lang}, falling back to '${fallbackLang}'`);
    lang = fallbackLang;
  }

  if (assessmentsCache.has(lang)) {
    return assessmentsCache.get(lang)!;
  }

  if (assessmentsLoadingPromises.has(lang)) {
    return assessmentsLoadingPromises.get(lang)!;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data/${lang}/assessments.json`);
      if (!response.ok) {
        // No assessments for this language yet
        return [];
      }
      const data = await response.json();
      const rawAssessments: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray(data.assessments)
          ? data.assessments
          : [];
      const assessments = rawAssessments
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(normalizeAssessment);
      assessmentsCache.set(lang, assessments);
      return assessments;
    } catch (error) {
      console.log(`Failed to load assessments for ${lang}:`, error);
      return [];
    } finally {
      assessmentsLoadingPromises.delete(lang);
    }
  })();

  assessmentsLoadingPromises.set(lang, loadPromise);
  return loadPromise;
}

/**
 * Get a specific assessment by ID.
 */
export async function getAssessmentById(lang: string, assessmentId: string): Promise<Assessment | null> {
  const assessments = await loadAssessmentsData(lang);
  return assessments.find(a => a.id === assessmentId) || null;
}

/**
 * Get placement test for a language.
 */
export async function getPlacementTest(lang: string): Promise<Assessment | null> {
  const assessments = await loadAssessmentsData(lang);
  const placementTests = assessments.filter((assessment) => assessment.type === 'placement');
  const publishedPlacementTest = placementTests.find(
    (assessment) => (assessment as Assessment & { isPublished?: boolean }).isPublished === true
  );
  return publishedPlacementTest || placementTests[0] || null;
}

/**
 * Get checkpoint assessments for a specific level.
 */
export async function getCheckpointAssessments(lang: string, level?: string): Promise<Assessment[]> {
  const assessments = await loadAssessmentsData(lang);
  const checkpoints = assessments.filter(a => a.type === 'checkpoint');
  if (level) {
    return checkpoints.filter(a => a.targetLevel === level);
  }
  return checkpoints;
}

/**
 * Get mastery tests for a specific level.
 */
export async function getMasteryTests(lang: string, level?: string): Promise<Assessment[]> {
  const assessments = await loadAssessmentsData(lang);
  const masteryTests = assessments.filter(a => a.type === 'mastery');
  if (level) {
    return masteryTests.filter(a => a.targetLevel === level);
  }
  return masteryTests;
}

/**
 * Check if assessments are loaded for a language.
 */
export function isAssessmentsLoaded(lang: string): boolean {
  return assessmentsCache.has(lang);
}

/**
 * Preload assessments data for a language.
 */
export function preloadAssessmentsData(lang: string): void {
  if (!assessmentsCache.has(lang) && !assessmentsLoadingPromises.has(lang)) {
    loadAssessmentsData(lang).catch(() => {
      // Error already logged
    });
  }
}

// ============================================================================
// PRONUNCIATION DATA LOADING
// ============================================================================

// Cache for pronunciation data
const pronunciationCache = new Map<string, PronunciationDrill[]>();
const pronunciationLoadingPromises = new Map<string, Promise<PronunciationDrill[]>>();

/**
 * Load pronunciation drills for a specific language.
 * Fetches from public/data/{lang}/pronunciation.json via HTTP.
 */
export async function loadPronunciationData(lang: string): Promise<PronunciationDrill[]> {
  const fallbackLang = getFallbackLanguage();
  if (!isValidLanguageCode(lang)) {
    console.warn(`Unknown language code: ${lang}, falling back to '${fallbackLang}'`);
    lang = fallbackLang;
  }

  if (pronunciationCache.has(lang)) {
    return pronunciationCache.get(lang)!;
  }

  if (pronunciationLoadingPromises.has(lang)) {
    return pronunciationLoadingPromises.get(lang)!;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data/${lang}/pronunciation.json`);
      if (!response.ok) {
        // No pronunciation drills for this language yet
        return [];
      }
      const data = await response.json();
      const drills = Array.isArray(data) ? data : (data.drills || []);
      pronunciationCache.set(lang, drills);
      return drills;
    } catch (error) {
      console.log(`Failed to load pronunciation drills for ${lang}:`, error);
      return [];
    } finally {
      pronunciationLoadingPromises.delete(lang);
    }
  })();

  pronunciationLoadingPromises.set(lang, loadPromise);
  return loadPromise;
}

/**
 * Get pronunciation drill by ID.
 */
export async function getPronunciationDrillById(lang: string, drillId: string): Promise<PronunciationDrill | null> {
  const drills = await loadPronunciationData(lang);
  return drills.find(d => d.id === drillId) || null;
}

/**
 * Get pronunciation drills by type.
 */
export async function getPronunciationDrillsByType(
  lang: string,
  type: PronunciationDrill['type']
): Promise<PronunciationDrill[]> {
  const drills = await loadPronunciationData(lang);
  return drills.filter(d => d.type === type);
}

/**
 * Get pronunciation drills by level.
 */
export async function getPronunciationDrillsByLevel(
  lang: string,
  level: string
): Promise<PronunciationDrill[]> {
  const drills = await loadPronunciationData(lang);
  return drills.filter(d => d.level === level);
}

/**
 * Get pronunciation drills by difficulty.
 */
export async function getPronunciationDrillsByDifficulty(
  lang: string,
  difficulty: PronunciationDrill['difficulty']
): Promise<PronunciationDrill[]> {
  const drills = await loadPronunciationData(lang);
  return drills.filter(d => d.difficulty === difficulty);
}

/**
 * Check if pronunciation data is loaded for a language.
 */
export function isPronunciationLoaded(lang: string): boolean {
  return pronunciationCache.has(lang);
}

/**
 * Preload pronunciation data for a language.
 */
export function preloadPronunciationData(lang: string): void {
  if (!pronunciationCache.has(lang) && !pronunciationLoadingPromises.has(lang)) {
    loadPronunciationData(lang).catch(() => {
      // Error already logged
    });
  }
}
