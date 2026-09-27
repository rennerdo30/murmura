// Curriculum types for lesson-based learning paths

import type { Exercise } from './exercises';

// Vocabulary item with full details (from AI-generated lessons)
export interface LessonVocabItem {
  word: string;
  reading?: string;
  romaji?: string;
  meaning: string;
  partOfSpeech?: string;
  usageNote?: string;
  level?: string;
}

// Grammar item with full details (from AI-generated lessons)
export interface LessonGrammarItem {
  pattern: string;
  meaning: string;
  formation?: string;
  usageNotes?: string;
  level?: string;
}

// Example sentence from AI-generated lessons
export interface LessonExampleSentence {
  target: string;
  reading?: string;
  translation: string;
  vocabUsed: string[];
  grammarUsed: string[];
}

export interface LessonContent {
  topics: string[];
  topicTranslations?: Array<Record<string, string>>;  // UI language translations for topics
  // Support both string[] (legacy) and LessonVocabItem[] (new format)
  vocab_focus: string[] | LessonVocabItem[];
  kanji_focus?: string[];
  // Support both string[] (legacy) and LessonGrammarItem[] (new format)
  grammar_focus?: string[] | LessonGrammarItem[];
  cultural_notes?: string[];
  // Example sentences showing vocabulary and grammar in context
  exampleSentences?: LessonExampleSentence[];
  // Description translations (from export)
  description?: string;
  descriptionTranslations?: Record<string, string>;
}

export interface CurriculumLesson {
  id: string;              // "A1-U1-L1" or "es-a1-vocab-l1"
  legacyModule?: string;   // Legacy milestone points to a study module, not lesson content
  milestoneId?: string;    // Parent milestone reference
  title: string;
  titleTranslations?: Record<string, string>;  // UI language translations
  description: string;
  descriptionTranslations?: Record<string, string>;  // UI language translations
  content: LessonContent;
  exercises?: Exercise[];  // Exercises for this lesson
  estimatedMinutes?: number;
}

export interface CurriculumUnit {
  id: string;              // "A1-U1"
  title: string;
  description: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumLevel {
  level: string;           // "A1", "N5", etc.
  description: string;
  units: CurriculumUnit[];
}

export interface Curriculum {
  language_code: string;
  levels: CurriculumLevel[];
}

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  startedAt?: number;
  completedAt?: number;
  score?: number;
  xpEarned?: number;
  attempts: number;
}

// Context info returned when looking up a lesson
export interface LessonContext {
  level: CurriculumLevel;
  unit: CurriculumUnit;
  lesson: CurriculumLesson;
  levelIndex: number;
  unitIndex: number;
  lessonIndex: number;
}

// Flattened lesson with context
export interface FlattenedLesson {
  lesson: CurriculumLesson;
  levelId: string;
  unitId: string;
  levelIndex: number;
  unitIndex: number;
  lessonIndex: number;
}
