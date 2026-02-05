'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Navigation from '@/components/common/Navigation';
import { Container, Card, Text, Button, Animated } from '@/components/ui';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useGamification } from '@/hooks/useGamification';
import { useLanguage } from '@/context/LanguageProvider';
import { calculateLessonXP } from '@/lib/xp';
import LessonView from '@/components/lesson/LessonView';
import LessonSummary from '@/components/lesson/LessonSummary';
import { IoArrowBack, IoWarning } from 'react-icons/io5';
import styles from './lesson.module.css';

type LessonPhase = 'loading' | 'intro' | 'learning' | 'exercises' | 'summary' | 'error';

interface LessonResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  xpEarned: number;
  xpBreakdown: {
    base: number;
    perfect: number;
    streak: number;
  };
  leveledUp: boolean;
  newLevel?: number;
}

export default function LessonContent() {
  const params = useParams();
  const router = useRouter();
  const pathId = params.pathId as string;
  const lessonId = params.lessonId as string;

  const {
    curriculum,
    isLoading: curriculumLoading,
    error: curriculumError,
    getLesson,
    getLessonInfo,
    getNextLessonAfter,
    getLessonStatus,
    startLesson,
    completeLesson: completeLessonProgress,
  } = useCurriculum();

  const { streak, awardXP } = useGamification();
  const { t } = useLanguage();

  const [phase, setPhase] = useState<LessonPhase>('loading');
  const [lessonResult, setLessonResult] = useState<LessonResult | null>(null);

  // Get lesson data
  const lesson = useMemo(() => getLesson(lessonId), [getLesson, lessonId]);
  const lessonInfo = useMemo(() => getLessonInfo(lessonId), [getLessonInfo, lessonId]);
  const nextLesson = useMemo(() => getNextLessonAfter(lessonId), [getNextLessonAfter, lessonId]);
  const lessonStatus = useMemo(() => getLessonStatus(lessonId), [getLessonStatus, lessonId]);

  // Initialize phase based on loading state
  useEffect(() => {
    if (curriculumLoading) {
      setPhase('loading');
    } else if (curriculumError || !lesson) {
      setPhase('error');
    } else {
      setPhase('intro');
    }
  }, [curriculumLoading, curriculumError, lesson]);

  // Handle starting the lesson
  const handleStartLesson = useCallback(async () => {
    try {
      await startLesson(lessonId);
      setPhase('learning');
    } catch (error) {
      console.error('Failed to start lesson:', error);
      setPhase('learning'); // Continue anyway for offline mode
    }
  }, [startLesson, lessonId]);

  // Handle completing the learning phase
  const handleCompleteLearning = useCallback(() => {
    setPhase('exercises');
  }, []);

  // Handle completing exercises and finishing the lesson
  const handleCompleteExercises = useCallback(
    async (correctAnswers: number, totalQuestions: number) => {
      const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 100;
      const currentStreak = streak?.currentStreak ?? 0;

      // Calculate XP
      const { total: xpEarned, breakdown: xpBreakdown } = calculateLessonXP(score, currentStreak);

      try {
        // Award XP and update progress
        const result = await awardXP(xpEarned, 'lesson_complete');
        await completeLessonProgress(lessonId, score, xpEarned);

        // Add perfect bonus if applicable
        if (score === 100) {
          await awardXP(xpBreakdown.perfect, 'lesson_perfect');
        }

        setLessonResult({
          score,
          totalQuestions,
          correctAnswers,
          xpEarned: xpEarned + (score === 100 ? xpBreakdown.perfect : 0),
          xpBreakdown,
          leveledUp: result.leveledUp,
          newLevel: result.newLevel,
        });
      } catch (error) {
        console.error('Failed to complete lesson:', error);
        // Still show results even if save failed
        setLessonResult({
          score,
          totalQuestions,
          correctAnswers,
          xpEarned,
          xpBreakdown,
          leveledUp: false,
        });
      }

      setPhase('summary');
    },
    [streak, awardXP, completeLessonProgress, lessonId]
  );

  // Handle navigation to next lesson
  const handleNextLesson = useCallback(() => {
    if (nextLesson) {
      router.push(`/paths/${pathId}/${nextLesson.id}`);
    } else {
      router.push(`/paths/${pathId}`);
    }
  }, [nextLesson, pathId, router]);

  // Handle going back to path
  const handleBackToPath = useCallback(() => {
    router.push(`/paths/${pathId}`);
  }, [pathId, router]);

  // Render loading state
  if (phase === 'loading') {
    return (
      <Container variant="centered">
        <Navigation />
        <Card variant="glass" className={styles.loadingCard}>
          <div className={styles.loader} />
          <Text color="muted">{t('lessons.loading')}</Text>
        </Card>
      </Container>
    );
  }

  // Render error state
  if (phase === 'error' || !lesson) {
    return (
      <Container variant="centered">
        <Navigation />
        <Card variant="glass" className={styles.errorCard}>
          <IoWarning className={styles.errorIcon} />
          <Text variant="h2">{t('lessons.notFound')}</Text>
          <Text color="muted">
            {curriculumError || t('lessons.notFoundDescription', { lessonId })}
          </Text>
          <Button variant="ghost" onClick={handleBackToPath}>
            <IoArrowBack /> {t('lessons.backToPath')}
          </Button>
        </Card>
      </Container>
    );
  }

  // Render locked state
  if (lessonStatus === 'locked') {
    return (
      <Container variant="centered">
        <Navigation />
        <Card variant="glass" className={styles.lockedCard}>
          <IoWarning className={styles.lockedIcon} />
          <Text variant="h2">{t('lessons.locked')}</Text>
          <Text color="muted">
            {t('lessons.lockedDescription')}
          </Text>
          <Button variant="ghost" onClick={handleBackToPath}>
            <IoArrowBack /> {t('lessons.backToPath')}
          </Button>
        </Card>
      </Container>
    );
  }

  // Render summary phase
  if (phase === 'summary' && lessonResult) {
    return (
      <Container variant="centered" className={styles.lessonFlowContainer}>
        <Navigation />
        <LessonSummary
          lesson={lesson}
          result={lessonResult}
          nextLesson={nextLesson}
          onNextLesson={handleNextLesson}
          onBackToPath={handleBackToPath}
        />
      </Container>
    );
  }

  // Render lesson view (intro, learning, exercises)
  return (
    <Container variant="centered" className={styles.lessonFlowContainer}>
      <Navigation />
      <Animated animation="fadeInUp" className={styles.lessonFlowContent}>
        <LessonView
          lesson={lesson}
          lessonInfo={lessonInfo}
          phase={phase}
          onStart={handleStartLesson}
          onCompleteLearning={handleCompleteLearning}
          onCompleteExercises={handleCompleteExercises}
          onBack={handleBackToPath}
        />
      </Animated>
    </Container>
  );
}
