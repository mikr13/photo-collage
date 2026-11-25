import React from 'react';
import { APP_NAME } from '@/utils/brand';

interface LogoMarkProps {
  size?: number;
  variant?: 'light' | 'dark';
  title?: string;
  className?: string;
}

export default function LogoMark({
  size = 40,
  variant = 'light',
  title = APP_NAME,
  className,
}: LogoMarkProps) {
  const backStroke = variant === 'dark' ? '#5EEAD4' : '#0F766E';
  const frontStroke = variant === 'dark' ? '#60A5FA' : '#2563EB';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect x="24" y="36" width="112" height="94" rx="16" stroke={backStroke} strokeWidth="10" opacity="0.5" />
      <rect x="54" y="64" width="122" height="102" rx="17" fill="#F8FAFC" stroke={frontStroke} strokeWidth="8" />
      <circle cx="140" cy="94" r="12" fill="#2DD4BF" />
      <path d="M68 150l31-37 22 24 17-19 25 32H68z" fill="#1D4ED8" />
    </svg>
  );
}
