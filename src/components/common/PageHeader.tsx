'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    /** Parent page for nested pages. Top-level pages rely on the sidebar / bottom navigation. */
    backHref?: string;
    backLabel?: string;
    /** Optional controls shown at the end of the header row (buttons, filters). */
    actions?: ReactNode;
    className?: string;
}

/** Consistent, left-aligned page title block used by every page. */
export default function PageHeader({ title, subtitle, backHref, backLabel, actions, className = '' }: PageHeaderProps) {
    const { t } = useLanguage();
    const label = backLabel || t('common.back');

    return (
        <header className={`${styles.header} ${className}`}>
            {backHref && (
                <Link href={backHref} className={styles.back}>
                    <IoChevronBack aria-hidden="true" />
                    <span>{label}</span>
                </Link>
            )}
            <div className={styles.row}>
                <div className={styles.titles}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
                {actions && <div className={styles.actions}>{actions}</div>}
            </div>
        </header>
    );
}
