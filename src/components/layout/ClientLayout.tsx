'use client';

import { ReactNode } from 'react';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import BottomNavBar from '@/components/common/BottomNavBar';
import AppSidebar from '@/components/common/AppSidebar';
import styles from './ClientLayout.module.css';
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
      <div className={styles.layout}>
        <AppSidebar />
        <main id="main-content" className={styles.main}>
          {children}
        </main>
      </div>
      <BottomNavBar />
    </ErrorBoundary>
  );
}
