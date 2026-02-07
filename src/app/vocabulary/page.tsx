'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { FiBook, FiList, FiCheck, FiVolume2, FiClock } from 'react-icons/fi';
import { IoPlay } from 'react-icons/io5';
import Navigation from '@/components/common/Navigation';
import StatsPanel from '@/components/common/StatsPanel';
import MultipleChoice from '@/components/common/MultipleChoice';
import TabSelector from '@/components/common/TabSelector';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Container, CharacterCard, InputSection, Input, OptionsPanel, Text, Toggle, Chip, CharacterDisplay, Animated, Button } from '@/components/ui';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { useLearnedContent } from '@/hooks/useLearnedContent';
import { useTTS } from '@/hooks/useTTS';
import { getVocabularyData, getItemLevel } from '@/lib/dataLoader';
import { VocabularyItem, Filter } from '@/types';
import styles from './vocabulary.module.css';

type TabType = 'myCards' | 'all';

export default function VocabularyPage() {
    const { updateModuleStats: updateStats, getModuleData } = useProgressContext();
    const { t } = useLanguage();
    const { targetLanguage, levels } = useTargetLanguage();
    const { getMeaning } = useContentTranslation();
    const { speak, preloadBatch } = useTTS();
    const {
        allLearned,
        isContentLearned,
        getLearnedByType,
        stats: learnedStats,
        dueCount,
        isReady: learnedReady
    } = useLearnedContent();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('myCards');

    // Helper to get the display meaning for a vocabulary item
    // Uses content_translations for localized meanings, falls back to meanings array or default meaning
    const getDisplayMeaning = useCallback((word: VocabularyItem): string => {
        // First try content_translations.meaning (has localized translations like {"ja": "...", "es": "..."})
        const translatedMeanings = (word.content_translations as { meaning?: Record<string, string> })?.meaning;
        if (translatedMeanings) {
            return getMeaning(translatedMeanings, word.meaning);
        }
        // Fall back to meanings array (English only)
        return getMeaning(word.meanings, word.meaning);
    }, [getMeaning]);

    // Practice mode state
    const [currentWord, setCurrentWord] = useState<VocabularyItem | null>(null);
    const [correct, setCorrect] = useState(0);
    const [total, setTotal] = useState(0);
    const [streak, setStreak] = useState(0);
    const statsRef = useRef({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
    const inputRef = useRef<HTMLInputElement>(null);
    const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => {
        return () => {
            timeoutsRef.current.forEach(clearTimeout);
        };
    }, []);

    const [isProcessing, setIsProcessing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [practiceMode, setPracticeMode] = useState(false);
    const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<string[]>([]);
    const [isCharacterEntering, setIsCharacterEntering] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [inputState, setInputState] = useState<'default' | 'success' | 'error'>('default');
    const [showHint, setShowHint] = useState(false);

    // Browse mode state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
    const [displayLimit, setDisplayLimit] = useState(50);

    // Get vocabulary data
    const vocabulary = useMemo(() => getVocabularyData(targetLanguage), [targetLanguage]);

    // Get first 2 levels from language config
    const displayLevels = useMemo(() => levels.slice(0, 2), [levels]);

    // Initialize filters
    const [filters, setFilters] = useState<Record<string, Filter>>({});

    useEffect(() => {
        const newFilters: Record<string, Filter> = {};
        displayLevels.forEach((level, index) => {
            newFilters[level.id] = {
                id: level.id,
                label: level.name,
                checked: index === 0,
                type: 'checkbox'
            };
        });
        newFilters['practiceMode'] = {
            id: 'practice-mode',
            label: t('vocabulary.practiceMode'),
            checked: false,
            type: 'checkbox'
        };
        setFilters(newFilters);
    }, [targetLanguage, displayLevels, t]);

    // Get learned vocabulary items
    const learnedVocabulary = useMemo(() => {
        return getLearnedByType('vocabulary');
    }, [getLearnedByType]);

    // Get vocabulary items that match learned content
    const myVocabularyItems = useMemo(() => {
        const learnedIds = new Set(learnedVocabulary.map(l => l.contentId));
        return vocabulary.filter(v => {
            const vocabId = `${targetLanguage}-vocab-${v.id}`;
            return learnedIds.has(vocabId) || isContentLearned(vocabId);
        });
    }, [vocabulary, learnedVocabulary, targetLanguage, isContentLearned]);

    // Filtered vocabulary for browse view
    const allFilteredVocabulary = useMemo(() => {
        let items = vocabulary;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(v =>
                v.word?.toLowerCase().includes(query) ||
                v.reading?.toLowerCase().includes(query) ||
                getDisplayMeaning(v).toLowerCase().includes(query)
            );
        }

        if (selectedLevel) {
            items = items.filter(v => getItemLevel(v) === selectedLevel);
        }

        return items;
    }, [vocabulary, searchQuery, selectedLevel, getDisplayMeaning]);

    const filteredVocabulary = useMemo(() => {
        return allFilteredVocabulary.slice(0, displayLimit);
    }, [allFilteredVocabulary, displayLimit]);

    // Reset display limit when filters change
    useEffect(() => {
        setDisplayLimit(50);
    }, [searchQuery, selectedLevel]);

    // Preload audio for visible vocabulary items (first 10)
    useEffect(() => {
        if (activeTab === 'all' && filteredVocabulary.length > 0) {
            const audioUrls = filteredVocabulary
                .slice(0, 10)
                .map(v => v.audioUrl);
            const texts = filteredVocabulary.slice(0, 10).map(v => v.word);
            preloadBatch(audioUrls, texts, targetLanguage);
        }
    }, [activeTab, filteredVocabulary, preloadBatch]);

    // Tab configuration
    const tabs = useMemo(() => [
        {
            id: 'myCards' as TabType,
            label: t('vocabulary.tabs.myCards'),
            badge: myVocabularyItems.length > 0 ? myVocabularyItems.length : undefined
        },
        {
            id: 'all' as TabType,
            label: t('vocabulary.tabs.allVocabulary'),
            badge: vocabulary.length
        },
    ], [myVocabularyItems.length, vocabulary.length]);

    // Practice mode functions
    const generateMultipleChoice = useCallback((correctWord: VocabularyItem, available: VocabularyItem[]) => {
        const incorrect = available
            .filter(v => v.id !== correctWord.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        const options = [correctWord, ...incorrect]
            .sort(() => Math.random() - 0.5)
            .map(v => getDisplayMeaning(v));

        setMultipleChoiceOptions(options);
    }, [getDisplayMeaning]);

    const getAvailableVocabulary = useCallback(() => {
        // In My Cards tab, use learned vocabulary; otherwise use filtered vocabulary
        if (activeTab === 'myCards' && myVocabularyItems.length > 0) {
            return myVocabularyItems;
        }
        return vocabulary.filter(word => {
            const wordLevel = getItemLevel(word);
            return displayLevels.some(level =>
                filters[level.id]?.checked && wordLevel === level.id
            );
        });
    }, [activeTab, myVocabularyItems, vocabulary, filters, displayLevels]);

    const nextWord = useCallback(() => {
        const available = getAvailableVocabulary();
        if (available.length === 0) {
            setCurrentWord(null);
            return;
        }

        const index = Math.floor(Math.random() * available.length);
        const newWord = available[index];

        setIsCharacterEntering(false);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setCurrentWord(newWord);
                setInputValue('');
                setIsCorrect(false);
                setInputState('default');
                setShowHint(false);
                setIsCharacterEntering(true);
                timeoutsRef.current.push(setTimeout(() => setIsCharacterEntering(false), 400));

                if (practiceMode) {
                    generateMultipleChoice(newWord, available);
                }
            });
        });
    }, [getAvailableVocabulary, practiceMode, generateMultipleChoice]);

    const handleCorrect = useCallback(() => {
        if (!currentWord) return;
        setIsProcessing(true);
        setIsCorrect(true);
        setInputState('success');

        setCorrect(prev => prev + 1);
        setTotal(prev => prev + 1);
        setStreak(prev => prev + 1);

        const newCorrect = statsRef.current.correct + 1;
        const newTotal = statsRef.current.total + 1;
        const newStreak = statsRef.current.streak + 1;
        const newBestStreak = Math.max(statsRef.current.bestStreak, newStreak);

        statsRef.current = { correct: newCorrect, total: newTotal, streak: newStreak, bestStreak: newBestStreak };

        speak(currentWord.word, { audioUrl: currentWord.audioUrl });
        updateStats('vocabulary', { correct: newCorrect, total: newTotal, streak: newStreak, bestStreak: newBestStreak });

        timeoutsRef.current.push(setTimeout(() => {
            nextWord();
            setIsProcessing(false);
            timeoutsRef.current.push(setTimeout(() => inputRef.current?.focus(), 100));
        }, 1000));
    }, [currentWord, speak, updateStats, nextWord]);

    const handleIncorrect = useCallback(() => {
        if (!currentWord) return;
        setIsProcessing(true);
        setInputState('error');

        setTotal(prev => prev + 1);
        setStreak(0);

        const newTotal = statsRef.current.total + 1;
        statsRef.current = { ...statsRef.current, total: newTotal, streak: 0 };

        speak(currentWord.word, { audioUrl: currentWord.audioUrl });
        updateStats('vocabulary', { correct: statsRef.current.correct, total: newTotal, streak: 0, bestStreak: statsRef.current.bestStreak });

        timeoutsRef.current.push(setTimeout(() => {
            nextWord();
            setIsProcessing(false);
            timeoutsRef.current.push(setTimeout(() => inputRef.current?.focus(), 100));
        }, 2000));
    }, [currentWord, speak, updateStats, nextWord]);

    const checkInput = useCallback((value: string) => {
        if (isProcessing || !currentWord) return;
        const normalizedInput = value.toLowerCase().trim();
        const displayMeaning = getDisplayMeaning(currentWord);
        const normalizedMeaning = displayMeaning.toLowerCase().trim();

        if (normalizedInput === normalizedMeaning) {
            handleCorrect();
        }
    }, [isProcessing, currentWord, handleCorrect, getDisplayMeaning]);

    // Load initial stats
    useEffect(() => {
        const moduleData = getModuleData('vocabulary');
        const initialCorrect = moduleData?.stats?.correct || 0;
        const initialTotal = moduleData?.stats?.total || 0;
        const initialStreak = moduleData?.stats?.streak || 0;
        const initialBestStreak = moduleData?.stats?.bestStreak || 0;

        setCorrect(initialCorrect);
        setTotal(initialTotal);
        setStreak(initialStreak);

        statsRef.current = {
            correct: initialCorrect,
            total: initialTotal,
            streak: initialStreak,
            bestStreak: initialBestStreak
        };
    }, [getModuleData]);

    // Initialize practice when filters or tab changes
    const filterStates = Object.entries(filters)
        .filter(([key]) => key !== 'practiceMode')
        .map(([key, f]) => `${key}:${f.checked}`)
        .join(',');

    useEffect(() => {
        if (vocabulary.length > 0 && Object.keys(filters).length > 0 && activeTab === 'myCards') {
            nextWord();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterStates, practiceMode, targetLanguage, activeTab]);

    const handleFilterChange = useCallback((id: string, checked: boolean) => {
        if (id === 'practice-mode') {
            setPracticeMode(checked);
        } else {
            setFilters(prev => ({ ...prev, [id]: { ...prev[id], checked } }));
        }
    }, []);

    const getHint = useCallback(() => {
        if (!currentWord) return '';
        const meaning = getDisplayMeaning(currentWord);
        if (meaning.length <= 3) return meaning.charAt(0) + '...';
        return meaning.substring(0, 2) + '...';
    }, [currentWord, getDisplayMeaning]);

    // Render browse view (All Vocabulary tab)
    const renderBrowseView = () => (
        <>
            {/* Filter Section */}
            <div className={styles.filterSection}>
                <Input
                    type="text"
                    placeholder={t('vocabulary.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
                {displayLevels.map(level => (
                    <Chip
                        key={level.id}
                        id={level.id}
                        label={level.name}
                        checked={selectedLevel === level.id}
                        onChange={(checked) => setSelectedLevel(checked ? level.id : null)}
                    />
                ))}
            </div>

            {/* Result count */}
            <div className={styles.resultCount}>
                <Text variant="label" color="muted">
                    {t('vocabulary.resultCount', { count: allFilteredVocabulary.length })}
                </Text>
            </div>

            {/* Vocabulary Grid */}
            <div className={styles.browseGrid}>
                {filteredVocabulary.map((vocab) => {
                    const vocabId = `${targetLanguage}-vocab-${vocab.id}`;
                    const isLearned = isContentLearned(vocabId);

                    return (
                        <div
                            key={vocab.id}
                            className={`${styles.vocabCard} ${isLearned ? styles.learned : ''}`}
                        >
                            <div className={styles.vocabHeader}>
                                <div>
                                    <div className={styles.vocabWord}>{vocab.word}</div>
                                    {vocab.reading && (
                                        <div className={styles.vocabReading}>{vocab.reading}</div>
                                    )}
                                </div>
                                <span className={styles.vocabLevel}>{getItemLevel(vocab)}</span>
                            </div>
                            <div className={styles.vocabMeaning}>
                                {getDisplayMeaning(vocab)}
                            </div>
                            <div className={styles.vocabActions}>
                                {isLearned ? (
                                    <span className={styles.learnedBadge}>
                                        <FiCheck size={12} /> {t('vocabulary.actions.learned')}
                                    </span>
                                ) : (
                                    <Link href="/paths">
                                        <Button variant="ghost" size="sm">
                                            <FiBook size={14} /> {t('vocabulary.actions.learnInLessons')}
                                        </Button>
                                    </Link>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => speak(vocab.word, { audioUrl: vocab.audioUrl })}
                                    aria-label={t('common.listen')}
                                >
                                    <FiVolume2 size={14} />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredVocabulary.length < allFilteredVocabulary.length && (
                <div className={styles.loadMoreContainer}>
                    <Button
                        variant="ghost"
                        onClick={() => setDisplayLimit(prev => prev + 50)}
                    >
                        {t('vocabulary.loadMore') || 'Load More'} ({allFilteredVocabulary.length - filteredVocabulary.length})
                    </Button>
                </div>
            )}

            {filteredVocabulary.length === 0 && (
                <div className={styles.emptyState}>
                    <FiList className={styles.emptyIcon} />
                    <Text variant="h3">{t('vocabulary.empty.searchEmpty')}</Text>
                    <Text color="muted">{t('vocabulary.empty.searchHint')}</Text>
                </div>
            )}
        </>
    );

    // Render practice view (My Cards tab)
    const renderPracticeView = () => {
        // No learned vocabulary yet
        if (myVocabularyItems.length === 0 && learnedReady) {
            return (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIllustration}>
                        <div className={styles.emptyDecoCircle1} />
                        <div className={styles.emptyDecoCircle2} />
                        <FiBook className={styles.emptyIconLarge} />
                    </div>
                    <Text variant="h2" color="gold">{t('vocabulary.empty.title')}</Text>
                    <Text color="muted">{t('vocabulary.empty.desc')}</Text>
                    <Link href="/paths">
                        <Button variant="primary" className={styles.emptyCta}>
                            <IoPlay /> {t('vocabulary.empty.goToLessons')}
                        </Button>
                    </Link>
                </div>
            );
        }

        // No current word (filters too restrictive)
        if (!currentWord) {
            return (
                <div className={styles.emptyState}>
                    <Text variant="h3">{t('vocabulary.noWords')}</Text>
                    <Text color="muted">{t('vocabulary.empty.unlock')}</Text>
                </div>
            );
        }

        return (
            <>
                <OptionsPanel>
                    <div className={optionsStyles.toggleContainer}>
                        <Text variant="label" color="muted">{t('vocabulary.answerMode') || 'Answer Mode'}</Text>
                        <Toggle
                            options={[
                                { id: 'meaning', label: t('vocabulary.typeAnswer') || 'Type Answer' },
                                { id: 'practice', label: t('vocabulary.multipleChoice') || 'Multiple Choice' }
                            ]}
                            value={practiceMode ? 'practice' : 'meaning'}
                            onChange={(val) => {
                                setPracticeMode(val === 'practice');
                                setFilters(prev => ({ ...prev, practiceMode: { ...prev.practiceMode, checked: val === 'practice' } }));
                            }}
                            name="vocabulary-mode"
                        />
                    </div>
                    <div className={optionsStyles.group}>
                        {Object.values(filters)
                            .filter(f => f.id !== 'practice-mode')
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
                        character={currentWord.word}
                        entering={isCharacterEntering}
                        correct={isCorrect}
                        subtext={currentWord.reading}
                        variant="word"
                    />
                </CharacterCard>

                <div className="mt-8 mb-4">
                    <Animated animation="pulse" key={currentWord.id}>
                        <Text variant="h2" color="gold">
                            {isCorrect ? getDisplayMeaning(currentWord) : (showHint ? getHint() : '???')}
                        </Text>
                    </Animated>
                    {!isCorrect && !practiceMode && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHint(true)}
                            disabled={showHint}
                            className="mt-2"
                        >
                            {showHint ? t('vocabulary.hintShown') : t('vocabulary.showHint')}
                        </Button>
                    )}
                </div>

                <InputSection>
                    {practiceMode ? (
                        <MultipleChoice
                            options={multipleChoiceOptions}
                            onSelect={(selected) => {
                                if (selected === getDisplayMeaning(currentWord)) handleCorrect();
                                else handleIncorrect();
                            }}
                            disabled={isProcessing}
                        />
                    ) : (
                        <Input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                checkInput(e.target.value);
                            }}
                            placeholder={t('vocabulary.typeMeaning')}
                            autoComplete="off"
                            disabled={isProcessing}
                            variant={inputState}
                            size="lg"
                            fullWidth
                        />
                    )}
                    <StatsPanel correct={correct} total={total} streak={streak} />
                </InputSection>
            </>
        );
    };

    return (
        <ErrorBoundary>
            <LanguageContentGuard moduleName="vocabulary">
                <Container variant="centered" streak={activeTab === 'myCards' ? streak : 0}>
                    <Navigation />

                    {/* Page Header */}
                    <div className={styles.pageHeader}>
                        <Text variant="h1">{t('modules.vocabulary.title')}</Text>
                        {dueCount > 0 && (
                            <Button variant="primary" size="sm" className={styles.reviewButton}>
                                <FiClock />
                                {t('grammar.actions.review')}
                                <span className={styles.reviewCount}>{dueCount}</span>
                            </Button>
                        )}
                    </div>

                    {/* Stats Row */}
                    {activeTab === 'myCards' && (
                        <div className={styles.statsRow}>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>
                                    {(learnedStats.byType as Record<string, number>)?.vocabulary || myVocabularyItems.length}
                                </span>
                                <span className={styles.statLabel}>{t('vocabulary.stats.wordsLearned')}</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>{dueCount}</span>
                                <span className={styles.statLabel}>{t('vocabulary.stats.dueForReview')}</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>
                                    {total > 0 ? Math.round((correct / total) * 100) : 0}%
                                </span>
                                <span className={styles.statLabel}>{t('vocabulary.stats.accuracy')}</span>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <TabSelector
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(tab) => setActiveTab(tab as TabType)}
                    />

                    {/* Tab Content */}
                    {activeTab === 'myCards' ? renderPracticeView() : renderBrowseView()}
                </Container>
            </LanguageContentGuard>
        </ErrorBoundary>
    );
}
