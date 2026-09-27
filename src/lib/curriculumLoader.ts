/**
 * Curriculum Loader - Load and navigate curriculum data for lesson-based learning
 *
 * This module handles loading curriculum.json files for different languages
 * and provides utilities to navigate the curriculum structure.
 */

import type {
  Curriculum,
  CurriculumLevel,
  CurriculumUnit,
  CurriculumLesson,
  LessonContext,
  FlattenedLesson,
} from '@/types/curriculum';
import { isLanguageAvailable } from './language';

// Cache for loaded curricula
const curriculumCache = new Map<string, Curriculum | null>();

// Cache for loaded lessons
const lessonsCache = new Map<string, CurriculumLesson[]>();

// Request deduplication - track in-flight requests
const curriculumLoadingPromises = new Map<string, Promise<Curriculum | null>>();
const lessonsLoadingPromises = new Map<string, Promise<CurriculumLesson[]>>();

// Cache for content unavailability (prevents repeated 404s)
const contentUnavailableCache = new Set<string>();

// AI-generated lesson vocabulary item format
interface AILessonVocabItem {
  word: string;
  reading?: string;
  romaji?: string;
  meaning: string;
  partOfSpeech?: string;
  usageNote?: string;
  level?: string;
}

// AI-generated lesson grammar item format
interface AILessonGrammarItem {
  pattern: string;
  meaning: string;
  formation?: string;
  usageNotes?: string;
  level?: string;
}

// AI-generated lesson example sentence format
interface AILessonExampleSentence {
  target: string;
  reading?: string;
  translation: string;
  vocabUsed: string[];
  grammarUsed: string[];
}

// AI-generated exercise format
interface AILessonExercise {
  id: string;
  type: string;
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string;
  sentence?: string;
  blankPosition?: number;
}

// AI-generated lesson format (from ai-lessons.json)
// Supports both legacy string[] and new object[] formats
interface AILesson {
  id: number;
  slug: string;
  name: string;
  nameTranslations?: Record<string, string>;  // UI language translations
  type?: string;
  content: {
    description?: string;
    descriptionTranslations?: Record<string, string>;  // UI language translations
    objectives?: string[];
    objectivesTranslations?: Array<Record<string, string>>;  // Per-objective translations
    vocabulary?: (string | AILessonVocabItem)[];
    grammar?: (string | AILessonGrammarItem)[];
    exampleSentences?: AILessonExampleSentence[];
  };
  exercises?: AILessonExercise[];
  prerequisite_slug?: string;
  estimated_minutes?: number;
}

/**
 * Transform AI-generated lesson format to CurriculumLesson format
 * Preserves both legacy string[] and new object[] formats for vocab/grammar
 */
function transformAILesson(aiLesson: AILesson): CurriculumLesson {
  // Pass through vocabulary and grammar as-is to preserve object format
  // The LessonContent type supports both string[] and object[] via union types
  const vocabFocus = aiLesson.content?.vocabulary || [];
  const grammarFocus = aiLesson.content?.grammar || [];
  const exampleSentences = aiLesson.content?.exampleSentences;

  // Transform exercises to the frontend Exercise type
  const exercises = aiLesson.exercises?.map((ex) => {
    // Map exercise types
    if (ex.type === 'multiple_choice' && ex.options && ex.correctIndex !== undefined) {
      return {
        id: ex.id,
        type: 'multiple_choice' as const,
        question: ex.question,
        options: ex.options,
        correctIndex: ex.correctIndex,
      };
    } else if (ex.type === 'fill_blank' && ex.correctAnswer) {
      return {
        id: ex.id,
        type: 'fill_blank' as const,
        sentence: ex.sentence || ex.question,
        blankPosition: ex.blankPosition || 0,
        correctAnswer: ex.correctAnswer,
      };
    }
    // Default to multiple choice format
    return {
      id: ex.id,
      type: 'multiple_choice' as const,
      question: ex.question,
      options: ex.options || [],
      correctIndex: ex.correctIndex || 0,
    };
  });

  return {
    id: aiLesson.slug,
    title: aiLesson.name,
    titleTranslations: aiLesson.nameTranslations,
    description: aiLesson.content?.description || '',
    descriptionTranslations: aiLesson.content?.descriptionTranslations,
    content: {
      topics: aiLesson.content?.objectives || [],
      topicTranslations: aiLesson.content?.objectivesTranslations,
      vocab_focus: vocabFocus as CurriculumLesson['content']['vocab_focus'],
      grammar_focus: grammarFocus as CurriculumLesson['content']['grammar_focus'],
      exampleSentences: exampleSentences as CurriculumLesson['content']['exampleSentences'],
    },
    exercises,
    estimatedMinutes: aiLesson.estimated_minutes,
  };
}

/**
 * Validate that a language code is in the allowed list
 * Uses dynamic config instead of hardcoded whitelist
 */
function isValidLanguageCode(langCode: string): boolean {
  // Basic validation to prevent path traversal
  if (!langCode || langCode.includes('/') || langCode.includes('..')) {
    return false;
  }
  return isLanguageAvailable(langCode);
}

// Legacy path curriculum structure (from existing curriculum.json)
interface LegacyPathMilestone {
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
}

interface LegacyPath {
  path: {
    id: number;
    slug: string;
    name: string;
    description: string;
    type: string;
    estimated_hours: number;
    difficulty: string;
    language_id: number;
  };
  milestones: LegacyPathMilestone[];
}

/**
 * Transform legacy curriculum format to new curriculum structure
 */
function transformLegacyCurriculum(legacyData: LegacyPath[], langCode: string): Curriculum {
  // Group milestones by level
  const levelMap = new Map<string, LegacyPathMilestone[]>();

  for (const path of legacyData) {
    for (const milestone of path.milestones) {
      const existing = levelMap.get(milestone.level) || [];
      existing.push(milestone);
      levelMap.set(milestone.level, existing);
    }
  }

  const levels: CurriculumLevel[] = [];

  for (const [levelName, milestones] of levelMap) {
    // Create a single unit per level containing all milestones as lessons
    const lessons: CurriculumLesson[] = milestones.map((m) => ({
      id: m.slug,
      legacyModule: m.module,
      title: m.name,
      description: m.description,
      content: {
        topics: [m.module],
        vocab_focus: [],
        grammar_focus: [],
      },
      estimatedMinutes: (m.estimated_hours || 1) * 60,
    }));

    levels.push({
      level: levelName,
      description: `${levelName} level content`,
      units: [{
        id: `${langCode}-${levelName.toLowerCase()}-core`,
        title: `${levelName} Core`,
        description: `Core ${levelName} content`,
        lessons,
      }],
    });
  }

  return {
    language_code: langCode,
    levels,
  };
}

/**
 * Load curriculum data for a language
 * Uses request deduplication to prevent duplicate concurrent requests.
 *
 * @param langCode - Language code (e.g., 'es', 'ja')
 * @returns Promise resolving to Curriculum or null if not found
 */
export async function loadCurriculum(langCode: string): Promise<Curriculum | null> {
  // Validate language code to prevent path traversal
  if (!isValidLanguageCode(langCode)) {
    console.warn(`Invalid language code: ${langCode}`);
    return null;
  }

  // Check cache first
  if (curriculumCache.has(langCode)) {
    return curriculumCache.get(langCode) || null;
  }

  // Check if already loading - return existing promise
  if (curriculumLoadingPromises.has(langCode)) {
    return curriculumLoadingPromises.get(langCode)!;
  }

  // Create and store the loading promise
  const loadPromise = (async (): Promise<Curriculum | null> => {
    try {
      // Try to fetch the curriculum JSON
      const response = await fetch(`/data/${langCode}/curriculum.json`);

      if (!response.ok) {
        curriculumCache.set(langCode, null);
        return null;
      }

      const data = await response.json();

      // Check if it's the new format (has levels property directly)
      // or legacy format (array of path objects)
      let curriculum: Curriculum;

      if (Array.isArray(data)) {
        // Legacy format - transform it
        curriculum = transformLegacyCurriculum(data as LegacyPath[], langCode);
      } else if (data.levels) {
        // New format - use directly
        curriculum = data as Curriculum;
      } else {
        // Unknown format
        console.warn(`Unknown curriculum format for ${langCode}`);
        curriculumCache.set(langCode, null);
        return null;
      }

      curriculumCache.set(langCode, curriculum);
      return curriculum;
    } catch (error) {
      console.error(`Failed to load curriculum for ${langCode}:`, error);
      curriculumCache.set(langCode, null);
      return null;
    } finally {
      curriculumLoadingPromises.delete(langCode);
    }
  })();

  curriculumLoadingPromises.set(langCode, loadPromise);
  return loadPromise;
}

/**
 * Load lessons data for a language from lessons.json and ai-lessons.json
 * Uses request deduplication to prevent duplicate concurrent requests.
 *
 * @param langCode - Language code (e.g., 'es', 'ja')
 * @returns Promise resolving to array of lessons or empty array
 */
export async function loadLessons(langCode: string): Promise<CurriculumLesson[]> {
  // Validate language code to prevent path traversal
  if (!isValidLanguageCode(langCode)) {
    console.warn(`Invalid language code: ${langCode}`);
    return [];
  }

  // Check cache first
  if (lessonsCache.has(langCode)) {
    return lessonsCache.get(langCode) || [];
  }

  // Check if already loading - return existing promise
  if (lessonsLoadingPromises.has(langCode)) {
    return lessonsLoadingPromises.get(langCode)!;
  }

  // Create and store the loading promise
  const loadPromise = (async (): Promise<CurriculumLesson[]> => {
    const allLessons: CurriculumLesson[] = [];

    try {
      // Try to load legacy lessons.json
      const legacyResponse = await fetch(`/data/${langCode}/lessons.json`);
      if (legacyResponse.ok) {
        const legacyLessons = await legacyResponse.json() as CurriculumLesson[];
        if (Array.isArray(legacyLessons)) {
          allLessons.push(...legacyLessons);
        }
      }
    } catch (error) {
      console.warn(`Failed to load legacy lessons for ${langCode}:`, error);
    }

    // Only try to load AI lessons if not already cached as unavailable
    const aiLessonsCacheKey = `ai-lessons-${langCode}`;
    if (!contentUnavailableCache.has(aiLessonsCacheKey)) {
      try {
        // Try to load AI-generated lessons
        const aiResponse = await fetch(`/data/${langCode}/ai-lessons.json`);
        if (aiResponse.ok) {
          const aiLessons = await aiResponse.json() as AILesson[];
          if (Array.isArray(aiLessons)) {
            // Transform AI lessons to CurriculumLesson format
            const transformedLessons = aiLessons.map(transformAILesson);
            allLessons.push(...transformedLessons);
          }
        } else {
          // Cache the 404 to prevent repeated requests
          contentUnavailableCache.add(aiLessonsCacheKey);
        }
      } catch (error) {
        // Cache failure to prevent repeated requests
        contentUnavailableCache.add(aiLessonsCacheKey);
      }
    }

    lessonsCache.set(langCode, allLessons);
    return allLessons;
  })();

  lessonsLoadingPromises.set(langCode, loadPromise);
  return loadPromise;
}

/**
 * Get lessons for a specific milestone
 *
 * @param lessons - Array of all lessons
 * @param milestoneId - The milestone ID (slug) to filter by
 * @returns Array of lessons for that milestone
 */
export function getLessonsByMilestone(
  lessons: CurriculumLesson[],
  milestoneId: string
): CurriculumLesson[] {
  return lessons.filter((lesson) => lesson.milestoneId === milestoneId);
}

/**
 * Clear the lessons cache
 */
export function clearLessonsCache(): void {
  lessonsCache.clear();
}

/**
 * Find a lesson by ID within a curriculum
 *
 * @param curriculum - The curriculum to search
 * @param lessonId - The lesson ID to find
 * @returns The lesson or undefined if not found
 */
export function getCurriculumLesson(
  curriculum: Curriculum,
  lessonId: string
): CurriculumLesson | undefined {
  for (const level of curriculum.levels) {
    for (const unit of level.units) {
      const lesson = unit.lessons.find((l) => l.id === lessonId);
      if (lesson) {
        return lesson;
      }
    }
  }
  return undefined;
}

/**
 * Find a lesson by ID from loaded lessons data
 *
 * @param lessons - Array of loaded lessons
 * @param lessonId - The lesson ID to find
 * @returns The lesson or undefined if not found
 */
export function getLessonById(
  lessons: CurriculumLesson[],
  lessonId: string
): CurriculumLesson | undefined {
  return lessons.find((l) => l.id === lessonId);
}

/**
 * Get full context for a lesson (level, unit, indices)
 *
 * @param curriculum - The curriculum to search
 * @param lessonId - The lesson ID to find
 * @returns LessonContext or null if not found
 */
export function getLessonContext(
  curriculum: Curriculum,
  lessonId: string
): LessonContext | null {
  for (let li = 0; li < curriculum.levels.length; li++) {
    const level = curriculum.levels[li];
    for (let ui = 0; ui < level.units.length; ui++) {
      const unit = level.units[ui];
      for (let lei = 0; lei < unit.lessons.length; lei++) {
        const lesson = unit.lessons[lei];
        if (lesson.id === lessonId) {
          return {
            level,
            unit,
            lesson,
            levelIndex: li,
            unitIndex: ui,
            lessonIndex: lei,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Flatten all lessons in a curriculum into a single array with context
 *
 * @param curriculum - The curriculum to flatten
 * @returns Array of FlattenedLesson objects in order
 */
export function flattenLessons(curriculum: Curriculum): FlattenedLesson[] {
  const flattened: FlattenedLesson[] = [];

  for (let li = 0; li < curriculum.levels.length; li++) {
    const level = curriculum.levels[li];
    for (let ui = 0; ui < level.units.length; ui++) {
      const unit = level.units[ui];
      for (let lei = 0; lei < unit.lessons.length; lei++) {
        const lesson = unit.lessons[lei];
        flattened.push({
          lesson,
          levelId: level.level,
          unitId: unit.id,
          levelIndex: li,
          unitIndex: ui,
          lessonIndex: lei,
        });
      }
    }
  }

  return flattened;
}

/**
 * Get the next lesson after a given lesson ID
 *
 * @param curriculum - The curriculum to search
 * @param currentId - The current lesson ID
 * @returns The next lesson or null if at the end
 */
export function getNextLesson(
  curriculum: Curriculum,
  currentId: string
): CurriculumLesson | null {
  const flattened = flattenLessons(curriculum);
  const currentIndex = flattened.findIndex((f) => f.lesson.id === currentId);

  if (currentIndex === -1 || currentIndex >= flattened.length - 1) {
    return null;
  }

  return flattened[currentIndex + 1].lesson;
}

/**
 * Get the previous lesson before a given lesson ID
 *
 * @param curriculum - The curriculum to search
 * @param currentId - The current lesson ID
 * @returns The previous lesson or null if at the start
 */
export function getPreviousLesson(
  curriculum: Curriculum,
  currentId: string
): CurriculumLesson | null {
  const flattened = flattenLessons(curriculum);
  const currentIndex = flattened.findIndex((f) => f.lesson.id === currentId);

  if (currentIndex <= 0) {
    return null;
  }

  return flattened[currentIndex - 1].lesson;
}

/**
 * Get all lessons for a specific level
 *
 * @param curriculum - The curriculum to search
 * @param levelId - The level ID (e.g., "A1", "N5")
 * @returns Array of lessons for that level
 */
export function getLessonsForLevel(
  curriculum: Curriculum,
  levelId: string
): CurriculumLesson[] {
  const level = curriculum.levels.find((l) => l.level === levelId);
  if (!level) return [];

  return level.units.flatMap((unit) => unit.lessons);
}

/**
 * Get total lesson count in curriculum
 */
export function getTotalLessonCount(curriculum: Curriculum): number {
  return curriculum.levels.reduce(
    (total, level) =>
      total + level.units.reduce(
        (unitTotal, unit) => unitTotal + unit.lessons.length,
        0
      ),
    0
  );
}

/**
 * Check if a curriculum has any content
 */
export function hasCurriculumContent(curriculum: Curriculum | null): boolean {
  if (!curriculum) return false;
  return curriculum.levels.length > 0 &&
    curriculum.levels.some((l) =>
      l.units.length > 0 &&
      l.units.some((u) => u.lessons.length > 0)
    );
}

/**
 * Clear the curriculum cache (useful for testing or forced refresh)
 */
export function clearCurriculumCache(): void {
  curriculumCache.clear();
}
