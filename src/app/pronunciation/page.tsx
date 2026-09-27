'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  IoMic,
  IoEar,
  IoChatbubbles,
  IoChevronBack,
  IoChevronForward,
  IoHome,
} from 'react-icons/io5';
import styles from './pronunciation.module.css';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Container, Button, Spinner } from '@/components/ui';
import { Shadowing, MinimalPair, ListenRepeat } from '@/components/exercises';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { getLanguageName } from '@/lib/languageNames';
import type {
  PronunciationDrill,
  DrillType,
  Difficulty,
  ShadowingContent,
  MinimalPairContent,
  ListenRepeatContent,
} from '@/types/pronunciation';

/** Drill types this page can play (pitch accent drills have no player yet). */
type SupportedDrillType = Exclude<DrillType, 'pitch_accent'>;
type SupportedDrill = PronunciationDrill & { type: SupportedDrillType };
type TypeFilter = SupportedDrillType | 'all';
type DifficultyFilter = Difficulty | 'all';

const DRILLS_FILE = 'pronunciation.json';
/** The built-in sample drills below are Japanese and only shown for Japanese. */
const SAMPLE_DRILLS_LANGUAGE = 'ja';
const DASHBOARD_HREF = '/';

const DRILL_TYPES: SupportedDrillType[] = ['shadowing', 'minimal_pair', 'listen_repeat'];
const DIFFICULTIES: DifficultyFilter[] = ['all', 'easy', 'medium', 'hard'];

const DRILL_ICONS: Record<SupportedDrillType, ReactNode> = {
  shadowing: <IoMic />,
  minimal_pair: <IoEar />,
  listen_repeat: <IoChatbubbles />,
};

// Built-in Japanese sample drills, used when no data file exists for Japanese
const SAMPLE_DRILLS: SupportedDrill[] = [
  {
    id: '1',
    type: 'minimal_pair',
    level: 'N5',
    title: 'Long vs Short Vowels',
    description: 'Practice distinguishing long and short vowel sounds',
    content: {
      pairs: [
        {
          word1: 'おばさん',
          word1Meaning: 'aunt',
          word2: 'おばあさん',
          word2Meaning: 'grandmother',
          distinction: 'long vs short vowel (a)',
          explanation: 'The double あ makes the vowel sound longer',
        },
        {
          word1: 'ここ',
          word1Meaning: 'here',
          word2: 'こうこう',
          word2Meaning: 'high school',
          distinction: 'long vs short vowel (o)',
          explanation: 'The う extends the お sound',
        },
      ],
      category: 'long_vowels',
    } as MinimalPairContent,
    difficulty: 'easy',
  },
  {
    id: '2',
    type: 'shadowing',
    level: 'N5',
    title: 'Basic Greetings',
    description: 'Shadow common Japanese greetings',
    content: {
      text: 'おはようございます。今日はいい天気ですね。',
      reading: 'おはようございます。きょうはいいてんきですね。',
      translation: 'Good morning. The weather is nice today, isn\'t it?',
      audioUrl: '',
      segments: [
        { start: 0, end: 2000, text: 'おはようございます', reading: 'おはようございます', translation: 'Good morning' },
        { start: 2000, end: 5000, text: '今日はいい天気ですね', reading: 'きょうはいいてんきですね', translation: 'The weather is nice today' },
      ],
      speed: 'normal',
    } as ShadowingContent,
    difficulty: 'easy',
  },
  {
    id: '3',
    type: 'listen_repeat',
    level: 'N5',
    title: 'Self-Introduction Phrases',
    description: 'Practice common self-introduction phrases',
    content: {
      phrases: [
        { text: '私の名前は田中です', reading: 'わたしのなまえはたなかです', translation: 'My name is Tanaka', audioUrl: '', pauseDuration: 3000 },
        { text: 'よろしくお願いします', reading: 'よろしくおねがいします', translation: 'Nice to meet you', audioUrl: '', pauseDuration: 3000 },
        { text: '日本語を勉強しています', reading: 'にほんごをべんきょうしています', translation: 'I am studying Japanese', audioUrl: '', pauseDuration: 3000 },
      ],
      repeatCount: 2,
    } as ListenRepeatContent,
    difficulty: 'easy',
  },
];

interface DrillsFile {
  drills?: PronunciationDrill[];
}

function isSupportedDrill(drill: PronunciationDrill): drill is SupportedDrill {
  return (DRILL_TYPES as string[]).includes(drill.type);
}

/** Accepts either `{ drills: [...] }` or a bare array; drops drill types without a player. */
function parseDrills(data: unknown): SupportedDrill[] {
  let drills: PronunciationDrill[] = [];
  if (Array.isArray(data)) {
    drills = data as PronunciationDrill[];
  } else if (data && typeof data === 'object' && Array.isArray((data as DrillsFile).drills)) {
    drills = (data as DrillsFile).drills ?? [];
  }
  return drills.filter(isSupportedDrill);
}

function PronunciationContent() {
  const { t } = useLanguage();
  const { targetLanguage, getDataUrl } = useTargetLanguage();
  const [drills, setDrills] = useState<SupportedDrill[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<SupportedDrill | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [loading, setLoading] = useState(true);

  // Load drills for the current target language
  useEffect(() => {
    let cancelled = false;
    const fallback = targetLanguage === SAMPLE_DRILLS_LANGUAGE ? SAMPLE_DRILLS : [];

    async function loadDrills() {
      setLoading(true);
      setSelectedDrill(null);
      setTypeFilter('all');
      setDifficultyFilter('all');
      let loaded: SupportedDrill[] = [];
      try {
        const response = await fetch(getDataUrl(DRILLS_FILE));
        if (response.ok) {
          loaded = parseDrills(await response.json());
        }
      } catch (err) {
        console.error('Failed to load pronunciation drills:', err);
      }
      if (!cancelled) {
        setDrills(loaded.length > 0 ? loaded : fallback);
        setLoading(false);
      }
    }

    loadDrills();
    return () => {
      cancelled = true;
    };
  }, [targetLanguage, getDataUrl]);

  const filteredDrills = useMemo(() => {
    return drills.filter(drill => {
      if (typeFilter !== 'all' && drill.type !== typeFilter) return false;
      if (difficultyFilter !== 'all' && drill.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [drills, typeFilter, difficultyFilter]);

  const drillCounts = useMemo(() => {
    const counts: Record<SupportedDrillType, number> = { shadowing: 0, minimal_pair: 0, listen_repeat: 0 };
    drills.forEach(drill => {
      counts[drill.type] += 1;
    });
    return counts;
  }, [drills]);

  const filtersActive = typeFilter !== 'all' || difficultyFilter !== 'all';

  const clearFilters = useCallback(() => {
    setTypeFilter('all');
    setDifficultyFilter('all');
  }, []);

  const toggleType = useCallback((type: SupportedDrillType) => {
    setTypeFilter(prev => (prev === type ? 'all' : type));
  }, []);

  const handleDrillComplete = useCallback(() => {
    setSelectedDrill(null);
  }, []);

  const header = (
    <PageHeader title={t('pronunciation.title')} subtitle={t('pronunciation.subtitle')} />
  );

  if (selectedDrill) {
    return (
      <Container variant="dashboard">
        <button type="button" className={styles.back} onClick={() => setSelectedDrill(null)}>
          <IoChevronBack aria-hidden="true" />
          <span>{t('pronunciation.backToDrills')}</span>
        </button>
        <PageHeader title={selectedDrill.title} subtitle={selectedDrill.description} />

        <div className={styles.drillContainer}>
          {selectedDrill.type === 'shadowing' && (
            <Shadowing
              content={selectedDrill.content as ShadowingContent}
              onComplete={handleDrillComplete}
            />
          )}

          {selectedDrill.type === 'minimal_pair' && (
            <MinimalPair
              pairs={(selectedDrill.content as MinimalPairContent).pairs}
              onComplete={handleDrillComplete}
            />
          )}

          {selectedDrill.type === 'listen_repeat' && (
            <ListenRepeat
              phrases={(selectedDrill.content as ListenRepeatContent).phrases}
              repeatCount={(selectedDrill.content as ListenRepeatContent).repeatCount}
              onComplete={handleDrillComplete}
            />
          )}
        </div>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container variant="dashboard">
        {header}
        <div className={styles.loading} role="status" aria-live="polite">
          <Spinner size="lg" />
          <p>{t('pronunciation.loading')}</p>
        </div>
      </Container>
    );
  }

  if (drills.length === 0) {
    return (
      <Container variant="dashboard">
        {header}
        <EmptyState
          icon={<IoMic />}
          title={t('pronunciation.empty.title')}
          text={t('pronunciation.empty.text', { language: getLanguageName(targetLanguage, t) })}
          actions={
            <Button href={DASHBOARD_HREF} variant="primary">
              <IoHome aria-hidden="true" />
              {t('common.dashboard')}
            </Button>
          }
        />
      </Container>
    );
  }

  return (
    <Container variant="dashboard">
      {header}

      <div className={styles.layout}>
        {/* Drill types double as the type filter */}
        <section aria-labelledby="pronunciation-types-title">
          <h2 id="pronunciation-types-title" className={styles.sectionTitle}>
            {t('pronunciation.filters.type')}
          </h2>
          <ul className={styles.categories}>
            {DRILL_TYPES.map(type => {
              const active = typeFilter === type;
              return (
                <li key={type}>
                  <button
                    type="button"
                    className={`${styles.categoryCard} ${active ? styles.categoryActive : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleType(type)}
                  >
                    <span className={styles.iconTile} aria-hidden="true">{DRILL_ICONS[type]}</span>
                    <span className={styles.categoryBody}>
                      <span className={styles.categoryTitle}>{t(`pronunciation.types.${type}`)}</span>
                      <span className={styles.categoryText}>{t(`pronunciation.typeDescriptions.${type}`)}</span>
                      <span className={styles.categoryCount}>
                        {t('pronunciation.drillCount', { count: drillCounts[type] })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="pronunciation-drills-title">
          <div className={styles.listHeader}>
            <h2 id="pronunciation-drills-title" className={styles.sectionTitle}>
              {t('pronunciation.drillsTitle')}
            </h2>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                {t('pronunciation.clearFilters')}
              </Button>
            )}
          </div>

          <div className={styles.chipRow} role="group" aria-label={t('pronunciation.filters.difficulty')}>
            {DIFFICULTIES.map(difficulty => (
              <button
                key={difficulty}
                type="button"
                className={`${styles.chip} ${difficultyFilter === difficulty ? styles.chipActive : ''}`}
                aria-pressed={difficultyFilter === difficulty}
                onClick={() => setDifficultyFilter(difficulty)}
              >
                {t(`pronunciation.difficulty.${difficulty}`)}
              </button>
            ))}
          </div>

          {filteredDrills.length === 0 ? (
            <EmptyState
              headingLevel="h3"
              icon={<IoEar />}
              title={t('pronunciation.noResults')}
              actions={
                <Button variant="secondary" onClick={clearFilters}>
                  {t('pronunciation.clearFilters')}
                </Button>
              }
            />
          ) : (
            <ul className={styles.drillList}>
              {filteredDrills.map(drill => (
                <li key={drill.id}>
                  <button type="button" className={styles.drillRow} onClick={() => setSelectedDrill(drill)}>
                    <span className={styles.iconTile} aria-hidden="true">{DRILL_ICONS[drill.type]}</span>
                    <span className={styles.drillInfo}>
                      <span className={styles.drillTitle}>{drill.title}</span>
                      {drill.description && <span className={styles.drillText}>{drill.description}</span>}
                      <span className={styles.drillMeta}>
                        <span className={styles.tag}>{t(`pronunciation.types.${drill.type}`)}</span>
                        {drill.level && <span className={styles.tag}>{drill.level}</span>}
                        <span className={styles.tag}>{t(`pronunciation.difficulty.${drill.difficulty}`)}</span>
                      </span>
                    </span>
                    <IoChevronForward className={styles.chevron} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}

export default function PronunciationPage() {
  return (
    <ErrorBoundary>
      <PronunciationContent />
    </ErrorBoundary>
  );
}
