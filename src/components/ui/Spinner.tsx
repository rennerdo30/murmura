'use client'

import { HTMLAttributes, memo } from 'react';
import styles from './Spinner.module.css';

interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
    size?: 'sm' | 'md' | 'lg';
    /** Accessible name. Omit when a visible label sits next to the spinner. */
    label?: string;
}

/**
 * Purely decorative by default: wrap it in an element with role="status" and a
 * visible label, or pass `label` when the spinner stands on its own.
 */
const Spinner = memo(function Spinner({
    size = 'md',
    label,
    className = '',
    ...props
}: SpinnerProps) {
    const classes = [styles.spinner, styles[size], className].filter(Boolean).join(' ');

    return (
        <span
            className={classes}
            role={label ? 'status' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            {...props}
        />
    );
});

export default Spinner;
