'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import StatsPanel from '@/components/common/StatsPanel';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import { Container, Text, Button, Chip, OptionsPanel, Animated } from '@/components/ui';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useTTS } from '@/hooks/useTTS';
import { ListeningExercise, Filter } from '@/types';
import { markLearned } from '@/lib/storage';
import { IoVolumeHigh, IoCheckmark, IoClose, IoStop, IoHeadset, IoHome } from 'react-icons/io5';
import { getModuleName } from '@/lib/learningModules';
import study from '@/styles/study.module.css';
import styles from './listening.module.css';

/** Dictation answers are compared without any whitespace. */
const normalizeDictation = (value: string): string => value.trim().replace(/\s+/g, '');

export default function ListeningPage() {
    const { getModuleData: getModule, updateModuleStats: updateStats } = useProgressContext();
    const { t } = useLanguage();
    const { targetLanguage, levels, getDataUrl } = useTargetLanguage();
    const { speak, stop, isPlaying } = useTTS();
    const [exercises, setExercises] = useState<ListeningExercise[]>([]);
    const [currentExercise, setCurrentExercise] = useState<ListeningExercise | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [inputValue, setInputValue] = useState('');
    const [showTranscript, setShowTranscript] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [correct, setCorrect] = useState(0);
    const [total, setTotal] = useState(0);
    const [streak, setStreak] = useState(0);

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
                checked: true, // Both levels checked by default for listening
                type: 'checkbox'
            };
        });
        setFilters(newFilters);
    }, [targetLanguage, displayLevels]);

    // Load listening data when language changes
    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch(getDataUrl('listening.json'));
                const data = await response.json();
                const rawExercises: Array<ListeningExercise & { audio_url?: string }> = Array.isArray(data)
                    ? data as Array<ListeningExercise & { audio_url?: string }>
                    : Array.isArray(data.listening)
                        ? data.listening as Array<ListeningExercise & { audio_url?: string }>
                        : [];
                const normalizedExercises = rawExercises.map((exercise: ListeningExercise & { audio_url?: string }) => ({
                    ...exercise,
                    audioUrl: exercise.audioUrl || exercise.audio_url,
                })) as ListeningExercise[];

                setExercises(normalizedExercises);
                setCurrentIndex(0);
                if (normalizedExercises.length > 0) {
                    setCurrentExercise(normalizedExercises[0]);
                } else {
                    setCurrentExercise(null);
                }
            } catch (error) {
                console.error('Failed to load listening exercises:', error);
                setExercises([]);
                setCurrentExercise(null);
            }
        };
        loadData();
    }, [targetLanguage, getDataUrl]);

    useEffect(() => {
        const moduleData = getModule('listening');
        if (moduleData?.stats) {
            setCorrect(moduleData.stats.correct || 0);
            setTotal(moduleData.stats.total || 0);
            setStreak(moduleData.stats.streak || 0);
        }
    }, [getModule]);

    const handleFilterChange = useCallback((id: string, checked: boolean) => {
        setFilters(prev => ({ ...prev, [id]: { ...prev[id], checked } }));
    }, []);

    const handlePlayAudio = useCallback(() => {
        if (!currentExercise) return;
        speak(currentExercise.text, { audioUrl: currentExercise.audioUrl });
    }, [currentExercise, speak]);

    const handleCheckAnswer = useCallback(() => {
        if (!currentExercise) return;
        const isCorrect = normalizeDictation(inputValue) === normalizeDictation(currentExercise.text);

        const newCorrect = correct + (isCorrect ? 1 : 0);
        const newTotal = total + 1;
        const newStreak = isCorrect ? streak + 1 : 0;

        setCorrect(newCorrect);
        setTotal(newTotal);
        setStreak(newStreak);
        setShowFeedback(true);
        updateStats('listening', { correct: newCorrect, total: newTotal, streak: newStreak });

        // Add listening exercise to SRS review queue when answered correctly
        if (isCorrect) {
            markLearned('listening', String(currentExercise.id));
        }
    }, [currentExercise, inputValue, correct, total, streak, updateStats]);

    const nextExercise = useCallback(() => {
        if (exercises.length === 0) return;
        const nextIndex = (currentIndex + 1) % exercises.length;
        setCurrentIndex(nextIndex);
        setCurrentExercise(exercises[nextIndex]);
        setInputValue('');
        setShowFeedback(false);
        setShowTranscript(false);
    }, [currentIndex, exercises]);

    const { title: pageTitle, description: pageDescription } = getModuleName('listening', targetLanguage, t);

    if (!currentExercise) {
        return (
            <ErrorBoundary>
                <LanguageContentGuard moduleName="listening">
                    <Container variant="dashboard">
                        <PageHeader title={pageTitle} subtitle={pageDescription} />
                        <EmptyState
                            icon={<IoHeadset />}
                            title={t('listening.noExercises')}
                            text={t('learnMode.noLessonsAvailable')}
                            actions={
                                <Button href="/" variant="primary">
                                    <IoHome aria-hidden="true" /> {t('review.stats.backToDashboard')}
                                </Button>
                            }
                        />
                    </Container>
                </LanguageContentGuard>
            </ErrorBoundary>
        );
    }

    const answeredCorrectly = showFeedback && normalizeDictation(inputValue) === normalizeDictation(currentExercise.text);

    return (
        <ErrorBoundary>
            <LanguageContentGuard moduleName="listening">
                <Container variant="dashboard" streak={streak}>
                    <PageHeader title={pageTitle} subtitle={pageDescription} />

                    <div className={study.content}>
                        <OptionsPanel>
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

                        <div className={`${study.content} ${study.column}`}>
                            <section className={`${study.surface} ${styles.playerCard}`}>
                                <h2 className={styles.listeningTitle}>{currentExercise.title}</h2>

                                {isPlaying ? (
                                    <Button onClick={stop} variant="secondary" size="lg" className={styles.playButton}>
                                        <IoStop aria-hidden="true" /> {t('common.stop')}
                                    </Button>
                                ) : (
                                    <Button onClick={handlePlayAudio} variant="primary" size="lg" className={styles.playButton}>
                                        <IoVolumeHigh aria-hidden="true" /> {t('listening.playAudio')}
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={study.tapTarget}
                                    onClick={() => setShowTranscript(!showTranscript)}
                                    aria-expanded={showTranscript}
                                >
                                    {showTranscript ? t('listening.hideTranscript') : t('listening.showTranscript')}
                                </Button>
                                {showTranscript && (
                                    <Animated animation="fadeInUp">
                                        <p className={styles.transcriptText} lang={targetLanguage}>{currentExercise.transcript}</p>
                                    </Animated>
                                )}
                            </section>

                            <section className={study.surface}>
                                <label htmlFor="listening-dictation" className={study.sectionTitle}>
                                    {t('listening.typeWhatYouHear')}
                                </label>
                                <textarea
                                    id="listening-dictation"
                                    lang={targetLanguage}
                                    className={styles.dictationInput}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={t('listening.typeJapaneseText')}
                                    disabled={showFeedback}
                                />

                                {showFeedback && (
                                    <Animated animation="pulse">
                                        <p
                                            role="status"
                                            aria-live="polite"
                                            className={`${styles.dictationFeedback} ${answeredCorrectly ? styles.correct : styles.incorrect}`}
                                        >
                                            {answeredCorrectly
                                                ? <><IoCheckmark aria-hidden="true" /> {t('common.correct')}!</>
                                                : <><IoClose aria-hidden="true" /> {t('common.incorrect')}. {t('common.correct')}: {currentExercise.text}</>}
                                        </p>
                                    </Animated>
                                )}

                                {!showFeedback ? (
                                    <Button onClick={handleCheckAnswer} fullWidth className={study.tapTarget}>
                                        {t('listening.checkAnswer')}
                                    </Button>
                                ) : (
                                    <Button onClick={nextExercise} fullWidth className={study.tapTarget}>
                                        {t('common.next')}
                                    </Button>
                                )}
                            </section>

                            <div className={study.actions}>
                                <StatsPanel correct={correct} total={total} streak={streak} />
                            </div>
                        </div>
                    </div>
                </Container>
            </LanguageContentGuard>
        </ErrorBoundary>
    );
}
