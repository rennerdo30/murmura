import { ReactNode } from 'react';
import styles from './StatTiles.module.css';

export interface StatTile {
    id: string;
    value: ReactNode;
    label: string;
}

interface StatTilesProps {
    items: StatTile[];
    className?: string;
}

/** Compact, evenly sized row of summary numbers shown above a module page. */
export default function StatTiles({ items, className = '' }: StatTilesProps) {
    return (
        <dl className={`${styles.row} ${className}`}>
            {items.map((item) => (
                <div key={item.id} className={styles.tile}>
                    <dt className={styles.label}>{item.label}</dt>
                    <dd className={styles.value}>{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
