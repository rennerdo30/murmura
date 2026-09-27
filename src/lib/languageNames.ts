type Translate = (key: string, params?: Record<string, string | number>) => string;

const LANGUAGE_KEY_PREFIX = 'languages.';

/** Localized display name of a target language, falling back to the upper-cased code. */
export function getLanguageName(code: string, t: Translate): string {
    const key = `${LANGUAGE_KEY_PREFIX}${code}`;
    const name = t(key);
    return name === key ? code.toUpperCase() : name;
}

/** Locale-aware list ("A, B and C"), falling back to a comma list where Intl.ListFormat is missing. */
export function formatList(items: string[], locale: string): string {
    try {
        return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
    } catch {
        return items.join(', ');
    }
}
