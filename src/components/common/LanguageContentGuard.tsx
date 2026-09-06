'use client';

import { ReactNode } from 'react';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useLanguage } from '@/context/LanguageProvider';
import Navigation from '@/components/common/Navigation';
import { Container, Card, Text, Button } from '@/components/ui';
import { IoConstruct, IoArrowBack } from 'react-icons/io5';
import Link from 'next/link';

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
  const { targetLanguage, languageConfig } = useTargetLanguage();
  const { t } = useLanguage();

  // Use provided supported languages or fall back to default
  const availableLanguages = supportedLanguages || MODULE_DATA_AVAILABILITY[moduleName] || [];

  // Check if current language has data for this module
  const hasData = availableLanguages.includes(targetLanguage);

  if (!hasData) {
    return (
      <Container variant="centered">
        <Navigation />
        <Card variant="glass" style={{ maxWidth: '500px', margin: '2rem auto', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--accent-gold)' }}>
            <IoConstruct />
          </div>
          <Text variant="h2" align="center" style={{ marginBottom: '1rem' }}>
            {t('contentGuard.comingSoon')}
          </Text>
          <Text variant="body" color="secondary" align="center" style={{ marginBottom: '0.5rem' }}>
            {t('contentGuard.notAvailable', { language: languageConfig?.name || targetLanguage.toUpperCase() })}
          </Text>
          <Text variant="caption" color="muted" align="center" style={{ marginBottom: '2rem' }}>
            {t('contentGuard.availableFor', { languages: availableLanguages.length > 0 ? availableLanguages.map(l => l.toUpperCase()).join(', ') : t('contentGuard.noLanguages') })}
          </Text>
          <Button href="/" variant="primary">
            <IoArrowBack aria-hidden="true" />
            {t('common.dashboard')}
          </Button>
        </Card>
      </Container>
    );
  }

  return <>{children}</>;
}
