'use client'

import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, memo } from 'react';
import Link from 'next/link';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    children: ReactNode;
}

type ButtonAsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
};

type ButtonAsLink = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    /**
     * When set, the button renders as a Next.js link. Use this instead of
     * wrapping a <Button> in a <Link>: a button nested inside an anchor is
     * invalid HTML and gives keyboard users two stops for one action.
     */
    href: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const Button = memo(function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
    ...props
}: ButtonProps) {
    const classes = [
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className
    ].filter(Boolean).join(' ');

    if (typeof props.href === 'string') {
        const { href, ...linkProps } = props as ButtonAsLink;
        return (
            <Link href={href} className={classes} {...linkProps}>
                {children}
            </Link>
        );
    }

    const { href: _ignored, ...buttonProps } = props as ButtonAsButton;
    return (
        <button className={classes} {...buttonProps}>
            {children}
        </button>
    );
});

export default Button;
