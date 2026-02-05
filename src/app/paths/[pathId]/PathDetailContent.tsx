'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import Navigation from '@/components/common/Navigation';
import Breadcrumb from '@/components/common/Breadcrumb';
import { Container, Card, Text, Button, Animated } from '@/components/ui';
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
} from 'react-icons/io5';
import { PiExam } from 'react-icons/pi';
import styles from './pathDetail.module.css';

const PATH_ICONS: Record<string, React.ReactNode> = {
  'jlpt-mastery': <IoSchool />,
  'restaurant-japanese': <IoRestaurant />,
  'travel-essentials': <IoAirplane />,
  'business-japanese': <IoBriefcase />,
  'daily-conversation': <IoChatbubbles />,
  'anime-manga': <IoTv />,
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  alphabet: <span className={styles.japaneseIcon}>あ</span>,
  vocabulary: <IoBook />,
  kanji: <span className={styles.japaneseIcon}>字</span>,
  grammar: <PiExam />,
  reading: <IoDocumentText />,
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
      <Container variant="centered">
        <Navigation />
        <Card variant="glass" className={styles.notFound}>
          <Text variant="body" color="muted">{t('pathDetail.loading')}</Text>
        </Card>
      </Container>
    );
  }

  if (!pathData) {
    return (
      <Container variant="centered">
        <Navigation />
        <Card variant="glass" className={styles.notFound}>
          <Text variant="h2">{t('pathDetail.notFound')}</Text>
          <Text color="muted">{t('pathDetail.notFoundDescription')}</Text>
          <Button variant="ghost" onClick={() => router.push('/paths')}>
            <IoArrowBack /> {t('pathDetail.backToPaths')}
          </Button>
        </Card>
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

  return (
    <Container variant="centered">
      <Navigation />
      <Breadcrumb items={[
        { label: t('breadcrumb.paths'), href: '/paths' },
        { label: getText(pathData.nameTranslations, pathData.name) },
      ]} />

      {/* Header */}
      <Animated animation="fadeInDown">
        <div className={styles.header}>
          <div className={styles.pathIcon}>
            {PATH_ICONS[pathId] || <IoSparkles />}
          </div>
          <div className={styles.headerContent}>
            <Text variant="h1" color="gold" className={styles.pathTitle}>
              {getText(pathData.nameTranslations, pathData.name)}
            </Text>
            <Text color="muted" className={styles.pathDescription}>
              {getText(pathData.descriptionTranslations, pathData.description)}
            </Text>
          </div>
        </div>
      </Animated>

      {/* Stats Bar */}
      <Card variant="glass" className={styles.statsBar}>
        <div className={styles.stat}>
          <IoTime className={styles.statIcon} />
          <div className={styles.statContent}>
            <Text variant="h3">{t('pathDetail.hoursValue', { count: Math.round(pathData.estimatedHours || 0) })}</Text>
            <Text variant="label" color="muted">{t('pathDetail.estimated')}</Text>
          </div>
        </div>
        <div className={styles.stat}>
          <IoTrendingUp className={styles.statIcon} />
          <div className={styles.statContent}>
            <Text variant="h3">{progress?.percentComplete || 0}%</Text>
            <Text variant="label" color="muted">{t('pathDetail.complete')}</Text>
          </div>
        </div>
        {isLinear && linearPath && (
          <div className={styles.stat}>
            <IoCheckmarkCircle className={styles.statIcon} />
            <div className={styles.statContent}>
              <Text variant="h3">{progress?.completedMilestones || 0}/{linearPath.milestones.length}</Text>
              <Text variant="label" color="muted">{t('pathDetail.milestones')}</Text>
            </div>
          </div>
        )}
        {!isLinear && (
          <div className={styles.stat}>
            <IoBook className={styles.statIcon} />
            <div className={styles.statContent}>
              <Text variant="h3">{totalItems}</Text>
              <Text variant="label" color="muted">{t('pathDetail.items')}</Text>
            </div>
          </div>
        )}
      </Card>

      {/* Enrollment Actions */}
      <div className={styles.actions}>
        {!prereqs.met && (
          <Card variant="outlined" className={styles.prereqWarning}>
            <IoLockClosed className={styles.prereqIcon} />
            <div>
              <Text variant="body">{t('pathDetail.prerequisitesRequired')}</Text>
              <Text variant="caption" color="muted">
                {t('pathDetail.completeFirst')}: {prereqs.missing.join(', ')}
              </Text>
            </div>
          </Card>
        )}

        {enrolled ? (
          <div className={styles.enrolledActions}>
            <Button onClick={() => router.push('/review')}>
              <IoPlay /> {t('pathDetail.continueLearning')}
            </Button>
            <Button variant="ghost" onClick={() => unenrollFromPath(pathId)}>
              {t('pathDetail.unenroll')}
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => enrollInPath(pathId)}
            disabled={!prereqs.met}
          >
            <IoPlay /> {prereqs.met ? t('pathDetail.startPath') : t('pathDetail.locked')}
          </Button>
        )}
      </div>

      {/* Linear Path Content - Milestones */}
      {isLinear && linearPath && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Text variant="h2">{t('pathDetail.milestones')}</Text>
            <Text color="muted">
              {t('pathDetail.milestonesDescription')}
            </Text>
          </div>

          <div className={styles.milestoneList}>
            {linearPath.milestones.map((milestone, index) => {
              const status = getMilestoneStatus(index);
              const milestoneProgress = progress?.currentMilestone?.id === milestone.id
                ? progress.currentMilestone.progress
                : status === 'completed' ? 100 : 0;

              return (
                <div
                  key={`${milestone.id}-${index}`}
                  className={`${styles.milestone} ${styles[status]}`}
                >
                  <div className={styles.milestoneConnector}>
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

                  <Card variant={status === 'current' ? 'glass' : 'default'} className={styles.milestoneCard}>
                    <div className={styles.milestoneHeader}>
                      <div className={styles.milestoneIcon}>
                        {MODULE_ICONS[milestone.module] || <IoBook />}
                      </div>
                      <div className={styles.milestoneMeta}>
                        <span className={styles.milestoneLevel}>{milestone.level}</span>
                        <span className={styles.milestoneTime}>
                          <IoTime /> {Math.round(milestone.estimatedHours)}h
                        </span>
                      </div>
                    </div>
                    <Text variant="h3" className={styles.milestoneName}>
                      {getText(milestone.nameTranslations, milestone.name)}
                    </Text>
                    <Text variant="body" color="muted" className={styles.milestoneDescription}>
                      {getText(milestone.descriptionTranslations, milestone.description)}
                    </Text>

                    {status === 'current' && (
                      <>
                        <div className={styles.milestoneProgress}>
                          <div
                            className={styles.milestoneProgressBar}
                            style={{ width: `${milestoneProgress}%` }}
                          />
                        </div>
                        <div className={styles.milestoneActions}>
                          <Link href={`/paths/${pathId}/${milestone.lessons?.[0] || milestone.id}`}>
                            <Button size="sm">
                              <IoPlay /> {t('pathDetail.startLesson')}
                            </Button>
                          </Link>
                          <Link href="/review">
                            <Button size="sm" variant="ghost">
                              {t('pathDetail.reviewProgress')}
                            </Button>
                          </Link>
                        </div>
                      </>
                    )}

                    {status === 'locked' && (
                      <div className={styles.lockedMessage}>
                        <IoLockClosed /> {t('pathDetail.unlockMessage')}
                      </div>
                    )}

                    {status === 'completed' && (
                      <div className={styles.completedBadge}>
                        <IoCheckmarkCircle /> {t('pathDetail.completed')}
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Topic Track Content - Item Breakdown */}
      {!isLinear && topicTrack && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Text variant="h2">{t('pathDetail.whatYoullLearn')}</Text>
            <Text color="muted">
              {t('pathDetail.practicalItemsFor', { name: getText(topicTrack.nameTranslations, topicTrack.name).toLowerCase() })}
            </Text>
          </div>

          <div className={styles.itemBreakdown}>
            {itemCounts.vocabulary > 0 && (
              <Link href="/vocabulary" className={styles.itemCategory}>
                <Card variant="glass" hover className={styles.categoryCard}>
                  <div className={styles.categoryIcon}>
                    <IoBook />
                  </div>
                  <div className={styles.categoryContent}>
                    <Text variant="h3">{itemCounts.vocabulary}</Text>
                    <Text variant="label" color="muted">{t('modules.vocabulary.title')}</Text>
                  </div>
                </Card>
              </Link>
            )}

            {itemCounts.grammar > 0 && (
              <Link href="/grammar" className={styles.itemCategory}>
                <Card variant="glass" hover className={styles.categoryCard}>
                  <div className={styles.categoryIcon}>
                    <PiExam />
                  </div>
                  <div className={styles.categoryContent}>
                    <Text variant="h3">{itemCounts.grammar}</Text>
                    <Text variant="label" color="muted">{t('modules.grammar.title')}</Text>
                  </div>
                </Card>
              </Link>
            )}

            {itemCounts.reading > 0 && (
              <Link href="/reading" className={styles.itemCategory}>
                <Card variant="glass" hover className={styles.categoryCard}>
                  <div className={styles.categoryIcon}>
                    <IoDocumentText />
                  </div>
                  <div className={styles.categoryContent}>
                    <Text variant="h3">{itemCounts.reading}</Text>
                    <Text variant="label" color="muted">{t('modules.reading.title')}</Text>
                  </div>
                </Card>
              </Link>
            )}

            {itemCounts.kanji > 0 && (
              <Link href="/kanji" className={styles.itemCategory}>
                <Card variant="glass" hover className={styles.categoryCard}>
                  <div className={styles.categoryIcon}>
                    <span className={styles.japaneseIcon}>字</span>
                  </div>
                  <div className={styles.categoryContent}>
                    <Text variant="h3">{itemCounts.kanji}</Text>
                    <Text variant="label" color="muted">{t('modules.kanji.title')}</Text>
                  </div>
                </Card>
              </Link>
            )}
          </div>

          {/* Tags */}
          {topicTrack.tags && topicTrack.tags.length > 0 && (
            <div className={styles.tags}>
              <Text variant="label" color="muted">{t('pathDetail.topics')}:</Text>
              <div className={styles.tagList}>
                {topicTrack.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Back Link */}
      <div className={styles.backLink}>
        <Button variant="ghost" onClick={() => router.push('/paths')}>
          <IoArrowBack /> {t('pathDetail.backToPaths')}
        </Button>
      </div>
    </Container>
  );
}
