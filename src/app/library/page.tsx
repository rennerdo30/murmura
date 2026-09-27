'use client';

import Link from 'next/link';
import PageHeader from '@/components/common/PageHeader';
import { Container } from '@/components/ui';
import { useTargetLanguage } from '@/hooks/useTargetLanguage';
import { useLanguage } from '@/context/LanguageProvider';
import { LEARNING_MODULES, getModuleIcon, getModuleName } from '@/lib/learningModules';
import { IoChevronForward } from 'react-icons/io5';
import styles from './library.module.css';

export default function LibraryPage() {
  const { targetLanguage, levels, isModuleEnabled } = useTargetLanguage();
  const { t } = useLanguage();

  const availableModules = LEARNING_MODULES.filter((module) => isModuleEnabled(module.id));

  return (
    <Container variant="dashboard">
      <PageHeader title={t('dashboard.library.title')} subtitle={t('library.browseDescription')} />

      <div className={styles.sections}>
        <section aria-labelledby="library-modules-title">
          <h2 id="library-modules-title" className={styles.sectionTitle}>{t('nav.learn')}</h2>
          <ul className={styles.modulesGrid}>
            {availableModules.map((module) => {
              const names = getModuleName(module.id, targetLanguage, t);
              return (
              <li key={module.id}>
                <Link href={module.href} className={styles.moduleCard}>
                  <span className={styles.moduleIcon} aria-hidden="true">
                    {getModuleIcon(module.id, targetLanguage, styles.moduleGlyph)}
                  </span>
                  <span className={styles.moduleContent}>
                    <span className={styles.moduleTitle}>{names.title}</span>
                    <span className={styles.moduleDescription}>{names.description}</span>
                  </span>
                  <IoChevronForward className={styles.chevron} aria-hidden="true" />
                </Link>
              </li>
              );
            })}
          </ul>
        </section>

        {levels && levels.length > 0 && (
          <section className={styles.levelsSection} aria-labelledby="library-levels-title">
            <h2 id="library-levels-title" className={styles.sectionTitle}>{t('library.filters.level')}</h2>
            <ul className={styles.levelsTags}>
              {levels.map((level) => (
                <li key={level.id} className={styles.levelTag}>
                  {level.name}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Container>
  );
}
