export interface AuthUser {
    username: string;
}

class AuthService {
    private readonly STORAGE_KEY = 'auth_user';
    private readonly DEFAULT_USERNAME = 'admin';
    private readonly DEFAULT_PASSWORD = 'admin123';

    login(username: string, password: string): AuthUser | null {
        if (username === this.DEFAULT_USERNAME && password === this.DEFAULT_PASSWORD) {
            const user: AuthUser = { username };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
            return user;
        }
        return null;
    }

    logout(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    getCurrentUser(): AuthUser | null {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return null;

        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }

    isAuthenticated(): boolean {
        return this.getCurrentUser() !== null;
    }
}

export const authService = new AuthService();
