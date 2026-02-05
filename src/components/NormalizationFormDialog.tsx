import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { normalizationService } from '../services/normalization.service';
import type { CardNormalization } from '../types';
import { Plus, X, CreditCard, ListFilter } from 'lucide-react';
import { DetectedCardsDialog } from './DetectedCardsDialog';

interface NormalizationFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    normalization?: CardNormalization;
}

export const NormalizationFormDialog: React.FC<NormalizationFormDialogProps> = ({
    open,
    onClose,
    onSave,
    normalization
}) => {
    const isEdit = !!normalization;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    // Form state
    const [normalizedName, setNormalizedName] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [originalNames, setOriginalNames] = useState<string[]>([]);
    const [newOriginalName, setNewOriginalName] = useState('');
    const [isDetectedCardsOpen, setIsDetectedCardsOpen] = useState(false);

    useEffect(() => {
        if (normalization) {
            setNormalizedName(normalization.normalized_name);
            setColor(normalization.color || '#3b82f6');
            setOriginalNames([...normalization.original_names]);
        } else {
            setNormalizedName('');
            setColor('#3b82f6');
            setOriginalNames([]);
        }
        setNewOriginalName('');
        setError('');
    }, [normalization, open]);

    const handleAddOriginalName = () => {
        const trimmed = newOriginalName.trim();
        if (!trimmed) return;

        if (originalNames.some(name => name.toLowerCase() === trimmed.toLowerCase())) {
            setError('Este alias ya está en la lista');
            return;
        }

        setOriginalNames([...originalNames, trimmed]);
        setNewOriginalName('');
        setError('');
    };

    const handleAddDetectedNames = (names: string[]) => {
        const uniqueNewNames = names.filter(name =>
            !originalNames.some(existing => existing.toLowerCase() === name.toLowerCase())
        );
        setOriginalNames([...originalNames, ...uniqueNewNames]);
    };

    const handleRemoveOriginalName = (index: number) => {
        setOriginalNames(originalNames.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!normalizedName.trim()) {
                throw new Error('El nombre normalizado es requerido');
            }
            if (originalNames.length === 0) {
                throw new Error('Debes agregar al menos un nombre original (alias)');
            }

            if (isEdit && normalization) {
                await normalizationService.updateNormalization(normalization.id, originalNames, normalizedName.trim(), color);
            } else {
                await normalizationService.addNormalization(originalNames, normalizedName.trim(), color);
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar la normalización');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent onClose={onClose}>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Editar Normalización' : 'Nueva Normalización'}
                    </DialogTitle>
                    <DialogDescription>
                        Define cómo se agrupan los distintos nombres de tarjetas bajo un nombre estándar.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <DialogBody>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Normalized Name */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Nombre Normalizado <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={normalizedName}
                                        onChange={(e) => setNormalizedName(e.target.value)}
                                        placeholder="Ej: Visa, Mastercard, MercadoPago QR"
                                        className="pl-10"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Este es el nombre que se mostrará en Dashboard y Reportes.
                                </p>
                            </div>

                            {/* Color Selection */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Color de Identificación
                                </label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="h-10 w-20 rounded border border-border bg-background cursor-pointer"
                                    />
                                    <Input
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        placeholder="#000000"
                                        className="font-mono"
                                    />
                                    <div
                                        className="h-10 w-10 rounded-full border border-border shadow-inner"
                                        style={{ backgroundColor: color }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Define un color para distinguir este grupo en los gráficos.
                                </p>
                            </div>

                            {/* Original Names (Aliases) */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Nombres Originales (Aliases) <span className="text-red-500">*</span>
                                </label>

                                <div className="flex space-x-2 mb-3">
                                    <Input
                                        value={newOriginalName}
                                        onChange={(e) => setNewOriginalName(e.target.value)}
                                        placeholder="Ej: VISA CREDITO, VISA DEBITO..."
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOriginalName())}
                                    />
                                    <Button type="button" onClick={handleAddOriginalName} variant="outline" size="sm">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setIsDetectedCardsOpen(true)}
                                        variant="outline"
                                        size="sm"
                                        className="border-primary/50 text-primary hover:bg-primary/5"
                                    >
                                        <ListFilter className="h-4 w-4 mr-2" />
                                        Detectadas
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30 min-h-[100px]">
                                    {originalNames.length === 0 ? (
                                        <div className="flex items-center justify-center w-full text-muted-foreground text-sm italic">
                                            No hay aliases agregados.
                                        </div>
                                    ) : (
                                        originalNames.map((name, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-sm"
                                            >
                                                {name}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveOriginalName(index)}
                                                    className="ml-2 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Agrega todos los nombres exactos que aparecen en tus archivos CSV.
                                </p>
                            </div>
                        </div>
                    </DialogBody>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Normalización')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            <DetectedCardsDialog
                open={isDetectedCardsOpen}
                onClose={() => setIsDetectedCardsOpen(false)}
                onSelect={handleAddDetectedNames}
                alreadySelected={originalNames}
            />
        </Dialog>
    );
};
