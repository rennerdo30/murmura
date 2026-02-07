// Shared type definitions

// Curriculum and gamification types
export * from './curriculum';
export * from './gamification';
export * from './exercises';
export * from './paths';
export * from './reviews';

// Japanese character types
export type JapaneseCharacterType = 'gojuon' | 'yoon' | 'dakuten' | 'handakuten';
// Korean character types
export type KoreanCharacterType = 'consonant' | 'vowel' | 'double_consonant' | 'compound_vowel';
// Combined character type for multi-language support
export type CharacterType = JapaneseCharacterType | KoreanCharacterType;

export interface Character {
  id?: string | number;
  romaji: string;         // Required - romanization of the character
  romanization?: string;  // Admin export field name (alias)
  hiragana?: string;
  char?: string;          // Admin export field name (use as fallback)
  character?: string;     // Korean field name
  type: CharacterType;
  audioUrl?: string;
  audio_url?: string;     // Legacy snake_case support
  // Learn mode extensions
  group?: string;
  order?: number;
  name?: string;
  mnemonic?: {
    en: string;
    es?: string;
    [key: string]: string | undefined;
  };
  // Additional fields from admin export
  meaning?: string;
  meanings?: string[];
  language_id?: number;
}

// Extended character type for Korean with native field name
export interface KoreanCharacter {
  id?: string | number;
  romaji: string;         // Required - romanization of the character
  romanization?: string;  // Admin export field name (alias)
  character?: string;
  char?: string;          // Admin export field name (use as fallback)
  type: KoreanCharacterType;
  name?: string;
  group?: string;
  order?: number;
  mnemonic?: {
    en: string;
    es?: string;
    [key: string]: string | undefined;
  };
  audioUrl?: string;
  audio_url?: string;     // Legacy snake_case support
  meaning?: string;
  meanings?: string[];
  language_id?: number;
}

// Lesson structure for alphabet learning
export interface AlphabetLesson {
  id: string | number;
  name: string;
  slug?: string;
  type?: string;
  nameKey?: string;
  content?: {
    characters: string[];
  };
  characters?: string[]; // Legacy
  prerequisite?: string | null;
  prerequisite_slug?: string | null;
  estimatedMinutes?: number;
  estimated_minutes?: number;
}

// Alphabet lesson path configuration
export interface AlphabetLessonPath {
  name: string;
  nameKey?: string;
  description: string;
  descriptionKey?: string;
  lessons: AlphabetLesson[];
}

export interface Filter {
  id: string;
  label: string;
  checked: boolean;
  type: 'checkbox' | 'radio';
  name?: string;
}

export interface VocabularyItem {
  id: string;
  word: string;
  reading: string;
  meaning: string; // Legacy: kept for backward compatibility, use meanings instead
  meanings?: Record<string, string | string[]>; // Language code -> meaning translation (string or array)
  romaji?: string;
  jlpt?: string;
  level?: string; // Generic level field for non-Japanese languages (CEFR, TOPIK, HSK, etc.)
  framework?: string;
  part_of_speech?: string;
  tags?: string[];
  examples?: Array<{
    sentence: string;
    translation: string;
    romaji?: string;
  }>;
  audioUrl?: string;
  audio_url?: string; // Legacy snake_case support
  language_id?: number;
  content_translations?: Record<string, unknown>;
  [key: string]: unknown; // Allow additional properties for type checking
}

export interface KanjiItem {
  id: string;
  kanji: string;       // For Japanese kanji (required for backwards compat)
  char?: string;       // Raw character from admin export (alias)
  hanzi?: string;      // For Chinese characters (alias)
  character?: string;  // For Korean hangul (alias)
  meaning: string; // Legacy: kept for backward compatibility, use meanings instead
  meanings?: Record<string, string> | string[]; // Language code -> meaning translation or array
  onyomi: string[];    // Japanese on-reading (required for backwards compat)
  kunyomi: string[];   // Japanese kun-reading (required for backwards compat)
  pinyin?: string;     // Chinese romanization
  romanization?: string;
  romaji?: string;     // Alias for romanization
  strokes?: number;
  jlpt?: string;
  hsk?: string;        // Chinese HSK level
  level?: string;      // Generic level field
  radicals?: string[];
  audioUrl?: string;
  audio_url?: string;  // Legacy snake_case support
  type?: string;       // Character type (kanji, hiragana, katakana, hangul, etc.)
  examples?: Array<{
    word: string;
    reading: string;
    meaning: string; // Legacy
    meanings?: Record<string, string>; // Language code -> meaning translation
    pinyin?: string;
    audioUrl?: string;
  }>;
  language_id?: number;
  script_id?: number;
  content_translations?: { meaning?: Record<string, string> } | null;
}

// Common mistake interface for enhanced grammar
export interface CommonMistake {
  mistake: string;
  correction: string;
  explanation: string;
}

// Error correction interface for enhanced grammar
export interface ErrorCorrection {
  wrong: string;
  correct: string;
  explanation: string;
}

// Formality level type
export type FormalityLevel = 'casual' | 'polite' | 'formal' | 'humble' | 'any';

// Cognitive level for exercises
export type CognitiveLevel = 'recognition' | 'supported' | 'guided' | 'independent';

// Skill focus for exercises
export type SkillFocus = 'reading' | 'writing' | 'listening' | 'speaking' | 'grammar';

// Exercise difficulty
export type ExerciseDifficulty = 'easy' | 'medium' | 'hard';

export interface GrammarItem {
  id: string;
  title: string;
  titleTranslations?: Record<string, string>; // Language code -> title translation
  rule?: string;
  explanation: string; // Legacy: English explanation
  explanations?: Record<string, string>; // Language code -> explanation translation
  patterns?: string[];
  examples: Array<{
    japanese?: string;
    korean?: string;
    chinese?: string;
    spanish?: string;
    german?: string;
    italian?: string;
    english: string; // Legacy
    translations?: Record<string, string>; // Language code -> translation
    audioUrl?: string;
    reading?: string;
    register?: 'casual' | 'polite' | 'formal';
    isIncorrect?: boolean;
    [key: string]: unknown; // Allow language-specific fields
  }>;
  exercises?: Array<{
    type?: string;
    question: string;
    questionTranslations?: Record<string, string>; // Language code -> question translation
    options: string[];
    optionTranslations?: Record<string, string[]>; // Language code -> options translations
    correct: number;
    answer?: string;
    explanation?: string;
    // Enhanced exercise fields
    wrongAnswerExplanations?: Record<string, string>;
    cognitiveLevel?: CognitiveLevel;
    skillFocus?: SkillFocus;
    difficulty?: ExerciseDifficulty;
  }>;
  jlpt?: string;
  level?: string;
  framework?: string;
  audioUrl?: string;
  audio_url?: string;
  language_id?: number;
  content_translations?: Record<string, unknown>;
  // Enhanced grammar fields
  formation?: string;
  formalityLevel?: FormalityLevel;
  pragmaticNotes?: string;
  commonMistakes?: CommonMistake[];
  errorCorrections?: ErrorCorrection[];
  negativeForm?: string;
  questionForm?: string;
  conjugationTable?: Record<string, string>;
  prerequisiteGrammar?: string[];
  relatedGrammar?: string[];
}

export interface ReadingItem {
  id: string | number;
  title: string;
  titleTranslations?: Record<string, string>; // Language code -> title translation
  text: string;
  translation?: string;
  level: string;
  framework?: string;
  audioUrl?: string;
  audio_url?: string; // Legacy snake_case support
  vocabulary?: Array<{
    word: string;
    reading: string;
    meaning: string; // Legacy
    meanings?: Record<string, string>; // Language code -> meaning translation
  }>;
  vocabulary_ids?: number[];
  grammar_ids?: number[];
  questions?: Array<{
    question: string;
    questionTranslations?: Record<string, string>; // Language code -> question translation
    options: string[];
    optionTranslations?: Record<string, string[]>; // Language code -> options translations
    correct: number;
  }>;
  language_id?: number;
  content_translations?: Record<string, unknown>;
}

export interface ListeningExercise {
  id: string | number;
  title: string;
  level: string;
  framework?: string;
  type?: 'dialogue' | 'monologue' | 'announcement' | 'interview' | 'news';
  text: string;
  transcript?: string;
  translation?: string;
  audioUrl?: string;
  audio_url?: string; // Legacy snake_case support
  duration_seconds?: number;
  questions?: Array<{
    question: string;
    options: string[];
    correct: number;
    explanation?: string;
  }>;
  vocabulary_ids?: number[];
  grammar_ids?: number[];
  language_id?: number;
  lesson_id?: number;
}

export interface ModuleStats {
  correct?: number;
  total?: number;
  streak?: number;
  bestStreak?: number;
  wordsMastered?: number;
  kanjiMastered?: number;
  pointsMastered?: number;
  comprehensionScore?: number;
  comprehensionTotal?: number;
  comprehensionCorrect?: number;
  totalAttempts?: number;
  exercisesCompleted?: number;
  textsRead?: number;
  accuracy?: number;
}

// SRS Review data for spaced repetition
export interface ReviewData {
  interval: number;
  easeFactor: number;
  repetitions: number;
  quality: number[];
  lastReview: number;
  nextReview: number;
}

export interface ModuleData {
  learned?: string[];
  reviews?: Record<string, ReviewData>;
  stats: ModuleStats;
  completed?: string[];
}

// Global stats structure
export interface GlobalStats {
  streak: number;
  bestStreak: number;
  totalStudyTime: number;
  lastActive: number | null;
  createdAt: number;
}

// Storage data structure for progress tracking
export interface StorageData {
  userId?: string | null;
  modules: Record<string, ModuleData>;
  globalStats: GlobalStats;
  // Legacy module properties (deprecated, use modules instead)
  alphabet?: ModuleData;
  vocabulary?: ModuleData;
  kanji?: ModuleData;
  grammar?: ModuleData;
  reading?: ModuleData;
  listening?: ModuleData;
}
