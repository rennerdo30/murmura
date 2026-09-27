'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PageHeader from '@/components/common/PageHeader';
import { Container } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import languageConfigs from '@/data/language-configs.json';
import {
  IoTrophy,
  IoFlame,
  IoGlobe,
  IoChevronDown,
  IoEyeOff,
  IoEye,
  IoSparkles,
  IoMedal,
} from 'react-icons/io5';
import styles from './leaderboard.module.css';

type TimePeriod = 'daily' | 'weekly' | 'allTime';

interface LeaderboardEntry {
  rank: number;
  anonymousName: string;
  xp: number;
  streak: number;
  isCurrentUser: boolean;
}

interface XPBreakdown {
  anonymousName: string | null;
  total: number;
  breakdown: {
    studyTime?: number;
    accuracy?: number;
    streaks?: number;
    mastery?: number;
  };
  details: {
    studyMinutes?: number;
    totalCorrect?: number;
    currentStreak?: number;
    bestStreak?: number;
    wordsMastered?: number;
    kanjiMastered?: number;
    pointsMastered?: number;
    textsRead?: number;
    exercisesCompleted?: number;
  };
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const { targetLanguage } = useTargetLanguage();
  
  const periods: { id: TimePeriod; label: string }[] = useMemo(() => [
    { id: 'daily', label: t('leaderboard.periods.daily') },
    { id: 'weekly', label: t('leaderboard.periods.weekly') },
    { id: 'allTime', label: t('leaderboard.periods.allTime') },
  ], [t]);
  
  const languages = useMemo(() => [
    { code: '', name: t('leaderboard.global') || 'Global' },
    ...languageConfigs.availableLanguages.map(code => ({
      code,
      name: (languageConfigs.languages as Record<string, { name?: string }>)[code]?.name || code,
    })),
  ], [t]);

  const [period, setPeriod] = useState<TimePeriod>('allTime');
  const [languageFilter, setLanguageFilter] = useState<string>('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Convex queries and mutations
  const leaderboardData = useQuery(api.leaderboard.getLeaderboard, {
    period,
    language: languageFilter || undefined,
    limit: 50,
  });

  const myXPData = useQuery(api.leaderboard.getMyXPBreakdown);
  const visibility = useQuery(api.leaderboard.getLeaderboardVisibility);
  const setVisibility = useMutation(api.leaderboard.setLeaderboardVisibility);
  const getOrCreateName = useMutation(api.leaderboard.getOrCreateAnonymousName);

  // Ensure user has anonymous name when they visit
  useEffect(() => {
    if (myXPData && !myXPData.anonymousName) {
      getOrCreateName();
    }
  }, [myXPData, getOrCreateName]);

  // Format XP number
  const formatXP = (xp: number) => {
    if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
    if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
    return xp.toLocaleString();
  };

  // Get medal for top 3
  const getMedal = (rank: number) => {
    switch (rank) {
      case 1: return <IoMedal className={styles.goldMedal} role="img" aria-label={`#${rank}`} />;
      case 2: return <IoMedal className={styles.silverMedal} role="img" aria-label={`#${rank}`} />;
      case 3: return <IoMedal className={styles.bronzeMedal} role="img" aria-label={`#${rank}`} />;
      default: return null;
    }
  };

  // Get selected language name
  const selectedLanguageName = useMemo(() => {
    if (!languageFilter) return t('leaderboard.global') || (t('leaderboard.global') || 'Global');
    return languages.find(l => l.code === languageFilter)?.name || 'Global';
  }, [t, languageFilter, languages]);

  const isLoading = leaderboardData === undefined;

  const renderRow = (
    entry: Omit<LeaderboardEntry, 'anonymousName' | 'streak'> & { anonymousName: string | null; streak: number | null },
    showMedal: boolean,
  ) => (
    <>
      <div className={styles.rankCell}>
        {(showMedal && getMedal(entry.rank)) || <span className={styles.rankNumber}>#{entry.rank}</span>}
      </div>
      <div className={styles.nameCell}>
        <span className={styles.playerName}>{entry.anonymousName}</span>
        {entry.isCurrentUser && <span className={styles.youBadge}>{t('leaderboard.badges.you')}</span>}
      </div>
      <div className={styles.streakCell}>
        <IoFlame className={styles.streakIcon} aria-hidden="true" />
        <span>{entry.streak}</span>
      </div>
      <div className={styles.xpCell}>
        <span className={styles.xpAmount}>{formatXP(entry.xp)}</span>
        <span className={styles.xpSuffix}>XP</span>
      </div>
    </>
  );

  const xpRows: { key: keyof XPBreakdown['breakdown']; labelKey: string }[] = [
    { key: 'studyTime', labelKey: 'leaderboard.stats.studyTime' },
    { key: 'accuracy', labelKey: 'leaderboard.stats.accuracy' },
    { key: 'streaks', labelKey: 'leaderboard.stats.streaks' },
    { key: 'mastery', labelKey: 'leaderboard.stats.mastery' },
  ];

  return (
    <Container variant="dashboard">
      <PageHeader title={t('leaderboard.title')} subtitle={t('leaderboard.subtitle')} />

      {/* Toolbar: period + scope + visibility */}
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label={t('leaderboard.title')}>
          {periods.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`${styles.segment} ${period === id ? styles.segmentActive : ''}`}
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.toolbarEnd}>
          <div className={styles.languageDropdownContainer}>
            <button
              type="button"
              className={styles.languageDropdownButton}
              aria-haspopup="listbox"
              aria-expanded={showLanguageDropdown}
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowLanguageDropdown(false);
              }}
            >
              <IoGlobe aria-hidden="true" />
              <span className={styles.languageLabel}>{selectedLanguageName}</span>
              <IoChevronDown className={`${styles.chevron} ${showLanguageDropdown ? styles.rotated : ''}`} aria-hidden="true" />
            </button>
            {showLanguageDropdown && (
              <div
                className={styles.languageDropdown}
                role="listbox"
                aria-label={selectedLanguageName}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowLanguageDropdown(false);
                }}
              >
                {languages.map(({ code, name }) => (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={languageFilter === code}
                    className={`${styles.languageOption} ${languageFilter === code ? styles.selected : ''}`}
                    onClick={() => {
                      setLanguageFilter(code);
                      setShowLanguageDropdown(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Visibility Toggle */}
          {visibility !== undefined && (
            <button
              type="button"
              onClick={() => setVisibility({ visible: !visibility })}
              className={styles.visibilityButton}
              aria-pressed={visibility}
            >
              {visibility ? <IoEye aria-hidden="true" /> : <IoEyeOff aria-hidden="true" />}
              <span>{visibility ? t('settings.leaderboard.visible') : t('settings.leaderboard.hidden')}</span>
            </button>
          )}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* Leaderboard List */}
          <div className={styles.listCard}>
            {isLoading ? (
              <p className={styles.loading} role="status" aria-live="polite">{t('leaderboard.empty.loading')}</p>
            ) : leaderboardData?.entries.length === 0 ? (
              <div className={styles.emptyState}>
                <IoTrophy className={styles.emptyIcon} aria-hidden="true" />
                <h2 className={styles.emptyTitle}>{t('leaderboard.empty.noEntries')}</h2>
                <p className={styles.emptyText}>
                  {period === 'daily' ? t('leaderboard.empty.daily') :
                   period === 'weekly' ? t('leaderboard.empty.weekly') :
                   t('leaderboard.empty.allTime')}
                </p>
              </div>
            ) : (
              <ol className={styles.leaderboardList}>
                {leaderboardData?.entries.map((entry) => (
                  <li
                    key={`${entry.rank}-${entry.anonymousName}`}
                    className={`${styles.leaderboardRow} ${entry.isCurrentUser ? styles.currentUser : ''}`}
                    aria-current={entry.isCurrentUser ? 'true' : undefined}
                  >
                    {renderRow(entry, true)}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Current User Outside Top 50 */}
          {leaderboardData?.currentUserRank &&
           !leaderboardData.entries.find(e => e.isCurrentUser) && (
            <div className={styles.currentUserOutside}>
              <p className={styles.outsideLabel}>{t('leaderboard.stats.position')}</p>
              <div className={`${styles.leaderboardRow} ${styles.currentUser}`}>
                {renderRow({ ...leaderboardData.currentUserRank, isCurrentUser: true }, false)}
              </div>
            </div>
          )}
        </div>

        {/* My Stats Card */}
        {myXPData && (
          <aside className={styles.aside}>
            <section className={styles.myStatsCard} aria-labelledby="leaderboard-my-stats">
              <div className={styles.myStatsHeader}>
                <span className={styles.myStatsIcon} aria-hidden="true"><IoSparkles /></span>
                <div className={styles.myStatsTitles}>
                  <h2 id="leaderboard-my-stats" className={styles.sectionTitle}>{t('leaderboard.stats.title')}</h2>
                  <span className={styles.anonymousName}>
                    {myXPData.anonymousName || t('leaderboard.generating')}
                  </span>
                </div>
              </div>

              {leaderboardData?.currentUserRank && (
                <div className={styles.myRank}>
                  <span className={styles.myRankLabel}>{t('leaderboard.stats.rank')}</span>
                  <span className={styles.myRankValue}>#{leaderboardData.currentUserRank.rank}</span>
                  <span className={styles.myRankMeta}>
                    {t('leaderboard.stats.participants', { count: leaderboardData.totalParticipants })}
                  </span>
                </div>
              )}

              <dl className={styles.xpBreakdown}>
                {xpRows.map(({ key, labelKey }) => (
                  <div key={key} className={styles.xpRow}>
                    <dt className={styles.xpLabel}>{t(labelKey)}</dt>
                    <dd className={styles.xpValue}>{formatXP(myXPData.breakdown[key] ?? 0)} XP</dd>
                  </div>
                ))}
                <div className={`${styles.xpRow} ${styles.xpTotal}`}>
                  <dt className={styles.xpLabel}>{t('leaderboard.stats.total')}</dt>
                  <dd className={styles.xpTotalValue}>{formatXP(myXPData.total)} XP</dd>
                </div>
              </dl>
            </section>
          </aside>
        )}
      </div>
    </Container>
  );
}
