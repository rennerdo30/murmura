'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IoWarning } from 'react-icons/io5';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { getPlacementTest } from '@/lib/dataLoader';
import styles from './placement.module.css';
import PlacementTest from './PlacementTest';
import PlacementResults from './PlacementResults';
import type { Assessment, AssessmentResult } from '@/types/assessment';

type Phase = 'intro' | 'test' | 'results';

export default function PlacementPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { targetLanguage } = useTargetLanguage();
  const [phase, setPhase] = useState<Phase>('intro');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load assessment data
  useEffect(() => {
    let cancelled = false;

    async function loadAssessment() {
      setLoading(true);
      setError(null);
      try {
        const placementTest = await getPlacementTest(targetLanguage);
        if (!cancelled) {
          setAssessment(placementTest);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load assessment:', err);
          setError(t('assessment.placement.error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [targetLanguage, t]);

  const handleStartTest = useCallback(() => {
    setPhase('test');
  }, []);

  const handleTestComplete = useCallback((testResult: AssessmentResult) => {
    setResult(testResult);
    setPhase('results');
  }, []);

  const handleStartLearning = useCallback((recommendedPath: string) => {
    // Navigate to the recommended learning path
    router.push(`/learn/${recommendedPath}`);
  }, [router]);

  const handleRetakeTest = useCallback(() => {
    setResult(null);
    setPhase('intro');
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>{t('assessment.placement.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <IoWarning style={{ fontSize: '2rem', color: 'var(--accent-red-light, #ff6b6b)' }} />
          <h2>{t('assessment.placement.error')}</h2>
          <p>{error}</p>
          <button onClick={() => router.back()}>{t('assessment.placement.goBack')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {phase === 'intro' && (
        <div className={styles.intro}>
          <div className={styles.introIcon}>&#128218;</div>
          <h1>{t('assessment.placement.title')}</h1>
          <p className={styles.introText}>
            {t('assessment.placement.description')}
          </p>

          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>&#9201;</span>
              <div>
                <strong>{t('assessment.placement.minutes', { count: assessment?.estimatedMinutes || 15 })}</strong>
                <span>{t('assessment.placement.estimatedTime')}</span>
              </div>
            </div>
            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>&#128221;</span>
              <div>
                <strong>{t('assessment.placement.sections', { count: assessment?.sections?.length || 4 })}</strong>
                <span>{t('assessment.placement.sectionTypes')}</span>
              </div>
            </div>
            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>&#127919;</span>
              <div>
                <strong>{t('assessment.placement.adaptive')}</strong>
                <span>{t('assessment.placement.adaptiveDesc')}</span>
              </div>
            </div>
          </div>

          <div className={styles.instructions}>
            <h3>{t('assessment.placement.howItWorks')}</h3>
            <ol>
              <li>{t('assessment.placement.step1')}</li>
              <li>{t('assessment.placement.step2')}</li>
              <li>{t('assessment.placement.step3')}</li>
              <li>{t('assessment.placement.step4')}</li>
            </ol>
          </div>

          <button className={styles.startButton} onClick={handleStartTest}>
            {t('assessment.placement.startButton')}
          </button>

          <button
            className={styles.skipButton}
            onClick={() => router.push('/learn')}
          >
            {t('assessment.placement.skipButton')}
          </button>
        </div>
      )}

      {phase === 'test' && assessment && (
        <PlacementTest
          assessment={assessment}
          onComplete={handleTestComplete}
          onCancel={() => setPhase('intro')}
        />
      )}

      {phase === 'test' && !assessment && (
        <PlacementTest
          assessment={null}
          onComplete={handleTestComplete}
          onCancel={() => setPhase('intro')}
        />
      )}

      {phase === 'results' && result && (
        <PlacementResults
          result={result}
          onStartLearning={handleStartLearning}
          onRetake={handleRetakeTest}
        />
      )}
    </div>
  );
}
