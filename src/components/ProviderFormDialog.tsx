import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { ProviderConfig, ProviderMapping } from '../types/provider.types';
import { SYSTEM_FIELDS } from '../types/provider.types';
import { dbService } from '../services/db.service';
import { v4 as uuidv4 } from 'uuid';
import { Palette } from 'lucide-react';

interface ProviderFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    provider?: ProviderConfig; // Si se pasa, es edición. Si no, es creación
}

export const ProviderFormDialog: React.FC<ProviderFormDialogProps> = ({
    open,
    onClose,
    onSave,
    provider
}) => {
    const isEdit = !!provider;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        color: '#6b7280', // Gray default
        delimiter: ';' as ';' | ',',
        dateFormat: 'DD/MM/YYYY' as 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'ISO8601' | 'DD/MM/YYYY HH:mm:ss',
        numberFormat: 'comma-decimal' as 'comma-decimal' | 'dot-decimal',
        skipRows: 0
    });

    // Column mapping state
    const [columnMapping, setColumnMapping] = useState<ProviderMapping>({});

    // Initialize form with provider data if editing
    useEffect(() => {
        if (provider) {
            setFormData({
                name: provider.name,
                color: provider.color,
                delimiter: provider.delimiter,
                dateFormat: provider.dateFormat,
                numberFormat: provider.numberFormat,
                skipRows: provider.skipRows
            });
            setColumnMapping(provider.columnMapping);
        } else {
            // Reset form for new provider
            setFormData({
                name: '',
                color: '#6b7280',
                delimiter: ';',
                dateFormat: 'DD/MM/YYYY',
                numberFormat: 'comma-decimal',
                skipRows: 0
            });
            setColumnMapping({});
        }
        setError('');
    }, [provider, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'skipRows') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleMappingChange = (systemField: string, csvColumn: string) => {
        setColumnMapping(prev => {
            if (csvColumn === '') {
                // Remove mapping if empty
                const { [systemField]: _, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [systemField]: csvColumn
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Validation
            if (!formData.name.trim()) {
                throw new Error('El nombre del proveedor es requerido');
            }

            // Check for duplicate name (only when creating or changing name)
            const allProviders = await dbService.getAllProviders();
            const duplicateName = allProviders.find(p =>
                p.name.toLowerCase() === formData.name.trim().toLowerCase() &&
                p.id !== provider?.id
            );
            if (duplicateName) {
                throw new Error('Ya existe un proveedor con ese nombre');
            }

            // Create provider object
            const providerData: ProviderConfig = {
                id: provider?.id || uuidv4(),
                name: formData.name.trim(),
                color: formData.color,
                delimiter: formData.delimiter,
                dateFormat: formData.dateFormat,
                numberFormat: formData.numberFormat,
                skipRows: formData.skipRows,
                columnMapping: columnMapping,
                created_at: provider?.created_at || new Date(),
                updated_at: new Date()
            };

            // Save to database
            if (isEdit) {
                await dbService.updateProvider(providerData);
            } else {
                await dbService.addProvider(providerData);
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar el proveedor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent onClose={onClose}>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Modifica la configuración del proveedor de pago'
                            : 'Configura un nuevo proveedor de pago para importar archivos CSV'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <DialogBody>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* General Configuration */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-2">Configuración General</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Name */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-2">
                                        Nombre del Proveedor <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Ej: Payway, MercadoPago, etc."
                                        required
                                    />
                                </div>

                                {/* Color */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Color
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-700"
                                            style={{ backgroundColor: formData.color }}
                                        />
                                        <div className="flex-1 relative">
                                            <Input
                                                type="text"
                                                name="color"
                                                value={formData.color}
                                                onChange={handleChange}
                                                placeholder="#000000"
                                                pattern="^#[0-9A-Fa-f]{6}$"
                                            />
                                            <label className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer">
                                                <Palette className="h-4 w-4 text-muted-foreground" />
                                                <input
                                                    type="color"
                                                    value={formData.color}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Delimiter */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Delimitador <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="delimiter"
                                        value={formData.delimiter}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                    >
                                        <option value=";">Punto y coma (;)</option>
                                        <option value=",">Coma (,)</option>
                                    </select>
                                </div>

                                {/* Date Format */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Formato de Fecha <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="dateFormat"
                                        value={formData.dateFormat}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                    >
                                        <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                                        <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                                        <option value="ISO8601">ISO8601 (2025-12-31T23:59:59)</option>
                                        <option value="DD/MM/YYYY HH:mm:ss">DD/MM/YYYY HH:mm:ss</option>
                                    </select>
                                </div>

                                {/* Number Format */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Formato Numérico <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="numberFormat"
                                        value={formData.numberFormat}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        required
                                    >
                                        <option value="comma-decimal">Coma decimal (1.234,56)</option>
                                        <option value="dot-decimal">Punto decimal (1,234.56)</option>
                                    </select>
                                </div>

                                {/* Skip Rows */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Filas a Omitir
                                    </label>
                                    <Input
                                        type="number"
                                        name="skipRows"
                                        value={formData.skipRows}
                                        onChange={handleChange}
                                        min="0"
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Número de filas de encabezado a saltar
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Column Mapping */}
                        <div className="space-y-4 mt-6">
                            <h3 className="text-lg font-semibold border-b pb-2">Mapeo de Columnas</h3>
                            <p className="text-sm text-muted-foreground">
                                Mapea los nombres de las columnas del CSV a los campos del sistema
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {SYSTEM_FIELDS.map((field) => (
                                    <div key={field}>
                                        <label className="block text-sm font-medium mb-2 capitalize">
                                            {field.replace(/_/g, ' ')}
                                        </label>
                                        <Input
                                            type="text"
                                            value={columnMapping[field] || ''}
                                            onChange={(e) => handleMappingChange(field, e.target.value)}
                                            placeholder={`Nombre columna CSV para ${field}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-600 dark:text-blue-400">
                                <strong>💡 Tip:</strong> No es necesario mapear todas las columnas. Solo mapea las que están disponibles en tu CSV.
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
                            {loading ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Proveedor')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
