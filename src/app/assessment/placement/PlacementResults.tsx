'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './PlacementResults.module.css';
import type { AssessmentResult, SectionScore } from '@/types/assessment';

interface PlacementResultsProps {
  result: AssessmentResult;
  onStartLearning: (path: string) => void;
  onRetake: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  N5: '#4ADE80',
  N4: '#60A5FA',
  N3: '#A855F7',
  N2: '#F59E0B',
  N1: '#EF4444',
};

export default function PlacementResults({
  result,
  onStartLearning,
  onRetake,
}: PlacementResultsProps) {
  const { t } = useLanguage();

  const levelKey = result.recommendedLevel.toLowerCase();
  const levelColor = LEVEL_COLORS[result.recommendedLevel] ?? '#4ADE80';
  const levelName = t(`assessment.placement.levels.${levelKey}.name`);
  const levelDescription = t(`assessment.placement.levels.${levelKey}.description`);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ADE80';
    if (score >= 60) return '#60A5FA';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className={styles.container}>
      {/* Celebration */}
      <div className={styles.celebration}>
        <div className={styles.celebrationIcon}>&#127881;</div>
        <h1>{t('assessment.placement.results.title')}</h1>
        <p>{t('assessment.placement.results.subtitle')}</p>
      </div>

      {/* Overall Score */}
      <div className={styles.scoreCard}>
        <div
          className={styles.scoreCircle}
          style={{
            background: `conic-gradient(${getScoreColor(result.totalScore)} ${result.totalScore}%, rgba(255,255,255,0.1) 0)`,
          }}
        >
          <div className={styles.scoreInner}>
            <span className={styles.scoreNumber}>{result.totalScore}</span>
            <span className={styles.scorePercent}>%</span>
          </div>
        </div>
        <div className={styles.scoreLabel}>{t('assessment.placement.results.overallScore')}</div>
      </div>

      {/* Section Scores */}
      <div className={styles.sectionScores}>
        <h3>{t('assessment.placement.results.skillsBreakdown')}</h3>
        <div className={styles.skillBars}>
          {Object.entries(result.sectionScores).map(([skill, scoreData]: [string, SectionScore]) => {
            const skillName = t(`assessment.placement.skills.${skill}`);
            return (
              <div key={skill} className={styles.skillBar}>
                <div className={styles.skillInfo}>
                  <span className={styles.skillName}>
                    {skillName.startsWith('assessment.') ? skill : skillName}
                  </span>
                  <span className={styles.skillScore}>{scoreData.percent}%</span>
                </div>
                <div className={styles.barContainer}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${scoreData.percent}%`,
                      backgroundColor: getScoreColor(scoreData.percent),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended Level */}
      <div
        className={styles.recommendationCard}
        style={{ borderColor: levelColor }}
      >
        <div className={styles.recommendationHeader}>
          <span className={styles.recommendationIcon}>&#127919;</span>
          <h3>{t('assessment.placement.results.recommendedLevel')}</h3>
        </div>
        <div
          className={styles.levelBadge}
          style={{ backgroundColor: `${levelColor}20`, color: levelColor }}
        >
          {levelName}
        </div>
        <p className={styles.levelDescription}>{levelDescription}</p>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.startButton}
          onClick={() => onStartLearning(result.recommendedPath)}
        >
          {t('assessment.placement.results.startLearning', { level: result.recommendedLevel })}
        </button>
        <button className={styles.retakeButton} onClick={onRetake}>
          {t('assessment.placement.results.retakeTest')}
        </button>
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <h4>{t('assessment.placement.results.tipsTitle')}</h4>
        <ul>
          <li>{t('assessment.placement.results.tip1')}</li>
          <li>{t('assessment.placement.results.tip2')}</li>
          <li>{t('assessment.placement.results.tip3')}</li>
          <li>{t('assessment.placement.results.tip4')}</li>
        </ul>
      </div>
    </div>
  );
}
