'use client';

import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
    /** A react-icons element shown in the icon tile. */
    icon: ReactNode;
    title: ReactNode;
    text?: ReactNode;
    /** Optional secondary line, e.g. which languages already have content. */
    note?: ReactNode;
    /** Buttons or links shown below the text. */
    actions?: ReactNode;
    /** Heading level of the title; pages that render a PageHeader use h2. */
    headingLevel?: 'h1' | 'h2' | 'h3';
    className?: string;
}

/** Shared "nothing here (yet)" surface: icon tile, title, text and actions. */
export default function EmptyState({
    icon,
    title,
    text,
    note,
    actions,
    headingLevel = 'h2',
    className = '',
}: EmptyStateProps) {
    const Heading = headingLevel;

    return (
        <section className={`${styles.emptyState} ${className}`}>
            <span className={styles.icon} aria-hidden="true">{icon}</span>
            <Heading className={styles.title}>{title}</Heading>
            {text && <p className={styles.text}>{text}</p>}
            {note && <p className={styles.note}>{note}</p>}
            {actions && <div className={styles.actions}>{actions}</div>}
        </section>
    );
}
