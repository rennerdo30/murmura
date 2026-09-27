'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { IconType } from 'react-icons';
import PageHeader from '@/components/common/PageHeader';
import { Container, Button } from '@/components/ui';
import ReviewCard from '@/components/review/ReviewCard';
import ReviewProgress from '@/components/review/ReviewProgress';
import ReviewStats from '@/components/review/ReviewStats';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useTTS } from '@/hooks/useTTS';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { useLearnedContent, type LearnedContentItem } from '@/hooks/useLearnedContent';
import { getVocabularyData } from '@/lib/dataLoader';
import {
  ReviewQueue,
  ReviewItem,
  ReviewSessionState,
  getReviewQueue,
  startReviewSession,
  submitReviewAnswer,
  calculateSessionStats,
  DEFAULT_SRS_SETTINGS,
  ReviewModuleName,
} from '@/lib/reviewQueue';
import { IoBook, IoSchool, IoDocumentText, IoReader, IoHeadset, IoCheckmarkCircle, IoEllipseOutline, IoTime } from 'react-icons/io5';
import styles from './review.module.css';

type ReviewMode = 'overview' | 'session' | 'complete';

/** Modules that can be toggled in the review overview, in display order. */
const REVIEW_MODULES: { id: ReviewModuleName; icon: IconType }[] = [
  { id: 'vocabulary', icon: IoBook },
  { id: 'kanji', icon: IoSchool },
  { id: 'grammar', icon: IoDocumentText },
  { id: 'reading', icon: IoReader },
  { id: 'listening', icon: IoHeadset },
];

interface ItemDataMap {
  vocabulary: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
  kanji: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
  grammar: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
  reading: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
  listening: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
}

// Interface for kanji/hanzi data from JSON
interface KanjiData {
  id: string | number;
  kanji?: string;
  hanzi?: string;
  char?: string;
  character?: string;
  meaning: string;
  onyomi?: string[];
  kunyomi?: string[];
  pinyin?: string;
  romanization?: string;
  audioUrl?: string;
  audio_url?: string;
  content_translations?: { meaning?: Record<string, string> } | null;
}

// Interface for grammar data from JSON
interface GrammarData {
  id: string;
  title: string;
  explanation?: string;
  explanations?: Record<string, string>;
  content_translations?: { explanation?: Record<string, string> } | null;
}

function includeLearnedDueItems(queue: ReviewQueue, learned: LearnedContentItem[]): ReviewQueue {
  const now = Date.now();
  const existingIds = new Set(queue.items.map(item => item.id));
  const items = [...queue.items];
  const byModule = { ...queue.byModule };

  for (const item of learned) {
    if (item.nextReviewAt > now || existingIds.has(item.contentId)) continue;
    const module: ReviewModuleName = item.contentType === 'character' ? 'kanji' : item.contentType;
    items.push({
      id: item.contentId,
      module,
      source: 'learnedContent',
      reviewData: null,
      priority: 1,
      dueDate: item.nextReviewAt,
      masteryStatus: 'learning',
      data: item.preview,
    });
    byModule[module] += 1;
    existingIds.add(item.contentId);
  }

  return {
    ...queue,
    items,
    total: items.length,
    byModule,
    estimatedMinutes: Math.ceil(items.length * 8 / 60),
    urgency: items.some(item => item.dueDate && item.dueDate < now - 86400000)
      ? 'overdue'
      : items.length > 0 ? 'due' : 'none',
  };
}

export default function ReviewPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { targetLanguage, getDataUrl } = useTargetLanguage();
  const { speak } = useTTS();
  const { getMeaning, getText } = useContentTranslation();
  const { getModuleData, updateModuleReview } = useProgressContext();
  const { allLearned, recordReview } = useLearnedContent();

  const [mode, setMode] = useState<ReviewMode>('overview');
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [session, setSession] = useState<ReviewSessionState | null>(null);
  const [selectedModules, setSelectedModules] = useState<ReviewModuleName[]>(['vocabulary', 'kanji', 'grammar', 'reading', 'listening']);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number>(0);
  const [kanjiData, setKanjiData] = useState<KanjiData[]>([]);
  const [grammarData, setGrammarData] = useState<GrammarData[]>([]);
  const [readingData, setReadingData] = useState<Array<{ id: string | number; title: string; titleTranslations?: Record<string, string>; text: string; translation?: string; audioUrl?: string; audio_url?: string }>>([]);
  const [listeningData, setListeningData] = useState<Array<{ id: string | number; title: string; text: string; transcript?: string; translation?: string; audioUrl?: string; audio_url?: string }>>([]);

  // Load kanji/hanzi and grammar data when language changes
  useEffect(() => {
    const abortController = new AbortController();

    const loadData = async () => {
      try {
        const [characterResponse, grammarResponse, readingResponse, listeningResponse] = await Promise.all([
          fetch(getDataUrl('characters.json'), { signal: abortController.signal }).catch(() => null),
          fetch(getDataUrl('grammar.json'), { signal: abortController.signal }).catch(() => null),
          fetch(getDataUrl('readings.json'), { signal: abortController.signal }).catch(() => null),
          fetch(getDataUrl('listening.json'), { signal: abortController.signal }).catch(() => null),
        ]);

        if (!abortController.signal.aborted) {
          if (characterResponse?.ok) {
            const data = await characterResponse.json();
            const items = Array.isArray(data)
              ? data
              : Array.isArray(data.characters)
                ? data.characters
                : [];
            setKanjiData(items);
          } else {
            // Fallback to legacy file names during transition
            const fallbackFileName = targetLanguage === 'zh' ? 'hanzi.json' : 'kanji.json';
            const fallbackResponse = await fetch(getDataUrl(fallbackFileName), { signal: abortController.signal }).catch(() => null);
            if (fallbackResponse?.ok) {
              const fallbackData = await fallbackResponse.json();
              setKanjiData(Array.isArray(fallbackData) ? fallbackData : []);
            } else {
              setKanjiData([]);
            }
          }

          if (grammarResponse?.ok) {
            const data = await grammarResponse.json();
            setGrammarData(Array.isArray(data) ? data : []);
          } else {
            setGrammarData([]);
          }

          if (readingResponse?.ok) {
            const data = await readingResponse.json();
            setReadingData(Array.isArray(data) ? data : []);
          } else {
            setReadingData([]);
          }

          if (listeningResponse?.ok) {
            const data = await listeningResponse.json();
            setListeningData(Array.isArray(data) ? data : []);
          } else {
            setListeningData([]);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to load review data:', error);
      }
    };

    loadData();
    return () => abortController.abort();
  }, [targetLanguage, getDataUrl]);

  // Build item data maps for display (now uses dynamic data)
  const itemDataMap = useMemo<ItemDataMap>(() => {
    // Vocabulary from centralized dataLoader
    const vocabMap: ItemDataMap['vocabulary'] = {};
    const vocabulary = getVocabularyData(targetLanguage);
    vocabulary.forEach((item) => {
      // Use content_translations for localized meanings
      const translatedMeaning = (item as { content_translations?: { meaning?: Record<string, string> } | null }).content_translations?.meaning;
      const back = translatedMeaning
        ? getMeaning(translatedMeaning, item.meaning)
        : getMeaning(item.meanings, item.meaning);

      vocabMap[item.id] = {
        front: item.word,
        back,
        reading: item.reading,
        audioUrl: item.audioUrl,
      };
    });

    // Kanji/Hanzi from fetched data
    const kanjiMap: ItemDataMap['kanji'] = {};
    kanjiData.forEach((item) => {
      const character = item.kanji || item.hanzi || '';
      const reading = item.pinyin
        ? item.pinyin
        : item.romanization
          ? item.romanization
        : [...(item.onyomi || []), ...(item.kunyomi || [])].join(', ');
      const normalizedCharacter = character || item.char || item.character || '';

      // Use content_translations for localized meanings
      const back = item.content_translations?.meaning
        ? getText(item.content_translations.meaning, item.meaning)
        : item.meaning;

      kanjiMap[String(item.id)] = {
        front: normalizedCharacter,
        back,
        reading,
        audioUrl: item.audioUrl || item.audio_url,
      };
    });

    // Grammar from fetched data
    const grammarMap: ItemDataMap['grammar'] = {};
    grammarData.forEach((item) => {
      // Use content_translations for localized explanations, then explanations field
      const back = item.content_translations?.explanation
        ? getText(item.content_translations.explanation, item.explanation || '')
        : getText(item.explanations, item.explanation || '');

      grammarMap[item.id] = {
        front: item.title,
        back,
      };
    });

    // Reading from fetched data
    const readingMap: ItemDataMap['reading'] = {};
    readingData.forEach((item) => {
      const title = item.titleTranslations
        ? getText(item.titleTranslations, item.title)
        : item.title;
      const back = item.translation || item.text.substring(0, 100) + (item.text.length > 100 ? '...' : '');

      readingMap[String(item.id)] = {
        front: title,
        back,
        audioUrl: item.audioUrl || item.audio_url,
      };
    });

    // Listening from fetched data
    const listeningMap: ItemDataMap['listening'] = {};
    listeningData.forEach((item) => {
      const back = item.transcript || item.text;

      listeningMap[String(item.id)] = {
        front: item.title,
        back,
        audioUrl: item.audioUrl || item.audio_url,
      };
    });

    return { vocabulary: vocabMap, kanji: kanjiMap, grammar: grammarMap, reading: readingMap, listening: listeningMap };
  }, [targetLanguage, kanjiData, grammarData, readingData, listeningData, getMeaning, getText]);

  // Load review queue
  useEffect(() => {
    const vocabData = getModuleData('vocabulary');
    const kanjiData = getModuleData('kanji');
    const grammarData = getModuleData('grammar');
    const readingModData = getModuleData('reading');
    const listeningModData = getModuleData('listening');

    const reviewQueue = getReviewQueue(
      {
        vocabulary: vocabData ? { learned: vocabData.learned || [], reviews: vocabData.reviews || {} } : undefined,
        kanji: kanjiData ? { learned: kanjiData.learned || [], reviews: kanjiData.reviews || {} } : undefined,
        grammar: grammarData ? { learned: grammarData.learned || [], reviews: grammarData.reviews || {} } : undefined,
        reading: readingModData ? { learned: readingModData.learned || [], reviews: readingModData.reviews || {} } : undefined,
        listening: listeningModData ? { learned: listeningModData.learned || [], reviews: listeningModData.reviews || {} } : undefined,
      },
      DEFAULT_SRS_SETTINGS
    );

    // Attach item data to queue items
    reviewQueue.items = reviewQueue.items.map((item) => ({
      ...item,
      data: itemDataMap[item.module]?.[item.id],
    }));

    setQueue(includeLearnedDueItems(reviewQueue, allLearned));
    setIsLoading(false);
  }, [getModuleData, itemDataMap, allLearned]);

  // Start a review session
  const handleStartSession = useCallback(() => {
    if (!queue) return;

    // Filter items by selected modules
    const filteredItems = queue.items.filter((item) =>
      selectedModules.includes(item.module)
    );

    if (filteredItems.length === 0) {
      return;
    }

    const newSession = startReviewSession(filteredItems, 20);
    setSession(newSession);
    setMode('session');
    setShowAnswer(false);
    setResponseStartTime(Date.now());
  }, [queue, selectedModules]);

  // Handle showing answer
  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true);
    // Play audio if available
    const currentItem = session?.items[session.currentIndex];
    if (currentItem?.data?.audioUrl) {
      speak(currentItem.data.front, { audioUrl: currentItem.data.audioUrl });
    }
  }, [session, speak]);

  // Handle quality rating
  const handleQualityRating = useCallback(
    (quality: number) => {
      if (!session) return;

      const responseTime = Date.now() - responseStartTime;
      const currentItem = session.items[session.currentIndex];

      // Submit answer and get updated session
      const { session: updatedSession, updatedReviewData, isSessionComplete } = submitReviewAnswer(
        session,
        quality,
        responseTime
      );

      // Update the review data in context
      if (currentItem.source === 'learnedContent') {
        void recordReview(currentItem.id, quality);
      } else {
        updateModuleReview(currentItem.module, currentItem.id, updatedReviewData);
      }

      setSession(updatedSession);

      if (isSessionComplete) {
        setMode('complete');
      } else {
        setShowAnswer(false);
        setResponseStartTime(Date.now());
      }
    },
    [session, responseStartTime, updateModuleReview, recordReview]
  );

  // Toggle module selection
  const toggleModule = useCallback((module: ReviewModuleName) => {
    setSelectedModules((prev) => {
      if (prev.includes(module)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((m) => m !== module);
      }
      return [...prev, module];
    });
  }, []);

  // Handle returning to dashboard
  const handleBackToDashboard = useCallback(() => {
    router.push('/');
  }, [router]);

  // Handle starting another session
  const handleAnotherSession = useCallback(() => {
    setMode('overview');
    setSession(null);
    setShowAnswer(false);

    // Reload queue
    const vocabData = getModuleData('vocabulary');
    const kanjiData = getModuleData('kanji');
    const grammarData = getModuleData('grammar');
    const readingModData = getModuleData('reading');
    const listeningModData = getModuleData('listening');

    const reviewQueue = getReviewQueue(
      {
        vocabulary: vocabData ? { learned: vocabData.learned || [], reviews: vocabData.reviews || {} } : undefined,
        kanji: kanjiData ? { learned: kanjiData.learned || [], reviews: kanjiData.reviews || {} } : undefined,
        grammar: grammarData ? { learned: grammarData.learned || [], reviews: grammarData.reviews || {} } : undefined,
        reading: readingModData ? { learned: readingModData.learned || [], reviews: readingModData.reviews || {} } : undefined,
        listening: listeningModData ? { learned: listeningModData.learned || [], reviews: listeningModData.reviews || {} } : undefined,
      },
      DEFAULT_SRS_SETTINGS
    );

    reviewQueue.items = reviewQueue.items.map((item) => ({
      ...item,
      data: itemDataMap[item.module]?.[item.id],
    }));

    setQueue(includeLearnedDueItems(reviewQueue, allLearned));
  }, [getModuleData, itemDataMap, allLearned]);

  // Calculate filtered queue stats
  const filteredQueueStats = useMemo(() => {
    if (!queue) return { total: 0, estimatedMinutes: 0 };

    const filteredItems = queue.items.filter((item) =>
      selectedModules.includes(item.module)
    );

    return {
      total: filteredItems.length,
      estimatedMinutes: Math.ceil((filteredItems.length * 8) / 60),
    };
  }, [queue, selectedModules]);

  const header = <PageHeader title={t('review.title')} />;

  if (isLoading) {
    return (
      <Container variant="dashboard">
        {header}
        <p className={styles.statusText} role="status" aria-live="polite">{t('review.loading')}</p>
      </Container>
    );
  }

  // Overview mode - show queue summary and start button
  if (mode === 'overview') {
    const urgency = queue?.urgency || 'none';

    return (
      <Container variant="dashboard">
        {header}

        <div className={styles.overview}>
          <section className={styles.summary} aria-labelledby="review-due-title">
            <div className={styles.summaryHeader}>
              <h2 id="review-due-title" className={styles.summaryTitle}>
                {t('review.itemsDue', { count: queue?.total || 0 })}
              </h2>
              <span className={`${styles.urgencyBadge} ${styles[urgency]}`}>
                {urgency === 'overdue' && t('review.urgency.overdue')}
                {urgency === 'due' && t('review.urgency.dueToday')}
                {urgency === 'upcoming' && t('review.urgency.upcoming')}
                {urgency === 'none' && t('review.urgency.allClear')}
              </span>
            </div>

            <p className={styles.estimatedTime}>
              <IoTime className={styles.timeIcon} aria-hidden="true" />
              <span>
                {t('review.estimatedTime', { minutes: filteredQueueStats.estimatedMinutes, items: filteredQueueStats.total })}
              </span>
            </p>

            <Button
              onClick={handleStartSession}
              disabled={filteredQueueStats.total === 0}
              fullWidth
              size="lg"
              className={styles.startButton}
            >
              {filteredQueueStats.total > 0 ? t('review.startSession') : t('review.noReviewsDue')}
            </Button>
          </section>

          <section className={styles.modules} aria-labelledby="review-modules-title">
            <h2 id="review-modules-title" className={styles.sectionTitle}>{t('review.moduleSelection')}</h2>
            <ul className={styles.moduleList}>
              {REVIEW_MODULES.map(({ id, icon: ModuleIcon }) => {
                const selected = selectedModules.includes(id);
                const count = queue?.byModule[id] || 0;
                const label = t(`review.modules.${id}`);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`${styles.moduleRow} ${selected ? styles.moduleRowSelected : ''}`}
                      onClick={() => toggleModule(id)}
                      aria-pressed={selected}
                      aria-label={t('review.toggleModule', { module: label, count })}
                    >
                      <span className={styles.moduleIcon} aria-hidden="true"><ModuleIcon /></span>
                      <span className={styles.moduleLabel}>{label}</span>
                      <span className={`${styles.moduleCount} ${count === 0 ? styles.moduleCountEmpty : ''}`}>{count}</span>
                      <span className={styles.moduleCheck} aria-hidden="true">
                        {selected ? <IoCheckmarkCircle /> : <IoEllipseOutline />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </Container>
    );
  }

  // Session mode - show review cards
  if (mode === 'session' && session) {
    const currentItem = session.items[session.currentIndex];

    return (
      <Container variant="dashboard">
        <div className={styles.sessionColumn}>
          <ReviewProgress
            current={session.currentIndex + 1}
            total={session.items.length}
            correct={session.results.correct}
            incorrect={session.results.incorrect}
            onEndSession={() => setMode('complete')}
          />

          <ReviewCard
            item={currentItem}
            showAnswer={showAnswer}
            onShowAnswer={handleShowAnswer}
            onRate={handleQualityRating}
          />
        </div>
      </Container>
    );
  }

  // Complete mode - show session stats
  if (mode === 'complete' && session) {
    const stats = calculateSessionStats(session);

    return (
      <Container variant="dashboard">
        {header}

        <ReviewStats
          stats={stats}
          onBackToDashboard={handleBackToDashboard}
          onAnotherSession={handleAnotherSession}
        />
      </Container>
    );
  }

  return null;
}
