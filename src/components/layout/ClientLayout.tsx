'use client';

import { ReactNode } from 'react';
import LearningCompanion from '@/components/LearningCompanion/LearningCompanion';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import BottomNavBar from '@/components/common/BottomNavBar';
import { useLanguage } from '@/context/LanguageProvider';

function SkipLink() {
  const { t } = useLanguage();
  return (
    <a href="#main-content" className="skip-link">
      {t('common.skipToContent')}
    </a>
  );
}

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  // NOTE: Theme is applied by TargetLanguageProvider to avoid duplicate application
  // Do NOT add data-theme attribute here

  return (
    <ErrorBoundary>
      <SkipLink />
      <main id="main-content">
        {children}
      </main>
      <BottomNavBar />
      <LearningCompanion position="auto" />
    </ErrorBoundary>
  );
}
