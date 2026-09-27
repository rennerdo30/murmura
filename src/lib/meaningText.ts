/** Separators that start an explanation after the gloss: "Electric train - the most common form…". */
const EXPLANATION_SEPARATOR = /\s+[-–—]\s+|\s*[;:]\s+/;
/** End of the first sentence. */
const SENTENCE_END = /\.\s+/;

/**
 * Short gloss for a meaning that may carry a long explanation,
 * e.g. "Electric train - the most common form of public transport…" -> "Electric train".
 */
export function shortMeaning(meaning: string): string {
    const gloss = meaning.split(EXPLANATION_SEPARATOR)[0].split(SENTENCE_END)[0].trim();
    return gloss.replace(/\.$/, '') || meaning.trim();
}
