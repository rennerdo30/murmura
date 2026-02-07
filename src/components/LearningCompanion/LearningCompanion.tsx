'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useLanguage } from '@/context/LanguageProvider';
import { Card, Text, Button, Animated } from '@/components/ui';
import {
  IoCompass,
  IoFlame,
  IoTime,
  IoChevronDown,
  IoChevronUp,
  IoClose,
  IoCheckmarkCircle,
  IoAlertCircle,
  IoBookOutline,
  IoSparkles,
  IoTrendingUp,
  IoPlay,
} from 'react-icons/io5';
import styles from './LearningCompanion.module.css';

interface LearningCompanionProps {
  defaultExpanded?: boolean;
  position?: 'sidebar' | 'bottom' | 'auto';
}

export default function LearningCompanion({
  defaultExpanded = false,
  position = 'auto',
}: LearningCompanionProps) {
  const { t } = useLanguage();
  const {
    recommendations,
    topRecommendation,
    stats,
    reviewQueue,
    jlptProgress,
    adaptiveRecommendations,
    streakInfo,
    isLoading,
  } = useRecommendations();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  // Keep companion placement aligned with viewport width.
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsMobileViewport(isMobile);

      if (!isMobile) {
        setIsMinimized(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resolvedPosition = position === 'auto'
    ? (isMobileViewport ? 'bottom' : 'sidebar')
    : position;

  // Don't render if completely minimized on mobile
  if (isMinimized) {
    return (
      <button
        className={styles.minimizedButton}
        onClick={() => setIsMinimized(false)}
        aria-label={t('learningCompanion.open')}
      >
        <IoCompass />
        {reviewQueue && reviewQueue.total > 0 && (
          <span className={styles.reviewBadge}>{reviewQueue.total}</span>
        )}
      </button>
    );
  }

  // Get urgency color
  const getUrgencyColor = (urgency: string | undefined) => {
    switch (urgency) {
      case 'overdue':
        return 'var(--accent-red)';
      case 'due':
        return 'var(--accent-gold)';
      case 'upcoming':
        return 'var(--success)';
      default:
        return 'var(--text-muted)';
    }
  };

  // Get recommendation icon
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'review':
        return <IoTime />;
      case 'new-lesson':
        return <IoBookOutline />;
      case 'path-milestone':
        return <IoTrendingUp />;
      case 'weak-area':
        return <IoAlertCircle />;
      case 'topic-track':
        return <IoSparkles />;
      case 'daily-goal':
        return <IoCheckmarkCircle />;
      default:
        return <IoPlay />;
    }
  };

  return (
    <aside className={`${styles.companion} ${styles[resolvedPosition]}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <IoCompass className={styles.compassIcon} />
          <Text variant="h3">{t('learningCompanion.title')}</Text>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.toggleButton}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
          >
            {isExpanded ? <IoChevronUp /> : <IoChevronDown />}
          </button>
          <button
            className={styles.closeButton}
            onClick={() => setIsMinimized(true)}
            aria-label={t('common.minimize')}
          >
            <IoClose />
          </button>
        </div>
      </div>

      {/* Progress Ring */}
      <div className={styles.progressRing}>
        <svg viewBox="0 0 100 100" className={styles.ringSvg}>
          <circle
            cx="50"
            cy="50"
            r="40"
            className={styles.ringBackground}
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            className={styles.ringProgress}
            style={{
              strokeDasharray: `${(jlptProgress?.percentComplete || 0) * 2.51} 251`,
            }}
          />
        </svg>
        <div className={styles.ringContent}>
          <Text variant="h2" color="gold">{jlptProgress?.percentComplete || 0}%</Text>
          <Text variant="label" color="muted">{t('learningCompanion.overall')}</Text>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className={styles.quickStats}>
        <div className={styles.quickStat}>
          <IoFlame className={styles.quickStatIcon} style={{ color: streakInfo?.isActive ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
          <div className={styles.quickStatValue}>{stats?.studyStreak || 0}</div>
          <div className={styles.quickStatLabel}>{t('learningCompanion.streak')}</div>
        </div>
        <div className={styles.quickStat}>
          <IoTime className={styles.quickStatIcon} style={{ color: getUrgencyColor(reviewQueue?.urgency) }} />
          <div className={styles.quickStatValue}>{reviewQueue?.total || 0}</div>
          <div className={styles.quickStatLabel}>{t('learningCompanion.reviews')}</div>
        </div>
        <div className={styles.quickStat}>
          <IoBookOutline className={styles.quickStatIcon} />
          <div className={styles.quickStatValue}>{stats?.totalItemsLearned || 0}</div>
          <div className={styles.quickStatLabel}>{t('learningCompanion.learned')}</div>
        </div>
      </div>

      {/* Review Alert */}
      {reviewQueue && reviewQueue.total > 0 && (
        <Link href="/review" className={styles.reviewAlert}>
          <div
            className={styles.reviewAlertIcon}
            style={{ backgroundColor: getUrgencyColor(reviewQueue.urgency) }}
          >
            <IoTime />
          </div>
          <div className={styles.reviewAlertContent}>
            <Text variant="label" className={styles.reviewAlertTitle}>
              {reviewQueue.urgency === 'overdue' ? t('learningCompanion.overdueReviews') : t('learningCompanion.reviewsDue')}
            </Text>
            <Text variant="caption" color="muted">
              {t('learningCompanion.reviewCount', { count: reviewQueue.total, minutes: reviewQueue.estimatedMinutes })}
            </Text>
          </div>
          <IoPlay className={styles.reviewAlertPlay} />
        </Link>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <Animated animation="fadeInUp">
          {/* Top Recommendation (always visible) */}
          {topRecommendation && (
            <div className={styles.section}>
              <Text variant="label" color="muted" className={styles.sectionTitle}>
                <IoSparkles /> {t('learningCompanion.nextUp')}
              </Text>
              <Link href={topRecommendation.action.target} className={styles.recommendationCard}>
                <div className={styles.recommendationIcon}>
                  {getRecommendationIcon(topRecommendation.type)}
                </div>
                <div className={styles.recommendationContent}>
                  <Text variant="body" className={styles.recommendationTitle}>
                    {topRecommendation.title}
                  </Text>
                  <Text variant="caption" color="muted">
                    {topRecommendation.description}
                  </Text>
                </div>
              </Link>
            </div>
          )}

          {/* JLPT Progress (always visible) */}
          {jlptProgress && jlptProgress.currentMilestone && (
            <div className={styles.section}>
              <Text variant="label" color="muted" className={styles.sectionTitle}>
                <IoTrendingUp /> {t('learningCompanion.currentGoal')}
              </Text>
              <div className={styles.milestoneCard}>
                <Text variant="body">{jlptProgress.currentMilestone.name}</Text>
                <div className={styles.milestoneProgress}>
                  <div
                    className={styles.milestoneProgressBar}
                    style={{ width: `${jlptProgress.currentMilestone.progress}%` }}
                  />
                </div>
                <Text variant="caption" color="muted">
                  {t('learningCompanion.percentComplete', { percent: Math.round(jlptProgress.currentMilestone.progress) })}
                </Text>
              </div>
            </div>
          )}

          {/* Show More toggle (only if there's extra content) */}
          {(recommendations.length > 1 || adaptiveRecommendations) && (
            <button
              className={styles.showMoreButton}
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? t('learningCompanion.showLess') : t('learningCompanion.showMore')}
              {showMore ? <IoChevronUp /> : <IoChevronDown />}
            </button>
          )}

          {/* Collapsed content (additional recommendations + adaptive insight) */}
          {showMore && (
            <>
              {/* More Recommendations */}
              {recommendations.length > 1 && (
                <div className={styles.section}>
                  <Text variant="label" color="muted" className={styles.sectionTitle}>
                    {t('learningCompanion.suggestions')}
                  </Text>
                  <div className={styles.suggestionsList}>
                    {recommendations.slice(1, 4).map((rec) => (
                      <Link
                        key={rec.id}
                        href={rec.action.target}
                        className={styles.suggestionItem}
                      >
                        <span className={styles.suggestionIcon}>
                          {getRecommendationIcon(rec.type)}
                        </span>
                        <span className={styles.suggestionText}>{rec.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Adaptive Insight */}
              {adaptiveRecommendations && (
                <div className={styles.section}>
                  <Text variant="label" color="muted" className={styles.sectionTitle}>
                    <IoCompass /> {t('learningCompanion.insight')}
                  </Text>
                  <Card variant="default" className={styles.insightCard}>
                    <Text variant="caption">{adaptiveRecommendations.rationale}</Text>
                  </Card>
                </div>
              )}
            </>
          )}
        </Animated>
      )}

      {/* Footer Actions */}
      <div className={styles.footer}>
        <Link href="/paths" className={styles.footerLink}>
          {t('learningCompanion.browsePaths')}
        </Link>
        <Link href="/review" className={styles.footerLink}>
          {t('learningCompanion.reviewNow')}
        </Link>
      </div>
    </aside>
  );
}
