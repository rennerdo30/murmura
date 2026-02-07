'use client';

import { useState, useCallback } from 'react';
import { Card, Text, Button } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { IoBook, IoSchool, IoDocumentText, IoPlay, IoSettings, IoReader, IoHeadset } from 'react-icons/io5';
import styles from './ReviewConfig.module.css';

export type ReviewModuleType = 'vocabulary' | 'kanji' | 'grammar' | 'reading' | 'listening';

interface ReviewConfigProps {
  dueItems: {
    vocabulary: number;
    kanji: number;
    grammar: number;
    reading: number;
    listening: number;
    total: number;
  };
  onStart: (config: {
    modules: ReviewModuleType[];
    itemCount: number;
  }) => void;
  maxItems?: number;
}

const moduleOptions: Array<{
  value: ReviewModuleType;
  labelKey: string;
  icon: typeof IoBook;
}> = [
    { value: 'vocabulary', labelKey: 'review.modules.vocabulary', icon: IoBook },
    { value: 'kanji', labelKey: 'review.modules.kanji', icon: IoSchool },
    { value: 'grammar', labelKey: 'review.modules.grammar', icon: IoDocumentText },
    { value: 'reading', labelKey: 'review.modules.reading', icon: IoReader },
    { value: 'listening', labelKey: 'review.modules.listening', icon: IoHeadset },
  ];

const itemCountOptions = [5, 10, 20, 50];

export default function ReviewConfig({
  dueItems,
  onStart,
  maxItems = 50,
}: ReviewConfigProps) {
  const { t } = useLanguage();
  const [selectedModules, setSelectedModules] = useState<ReviewModuleType[]>(['vocabulary', 'kanji', 'grammar', 'reading', 'listening']);
  const [itemCount, setItemCount] = useState(20);

  const toggleModule = useCallback((module: ReviewModuleType) => {
    setSelectedModules((prev) => {
      if (prev.includes(module)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== module);
      }
      return [...prev, module];
    });
  }, []);

  const availableItems = selectedModules.reduce(
    (sum, module) => sum + dueItems[module],
    0
  );

  const effectiveItemCount = Math.min(itemCount, availableItems, maxItems);

  const handleStart = useCallback(() => {
    if (effectiveItemCount > 0) {
      onStart({
        modules: selectedModules,
        itemCount: effectiveItemCount,
      });
    }
  }, [selectedModules, effectiveItemCount, onStart]);

  return (
    <Card variant="glass" className={styles.container}>
      <div className={styles.header}>
        <IoSettings className={styles.headerIcon} />
        <Text variant="h2">{t('review.config.title')}</Text>
      </div>

      <div className={styles.section}>
        <Text variant="label" color="muted" className={styles.sectionLabel}>
          {t('review.config.selectModules')}
        </Text>
        <div className={styles.moduleGrid}>
          {moduleOptions.map((option) => {
            const ModuleIcon = option.icon;
            const count = dueItems[option.value];
            const isSelected = selectedModules.includes(option.value);
            const isDisabled = count === 0;

            return (
              <button
                key={option.value}
                onClick={() => toggleModule(option.value)}
                disabled={isDisabled}
                className={`${styles.moduleButton} ${isSelected ? styles.selected : ''} ${isDisabled ? styles.disabled : ''}`}
              >
                <ModuleIcon className={styles.moduleIcon} />
                <span className={styles.moduleLabel}>{t(option.labelKey)}</span>
                <span className={styles.moduleCount}>
                  {t('review.config.due', { count })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <Text variant="label" color="muted" className={styles.sectionLabel}>
          {t('review.config.numberOfItems')}
        </Text>
        <div className={styles.countOptions}>
          {itemCountOptions.map((count) => (
            <button
              key={count}
              onClick={() => setItemCount(count)}
              className={`${styles.countButton} ${itemCount === count ? styles.selected : ''}`}
              disabled={count > availableItems}
            >
              {count}
            </button>
          ))}
        </div>
        {availableItems < itemCount && availableItems > 0 && (
          <Text variant="caption" color="muted" className={styles.availableNote}>
            {t('review.config.onlyItemsAvailable', { count: availableItems })}
          </Text>
        )}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <Text color="muted">{t('review.config.selectedModules')}</Text>
          <Text>{selectedModules.length}</Text>
        </div>
        <div className={styles.summaryRow}>
          <Text color="muted">{t('review.config.itemsToReview')}</Text>
          <Text color="gold">{effectiveItemCount}</Text>
        </div>
      </div>

      <Button
        onClick={handleStart}
        size="lg"
        fullWidth
        disabled={effectiveItemCount === 0}
        className={styles.startButton}
      >
        <IoPlay /> {t('review.config.startReview')}
      </Button>

      {dueItems.total === 0 && (
        <Text color="muted" className={styles.noItemsMessage}>
          {t('review.config.noItemsDue')}
        </Text>
      )}
    </Card>
  );
}
