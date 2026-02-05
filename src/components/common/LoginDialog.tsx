'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useLanguage } from '@/context/LanguageProvider';
import { IoMail, IoPerson, IoAlertCircle } from 'react-icons/io5';
import styles from './LoginDialog.module.css';

interface LoginDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

type AuthMode = 'select' | 'email-password' | 'anonymous';

// Convert Convex auth errors to user-friendly messages
function getAuthErrorMessage(error: unknown, t: (key: string) => string): string {
    const errorObj = error as { message?: string } | null;
    const message = errorObj?.message || String(error);

    // Invalid credentials / account not found
    if (message.includes('InvalidAccountId') || message.includes('InvalidSecret')) {
        return t('auth.loginDialog.errors.invalidCredentials');
    }

    // Account already exists
    if (message.includes('AccountAlreadyExists') || message.includes('already exists')) {
        return t('auth.loginDialog.errors.accountExists');
    }

    // Invalid email format
    if (message.includes('InvalidEmail') || message.includes('invalid email')) {
        return t('auth.loginDialog.errors.invalidEmail');
    }

    // Password too short/weak
    if (message.includes('password') && (message.includes('short') || message.includes('weak'))) {
        return t('auth.loginDialog.errors.passwordWeak');
    }

    // Rate limiting
    if (message.includes('rate') || message.includes('too many')) {
        return t('auth.loginDialog.errors.rateLimit');
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
        return t('auth.loginDialog.errors.network');
    }

    // Generic fallback
    return t('auth.loginDialog.errors.generic');
}

export default function LoginDialog({ isOpen, onClose }: LoginDialogProps) {
    const { signIn } = useAuthActions();
    const { t } = useLanguage();
    const [mode, setMode] = useState<AuthMode>('select');
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const dialogRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            setMode('select');
            setEmail('');
            setPassword('');
            setError('');
            setIsSignUp(false);
        }
    }, [isOpen]);

    // Store previously focused element and restore on close
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement as HTMLElement;
        } else if (previousActiveElement.current) {
            previousActiveElement.current.focus();
        }
    }, [isOpen]);

    // Focus trap: keep focus within dialog
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen || !dialogRef.current) return;

        if (e.key === 'Escape') {
            onClose();
            return;
        }

        if (e.key === 'Tab') {
            const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                // Shift+Tab: if on first element, go to last
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: if on last element, go to first
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    }, [isOpen, onClose]);

    // Attach keyboard listener for focus trap
    useEffect(() => {
        if (!isOpen) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleKeyDown]);

    // Focus first focusable element when dialog opens
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            // Small delay to ensure dialog is rendered
            setTimeout(() => {
                const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
                    'button:not([disabled]), input:not([disabled])'
                );
                firstFocusable?.focus();
            }, 100);
        }
    }, [isOpen, mode]);

    const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn('password', {
                flow: isSignUp ? 'signUp' : 'signIn',
                email,
                password,
            });
            onClose();
            setEmail('');
            setPassword('');
        } catch (err: unknown) {
            setError(getAuthErrorMessage(err, t));
        } finally {
            setLoading(false);
        }
    };

    const handleAnonymousSignIn = async () => {
        setError('');
        setLoading(true);

        try {
            await signIn('anonymous', {});
            onClose();
        } catch (err: unknown) {
            setError(getAuthErrorMessage(err, t));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className={styles.backdrop}
                onClick={onClose}
            />

            <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="login-dialog-title">
                <button
                    className={styles.close}
                    onClick={onClose}
                    aria-label={t('common.close')}
                >
                    ×
                </button>

                <h2 id="login-dialog-title" className={styles.title}>
                    {mode === 'select' && t('auth.signIn')}
                    {mode === 'email-password' && (isSignUp ? t('auth.loginDialog.title.createAccount') : t('auth.signIn'))}
                    {mode === 'anonymous' && t('auth.loginDialog.title.continueAnonymously')}
                </h2>

                {error && (
                    <div className={styles.error} role="alert">
                        <IoAlertCircle style={{ flexShrink: 0, fontSize: '1.2rem' }} />
                        {error}
                    </div>
                )}

                {mode === 'select' && (
                    <div className={styles.options}>
                        <button
                            className={styles.optionCard}
                            onClick={() => setMode('email-password')}
                            disabled={loading}
                        >
                            <div className={styles.optionIcon}><IoMail /></div>
                            <div className={styles.optionTitle}>{t('auth.loginDialog.emailPassword.title')}</div>
                            <div className={styles.optionDescription}>
                                {t('auth.loginDialog.emailPassword.description')}
                            </div>
                        </button>

                        <button
                            className={styles.optionCard}
                            onClick={handleAnonymousSignIn}
                            disabled={loading}
                        >
                            <div className={styles.optionIcon}><IoPerson /></div>
                            <div className={styles.optionTitle}>{t('auth.loginDialog.anonymous.title')}</div>
                            <div className={styles.optionDescription}>
                                {t('auth.loginDialog.anonymous.description')}
                            </div>
                        </button>
                    </div>
                )}

                {mode === 'email-password' && (
                    <form onSubmit={handleEmailPasswordSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="email" className={styles.label}>{t('auth.loginDialog.form.email')}</label>
                            <input
                                id="email"
                                type="email"
                                placeholder={t('auth.loginDialog.form.emailPlaceholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className={styles.input}
                                autoFocus
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="password" className={styles.label}>{t('auth.loginDialog.form.password')}</label>
                            <input
                                id="password"
                                type="password"
                                placeholder={isSignUp ? t('auth.loginDialog.form.passwordPlaceholderNew') : t('auth.loginDialog.form.passwordPlaceholderExisting')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={`${styles.button} ${styles.secondary}`}
                                onClick={() => setMode('select')}
                                disabled={loading}
                            >
                                {t('auth.loginDialog.form.back')}
                            </button>
                            <button
                                type="submit"
                                className={`${styles.button} ${styles.primary}`}
                                disabled={loading}
                            >
                                {loading ? t('auth.loading') : (isSignUp ? t('auth.loginDialog.form.signUp') : t('auth.signIn'))}
                            </button>
                        </div>

                        <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError('');
                            }}
                        >
                            {isSignUp ? t('auth.loginDialog.form.alreadyHaveAccount') : t('auth.loginDialog.form.dontHaveAccount')}
                        </button>
                    </form>
                )}

                {loading && mode === 'anonymous' && (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <p>{t('auth.loginDialog.signingIn')}</p>
                    </div>
                )}
            </div>
        </>
    );
}
