'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const THEME_ORDER = ['system', 'light', 'dark'] as const;
type ThemeName = (typeof THEME_ORDER)[number];

const THEME_LABELS: Record<ThemeName, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
};

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const currentTheme: ThemeName = THEME_ORDER.includes(theme as ThemeName)
        ? theme as ThemeName
        : 'system';
    const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme) + 1) % THEME_ORDER.length];
    const Icon = currentTheme === 'light' ? Sun : currentTheme === 'dark' ? Moon : Monitor;

    return (
        <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            aria-label={`Theme: ${THEME_LABELS[currentTheme]}. Switch to ${THEME_LABELS[nextTheme]}.`}
            title={`Theme: ${THEME_LABELS[currentTheme]}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
    );
}
