import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    List,
    Upload,
    History,
    Settings,
    Tag,
    FileText,
    Scale
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { FULL_VERSION } from '../../constants/version';

interface NavItem {
    to: string;
    icon: React.ElementType;
    label: string;
}

const navItems: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/reconciliation', icon: Scale, label: 'Conciliaciones' },
    { to: '/transactions', icon: List, label: 'Transacciones' },
    { to: '/import', icon: Upload, label: 'Importar' },
    { to: '/import-history', icon: History, label: 'Historial' },
    { to: '/providers', icon: Settings, label: 'Proveedores' },
    { to: '/normalization', icon: Tag, label: 'Normalización' },
];

export const Sidebar: React.FC = () => {
    return (
        <aside className="w-64 bg-card border-r border-border h-screen sticky top-0 flex flex-col">
            <div className="p-6 border-b border-border">
                <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-lg bg-primary">
                        <FileText className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-foreground">Menendez</h1>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Proveedores de Pagos</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200',
                                'hover:bg-accent hover:text-accent-foreground',
                                isActive
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground'
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={cn('w-5 h-5', isActive && 'animate-pulse')} />
                                <span className="font-medium">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-border/50 bg-accent/20">
                <div className="text-[10px] font-medium text-muted-foreground/60 text-center uppercase tracking-widest">
                    {FULL_VERSION}
                </div>
            </div>
        </aside>
    );
};
