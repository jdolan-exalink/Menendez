import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogBody, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import type { ProviderConfig } from '../types/provider.types';
import { SYSTEM_FIELDS } from '../types/provider.types';

interface ProviderDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    provider: ProviderConfig | null;
}

export const ProviderDetailsDialog: React.FC<ProviderDetailsDialogProps> = ({
    open,
    onClose,
    provider
}) => {
    if (!provider) return null;

    const mappedFields = Object.keys(provider.columnMapping);
    const unmappedFields = SYSTEM_FIELDS.filter(f => !mappedFields.includes(f));

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent onClose={onClose}>
                <DialogHeader>
                    <div className="flex items-center space-x-3">
                        <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: provider.color }}
                        >
                            {provider.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center">
                                <span
                                    className="px-3 py-1 rounded-lg text-xl font-bold text-white shadow-sm"
                                    style={{ backgroundColor: provider.color || '#6b7280' }}
                                >
                                    {provider.name}
                                </span>
                            </div>
                            <DialogDescription>
                                Detalles completos de configuración
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <DialogBody>
                    {/* General Configuration */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold border-b pb-2">Configuración General</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Nombre</div>
                                <div className="font-medium">{provider.name}</div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Color</div>
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-6 h-6 rounded border border-gray-300 dark:border-gray-700"
                                        style={{ backgroundColor: provider.color }}
                                    />
                                    <span className="font-mono text-sm">{provider.color}</span>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Delimitador</div>
                                <div className="font-medium">
                                    {provider.delimiter === ';' ? 'Punto y coma (;)' : 'Coma (,)'}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Formato de Fecha</div>
                                <div className="font-medium font-mono text-sm">{provider.dateFormat}</div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Formato Numérico</div>
                                <div className="font-medium">
                                    {provider.numberFormat === 'comma-decimal'
                                        ? 'Coma decimal (1.234,56)'
                                        : 'Punto decimal (1,234.56)'}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Filas a Omitir</div>
                                <div className="font-medium">{provider.skipRows}</div>
                            </div>
                        </div>
                    </div>

                    {/* Column Mappings */}
                    <div className="space-y-4 mt-6">
                        <h3 className="text-lg font-semibold border-b pb-2">
                            Mapeo de Columnas ({mappedFields.length}/{SYSTEM_FIELDS.length})
                        </h3>

                        {mappedFields.length > 0 ? (
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                                    ✓ Campos Mapeados
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.entries(provider.columnMapping).map(([systemField, csvColumn]) => (
                                        <div
                                            key={systemField}
                                            className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                                        >
                                            <span className="text-sm font-medium capitalize">
                                                {systemField.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-sm font-mono text-primary">
                                                "{csvColumn}"
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay campos mapeados
                            </div>
                        )}

                        {unmappedFields.length > 0 && (
                            <div className="space-y-2 mt-4">
                                <div className="text-sm font-medium text-muted-foreground mb-2">
                                    ○ Campos Sin Mapear
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {unmappedFields.map((field) => (
                                        <span
                                            key={field}
                                            className="px-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm capitalize"
                                        >
                                            {field.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="space-y-2 mt-6 pt-4 border-t border-border">
                        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                            <div>
                                <span className="font-medium">Creado:</span> {provider.created_at.toLocaleString('es-AR')}
                            </div>
                            <div>
                                <span className="font-medium">Actualizado:</span> {provider.updated_at.toLocaleString('es-AR')}
                            </div>
                        </div>
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button onClick={onClose}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
