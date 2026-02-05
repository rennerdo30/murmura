'use client'

import { useEffect, useState, useMemo, memo, useCallback } from 'react';
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
import { Container, Card, Text, Animated, Button } from '@/components/ui';
import { IoFlame, IoBook, IoSchool, IoTime, IoDocumentText, IoHeadset, IoMap, IoRefresh, IoTrophy, IoSettings, IoPlay, IoChevronDown } from 'react-icons/io5';
import { PiExam } from 'react-icons/pi';
import { useMobile } from '@/hooks/useMobile';
import LearningCompass from '@/components/dashboard/LearningCompass';
import MasteryHeatmap from '@/components/dashboard/MasteryHeatmap';
import StreakCalendar from '@/components/dashboard/StreakCalendar';
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
    const { summary, getModuleProgress, refresh, initialized } = useProgressContext();
    const { t } = useLanguage();
    const { getText } = useContentTranslation();
    const { targetLanguage, isModuleEnabled } = useTargetLanguage();
    const { level, streak, dailyGoal, todayXP, isLoading: gamificationLoading } = useGamification();
    const { lessons, lessonProgress, getLessonStatus } = useCurriculum();
    const isMobile = useMobile();
    const [moduleProgress, setModuleProgress] = useState<Record<string, number>>({});
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
        // Default to first lesson if all are locked or none available
        return lessons.length > 0 ? lessons[0].lesson : null;
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

    useEffect(() => {
        if (initialized && summary) {
            const progress: Record<string, number> = {};
            filteredModules.forEach(module => {
                progress[module.id] = getModuleProgress(module.id, module.totalItems);
            });
            setModuleProgress(progress);
        }
    }, [initialized, summary, getModuleProgress, refresh, filteredModules]);

    if (!summary) {
        return <Container variant="dashboard">{t('common.loading')}</Container>;
    }

    return (
        <Container variant="dashboard">
            <div className={styles.languageSwitcher}>
                <LanguageSwitcher />
            </div>
            <Animated animation="float" infinite className={styles.backgroundKanji} aria-hidden="true">
                {getBackgroundDecoration(targetLanguage)}
            </Animated>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div>


                        <svg className={styles.wordmark} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 220" role="img" aria-label={t('dashboard.title')}>
                            <defs>
                                <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#1a1a2e" />
                                    <stop offset="100%" stopColor="#0f0f1a" />
                                </linearGradient>
                                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#c41e3a" />
                                    <stop offset="50%" stopColor="#d4a574" />
                                    <stop offset="100%" stopColor="#c41e3a" />
                                </linearGradient>
                            </defs>

                            <g transform="translate(80,110)">
                                <circle r="70" fill="url(#bgGradient)" stroke="url(#ringGradient)" strokeWidth="4" />
                                <text x="0" y="0"
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize="68"
                                    fontWeight="700"
                                    fill="#f5f0e8"
                                    fontFamily="'Noto Sans JP','Hiragino Sans','Yu Gothic',system-ui,sans-serif">学</text>
                            </g>

                            <g transform="translate(190,0)">
                                <text x="0" y="118"
                                    fontSize="120"
                                    fontWeight="700"
                                    fill="#f5f0e8"
                                    letterSpacing="1.2"
                                    fontFamily="'Playfair Display','Libre Baskerville','Georgia',serif">{t('dashboard.title')}</text>

                                <g transform="translate(12,145)" fill="none" stroke="#d4a574" strokeLinecap="round" opacity="0.40">
                                    <path d="M0 0 C45 -24, 95 -24, 140 0 S235 24, 280 0" strokeWidth="4" />
                                    <path d="M0 18 C45 -6, 95 -6, 140 18 S235 42, 280 18" strokeWidth="3" opacity="0.6" />
                                </g>

                                <text x="12" y="196"
                                    fontSize="30"
                                    fill="#d4a574"
                                    opacity="0.85"
                                    letterSpacing="2.2"
                                    fontFamily="system-ui,-apple-system,'Segoe UI',Roboto,'Fira Sans',sans-serif">{t('dashboard.subtitle')}</text>
                            </g>
                        </svg>




                    </div>
                    <div className={styles.headerActions}>
                        <TargetLanguageSelector />
                        <AuthButton />
                    </div>
                </div>
            </header>

            {/* Continue Learning Card */}
            {currentLesson && (
                <Card variant="glass" hover className={`${styles.continueLessonCard} fadeInUp`}>
                    <div className={styles.continueLessonContent}>
                        <div className={styles.continueLessonInfo}>
                            <Text variant="label" color="muted">{t('dashboard.continueLearning')}</Text>
                            <Text variant="h2">{getText(currentLesson.titleTranslations, currentLesson.title)}</Text>
                            <Text variant="body" color="secondary">{getText(currentLesson.descriptionTranslations, currentLesson.description)}</Text>
                        </div>
                        <Link href={`/paths/${getPathIdForLanguage(targetLanguage)}/${currentLesson.id}`}>
                            <Button className={styles.continueLessonButton}>
                                <IoPlay /> {t('common.continue')}
                            </Button>
                        </Link>
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
                    <div className={styles.statIcon}><IoFlame /></div>
                    <Text variant="h2" color="gold" className={styles.statValue}>
                        {summary.streak || 0}
                    </Text>
                    <Text variant="label" color="muted" className={styles.statLabel}>
                        {t('dashboard.dayStreak')}
                    </Text>
                </Card>
                <Card variant="glass" hover className={`${styles.statCard} fadeInUp stagger-2`}>
                    <div className={styles.statIcon}><IoBook /></div>
                    <Text variant="h2" color="gold" className={styles.statValue}>
                        {summary.totalWords || 0}
                    </Text>
                    <Text variant="label" color="muted" className={styles.statLabel}>
                        {t('dashboard.wordsLearned')}
                    </Text>
                </Card>
                <Card variant="glass" hover className={`${styles.statCard} fadeInUp stagger-3`}>
                    <div className={styles.statIcon}><IoSchool /></div>
                    <Text variant="h2" color="gold" className={styles.statValue}>
                        {summary.totalKanji || 0}
                    </Text>
                    <Text variant="label" color="muted" className={styles.statLabel}>
                        {getStatLabel('characters', targetLanguage, t)}
                    </Text>
                </Card>
                <Card variant="glass" hover className={`${styles.statCard} fadeInUp stagger-4`}>
                    <div className={styles.statIcon}><IoTime /></div>
                    <Text variant="h2" color="gold" className={styles.statValue}>
                        {Math.round((summary.totalStudyTime || 0) / 60)}
                    </Text>
                    <Text variant="label" color="muted" className={styles.statLabel}>
                        {t('dashboard.studyTime')}
                    </Text>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className={styles.quickActions}>
                <Link href="/assessment/placement">
                    <Button variant="ghost" className={styles.quickActionButton}>
                        <PiExam /> {t('dashboard.placementTest')}
                    </Button>
                </Link>
                <Link href="/paths">
                    <Button variant="ghost" className={styles.quickActionButton}>
                        <IoMap /> {t('dashboard.browsePaths')}
                    </Button>
                </Link>
                <Link href="/review">
                    <Button variant="ghost" className={styles.quickActionButton}>
                        <IoRefresh /> {t('dashboard.reviewDashboardStat')}
                    </Button>
                </Link>
                <Link href="/pronunciation">
                    <Button variant="ghost" className={styles.quickActionButton}>
                        <IoHeadset /> {t('dashboard.pronunciation')}
                    </Button>
                </Link>
                <Link href="/leaderboard">
                    <Button variant="ghost" className={styles.quickActionButton}>
                        <IoTrophy /> {t('dashboard.leaderboardStat')}
                    </Button>
                </Link>
                <Link href="/settings">
                    <Button variant="ghost" className={styles.quickActionButton}>
                        <IoSettings /> {t('dashboard.settingsStat')}
                    </Button>
                </Link>
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

            <div className={styles.modulesGrid}>
                {filteredModules.map((module, index) => {
                    const moduleNames = getModuleName(module.id, targetLanguage, t);
                    return (
                        <Link key={module.id} href={module.href}>
                            <Card variant="glass" hover className={`${styles.moduleCard} fadeInUp stagger-${(index % 6) + 1}`}>
                                <div className={styles.moduleIcon}>{module.icon}</div>
                                <Text variant="h2" className={styles.moduleTitle}>
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
        </Container>
    );
}

export default memo(Dashboard);
