'use client';

import { useCallback } from 'react';
import { Card, Text, Button, Animated } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { ReviewItem } from '@/lib/reviewQueue';
import { useTTS } from '@/hooks/useTTS';
import { IoVolumeHigh, IoBook, IoSchool, IoDocumentText, IoReader, IoHeadset } from 'react-icons/io5';
import styles from './ReviewCard.module.css';

interface ReviewCardProps {
  item: ReviewItem;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onRate: (quality: number) => void;
}

const moduleIcons = {
  vocabulary: IoBook,
  kanji: IoSchool,
  grammar: IoDocumentText,
  reading: IoReader,
  listening: IoHeadset,
};

export default function ReviewCard({
  item,
  showAnswer,
  onShowAnswer,
  onRate,
}: ReviewCardProps) {
  const { t } = useLanguage();
  const { speak } = useTTS();
  const ModuleIcon = moduleIcons[item.module];

  const qualityButtons = [
    { quality: 0, label: t('review.card.rating.again'), color: 'danger', description: t('review.card.rating.againDesc') },
    { quality: 2, label: t('review.card.rating.hard'), color: 'warning', description: t('review.card.rating.hardDesc') },
    { quality: 3, label: t('review.card.rating.good'), color: 'primary', description: t('review.card.rating.goodDesc') },
    { quality: 4, label: t('review.card.rating.easy'), color: 'success', description: t('review.card.rating.easyDesc') },
    { quality: 5, label: t('review.card.rating.perfect'), color: 'success', description: t('review.card.rating.perfectDesc') },
  ];

  const handlePlayAudio = useCallback(() => {
    if (item.data?.front) {
      speak(item.data.front, { audioUrl: item.data.audioUrl });
    }
  }, [item, speak]);

  const getMasteryLabel = (status: string) => {
    switch (status) {
      case 'new': return t('review.mastery.new');
      case 'learning': return t('review.mastery.learning');
      case 'review': return t('review.mastery.review');
      case 'mastered': return t('review.mastery.mastered');
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <Card variant="glass" className={styles.reviewCard}>
      {/* Module badge */}
      <div className={styles.moduleBadge}>
        <ModuleIcon className={styles.moduleIcon} />
        <span>{t(`review.modules.${item.module === 'kanji' ? 'kanji' : item.module}`)}</span>
      </div>

      {/* Front of card */}
      <Animated animation="fadeInUp" key={item.id + '-front'}>
        <div className={styles.cardFront}>
          <Text variant="h1" className={styles.frontText}>
            {item.data?.front || item.id}
          </Text>

          {item.data?.audioUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayAudio}
              className={styles.audioButton}
            >
              <IoVolumeHigh /> {t('common.play')}
            </Button>
          )}
        </div>
      </Animated>

      {/* Back of card / Show Answer */}
      {!showAnswer ? (
        <div className={styles.showAnswerSection}>
          <Button onClick={onShowAnswer} size="lg" fullWidth>
            {t('review.card.showAnswer')}
          </Button>
        </div>
      ) : (
        <Animated animation="fadeInUp" key={item.id + '-back'}>
          <div className={styles.cardBack}>
            <div className={styles.answerSection}>
              <Text variant="h2" color="gold" className={styles.backText}>
                {item.data?.back || t('common.unknown')}
              </Text>

              {item.data?.reading && (
                <Text color="muted" className={styles.readingText}>
                  {item.data.reading}
                </Text>
              )}
            </div>

            <div className={styles.ratingSection}>
              <Text variant="label" color="muted" className={styles.ratingLabel}>
                {t('review.card.questionRating')}
              </Text>

              <div className={styles.ratingButtons}>
                {qualityButtons.map((btn) => (
                  <button
                    key={btn.quality}
                    onClick={() => onRate(btn.quality)}
                    className={`${styles.ratingButton} ${styles[btn.color]}`}
                    title={btn.description}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Animated>
      )}

      {/* Mastery indicator */}
      <div className={styles.masteryIndicator}>
        <span className={`${styles.masteryDot} ${styles[item.masteryStatus]}`} />
        <Text variant="label" color="muted">
          {getMasteryLabel(item.masteryStatus)}
        </Text>
      </div>
    </Card>
  );
}
