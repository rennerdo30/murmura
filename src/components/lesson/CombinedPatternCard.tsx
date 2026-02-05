'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './CombinedPatternCard.module.css';

export interface CombinedPatternExample {
  primaryPattern: string;
  interleavedPattern: string;
  example: string;
  translation: string;
  breakdown?: string;
  reading?: string;
}

interface CombinedPatternCardProps {
  examples: CombinedPatternExample[];
  title?: string;
  onPlayAudio?: (text: string) => void;
}

export function CombinedPatternCard({
  examples,
  title = 'Combined Patterns',
  onPlayAudio,
}: CombinedPatternCardProps) {
  const { t } = useLanguage();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (examples.length === 0) {
    return null;
  }

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.badge}>Interleaved</span>
      </div>

      <p className={styles.subtitle}>
        See how the new grammar works together with patterns you&apos;ve learned before
      </p>

      <div className={styles.examples}>
        {examples.map((ex, idx) => (
          <div
            key={idx}
            className={`${styles.example} ${expandedIndex === idx ? styles.expanded : ''}`}
            onClick={() => toggleExpanded(idx)}
          >
            <div className={styles.patterns}>
              <span className={styles.patternNew}>{ex.primaryPattern}</span>
              <span className={styles.patternPlus}>+</span>
              <span className={styles.patternPrevious}>{ex.interleavedPattern}</span>
            </div>

            <div className={styles.sentence}>
              <div className={styles.exampleText}>{ex.example}</div>
              {ex.reading && (
                <div className={styles.reading}>{ex.reading}</div>
              )}
              <div className={styles.translation}>{ex.translation}</div>
            </div>

            {onPlayAudio && (
              <button
                className={styles.audioButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayAudio(ex.example);
                }}
                aria-label={t('common.listen')}
              >
                <span className={styles.audioIcon}>&#9658;</span>
              </button>
            )}

            {expandedIndex === idx && ex.breakdown && (
              <div className={styles.breakdown}>
                <div className={styles.breakdownLabel}>Structure breakdown:</div>
                <div className={styles.breakdownText}>{ex.breakdown}</div>
              </div>
            )}

            <div className={styles.expandHint}>
              {expandedIndex === idx ? 'Click to collapse' : 'Click to see breakdown'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CombinedPatternCard;
