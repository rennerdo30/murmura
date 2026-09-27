'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
    IoHome, IoMap, IoRefresh, IoSettings, IoLibrary, IoMic, IoTrophy, IoSchool,
} from 'react-icons/io5';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { LEARNING_MODULES, getModuleIcon, getModuleName } from '@/lib/learningModules';
import Logo from './Logo';
import TargetLanguageSelector from './TargetLanguageSelector';
import LanguageSwitcher from './LanguageSwitcher';
import AuthButton from './AuthButton';
import styles from './AppSidebar.module.css';

interface SidebarLink {
    href: string;
    labelKey: string;
    icon: ReactNode;
}

const PRIMARY_LINKS: SidebarLink[] = [
    { href: '/', labelKey: 'nav.home', icon: <IoHome /> },
    { href: '/paths', labelKey: 'nav.paths', icon: <IoMap /> },
    { href: '/review', labelKey: 'nav.review', icon: <IoRefresh /> },
];

const SECONDARY_LINKS: SidebarLink[] = [
    { href: '/library', labelKey: 'nav.library', icon: <IoLibrary /> },
    { href: '/pronunciation', labelKey: 'nav.pronunciation', icon: <IoMic /> },
    { href: '/assessment/placement', labelKey: 'nav.placementTest', icon: <IoSchool /> },
    { href: '/leaderboard', labelKey: 'nav.leaderboard', icon: <IoTrophy /> },
    { href: '/settings', labelKey: 'nav.settings', icon: <IoSettings /> },
];

/** Desktop navigation rail (hidden below the desktop breakpoint, where BottomNavBar is used). */
export default function AppSidebar() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const { targetLanguage, isModuleEnabled } = useTargetLanguage();

    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

    const renderLink = (href: string, label: string, icon: ReactNode) => {
        const active = isActive(href);
        return (
            <li key={href}>
                <Link
                    href={href}
                    className={`${styles.link} ${active ? styles.active : ''}`}
                    aria-current={active ? 'page' : undefined}
                >
                    <span className={styles.icon} aria-hidden="true">{icon}</span>
                    <span className={styles.label}>{label}</span>
                </Link>
            </li>
        );
    };

    const modules = LEARNING_MODULES.filter((module) => isModuleEnabled(module.id));

    return (
        <aside className={styles.sidebar}>
            <Link href="/" className={styles.brand} aria-label={t('nav.home')}>
                <Logo showTagline={false} size="sm" />
            </Link>

            <div className={styles.language}>
                <TargetLanguageSelector />
            </div>

            <nav className={styles.nav} aria-label={t('nav.mainNavigation')}>
                <ul className={styles.list}>
                    {PRIMARY_LINKS.map((link) => renderLink(link.href, t(link.labelKey), link.icon))}
                </ul>

                {modules.length > 0 && (
                    <>
                        <p className={styles.sectionTitle}>{t('nav.learn')}</p>
                        <ul className={styles.list}>
                            {modules.map((module) => renderLink(
                                module.href,
                                getModuleName(module.id, targetLanguage, t).title,
                                getModuleIcon(module.id, targetLanguage, styles.glyph),
                            ))}
                        </ul>
                    </>
                )}

                <p className={styles.sectionTitle}>{t('nav.more')}</p>
                <ul className={styles.list}>
                    {SECONDARY_LINKS.map((link) => renderLink(link.href, t(link.labelKey), link.icon))}
                </ul>
            </nav>

            <div className={styles.footer}>
                <LanguageSwitcher />
                <AuthButton />
            </div>
        </aside>
    );
}
