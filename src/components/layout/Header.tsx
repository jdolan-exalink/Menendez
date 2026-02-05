import React from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';
import { Button } from '../ui/Button';
import { LogOut, Moon, Sun, User } from 'lucide-react';

export const Header: React.FC = () => {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const { theme, toggleTheme } = useThemeStore();

    return (
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="h-full px-6 flex items-center justify-between">
                <div className="flex-1">
                    {/* Page title will be rendered by each page */}
                </div>

                <div className="flex items-center space-x-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="relative group"
                    >
                        {theme === 'dark' ? (
                            <Sun className="w-5 h-5 transition-transform group-hover:rotate-180 duration-300" />
                        ) : (
                            <Moon className="w-5 h-5 transition-transform group-hover:-rotate-12 duration-300" />
                        )}
                    </Button>

                    <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-accent/50">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{user?.username}</span>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={logout}
                        className="group"
                    >
                        <LogOut className="w-4 h-4 mr-2 transition-transform group-hover:translate-x-1" />
                        Salir
                    </Button>
                </div>
            </div>
        </header>
    );
};
