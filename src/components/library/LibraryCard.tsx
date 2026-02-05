'use client';

import { useCallback } from 'react';
import { Text, Button, Card } from '@/components/ui';
import { IoVolumeHigh, IoStop, IoCheckmarkCircle, IoTime } from 'react-icons/io5';
import { useTTS } from '@/hooks/useTTS';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './LibraryCard.module.css';

interface LibraryCardProps {
  id: string;
  primary: string;           // Main content (word, kanji, etc.)
  secondary?: string;        // Secondary content (reading, etc.)
  meaning: string;
  lessonSource?: string;     // "From: Lesson 1"
  srsStatus?: 'new' | 'learning' | 'review' | 'mastered';
  masteryPercent?: number;   // 0-100
  audioUrl?: string;
  onQuickReview?: (id: string) => void;
}

const SRS_COLORS = {
  new: 'var(--text-muted)',
  learning: 'var(--accent-blue, #4A90D9)',
  review: 'var(--gold, #FFD700)',
  mastered: 'var(--accent-green, #4ADE80)',
};

export default function LibraryCard({
  id,
  primary,
  secondary,
  meaning,
  lessonSource,
  srsStatus = 'new',
  masteryPercent,
  audioUrl,
  onQuickReview,
}: LibraryCardProps) {
  const { speak, stop, isPlaying } = useTTS();
  const { t } = useLanguage();

  const handleSpeak = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      speak(primary, { audioUrl });
    }
  }, [primary, audioUrl, speak, stop, isPlaying]);

  return (
    <Card variant="glass" className={styles.card}>
      <div className={styles.content}>
        <div className={styles.mainContent}>
          <Text className={styles.primary}>{primary}</Text>
          {secondary && (
            <Text variant="body" color="muted" className={styles.secondary}>
              {secondary}
            </Text>
          )}
        </div>

        <div className={styles.meaningSection}>
          <Text variant="body">{meaning}</Text>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.meta}>
          {lessonSource && (
            <Text variant="caption" color="muted" className={styles.lessonSource}>
              {lessonSource}
            </Text>
          )}
          <div className={styles.srsIndicator} style={{ color: SRS_COLORS[srsStatus] }}>
            {srsStatus === 'mastered' ? (
              <IoCheckmarkCircle />
            ) : (
              <IoTime />
            )}
            <Text variant="caption">{srsStatus}</Text>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpeak}
            className={styles.audioButton}
            aria-label={isPlaying ? t('common.stop') : t('common.listen')}
          >
            {isPlaying ? <IoStop /> : <IoVolumeHigh />}
          </Button>

          {onQuickReview && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onQuickReview(id)}
            >
              Review
            </Button>
          )}
        </div>
      </div>

      {masteryPercent !== undefined && (
        <div className={styles.masteryBar}>
          <div
            className={styles.masteryFill}
            style={{ width: `${masteryPercent}%` }}
          />
        </div>
      )}
    </Card>
  );
}
