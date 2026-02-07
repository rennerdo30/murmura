'use client'

import { useEffect, useState } from 'react';
import styles from './Timer.module.css';

interface TimerProps {
    timeLeft: number;
    totalTime: number;
    onTimeout?: () => void;
    className?: string;
}

export default function Timer({ timeLeft, totalTime, onTimeout, className = '' }: TimerProps) {
    const [progress, setProgress] = useState(100);
    const circumference = 2 * Math.PI * 22; // r=22 from SVG
    const isWarning = timeLeft <= 2;

    useEffect(() => {
        const newProgress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
        setProgress(newProgress);
    }, [timeLeft, totalTime]);

    useEffect(() => {
        if (timeLeft === 0 && onTimeout) {
            onTimeout();
        }
    }, [timeLeft, onTimeout]);

    const offset = circumference * (1 - (progress / 100));

    return (
        <div className={`${styles.timerRing} ${className}`}>
            <svg viewBox="0 0 48 48">
                <circle
                    className={styles.timerRingBg}
                    cx="24"
                    cy="24"
                    r="22"
                />
                <circle
                    className={`${styles.timerRingProgress} ${isWarning ? styles.warning : ''}`}
                    cx="24"
                    cy="24"
                    r="22"
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset: offset }}
                />
            </svg>
            <span className={styles.timerText}>{timeLeft}</span>
        </div>
    );
}
