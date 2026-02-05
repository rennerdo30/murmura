'use client';

import { useCallback } from 'react';
import { Text, Button } from '@/components/ui';
import { IoBook, IoLanguage, IoSchool, IoGlobe, IoVolumeHigh, IoStop, IoText } from 'react-icons/io5';
import { useTTS } from '@/hooks/useTTS';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './LessonCard.module.css';

interface LessonCardProps {
  type: 'topic' | 'vocabulary' | 'grammar' | 'cultural' | 'example';
  title: string;
  content: string;
  meaning?: string;
  audioUrl?: string;
  speakable?: boolean;
  usageNote?: string;
  formation?: string;
  reading?: string;
  translation?: string;
  partOfSpeech?: string;
  level?: string;
  /** For recycled items - shows "Review" badge */
  isReview?: boolean;
  /** For recycled items - which lesson it was first introduced */
  reviewSource?: string;
  /** Exposure count for spaced repetition tracking */
  exposureCount?: number;
  /** Formality level for grammar cards */
  formalityLevel?: 'casual' | 'polite' | 'formal' | 'humble' | 'any';
}

const TYPE_ICONS = {
  topic: IoBook,
  vocabulary: IoLanguage,
  grammar: IoSchool,
  cultural: IoGlobe,
  example: IoText,
};

const TYPE_COLORS = {
  topic: 'var(--gold, #FFD700)',
  vocabulary: 'var(--accent-blue, #4A90D9)',
  grammar: 'var(--accent-green, #4ADE80)',
  cultural: 'var(--accent-purple, #A855F7)',
  example: 'var(--accent-cyan, #22D3EE)',
};

export default function LessonCard({
  type,
  title,
  content,
  meaning,
  audioUrl,
  speakable = false,
  usageNote,
  formation,
  reading,
  translation,
  partOfSpeech,
  level,
  isReview = false,
  reviewSource,
  exposureCount,
  formalityLevel,
}: LessonCardProps) {
  const { t } = useLanguage();
  const Icon = TYPE_ICONS[type];
  const color = TYPE_COLORS[type];
  const { speak, stop, isPlaying } = useTTS();

  // Check if this card type should be speakable by default
  const shouldShowTTS = speakable || type === 'vocabulary' || type === 'example';

  const handleSpeak = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      speak(content, { audioUrl });
    }
  }, [content, audioUrl, speak, stop, isPlaying]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrapper} style={{ backgroundColor: `${color}20` }}>
          <Icon className={styles.icon} style={{ color }} />
        </div>
        <Text variant="label" color="muted" className={styles.type}>
          {title}
        </Text>
      </div>

      <div className={styles.content}>
        <Text variant="h2" className={styles.mainContent}>
          {content}
        </Text>
        {meaning && (
          <Text variant="body" color="muted" className={styles.meaning}>
            {meaning}
          </Text>
        )}
        {/* Part of Speech, Level, Review, and Formality badges */}
        {(partOfSpeech || level || isReview || formalityLevel || exposureCount) && (
          <div className={styles.badges} role="group" aria-label="Word metadata">
            {isReview && (
              <span
                className={styles.reviewBadge}
                aria-label={reviewSource ? `Review from: ${reviewSource}` : 'Review item'}
                title={reviewSource ? `First learned in: ${reviewSource}` : 'Review item'}
              >
                Review
              </span>
            )}
            {exposureCount !== undefined && exposureCount > 0 && (
              <span
                className={styles.exposureBadge}
                aria-label={`Seen ${exposureCount} times`}
                title={`You've encountered this ${exposureCount} time${exposureCount > 1 ? 's' : ''}`}
              >
                {exposureCount}x
              </span>
            )}
            {formalityLevel && formalityLevel !== 'any' && (
              <span
                className={`${styles.formalityBadge} ${styles[`formality${formalityLevel.charAt(0).toUpperCase() + formalityLevel.slice(1)}`]}`}
                aria-label={`Formality level: ${formalityLevel}`}
              >
                {formalityLevel}
              </span>
            )}
            {partOfSpeech && (
              <span
                className={styles.partOfSpeechBadge}
                aria-label={`Part of speech: ${partOfSpeech}`}
              >
                {partOfSpeech}
              </span>
            )}
            {level && (
              <span
                className={styles.levelBadge}
                aria-label={`Level: ${level}`}
              >
                {level}
              </span>
            )}
          </div>
        )}
        {/* Reading (for examples) */}
        {reading && (
          <Text variant="body" color="muted" className={styles.reading}>
            {reading}
          </Text>
        )}
        {/* Translation (for examples) */}
        {translation && (
          <Text variant="body" className={styles.translation}>
            {translation}
          </Text>
        )}
        {/* Formation (for grammar) */}
        {formation && type === 'grammar' && (
          <div className={styles.formation}>
            <Text variant="label" color="muted">{t('lessons.card.formation')}</Text>
            <Text variant="body" className={styles.formationText}>
              {formation}
            </Text>
          </div>
        )}
        {/* Usage Note (for vocab and grammar) */}
        {usageNote && (
          <div className={styles.usageNote}>
            <Text variant="caption" color="muted" className={styles.usageNoteText}>
              {usageNote}
            </Text>
          </div>
        )}
      </div>

      {shouldShowTTS && (
        <div className={styles.ttsControls}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpeak}
            className={styles.ttsButton}
            aria-label={isPlaying ? t('common.stop') : t('common.listen')}
          >
            {isPlaying ? (
              <>
                <IoStop /> {t('lessons.view.stop')}
              </>
            ) : (
              <>
                <IoVolumeHigh /> {t('common.listen')}
              </>
            )}
          </Button>
        </div>
      )}

      <div className={styles.footer}>
        <Text variant="caption" color="muted">
          {t('lessons.view.tapToContinueHint')}
        </Text>
      </div>
    </div>
  );
}
