'use client'

import { SelectHTMLAttributes, forwardRef } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import styles from './Select.module.css';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    fullWidth?: boolean;
    /** Class for the wrapper element (layout); `className` goes to the <select>. */
    wrapperClassName?: string;
}

/** Native <select> styled to match the Input component. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(({
    fullWidth = false,
    wrapperClassName = '',
    className = '',
    children,
    ...props
}, ref) => {
    const wrapperClasses = [styles.wrapper, fullWidth && styles.fullWidth, wrapperClassName]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={wrapperClasses}>
            <select ref={ref} className={`${styles.select} ${className}`} {...props}>
                {children}
            </select>
            <IoChevronDown className={styles.chevron} aria-hidden="true" />
        </div>
    );
});

Select.displayName = 'Select';

export default Select;
