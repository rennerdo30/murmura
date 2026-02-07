import { useCallback, useState } from 'react';
import { Text, Button } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { IoVolumeHigh, IoStop, IoEye, IoEyeOff, IoCheckmark } from 'react-icons/io5';
import { useTTS } from '@/hooks/useTTS';
import styles from './VocabularyLesson.module.css';

interface VocabularyLessonProps {
  word: string;               // The word in target language
  reading?: string;           // Reading/pronunciation (for Japanese, etc.)
  meaning: string;            // Meaning in UI language
  partOfSpeech?: string;      // noun, verb, adjective, etc.
  examples?: Array<{
    sentence: string;
    translation: string;
    audioUrl?: string;
  }>;
  audioUrl?: string;
  onMastered?: () => void;
}

export default function VocabularyLesson({
  word,
  reading,
  meaning,
  partOfSpeech,
  examples,
  audioUrl,
  onMastered,
}: VocabularyLessonProps) {
  const { t } = useLanguage();
  const { speak, stop, isPlaying } = useTTS();
  const [showMeaning, setShowMeaning] = useState(true);
  const [activeExample, setActiveExample] = useState<number | null>(null);

  const handleSpeak = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      speak(word, { audioUrl });
    }
  }, [word, audioUrl, speak, stop, isPlaying]);

  const handleExampleSpeak = useCallback((index: number) => {
    if (!examples) return;
    if (activeExample === index && isPlaying) {
      stop();
      setActiveExample(null);
    } else {
      setActiveExample(index);
      speak(examples[index].sentence, { audioUrl: examples[index].audioUrl });
    }
  }, [examples, activeExample, isPlaying, speak, stop]);

  return (
    <div className={styles.card}>
      <div className={styles.wordDisplay}>
        <Text className={styles.word}>{word}</Text>
        {reading && (
          <Text variant="body" color="muted" className={styles.reading}>
            {reading}
          </Text>
        )}
      </div>

      <div className={styles.controls}>
        <Button
          variant="ghost"
          size="md"
          onClick={handleSpeak}
          className={styles.audioButton}
          aria-label={isPlaying && activeExample === null ? t('common.stop') : t('common.listen')}
        >
          {isPlaying && activeExample === null ? <IoStop /> : <IoVolumeHigh />}
          <span>{isPlaying && activeExample === null ? t('common.stop') : t('common.listen')}</span>
        </Button>

        <Button
          variant="ghost"
          size="md"
          onClick={() => setShowMeaning(!showMeaning)}
          className={styles.toggleButton}
          aria-label={showMeaning ? t('common.hide') : t('common.show')}
        >
          {showMeaning ? <IoEyeOff /> : <IoEye />}
          <span>{showMeaning ? t('common.hide') : t('common.show')}</span>
        </Button>
      </div>

      <div className={`${styles.meaningSection} ${showMeaning ? styles.visible : styles.hidden}`}>
        {partOfSpeech && (
          <Text
            variant="caption"
            color="muted"
            className={styles.partOfSpeech}
            aria-label={t(`partOfSpeech.${partOfSpeech.toLowerCase()}`)}
          >
            {t(`partOfSpeech.${partOfSpeech.toLowerCase()}`)}
          </Text>
        )}
        <Text variant="h3" className={styles.meaning}>
          {meaning}
        </Text>
      </div>

      {examples && examples.length > 0 && (
        <div className={styles.examplesSection}>
          <Text variant="label" color="muted">{t('lessons.vocabulary.examples')}</Text>
          <div className={styles.examples}>
            {examples.map((example, idx) => (
              <div key={idx} className={styles.example}>
                <div className={styles.exampleMain}>
                  <Text variant="body" className={styles.exampleSentence}>
                    {example.sentence}
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExampleSpeak(idx)}
                    className={styles.exampleAudio}
                    aria-label={t('common.listen')}
                  >
                    {activeExample === idx && isPlaying ? <IoStop /> : <IoVolumeHigh />}
                  </Button>
                </div>
                <Text variant="caption" color="muted" className={styles.exampleTranslation}>
                  {example.translation}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {onMastered && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={onMastered}
            className={styles.masteredButton}
          >
            <IoCheckmark /> {t('common.iKnowThis')}
          </Button>
        </div>
      )}

      <div className={styles.footer}>
        <Text variant="caption" color="muted">
          {t('common.tapToContinue')}
        </Text>
      </div>
    </div>
  );
}
