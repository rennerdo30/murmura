'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/common/PageHeader';
import { Container, Button } from '@/components/ui';
import { useRecommendations } from '@/hooks/useRecommendations';
import { usePathProgress } from '@/hooks/usePathProgress';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { loadLearningPathsData, LearningPathsData, LearningPath } from '@/lib/dataLoader';
import {
  IoArrowBack,
  IoCheckmarkCircle,
  IoTime,
  IoPlay,
  IoSchool,
  IoRestaurant,
  IoAirplane,
  IoBriefcase,
  IoChatbubbles,
  IoTv,
  IoSparkles,
  IoLockClosed,
  IoTrendingUp,
  IoBook,
  IoDocumentText,
  IoChevronForward,
} from 'react-icons/io5';
import { PiExam } from 'react-icons/pi';
import styles from './pathDetail.module.css';
import { getModuleIcon, isLearningModule } from '@/lib/learningModules';

const PATH_ICONS: Record<string, React.ReactNode> = {
  'jlpt-mastery': <IoSchool />,
  'restaurant-japanese': <IoRestaurant />,
  'travel-essentials': <IoAirplane />,
  'business-japanese': <IoBriefcase />,
  'daily-conversation': <IoChatbubbles />,
  'anime-manga': <IoTv />,
};

interface PathMilestone {
  id: string;
  level: string;
  name: string;
  nameTranslations?: Record<string, string>;
  description: string;
  descriptionTranslations?: Record<string, string>;
  module: string;
  requirement: {
    type: string;
    value?: number;
  };
  estimatedHours: number;
  lessons?: string[];
}

interface TopicTrack {
  id: string;
  type: 'topic';
  name: string;
  nameTranslations?: Record<string, string>;
  description: string;
  descriptionTranslations?: Record<string, string>;
  icon: string;
  language: string;
  estimatedHours: number;
  difficulty: string;
  tags?: string[];
  tagsTranslations?: Record<string, string[]>;
  prerequisites?: string[];
  items: {
    vocabulary?: string[];
    grammar?: string[];
    reading?: string[];
    kanji?: string[];
  };
}

interface LinearPath {
  id: string;
  type: 'linear';
  name: string;
  nameTranslations?: Record<string, string>;
  description: string;
  descriptionTranslations?: Record<string, string>;
  milestones: PathMilestone[];
  estimatedHours: number;
}

export default function PathDetailContent() {
  const params = useParams();
  const router = useRouter();
  const pathId = params.pathId as string;

  const { t } = useLanguage();
  const { targetLanguage } = useTargetLanguage();
  const { getText } = useContentTranslation();
  const { getPathProgress, isLoading: recsLoading } = useRecommendations();
  const { isEnrolled, enrollInPath, unenrollFromPath, checkPrerequisites } = usePathProgress();

  // Load path data dynamically
  const [pathsData, setPathsData] = useState<LearningPathsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPaths() {
      if (!targetLanguage) return;
      setLoading(true);
      const data = await loadLearningPathsData(targetLanguage);
      setPathsData(data);
      setLoading(false);
    }
    loadPaths();
  }, [targetLanguage]);

  const pathData = pathsData?.paths[pathId] as LinearPath | TopicTrack | undefined;
  const progress = getPathProgress(pathId);
  const enrolled = isEnrolled(pathId);

  // Get prerequisite status for topic tracks
  const prereqs = useMemo(() => {
    if (pathData?.type === 'topic') {
      return checkPrerequisites(pathId);
    }
    return { met: true, missing: [] };
  }, [pathId, pathData, checkPrerequisites]);

  if (loading || recsLoading) {
    return (
      <Container variant="dashboard">
        <PageHeader title={t('paths.title')} backHref="/paths" backLabel={t('pathDetail.backToPaths')} />
        <p className={styles.statusText} role="status" aria-live="polite">{t('pathDetail.loading')}</p>
      </Container>
    );
  }

  if (!pathData) {
    return (
      <Container variant="dashboard">
        <PageHeader title={t('pathDetail.notFound')} backHref="/paths" backLabel={t('pathDetail.backToPaths')} />
        <div className={styles.notFound}>
          <p className={styles.sectionText}>{t('pathDetail.notFoundDescription')}</p>
          <Button variant="ghost" onClick={() => router.push('/paths')}>
            <IoArrowBack aria-hidden="true" /> {t('pathDetail.backToPaths')}
          </Button>
        </div>
      </Container>
    );
  }

  const isLinear = pathData.type === 'linear';
  const linearPath = isLinear ? (pathData as LinearPath) : null;
  const topicTrack = !isLinear ? (pathData as TopicTrack) : null;

  // Calculate milestone progress for linear paths
  const getMilestoneStatus = (index: number) => {
    if (!progress) return 'locked';
    if (index < progress.completedMilestones) return 'completed';
    if (index === progress.currentMilestoneIndex) return 'current';
    return 'locked';
  };

  // Count items in topic tracks
  const getTopicItemCounts = (): { vocabulary: number; grammar: number; reading: number; kanji: number } => {
    if (!topicTrack) return { vocabulary: 0, grammar: 0, reading: 0, kanji: 0 };
    const items = topicTrack.items;
    return {
      vocabulary: items.vocabulary?.length || 0,
      grammar: items.grammar?.length || 0,
      reading: items.reading?.length || 0,
      kanji: items.kanji?.length || 0,
    };
  };

  const itemCounts = getTopicItemCounts();
  const totalItems = Object.values(itemCounts).reduce((a, b) => a + b, 0);

  const pathName = getText(pathData.nameTranslations, pathData.name);

  const topicCategories: { key: keyof typeof itemCounts; href: string; icon: React.ReactNode; labelKey: string }[] = [
    { key: 'vocabulary', href: '/vocabulary', icon: <IoBook />, labelKey: 'modules.vocabulary.title' },
    { key: 'grammar', href: '/grammar', icon: <PiExam />, labelKey: 'modules.grammar.title' },
    { key: 'reading', href: '/reading', icon: <IoDocumentText />, labelKey: 'modules.reading.title' },
    { key: 'kanji', href: '/kanji', icon: getModuleIcon('kanji', targetLanguage, styles.japaneseIcon), labelKey: 'modules.kanji.title' },
  ];

  return (
    <Container variant="dashboard">
      <PageHeader
        title={
          <span className={styles.titleRow}>
            <span className={styles.pathIcon} aria-hidden="true">
              {PATH_ICONS[pathId] || <IoSparkles />}
            </span>
            <span className={styles.titleText}>{pathName}</span>
          </span>
        }
        subtitle={getText(pathData.descriptionTranslations, pathData.description)}
        backHref="/paths"
        backLabel={t('pathDetail.backToPaths')}
      />

      {/* Summary: stats + enrollment */}
      <div className={styles.summary}>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <IoTime className={styles.statIcon} aria-hidden="true" />
            <dt className={styles.statLabel}>{t('pathDetail.estimated')}</dt>
            <dd className={styles.statValue}>{t('pathDetail.hoursValue', { count: Math.round(pathData.estimatedHours || 0) })}</dd>
          </div>
          <div className={styles.stat}>
            <IoTrendingUp className={styles.statIcon} aria-hidden="true" />
            <dt className={styles.statLabel}>{t('pathDetail.complete')}</dt>
            <dd className={styles.statValue}>{progress?.percentComplete || 0}%</dd>
          </div>
          {isLinear && linearPath && (
            <div className={styles.stat}>
              <IoCheckmarkCircle className={styles.statIcon} aria-hidden="true" />
              <dt className={styles.statLabel}>{t('pathDetail.milestones')}</dt>
              <dd className={styles.statValue}>{progress?.completedMilestones || 0}/{linearPath.milestones.length}</dd>
            </div>
          )}
          {!isLinear && (
            <div className={styles.stat}>
              <IoBook className={styles.statIcon} aria-hidden="true" />
              <dt className={styles.statLabel}>{t('pathDetail.items')}</dt>
              <dd className={styles.statValue}>{totalItems}</dd>
            </div>
          )}
        </dl>

        <div className={styles.actions}>
          {!prereqs.met && (
            <div className={styles.prereqWarning}>
              <IoLockClosed className={styles.prereqIcon} aria-hidden="true" />
              <div>
                <p className={styles.prereqTitle}>{t('pathDetail.prerequisitesRequired')}</p>
                <p className={styles.prereqText}>
                  {t('pathDetail.completeFirst')}: {prereqs.missing.join(', ')}
                </p>
              </div>
            </div>
          )}

          {enrolled ? (
            <div className={styles.enrolledActions}>
              <Button onClick={() => router.push('/review')} className={styles.actionButton}>
                <IoPlay aria-hidden="true" /> {t('pathDetail.continueLearning')}
              </Button>
              <Button variant="ghost" onClick={() => unenrollFromPath(pathId)} className={styles.actionButton}>
                {t('pathDetail.unenroll')}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => enrollInPath(pathId)}
              disabled={!prereqs.met}
              className={styles.actionButton}
            >
              <IoPlay aria-hidden="true" /> {prereqs.met ? t('pathDetail.startPath') : t('pathDetail.locked')}
            </Button>
          )}
        </div>
      </div>

      {/* Linear Path Content - Milestones */}
      {isLinear && linearPath && (
        <section className={styles.section} aria-labelledby="path-milestones-title">
          <div className={styles.sectionHeader}>
            <h2 id="path-milestones-title" className={styles.sectionTitle}>{t('pathDetail.milestones')}</h2>
            <p className={styles.sectionText}>{t('pathDetail.milestonesDescription')}</p>
          </div>

          <ol className={styles.milestoneList}>
            {linearPath.milestones.map((milestone, index) => {
              const status = getMilestoneStatus(index);
              const milestoneProgress = progress?.currentMilestone?.id === milestone.id
                ? progress.currentMilestone.progress
                : status === 'completed' ? 100 : 0;

              return (
                <li
                  key={`${milestone.id}-${index}`}
                  className={`${styles.milestone} ${styles[status]}`}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  <div className={styles.milestoneConnector} aria-hidden="true">
                    <div className={styles.milestoneDot}>
                      {status === 'completed' ? (
                        <IoCheckmarkCircle />
                      ) : status === 'current' ? (
                        <IoPlay />
                      ) : (
                        <IoLockClosed />
                      )}
                    </div>
                    {index < linearPath.milestones.length - 1 && (
                      <div className={styles.milestoneLine} />
                    )}
                  </div>

                  <div className={styles.milestoneCard}>
                    <div className={styles.milestoneHeader}>
                      <span className={styles.milestoneIcon} aria-hidden="true">
                        {isLearningModule(milestone.module) ? getModuleIcon(milestone.module, targetLanguage, styles.japaneseIcon) : <IoBook />}
                      </span>
                      <div className={styles.milestoneHeading}>
                        <h3 className={styles.milestoneName}>
                          {getText(milestone.nameTranslations, milestone.name)}
                        </h3>
                        <div className={styles.milestoneMeta}>
                          <span className={styles.milestoneLevel}>{milestone.level}</span>
                          <span className={styles.milestoneTime}>
                            <IoTime aria-hidden="true" /> {Math.round(milestone.estimatedHours)}h
                          </span>
                        </div>
                      </div>
                      {status === 'completed' && (
                        <span className={styles.completedBadge}>
                          <IoCheckmarkCircle aria-hidden="true" /> {t('pathDetail.completed')}
                        </span>
                      )}
                    </div>
                    <p className={styles.milestoneDescription}>
                      {getText(milestone.descriptionTranslations, milestone.description)}
                    </p>

                    {status === 'current' && (
                      <>
                        <div className={styles.milestoneProgress} aria-hidden="true">
                          <div
                            className={styles.milestoneProgressBar}
                            style={{ width: `${milestoneProgress}%` }}
                          />
                        </div>
                        <div className={styles.milestoneActions}>
                          <Button href={`/paths/${pathId}/${milestone.lessons?.[0] || milestone.id}`} size="sm">
                            <IoPlay aria-hidden="true" /> {t('pathDetail.startLesson')}
                          </Button>
                          <Button href="/review" size="sm" variant="ghost">
                            {t('pathDetail.reviewProgress')}
                          </Button>
                        </div>
                      </>
                    )}

                    {status === 'locked' && (
                      <p className={styles.lockedMessage}>
                        <IoLockClosed aria-hidden="true" /> {t('pathDetail.unlockMessage')}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Topic Track Content - Item Breakdown */}
      {!isLinear && topicTrack && (
        <section className={styles.section} aria-labelledby="path-topic-title">
          <div className={styles.sectionHeader}>
            <h2 id="path-topic-title" className={styles.sectionTitle}>{t('pathDetail.whatYoullLearn')}</h2>
            <p className={styles.sectionText}>
              {t('pathDetail.practicalItemsFor', { name: getText(topicTrack.nameTranslations, topicTrack.name).toLowerCase() })}
            </p>
          </div>

          <ul className={styles.categoryList}>
            {topicCategories.filter((category) => itemCounts[category.key] > 0).map((category) => (
              <li key={category.key}>
                <Link href={category.href} className={styles.categoryLink}>
                  <span className={styles.categoryIcon} aria-hidden="true">{category.icon}</span>
                  <span className={styles.categoryLabel}>{t(category.labelKey)}</span>
                  <span className={styles.categoryCount}>{itemCounts[category.key]}</span>
                  <IoChevronForward className={styles.categoryChevron} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Tags */}
          {topicTrack.tags && topicTrack.tags.length > 0 && (
            <div className={styles.tags}>
              <span className={styles.tagsLabel}>{t('pathDetail.topics')}</span>
              <div className={styles.tagList}>
                {topicTrack.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </Container>
  );
}
