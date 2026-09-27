'use client'

import { useState, useEffect, useCallback, useRef, useMemo, MutableRefObject } from 'react';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatsPanel from '@/components/common/StatsPanel';
import Timer from '@/components/common/Timer';
import MultipleChoice from '@/components/common/MultipleChoice';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import { LearnModeToggle, CharacterLesson, LessonProgress, AlphabetMode, LessonCharacter } from '@/components/alphabet';
import { Container, Input, CharacterCard, CharacterDisplay, OptionsPanel, InputSection, Toggle, Chip, Text } from '@/components/ui';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useMobile } from '@/hooks/useMobile';
import { useTTS } from '@/hooks/useTTS';
import { useTimer } from '@/hooks/useTimer';
import { Character, Filter, AlphabetLesson } from '@/types';
import { toKatakana } from 'wanakana';
import { IoSchool, IoFilter } from 'react-icons/io5';
import { getModuleName } from '@/lib/learningModules';
import study from '@/styles/study.module.css';
import styles from './alphabet.module.css';

// Bundled fallback character data, used when the exported dataset is missing or empty
import jaKanaJson from '@/data/ja/kana.json';
import koCharactersJson from '@/data/ko/characters.json';

const TIME_PER_CHARACTER = 5;

// Define extended character type for Korean
interface KoreanCharacterData {
    romaji: string;
    character: string;
    type: 'consonant' | 'vowel' | 'double_consonant' | 'compound_vowel';
    name?: string;
    group?: string;
    order?: number;
    mnemonic?: {
        en: string;
        es?: string;
        [key: string]: string | undefined;
    };
    audioUrl?: string;
}

// Define extended character type for Japanese with metadata
interface JapaneseCharacterData {
    romaji: string;
    hiragana: string;
    type: 'gojuon' | 'yoon' | 'dakuten' | 'handakuten';
    group?: string;
    order?: number;
    mnemonic?: {
        en: string;
        es?: string;
        [key: string]: string | undefined;
    };
    audioUrl?: string;
}

// Normalize Korean characters 
const normalizeKoreanCharacter = (char: any): Character => {
    const rawType = char.type === 'alphabet' ? char.group : char.type;
    // Map plural groups to singular types expected by filters
    const typeMapping: Record<string, string> = {
        'consonants': 'consonant',
        'vowels': 'vowel',
        'double_consonants': 'double_consonant',
        'compound_vowels': 'compound_vowel'
    };

    return {
        romaji: char.romaji || char.romanization || '',
        hiragana: char.hiragana || char.character || char.char || '',
        type: typeMapping[rawType] || rawType || 'consonant',
        audioUrl: char.audioUrl || char.audio_url,
        group: char.group,
        order: char.order || char.sort_order,
        name: char.name,
        mnemonic: char.mnemonic,
    };
};

// Normalize Japanese characters
const normalizeJapaneseCharacter = (char: any): Character => ({
    romaji: char.romaji || char.romanization || '',
    hiragana: char.hiragana || char.char || '',
    type: char.type || 'gojuon',
    audioUrl: char.audioUrl || char.audio_url,
    group: char.group,
    order: char.order || char.sort_order,
    name: char.name,
    mnemonic: char.mnemonic,
});

// Get characters based on target language (Static fallback)
const getStaticCharacterData = (lang: string): Character[] => {
    switch (lang) {
        case 'ko':
            return (koCharactersJson as KoreanCharacterData[]).map(normalizeKoreanCharacter);
        case 'ja':
            return jaKanaJson.map(normalizeJapaneseCharacter);
        default:
            return [];
    }
};

// Filter configurations per language
interface FilterConfig {
    id: string;
    labelKey: string;
    types: string[];
}

const FILTER_CONFIGS: Record<string, FilterConfig[]> = {
    ja: [
        { id: 'gojuon', labelKey: 'alphabet.filters.gojuon', types: ['gojuon'] },
        { id: 'yoon', labelKey: 'alphabet.filters.yoon', types: ['yoon'] },
        { id: 'dakuten', labelKey: 'alphabet.filters.dakuten', types: ['dakuten', 'handakuten'] },
    ],
    ko: [
        { id: 'consonant', labelKey: 'alphabet.filters.consonant', types: ['consonant'] },
        { id: 'vowel', labelKey: 'alphabet.filters.vowel', types: ['vowel'] },
        { id: 'double_consonant', labelKey: 'alphabet.filters.doubleConsonant', types: ['double_consonant'] },
        { id: 'compound_vowel', labelKey: 'alphabet.filters.compoundVowel', types: ['compound_vowel'] },
    ],
};

// Toggle configurations per language
interface ToggleConfig {
    enabled: boolean;
    options: { id: string; labelKey: string }[];
}

const TOGGLE_CONFIGS: Record<string, ToggleConfig> = {
    ja: {
        enabled: true,
        options: [
            { id: 'hiragana', labelKey: 'alphabet.hiragana' },
            { id: 'katakana', labelKey: 'alphabet.katakana' },
        ],
    },
    ko: {
        enabled: false, // Korean Hangul doesn't have a hiragana/katakana equivalent
        options: [],
    },
};

type InputState = '' | 'error' | 'success';

export default function AlphabetPage() {
    const { updateModuleStats: updateStats, getModuleData } = useProgressContext();
    const { t, language } = useLanguage();
    const { targetLanguage } = useTargetLanguage();
    const isMobile = useMobile();
    const { speakAndWait, preloadAudio, preloadBatch } = useTTS();
    const preloadedAudioRef = useRef<HTMLAudioElement | null>(null);

    // Mode toggle state (learn vs practice)
    const [mode, setMode] = useState<AlphabetMode>('learn');

    // Learn mode state
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [learnedCharacters, setLearnedCharacters] = useState<Set<string>>(new Set());
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);

    // Practice mode state
    const [currentChar, setCurrentChar] = useState<Character | null>(null);
    const [correct, setCorrect] = useState(0);
    const [total, setTotal] = useState(0);
    const [streak, setStreak] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // Use refs to track current stats values for updateStats to avoid stale closures
    const statsRef = useRef({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
    const [inputValue, setInputValue] = useState('');
    const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<string[]>([]);
    const [useHiragana, setUseHiragana] = useState(true);
    const [isCharacterEntering, setIsCharacterEntering] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [inputState, setInputState] = useState<InputState>('');
    const [showMultipleChoiceFeedback, setShowMultipleChoiceFeedback] = useState(false);
    const [selectedMultipleChoiceIndex, setSelectedMultipleChoiceIndex] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // State for characters and lessons
    const [characters, setCharacters] = useState<Character[]>([]);
    const [lessons, setLessons] = useState<AlphabetLesson[]>([]);

    // Fetch data
    useEffect(() => {
        const loadData = async () => {
            // Try to load from generated JSON in public/data for the target language
            try {
                // Load characters
                const charRes = await fetch(`/data/${targetLanguage}/characters.json`);
                const data: unknown = charRes.ok ? await charRes.json() : null;
                if (Array.isArray(data) && data.length > 0) {

                    // Normalize based on language
                    let normalized: Character[];
                    if (targetLanguage === 'ko') {
                        normalized = data.map(normalizeKoreanCharacter);
                    } else {
                        normalized = data.map(normalizeJapaneseCharacter);
                    }

                    // For Japanese, apply strict Hiragana filter
                    if (targetLanguage === 'ja') {
                        normalized = normalized.filter((c: Character) =>
                            c.hiragana && /[\u3040-\u309F]/.test(c.hiragana)
                        );
                    }

                    setCharacters(normalized);

                    // If we successfully loaded characters, also try to load lessons
                    const lessonRes = await fetch(`/data/${targetLanguage}/lessons.json`);
                    const lessonData: unknown = lessonRes.ok ? await lessonRes.json() : null;
                    if (Array.isArray(lessonData) && lessonData.length > 0) {
                        setLessons(lessonData);
                    } else {
                        // Nothing to learn step by step; open practice instead of an empty Learn tab
                        setLessons([]);
                        setMode('practice');
                    }
                    return;
                }
            } catch (error) {
                console.warn(`Failed to load dynamic data for ${targetLanguage}, falling back to static:`, error);
            }

            // Fallback to static data (mostly for Korean or if fetch fails)
            setCharacters(getStaticCharacterData(targetLanguage));
            setLessons([]); // No static lessons for now
            setMode('practice');
        };

        loadData();
    }, [targetLanguage]);

    const filterConfig = useMemo(() => FILTER_CONFIGS[targetLanguage] || FILTER_CONFIGS.ja, [targetLanguage]);
    const toggleConfig = useMemo(() => TOGGLE_CONFIGS[targetLanguage] || TOGGLE_CONFIGS.ja, [targetLanguage]);

    // Get current lesson and characters for learn mode
    const currentLesson = useMemo(() => lessons[currentLessonIndex], [lessons, currentLessonIndex]);
    const lessonCharacters = useMemo(() => {
        if (!currentLesson) return [];
        // Handle both new structure (content.characters) and legacy structure (characters)
        const chars = currentLesson.content?.characters || currentLesson.characters || [];

        return chars
            .map(romaji => characters.find(c => c.romaji === romaji))
            .filter((c): c is Character => c !== undefined);
    }, [currentLesson, characters]);
    const currentLessonChar = useMemo(() => lessonCharacters[currentCharIndex], [lessonCharacters, currentCharIndex]);

    // Initialize filters based on language
    const [filters, setFilters] = useState<Record<string, Filter>>(() => {
        const config = FILTER_CONFIGS[targetLanguage] || FILTER_CONFIGS.ja;
        const initialFilters: Record<string, Filter> = {};
        config.forEach((fc, index) => {
            initialFilters[fc.id] = {
                id: fc.id,
                label: t(fc.labelKey) || fc.id,
                checked: index === 0, // First filter is checked by default
                type: 'checkbox',
            };
        });
        return initialFilters;
    });

    const getDisplayCharacter = useCallback((char: Character | null): string => {
        if (!char) return '';
        // Get the character display value, with fallbacks
        const displayChar = char.hiragana || char.char || char.character || char.romaji;
        // Only apply hiragana/katakana conversion for Japanese
        if (targetLanguage === 'ja') {
            return useHiragana ? displayChar : toKatakana(displayChar);
        }
        // For other languages, just return the character as-is
        return displayChar;
    }, [useHiragana, targetLanguage]);

    // Convert Character to LessonCharacter for the CharacterLesson component
    const toLessonCharacter = useCallback((char: Character | null): LessonCharacter | null => {
        if (!char) return null;
        return {
            romaji: char.romaji,
            character: getDisplayCharacter(char),
            type: char.type,
            group: char.group,
            name: char.name,
            mnemonic: char.mnemonic?.[language] || char.mnemonic?.en,
            audioUrl: char.audioUrl,
        };
    }, [getDisplayCharacter, language]);

    const generateMultipleChoice = useCallback((correctChar: Character, available: Character[]) => {
        const incorrect = available
            .filter(c => c.romaji !== correctChar.romaji)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        const options = [correctChar, ...incorrect]
            .sort(() => Math.random() - 0.5)
            .map(c => c.romaji);

        setMultipleChoiceOptions(options);
    }, []);

    const getAvailableCharacters = useCallback((): Character[] => {
        // Collect all valid types for this language from config
        const allValidTypes = filterConfig.flatMap(fc => fc.types);

        // Check if any filters are checked
        const anyFilterChecked = filterConfig.some(fc => filters[fc.id]?.checked);

        // Determine which types we are allowed to show
        let allowedTypes: string[] = [];
        if (!anyFilterChecked) {
            // If no filters checked, show ALL valid alphabet types (exclude kanji etc)
            allowedTypes = allValidTypes;
        } else {
            // Otherwise show only checked types
            allowedTypes = filterConfig
                .filter(fc => filters[fc.id]?.checked)
                .flatMap(fc => fc.types);
        }

        return characters.filter(char => {
            const effectiveType = char.type || 'gojuon';
            return allowedTypes.includes(effectiveType);
        });
    }, [filters, filterConfig, characters]);

    const nextCharacter = useCallback(() => {
        const available = getAvailableCharacters();
        if (available.length === 0) {
            setCurrentChar(null);
            return;
        }

        let newChar: Character;
        do {
            const index = Math.floor(Math.random() * available.length);
            newChar = available[index];
        } while (available.length > 1 && newChar === currentChar);

        // Reset states
        setIsCorrect(false);
        setInputState('');
        setShowMultipleChoiceFeedback(false);
        setSelectedMultipleChoiceIndex(null);

        // Trigger character enter animation
        setIsCharacterEntering(false);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setCurrentChar(newChar);
                setInputValue('');
                setIsCharacterEntering(true);
                setTimeout(() => {
                    setIsCharacterEntering(false);
                }, 400);

                if (isMobile) {
                    generateMultipleChoice(newChar, available);
                }
            });
        });
    }, [getAvailableCharacters, currentChar, isMobile, generateMultipleChoice]);

    // Helper to determine best text/lang for TTS
    // Edge TTS now handles Japanese natively with high-quality Nanami voice
    const playCharacterAudio = useCallback(async (char: LessonCharacter) => {
        const hasAudioUrl = !!char.audioUrl;

        // LessonCharacter already has the display character string
        const displayChar = char.character;

        console.log(`Playing audio: ${char.romaji}`, { hasAudioUrl, displayChar, targetLanguage });

        await speakAndWait(displayChar, {
            audioUrl: char.audioUrl,
            lang: targetLanguage
        });
    }, [speakAndWait, targetLanguage]);

    const handleTimeout = useCallback(async () => {
        if (isProcessing || !currentChar) return;
        setIsProcessing(true);
        setInputState('error');
        setTotal(prev => prev + 1);
        setStreak(0);

        const lessonChar = toLessonCharacter(currentChar);
        if (lessonChar) {
            await playCharacterAudio(lessonChar);
        }

        nextCharacter();
        setIsProcessing(false);
    }, [isProcessing, currentChar, playCharacterAudio, nextCharacter, toLessonCharacter]);

    const { timeLeft, start, reset } = useTimer(TIME_PER_CHARACTER, handleTimeout);

    const handleCorrect = useCallback(async () => {
        if (!currentChar) return;
        setIsProcessing(true);
        setIsCorrect(true);
        setInputState('success');

        // Update state using functional updates
        setCorrect(prev => prev + 1);
        setTotal(prev => prev + 1);
        setStreak(prev => prev + 1);

        // Calculate new values from ref (current values) for updateStats
        const newCorrect = (statsRef.current.correct || 0) + 1;
        const newTotal = (statsRef.current.total || 0) + 1;
        const newStreak = (statsRef.current.streak || 0) + 1;
        const newBestStreak = Math.max(statsRef.current.bestStreak || 0, newStreak);

        // Update ref immediately
        statsRef.current = { correct: newCorrect, total: newTotal, streak: newStreak, bestStreak: newBestStreak };

        const lessonChar = toLessonCharacter(currentChar);
        if (lessonChar) {
            await playCharacterAudio(lessonChar);
        }

        updateStats('alphabet', { correct: newCorrect, total: newTotal, streak: newStreak, bestStreak: newBestStreak });
        nextCharacter();
        reset();
        start();
        setIsProcessing(false);
    }, [currentChar, playCharacterAudio, updateStats, nextCharacter, reset, start, toLessonCharacter]);

    const handleIncorrect = useCallback(async () => {
        if (!currentChar) return;
        setIsProcessing(true);
        setInputState('error');

        // Update state using functional updates
        setTotal(prev => prev + 1);
        setStreak(0);

        // Calculate new values from ref (current values) for updateStats
        const newTotal = (statsRef.current.total || 0) + 1;

        // Update ref immediately
        statsRef.current = { ...statsRef.current, total: newTotal, streak: 0 };

        const lessonChar = toLessonCharacter(currentChar);
        if (lessonChar) {
            await playCharacterAudio(lessonChar);
        }

        updateStats('alphabet', { correct: statsRef.current.correct, total: newTotal, streak: 0, bestStreak: statsRef.current.bestStreak });
        nextCharacter();
        reset();
        start();
        setIsProcessing(false);
    }, [currentChar, playCharacterAudio, updateStats, nextCharacter, reset, start, toLessonCharacter]);

    const checkInput = useCallback((value: string) => {
        if (isProcessing || !currentChar) return;
        const input = value.toLowerCase();

        // Check against romaji (exact match)
        if (input === currentChar.romaji.toLowerCase()) {
            setIsProcessing(true);
            setInputState('success');
            handleCorrect();
        } else {
            // Only mark incorrect if they hit different key length or enter?
            // For now, let's keep it simple: strict match or wait?
            // Usually typing games wait for full match.
            // But if we want instant fail:
            if (input.length >= currentChar.romaji.length && input !== currentChar.romaji.toLowerCase()) {
                handleIncorrect();
            }
        }
    }, [isProcessing, currentChar, handleCorrect, handleIncorrect]);

    const handleMultipleChoice = useCallback((selected: string, index: number) => {
        if (isProcessing || !currentChar) return;
        const correctIndex = multipleChoiceOptions.indexOf(currentChar.romaji);
        setSelectedMultipleChoiceIndex(index);
        setShowMultipleChoiceFeedback(true);
        if (index === correctIndex) {
            handleCorrect();
        } else {
            handleIncorrect();
        }
    }, [isProcessing, currentChar, multipleChoiceOptions, handleCorrect, handleIncorrect]);

    // Learn mode handlers
    const handlePlayAudio = useCallback(async () => {
        if (!currentLessonChar) return;
        setIsPlayingAudio(true);
        const lessonChar = toLessonCharacter(currentLessonChar);
        if (lessonChar) {
            await playCharacterAudio(lessonChar);
        }
        setIsPlayingAudio(false);
    }, [currentLessonChar, playCharacterAudio, toLessonCharacter]);

    const handleMarkLearned = useCallback(() => {
        if (!currentLessonChar) return;
        setLearnedCharacters(prev => new Set([...prev, currentLessonChar.romaji]));
        // Auto-advance to next character
        if (currentCharIndex < lessonCharacters.length - 1) {
            setCurrentCharIndex(prev => prev + 1);
        }
    }, [currentLessonChar, currentCharIndex, lessonCharacters.length]);

    const handlePreviousChar = useCallback(() => {
        if (currentCharIndex > 0) {
            setCurrentCharIndex(prev => prev - 1);
        }
    }, [currentCharIndex]);

    const handleNextChar = useCallback(() => {
        if (currentCharIndex < lessonCharacters.length - 1) {
            setCurrentCharIndex(prev => prev + 1);
        }
    }, [currentCharIndex, lessonCharacters.length]);

    // Update filter labels when translation changes
    useEffect(() => {
        setFilters(prev => {
            const updated: Record<string, Filter> = {};
            for (const fc of filterConfig) {
                if (prev[fc.id]) {
                    updated[fc.id] = { ...prev[fc.id], label: t(fc.labelKey) || fc.id };
                }
            }
            return updated;
        });
    }, [t, filterConfig]);

    // Reset filters when language changes
    useEffect(() => {
        const newFilters: Record<string, Filter> = {};
        filterConfig.forEach((fc, index) => {
            newFilters[fc.id] = {
                id: fc.id,
                label: t(fc.labelKey) || fc.id,
                checked: index === 0,
                type: 'checkbox',
            };
        });
        setFilters(newFilters);
        // Reset learn mode state
        setCurrentLessonIndex(0);
        setCurrentCharIndex(0);
        setLearnedCharacters(new Set());
    }, [targetLanguage, filterConfig, t]);

    // Load initial stats from module data and sync to ref
    useEffect(() => {
        const moduleData = getModuleData('alphabet');
        const initialCorrect = moduleData?.stats?.correct || 0;
        const initialTotal = moduleData?.stats?.total || 0;
        const initialStreak = moduleData?.stats?.streak || 0;
        const initialBestStreak = moduleData?.stats?.bestStreak || 0;

        setCorrect(initialCorrect);
        setTotal(initialTotal);
        setStreak(initialStreak);

        // Initialize ref with loaded values
        statsRef.current = {
            correct: initialCorrect,
            total: initialTotal,
            streak: initialStreak,
            bestStreak: initialBestStreak
        };
    }, [getModuleData]);

    // Create a stable string of filter states for dependency tracking
    const filterStates = useMemo(() => {
        return Object.entries(filters).map(([id, f]) => `${id}:${f.checked}`).join(',');
    }, [filters]);

    // Initialize practice mode when switching to it
    useEffect(() => {
        if (mode === 'practice' && characters.length > 0) {
            nextCharacter();
            start();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, filterStates, useHiragana, targetLanguage]);

    useEffect(() => {
        if (mode === 'practice' && !isMobile && currentChar && inputRef.current && !isProcessing) {
            const timeoutId = setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [currentChar, isMobile, isProcessing, mode]);

    useEffect(() => {
        if (currentChar?.audioUrl) {
            preloadedAudioRef.current = preloadAudio(currentChar.audioUrl);
        }

        // Also preload with Edge TTS if no audioUrl
        if (currentChar && !currentChar.audioUrl) {
            preloadBatch([], [getDisplayCharacter(currentChar)], targetLanguage);
        }

        return () => {
            if (preloadedAudioRef.current) {
                preloadedAudioRef.current = null;
            }
        };
    }, [currentChar, preloadAudio, preloadBatch, targetLanguage, getDisplayCharacter]);

    // Preload all characters in the current lesson for Learn mode
    useEffect(() => {
        if (mode === 'learn' && lessonCharacters.length > 0) {
            const audioUrls = lessonCharacters.map(c => c.audioUrl).filter((url): url is string => !!url);
            const texts = lessonCharacters.map(c => getDisplayCharacter(c));
            preloadBatch(audioUrls, texts, targetLanguage);
        }
    }, [mode, lessonCharacters, preloadBatch, targetLanguage, getDisplayCharacter]);

    // Preload a few random available characters for Practice mode
    useEffect(() => {
        if (mode === 'practice' && characters.length > 0) {
            const available = getAvailableCharacters();
            if (available.length > 0) {
                // Preload up to 10 random characters to avoid flooding
                const sample = available
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 10);

                const audioUrls = sample.map(c => c.audioUrl).filter((url): url is string => !!url);
                const texts = sample.map(c => getDisplayCharacter(c));
                preloadBatch(audioUrls, texts, targetLanguage);
            }
        }
    }, [mode, characters.length, getAvailableCharacters, preloadBatch, targetLanguage, getDisplayCharacter]);

    const handleFilterChange = useCallback((id: string, checked: boolean) => {
        setFilters(prev => ({ ...prev, [id]: { ...prev[id], checked } }));
    }, []);

    const { title: pageTitle, description: pageDescription } = getModuleName('alphabet', targetLanguage, t);

    // Render Learn Mode
    const renderLearnMode = () => {
        const lessonChar = toLessonCharacter(currentLessonChar);
        if (!lessonChar || !currentLesson) {
            return (
                <EmptyState icon={<IoSchool />} title={t('learnMode.noLessonsAvailable')} />
            );
        }

        const lessonLearnedCount = lessonCharacters.filter(c => learnedCharacters.has(c.romaji)).length;

        return (
            <div className={styles.learnStage}>
                <LessonProgress
                    currentIndex={currentCharIndex}
                    totalCount={lessonCharacters.length}
                    learnedCount={lessonLearnedCount}
                    onPrevious={handlePreviousChar}
                    onNext={handleNextChar}
                    hasPrevious={currentCharIndex > 0}
                    hasNext={currentCharIndex < lessonCharacters.length - 1}
                    lessonName={currentLesson.name}
                    progressLabel={t('learnMode.progress')}
                    learnedLabel={t('learnMode.learned')}
                />

                <CharacterLesson
                    character={lessonChar}
                    languageCode={targetLanguage}
                    onMarkLearned={handleMarkLearned}
                    onPlayAudio={handlePlayAudio}
                    isPlaying={isPlayingAudio}
                    isLearned={learnedCharacters.has(currentLessonChar?.romaji || '')}
                    typeLabel={t('learnMode.type')}
                    groupLabel={t('learnMode.group')}
                    soundLabel={t('learnMode.playSound')}
                    markLearnedLabel={t('learnMode.markLearned')}
                    learnedLabel={t('learnMode.alreadyLearned')}
                    mnemonicLabel={t('learnMode.mnemonic')}
                    nameLabel={t('learnMode.characterName')}
                />
            </div>
        );
    };

    // Render Practice Mode
    const renderPracticeMode = () => (
        <div className={study.content}>
            <OptionsPanel>
                {toggleConfig.enabled && (
                    <div className={optionsStyles.toggleContainer}>
                        <Text variant="label" color="secondary">{t('alphabet.title')}</Text>
                        <Toggle
                            options={toggleConfig.options.map(opt => ({
                                id: opt.id,
                                label: t(opt.labelKey)
                            })) as [{ id: string; label: string }, { id: string; label: string }]}
                            value={useHiragana ? 'hiragana' : 'katakana'}
                            onChange={(val) => setUseHiragana(val === 'hiragana')}
                            name="alphabet-type"
                        />
                    </div>
                )}
                <div className={optionsStyles.group}>
                    {Object.values(filters).map((filter) => (
                        <Chip
                            key={filter.id}
                            id={filter.id}
                            label={filter.label}
                            checked={filter.checked}
                            onChange={(checked) => handleFilterChange(filter.id, checked)}
                        />
                    ))}
                </div>
            </OptionsPanel>

            {!currentChar ? (
                // Keep the toolbar visible so the filters can be adjusted
                <EmptyState icon={<IoFilter />} title={t('alphabet.noCharacters')} />
            ) : (
                <div className={study.stage}>
                    <CharacterCard entering={isCharacterEntering} correct={isCorrect}>
                        <Timer timeLeft={timeLeft} totalTime={TIME_PER_CHARACTER} />
                        <CharacterDisplay
                            character={getDisplayCharacter(currentChar)}
                            entering={isCharacterEntering}
                            correct={isCorrect}
                            lang={targetLanguage}
                        />
                    </CharacterCard>

                    <InputSection>
                        {isMobile ? (
                            <MultipleChoice
                                options={multipleChoiceOptions}
                                onSelect={handleMultipleChoice}
                                disabled={isProcessing}
                                showCorrect={showMultipleChoiceFeedback}
                                correctIndex={multipleChoiceOptions.indexOf(currentChar?.romaji)}
                            />
                        ) : (
                            <Input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    setInputState('');
                                    checkInput(e.target.value);
                                }}
                                placeholder="..."
                                aria-label={t('alphabet.title')}
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                readOnly={isProcessing}
                                aria-disabled={isProcessing}
                                variant={inputState || 'default'}
                                size="lg"
                                fullWidth
                            />
                        )}
                        <StatsPanel correct={correct} total={total} streak={streak} />
                    </InputSection>
                </div>
            )}
        </div>
    );

    return (
        <ErrorBoundary>
            <LanguageContentGuard moduleName="alphabet">
                <Container variant="dashboard" streak={mode === 'practice' ? streak : 0}>
                    <PageHeader
                        title={pageTitle}
                        subtitle={pageDescription}
                        actions={
                            <LearnModeToggle
                                mode={mode}
                                onChange={setMode}
                                learnLabel={t('learnMode.learn')}
                                practiceLabel={t('learnMode.practice')}
                            />
                        }
                    />

                    {mode === 'learn' ? renderLearnMode() : renderPracticeMode()}
                </Container>
            </LanguageContentGuard>
        </ErrorBoundary>
    );
}
