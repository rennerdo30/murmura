'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatsPanel from '@/components/common/StatsPanel';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import TabSelector from '@/components/common/TabSelector';
import { Container, Text, Button, Chip, Toggle, OptionsPanel, Input, StatTiles } from '@/components/ui';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { useLearnedContent } from '@/hooks/useLearnedContent';
import { useTTS } from '@/hooks/useTTS';
import { ReadingItem, Filter } from '@/types';
import { markLearned } from '@/lib/storage';
import { IoVolumeHigh, IoCheckmark, IoClose, IoStop } from 'react-icons/io5';
import { FiBookOpen, FiCheck, FiSearch } from 'react-icons/fi';
import { getModuleName } from '@/lib/learningModules';
import study from '@/styles/study.module.css';
import styles from './reading.module.css';
import { normalizeLevelId } from '@/lib/dataLoader';

type TabType = 'myCards' | 'all';

/** Maximum number of readings shown in the browse grid. */
const BROWSE_LIMIT = 30;

export default function ReadingPage() {
    const { getModuleData: getModule, updateModuleStats: updateStats } = useProgressContext();
    const { t } = useLanguage();
    const { targetLanguage, levels, getDataUrl } = useTargetLanguage();
    const { getText, getQuestion } = useContentTranslation();
    const { speak, stop, isPlaying } = useTTS();
    const { allLearned, stats: learnedStats, isContentLearned } = useLearnedContent();

    const [activeTab, setActiveTab] = useState<TabType>('myCards');
    const [readings, setReadings] = useState<ReadingItem[]>([]);
    const [currentReading, setCurrentReading] = useState<ReadingItem | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showFurigana, setShowFurigana] = useState(true);
    const [showQuestions, setShowQuestions] = useState(false);
    const [questionAnswers, setQuestionAnswers] = useState<Record<number, number>>({});
    const [showCorrectness, setShowCorrectness] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
    const [stats, setStats] = useState({
        correct: 0,
        total: 0,
        streak: 0,
        textsRead: 0,
        totalAttempts: 0,
        comprehensionScore: 0,
        comprehensionTotal: 0,
        comprehensionCorrect: 0
    });

    // Get first 2 levels from language config for filters
    const displayLevels = useMemo(() => levels.slice(0, 2), [levels]);

    // Furigana is only relevant for Japanese
    const showFuriganaOption = targetLanguage === 'ja';

    const [filters, setFilters] = useState<Record<string, Filter>>({});

    // Update filters when language changes
    useEffect(() => {
        const newFilters: Record<string, Filter> = {};
        displayLevels.forEach((level) => {
            newFilters[level.id] = {
                id: level.id,
                label: level.name,
                checked: true, // Both levels checked by default for reading
                type: 'checkbox'
            };
        });
        setFilters(newFilters);
    }, [targetLanguage, displayLevels]);

    // Get learned reading IDs
    const learnedReadingIds = useMemo(() => {
        return new Set(
            allLearned
                .filter((item: { contentType: string; languageCode: string }) =>
                    item.contentType === 'reading' && item.languageCode === targetLanguage)
                .map((item: { contentId: string }) => item.contentId)
        );
    }, [allLearned, targetLanguage]);

    // Get my readings (learned ones)
    const myReadingItems = useMemo(() => {
        return readings.filter(r => learnedReadingIds.has(String(r.id)));
    }, [readings, learnedReadingIds]);

    // Filter readings based on selected level filters (for practice mode)
    const filteredReadings = useMemo(() => {
        const activeFilters = Object.values(filters)
            .filter(f => f.checked)
            .map(f => f.id);

        // If no filters selected, show all readings
        if (activeFilters.length === 0) return myReadingItems;

        return myReadingItems.filter(reading => {
            // Handle various level formats (n5, N5, etc.)
            const readingLevel = reading.level?.toLowerCase();
            return activeFilters.some(f => f.toLowerCase() === readingLevel);
        });
    }, [myReadingItems, filters]);

    // Browse items for "All" tab
    const browseItems = useMemo(() => {
        let items = [...readings];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(r =>
                r.title?.toLowerCase().includes(query) ||
                r.text?.toLowerCase().includes(query)
            );
        }

        if (selectedLevel) {
            items = items.filter(r => normalizeLevelId(r.level) === normalizeLevelId(selectedLevel));
        }

        return items.slice(0, BROWSE_LIMIT);
    }, [readings, searchQuery, selectedLevel]);

    // Tab configuration
    const tabs = useMemo(() => [
        {
            id: 'myCards' as TabType,
            label: t('reading.tabs.myReadings'),
            badge: myReadingItems.length > 0 ? myReadingItems.length : undefined
        },
        {
            id: 'all' as TabType,
            label: t('reading.tabs.allReadings'),
            badge: readings.length
        },
    ], [t, myReadingItems.length, readings.length]);

    // Update current reading when filters change
    useEffect(() => {
        if (filteredReadings.length > 0) {
            // If current reading is not in filtered list, reset to first filtered item
            const currentInFiltered = currentReading && filteredReadings.some(r => r.id === currentReading.id);
            if (!currentInFiltered) {
                setCurrentIndex(0);
                setCurrentReading(filteredReadings[0]);
                setQuestionAnswers({});
                setShowCorrectness(false);
                setShowQuestions(false);
            }
        } else {
            setCurrentReading(null);
        }
    }, [filteredReadings, currentReading]);

    // Load reading data when language changes (with AbortController to prevent race conditions)
    useEffect(() => {
        const abortController = new AbortController();

        const loadData = async () => {
            try {
                const response = await fetch(getDataUrl('readings.json'), {
                    signal: abortController.signal
                });
                const data = await response.json();

                // Only update state if this request wasn't aborted
                if (!abortController.signal.aborted) {
                    setReadings(data);
                    setCurrentIndex(0);
                    if (data.length > 0) {
                        setCurrentReading(data[0]);
                    } else {
                        setCurrentReading(null);
                    }
                }
            } catch (error) {
                // Ignore abort errors - they're expected when switching languages rapidly
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                console.error('Failed to load readings:', error);
                if (!abortController.signal.aborted) {
                    setReadings([]);
                    setCurrentReading(null);
                }
            }
        };

        loadData();

        // Cleanup: abort fetch if language changes before fetch completes
        return () => {
            abortController.abort();
        };
    }, [targetLanguage, getDataUrl]);

    useEffect(() => {
        const moduleData = getModule('reading');
        if (moduleData?.stats) {
            setStats({
                correct: moduleData.stats.correct || 0,
                total: moduleData.stats.total || 0,
                streak: moduleData.stats.streak || 0,
                textsRead: moduleData.stats.textsRead || 0,
                totalAttempts: moduleData.stats.totalAttempts || 0,
                comprehensionScore: moduleData.stats.comprehensionScore || 0,
                comprehensionTotal: moduleData.stats.comprehensionTotal || 0,
                comprehensionCorrect: moduleData.stats.comprehensionCorrect || 0
            });
        }
    }, [getModule]);

    const handleFilterChange = useCallback((id: string, checked: boolean) => {
        setFilters(prev => ({ ...prev, [id]: { ...prev[id], checked } }));
    }, []);

    const handlePlayReading = useCallback(() => {
        if (!currentReading) return;
        speak(currentReading.text, { audioUrl: currentReading.audioUrl });
    }, [currentReading, speak]);

    const handleCheckAnswers = useCallback(() => {
        if (!currentReading || !currentReading.questions) return;
        let correctCount = 0;
        const answers: Record<number, number> = {};
        currentReading.questions.forEach((q, index) => {
            const selected = questionAnswers[index];
            if (selected !== undefined) {
                answers[index] = selected;
                if (selected === q.correct) {
                    correctCount++;
                }
            }
        });

        const questionCount = currentReading.questions.length;
        const allCorrect = correctCount === questionCount;
        const newCorrect = stats.correct + correctCount;
        const newTotal = stats.total + questionCount;
        const newStreak = allCorrect ? stats.streak + 1 : 0;

        // Calculate reading-specific stats
        const currentTextsRead = (stats as Record<string, number>).textsRead || 0;
        const currentTotalAttempts = (stats as Record<string, number>).totalAttempts || 0;
        const currentComprehensionTotal = (stats as Record<string, number>).comprehensionTotal || 0;
        const currentComprehensionCorrect = (stats as Record<string, number>).comprehensionCorrect || 0;

        const newTextsRead = currentTextsRead + 1;
        const newTotalAttempts = currentTotalAttempts + 1;
        const newComprehensionCorrect = currentComprehensionCorrect + correctCount;
        const newComprehensionTotal = currentComprehensionTotal + questionCount;
        const comprehensionScore = newComprehensionTotal > 0
            ? Math.round((newComprehensionCorrect / newComprehensionTotal) * 100)
            : 0;

        const updatedStats = {
            correct: newCorrect,
            total: newTotal,
            streak: newStreak,
            textsRead: newTextsRead,
            totalAttempts: newTotalAttempts,
            comprehensionScore,
            comprehensionTotal: newComprehensionTotal,
            comprehensionCorrect: newComprehensionCorrect
        };

        setStats(updatedStats);
        setShowCorrectness(true);
        updateStats('reading', updatedStats);

        // Add reading to SRS review queue
        markLearned('reading', String(currentReading.id));
    }, [currentReading, questionAnswers, stats, updateStats]);

    const nextReading = useCallback(() => {
        if (filteredReadings.length === 0) return;
        const nextIndex = (currentIndex + 1) % filteredReadings.length;
        setCurrentIndex(nextIndex);
        setCurrentReading(filteredReadings[nextIndex]);
        setQuestionAnswers({});
        setShowCorrectness(false);
        setShowQuestions(false);
    }, [currentIndex, filteredReadings]);

    const byTypeStats = learnedStats.byType as Record<string, number>;

    const { title: pageTitle, description: pageDescription } = getModuleName('reading', targetLanguage, t);

    // Render My Cards tab - practice view
    const renderMyCardsTab = () => {
        if (myReadingItems.length === 0) {
            return (
                <EmptyState
                    icon={<FiBookOpen />}
                    title={t('reading.empty.title')}
                    text={t('reading.empty.desc')}
                    actions={
                        <Button variant="primary" onClick={() => setActiveTab('all')}>
                            {t('reading.empty.browse')}
                        </Button>
                    }
                />
            );
        }

        return (
            <div className={study.content}>
                <OptionsPanel>
                    {showFuriganaOption && (
                        <div className={optionsStyles.toggleContainer}>
                            <Text variant="label" color="secondary">{t('reading.showFurigana')}</Text>
                            <Toggle
                                options={[
                                    { id: 'show', label: t('reading.show') },
                                    { id: 'hide', label: t('reading.hide') }
                                ]}
                                value={showFurigana ? 'show' : 'hide'}
                                onChange={(val) => setShowFurigana(val === 'show')}
                                name="reading-furigana"
                            />
                        </div>
                    )}
                    <div className={optionsStyles.group}>
                        <Text variant="label" color="secondary">{t('library.filters.level')}</Text>
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

                {!currentReading ? (
                    <EmptyState
                        icon={<FiSearch />}
                        title={t('reading.empty.filterEmpty')}
                    />
                ) : (
                    <div className={`${study.content} ${study.column}`}>
                        <article className={study.surface}>
                            <h2 className={styles.readingTitle}>
                                {getText(currentReading.titleTranslations, currentReading.title)}
                            </h2>

                            <div
                                lang={targetLanguage}
                                className={`${styles.readingText} ${showFurigana ? styles.withFurigana : styles.noFurigana}`}
                            >
                                {currentReading.text}
                            </div>

                            <div className={styles.readingActions}>
                                {isPlaying ? (
                                    <Button onClick={stop} variant="secondary">
                                        <IoStop aria-hidden="true" /> {t('common.stop')}
                                    </Button>
                                ) : (
                                    <Button onClick={handlePlayReading} variant="secondary">
                                        <IoVolumeHigh aria-hidden="true" /> {t('listening.playAudio')}
                                    </Button>
                                )}
                                {currentReading.questions && (
                                    <Button
                                        onClick={() => setShowQuestions(!showQuestions)}
                                        variant="primary"
                                        aria-expanded={showQuestions}
                                    >
                                        {t('reading.showQuestions')}
                                    </Button>
                                )}
                            </div>
                        </article>

                        {showQuestions && currentReading.questions && (
                            <section className={study.surface}>
                                <h2 className={study.sectionTitle}>{t('reading.comprehensionQuestions')}</h2>
                                <ol className={styles.questionsList}>
                                    {currentReading.questions.map((q, index) => (
                                        <li key={index} className={styles.questionItem}>
                                            <h3 className={styles.questionText}>
                                                {index + 1}. {getQuestion(q.question, q.questionTranslations)}
                                            </h3>
                                            <div className={styles.optionsGrid}>
                                                {q.options.map((opt, optIndex) => (
                                                    <Button
                                                        key={optIndex}
                                                        variant={questionAnswers[index] === optIndex ? 'primary' : 'ghost'}
                                                        onClick={() => setQuestionAnswers(prev => ({ ...prev, [index]: optIndex }))}
                                                        className={styles.optionButton}
                                                        disabled={showCorrectness}
                                                        aria-pressed={questionAnswers[index] === optIndex}
                                                    >
                                                        <span className={styles.optionLabel}>{opt}</span>
                                                        {showCorrectness && optIndex === q.correct && <IoCheckmark className={styles.optionCorrect} role="img" aria-label={t('common.correct')} />}
                                                        {showCorrectness && questionAnswers[index] === optIndex && optIndex !== q.correct && <IoClose className={styles.optionIncorrect} role="img" aria-label={t('common.incorrect')} />}
                                                    </Button>
                                                ))}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                                <div className={styles.questionsFooter}>
                                    {!showCorrectness ? (
                                        <Button onClick={handleCheckAnswers} fullWidth>
                                            {t('reading.checkAnswers')}
                                        </Button>
                                    ) : (
                                        <Button onClick={nextReading} fullWidth>
                                            {t('common.next')}
                                        </Button>
                                    )}
                                </div>
                            </section>
                        )}

                        <div className={study.actions}>
                            <StatsPanel correct={stats.correct} total={stats.total} streak={stats.streak} />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Render All tab - browse view
    const renderAllTab = () => {
        return (
            <div className={study.content}>
                <StatTiles
                    className={study.stats}
                    items={[
                        { id: 'learned', value: byTypeStats?.reading || 0, label: t('reading.stats.learned') },
                        { id: 'total', value: readings.length, label: t('reading.stats.total') },
                        { id: 'comprehension', value: `${stats.comprehensionScore}%`, label: t('reading.stats.comprehension') },
                    ]}
                />

                <div className={study.filterBar}>
                    <Input
                        size="sm"
                        type="search"
                        placeholder={t('reading.searchPlaceholder')}
                        aria-label={t('reading.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={study.search}
                    />
                    {displayLevels.map((level) => (
                        <Chip
                            key={level.id}
                            id={level.id}
                            label={level.name}
                            checked={selectedLevel === level.id}
                            onChange={(checked) => setSelectedLevel(checked ? level.id : null)}
                        />
                    ))}
                </div>

                {browseItems.length > 0 ? (
                    <ul className={study.grid}>
                        {browseItems.map((reading) => {
                            const isLearned = learnedReadingIds.has(String(reading.id));
                            return (
                                <li
                                    key={reading.id}
                                    className={`${study.item} ${isLearned ? study.itemLearned : ''}`}
                                >
                                    <div className={study.itemHeader}>
                                        <h3 className={study.itemTitle}>
                                            {getText(reading.titleTranslations, reading.title)}
                                        </h3>
                                        <span className={study.level}>
                                            {reading.level || t('common.unknown')}
                                        </span>
                                    </div>
                                    <p className={study.itemText} lang={targetLanguage}>
                                        {reading.text}
                                    </p>
                                    <div className={study.itemActions}>
                                        {isLearned ? (
                                            <span className={study.learnedBadge}>
                                                <FiCheck aria-hidden="true" /> {t('reading.stats.learned')}
                                            </span>
                                        ) : (
                                            <Button variant="ghost" size="sm">
                                                {t('reading.viewLesson')}
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <EmptyState
                        icon={<FiSearch />}
                        title={t('reading.empty.searchEmpty')}
                        text={t('reading.empty.searchHint')}
                    />
                )}
            </div>
        );
    };

    return (
        <ErrorBoundary>
            <LanguageContentGuard moduleName="reading">
                <Container variant="dashboard" streak={stats.streak}>
                    <PageHeader title={pageTitle} subtitle={pageDescription} />

                    <TabSelector
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(tabId) => setActiveTab(tabId as TabType)}
                    />

                    {activeTab === 'myCards' && renderMyCardsTab()}
                    {activeTab === 'all' && renderAllTab()}
                </Container>
            </LanguageContentGuard>
        </ErrorBoundary>
    );
}
