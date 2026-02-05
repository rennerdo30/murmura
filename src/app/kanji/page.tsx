'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navigation from '@/components/common/Navigation';
import StatsPanel from '@/components/common/StatsPanel';
import MultipleChoice from '@/components/common/MultipleChoice';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import { Container, CharacterCard, InputSection, Input, OptionsPanel, Text, Toggle, Chip, CharacterDisplay, Animated, Button } from '@/components/ui';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useTTS } from '@/hooks/useTTS';
import { KanjiItem, Filter } from '@/types';
import { IoVolumeHigh } from 'react-icons/io5';
import styles from './kanji.module.css';

// Import kanji/hanzi data for each language
import jaKanjiJson from '@/data/ja/kanji.json';
import zhHanziJson from '@/data/zh/hanzi.json';

// Extended type for Chinese Hanzi
interface HanziItem {
    id: string;
    hanzi: string;
    meaning: string;
    pinyin: string;
    strokes: number;
    hsk: string;
    radicals: string[];
    examples: Array<{
        word: string;
        pinyin: string;
        meaning: string;
        audioUrl?: string;
    }>;
    audioUrl?: string;
}

// Normalize Hanzi to KanjiItem for unified handling
const normalizeHanzi = (hanzi: HanziItem): KanjiItem => ({
    id: hanzi.id,
    kanji: hanzi.hanzi,
    meaning: hanzi.meaning,
    onyomi: [hanzi.pinyin], // Use pinyin as the primary reading
    kunyomi: [],
    strokes: hanzi.strokes,
    jlpt: hanzi.hsk, // Use HSK level in place of JLPT
    radicals: hanzi.radicals,
    examples: hanzi.examples.map(ex => ({
        word: ex.word,
        reading: ex.pinyin,
        meaning: ex.meaning,
        audioUrl: ex.audioUrl,
    })),
    audioUrl: hanzi.audioUrl,
});

// Get character data based on target language
const getCharacterData = (lang: string): KanjiItem[] => {
    switch (lang) {
        case 'zh':
            return (zhHanziJson as HanziItem[]).map(normalizeHanzi);
        case 'ja':
        default:
            return jaKanjiJson as KanjiItem[];
    }
};

// Note: Level filters are now loaded dynamically from language-configs.json via useTargetLanguage().levels

// Reading labels per language
const READING_LABELS: Record<string, { primary: string; secondary?: string }> = {
    ja: { primary: 'kanji.onyomi', secondary: 'kanji.kunyomi' },
    zh: { primary: 'kanji.pinyin' },
};

export default function KanjiPage() {
    const { updateModuleStats: updateStats, getModuleData } = useProgressContext();
    const { t } = useLanguage();
    const { targetLanguage, levels } = useTargetLanguage();
    const { speak } = useTTS();
    const [currentKanji, setCurrentKanji] = useState<KanjiItem | null>(null);
    const [correct, setCorrect] = useState(0);
    const [total, setTotal] = useState(0);
    const [streak, setStreak] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // Use refs to track current stats values for updateStats to avoid stale closures
    const statsRef = useRef({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
    const [practiceType, setPracticeType] = useState<'meaning' | 'reading'>('meaning');
    const [inputValue, setInputValue] = useState('');
    const [isCharacterEntering, setIsCharacterEntering] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [inputState, setInputState] = useState<'default' | 'success' | 'error'>('default');
    const [showInfo, setShowInfo] = useState(false);

    // Get data and configurations for current language
    const kanjiData = useMemo(() => getCharacterData(targetLanguage), [targetLanguage]);
    const readingLabels = useMemo(() => READING_LABELS[targetLanguage] || READING_LABELS.ja, [targetLanguage]);

    const [filters, setFilters] = useState<Record<string, Filter>>({});

    // Initialize level filters when language changes
    useEffect(() => {
        const initialFilters: Record<string, Filter> = {};
        levels.forEach((level, index) => {
            initialFilters[level.id] = {
                id: level.id,
                label: level.name,
                checked: index === 0, // First level checked by default
                type: 'checkbox',
            };
        });
        initialFilters.practiceMeaning = { id: 'practice-meaning', label: t('kanji.practiceMeaning'), checked: true, type: 'radio', name: 'kanji-mode' };
        initialFilters.practiceReading = { id: 'practice-reading', label: t('kanji.practiceReading'), checked: false, type: 'radio', name: 'kanji-mode' };
        setFilters(initialFilters);
    }, [targetLanguage, levels, t]);

    const getAvailableKanji = useCallback(() => {
        return kanjiData.filter(item => {
            // Check each level filter for the current language
            // The item.jlpt might be uppercase (N5, HSK1) while level.id is lowercase (n5, hsk1)
            const itemLevel = item.jlpt?.toLowerCase();
            for (const level of levels) {
                if (filters[level.id]?.checked && itemLevel === level.id.toLowerCase()) {
                    return true;
                }
            }
            return false;
        });
    }, [filters, levels, kanjiData]);

    const nextKanji = useCallback(() => {
        const available = getAvailableKanji();
        if (available.length === 0) {
            setCurrentKanji(null);
            return;
        }

        const index = Math.floor(Math.random() * available.length);
        const newKanji = available[index];

        setIsCharacterEntering(false);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setCurrentKanji(newKanji);
                setInputValue('');
                setShowInfo(false);
                setIsCorrect(false);
                setInputState('default');
                setIsCharacterEntering(true);
                setTimeout(() => setIsCharacterEntering(false), 400);
            });
        });
    }, [getAvailableKanji]);

    const handleCorrect = useCallback(() => {
        if (!currentKanji) return;
        setIsProcessing(true);
        setIsCorrect(true);
        setInputState('success');

        // Update state using functional updates
        setCorrect(prev => prev + 1);
        setTotal(prev => prev + 1);
        setStreak(prev => prev + 1);

        // Calculate new values from ref (current values) for updateStats
        const newCorrect = statsRef.current.correct + 1;
        const newTotal = statsRef.current.total + 1;
        const newStreak = statsRef.current.streak + 1;
        const newBestStreak = Math.max(statsRef.current.bestStreak, newStreak);

        // Update ref immediately
        statsRef.current = { correct: newCorrect, total: newTotal, streak: newStreak, bestStreak: newBestStreak };

        speak(currentKanji.kanji, { audioUrl: currentKanji.audioUrl });
        updateStats('kanji', { correct: newCorrect, total: newTotal, streak: newStreak, bestStreak: newBestStreak });

        setTimeout(() => {
            nextKanji();
            setIsProcessing(false);
        }, 1000);
    }, [currentKanji, speak, updateStats, nextKanji]);

    const handleIncorrect = useCallback(() => {
        if (!currentKanji) return;
        setIsProcessing(true);
        setInputState('error');

        // Update state using functional updates
        setTotal(prev => prev + 1);
        setStreak(0);

        // Calculate new values from ref (current values) for updateStats
        const newTotal = statsRef.current.total + 1;

        // Update ref immediately
        statsRef.current = { ...statsRef.current, total: newTotal, streak: 0 };

        speak(currentKanji.kanji, { audioUrl: currentKanji.audioUrl });
        updateStats('kanji', { correct: statsRef.current.correct, total: newTotal, streak: 0, bestStreak: statsRef.current.bestStreak });

        setTimeout(() => {
            nextKanji();
            setIsProcessing(false);
        }, 2000);
    }, [currentKanji, speak, updateStats, nextKanji]);

    const checkInput = useCallback((value: string) => {
        if (isProcessing || !currentKanji) return;
        const normalizedInput = value.toLowerCase().trim();

        if (practiceType === 'meaning') {
            if (normalizedInput === currentKanji.meaning.toLowerCase().trim()) {
                handleCorrect();
            }
        } else {
            const isCorrectReading = currentKanji.onyomi.some(r => r.trim() === normalizedInput) ||
                currentKanji.kunyomi.some(r => r.trim() === normalizedInput);
            if (isCorrectReading) {
                handleCorrect();
            }
        }
    }, [isProcessing, currentKanji, practiceType, handleCorrect]);

    // Load initial stats from module data and sync to ref
    useEffect(() => {
        const moduleData = getModuleData('kanji');
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
        return Object.entries(filters)
            .filter(([id]) => id !== 'practiceMeaning' && id !== 'practiceReading')
            .map(([id, f]) => `${id}:${f.checked}`)
            .join(',');
    }, [filters]);

    useEffect(() => {
        if (kanjiData.length > 0) {
            nextKanji();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterStates, practiceType, targetLanguage]);

    const handleFilterChange = useCallback((id: string, checked: boolean) => {
        if (id === 'practice-meaning' || id === 'practice-reading') {
            setPracticeType(id === 'practice-meaning' ? 'meaning' : 'reading');
            setFilters(prev => ({
                ...prev,
                practiceMeaning: { ...prev.practiceMeaning, checked: id === 'practice-meaning' },
                practiceReading: { ...prev.practiceReading, checked: id === 'practice-reading' }
            }));
        } else {
            setFilters(prev => ({ ...prev, [id]: { ...prev[id], checked } }));
        }
    }, []);

    // Update labels when translation changes
    useEffect(() => {
        setFilters(prev => ({
            ...prev,
            practiceMeaning: { ...prev.practiceMeaning, label: t('kanji.practiceMeaning') },
            practiceReading: { ...prev.practiceReading, label: t('kanji.practiceReading') }
        }));
    }, [t]);

    if (!currentKanji) {
        return (
            <ErrorBoundary>
            <LanguageContentGuard moduleName="kanji">
                <Container variant="centered">
                    <Navigation />
                    <div>{t('kanji.noKanji')}</div>
                </Container>
            </LanguageContentGuard>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
        <LanguageContentGuard moduleName="kanji">
            <Container variant="centered" streak={streak}>
                <Navigation />

            <OptionsPanel>
                <div className={optionsStyles.toggleContainer}>
                    <Text variant="label" color="muted">{t('kanji.practiceMeaning')}</Text>
                    <Toggle
                        options={[
                            { id: 'meaning', label: t('kanji.practiceMeaning') },
                            { id: 'reading', label: t('kanji.practiceReading') }
                        ]}
                        value={practiceType}
                        onChange={(val) => {
                            setPracticeType(val as 'meaning' | 'reading');
                            setFilters(prev => ({
                                ...prev,
                                practiceMeaning: { ...prev.practiceMeaning, checked: val === 'meaning' },
                                practiceReading: { ...prev.practiceReading, checked: val === 'reading' }
                            }));
                        }}
                        name="kanji-mode"
                    />
                </div>
                <div className={optionsStyles.group}>
                    {Object.values(filters)
                        .filter(f => f.id !== 'practice-meaning' && f.id !== 'practice-reading')
                        .map((filter) => (
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

            <CharacterCard entering={isCharacterEntering} correct={isCorrect}>
                <CharacterDisplay
                    character={currentKanji.kanji}
                    entering={isCharacterEntering}
                    correct={isCorrect}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => speak(currentKanji.kanji, { audioUrl: currentKanji.audioUrl })}
                    className={styles.audioButton}
                    aria-label={t('common.listen')}
                >
                    <IoVolumeHigh />
                </Button>
            </CharacterCard>

            <div className="mt-8 mb-4 min-h-[100px] flex flex-col items-center">
                <Animated animation="fadeInUp" key={currentKanji.id + (showInfo ? '-info' : '')}>
                    {showInfo ? (
                        <div className="text-center">
                            <Text variant="h2" color="gold">{currentKanji.meaning}</Text>
                            {/* Show language-specific reading labels */}
                            <Text color="muted" className="mt-2">
                                {t(readingLabels.primary)}: {currentKanji.onyomi.join(', ')}
                            </Text>
                            {readingLabels.secondary && currentKanji.kunyomi.length > 0 && (
                                <Text color="muted">
                                    {t(readingLabels.secondary)}: {currentKanji.kunyomi.join(', ')}
                                </Text>
                            )}
                        </div>
                    ) : (
                        <Button variant="ghost" onClick={() => setShowInfo(true)}>
                            {t('kanji.showInfo')}
                        </Button>
                    )}
                </Animated>
            </div>

            <InputSection>
                <Input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        checkInput(e.target.value);
                    }}
                    placeholder={practiceType === 'meaning' ? t('kanji.typeMeaningOrReading') : t('kanji.typeReading')}
                    autoComplete="off"
                    disabled={isProcessing}
                    variant={inputState}
                    size="lg"
                    fullWidth
                />
                <StatsPanel correct={correct} total={total} streak={streak} />
            </InputSection>
            </Container>
        </LanguageContentGuard>
        </ErrorBoundary>
    );
}

