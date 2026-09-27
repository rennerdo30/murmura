'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Container, Button, Animated, Spinner } from '@/components/ui';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useGamification } from '@/hooks/useGamification';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { loadLearningPathsData, LearningPathsData } from '@/lib/dataLoader';
import { calculateLessonXP } from '@/lib/xp';
import LessonView from '@/components/lesson/LessonView';
import LessonSummary from '@/components/lesson/LessonSummary';
import { IoArrowBack, IoWarning, IoLockClosed } from 'react-icons/io5';
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
  const { targetLanguage } = useTargetLanguage();
  const { getText } = useContentTranslation();

  const [phase, setPhase] = useState<LessonPhase>('loading');
  const [pathsData, setPathsData] = useState<LearningPathsData | null>(null);
  const [lessonResult, setLessonResult] = useState<LessonResult | null>(null);

  // Load path data for the page header
  useEffect(() => {
    if (targetLanguage) {
      loadLearningPathsData(targetLanguage).then(data => setPathsData(data));
    }
  }, [targetLanguage]);

  // Get translated path name for the page header
  const pathName = useMemo(() => {
    const pathData = pathsData?.paths[pathId];
    if (pathData) {
      return getText(pathData.nameTranslations, pathData.name);
    }
    // Fallback: format the raw pathId
    return pathId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }, [pathsData, pathId, getText]);

  // Get lesson data
  const lesson = useMemo(() => getLesson(lessonId), [getLesson, lessonId]);
  const lessonInfo = useMemo(() => getLessonInfo(lessonId), [getLessonInfo, lessonId]);
  const nextLesson = useMemo(() => getNextLessonAfter(lessonId), [getNextLessonAfter, lessonId]);
  const lessonStatus = useMemo(() => getLessonStatus(lessonId), [getLessonStatus, lessonId]);

  // Legacy milestones are links into study modules rather than full lessons.
  useEffect(() => {
    const moduleRoute = lesson?.legacyModule;
    if (moduleRoute && ['alphabet', 'vocabulary', 'grammar', 'kanji', 'reading', 'listening'].includes(moduleRoute)) {
      router.replace(`/${moduleRoute}/`);
    }
  }, [lesson, router]);

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

  const backHref = `/paths/${pathId}`;
  const backLabel = t('lessons.backToPath');

  // Render loading state
  if (phase === 'loading') {
    return (
      <Container variant="dashboard">
        <div className={styles.column}>
          <PageHeader title={pathName} backHref={backHref} backLabel={backLabel} />
          <div className={styles.stateCard} role="status" aria-live="polite">
            <Spinner size="lg" />
            <p className={styles.stateText}>{t('lessons.loading')}</p>
          </div>
        </div>
      </Container>
    );
  }

  // Render error state
  if (phase === 'error' || !lesson) {
    return (
      <Container variant="dashboard">
        <div className={styles.column}>
          <PageHeader title={pathName} backHref={backHref} backLabel={backLabel} />
          <div className={styles.stateCard} role="alert">
            <IoWarning className={`${styles.stateIcon} ${styles.errorIcon}`} aria-hidden="true" />
            <h2 className={styles.stateTitle}>{t('lessons.notFound')}</h2>
            <p className={styles.stateText}>
              {curriculumError || t('lessons.notFoundDescription', { lessonId })}
            </p>
            <Button variant="ghost" onClick={handleBackToPath}>
              <IoArrowBack aria-hidden="true" /> {backLabel}
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  const lessonTitle = getText(lesson.titleTranslations, lesson.title) || lessonId;

  // Render locked state
  if (lessonStatus === 'locked') {
    return (
      <Container variant="dashboard">
        <div className={styles.column}>
          <PageHeader title={lessonTitle} subtitle={pathName} backHref={backHref} backLabel={backLabel} />
          <div className={styles.stateCard}>
            <IoLockClosed className={styles.stateIcon} aria-hidden="true" />
            <h2 className={styles.stateTitle}>{t('lessons.locked')}</h2>
            <p className={styles.stateText}>{t('lessons.lockedDescription')}</p>
            <Button variant="ghost" onClick={handleBackToPath}>
              <IoArrowBack aria-hidden="true" /> {backLabel}
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  // Render summary phase
  if (phase === 'summary' && lessonResult) {
    return (
      <Container variant="dashboard">
        <div className={styles.column}>
          <PageHeader title={lessonTitle} subtitle={pathName} backHref={backHref} backLabel={backLabel} />
          <LessonSummary
            lesson={lesson}
            result={lessonResult}
            nextLesson={nextLesson}
            onNextLesson={handleNextLesson}
            onBackToPath={handleBackToPath}
          />
        </div>
      </Container>
    );
  }

  // Render lesson view (intro, learning, exercises)
  return (
    <Container variant="dashboard">
      <div className={styles.column}>
        <PageHeader title={lessonTitle} subtitle={pathName} backHref={backHref} backLabel={backLabel} />
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
      </div>
    </Container>
  );
}
