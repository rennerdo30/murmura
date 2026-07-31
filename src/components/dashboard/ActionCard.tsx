'use client';

import Link from 'next/link';
import { Text, Button, Card } from '@/components/ui';
import { IconType } from 'react-icons';
import { IoChevronForward } from 'react-icons/io5';
import styles from './ActionCard.module.css';

interface ActionCardProps {
  title: string;
  description: string;
  icon: IconType;
  iconColor?: string;
  href: string;
  buttonText: string;
  metadata?: string;          // e.g., "42 items due" or "5 min"
  variant?: 'default' | 'highlight';
}

export default function ActionCard({
  title,
  description,
  icon: Icon,
  iconColor = 'var(--gold, #FFD700)',
  href,
  buttonText,
  metadata,
  variant = 'default',
}: ActionCardProps) {
  return (
    <Card
      variant="glass"
      className={`${styles.card} ${variant === 'highlight' ? styles.highlight : ''}`}
    >
      <div className={styles.content}>
        <div
          className={styles.iconWrapper}
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <Icon className={styles.icon} style={{ color: iconColor }} />
        </div>

        <div className={styles.textContent}>
          <Text variant="h3" className={styles.title}>{title}</Text>
          <Text variant="caption" color="muted">{description}</Text>
          {metadata && (
            <Text variant="label" className={styles.metadata}>
              {metadata}
            </Text>
          )}
        </div>
      </div>

      <Button
        href={href}
        variant={variant === 'highlight' ? 'primary' : 'secondary'}
        size="sm"
        className={styles.actionButton}
      >
        {buttonText} <IoChevronForward aria-hidden="true" />
      </Button>
    </Card>
  );
}
