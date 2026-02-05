'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IoHome, IoBook, IoMap, IoRefresh, IoSettings } from 'react-icons/io5';
import { useLanguage } from '@/context/LanguageProvider';
import styles from './BottomNavBar.module.css';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  labelKey: string;
  matchPaths: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: <IoHome />, labelKey: 'nav.home', matchPaths: ['/'] },
  { href: '/vocabulary', icon: <IoBook />, labelKey: 'nav.vocabulary', matchPaths: ['/vocabulary', '/grammar', '/kanji', '/alphabet', '/reading', '/listening'] },
  { href: '/paths', icon: <IoMap />, labelKey: 'nav.paths', matchPaths: ['/paths'] },
  { href: '/review', icon: <IoRefresh />, labelKey: 'nav.review', matchPaths: ['/review'] },
  { href: '/settings', icon: <IoSettings />, labelKey: 'nav.settings', matchPaths: ['/settings'] },
];

export default function BottomNavBar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isActive = (item: NavItem) => {
    if (item.href === '/' && pathname === '/') return true;
    if (item.href === '/') return false;
    return item.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  };

  return (
    <>
      <nav className={styles.bottomNav} aria-label={t('nav.mainNavigation') || 'Main navigation'}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.active : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.navLabel}>{t(item.labelKey) || item.labelKey.split('.')[1]}</span>
            </Link>
          );
        })}
      </nav>
      <div className={styles.bottomNavSpacer} aria-hidden="true" />
    </>
  );
}
