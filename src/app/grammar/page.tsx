'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FiBook, FiList, FiCheck, FiClock } from 'react-icons/fi';
import { IoCheckmark, IoChevronBack, IoPlay } from 'react-icons/io5';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatsPanel from '@/components/common/StatsPanel';
import TabSelector from '@/components/common/TabSelector';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Container, Button, Chip, Animated, Input, StatTiles } from '@/components/ui';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { useLearnedContent } from '@/hooks/useLearnedContent';
import { GrammarItem } from '@/types';
import { getModuleName } from '@/lib/learningModules';
import study from '@/styles/study.module.css';
import styles from './grammar.module.css';
import { normalizeLevelId } from '@/lib/dataLoader';

/** Level of a grammar point: JLPT for Japanese, the generic level field elsewhere (HSK, TOPIK, CEFR). */
const getGrammarLevel = (item: GrammarItem): string => normalizeLevelId(item.jlpt || item.level);

type TabType = 'myCards' | 'all';

/** Maximum number of grammar points shown in the browse grid. */
const BROWSE_LIMIT = 30;

/** Number of example sentences shown on the practice card. */
const PRACTICE_EXAMPLE_COUNT = 2;

// Helper to get example text - handles different language data structures
function getExampleText(example: Record<string, unknown>): { primary: string; secondary: string } {
    const primary = (example.japanese || example.korean || example.chinese ||
                    example.spanish || example.german || example.italian ||
                    example.english || '') as string;
    const secondary = (example.english || example.translation || '') as string;
    return { primary, secondary };
}

export default function GrammarPage() {
    const { getModuleData: getModule, updateModuleStats: updateStats } = useProgressContext();
    const { t } = useLanguage();
    const { targetLanguage, levels, getDataUrl } = useTargetLanguage();
    const { getText, getQuestion } = useContentTranslation();
    const {
        isContentLearned,
        getLearnedByType,
        stats: learnedStats,
        dueCount,
        isReady: learnedReady
    } = useLearnedContent();

    // Tab state
    const [selectedTab, setActiveTab] = useState<TabType | null>(null);
    const [isBrowsePractice, setIsBrowsePractice] = useState(false);

    // Data state
    const [grammarPoints, setGrammarPoints] = useState<GrammarItem[]>([]);
    const [currentGrammar, setCurrentGrammar] = useState<GrammarItem | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [stats, setStats] = useState({
        correct: 0,
        total: 0,
        streak: 0,
        bestStreak: 0,
        pointsMastered: 0
    });

    // Browse mode state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

    const statsRef = useRef(stats);
    useEffect(() => {
        statsRef.current = stats;
    }, [stats]);

    // Get first 2 levels from language config for filters
    const displayLevels = useMemo(() => levels.slice(0, 2), [levels]);

    // Load grammar data
    useEffect(() => {
        const abortController = new AbortController();

        const loadData = async () => {
            try {
                const response = await fetch(getDataUrl('grammar.json'), {
                    signal: abortController.signal
                });
                const data = await response.json();

                if (!abortController.signal.aborted) {
                    const levelOrder = new Map(levels.map(level => [normalizeLevelId(level.id), level.order]));
                    const orderedData = [...data as GrammarItem[]].sort((a, b) =>
                        (levelOrder.get(getGrammarLevel(a)) ?? Number.MAX_SAFE_INTEGER) -
                        (levelOrder.get(getGrammarLevel(b)) ?? Number.MAX_SAFE_INTEGER)
                    );
                    setGrammarPoints(orderedData);
                    if (data.length > 0) {
                        setCurrentGrammar(orderedData[0]);
                    } else {
                        setCurrentGrammar(null);
                    }
                }
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                console.error('Failed to load grammar points:', error);
                if (!abortController.signal.aborted) {
                    setGrammarPoints([]);
                    setCurrentGrammar(null);
                }
            }
        };

        loadData();

        return () => {
            abortController.abort();
        };
    }, [targetLanguage, getDataUrl, levels]);

    // Load stats
    useEffect(() => {
        const moduleData = getModule('grammar');
        if (moduleData?.stats) {
            const loadedStats = {
                correct: moduleData.stats.correct || 0,
                total: moduleData.stats.total || 0,
                streak: moduleData.stats.streak || 0,
                bestStreak: moduleData.stats.bestStreak || 0,
                pointsMastered: moduleData.stats.pointsMastered || 0
            };
            setStats(loadedStats);
            statsRef.current = loadedStats;
        }
    }, [getModule]);

    // Get learned grammar items
    const learnedGrammar = useMemo(() => {
        return getLearnedByType('grammar');
    }, [getLearnedByType]);

    // Get grammar items that match learned content
    const myGrammarItems = useMemo(() => {
        const learnedIds = new Set(learnedGrammar.map(l => l.contentId));
        return grammarPoints.filter(g => {
            const grammarId = `${targetLanguage}-grammar-${g.id}`;
            return learnedIds.has(grammarId) || isContentLearned(grammarId);
        });
    }, [grammarPoints, learnedGrammar, targetLanguage, isContentLearned]);

    const activeTab = selectedTab ?? (myGrammarItems.length > 0 ? 'myCards' : 'all');

    // Filtered grammar for browse view
    const filteredGrammar = useMemo(() => {
        let items = grammarPoints;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(g =>
                g.title?.toLowerCase().includes(query) ||
                g.explanation?.toLowerCase().includes(query)
            );
        }

        if (selectedLevel) {
            items = items.filter(g => getGrammarLevel(g) === normalizeLevelId(selectedLevel));
        }

        return items.slice(0, BROWSE_LIMIT);
    }, [grammarPoints, searchQuery, selectedLevel]);

    // Tab configuration
    const tabs = useMemo(() => [
        {
            id: 'myCards' as TabType,
            label: t('grammar.tabs.myGrammar'),
            badge: myGrammarItems.length > 0 ? myGrammarItems.length : undefined
        },
        {
            id: 'all' as TabType,
            label: t('grammar.tabs.allGrammar'),
            badge: grammarPoints.length
        },
    ], [myGrammarItems.length, grammarPoints.length, t]);

    const handleAnswerSelect = useCallback((index: number) => {
        if (showFeedback || !currentGrammar?.exercises?.[0]) return;
        setSelectedAnswer(index);
        setShowFeedback(true);

        const isCorrect = index === currentGrammar.exercises[0].correct;
        const currentStats = statsRef.current;
        const newCorrect = currentStats.correct + (isCorrect ? 1 : 0);
        const newTotal = currentStats.total + 1;
        const newStreak = isCorrect ? currentStats.streak + 1 : 0;
        const newBestStreak = Math.max(currentStats.bestStreak, newStreak);
        const newPointsMastered = isCorrect
            ? currentStats.pointsMastered + 1
            : currentStats.pointsMastered;

        const newStats = {
            correct: newCorrect,
            total: newTotal,
            streak: newStreak,
            bestStreak: newBestStreak,
            pointsMastered: newPointsMastered
        };

        statsRef.current = newStats;
        setStats(newStats);
        updateStats('grammar', newStats);
    }, [showFeedback, currentGrammar, updateStats]);

    const nextGrammar = useCallback(() => {
        const availableGrammar = activeTab === 'myCards' && myGrammarItems.length > 0
            ? myGrammarItems
            : filteredGrammar;

        if (availableGrammar.length === 0) return;

        const nextIndex = (availableGrammar.indexOf(currentGrammar!) + 1) % availableGrammar.length;
        setCurrentGrammar(availableGrammar[nextIndex]);
        setSelectedAnswer(null);
        setShowFeedback(false);
    }, [currentGrammar, filteredGrammar, myGrammarItems, activeTab]);

    // Reset to first grammar when tab changes
    useEffect(() => {
        const availableGrammar = activeTab === 'myCards' && myGrammarItems.length > 0
            ? myGrammarItems
            : grammarPoints;

        if (availableGrammar.length > 0) {
            setCurrentGrammar(availableGrammar[0]);
            setSelectedAnswer(null);
            setShowFeedback(false);
        }
    }, [activeTab, myGrammarItems, grammarPoints]);

    const { title: pageTitle, description: pageDescription } = getModuleName('grammar', targetLanguage, t);

    // Render browse view
    const renderBrowseView = () => (
        <div className={study.content}>
            <div className={study.filterBar}>
                <Input
                    size="sm"
                    type="search"
                    placeholder={t('grammar.searchPlaceholder')}
                    aria-label={t('grammar.searchPlaceholder')}
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

            {filteredGrammar.length > 0 ? (
                <ul className={study.grid}>
                    {filteredGrammar.map((grammar) => {
                        const grammarId = `${targetLanguage}-grammar-${grammar.id}`;
                        const isLearned = isContentLearned(grammarId);

                        return (
                            <li
                                key={grammar.id}
                                className={`${study.item} ${isLearned ? study.itemLearned : ''}`}
                            >
                                <div className={study.itemHeader}>
                                    <h3 className={study.itemTitle}>{getText(grammar.titleTranslations, grammar.title)}</h3>
                                    <span className={study.level}>
                                        {grammar.jlpt || grammar.level || t('common.unknown')}
                                    </span>
                                </div>
                                <p className={study.itemText}>
                                    {getText(grammar.explanations, grammar.explanation)}
                                </p>
                                <div className={study.itemActions}>
                                    {isLearned && (
                                        <span className={study.learnedBadge}>
                                            <FiCheck aria-hidden="true" /> {t('grammar.actions.learned')}
                                        </span>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={study.itemActionEnd}
                                        onClick={() => {
                                            setCurrentGrammar(grammar);
                                            setSelectedAnswer(null);
                                            setShowFeedback(false);
                                            setIsBrowsePractice(true);
                                        }}
                                    >
                                        <FiBook aria-hidden="true" /> {t('common.start')}
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <EmptyState
                    icon={<FiList />}
                    title={t('grammar.empty.searchEmpty')}
                    text={t('grammar.empty.searchHint')}
                />
            )}
        </div>
    );

    // Render practice view
    const renderPracticeView = () => {
        // No learned grammar yet
        if (activeTab === 'myCards' && myGrammarItems.length === 0 && learnedReady) {
            return (
                <EmptyState
                    icon={<FiBook />}
                    title={t('grammar.empty.title')}
                    text={t('grammar.empty.desc')}
                    actions={
                        <Button href="/paths" variant="primary">
                            <IoPlay aria-hidden="true" /> {t('grammar.empty.goToLessons')}
                        </Button>
                    }
                />
            );
        }

        if (!currentGrammar) {
            return (
                <EmptyState
                    icon={<FiList />}
                    title={t('grammar.noGrammar')}
                    text={t('grammar.empty.unlock')}
                />
            );
        }

        const exercise = currentGrammar.exercises?.[0];

        return (
            <div className={`${study.content} ${study.column}`}>
                {isBrowsePractice && (
                    <Button variant="ghost" size="sm" className={study.backLink} onClick={() => setIsBrowsePractice(false)}>
                        <IoChevronBack aria-hidden="true" /> {t('common.back')}
                    </Button>
                )}

                <article className={study.surface}>
                    <h2 className={styles.grammarTitle}>
                        {getText(currentGrammar.titleTranslations, currentGrammar.title)}
                    </h2>
                    <p className={styles.explanationText}>
                        {getText(currentGrammar.explanations, currentGrammar.explanation)}
                    </p>

                    <ul className={styles.examplesList}>
                        {currentGrammar.examples.slice(0, PRACTICE_EXAMPLE_COUNT).map((example, i) => {
                            const { primary, secondary } = getExampleText(example as Record<string, unknown>);
                            return (
                                <li key={i} className={styles.exampleItem}>
                                    <p className={styles.examplePrimary}>{primary}</p>
                                    <p className={styles.exampleSecondary}>{secondary}</p>
                                </li>
                            );
                        })}
                    </ul>
                </article>

                {exercise && (
                    <section className={study.surface}>
                        <h3 className={study.sectionTitle}>
                            {getQuestion(exercise.question, exercise.questionTranslations)}
                        </h3>
                        <div className={styles.optionsGrid}>
                            {exercise.options.map((option, i) => (
                                <Button
                                    key={i}
                                    variant={selectedAnswer === i ? (selectedAnswer === exercise.correct ? 'success' : 'danger') : 'ghost'}
                                    onClick={() => handleAnswerSelect(i)}
                                    disabled={showFeedback}
                                    className={styles.optionButton}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                        {showFeedback && (
                            <Animated animation="fadeInUp">
                                <div className={styles.feedbackRow}>
                                    <p
                                        role="status"
                                        aria-live="polite"
                                        className={`${styles.exerciseFeedback} ${selectedAnswer === exercise.correct ? styles.feedbackCorrect : styles.feedbackIncorrect}`}
                                    >
                                        {selectedAnswer === exercise.correct
                                            ? <><IoCheckmark aria-hidden="true" /> {t('common.correct')}!</>
                                            : `${t('common.incorrect')}. ${t('common.correct')}: ${exercise.options[exercise.correct]}`}
                                    </p>
                                    <Button onClick={nextGrammar} fullWidth>
                                        {t('common.next')}
                                    </Button>
                                </div>
                            </Animated>
                        )}
                    </section>
                )}

                {!exercise && (
                    <div className={study.actions}>
                        <Button onClick={nextGrammar}>{t('common.next')}</Button>
                    </div>
                )}

                <div className={study.actions}>
                    <StatsPanel correct={stats.correct} total={stats.total} streak={stats.streak} />
                </div>
            </div>
        );
    };

    return (
        <ErrorBoundary>
            <LanguageContentGuard moduleName="grammar">
                <Container variant="dashboard" streak={activeTab === 'myCards' ? stats.streak : 0}>
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
                                { id: 'learned', value: (learnedStats.byType as Record<string, number>)?.grammar || myGrammarItems.length, label: t('grammar.stats.pointsLearned') },
                                { id: 'mastered', value: stats.pointsMastered, label: t('grammar.stats.mastered') },
                                { id: 'accuracy', value: `${stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%`, label: t('grammar.stats.accuracy') },
                            ]}
                        />
                    )}

                    <TabSelector
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(tab) => {
                            setActiveTab(tab as TabType);
                            setIsBrowsePractice(false);
                        }}
                    />

                    {activeTab === 'myCards' || isBrowsePractice ? renderPracticeView() : renderBrowseView()}
                </Container>
            </LanguageContentGuard>
        </ErrorBoundary>
    );
}
