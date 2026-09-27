'use client';

import { useId } from 'react';
import { useLanguage } from '@/context/LanguageProvider';
import { LOGO_GLYPHS } from './logoGlyphs';
import styles from './Logo.module.css';

/**
 * Murmura seal: 学 ("learn") at the centre, scripts from several languages
 * orbiting it. Geometry and outlined glyphs come from tools/logo/build_logo.py
 * (same source as public/logo.svg); colours follow the active language theme.
 */
const CENTER = 256;
const SEAL_RADIUS = 240;
const ORBIT_RADIUS = 184;
const BADGE_RADIUS = 30;

const ROLE_FILL: Record<'a' | 'b' | 'main', string> = {
    a: 'var(--accent-red)',
    b: 'var(--accent-gold)',
    main: 'var(--text-primary)',
};

interface LogoMarkProps {
    className?: string;
}

/** The seal on its own (decorative; pair it with a visible name). */
export function LogoMark({ className = '' }: LogoMarkProps) {
    const id = useId().replace(/:/g, '');
    const bgId = `murmura-seal-bg-${id}`;
    const ringId = `murmura-seal-ring-${id}`;

    return (
        <svg className={className} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--bg-secondary)" />
                    <stop offset="100%" stopColor="var(--bg-primary)" />
                </linearGradient>
                <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--accent-red)" />
                    <stop offset="50%" stopColor="var(--accent-gold)" />
                    <stop offset="100%" stopColor="var(--accent-red)" />
                </linearGradient>
            </defs>
            <circle cx={CENTER} cy={CENTER} r={SEAL_RADIUS} fill={`url(#${bgId})`} stroke={`url(#${ringId})`} strokeWidth="6" />
            <circle
                cx={CENTER}
                cy={CENTER}
                r={ORBIT_RADIUS}
                fill="none"
                stroke="var(--accent-gold)"
                strokeWidth="3"
                strokeDasharray="6 14"
                opacity="0.5"
            />
            {LOGO_GLYPHS.map((glyph) => (
                <g key={glyph.char}>
                    {glyph.role !== 'main' && (
                        <circle
                            cx={glyph.cx}
                            cy={glyph.cy}
                            r={BADGE_RADIUS}
                            fill="var(--bg-secondary)"
                            stroke="var(--accent-gold)"
                            strokeWidth="3"
                        />
                    )}
                    <path transform={glyph.transform} d={glyph.d} fill={ROLE_FILL[glyph.role]} />
                </g>
            ))}
        </svg>
    );
}

interface LogoProps {
    className?: string;
    showTagline?: boolean;
    /** md: page header lockup, sm: compact lockup for the sidebar and mobile top bar */
    size?: 'sm' | 'md';
}

/** Seal plus the translated product name and tagline. */
export default function Logo({ className = '', showTagline = true, size = 'md' }: LogoProps) {
    const { t } = useLanguage();
    return (
        <div className={`${styles.logo} ${size === 'sm' ? styles.small : ''} ${className}`}>
            <LogoMark className={styles.mark} />
            <div className={styles.text}>
                <span className={styles.name}>{t('dashboard.title')}</span>
                {showTagline && <span className={styles.tagline}>{t('dashboard.subtitle')}</span>}
            </div>
        </div>
    );
}
