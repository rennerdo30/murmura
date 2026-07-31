'use client';

import Link from 'next/link';
import { Text, Button, Card } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { IoRocket, IoChevronForward } from 'react-icons/io5';
import styles from './PathProgressCard.module.css';

interface PathProgressCardProps {
  pathId: string;
  pathName: string;
  currentMilestone: string;
  currentLesson: string;
  progress: number;           // 0-100
  lessonsCompleted: number;
  lessonsTotal: number;
}

export default function PathProgressCard({
  pathId,
  pathName,
  currentMilestone,
  currentLesson,
  progress,
  lessonsCompleted,
  lessonsTotal,
}: PathProgressCardProps) {
  const { t } = useLanguage();
  return (
    <Card variant="glass" className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <IoRocket className={styles.icon} />
          <Text variant="h3">{pathName}</Text>
        </div>
        <Text variant="caption" color="muted">
          {currentMilestone}
        </Text>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={styles.progressInfo}>
          <Text variant="caption" color="muted">
            {t('dashboard.pathProgress.lessonsCount', { completed: lessonsCompleted, total: lessonsTotal })}
          </Text>
          <Text variant="label" className={styles.progressPercent}>
            {progress}%
          </Text>
        </div>
      </div>

      <div className={styles.currentLesson}>
        <Text variant="caption" color="muted">{t('dashboard.pathProgress.nextUp')}</Text>
        <Text variant="body" className={styles.lessonTitle}>
          {currentLesson}
        </Text>
      </div>

      <Button href={`/paths/${pathId}`} variant="primary" className={styles.continueButton}>
        {t('dashboard.continueLearning')} <IoChevronForward aria-hidden="true" />
      </Button>
    </Card>
  );
}
