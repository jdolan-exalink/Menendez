import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'app_theme';

const getInitialTheme = (): Theme => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
        return stored;
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: Theme) => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
};

export const useThemeStore = create<ThemeState>((set, get) => {
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);

    return {
        theme: initialTheme,

        toggleTheme: () => {
            const newTheme = get().theme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            set({ theme: newTheme });
        },

        setTheme: (theme: Theme) => {
            applyTheme(theme);
            set({ theme });
        },
    };
});
