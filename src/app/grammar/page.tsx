'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { FiBook, FiList, FiCheck, FiClock } from 'react-icons/fi';
import { IoCheckmark } from 'react-icons/io5';
import Navigation from '@/components/common/Navigation';
import StatsPanel from '@/components/common/StatsPanel';
import TabSelector from '@/components/common/TabSelector';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Container, Card, Text, Button, Chip, Animated, OptionsPanel, Input } from '@/components/ui';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { useLearnedContent } from '@/hooks/useLearnedContent';
import { GrammarItem, Filter } from '@/types';
import styles from './grammar.module.css';

type TabType = 'myCards' | 'all';

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
    const [activeTab, setActiveTab] = useState<TabType>('myCards');

    // Data state
    const [grammarPoints, setGrammarPoints] = useState<GrammarItem[]>([]);
    const [currentGrammar, setCurrentGrammar] = useState<GrammarItem | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
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

    const [filters, setFilters] = useState<Record<string, Filter>>({});

    // Update filters when language changes
    useEffect(() => {
        const newFilters: Record<string, Filter> = {};
        displayLevels.forEach((level) => {
            newFilters[level.id] = {
                id: level.id,
                label: level.name,
                checked: true,
                type: 'checkbox'
            };
        });
        setFilters(newFilters);
    }, [targetLanguage, displayLevels]);

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
                    setGrammarPoints(data);
                    setCurrentIndex(0);
                    if (data.length > 0) {
                        setCurrentGrammar(data[0]);
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
    }, [targetLanguage, getDataUrl]);

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
            items = items.filter(g => g.jlpt === selectedLevel);
        }

        return items.slice(0, 30);
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
    ], [t, myGrammarItems.length, grammarPoints.length]);

    const handleFilterChange = useCallback((id: string, checked: boolean) => {
        setFilters(prev => ({ ...prev, [id]: { ...prev[id], checked } }));
    }, []);

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
            : grammarPoints;

        if (availableGrammar.length === 0) return;

        const nextIndex = (currentIndex + 1) % availableGrammar.length;
        setCurrentIndex(nextIndex);
        setCurrentGrammar(availableGrammar[nextIndex]);
        setSelectedAnswer(null);
        setShowFeedback(false);
    }, [currentIndex, grammarPoints, myGrammarItems, activeTab]);

    // Reset to first grammar when tab changes
    useEffect(() => {
        const availableGrammar = activeTab === 'myCards' && myGrammarItems.length > 0
            ? myGrammarItems
            : grammarPoints;

        if (availableGrammar.length > 0) {
            setCurrentIndex(0);
            setCurrentGrammar(availableGrammar[0]);
            setSelectedAnswer(null);
            setShowFeedback(false);
        }
    }, [activeTab, myGrammarItems, grammarPoints]);

    // Render browse view
    const renderBrowseView = () => (
        <>
            <div className={styles.filterSection}>
                <Input
                    type="text"
                    placeholder={t('grammar.searchPlaceholder')}
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

            <div className={styles.browseGrid}>
                {filteredGrammar.map((grammar) => {
                    const grammarId = `${targetLanguage}-grammar-${grammar.id}`;
                    const isLearned = isContentLearned(grammarId);

                    return (
                        <div
                            key={grammar.id}
                            className={`${styles.grammarBrowseCard} ${isLearned ? styles.learned : ''}`}
                        >
                            <div className={styles.grammarHeader}>
                                <div className={styles.grammarPointTitle}>{getText(grammar.titleTranslations, grammar.title)}</div>
                                <span className={styles.grammarLevel}>
                                    {grammar.jlpt || 'N/A'}
                                </span>
                            </div>
                            <div className={styles.grammarExplanation}>
                                {getText(grammar.explanations, grammar.explanation)}
                            </div>
                            <div className={styles.grammarActions}>
                                {isLearned ? (
                                    <span className={styles.learnedBadge}>
                                        <FiCheck size={12} /> {t('grammar.actions.learned')}
                                    </span>
                                ) : (
                                    <Button href="/paths" variant="ghost" size="sm">
                                        <FiBook size={14} /> {t('grammar.actions.learnInLessons')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredGrammar.length === 0 && (
                <div className={styles.emptyState}>
                    <FiList className={styles.emptyIcon} />
                    <Text variant="h3">{t('grammar.empty.searchEmpty')}</Text>
                    <Text color="muted">{t('grammar.empty.searchHint')}</Text>
                </div>
            )}
        </>
    );

    // Render practice view
    const renderPracticeView = () => {
        // No learned grammar yet
        if (myGrammarItems.length === 0 && learnedReady) {
            return (
                <div className={styles.emptyState}>
                    <FiBook className={styles.emptyIcon} />
                    <Text variant="h3">{t('grammar.empty.title')}</Text>
                    <Text color="muted">{t('grammar.empty.desc')}</Text>
                    <Button href="/paths" variant="primary">
                        {t('grammar.empty.goToLessons')}
                    </Button>
                </div>
            );
        }

        if (!currentGrammar) {
            return (
                <div className={styles.emptyState}>
                    <Text variant="h3">{t('grammar.noGrammar')}</Text>
                    <Text color="muted">{t('grammar.empty.unlock')}</Text>
                </div>
            );
        }

        const exercise = currentGrammar.exercises?.[0];

        return (
            <>
                <OptionsPanel>
                    <div className={optionsStyles.toggleContainer}>
                        <Text variant="label" color="muted">Level</Text>
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
                    </div>
                </OptionsPanel>

                <Card className={styles.grammarCard} variant="glass">
                    <Text variant="h2" color="gold" className={styles.grammarTitle}>
                        {getText(currentGrammar.titleTranslations, currentGrammar.title)}
                    </Text>
                    <div className={styles.explanationSection}>
                        <Text className={styles.explanationText}>
                            {getText(currentGrammar.explanations, currentGrammar.explanation)}
                        </Text>
                    </div>

                    <div className={styles.examplesList}>
                        {currentGrammar.examples.slice(0, 2).map((example, i) => {
                            const { primary, secondary } = getExampleText(example as Record<string, unknown>);
                            return (
                                <div key={i} className={styles.exampleItem}>
                                    <Text color="primary" className={styles.exampleJa}>{primary}</Text>
                                    <Text color="secondary" className={styles.exampleEn}>{secondary}</Text>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {exercise && (
                    <Card className={styles.exerciseSection} variant="glass">
                        <Text variant="h3" className={styles.exerciseQuestion}>
                            {getQuestion(exercise.question, exercise.questionTranslations)}
                        </Text>
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
                                <Text
                                    variant="h3"
                                    color={selectedAnswer === exercise.correct ? 'success' : 'error'}
                                    className={styles.exerciseFeedback}
                                >
                                    {selectedAnswer === exercise.correct
                                        ? <>{t('common.correct')}! <IoCheckmark style={{ display: 'inline-block', verticalAlign: 'middle' }} /></>
                                        : `${t('common.incorrect')}. ${t('common.correct')}: ${exercise.options[exercise.correct]}`}
                                </Text>
                                <Button onClick={nextGrammar} className="mt-4" fullWidth>
                                    {t('common.next')}
                                </Button>
                            </Animated>
                        )}
                    </Card>
                )}

                <StatsPanel correct={stats.correct} total={stats.total} streak={stats.streak} />
            </>
        );
    };

    return (
        <ErrorBoundary>
            <LanguageContentGuard moduleName="grammar">
                <Container variant="centered" streak={activeTab === 'myCards' ? stats.streak : 0}>
                    <Navigation />

                    {/* Page Header */}
                    <div className={styles.pageHeader}>
                        <Text variant="h1">{t('modules.grammar.title')}</Text>
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
                                    {(learnedStats.byType as Record<string, number>)?.grammar || myGrammarItems.length}
                                </span>
                                <span className={styles.statLabel}>{t('grammar.stats.pointsLearned')}</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>{stats.pointsMastered}</span>
                                <span className={styles.statLabel}>{t('grammar.stats.mastered')}</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statValue}>
                                    {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%
                                </span>
                                <span className={styles.statLabel}>{t('grammar.stats.accuracy')}</span>
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
