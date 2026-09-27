'use client'

import { useState, useMemo, memo, useCallback } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useGamification } from '@/hooks/useGamification';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { useMobile } from '@/hooks/useMobile';
import { ModuleName } from '@/lib/language';
import { LEARNING_MODULES, getModuleIcon, getModuleName } from '@/lib/learningModules';
import { getGreeting } from '@/lib/greeting';
import { getStreakMessage } from '@/lib/streak';
import ProgressBar from '@/components/common/ProgressBar';
import TargetLanguageSelector from '@/components/common/TargetLanguageSelector';
import AuthButton from '@/components/common/AuthButton';
import Logo from '@/components/common/Logo';
import LearningCompanion from '@/components/LearningCompanion/LearningCompanion';
import LearningCompass from '@/components/dashboard/LearningCompass';
import MasteryHeatmap from '@/components/dashboard/MasteryHeatmap';
import StreakCalendar from '@/components/dashboard/StreakCalendar';
import { Container, Button, Spinner, Text } from '@/components/ui';
import {
    IoBook, IoSchool, IoTime, IoPlay, IoChevronDown, IoChevronForward, IoFlame, IoStar,
    IoLibrary, IoMic, IoTrophy, IoMap,
} from 'react-icons/io5';
import styles from './Dashboard.module.css';

// Mapping from language code to primary learning path ID
const LANGUAGE_PATH_MAP: Record<string, string> = {
    ja: 'jlpt-mastery',
    es: 'cefr-spanish',
    de: 'cefr-german',
    it: 'cefr-italian',
    en: 'cefr-english',
    ko: 'topik-korean',
    zh: 'hsk-chinese',
};

const getPathIdForLanguage = (lang: string): string => {
    return LANGUAGE_PATH_MAP[lang] || LANGUAGE_PATH_MAP.ja;
};

// Rough item counts used to turn module stats into a progress percentage
const MODULE_TOTAL_ITEMS: Record<ModuleName, number> = {
    alphabet: 112,
    vocabulary: 30,
    kanji: 10,
    grammar: 5,
    reading: 2,
    listening: 3,
};

const SECONDS_PER_MINUTE = 60;
const FULL_PERCENT = 100;

// Language-specific stat labels
const getStatLabel = (statKey: string, lang: string, t: (key: string) => string): string => {
    if (statKey === 'characters') {
        if (lang === 'ja') return t('dashboard.kanjiMastered');
        if (lang === 'zh') return t('dashboard.hanziMastered');
        if (lang === 'ko') return t('dashboard.hangulMastered');
        return t('dashboard.charactersLearned');
    }
    return t(`dashboard.${statKey}`) || statKey;
};

interface MoreLink {
    href: string;
    labelKey: string;
    icon: ReactNode;
}

// Pages that are not in the mobile bottom navigation
const MORE_LINKS: MoreLink[] = [
    { href: '/library', labelKey: 'nav.library', icon: <IoLibrary /> },
    { href: '/pronunciation', labelKey: 'nav.pronunciation', icon: <IoMic /> },
    { href: '/assessment/placement', labelKey: 'nav.placementTest', icon: <IoSchool /> },
    { href: '/leaderboard', labelKey: 'nav.leaderboard', icon: <IoTrophy /> },
];

function Dashboard() {
    const { summary, getModuleProgress, initialized } = useProgressContext();
    const { t } = useLanguage();
    const { getText } = useContentTranslation();
    const { targetLanguage, isModuleEnabled } = useTargetLanguage();
    const { streak, dailyGoal, todayXP } = useGamification();
    const { lessons, getLessonStatus } = useCurriculum();
    const isMobile = useMobile();
    const [showWidgets, setShowWidgets] = useState(false);
    const toggleWidgets = useCallback(() => setShowWidgets(prev => !prev), []);

    // Find the current in-progress lesson or the next available one
    const currentLesson = useMemo(() => {
        for (const flatLesson of lessons) {
            if (getLessonStatus(flatLesson.lesson.id) === 'in_progress') {
                return flatLesson.lesson;
            }
        }
        for (const flatLesson of lessons) {
            if (getLessonStatus(flatLesson.lesson.id) === 'available') {
                return flatLesson.lesson;
            }
        }
        // Do not recommend a locked lesson or restart a completed curriculum.
        return null;
    }, [lessons, getLessonStatus]);

    const modules = useMemo(
        () => LEARNING_MODULES.filter(module => isModuleEnabled(module.id)),
        [isModuleEnabled]
    );

    const moduleProgress = useMemo(() => {
        const progress: Record<string, number> = {};
        if (initialized && summary) {
            modules.forEach(module => {
                progress[module.id] = getModuleProgress(module.id, MODULE_TOTAL_ITEMS[module.id]);
            });
        }
        return progress;
    }, [initialized, summary, getModuleProgress, modules]);

    if (!summary) {
        return (
            <Container variant="dashboard">
                <div className={styles.loadingState} role="status" aria-live="polite">
                    <Spinner size="lg" />
                    <Text color="secondary">{t('common.loading')}</Text>
                </div>
            </Container>
        );
    }

    const currentStreak = streak?.currentStreak ?? 0;
    const goalPercent = dailyGoal && dailyGoal.target > 0
        ? Math.min(FULL_PERCENT, Math.round((dailyGoal.current / dailyGoal.target) * FULL_PERCENT))
        : 0;
    const isLessonInProgress = currentLesson ? getLessonStatus(currentLesson.id) === 'in_progress' : false;

    const stats = [
        { id: 'words', icon: <IoBook />, value: summary.totalWords || 0, label: t('dashboard.wordsLearned') },
        { id: 'characters', icon: <IoSchool />, value: summary.totalKanji || 0, label: getStatLabel('characters', targetLanguage, t) },
        { id: 'time', icon: <IoTime />, value: Math.round((summary.totalStudyTime || 0) / SECONDS_PER_MINUTE), label: t('dashboard.studyTime') },
    ];

    const widgets = (
        <>
            <div className={styles.widgetsGrid}>
                <LearningCompass />
                <MasteryHeatmap />
            </div>
            <StreakCalendar weeks={16} />
        </>
    );

    return (
        <Container variant="dashboard" className={styles.shell}>
            {/* Phone/tablet top bar; the desktop sidebar carries the logo and selectors */}
            <div className={styles.topBar}>
                <Logo size="sm" showTagline={false} />
                <div className={styles.topBarActions}>
                    <TargetLanguageSelector />
                    <AuthButton />
                </div>
            </div>

            <header className={styles.intro}>
                <h1 className={styles.greeting}>{getGreeting(t)}</h1>
                <p className={styles.tagline}>{t('dashboard.subtitle')}</p>
            </header>

            <div className={styles.layout}>
                {/* Today: next lesson, streak and daily goal in one card */}
                <section className={styles.today} aria-labelledby="dashboard-today-title">
                    <div className={styles.todayMain}>
                        {currentLesson ? (
                            <>
                                <p className={styles.eyebrow}>
                                    {t(isLessonInProgress ? 'dashboard.continueLearning' : 'paths.startLearning')}
                                </p>
                                <h2 id="dashboard-today-title" className={styles.todayTitle}>
                                    {getText(currentLesson.titleTranslations, currentLesson.title)}
                                </h2>
                                <p className={styles.todayText}>
                                    {getText(currentLesson.descriptionTranslations, currentLesson.description)}
                                </p>
                                <Button
                                    href={`/paths/${getPathIdForLanguage(targetLanguage)}/${currentLesson.id}`}
                                    className={styles.todayButton}
                                >
                                    <IoPlay aria-hidden="true" /> {t(isLessonInProgress ? 'common.continue' : 'common.start')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className={styles.eyebrow}>{t('paths.startLearning')}</p>
                                <h2 id="dashboard-today-title" className={styles.todayTitle}>{t('dashboard.browsePaths')}</h2>
                                <Button href="/paths" className={styles.todayButton}>
                                    <IoMap aria-hidden="true" /> {t('nav.paths')}
                                </Button>
                            </>
                        )}
                    </div>

                    <div className={styles.todayStats}>
                        <div className={styles.streak}>
                            <span className={`${styles.streakIcon} ${currentStreak > 0 ? styles.streakActive : ''}`} aria-hidden="true">
                                <IoFlame />
                            </span>
                            <div>
                                <p className={styles.streakValue}>
                                    {currentStreak > 0
                                        ? t('gamification.streak.dayStreak', { count: currentStreak })
                                        : t('gamification.streak.noStreak')}
                                </p>
                                <p className={styles.streakMessage}>{getStreakMessage(currentStreak, t)}</p>
                            </div>
                        </div>
                        <div className={styles.goal}>
                            <div className={styles.goalHeader}>
                                <span className={styles.goalLabel}>
                                    <IoStar aria-hidden="true" /> {t('gamification.dailyGoal.title')}
                                </span>
                                <span className={styles.goalValue}>
                                    {dailyGoal?.completed
                                        ? t('gamification.dailyGoal.complete')
                                        : t('gamification.xp.today', { xp: todayXP })}
                                </span>
                            </div>
                            <div
                                className={styles.goalTrack}
                                role="progressbar"
                                aria-valuenow={goalPercent}
                                aria-valuemin={0}
                                aria-valuemax={FULL_PERCENT}
                                aria-label={t('gamification.dailyGoal.title')}
                            >
                                <div className={styles.goalFill} style={{ width: `${goalPercent}%` }} />
                            </div>
                        </div>
                    </div>
                </section>

                <dl className={styles.stats}>
                    {stats.map(stat => (
                        <div key={stat.id} className={styles.stat}>
                            <span className={styles.statIcon} aria-hidden="true">{stat.icon}</span>
                            <dt className={styles.statLabel}>{stat.label}</dt>
                            <dd className={styles.statValue}>{stat.value}</dd>
                        </div>
                    ))}
                </dl>

                <section className={styles.learn} aria-labelledby="dashboard-learn-title">
                    <h2 id="dashboard-learn-title" className={styles.sectionTitle}>{t('nav.learn')}</h2>
                    <ul className={styles.modules}>
                        {modules.map(module => {
                            const names = getModuleName(module.id, targetLanguage, t);
                            const progress = moduleProgress[module.id] || 0;
                            return (
                                <li key={module.id}>
                                    <Link href={module.href} className={styles.module}>
                                        <span className={styles.moduleIcon} aria-hidden="true">
                                            {getModuleIcon(module.id, targetLanguage, styles.moduleGlyph)}
                                        </span>
                                        <span className={styles.moduleBody}>
                                            <span className={styles.moduleTitle}>{names.title}</span>
                                            <span className={styles.moduleDescription}>{names.description}</span>
                                            <ProgressBar progress={progress} showText={true} />
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <aside className={styles.aside}>
                    <LearningCompanion position="sidebar" />
                    <nav className={styles.more} aria-labelledby="dashboard-more-title">
                        <h2 id="dashboard-more-title" className={styles.sectionTitle}>{t('nav.more')}</h2>
                        <ul className={styles.moreList}>
                            {MORE_LINKS.map(link => (
                                <li key={link.href}>
                                    <Link href={link.href} className={styles.moreLink}>
                                        <span className={styles.moreIcon} aria-hidden="true">{link.icon}</span>
                                        <span className={styles.moreLabel}>{t(link.labelKey)}</span>
                                        <IoChevronForward className={styles.moreChevron} aria-hidden="true" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </aside>

                <section className={styles.widgets} aria-label={t('dashboard.moreStats')}>
                    {isMobile ? (
                        <>
                            <button
                                type="button"
                                className={`${styles.widgetsToggle} ${showWidgets ? styles.widgetsToggleOpen : ''}`}
                                onClick={toggleWidgets}
                                aria-expanded={showWidgets}
                            >
                                <span>{t('dashboard.moreStats')}</span>
                                <IoChevronDown className={styles.widgetsToggleIcon} aria-hidden="true" />
                            </button>
                            {showWidgets && <div className={styles.widgetsBody}>{widgets}</div>}
                        </>
                    ) : (
                        <div className={styles.widgetsBody}>{widgets}</div>
                    )}
                </section>
            </div>
        </Container>
    );
}

export default memo(Dashboard);
