import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onClose, children }) => {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [open]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog Content */}
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
                {children}
            </div>
        </div>
    );
};

interface DialogContentProps {
    children: React.ReactNode;
    onClose: () => void;
}

export const DialogContent: React.FC<DialogContentProps> = ({ children, onClose }) => {
    return (
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800">
            <button
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Cerrar"
            >
                <X className="h-5 w-5" />
            </button>
            {children}
        </div>
    );
};

interface DialogHeaderProps {
    children: React.ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
    return (
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
            {children}
        </div>
    );
};

interface DialogTitleProps {
    children: React.ReactNode;
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children }) => {
    return (
        <h2 className="text-2xl font-bold tracking-tight pr-8">
            {children}
        </h2>
    );
};

interface DialogDescriptionProps {
    children: React.ReactNode;
}

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children }) => {
    return (
        <p className="text-sm text-muted-foreground mt-1">
            {children}
        </p>
    );
};

interface DialogBodyProps {
    children: React.ReactNode;
}

export const DialogBody: React.FC<DialogBodyProps> = ({ children }) => {
    return (
        <div className="px-6 py-6">
            {children}
        </div>
    );
};

interface DialogFooterProps {
    children: React.ReactNode;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ children }) => {
    return (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            {children}
        </div>
    );
};
