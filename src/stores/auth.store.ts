import { create } from 'zustand';
import { authService, type AuthUser } from '../services/auth.service';

interface AuthState {
    user: AuthUser | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => boolean;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: authService.getCurrentUser(),
    isAuthenticated: authService.isAuthenticated(),

    login: (username: string, password: string) => {
        const user = authService.login(username, password);
        if (user) {
            set({ user, isAuthenticated: true });
            return true;
        }
        return false;
    },

    logout: () => {
        authService.logout();
        set({ user: null, isAuthenticated: false });
    },

    checkAuth: () => {
        const user = authService.getCurrentUser();
        set({ user, isAuthenticated: !!user });
    },
}));
