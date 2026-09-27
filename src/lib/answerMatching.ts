import { toHiragana } from 'wanakana';

/** Separators between alternative meanings in data such as "one, one radical (no.1)". */
const MEANING_SEPARATOR = /[,;/、，；]/;
/** Parenthetical notes like "(no.1)" or "(radical)". */
const PARENTHETICAL = /[(（][^)）]*[)）]/g;
/** Okurigana dot and affix dashes used in kun'yomi notation (ひと.つ, ひと-). */
const KANA_NOTATION = /[.\-‐－]/g;
/** Combining diacritics after NFD normalisation (pinyin tone marks, accents). */
const DIACRITICS = /[\u0300-\u036f]/g;

const normalizeText = (value: string): string =>
    value.normalize('NFD').replace(DIACRITICS, '').replace(PARENTHETICAL, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** Every accepted form of the given meaning strings: the full text and each listed alternative. */
export function meaningVariants(meanings: Array<string | undefined | null>): Set<string> {
    const variants = new Set<string>();
    for (const meaning of meanings) {
        if (!meaning) continue;
        const full = normalizeText(meaning);
        if (full) variants.add(full);
        for (const part of meaning.split(MEANING_SEPARATOR)) {
            const normalized = normalizeText(part);
            if (normalized) variants.add(normalized);
        }
    }
    return variants;
}

/** Whether `input` matches one of the meanings (any listed alternative, case/accents ignored). */
export function matchesMeaning(input: string, meanings: Array<string | undefined | null>): boolean {
    const normalized = normalizeText(input);
    return normalized.length > 0 && meaningVariants(meanings).has(normalized);
}

/** Kana readings in comparable form: hiragana, without notation marks, plus the stem before an okurigana dot. */
function kanaReadingVariants(reading: string): string[] {
    // Strip notation before converting: toHiragana would turn "." into "。"
    const trimmed = reading.trim();
    const full = toHiragana(trimmed.replace(KANA_NOTATION, ''));
    const stem = toHiragana(trimmed.split('.')[0].replace(KANA_NOTATION, ''));
    return [full, stem].filter(Boolean);
}

/**
 * Whether `input` matches one of the readings.
 * Japanese: romaji, katakana and hiragana input are all accepted (converted to hiragana).
 * Other languages (e.g. pinyin): case- and tone-mark-insensitive comparison.
 */
export function matchesReading(input: string, readings: string[], language: string): boolean {
    if (!input.trim()) return false;
    if (language === 'ja') {
        const normalizedInput = toHiragana(input.trim().toLowerCase().replace(KANA_NOTATION, ''));
        return readings.some((reading) => kanaReadingVariants(reading).includes(normalizedInput));
    }
    const normalizedInput = normalizeText(input).replace(/\s+/g, '');
    return readings.some((reading) => normalizeText(reading).replace(/\s+/g, '') === normalizedInput);
}
