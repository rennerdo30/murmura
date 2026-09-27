'use client';

import { useState, useCallback, useMemo } from 'react';
import { IoClose, IoCheckmarkCircle, IoCloseCircle, IoArrowForward } from 'react-icons/io5';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { Button } from '@/components/ui';
import type { LanguageLevel } from '@/lib/language';
import styles from './PlacementTest.module.css';
import type { Assessment, AssessmentResult, AssessmentSection } from '@/types/assessment';

interface PlacementTestProps {
  assessment: Assessment;
  onComplete: (result: AssessmentResult) => void;
  onCancel: () => void;
}

interface QuestionAnswer {
  sectionIndex: number;
  questionIndex: number;
  answer: number | string;
  correct: boolean;
}

const FULL_PERCENT = 100;
const OPTION_LETTER_OFFSET = 65; // 'A'
const SKILL_KEY_PREFIX = 'assessment.placement.skills.';

/**
 * Score bands used when the assessment has no scoring rubric: the n-th band maps
 * to the n-th level of the target language (lowest first).
 */
const FALLBACK_BAND_THRESHOLDS = [0, 60, 75, 90];

function pickLevel(
  percentScore: number,
  assessment: Assessment,
  levels: LanguageLevel[]
): { level: string; path: string } {
  const rubric = assessment.scoringRubric;
  const thresholds = rubric?.levelThresholds ? Object.entries(rubric.levelThresholds) : [];

  if (thresholds.length > 0) {
    // Highest level whose threshold the score reaches; fall back to the lowest threshold
    const sorted = [...thresholds].sort((a, b) => a[1] - b[1]);
    const reached = sorted.filter(([, threshold]) => percentScore >= threshold);
    const [level] = reached.length > 0 ? reached[reached.length - 1] : sorted[0];
    return { level, path: rubric.recommendations?.[level] ?? level };
  }

  const ordered = [...levels].sort((a, b) => a.order - b.order);
  let bandIndex = 0;
  FALLBACK_BAND_THRESHOLDS.forEach((threshold, index) => {
    if (percentScore >= threshold) bandIndex = index;
  });
  const level = ordered[Math.min(bandIndex, ordered.length - 1)];
  const levelId = level?.id ?? assessment.targetLevel ?? '';
  return { level: levelId, path: levelId };
}

export default function PlacementTest({ assessment, onComplete, onCancel }: PlacementTestProps) {
  const { t } = useLanguage();
  const { levels } = useTargetLanguage();

  const sections = useMemo(
    () => assessment.sections.filter(section => section.questions.length > 0),
    [assessment]
  );

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const currentSection = sections[currentSectionIndex];
  const currentQuestion = currentSection?.questions[currentQuestionIndex];
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  const getSectionName = useCallback((section: AssessmentSection) => {
    const key = `${SKILL_KEY_PREFIX}${section.skill}`;
    const translated = t(key);
    return translated === key ? section.name : translated;
  }, [t]);

  const questionNumber = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentSectionIndex; i++) {
      count += sections[i].questions.length;
    }
    return count + currentQuestionIndex + 1;
  }, [currentSectionIndex, currentQuestionIndex, sections]);

  const progress = totalQuestions > 0 ? (questionNumber / totalQuestions) * FULL_PERCENT : 0;
  const isLastQuestion =
    currentSectionIndex === sections.length - 1 &&
    currentSection !== undefined &&
    currentQuestionIndex === currentSection.questions.length - 1;

  const handleSelectAnswer = useCallback((index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
  }, [showFeedback]);

  const handleSubmitAnswer = useCallback(() => {
    if (selectedAnswer === null || !currentQuestion) return;

    const isCorrect = selectedAnswer === currentQuestion.questionData.correctIndex;

    setAnswers(prev => [
      ...prev,
      {
        sectionIndex: currentSectionIndex,
        questionIndex: currentQuestionIndex,
        answer: selectedAnswer,
        correct: isCorrect,
      },
    ]);

    setShowFeedback(true);
  }, [selectedAnswer, currentQuestion, currentSectionIndex, currentQuestionIndex]);

  const finishTest = useCallback(() => {
    // `answers` already contains the last answer (added when it was checked)
    const sectionScores: AssessmentResult['sectionScores'] = {};
    let totalScore = 0;
    let totalPossible = 0;

    sections.forEach((section, sIdx) => {
      const correct = answers.filter(a => a.sectionIndex === sIdx && a.correct).length;
      const total = section.questions.length;
      sectionScores[section.skill] = {
        score: correct,
        maxScore: total,
        percent: total > 0 ? Math.round((correct / total) * FULL_PERCENT) : 0,
      };
      totalScore += correct * section.weight;
      totalPossible += total * section.weight;
    });

    const percentScore = totalPossible > 0 ? Math.round((totalScore / totalPossible) * FULL_PERCENT) : 0;
    const { level, path } = pickLevel(percentScore, assessment, levels);

    onComplete({
      assessmentId: assessment.id,
      totalScore,
      maxScore: totalPossible,
      percentScore,
      sectionScores,
      recommendedLevel: level,
      recommendedPath: path,
      answeredQuestions: answers.map(a => ({
        questionId: `${a.sectionIndex}-${a.questionIndex}`,
        correct: a.correct,
        userAnswer: a.answer,
      })),
      completedAt: new Date().toISOString(),
    });
  }, [sections, answers, assessment, levels, onComplete]);

  const handleNext = useCallback(() => {
    setShowFeedback(false);
    setSelectedAnswer(null);

    if (currentQuestionIndex < currentSection.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
    } else {
      finishTest();
    }
  }, [currentQuestionIndex, currentSection, currentSectionIndex, sections.length, finishTest]);

  if (!currentQuestion) {
    return (
      <div className={styles.container}>
        <p className={styles.noQuestions}>{t('assessment.placement.noQuestions')}</p>
        <Button variant="secondary" onClick={onCancel}>{t('assessment.placement.goBack')}</Button>
      </div>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.questionData.correctIndex;
  const difficultyKey = `placement.difficulty.${currentQuestion.difficulty}`;
  const difficultyLabel = t(difficultyKey);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          aria-label={t('placement.leaveTest')}
        >
          <IoClose aria-hidden="true" />
        </button>
        <div className={styles.progressInfo}>
          <span className={styles.sectionName}>{getSectionName(currentSection)}</span>
          <span className={styles.questionCount}>
            {t('assessment.placement.questionProgress', { current: questionNumber, total: totalQuestions })}
          </span>
        </div>
      </div>

      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={FULL_PERCENT}
        aria-label={t('assessment.placement.questionProgress', { current: questionNumber, total: totalQuestions })}
      >
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <ol className={styles.sectionIndicators} aria-label={t('placement.sectionsLabel')}>
        {sections.map((section, idx) => (
          <li
            key={`${section.skill}-${idx}`}
            className={`${styles.sectionPill} ${idx < currentSectionIndex ? styles.completed : ''} ${idx === currentSectionIndex ? styles.active : ''}`}
            aria-current={idx === currentSectionIndex ? 'step' : undefined}
          >
            {idx < currentSectionIndex && <IoCheckmarkCircle aria-hidden="true" />}
            {getSectionName(section)}
          </li>
        ))}
      </ol>

      <section className={styles.questionCard} aria-labelledby="placement-question">
        <span className={styles.difficultyBadge} data-difficulty={currentQuestion.difficulty}>
          {difficultyLabel === difficultyKey ? currentQuestion.difficulty : difficultyLabel}
        </span>

        <h2 id="placement-question" className={styles.question}>{currentQuestion.questionData.question}</h2>

        <div className={styles.options} role="radiogroup" aria-labelledby="placement-question">
          {currentQuestion.questionData.options?.map((option: string, idx: number) => {
            const isSelected = selectedAnswer === idx;
            const isAnswer = showFeedback && idx === currentQuestion.questionData.correctIndex;
            const isWrongPick = showFeedback && isSelected && !isCorrect;
            return (
              <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`${styles.option} ${isSelected ? styles.selected : ''} ${isAnswer ? styles.correct : ''} ${isWrongPick ? styles.incorrect : ''}`}
                onClick={() => handleSelectAnswer(idx)}
                disabled={showFeedback}
              >
                <span className={styles.optionLetter} aria-hidden="true">
                  {String.fromCharCode(OPTION_LETTER_OFFSET + idx)}
                </span>
                <span className={styles.optionText}>{option}</span>
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div
            className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}
            role="status"
          >
            {isCorrect
              ? <IoCheckmarkCircle className={styles.feedbackIcon} aria-hidden="true" />
              : <IoCloseCircle className={styles.feedbackIcon} aria-hidden="true" />}
            <span>{isCorrect ? t('assessment.placement.correct') : t('assessment.placement.incorrect')}</span>
          </div>
        )}
      </section>

      <div className={styles.actions}>
        {!showFeedback ? (
          <Button onClick={handleSubmitAnswer} disabled={selectedAnswer === null} size="lg" fullWidth>
            {t('assessment.placement.checkAnswer')}
          </Button>
        ) : (
          <Button onClick={handleNext} size="lg" fullWidth>
            {isLastQuestion ? t('assessment.placement.seeResults') : t('assessment.placement.nextQuestion')}
            <IoArrowForward aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
