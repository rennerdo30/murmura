'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import Navigation from '@/components/common/Navigation';
import StatsPanel from '@/components/common/StatsPanel';
import LanguageContentGuard from '@/components/common/LanguageContentGuard';
import { Container, Card, Text, Button, Chip, OptionsPanel, Animated } from '@/components/ui';
import optionsStyles from '@/components/ui/OptionsPanel.module.css';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useTTS } from '@/hooks/useTTS';
import { ListeningExercise, Filter } from '@/types';
import { IoVolumeHigh, IoCheckmark, IoClose, IoStop } from 'react-icons/io5';
import styles from './listening.module.css';

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
                setExercises(data);
                setCurrentIndex(0);
                if (data.length > 0) {
                    setCurrentExercise(data[0]);
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
        const isCorrect = inputValue.trim().replace(/\s+/g, '') === currentExercise.text.trim().replace(/\s+/g, '');

        const newCorrect = correct + (isCorrect ? 1 : 0);
        const newTotal = total + 1;
        const newStreak = isCorrect ? streak + 1 : 0;

        setCorrect(newCorrect);
        setTotal(newTotal);
        setStreak(newStreak);
        setShowFeedback(true);
        updateStats('listening', { correct: newCorrect, total: newTotal, streak: newStreak });
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

    if (!currentExercise) {
        return (
            <LanguageContentGuard moduleName="listening">
                <Container variant="centered">
                    <Navigation />
                    <Text>{t('listening.noExercises')}</Text>
                </Container>
            </LanguageContentGuard>
        );
    }

    return (
        <LanguageContentGuard moduleName="listening">
            <Container variant="centered" streak={streak}>
                <Navigation />

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

            <Card className={styles.listeningCard} variant="glass">
                <Text variant="h2" color="gold" className={styles.listeningTitle}>
                    {currentExercise.title}
                </Text>

                <div className={styles.audioControls}>
                    {isPlaying ? (
                        <Button onClick={stop} variant="danger" size="lg" className={styles.playButton}>
                            <IoStop /> {t('common.stop')}
                        </Button>
                    ) : (
                        <Button onClick={handlePlayAudio} variant="primary" size="lg" className={styles.playButton}>
                            <IoVolumeHigh /> {t('listening.playAudio')}
                        </Button>
                    )}
                </div>

                <div className="mt-6">
                    <Button variant="ghost" onClick={() => setShowTranscript(!showTranscript)}>
                        {showTranscript ? t('listening.hideTranscript') : t('listening.showTranscript')}
                    </Button>
                    {showTranscript && (
                        <Animated animation="fadeInUp">
                            <Text className={styles.transcriptText}>{currentExercise.transcript}</Text>
                        </Animated>
                    )}
                </div>
            </Card>

            <Card className={styles.dictationSection} variant="glass">
                <Text className={styles.dictationLabel}>{t('listening.typeWhatYouHear')}</Text>
                <textarea
                    className={styles.dictationInput}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={t('listening.typeJapaneseText')}
                    disabled={showFeedback}
                />

                {!showFeedback ? (
                    <Button onClick={handleCheckAnswer} fullWidth className="mt-4">
                        {t('listening.checkAnswer')}
                    </Button>
                ) : (
                    <Button onClick={nextExercise} fullWidth className="mt-4">
                        {t('common.next')}
                    </Button>
                )}

                {showFeedback && (
                    <Animated animation="pulse">
                        <div className={`${styles.dictationFeedback} ${inputValue.trim().replace(/\s+/g, '') === currentExercise.text.trim().replace(/\s+/g, '') ? styles.correct : styles.incorrect}`}>
                            <Text variant="h3" color={inputValue.trim().replace(/\s+/g, '') === currentExercise.text.trim().replace(/\s+/g, '') ? 'success' : 'error'}>
                                {inputValue.trim().replace(/\s+/g, '') === currentExercise.text.trim().replace(/\s+/g, '')
                                    ? <>{t('common.correct')}! <IoCheckmark style={{ display: 'inline-block', verticalAlign: 'middle' }} /></>
                                    : <><IoClose style={{ display: 'inline-block', verticalAlign: 'middle' }} /> {t('common.incorrect')}. {t('common.correct')}: {currentExercise.text}</>}
                            </Text>
                        </div>
                    </Animated>
                )}
            </Card>

            <StatsPanel correct={correct} total={total} streak={streak} />
            </Container>
        </LanguageContentGuard>
    );
}
