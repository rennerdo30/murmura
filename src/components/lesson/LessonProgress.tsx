'use client';

import { Text } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './LessonProgress.module.css';

export interface PhaseStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface LessonProgressProps {
  current: number;
  total: number;
  phase: 'learning' | 'pronunciation' | 'exercises';
  phases?: PhaseStep[];
}

export default function LessonProgressBar({
  current,
  total,
  phase,
  phases,
}: LessonProgressProps) {
  const { t } = useLanguage();
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={styles.container}>
      {phases && phases.length > 0 && (
        <div className={styles.phaseIndicator} role="list" aria-label={t('lessons.progress.phases')}>
          {phases.map((p, index) => (
            <div key={p.id} className={styles.phaseStepWrapper}>
              <div
                className={`${styles.phaseDot} ${styles[p.status]}`}
                role="listitem"
                aria-label={p.label}
                aria-current={p.status === 'current' ? 'step' : undefined}
              >
                {index + 1}
              </div>
              <span className={`${styles.phaseStepLabel} ${styles[p.status]}`}>
                {p.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.header}>
        <Text variant="label" color="muted" className={styles.phaseLabel}>
          {phase === 'learning'
            ? t('lessons.view.learning')
            : phase === 'pronunciation'
              ? t('lessons.view.pronunciation')
              : t('lessons.view.practice')}
        </Text>
        <Text variant="caption" color="muted">
          {current} / {total}
        </Text>
      </div>

      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className={`${styles.progressFill} ${styles[phase]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
