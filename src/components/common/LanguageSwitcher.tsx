'use client'

import { useState, useRef, useEffect, useCallback } from 'react';
import { IoChevronDown, IoCheckmark, IoLanguage } from 'react-icons/io5';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
    const { t, language, changeLanguage, supportedLanguages } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const currentLanguage = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setFocusedIndex(-1);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Focus the appropriate option when focusedIndex changes
    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
            optionRefs.current[focusedIndex]?.focus();
        }
    }, [focusedIndex, isOpen]);

    const handleLanguageChange = useCallback((langCode: string) => {
        changeLanguage(langCode);
        setIsOpen(false);
        setFocusedIndex(-1);
    }, [changeLanguage]);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (!isOpen) {
            // Open dropdown on Enter, Space, ArrowDown, or ArrowUp
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                setIsOpen(true);
                setFocusedIndex(0);
            }
            return;
        }

        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                setIsOpen(false);
                setFocusedIndex(-1);
                break;
            case 'ArrowDown':
                event.preventDefault();
                setFocusedIndex(prev =>
                    prev < supportedLanguages.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                event.preventDefault();
                setFocusedIndex(prev =>
                    prev > 0 ? prev - 1 : supportedLanguages.length - 1
                );
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < supportedLanguages.length) {
                    handleLanguageChange(supportedLanguages[focusedIndex].code);
                }
                break;
            case 'Tab':
                // Close on tab out
                setIsOpen(false);
                setFocusedIndex(-1);
                break;
            case 'Home':
                event.preventDefault();
                setFocusedIndex(0);
                break;
            case 'End':
                event.preventDefault();
                setFocusedIndex(supportedLanguages.length - 1);
                break;
        }
    }, [isOpen, focusedIndex, supportedLanguages, handleLanguageChange]);

    return (
        <div
            className={styles.languageSwitcher}
            ref={dropdownRef}
            onKeyDown={handleKeyDown}
        >
            <button
                className={styles.button}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setFocusedIndex(0);
                }}
                aria-label={t('common.changeLanguage')}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                {/* Icon instead of a flag emoji: Windows renders flags as letters ("US"), and a flag is a country, not a language */}
                <IoLanguage className={styles.icon} aria-hidden="true" />
                <span className={styles.code}>{currentLanguage.code.toUpperCase()}</span>
                <IoChevronDown className={styles.arrow} style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {isOpen && (
                <div
                    className={styles.dropdown}
                    role="listbox"
                    aria-label={t('common.selectLanguage')}
                    aria-activedescendant={focusedIndex >= 0 ? `lang-option-${supportedLanguages[focusedIndex].code}` : undefined}
                >
                    {supportedLanguages.map((lang, index) => (
                        <button
                            key={lang.code}
                            id={`lang-option-${lang.code}`}
                            ref={el => { optionRefs.current[index] = el; }}
                            className={`${styles.option} ${language === lang.code ? styles.active : ''}`}
                            onClick={() => handleLanguageChange(lang.code)}
                            role="option"
                            aria-selected={language === lang.code}
                            tabIndex={focusedIndex === index ? 0 : -1}
                        >
                            <span className={styles.optionCode} aria-hidden="true">{lang.code.toUpperCase()}</span>
                            <span className={styles.optionName}>{lang.name}</span>
                            {language === lang.code && <IoCheckmark className={styles.check} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
