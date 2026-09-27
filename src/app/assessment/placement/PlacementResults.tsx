'use client';

import { IoRibbon, IoPlay, IoRefresh, IoBulb } from 'react-icons/io5';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import styles from './PlacementResults.module.css';
import type { AssessmentResult, SectionScore } from '@/types/assessment';

interface PlacementResultsProps {
  result: AssessmentResult;
  onStartLearning: (path: string) => void;
  onRetake: () => void;
}

const FULL_PERCENT = 100;
const SKILL_KEY_PREFIX = 'assessment.placement.skills.';
const LEVEL_KEY_PREFIX = 'assessment.placement.levels.';
const TIP_KEYS = ['tip1', 'tip2', 'tip3', 'tip4'] as const;

export default function PlacementResults({
  result,
  onStartLearning,
  onRetake,
}: PlacementResultsProps) {
  const { t, language } = useLanguage();
  const { levels } = useTargetLanguage();

  // Prefer translated level texts, then the target language's level config, then the raw id
  const levelKey = `${LEVEL_KEY_PREFIX}${result.recommendedLevel.toLowerCase()}`;
  const levelConfig = levels.find(level => level.id.toLowerCase() === result.recommendedLevel.toLowerCase());
  const translatedName = t(`${levelKey}.name`);
  const translatedDescription = t(`${levelKey}.description`);
  const levelName = translatedName !== `${levelKey}.name`
    ? translatedName
    : levelConfig?.name ?? result.recommendedLevel;
  const levelDescription = translatedDescription !== `${levelKey}.description`
    ? translatedDescription
    : levelConfig?.description ?? '';

  const percent = Math.max(0, Math.min(FULL_PERCENT, result.percentScore));
  const percentFormatter = new Intl.NumberFormat(language, { style: 'percent' });

  return (
    <div className={styles.container}>
      <PageHeader
        title={t('assessment.placement.results.title')}
        subtitle={t('assessment.placement.results.subtitle')}
      />

      {/* Recommended level + overall score */}
      <section className={styles.summary} aria-labelledby="placement-level-title">
        <div
          className={styles.scoreCircle}
          style={{ background: `conic-gradient(var(--accent-gold) ${percent}%, var(--surface-overlay-strong) 0)` }}
          role="img"
          aria-label={t('placement.overallScoreAria', { score: percentFormatter.format(percent / FULL_PERCENT) })}
        >
          <div className={styles.scoreInner}>
            <span className={styles.scoreNumber}>{percentFormatter.format(percent / FULL_PERCENT)}</span>
          </div>
        </div>
        <div className={styles.summaryText}>
          <p className={styles.eyebrow}>
            <IoRibbon aria-hidden="true" /> {t('assessment.placement.results.recommendedLevel')}
          </p>
          <h2 id="placement-level-title" className={styles.levelName}>{levelName}</h2>
          {levelDescription && <p className={styles.levelDescription}>{levelDescription}</p>}
          <p className={styles.scoreLabel}>{t('assessment.placement.results.overallScore')}</p>
        </div>
      </section>

      {/* Skills breakdown */}
      <section className={styles.panel} aria-labelledby="placement-skills-title">
        <h2 id="placement-skills-title" className={styles.sectionTitle}>
          {t('assessment.placement.results.skillsBreakdown')}
        </h2>
        <ul className={styles.skillBars}>
          {Object.entries(result.sectionScores).map(([skill, scoreData]: [string, SectionScore]) => {
            const key = `${SKILL_KEY_PREFIX}${skill}`;
            const translated = t(key);
            const skillName = translated === key ? skill : translated;
            return (
              <li key={skill} className={styles.skillBar}>
                <div className={styles.skillInfo}>
                  <span className={styles.skillName}>{skillName}</span>
                  <span className={styles.skillScore}>{percentFormatter.format(scoreData.percent / FULL_PERCENT)}</span>
                </div>
                <div
                  className={styles.barContainer}
                  role="progressbar"
                  aria-valuenow={scoreData.percent}
                  aria-valuemin={0}
                  aria-valuemax={FULL_PERCENT}
                  aria-label={skillName}
                >
                  <div className={styles.barFill} style={{ width: `${scoreData.percent}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className={styles.actions}>
        <Button variant="primary" size="lg" onClick={() => onStartLearning(result.recommendedPath)}>
          <IoPlay aria-hidden="true" />
          {t('assessment.placement.results.startLearning', { level: levelName })}
        </Button>
        <Button variant="secondary" onClick={onRetake}>
          <IoRefresh aria-hidden="true" />
          {t('assessment.placement.results.retakeTest')}
        </Button>
      </div>

      <section className={styles.panel} aria-labelledby="placement-tips-title">
        <h2 id="placement-tips-title" className={styles.sectionTitle}>
          <IoBulb className={styles.sectionIcon} aria-hidden="true" />
          {t('assessment.placement.results.tipsTitle')}
        </h2>
        <ul className={styles.tips}>
          {TIP_KEYS.map(tip => (
            <li key={tip}>{t(`assessment.placement.results.${tip}`)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
