'use client';

import { ReactNode } from 'react';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useLanguage } from '@/context/LanguageProvider';
import EmptyState from '@/components/common/EmptyState';
import { getLanguageName, formatList } from '@/lib/languageNames';
import { Container, Button } from '@/components/ui';
import { IoConstruct, IoHome } from 'react-icons/io5';

interface LanguageContentGuardProps {
  children: ReactNode;
  moduleName: string;
  /** Languages that have data for this module */
  supportedLanguages?: string[];
}

// Define which languages have actual DATA for each module
// This is separate from language-configs.json which defines which modules a language SHOULD have
// A language might have a module enabled but no data yet (shows "Coming Soon")
const MODULE_DATA_AVAILABILITY: Record<string, string[]> = {
  alphabet: ['ja', 'ko'],                                     // Japanese (Hiragana/Katakana), Korean (Hangul)
  vocabulary: ['ja', 'ko', 'zh', 'es', 'de', 'en', 'it'],     // Japanese, Korean, Chinese, Spanish, German, English, Italian
  kanji: ['ja', 'zh'],                                        // Japanese (Kanji), Chinese (Hanzi)
  grammar: ['ja', 'ko', 'zh', 'es', 'de', 'en', 'it'],        // Japanese, Korean, Chinese, Spanish, German, English, Italian
  reading: ['ja', 'ko', 'zh', 'es', 'de', 'en', 'it'],        // All languages with readings.json
  listening: ['ja', 'ko', 'zh', 'es', 'de', 'en', 'it'],      // All languages with listening.json
};

export default function LanguageContentGuard({
  children,
  moduleName,
  supportedLanguages
}: LanguageContentGuardProps) {
  const { targetLanguage } = useTargetLanguage();
  const { t, language } = useLanguage();

  // Use provided supported languages or fall back to default
  const availableLanguages = supportedLanguages || MODULE_DATA_AVAILABILITY[moduleName] || [];

  // Check if current language has data for this module
  const hasData = availableLanguages.includes(targetLanguage);

  if (!hasData) {
    return (
      <Container variant="dashboard">
        {/* No PageHeader here: the empty state title is the page heading */}
        <EmptyState
          headingLevel="h1"
          icon={<IoConstruct />}
          title={t('contentGuard.comingSoon')}
          text={t('contentGuard.notAvailable', { language: getLanguageName(targetLanguage, t) })}
          note={t('contentGuard.availableFor', {
            languages: availableLanguages.length > 0
              ? formatList(availableLanguages.map(code => getLanguageName(code, t)), language)
              : t('contentGuard.noLanguages'),
          })}
          actions={
            <Button href="/" variant="primary">
              <IoHome aria-hidden="true" />
              {t('common.dashboard')}
            </Button>
          }
        />
      </Container>
    );
  }

  return <>{children}</>;
}
