'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  IoWarning,
  IoSchool,
  IoTime,
  IoLayers,
  IoHelpCircle,
  IoHome,
  IoMap,
  IoPlay,
} from 'react-icons/io5';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Container, Button, Spinner } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { getPlacementTest } from '@/lib/dataLoader';
import { getLanguageName, formatList } from '@/lib/languageNames';
import styles from './placement.module.css';
import PlacementTest from './PlacementTest';
import PlacementResults from './PlacementResults';
import type { Assessment, AssessmentResult } from '@/types/assessment';

type Phase = 'intro' | 'test' | 'results';

/** Where "start learning" and "skip" lead: the learning path overview. */
const PATHS_HREF = '/paths';
const DASHBOARD_HREF = '/';
const SKILL_KEY_PREFIX = 'assessment.placement.skills.';

function PlacementContent() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { targetLanguage } = useTargetLanguage();
  const [phase, setPhase] = useState<Phase>('intro');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Load the placement test for the current target language
  useEffect(() => {
    let cancelled = false;

    async function loadAssessment() {
      setLoading(true);
      setLoadFailed(false);
      setPhase('intro');
      setResult(null);
      try {
        const placementTest = await getPlacementTest(targetLanguage);
        if (!cancelled) {
          setAssessment(placementTest);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load placement test:', err);
          setAssessment(null);
          setLoadFailed(true);
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
  }, [targetLanguage]);

  // Only count sections that actually contain questions
  const sections = useMemo(
    () => (assessment?.sections ?? []).filter(section => section.questions.length > 0),
    [assessment]
  );
  const questionCount = useMemo(
    () => sections.reduce((sum, section) => sum + section.questions.length, 0),
    [sections]
  );
  const hasTest = assessment !== null && questionCount > 0;

  const skillList = useMemo(() => {
    const names = sections.map(section => {
      const key = `${SKILL_KEY_PREFIX}${section.skill}`;
      const translated = t(key);
      return translated === key ? section.name : translated;
    });
    return formatList(Array.from(new Set(names)), language);
  }, [sections, t, language]);

  const handleStartTest = useCallback(() => {
    setPhase('test');
  }, []);

  const handleTestComplete = useCallback((testResult: AssessmentResult) => {
    setResult(testResult);
    setPhase('results');
  }, []);

  const handleStartLearning = useCallback(() => {
    router.push(PATHS_HREF);
  }, [router]);

  const handleRetakeTest = useCallback(() => {
    setResult(null);
    setPhase('intro');
  }, []);

  const header = (
    <PageHeader
      title={t('assessment.placement.title')}
      subtitle={t('assessment.placement.description')}
    />
  );

  if (loading) {
    return (
      <Container variant="dashboard">
        {header}
        <div className={styles.loading} role="status" aria-live="polite">
          <Spinner size="lg" />
          <p>{t('assessment.placement.loading')}</p>
        </div>
      </Container>
    );
  }

  if (loadFailed) {
    return (
      <Container variant="dashboard">
        {header}
        <EmptyState
          icon={<IoWarning />}
          title={t('placement.loadError.title')}
          text={t('placement.loadError.text')}
          actions={
            <Button href={DASHBOARD_HREF} variant="secondary">
              <IoHome aria-hidden="true" />
              {t('common.dashboard')}
            </Button>
          }
        />
      </Container>
    );
  }

  if (!hasTest || !assessment) {
    return (
      <Container variant="dashboard">
        {header}
        <EmptyState
          icon={<IoSchool />}
          title={t('placement.unavailable.title')}
          text={t('placement.unavailable.text', { language: getLanguageName(targetLanguage, t) })}
          actions={
            <>
              <Button href={DASHBOARD_HREF} variant="primary">
                <IoHome aria-hidden="true" />
                {t('common.dashboard')}
              </Button>
              <Button href={PATHS_HREF} variant="secondary">
                <IoMap aria-hidden="true" />
                {t('nav.paths')}
              </Button>
            </>
          }
        />
      </Container>
    );
  }

  if (phase === 'test') {
    return (
      <Container variant="dashboard">
        <PlacementTest
          assessment={assessment}
          onComplete={handleTestComplete}
          onCancel={() => setPhase('intro')}
        />
      </Container>
    );
  }

  if (phase === 'results' && result) {
    return (
      <Container variant="dashboard">
        <PlacementResults
          result={result}
          onStartLearning={handleStartLearning}
          onRetake={handleRetakeTest}
        />
      </Container>
    );
  }

  const facts = [
    {
      id: 'time',
      icon: <IoTime />,
      value: t('assessment.placement.minutes', { count: assessment.estimatedMinutes }),
      label: t('assessment.placement.estimatedTime'),
      show: assessment.estimatedMinutes > 0,
    },
    {
      id: 'sections',
      icon: <IoLayers />,
      value: t('assessment.placement.sections', { count: sections.length }),
      label: skillList,
      show: true,
    },
    {
      id: 'questions',
      icon: <IoHelpCircle />,
      value: t('placement.questionCount', { count: questionCount }),
      label: t('placement.questionCountLabel'),
      show: true,
    },
  ].filter(fact => fact.show);

  return (
    <Container variant="dashboard">
      {header}

      <div className={styles.intro}>
        <dl className={styles.facts}>
          {facts.map(fact => (
            <div key={fact.id} className={styles.fact}>
              <span className={styles.factIcon} aria-hidden="true">{fact.icon}</span>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={styles.factValue}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        <section className={styles.panel} aria-labelledby="placement-how-title">
          <h2 id="placement-how-title" className={styles.sectionTitle}>
            {t('assessment.placement.howItWorks')}
          </h2>
          <ol className={styles.steps}>
            {(['step1', 'step2', 'step3', 'step4'] as const).map((step, index) => (
              <li key={step} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                <span>{t(`assessment.placement.${step}`)}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className={styles.actions}>
          <Button onClick={handleStartTest} variant="primary" size="lg">
            <IoPlay aria-hidden="true" />
            {t('assessment.placement.startButton')}
          </Button>
          <Button href={PATHS_HREF} variant="ghost">
            {t('assessment.placement.skipButton')}
          </Button>
        </div>
      </div>
    </Container>
  );
}

export default function PlacementPage() {
  return (
    <ErrorBoundary>
      <PlacementContent />
    </ErrorBoundary>
  );
}
