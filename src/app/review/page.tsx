'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/common/Navigation';
import { Container, Card, Text, Button, Animated } from '@/components/ui';
import ReviewCard from '@/components/review/ReviewCard';
import ReviewProgress from '@/components/review/ReviewProgress';
import ReviewStats from '@/components/review/ReviewStats';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useTTS } from '@/hooks/useTTS';
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
import { IoBook, IoSchool, IoDocumentText, IoCheckmarkCircle, IoTime, IoFlame } from 'react-icons/io5';
import styles from './review.module.css';

type ReviewMode = 'overview' | 'session' | 'complete';

interface ItemDataMap {
  vocabulary: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
  kanji: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
  grammar: Record<string, { front: string; back: string; reading?: string; audioUrl?: string }>;
}

// Interface for kanji/hanzi data from JSON
interface KanjiData {
  id: string;
  kanji?: string;
  hanzi?: string;
  meaning: string;
  onyomi?: string[];
  kunyomi?: string[];
  pinyin?: string;
  audioUrl?: string;
}

// Interface for grammar data from JSON
interface GrammarData {
  id: string;
  title: string;
  explanation?: string;
  explanations?: { en?: string };
}

export default function ReviewPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { targetLanguage, getDataUrl } = useTargetLanguage();
  const { speak } = useTTS();
  const { getModuleData, updateModuleReview } = useProgressContext();

  const [mode, setMode] = useState<ReviewMode>('overview');
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [session, setSession] = useState<ReviewSessionState | null>(null);
  const [selectedModules, setSelectedModules] = useState<ReviewModuleName[]>(['vocabulary', 'kanji', 'grammar']);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number>(0);
  const [kanjiData, setKanjiData] = useState<KanjiData[]>([]);
  const [grammarData, setGrammarData] = useState<GrammarData[]>([]);

  // Load kanji/hanzi and grammar data when language changes
  useEffect(() => {
    const abortController = new AbortController();

    const loadData = async () => {
      try {
        // Load kanji or hanzi based on language
        const kanjiFileName = targetLanguage === 'zh' ? 'hanzi.json' : 'kanji.json';
        const [kanjiResponse, grammarResponse] = await Promise.all([
          fetch(getDataUrl(kanjiFileName), { signal: abortController.signal }).catch(() => null),
          fetch(getDataUrl('grammar.json'), { signal: abortController.signal }).catch(() => null),
        ]);

        if (!abortController.signal.aborted) {
          if (kanjiResponse?.ok) {
            const data = await kanjiResponse.json();
            setKanjiData(Array.isArray(data) ? data : []);
          } else {
            setKanjiData([]);
          }

          if (grammarResponse?.ok) {
            const data = await grammarResponse.json();
            setGrammarData(Array.isArray(data) ? data : []);
          } else {
            setGrammarData([]);
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
      vocabMap[item.id] = {
        front: item.word,
        back: item.meaning,
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
        : [...(item.onyomi || []), ...(item.kunyomi || [])].join(', ');

      kanjiMap[item.id] = {
        front: character,
        back: item.meaning,
        reading,
        audioUrl: item.audioUrl,
      };
    });

    // Grammar from fetched data
    const grammarMap: ItemDataMap['grammar'] = {};
    grammarData.forEach((item) => {
      grammarMap[item.id] = {
        front: item.title,
        back: item.explanations?.en || item.explanation || '',
      };
    });

    return { vocabulary: vocabMap, kanji: kanjiMap, grammar: grammarMap };
  }, [targetLanguage, kanjiData, grammarData]);

  // Load review queue
  useEffect(() => {
    const vocabData = getModuleData('vocabulary');
    const kanjiData = getModuleData('kanji');
    const grammarData = getModuleData('grammar');

    const reviewQueue = getReviewQueue(
      {
        vocabulary: vocabData ? { learned: vocabData.learned || [], reviews: vocabData.reviews || {} } : undefined,
        kanji: kanjiData ? { learned: kanjiData.learned || [], reviews: kanjiData.reviews || {} } : undefined,
        grammar: grammarData ? { learned: grammarData.learned || [], reviews: grammarData.reviews || {} } : undefined,
      },
      DEFAULT_SRS_SETTINGS
    );

    // Attach item data to queue items
    reviewQueue.items = reviewQueue.items.map((item) => ({
      ...item,
      data: itemDataMap[item.module]?.[item.id],
    }));

    setQueue(reviewQueue);
    setIsLoading(false);
  }, [getModuleData, itemDataMap]);

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
      updateModuleReview(currentItem.module, currentItem.id, updatedReviewData);

      setSession(updatedSession);

      if (isSessionComplete) {
        setMode('complete');
      } else {
        setShowAnswer(false);
        setResponseStartTime(Date.now());
      }
    },
    [session, responseStartTime, updateModuleReview]
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

    const reviewQueue = getReviewQueue(
      {
        vocabulary: vocabData ? { learned: vocabData.learned || [], reviews: vocabData.reviews || {} } : undefined,
        kanji: kanjiData ? { learned: kanjiData.learned || [], reviews: kanjiData.reviews || {} } : undefined,
        grammar: grammarData ? { learned: grammarData.learned || [], reviews: grammarData.reviews || {} } : undefined,
      },
      DEFAULT_SRS_SETTINGS
    );

    reviewQueue.items = reviewQueue.items.map((item) => ({
      ...item,
      data: itemDataMap[item.module]?.[item.id],
    }));

    setQueue(reviewQueue);
  }, [getModuleData, itemDataMap]);

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

  if (isLoading) {
    return (
      <Container variant="centered">
        <Navigation />
        <Text>{t('review.loading')}</Text>
      </Container>
    );
  }

  // Overview mode - show queue summary and start button
  if (mode === 'overview') {
    return (
      <Container variant="centered">
        <Navigation />

        <Animated animation="fadeInDown">
          <Text variant="h1" color="gold" className={styles.pageTitle}>
            {t('review.title')}
          </Text>
        </Animated>

        <Card variant="glass" className={styles.queueSummary}>
          <div className={styles.queueHeader}>
            <Text variant="h2">
              {t('review.itemsDue', { count: queue?.total || 0 })}
            </Text>
            <div className={`${styles.urgencyBadge} ${styles[queue?.urgency || 'none']}`}>
              {queue?.urgency === 'overdue' && t('review.urgency.overdue')}
              {queue?.urgency === 'due' && t('review.urgency.dueToday')}
              {queue?.urgency === 'upcoming' && t('review.urgency.upcoming')}
              {queue?.urgency === 'none' && t('review.urgency.allClear')}
            </div>
          </div>

          <div className={styles.moduleBreakdown} role="group" aria-label={t('review.moduleSelection')}>
            <button
              className={`${styles.moduleChip} ${selectedModules.includes('vocabulary') ? styles.active : ''}`}
              onClick={() => toggleModule('vocabulary')}
              aria-pressed={selectedModules.includes('vocabulary')}
              aria-label={t('review.toggleModule', { module: t('review.modules.vocabulary'), count: queue?.byModule.vocabulary || 0 })}
            >
              <IoBook className={styles.moduleIcon} aria-hidden="true" />
              <span>{t('review.modules.vocabulary')}: {queue?.byModule.vocabulary || 0}</span>
            </button>
            <button
              className={`${styles.moduleChip} ${selectedModules.includes('kanji') ? styles.active : ''}`}
              onClick={() => toggleModule('kanji')}
              aria-pressed={selectedModules.includes('kanji')}
              aria-label={t('review.toggleModule', { module: t('review.modules.kanji'), count: queue?.byModule.kanji || 0 })}
            >
              <IoSchool className={styles.moduleIcon} aria-hidden="true" />
              <span>{t('review.modules.kanji')}: {queue?.byModule.kanji || 0}</span>
            </button>
            <button
              className={`${styles.moduleChip} ${selectedModules.includes('grammar') ? styles.active : ''}`}
              onClick={() => toggleModule('grammar')}
              aria-pressed={selectedModules.includes('grammar')}
              aria-label={t('review.toggleModule', { module: t('review.modules.grammar'), count: queue?.byModule.grammar || 0 })}
            >
              <IoDocumentText className={styles.moduleIcon} aria-hidden="true" />
              <span>{t('review.modules.grammar')}: {queue?.byModule.grammar || 0}</span>
            </button>
          </div>

          <div className={styles.estimatedTime}>
            <IoTime className={styles.timeIcon} />
            <Text>
              {t('review.estimatedTime', { minutes: filteredQueueStats.estimatedMinutes, items: filteredQueueStats.total })}
            </Text>
          </div>

          <Button
            onClick={handleStartSession}
            disabled={filteredQueueStats.total === 0}
            fullWidth
            size="lg"
            className={styles.startButton}
          >
            {filteredQueueStats.total > 0 ? t('review.startSession') : t('review.noReviewsDue')}
          </Button>
        </Card>

        <Button variant="ghost" onClick={handleBackToDashboard} className={styles.backButton}>
          {t('review.stats.backToDashboard')}
        </Button>
      </Container>
    );
  }

  // Session mode - show review cards
  if (mode === 'session' && session) {
    const currentItem = session.items[session.currentIndex];

    return (
      <Container variant="centered">
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
      </Container>
    );
  }

  // Complete mode - show session stats
  if (mode === 'complete' && session) {
    const stats = calculateSessionStats(session);

    return (
      <Container variant="centered">
        <Navigation />

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
