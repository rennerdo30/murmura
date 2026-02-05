'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IoWarning } from 'react-icons/io5';
import styles from './placement.module.css';
import PlacementTest from './PlacementTest';
import PlacementResults from './PlacementResults';
import type { Assessment, AssessmentResult } from '@/types/assessment';

type Phase = 'intro' | 'test' | 'results';

export default function PlacementPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load assessment data
  useEffect(() => {
    async function loadAssessment() {
      try {
        // Try to load from public data - adjust path as needed
        const response = await fetch('/data/ja/assessments.json');
        if (response.ok) {
          const data = await response.json();
          // Find placement test
          const placementTest = data.assessments?.find(
            (a: Assessment) => a.type === 'placement'
          );
          if (placementTest) {
            setAssessment(placementTest);
          }
        }
      } catch (err) {
        console.error('Failed to load assessment:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAssessment();
  }, []);

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
          <p>Loading placement test...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <IoWarning style={{ fontSize: '2rem', color: 'var(--accent-red-light, #ff6b6b)' }} />
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.back()}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {phase === 'intro' && (
        <div className={styles.intro}>
          <div className={styles.introIcon}>&#128218;</div>
          <h1>Placement Test</h1>
          <p className={styles.introText}>
            Find out your current level and get personalized learning recommendations.
          </p>

          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>&#9201;</span>
              <div>
                <strong>{assessment?.estimatedMinutes || 15} minutes</strong>
                <span>Estimated time</span>
              </div>
            </div>
            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>&#128221;</span>
              <div>
                <strong>{assessment?.sections?.length || 4} sections</strong>
                <span>Vocabulary, Grammar, Reading, Listening</span>
              </div>
            </div>
            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>&#127919;</span>
              <div>
                <strong>Adaptive</strong>
                <span>Questions adjust to your level</span>
              </div>
            </div>
          </div>

          <div className={styles.instructions}>
            <h3>How it works</h3>
            <ol>
              <li>Answer questions across different skill areas</li>
              <li>Take your time - accuracy matters more than speed</li>
              <li>Get your recommended starting level</li>
              <li>Begin your personalized learning journey</li>
            </ol>
          </div>

          <button className={styles.startButton} onClick={handleStartTest}>
            Start Placement Test
          </button>

          <button
            className={styles.skipButton}
            onClick={() => router.push('/learn')}
          >
            Skip and start from the beginning
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
