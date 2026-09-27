'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/common/PageHeader';
import { Container, Button } from '@/components/ui';
import { useRecommendations } from '@/hooks/useRecommendations';
import { usePathProgress } from '@/hooks/usePathProgress';
import { useLanguage } from '@/context/LanguageProvider';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import {
  IoRocket,
  IoSchool,
  IoRestaurant,
  IoAirplane,
  IoBriefcase,
  IoChatbubbles,
  IoTv,
  IoFilter,
  IoSparkles,
  IoCheckmarkCircle,
  IoLockClosed,
  IoTime,
  IoTrendingUp,
  IoPlay,
} from 'react-icons/io5';
import styles from './paths.module.css';

// Translate known rationale phrases to localized versions
function translateRationale(rationale: string, t: (key: string) => string): string {
  if (!rationale) return '';

  // Map of English phrases to translation keys
  const translations: Record<string, string> = {
    "You're doing great! Feel free to push harder.": t('recommendations.encouragement'),
    "Taking it slow to build stronger foundations.": t('recommendations.takingSlow'),
    "You have many reviews due - consider clearing your review queue before adding new items.": t('recommendations.manyReviewsDue'),
  };

  let result = rationale;
  for (const [english, translated] of Object.entries(translations)) {
    result = result.replace(english, translated);
  }

  return result;
}

type PathType = 'all' | 'linear' | 'topic' | 'adaptive';
type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

const PATH_ICONS: Record<string, React.ReactNode> = {
  'jlpt-mastery': <IoSchool />,
  'restaurant-japanese': <IoRestaurant />,
  'travel-essentials': <IoAirplane />,
  'business-japanese': <IoBriefcase />,
  'daily-conversation': <IoChatbubbles />,
  'anime-manga': <IoTv />,
};

export default function PathsPage() {
  const { t } = useLanguage();
  const { getText } = useContentTranslation();
  const { paths, adaptiveRecommendations, isLoading, hasPathsData } = useRecommendations();
  const { isEnrolled, enrollInPath, checkPrerequisites } = usePathProgress();

  const [typeFilter, setTypeFilter] = useState<PathType>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter paths
  const filteredPaths = useMemo(() => {
    return paths.filter((path) => {
      // Type filter
      if (typeFilter !== 'all' && path.pathType !== typeFilter) {
        return false;
      }

      // Difficulty filter
      if (difficultyFilter !== 'all') {
        const pathDifficulty = path.difficulty?.toLowerCase() || 'beginner';
        if (!pathDifficulty.includes(difficultyFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [paths, typeFilter, difficultyFilter]);

  // Separate linear paths (JLPT) and topic tracks
  const linearPaths = filteredPaths.filter(p => p.pathType === 'linear');
  const topicPaths = filteredPaths.filter(p => p.pathType === 'topic');

  // Difficulty badge tone
  const getDifficultyClass = (difficulty: string) => {
    const value = difficulty.toLowerCase();
    if (value.includes('beginner')) return styles.difficultyBeginner;
    if (value.includes('intermediate')) return styles.difficultyIntermediate;
    if (value.includes('advanced')) return styles.difficultyAdvanced;
    return '';
  };


  const header = <PageHeader title={t('paths.title')} subtitle={t('paths.subtitle')} />;

  if (isLoading) {
    return (
      <Container variant="dashboard">
        {header}
        <p className={styles.loadingText} role="status" aria-live="polite">{t('paths.loading')}</p>
      </Container>
    );
  }

  return (
    <Container variant="dashboard">
      {header}

      {/* Filters toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.chipRow} role="group" aria-label={t('paths.filterDifficulty')}>
          {(['all', 'beginner', 'intermediate', 'advanced'] as DifficultyFilter[]).map((diff) => (
            <button
              key={diff}
              type="button"
              className={`${styles.chip} ${difficultyFilter === diff ? styles.chipActive : ''}`}
              aria-pressed={difficultyFilter === diff}
              onClick={() => setDifficultyFilter(diff)}
            >
              {t(`paths.difficulty.${diff}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.chip} ${styles.filterToggle} ${showFilters ? styles.chipActive : ''}`}
          aria-expanded={showFilters}
          aria-controls="paths-type-filter"
          onClick={() => setShowFilters(!showFilters)}
        >
          <IoFilter aria-hidden="true" /> {t('paths.moreFilters')}
        </button>
      </div>

      {showFilters && (
        <div id="paths-type-filter" className={styles.filterPanel}>
          <span className={styles.filterLabel}>{t('paths.filterType')}</span>
          <div className={styles.chipRow} role="group" aria-label={t('paths.filterType')}>
            {(['all', 'linear', 'topic'] as PathType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`${styles.chip} ${typeFilter === type ? styles.chipActive : ''}`}
                aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter(type)}
              >
                {t(`paths.types.${type}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.sections}>
        {/* Adaptive Path Section */}
        {adaptiveRecommendations && (
          <section className={styles.section} aria-labelledby="paths-adaptive-title">
            <h2 id="paths-adaptive-title" className={styles.sectionTitle}>
              <IoSparkles className={styles.sectionIcon} aria-hidden="true" />
              {t('paths.personalizedPath')}
            </h2>
            <div className={styles.adaptiveCard}>
              <div className={styles.adaptiveMain}>
                <div className={styles.adaptiveHeader}>
                  <span className={styles.iconTile} aria-hidden="true">
                    <IoRocket />
                  </span>
                  <div className={styles.adaptiveInfo}>
                    <h3 className={styles.cardTitle}>{t('paths.aiRecommendations')}</h3>
                    <p className={styles.cardText}>{t('paths.tailoredToYou')}</p>
                  </div>
                </div>
                <p className={styles.adaptiveRationale}>
                  {translateRationale(adaptiveRecommendations.rationale, t)}
                </p>
                {adaptiveRecommendations.focusAreas.length > 0 && (
                  <div className={styles.focusAreas}>
                    <span className={styles.filterLabel}>{t('paths.focusAreas')}</span>
                    <div className={styles.focusTags}>
                      {adaptiveRecommendations.focusAreas.slice(0, 3).map((area, idx) => (
                        <span key={idx} className={styles.tag}>
                          {area.module}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.adaptiveSide}>
                <dl className={styles.adaptiveStats}>
                  <div className={styles.adaptiveStat}>
                    <dt className={styles.statLabel}>{t('paths.minPerDay')}</dt>
                    <dd className={styles.statValue}>{adaptiveRecommendations.dailyGoalMinutes}</dd>
                  </div>
                  <div className={styles.adaptiveStat}>
                    <dt className={styles.statLabel}>{t('paths.newPerWeek')}</dt>
                    <dd className={styles.statValue}>{adaptiveRecommendations.weeklyGoal.newItems}</dd>
                  </div>
                  <div className={styles.adaptiveStat}>
                    <dt className={styles.statLabel}>{t('paths.pace')}</dt>
                    <dd className={styles.statValue}>{t(`pace.${adaptiveRecommendations.suggestedPace}`)}</dd>
                  </div>
                </dl>
                <Button href="/review" className={styles.adaptiveAction}>
                  <IoPlay aria-hidden="true" /> {t('paths.startLearning')}
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Linear Paths (JLPT) */}
        {linearPaths.length > 0 && (
          <section className={styles.section} aria-labelledby="paths-structured-title">
            <h2 id="paths-structured-title" className={styles.sectionTitle}>
              <IoSchool className={styles.sectionIcon} aria-hidden="true" />
              {t('paths.structuredPaths')}
            </h2>
            <ul className={styles.pathsGrid}>
              {linearPaths.map((path) => {
                const enrolled = isEnrolled(path.pathId);
                return (
                  <li key={path.pathId}>
                    <Link href={`/paths/${path.pathId}`} className={styles.pathCard}>
                      <div className={styles.cardHead}>
                        <span className={styles.iconTile} aria-hidden="true">
                          {PATH_ICONS[path.pathId] || <IoSchool />}
                        </span>
                        <div className={styles.cardHeadText}>
                          <h3 className={styles.cardTitle}>{getText((path as { nameTranslations?: Record<string, string> }).nameTranslations, path.name)}</h3>
                          {enrolled && (
                            <span className={styles.enrolledBadge}>
                              <IoCheckmarkCircle aria-hidden="true" /> {t('paths.enrolled')}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={styles.cardText}>
                        {getText((path as { descriptionTranslations?: Record<string, string> }).descriptionTranslations, path.description)}
                      </p>
                      <div className={styles.cardFooter}>
                        <div className={styles.progressTrack} aria-hidden="true">
                          <div className={styles.progressFill} style={{ width: `${path.percentComplete}%` }} />
                        </div>
                        <div className={styles.meta}>
                          <span className={styles.metaItem}>
                            <IoTrendingUp aria-hidden="true" /> {path.percentComplete}%
                          </span>
                          <span className={styles.metaItem}>
                            <IoCheckmarkCircle aria-hidden="true" /> {path.completedMilestones}/{path.totalMilestones}
                          </span>
                          {path.estimatedHours && (
                            <span className={styles.metaItem} aria-label={t('paths.hours', { count: Math.round(path.estimatedHours) })}>
                              <IoTime aria-hidden="true" /> {Math.round(path.estimatedHours)}h
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Topic Tracks */}
        {topicPaths.length > 0 && (
          <section className={styles.section} aria-labelledby="paths-topic-title">
            <h2 id="paths-topic-title" className={styles.sectionTitle}>
              <IoRocket className={styles.sectionIcon} aria-hidden="true" />
              {t('paths.topicTracks')}
            </h2>
            <ul className={styles.pathsGrid}>
              {topicPaths.map((path) => {
                const enrolled = isEnrolled(path.pathId);
                const prereqs = checkPrerequisites(path.pathId);
                const isLocked = !prereqs.met;

                const cardContent = (
                  <>
                    <div className={styles.cardHead}>
                      <span className={styles.iconTile} aria-hidden="true">
                        {PATH_ICONS[path.pathId] || <IoSparkles />}
                      </span>
                      <div className={styles.cardHeadText}>
                        <h3 className={styles.cardTitle}>{getText((path as { nameTranslations?: Record<string, string> }).nameTranslations, path.name)}</h3>
                        <span className={`${styles.difficultyBadge} ${getDifficultyClass(path.difficulty)}`}>
                          {path.difficulty}
                        </span>
                      </div>
                      {isLocked && (
                        <IoLockClosed className={styles.lockIcon} aria-hidden="true" />
                      )}
                    </div>
                    <p className={styles.cardText}>
                      {getText((path as { descriptionTranslations?: Record<string, string> }).descriptionTranslations, path.description)}
                    </p>
                    <div className={styles.cardFooter}>
                      <div className={styles.progressTrack} aria-hidden="true">
                        <div className={styles.progressFill} style={{ width: `${path.percentComplete}%` }} />
                      </div>
                      <div className={styles.meta}>
                        {enrolled && !isLocked && (
                          <span className={`${styles.metaItem} ${styles.metaAccent}`}>
                            {t('paths.percentComplete', { percent: path.percentComplete })}
                          </span>
                        )}
                        {path.estimatedHours && (
                          <span className={styles.metaItem} aria-label={t('paths.hours', { count: Math.round(path.estimatedHours) })}>
                            <IoTime aria-hidden="true" /> {Math.round(path.estimatedHours)}h
                          </span>
                        )}
                        {path.tags && path.tags.length > 0 && path.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                      {isLocked && prereqs.missing.length > 0 && (
                        <p className={styles.prereqText}>
                          {t('paths.requires', { item: prereqs.missing[0] })}
                        </p>
                      )}
                    </div>
                  </>
                );

                return (
                  <li key={path.pathId}>
                    {isLocked ? (
                      <div className={`${styles.pathCard} ${styles.locked}`} aria-disabled="true">
                        {cardContent}
                      </div>
                    ) : (
                      <Link href={`/paths/${path.pathId}`} className={styles.pathCard}>
                        {cardContent}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Empty State - No paths available for this language */}
        {!hasPathsData && !isLoading && (
          <div className={styles.emptyState}>
            <span className={styles.iconTile} aria-hidden="true">
              <IoSparkles />
            </span>
            <h2 className={styles.sectionTitle}>{t('paths.noPathsYet')}</h2>
            <p className={styles.cardText}>{t('paths.noPathsDescription')}</p>
          </div>
        )}

        {/* Empty State - No matches */}
        {hasPathsData && filteredPaths.length === 0 && (
          <div className={styles.emptyState}>
            <h2 className={styles.sectionTitle}>{t('paths.noMatchingPaths')}</h2>
            <Button variant="ghost" onClick={() => {
              setTypeFilter('all');
              setDifficultyFilter('all');
            }}>
              {t('paths.clearFilters')}
            </Button>
          </div>
        )}
      </div>
    </Container>
  );
}
