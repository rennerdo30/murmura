'use client'

import { useState, useMemo, memo, useCallback } from 'react';
import Link from 'next/link';
import { useProgressContext } from '@/context/ProgressProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useGamification } from '@/hooks/useGamification';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import { ModuleName } from '@/lib/language';
import ProgressBar from '@/components/common/ProgressBar';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import TargetLanguageSelector from '@/components/common/TargetLanguageSelector';
import AuthButton from '@/components/common/AuthButton';
import XPDisplay from '@/components/gamification/XPDisplay';
import StreakBadge from '@/components/gamification/StreakBadge';
import DailyGoalCard from '@/components/gamification/DailyGoalCard';
import { Container, Card, Text, Animated, Button, Spinner } from '@/components/ui';
import { IoBook, IoSchool, IoTime, IoDocumentText, IoHeadset, IoMap, IoRefresh, IoTrophy, IoSettings, IoPlay, IoChevronDown } from 'react-icons/io5';
import { PiExam } from 'react-icons/pi';
import { useMobile } from '@/hooks/useMobile';
import LearningCompass from '@/components/dashboard/LearningCompass';
import MasteryHeatmap from '@/components/dashboard/MasteryHeatmap';
import StreakCalendar from '@/components/dashboard/StreakCalendar';
import styles from './Dashboard.module.css';
import Logo from '@/components/common/Logo';

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

interface Module {
    id: ModuleName;
    icon: React.ReactNode;
    href: string;
    totalItems: number;
}

// Icons that vary by language
const ALPHABET_ICONS: Record<string, string> = {
    ja: 'あ',
    ko: '한',
    zh: '拼',
    default: 'A'
};

const KANJI_ICONS: Record<string, string> = {
    ja: '字',
    zh: '汉',
    default: '字'
};

const getAlphabetIcon = (lang: string) => ALPHABET_ICONS[lang] || ALPHABET_ICONS.default;
const getKanjiIcon = (lang: string) => KANJI_ICONS[lang] || KANJI_ICONS.default;

// Background decoration per language (culturally appropriate)
const BACKGROUND_DECORATIONS: Record<string, string> = {
    ja: '学',   // Japanese: "learn/study" kanji
    es: 'Ñ',    // Spanish: distinctive letter
    de: 'ß',    // German: distinctive letter
    en: 'A',    // English: classic letter
    it: '&',    // Italian: ampersand flourish
    ko: '한',   // Korean: "han" in Hangul
    zh: '学',   // Chinese: "learn/study" hanzi
};

const getBackgroundDecoration = (lang: string) => BACKGROUND_DECORATIONS[lang] || BACKGROUND_DECORATIONS.ja;

const getModuleName = (moduleId: string, lang: string, t: (key: string) => string) => {
    // Check for language-specific titles in translation system
    const specificTitleKey = moduleId === 'kanji' && lang === 'ja' ? `modules.kanji.title_ja` :
        moduleId === 'kanji' && lang === 'zh' ? `modules.kanji.title_zh` :
            moduleId === 'alphabet' && lang === 'ko' ? `modules.alphabet.title_ko` : null;

    const title = specificTitleKey ? t(specificTitleKey) : t(`modules.${moduleId}.title`);
    const description = t(`modules.${moduleId}.description`);

    return { title, description };
};

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

const ALL_MODULES: Module[] = [
    { id: 'alphabet', icon: <span className={styles.japaneseIcon}>あ</span>, href: '/alphabet', totalItems: 112 },
    { id: 'vocabulary', icon: <IoBook />, href: '/vocabulary', totalItems: 30 },
    { id: 'kanji', icon: <span className={styles.japaneseIcon}>字</span>, href: '/kanji', totalItems: 10 },
    { id: 'grammar', icon: <PiExam />, href: '/grammar', totalItems: 5 },
    { id: 'reading', icon: <IoDocumentText />, href: '/reading', totalItems: 2 },
    { id: 'listening', icon: <IoHeadset />, href: '/listening', totalItems: 3 },
];

function Dashboard() {
    const { summary, getModuleProgress, initialized } = useProgressContext();
    const { t } = useLanguage();
    const { getText } = useContentTranslation();
    const { targetLanguage, isModuleEnabled } = useTargetLanguage();
    const { level, streak, dailyGoal, todayXP } = useGamification();
    const { lessons, getLessonStatus } = useCurriculum();
    const isMobile = useMobile();
    const [showWidgets, setShowWidgets] = useState(false);
    const toggleWidgets = useCallback(() => setShowWidgets(prev => !prev), []);

    // Find the current in-progress lesson or the next available one
    const currentLesson = useMemo(() => {
        // First, check for an in-progress lesson
        for (const flatLesson of lessons) {
            const status = getLessonStatus(flatLesson.lesson.id);
            if (status === 'in_progress') {
                return flatLesson.lesson;
            }
        }
        // Otherwise, find the first available lesson
        for (const flatLesson of lessons) {
            const status = getLessonStatus(flatLesson.lesson.id);
            if (status === 'available') {
                return flatLesson.lesson;
            }
        }
        // Do not recommend a locked lesson or restart a completed curriculum.
        return null;
    }, [lessons, getLessonStatus]);

    // Filter modules based on target language and update icons
    const filteredModules = useMemo(() => {
        return ALL_MODULES
            .filter(module => isModuleEnabled(module.id))
            .map(module => {
                // Update icons based on target language
                if (module.id === 'alphabet') {
                    return {
                        ...module,
                        icon: <span className={styles.japaneseIcon}>{getAlphabetIcon(targetLanguage)}</span>
                    };
                }
                if (module.id === 'kanji') {
                    return {
                        ...module,
                        icon: <span className={styles.japaneseIcon}>{getKanjiIcon(targetLanguage)}</span>
                    };
                }
                return module;
            });
    }, [targetLanguage, isModuleEnabled]);

    const moduleProgress = useMemo(() => {
        const progress: Record<string, number> = {};
        if (initialized && summary) {
            filteredModules.forEach(module => {
                progress[module.id] = getModuleProgress(module.id, module.totalItems);
            });
        }
        return progress;
    }, [initialized, summary, getModuleProgress, filteredModules]);

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

    return (
        <Container variant="dashboard" className={styles.dashboardShell}>
            <Animated animation="float" infinite className={styles.backgroundKanji} aria-hidden="true">
                {getBackgroundDecoration(targetLanguage)}
            </Animated>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div>


                        <Logo />




                    </div>
                    <div className={styles.headerActions}>
                        <TargetLanguageSelector />
                        <LanguageSwitcher />
                        <AuthButton />
                    </div>
                </div>
            </header>

            {/* Continue Learning Card */}
            {currentLesson && (
                <Card variant="glass" hover className={`${styles.continueLessonCard} fadeInUp`}>
                    <div className={styles.continueLessonContent}>
                        <div className={styles.continueLessonInfo}>
                            <Text variant="label" color="muted">{t(getLessonStatus(currentLesson.id) === 'in_progress' ? 'dashboard.continueLearning' : 'paths.startLearning')}</Text>
                            <Text variant="h2">{getText(currentLesson.titleTranslations, currentLesson.title)}</Text>
                            <Text variant="body" color="secondary">{getText(currentLesson.descriptionTranslations, currentLesson.description)}</Text>
                        </div>
                        <Button
                            href={`/paths/${getPathIdForLanguage(targetLanguage)}/${currentLesson.id}`}
                            className={styles.continueLessonButton}
                        >
                            <IoPlay aria-hidden="true" /> {t(getLessonStatus(currentLesson.id) === 'in_progress' ? 'common.continue' : 'common.start')}
                        </Button>
                    </div>
                </Card>
            )}

            {/* Gamification Section */}
            <div className={styles.gamificationSection}>
                <XPDisplay level={level} compact />
                <StreakBadge streak={streak} showMessage size="md" />
                <DailyGoalCard
                    dailyGoal={dailyGoal}
                    streak={streak}
                    todayXP={todayXP}
                    compact
                />
            </div>

            <div className={styles.statsOverview}>
                <Card variant="glass" hover className={`${styles.statCard} fadeInUp stagger-1`}>
                    <div className={styles.statIcon}><IoBook /></div>
                    <Text variant="h2" as="span" color="gold" className={styles.statValue}>
                        {summary.totalWords || 0}
                    </Text>
                    <Text variant="label" color="muted" className={styles.statLabel}>
                        {t('dashboard.wordsLearned')}
                    </Text>
                </Card>
                <Card variant="glass" hover className={`${styles.statCard} fadeInUp stagger-2`}>
                    <div className={styles.statIcon}><IoSchool /></div>
                    <Text variant="h2" as="span" color="gold" className={styles.statValue}>
                        {summary.totalKanji || 0}
                    </Text>
                    <Text variant="label" color="muted" className={styles.statLabel}>
                        {getStatLabel('characters', targetLanguage, t)}
                    </Text>
                </Card>
                <Card variant="glass" hover className={`${styles.statCard} fadeInUp stagger-3`}>
                    <div className={styles.statIcon}><IoTime /></div>
                    <Text variant="h2" as="span" color="gold" className={styles.statValue}>
                        {Math.round((summary.totalStudyTime || 0) / 60)}
                    </Text>
                    <Text variant="label" color="muted" className={styles.statLabel}>
                        {t('dashboard.studyTime')}
                    </Text>
                </Card>
            </div>

            <div className={styles.modulesGrid}>
                {filteredModules.map((module, index) => {
                    const moduleNames = getModuleName(module.id, targetLanguage, t);
                    return (
                        <Link key={module.id} href={module.href}>
                            <Card variant="glass" hover className={`${styles.moduleCard} fadeInUp stagger-${(index % 6) + 1}`}>
                                <div className={styles.moduleIcon}>{module.icon}</div>
                                <Text variant="h2" as="h3" className={styles.moduleTitle}>
                                    {moduleNames.title}
                                </Text>
                                <Text variant="body" color="secondary" className={styles.moduleDescription}>
                                    {moduleNames.description}
                                </Text>
                                <ProgressBar
                                    progress={moduleProgress[module.id] || 0}
                                    showText={true}
                                />
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className={styles.quickActions}>
                <Button href="/assessment/placement" variant="ghost" className={styles.quickActionButton}>
                    <PiExam aria-hidden="true" /> {t('dashboard.placementTest')}
                </Button>
                <Button href="/paths" variant="ghost" className={styles.quickActionButton}>
                    <IoMap aria-hidden="true" /> {t('dashboard.browsePaths')}
                </Button>
                <Button href="/review" variant="ghost" className={styles.quickActionButton}>
                    <IoRefresh aria-hidden="true" /> {t('dashboard.reviewDashboardStat')}
                </Button>
                <Button href="/pronunciation" variant="ghost" className={styles.quickActionButton}>
                    <IoHeadset aria-hidden="true" /> {t('dashboard.pronunciation')}
                </Button>
                <Button href="/leaderboard" variant="ghost" className={styles.quickActionButton}>
                    <IoTrophy aria-hidden="true" /> {t('dashboard.leaderboardStat')}
                </Button>
                <Button href="/settings" variant="ghost" className={styles.quickActionButton}>
                    <IoSettings aria-hidden="true" /> {t('dashboard.settingsStat')}
                </Button>
            </div>

            {/* Dashboard Widgets - collapsible on mobile */}
            {isMobile ? (
                <div className={styles.widgetsAccordion}>
                    <button
                        className={`${styles.widgetsToggle} ${showWidgets ? styles.widgetsToggleOpen : ''}`}
                        onClick={toggleWidgets}
                        aria-expanded={showWidgets}
                    >
                        <Text variant="label" color="muted">{t('dashboard.moreStats') || 'Activity & Progress'}</Text>
                        <IoChevronDown className={styles.widgetsToggleIcon} />
                    </button>
                    {showWidgets && (
                        <div className={styles.widgetsCollapsible}>
                            <div className={styles.widgetsSection}>
                                <LearningCompass className={styles.compassWidget} />
                                <MasteryHeatmap className={styles.heatmapWidget} />
                            </div>
                            <div className={styles.calendarSection}>
                                <StreakCalendar className={styles.calendarWidget} weeks={16} />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className={styles.widgetsSection}>
                        <LearningCompass className={styles.compassWidget} />
                        <MasteryHeatmap className={styles.heatmapWidget} />
                    </div>
                    <div className={styles.calendarSection}>
                        <StreakCalendar className={styles.calendarWidget} weeks={16} />
                    </div>
                </>
            )}

        </Container>
    );
}

export default memo(Dashboard);
