'use client';

import { useMemo, Fragment } from 'react';
import Link from 'next/link';
import { Card, Text, Spinner } from '@/components/ui';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useProgressContext } from '@/context/ProgressProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useLanguage } from '@/context/LanguageProvider';
import { IoGrid } from 'react-icons/io5';
import styles from './MasteryHeatmap.module.css';

interface MasteryHeatmapProps {
  className?: string;
}

export default function MasteryHeatmap({ className }: MasteryHeatmapProps) {
  const { t } = useLanguage();
  const { stats, isLoading } = useRecommendations();
  const { getModuleProgress } = useProgressContext();
  const { availableModules, levels, targetLanguage } = useTargetLanguage();

  // Get level IDs for current language (e.g., ['N5', 'N4', ...] for Japanese, ['A1', 'A2', ...] for CEFR)
  const levelIds = useMemo(() => levels.map(l => l.id), [levels, targetLanguage]);

  // Generate heatmap data - filtered by language
  const heatmapData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};

    availableModules.forEach((module) => {
      data[module] = {};
      levelIds.forEach((level, levelIndex) => {
        // For now, we'll use module progress as a base and simulate level distribution
        // In a real implementation, this would come from actual level-based progress data
        const moduleProgress = stats?.moduleStrengths[module as keyof typeof stats.moduleStrengths] || 0;

        // Simulate progress decay for higher levels
        const decay = Math.pow(0.5, levelIndex);
        const progress = Math.round(moduleProgress * 100 * decay);

        data[module][level] = Math.min(100, Math.max(0, progress));
      });
    });

    return data;
  }, [stats, availableModules, levelIds, targetLanguage]);

  // Get color based on mastery percentage
  const getColor = (percentage: number) => {
    if (percentage === 0) return 'var(--bg-secondary, #1a1a2e)';
    if (percentage < 25) return 'rgba(212, 165, 116, 0.2)';
    if (percentage < 50) return 'rgba(212, 165, 116, 0.4)';
    if (percentage < 75) return 'rgba(212, 165, 116, 0.6)';
    if (percentage < 90) return 'rgba(212, 165, 116, 0.8)';
    return 'var(--accent-gold, #d4a574)';
  };

  if (isLoading) {
    return (
      <Card variant="glass" className={`${styles.heatmap} ${className || ''}`}>
        <div className={styles.loading} role="status" aria-live="polite">
          <Spinner />
          <Text color="muted">{t('common.loading')}</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="glass" className={`${styles.heatmap} ${className || ''}`}>
      <div className={styles.header}>
        <IoGrid className={styles.headerIcon} />
        <Text variant="h3">{t('dashboard.heatmap.title')}</Text>
      </div>

      <div className={styles.grid} style={{ gridTemplateColumns: `auto repeat(${levelIds.length}, 1fr)` }}>
        {/* Level Headers */}
        <div className={styles.corner} />
        {levelIds.map((level) => (
          <div key={level} className={styles.levelHeader}>
            {level}
          </div>
        ))}

        {/* Module Rows */}
        {availableModules.map((module) => (
          <Fragment key={module}>
            <div className={styles.moduleLabel}>
              {t(`modules.${module}.title`)}
            </div>
            {levelIds.map((level) => {
              const progress = heatmapData[module]?.[level] || 0;
              return (
                <Link
                  key={`${module}-${level}`}
                  href={`/${module}`}
                  className={styles.cell}
                  style={{ backgroundColor: getColor(progress) }}
                  title={`${t(`modules.${module}.title`)} ${level}: ${progress}%`}
                >
                  {progress > 0 && (
                    <span className={styles.cellValue}>{progress}</span>
                  )}
                </Link>
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <Text variant="caption" color="muted">{t('dashboard.activity.less')}</Text>
        <div className={styles.legendScale}>
          <div className={styles.legendCell} style={{ backgroundColor: 'var(--bg-secondary)' }} />
          <div className={styles.legendCell} style={{ backgroundColor: 'rgba(212, 165, 116, 0.2)' }} />
          <div className={styles.legendCell} style={{ backgroundColor: 'rgba(212, 165, 116, 0.4)' }} />
          <div className={styles.legendCell} style={{ backgroundColor: 'rgba(212, 165, 116, 0.6)' }} />
          <div className={styles.legendCell} style={{ backgroundColor: 'rgba(212, 165, 116, 0.8)' }} />
          <div className={styles.legendCell} style={{ backgroundColor: 'var(--accent-gold)' }} />
        </div>
        <Text variant="caption" color="muted">{t('dashboard.activity.more')}</Text>
      </div>
    </Card>
  );
}
