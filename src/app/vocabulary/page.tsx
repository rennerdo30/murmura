'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FiBook, FiList, FiCheck, FiVolume2, FiClock } from 'react-icons/fi';
import { IoPlay } from 'react-icons/io5';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatsPanel from '@/components/common/StatsPanel';
import MultipleChoice from '@/components/common/MultipleChoice';
import TabSelector from '@/components/common/TabSelector';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Container, CharacterCard, InputSection, Input, OptionsPanel, Text, Toggle, Chip, CharacterDisplay, Animated, Button, StatTiles } from '@/components/ui';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { useLearnedContent } from '@/hooks/useLearnedContent';
import { useTTS } from '@/hooks/useTTS';
import { loadVocabularyData, getItemLevel } from '@/lib/dataLoader';
import { VocabularyItem, Filter } from '@/types';
import { getModuleName } from '@/lib/learningModules';
import study from '@/styles/study.module.css';
import { shortMeaning } from '@/lib/meaningText';

type TabType = 'myCards' | 'all';

/** Number of vocabulary cards added to the browse grid per "load more". */
const BROWSE_PAGE_SIZE = 50;

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
        addLearned,
        stats: learnedStats,
        dueForReview,
        isReady: learnedReady
    } = useLearnedContent();
    const dueCount = dueForReview.filter(item => item.contentType === 'vocabulary').length;

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
    const [displayLimit, setDisplayLimit] = useState(BROWSE_PAGE_SIZE);

    // Get vocabulary data
    const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);

    useEffect(() => {
        let active = true;
        loadVocabularyData(targetLanguage).then(items => {
            if (active) setVocabulary(items);
        });
        return () => { active = false; };
    }, [targetLanguage]);

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
        setDisplayLimit(BROWSE_PAGE_SIZE);
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
            label: t('learnMode.practice'),
            badge: myVocabularyItems.length > 0 ? myVocabularyItems.length : undefined
        },
        {
            id: 'all' as TabType,
            label: t('vocabulary.tabs.allVocabulary'),
            badge: vocabulary.length
        },
    ], [myVocabularyItems.length, vocabulary.length, t]);

    // Practice mode functions
    const generateMultipleChoice = useCallback((correctWord: VocabularyItem, available: VocabularyItem[]) => {
        const incorrect = available
            .filter(v => v.id !== correctWord.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        const options = [correctWord, ...incorrect]
            .sort(() => Math.random() - 0.5)
            .map(v => shortMeaning(getDisplayMeaning(v)));

        setMultipleChoiceOptions(options);
    }, [getDisplayMeaning]);

    const getAvailableVocabulary = useCallback(() => {
        // Practice draws from the selected teaching levels, including new words.
        return vocabulary.filter(word => {
            const wordLevel = getItemLevel(word);
            return displayLevels.some(level =>
                filters[level.id]?.checked && wordLevel === level.id
            );
        });
    }, [vocabulary, filters, displayLevels]);

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
        void addLearned('vocabulary', `${targetLanguage}-vocab-${currentWord.id}`, 'self-study', {
            front: currentWord.word,
            back: getDisplayMeaning(currentWord),
            reading: currentWord.reading,
            audioUrl: currentWord.audioUrl,
        });

        timeoutsRef.current.push(setTimeout(() => {
            nextWord();
            setIsProcessing(false);
            timeoutsRef.current.push(setTimeout(() => inputRef.current?.focus(), 100));
        }, 1000));
    }, [currentWord, speak, updateStats, nextWord, addLearned, targetLanguage, getDisplayMeaning]);

    const handleIncorrect = useCallback(() => {
        if (!currentWord || isProcessing) return;
        setIsProcessing(true);
        setInputState('error');

        setTotal(prev => prev + 1);
        setStreak(0);

        const newTotal = statsRef.current.total + 1;
        statsRef.current = { ...statsRef.current, total: newTotal, streak: 0 };

        speak(currentWord.word, { audioUrl: currentWord.audioUrl });
        updateStats('vocabulary', { correct: statsRef.current.correct, total: newTotal, streak: 0, bestStreak: statsRef.current.bestStreak });

    }, [currentWord, isProcessing, speak, updateStats]);

    const checkInput = useCallback((value: string) => {
        if (isProcessing || !currentWord) return;
        const normalizedInput = value.toLowerCase().trim();
        const displayMeaning = getDisplayMeaning(currentWord);
        const acceptedMeanings = displayMeaning.split(/[,;/]|\s+[–—-]\s+/).map(meaning => meaning.toLowerCase().trim());

        if (acceptedMeanings.includes(normalizedInput)) {
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
    }, [filterStates, practiceMode, targetLanguage, activeTab, vocabulary.length]);

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

    const { title: pageTitle, description: pageDescription } = getModuleName('vocabulary', targetLanguage, t);

    // Render browse view (All Vocabulary tab)
    const renderBrowseView = () => (
        <div className={study.content}>
            <div className={study.filterBar}>
                <Input
                    size="sm"
                    type="search"
                    placeholder={t('vocabulary.searchPlaceholder')}
                    aria-label={t('vocabulary.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={study.search}
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

            <p className={study.resultCount} aria-live="polite">
                {t('vocabulary.resultCount', { count: allFilteredVocabulary.length })}
            </p>

            {filteredVocabulary.length > 0 ? (
                <ul className={study.grid}>
                    {filteredVocabulary.map((vocab) => {
                        const vocabId = `${targetLanguage}-vocab-${vocab.id}`;
                        const isLearned = isContentLearned(vocabId);

                        return (
                            <li
                                key={vocab.id}
                                className={`${study.item} ${isLearned ? study.itemLearned : ''}`}
                            >
                                <div className={study.itemHeader}>
                                    <div className={study.itemHeading}>
                                        <p className={study.itemWord}>{vocab.word}</p>
                                        {vocab.reading && (
                                            <p className={study.itemSub}>{vocab.reading}</p>
                                        )}
                                    </div>
                                    <span className={study.level}>{getItemLevel(vocab)}</span>
                                </div>
                                <p className={study.itemText}>{getDisplayMeaning(vocab)}</p>
                                <div className={study.itemActions}>
                                    {isLearned ? (
                                        <span className={study.learnedBadge}>
                                            <FiCheck aria-hidden="true" /> {t('vocabulary.actions.learned')}
                                        </span>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('myCards')}>
                                            <FiBook aria-hidden="true" /> {t('learnMode.practice')}
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={study.itemActionEnd}
                                        onClick={() => speak(vocab.word, { audioUrl: vocab.audioUrl })}
                                        aria-label={t('common.listen')}
                                    >
                                        <FiVolume2 aria-hidden="true" />
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <EmptyState
                    icon={<FiList />}
                    title={t('vocabulary.empty.searchEmpty')}
                    text={t('vocabulary.empty.searchHint')}
                />
            )}

            {filteredVocabulary.length < allFilteredVocabulary.length && (
                <div className={study.loadMore}>
                    <Button
                        variant="secondary"
                        onClick={() => setDisplayLimit(prev => prev + BROWSE_PAGE_SIZE)}
                    >
                        {t('vocabulary.loadMore')} ({allFilteredVocabulary.length - filteredVocabulary.length})
                    </Button>
                </div>
            )}
        </div>
    );

    // Render practice view (My Cards tab)
    const renderPracticeView = () => {
        // No vocabulary data at all
        if (vocabulary.length === 0 && learnedReady) {
            return (
                <EmptyState
                    icon={<FiBook />}
                    title={t('vocabulary.empty.title')}
                    text={t('vocabulary.empty.desc')}
                    actions={
                        <Button href="/paths" variant="primary">
                            <IoPlay aria-hidden="true" /> {t('vocabulary.empty.goToLessons')}
                        </Button>
                    }
                />
            );
        }

        const toolbar = (
            <OptionsPanel>
                <div className={optionsStyles.toggleContainer}>
                    <Text variant="label" color="secondary">{t('vocabulary.answerMode')}</Text>
                    <Toggle
                        options={[
                            { id: 'meaning', label: t('vocabulary.typeAnswer') },
                            { id: 'practice', label: t('vocabulary.multipleChoice') }
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
        );

        // No current word (filters too restrictive) - keep the toolbar so levels can be changed
        if (!currentWord) {
            return (
                <div className={study.content}>
                    {toolbar}
                    <EmptyState
                        icon={<FiList />}
                        title={t('vocabulary.noWords')}
                        text={t('vocabulary.empty.unlock')}
                    />
                </div>
            );
        }

        const revealed = isCorrect || inputState === 'error';

        return (
            <div className={study.content}>
                {toolbar}

                <div className={study.stage}>
                    <CharacterCard entering={isCharacterEntering} correct={isCorrect}>
                        <CharacterDisplay
                            character={currentWord.word}
                            entering={isCharacterEntering}
                            correct={isCorrect}
                            subtext={currentWord.reading && currentWord.reading !== currentWord.word ? currentWord.reading : undefined}
                            variant="word"
                        />
                    </CharacterCard>

                    {(!practiceMode || revealed) && (
                    <div className={study.reveal}>
                        <Animated animation="pulse" key={currentWord.id}>
                            <p className={`${study.revealAnswer} ${!revealed && !showHint ? study.revealPlaceholder : ''}`}>
                                {revealed ? getDisplayMeaning(currentWord) : (showHint ? getHint() : '???')}
                            </p>
                        </Animated>
                        {!isCorrect && !practiceMode && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowHint(true)}
                                disabled={showHint}
                                className={study.tapTarget}
                            >
                                {showHint ? t('vocabulary.hintShown') : t('vocabulary.showHint')}
                            </Button>
                        )}
                    </div>
                    )}

                    <InputSection>
                        {practiceMode ? (
                            <>
                                <MultipleChoice
                                    options={multipleChoiceOptions}
                                    onSelect={(selected) => {
                                        if (selected === shortMeaning(getDisplayMeaning(currentWord))) handleCorrect();
                                        else handleIncorrect();
                                    }}
                                    disabled={isProcessing}
                                />
                                {inputState === 'error' && (
                                    <div className={study.actions} role="status" aria-live="polite">
                                        <p className={study.feedback}>
                                            {t('exercises.fillBlank.correctAnswerIs')} <span className={study.feedbackValue}>{getDisplayMeaning(currentWord)}</span>
                                        </p>
                                        <Button onClick={() => {
                                            nextWord();
                                            setIsProcessing(false);
                                        }}>{t('common.continue')}</Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => {
                                        setInputValue(e.target.value);
                                        checkInput(e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && inputValue.trim() && !isProcessing) {
                                            handleIncorrect();
                                        }
                                    }}
                                    placeholder={t('vocabulary.typeMeaning')}
                                    aria-label={t('vocabulary.typeMeaning')}
                                    autoComplete="off"
                                    readOnly={isProcessing}
                                    aria-disabled={isProcessing}
                                    variant={inputState}
                                    size="lg"
                                    fullWidth
                                />
                                <div className={study.actions}>
                                    {inputState === 'error' ? (
                                        <>
                                            <p className={study.feedback} role="status" aria-live="polite">
                                                {t('exercises.fillBlank.correctAnswerIs')} <span className={study.feedbackValue}>{getDisplayMeaning(currentWord)}</span>
                                            </p>
                                            <Button onClick={() => {
                                                nextWord();
                                                setIsProcessing(false);
                                                timeoutsRef.current.push(setTimeout(() => inputRef.current?.focus(), 100));
                                            }}>{t('common.continue')}</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button onClick={handleIncorrect} disabled={!inputValue.trim() || isProcessing}>{t('exercises.common.checkAnswer')}</Button>
                                            <Button variant="ghost" onClick={handleIncorrect} disabled={isProcessing}>{t('review.card.showAnswer')}</Button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                        <StatsPanel correct={correct} total={total} streak={streak} />
                    </InputSection>
                </div>
            </div>
        );
    };

    return (
        <ErrorBoundary>
            <LanguageContentGuard moduleName="vocabulary">
                <Container variant="dashboard" streak={activeTab === 'myCards' ? streak : 0}>
                    <PageHeader
                        title={pageTitle}
                        subtitle={pageDescription}
                        actions={dueCount > 0 ? (
                            <Button href="/review" variant="primary" size="sm" className={study.reviewButton}>
                                <FiClock aria-hidden="true" />
                                {t('grammar.actions.review')}
                                <span className={study.reviewCount}>{dueCount}</span>
                            </Button>
                        ) : undefined}
                    />

                    {activeTab === 'myCards' && (
                        <StatTiles
                            className={study.stats}
                            items={[
                                { id: 'learned', value: (learnedStats.byType as Record<string, number>)?.vocabulary || myVocabularyItems.length, label: t('vocabulary.stats.wordsLearned') },
                                { id: 'due', value: dueCount, label: t('vocabulary.stats.dueForReview') },
                                { id: 'accuracy', value: `${total > 0 ? Math.round((correct / total) * 100) : 0}%`, label: t('vocabulary.stats.accuracy') },
                            ]}
                        />
                    )}

                    <TabSelector
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(tab) => setActiveTab(tab as TabType)}
                    />

                    {activeTab === 'myCards' ? renderPracticeView() : renderBrowseView()}
                </Container>
            </LanguageContentGuard>
        </ErrorBoundary>
    );
}
