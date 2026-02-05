'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, Text, Button } from '@/components/ui';
import LessonIntro from './LessonIntro';
import LessonCard from './LessonCard';
import LessonProgressBar, { PhaseStep } from './LessonProgress';
import { FillBlank, Shadowing, MinimalPair, ListenRepeat } from '@/components/exercises';
import { useTTS } from '@/hooks/useTTS';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { getVocabularyData, getGrammarData } from '@/lib/dataLoader';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import type { CurriculumLesson, LessonContext, LessonVocabItem, LessonGrammarItem } from '@/types/curriculum';
import type { FillBlankExercise } from '@/types/exercises';
import type { PronunciationDrill, ShadowingContent, MinimalPairContent, ListenRepeatContent } from '@/types/pronunciation';
import { IoArrowBack, IoArrowForward, IoCheckmark, IoMic } from 'react-icons/io5';
import styles from './LessonView.module.css';

type LessonPhase = 'intro' | 'learning' | 'pronunciation' | 'exercises';

import { useLanguage } from '@/context/LanguageProvider';

interface LessonViewProps {
  lesson: CurriculumLesson;
  lessonInfo: LessonContext | null;
  phase: string;
  onStart: () => void;
  onCompleteLearning: () => void;
  onCompletePronunciation?: () => void;
  onCompleteExercises: (correct: number, total: number) => void;
  onBack: () => void;
}

interface LearningCard {
  type: 'topic' | 'vocabulary' | 'grammar' | 'cultural' | 'example';
  titleKey: string;
  content: string;
  meaning?: string;
  audioUrl?: string;
  usageNote?: string;
  formation?: string;
  reading?: string;
  translation?: string;
  partOfSpeech?: string;
  level?: string;
}

export default function LessonView({
  lesson,
  lessonInfo,
  phase,
  onStart,
  onCompleteLearning,
  onCompletePronunciation,
  onCompleteExercises,
  onBack,
}: LessonViewProps) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [exerciseAnswers, setExerciseAnswers] = useState<boolean[]>([]);
  const [currentPronunciationIndex, setCurrentPronunciationIndex] = useState(0);
  const { preloadBatch } = useTTS();
  const { targetLanguage } = useTargetLanguage();
  const { t } = useLanguage();
  const { getMeaning, getText } = useContentTranslation();

  // Get vocabulary data to find audio URLs and meanings
  const vocabularyData = getVocabularyData(targetLanguage);
  // Get grammar data to find explanations/meanings
  const grammarData = getGrammarData(targetLanguage);

  // Helper to get translated meaning from vocabulary item (checks content_translations)
  const getVocabMeaning = (item: typeof vocabularyData[0] | undefined): string | undefined => {
    if (!item) return undefined;
    const translatedMeanings = (item.content_translations as { meaning?: Record<string, string> })?.meaning;
    if (translatedMeanings) {
      return getMeaning(translatedMeanings, item.meaning);
    }
    return item.meaning;
  };

  // Helper to get translated explanation from grammar item (checks explanations field)
  const getGrammarExplanation = (item: typeof grammarData[0] | undefined): string | undefined => {
    if (!item) return undefined;
    if (item.explanations) {
      return getText(item.explanations as Record<string, string>, item.explanation);
    }
    return item.explanation;
  };

  // Generate learning cards from lesson content
  const learningCards: LearningCard[] = [
    // Topics
    ...lesson.content.topics.map((topic) => ({
      type: 'topic' as const,
      titleKey: 'lessons.card.topic',
      content: topic,
    })),
    // Vocabulary focus - handle both string[] and object[] formats
    ...lesson.content.vocab_focus.map((vocab) => {
      // Check if vocab is an object with meaning (new format) or string (legacy)
      const isObject = typeof vocab === 'object' && vocab !== null;
      const vocabItem = isObject ? vocab as LessonVocabItem : null;
      const word = vocabItem ? vocabItem.word : (vocab as string);
      const meaning = vocabItem?.meaning;
      const usageNote = vocabItem?.usageNote;

      // Find vocabulary item in data (for audio URL and translated meanings)
      const item = vocabularyData.find(
        v => v.word?.toLowerCase() === word.toLowerCase() ||
          v.reading?.toLowerCase() === word.toLowerCase()
      );

      // Prefer translated meaning from vocabulary data, fallback to lesson's English meaning
      const displayMeaning = getVocabMeaning(item) || meaning;

      return {
        type: 'vocabulary' as const,
        titleKey: 'lessons.card.vocabulary',
        content: word,
        meaning: displayMeaning,
        audioUrl: item?.audioUrl,
        usageNote,
        partOfSpeech: vocabItem?.partOfSpeech ?? item?.part_of_speech,
        level: vocabItem?.level ?? item?.level,
      };
    }),
    // Grammar focus - handle both string[] and object[] formats
    ...(lesson.content.grammar_focus || []).map((grammar) => {
      // Check if grammar is an object with meaning (new format) or string (legacy)
      const isObject = typeof grammar === 'object' && grammar !== null;
      const grammarObj = isObject ? grammar as LessonGrammarItem : null;
      const pattern = grammarObj ? grammarObj.pattern : (grammar as string);
      const meaning = grammarObj?.meaning;
      const formation = grammarObj?.formation;
      const usageNotes = grammarObj?.usageNotes;

      // Look up grammar in grammarData for translated explanations
      const grammarItem = grammarData.find(
        g => g.title?.toLowerCase() === pattern.toLowerCase() ||
          g.patterns?.some(p => p.toLowerCase() === pattern.toLowerCase())
      );

      // Prefer translated explanation from grammar data, fallback to lesson's English meaning
      const displayMeaning = getGrammarExplanation(grammarItem) || meaning;

      return {
        type: 'grammar' as const,
        titleKey: 'lessons.card.grammar',
        content: pattern,
        meaning: displayMeaning,
        formation,
        usageNote: usageNotes,
        level: grammarObj?.level ?? grammarItem?.level,
      };
    }),
    // Cultural notes
    ...(lesson.content.cultural_notes || []).map((note) => ({
      type: 'cultural' as const,
      titleKey: 'lessons.card.cultural',
      content: note,
    })),
    // Example sentences
    ...(lesson.content.exampleSentences || []).map((example) => ({
      type: 'example' as const,
      titleKey: 'lessons.card.example',
      content: example.target,
      reading: example.reading,
      translation: example.translation,
    })),
  ];


  // Compute phase steps for progress indicator
  const hasPronunciation = !!((lesson as unknown as { pronunciationDrills?: unknown[] }).pronunciationDrills?.length);
  const phaseSteps: PhaseStep[] = useMemo(() => {
    const getStatus = (stepPhase: string): 'completed' | 'current' | 'upcoming' => {
      const order = ['learning', 'pronunciation', 'exercises'];
      const currentIdx = order.indexOf(phase);
      const stepIdx = order.indexOf(stepPhase);
      if (stepIdx < currentIdx) return 'completed';
      if (stepIdx === currentIdx) return 'current';
      return 'upcoming';
    };

    const steps: PhaseStep[] = [
      { id: 'learning', label: t('lessons.view.learning'), status: getStatus('learning') },
    ];
    if (hasPronunciation) {
      steps.push({ id: 'pronunciation', label: t('lessons.view.pronunciation'), status: getStatus('pronunciation') });
    }
    steps.push({ id: 'exercises', label: t('lessons.view.practice'), status: getStatus('exercises') });
    return steps;
  }, [phase, hasPronunciation, t]);

  // Preload audio for vocabulary items in this lesson (non-blocking)
  // Runs after initial render to avoid blocking
  useEffect(() => {
    // Skip if no vocab focus or preloadBatch not available
    if (!lesson.content.vocab_focus || lesson.content.vocab_focus.length === 0) {
      return;
    }

    // Use requestIdleCallback if available, otherwise setTimeout
    const schedulePreload = () => {
      const vocabularyData = getVocabularyData(targetLanguage);
      if (vocabularyData.length === 0) {
        // Data not loaded yet, retry after a delay
        return;
      }

      // Match vocabulary to items and get their audio URLs
      // Handle both string[] and object[] formats
      const vocabWords = lesson.content.vocab_focus.map(vocab =>
        typeof vocab === 'object' && vocab !== null ? vocab.word : vocab
      );

      const audioUrls = vocabWords
        .map(vocabWord => {
          const item = vocabularyData.find(
            v => v.word?.toLowerCase() === vocabWord.toLowerCase() ||
              v.reading?.toLowerCase() === vocabWord.toLowerCase()
          );
          return item?.audioUrl;
        })
        .filter((url): url is string => !!url);

      if (audioUrls.length > 0 || vocabWords.length > 0) {
        preloadBatch(audioUrls, vocabWords, targetLanguage);
      }
    };

    // Delay preloading significantly to not interfere with page load
    const timeoutId = setTimeout(schedulePreload, 500);

    return () => clearTimeout(timeoutId);
  }, [lesson.content.vocab_focus, targetLanguage, preloadBatch]);

  const totalLearningCards = learningCards.length;
  const totalExerciseCards = lesson.exercises?.length || 0;

  const handleNextCard = useCallback(() => {
    if (phase === 'learning') {
      if (currentCardIndex < totalLearningCards - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
      } else {
        setCurrentCardIndex(0);
        onCompleteLearning();
      }
    } else if (phase === 'exercises') {
      if (currentCardIndex < totalExerciseCards - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
      } else {
        const correctCount = exerciseAnswers.filter(Boolean).length;
        onCompleteExercises(correctCount, totalExerciseCards);
      }
    }
  }, [
    phase,
    currentCardIndex,
    totalLearningCards,
    totalExerciseCards,
    exerciseAnswers,
    onCompleteLearning,
    onCompleteExercises,
  ]);

  const handlePrevCard = useCallback(() => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  }, [currentCardIndex]);

  const handleAnswerExercise = useCallback(
    (isCorrect: boolean) => {
      setExerciseAnswers([...exerciseAnswers, isCorrect]);
      handleNextCard();
    },
    [exerciseAnswers, handleNextCard]
  );

  // Render intro phase
  if (phase === 'intro') {
    return (
      <LessonIntro
        lesson={lesson}
        lessonInfo={lessonInfo}
        onStart={onStart}
        onBack={onBack}
      />
    );
  }

  // Render learning phase
  if (phase === 'learning') {
    const currentCard = learningCards[currentCardIndex];

    return (
      <div className={styles.lessonContainer}>
        <LessonProgressBar
          current={currentCardIndex + 1}
          total={totalLearningCards}
          phase="learning"
          phases={phaseSteps}
        />

        <Card variant="glass" className={styles.cardContainer}>
          {currentCard ? (
            <LessonCard
              type={currentCard.type}
              title={t(currentCard.titleKey)}
              content={currentCard.content}
              meaning={currentCard.meaning}
              audioUrl={currentCard.audioUrl}
              usageNote={currentCard.usageNote}
              formation={currentCard.formation}
              reading={currentCard.reading}
              translation={currentCard.translation}
              partOfSpeech={currentCard.partOfSpeech}
              level={currentCard.level}
            />
          ) : (
            <Text color="muted">{t('lessons.view.noContent')}</Text>
          )}
        </Card>

        <div className={styles.navigation}>
          <Button
            variant="ghost"
            onClick={handlePrevCard}
            disabled={currentCardIndex === 0}
          >
            <IoArrowBack /> {t('lessons.view.previous')}
          </Button>

          <Text variant="caption" color="muted">
            {currentCardIndex + 1} / {totalLearningCards}
          </Text>

          <Button onClick={handleNextCard}>
            {currentCardIndex === totalLearningCards - 1 ? (
              <>
                {t('lessons.view.startExercises')} <IoCheckmark />
              </>
            ) : (
              <>
                {t('lessons.view.next')} <IoArrowForward />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Render pronunciation phase
  if (phase === 'pronunciation') {
    // Get pronunciation drills from lesson content (if available)
    const pronunciationDrills: PronunciationDrill[] = (lesson as unknown as { pronunciationDrills?: PronunciationDrill[] }).pronunciationDrills || [];
    const currentDrill = pronunciationDrills[currentPronunciationIndex];

    const handlePronunciationComplete = () => {
      if (currentPronunciationIndex < pronunciationDrills.length - 1) {
        setCurrentPronunciationIndex(currentPronunciationIndex + 1);
      } else {
        setCurrentPronunciationIndex(0);
        onCompletePronunciation?.();
      }
    };

    const handleSkipPronunciation = () => {
      onCompletePronunciation?.();
    };

    if (!currentDrill || pronunciationDrills.length === 0) {
      // No pronunciation drills, skip to exercises
      return (
        <div className={styles.lessonContainer}>
          <Card variant="glass" className={styles.cardContainer}>
            <div className={styles.noPronunciationSection}>
              <IoMic size={48} className={styles.pronunciationIcon} />
              <Text variant="h3">{t('lessons.pronunciation.noDrills')}</Text>
              <Text color="muted">{t('lessons.pronunciation.noDrillsDesc')}</Text>
              <Button onClick={handleSkipPronunciation}>
                {t('lessons.pronunciation.continueToExercises')} <IoArrowForward />
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    // Render pronunciation drill based on type
    const renderPronunciationDrill = () => {
      switch (currentDrill.type) {
        case 'shadowing':
          const shadowingContent = currentDrill.content as ShadowingContent;
          return (
            <Shadowing
              content={shadowingContent}
              onComplete={handlePronunciationComplete}
            />
          );
        case 'minimal_pair':
          const minimalPairContent = currentDrill.content as MinimalPairContent;
          return (
            <MinimalPair
              pairs={minimalPairContent.pairs}
              onComplete={handlePronunciationComplete}
            />
          );
        case 'listen_repeat':
          const listenRepeatContent = currentDrill.content as ListenRepeatContent;
          return (
            <ListenRepeat
              phrases={listenRepeatContent.phrases}
              repeatCount={listenRepeatContent.repeatCount}
              onComplete={handlePronunciationComplete}
            />
          );
        default:
          return (
            <Text color="muted">
              {t('lessons.pronunciation.unknownDrillType')}
            </Text>
          );
      }
    };

    return (
      <div className={styles.lessonContainer}>
        <LessonProgressBar
          current={currentPronunciationIndex + 1}
          total={pronunciationDrills.length}
          phase="pronunciation"
          phases={phaseSteps}
        />

        <Card variant="glass" className={styles.cardContainer}>
          <div className={styles.pronunciationHeader}>
            <IoMic className={styles.pronunciationIcon} />
            <Text variant="h3">{currentDrill.title}</Text>
            {currentDrill.description && (
              <Text variant="body" color="muted">{currentDrill.description}</Text>
            )}
          </div>
          {renderPronunciationDrill()}
        </Card>

        <div className={styles.navigation}>
          <Button
            variant="ghost"
            onClick={handleSkipPronunciation}
          >
            {t('lessons.pronunciation.skip')}
          </Button>

          <Text variant="caption" color="muted">
            {currentPronunciationIndex + 1} / {pronunciationDrills.length}
          </Text>
        </div>
      </div>
    );
  }

  // Render exercises phase
  if (phase === 'exercises') {
    const currentExercise = lesson.exercises?.[currentCardIndex];

    if (!currentExercise) {
      return (
        <div className={styles.lessonContainer}>
          <Card variant="glass" className={styles.cardContainer}>
            <Text>{t('lessons.view.noExercises')}</Text>
            <Button onClick={() => onCompleteExercises(0, 0)}>
              {t('lessons.view.completeLesson')}
            </Button>
          </Card>
        </div>
      );
    }

    // Render based on exercise type
    const renderExercise = () => {
      const exerciseType = currentExercise.type || 'multiple_choice';

      switch (exerciseType) {
        case 'fill_blank':
          return (
            <FillBlank
              exercise={currentExercise as FillBlankExercise}
              onAnswer={handleAnswerExercise}
            />
          );

        case 'multiple_choice':
        default:
          // Handle multiple choice exercises (default)
          const mcExercise = currentExercise as {
            question: string;
            options: string[];
            correctIndex: number;
          };
          return (
            <div className={styles.exerciseCard}>
              <Text variant="h3" className={styles.question}>
                {mcExercise.question || t('lessons.exercise.completeExercise')}
              </Text>

              <div className={styles.options}>
                {(mcExercise.options || []).map((option, index) => (
                  <Button
                    key={index}
                    variant="secondary"
                    className={styles.optionButton}
                    onClick={() =>
                      handleAnswerExercise(index === mcExercise.correctIndex)
                    }
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          );
      }
    };

    return (
      <div className={styles.lessonContainer}>
        <LessonProgressBar
          current={currentCardIndex + 1}
          total={totalExerciseCards}
          phase="exercises"
          phases={phaseSteps}
        />

        <Card variant="glass" className={styles.cardContainer}>
          {renderExercise()}
        </Card>

        <div className={styles.navigation}>
          <Text variant="caption" color="muted">
            {t('lessons.view.exerciseStep', { current: currentCardIndex + 1, total: totalExerciseCards })}
          </Text>
        </div>
      </div>
    );
  }

  return null;
}
