import type { ReactNode } from 'react';
import { IoBook, IoDocumentText, IoHeadset } from 'react-icons/io5';
import { PiExam } from 'react-icons/pi';
import type { ModuleName } from '@/lib/language';

/** Learning modules in display order, shared by the dashboard and the app sidebar. */
export interface LearningModuleDef {
    id: ModuleName;
    href: string;
}

export const LEARNING_MODULES: LearningModuleDef[] = [
    { id: 'alphabet', href: '/alphabet' },
    { id: 'vocabulary', href: '/vocabulary' },
    { id: 'kanji', href: '/kanji' },
    { id: 'grammar', href: '/grammar' },
    { id: 'reading', href: '/reading' },
    { id: 'listening', href: '/listening' },
];

/** Type guard for strings coming from data (e.g. milestone.module). */
export function isLearningModule(value: string): value is ModuleName {
    return LEARNING_MODULES.some((module) => module.id === value);
}

// Script glyphs that represent the alphabet / character modules for each language
const ALPHABET_GLYPHS: Record<string, string> = { ja: 'あ', ko: '한', zh: '拼', default: 'A' };
const CHARACTER_GLYPHS: Record<string, string> = { ja: '字', zh: '汉', default: '字' };

/** Icon for a module; alphabet and character modules show a glyph of the target language. */
export function getModuleIcon(moduleId: ModuleName, lang: string, glyphClassName?: string): ReactNode {
    switch (moduleId) {
        case 'alphabet':
            return <span className={glyphClassName}>{ALPHABET_GLYPHS[lang] || ALPHABET_GLYPHS.default}</span>;
        case 'kanji':
            return <span className={glyphClassName}>{CHARACTER_GLYPHS[lang] || CHARACTER_GLYPHS.default}</span>;
        case 'vocabulary':
            return <IoBook />;
        case 'grammar':
            return <PiExam />;
        case 'reading':
            return <IoDocumentText />;
        case 'listening':
            return <IoHeadset />;
        default:
            return null;
    }
}

/** Translated module title and description, with language-specific titles (Kanji, Hanzi, Hangul). */
export function getModuleName(moduleId: string, lang: string, t: (key: string) => string) {
    const specificTitleKey = moduleId === 'kanji' && lang === 'ja' ? 'modules.kanji.title_ja'
        : moduleId === 'kanji' && lang === 'zh' ? 'modules.kanji.title_zh'
            : moduleId === 'alphabet' && lang === 'ko' ? 'modules.alphabet.title_ko'
                : null;

    return {
        title: specificTitleKey ? t(specificTitleKey) : t(`modules.${moduleId}.title`),
        description: t(`modules.${moduleId}.description`),
    };
}
