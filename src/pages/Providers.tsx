import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProviderFormDialog } from '../components/ProviderFormDialog';
import { ProviderDetailsDialog } from '../components/ProviderDetailsDialog';
import { dbService } from '../services/db.service';
import type { ProviderConfig } from '../types/provider.types';
import { Plus, Settings, Trash2, Edit } from 'lucide-react';
import { initializeProviderColors } from '../utils/providerColors';

export const Providers: React.FC = () => {
    const [providers, setProviders] = useState<ProviderConfig[]>([]);
    const [loading, setLoading] = useState(true);

    // Form Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<ProviderConfig | undefined>(undefined);

    // Details Dialog state
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [detailsProvider, setDetailsProvider] = useState<ProviderConfig | null>(null);

    useEffect(() => {
        loadProviders();
    }, []);

    const loadProviders = async () => {
        setLoading(true);
        try {
            await initializeProviderColors(); // Initialize color cache
            const data = await dbService.getAllProviders();
            setProviders(data);
        } catch (error) {
            console.error('Error loading providers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProvider = () => {
        setEditingProvider(undefined);
        setIsDialogOpen(true);
    };

    const handleEditProvider = (provider: ProviderConfig) => {
        setEditingProvider(provider);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingProvider(undefined);
    };

    const handleSaveProvider = async () => {
        await loadProviders();
    };

    const handleShowDetails = (provider: ProviderConfig) => {
        setDetailsProvider(provider);
        setIsDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setIsDetailsOpen(false);
        setDetailsProvider(null);
    };

    const handleColorChange = async (provider: ProviderConfig, newColor: string) => {
        try {
            const updatedProvider = {
                ...provider,
                color: newColor,
                updated_at: new Date()
            };

            await dbService.updateProvider(updatedProvider);
            await initializeProviderColors(); // Refresh color cache
            await loadProviders(); // Reload providers
        } catch (error) {
            console.error('Error updating provider color:', error);
            alert('Error al actualizar el color');
        }
    };

    const handleDeleteProvider = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro que deseas eliminar el proveedor "${name}"?`)) {
            return;
        }

        try {
            await dbService.deleteProvider(id);
            await loadProviders();
        } catch (error) {
            console.error('Error deleting provider:', error);
            alert('Error al eliminar el proveedor');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Proveedores</h1>
                    <p className="text-muted-foreground">
                        Gestiona la configuración de proveedores de pago
                    </p>
                </div>
                <Button
                    onClick={handleCreateProvider}
                    size="lg"
                >
                    <Plus className="h-5 w-5 mr-2" />
                    Agregar Proveedor
                </Button>
            </div>

            {/* Provider Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map((provider) => (
                    <Card key={provider.id} className="glass glass-dark hover:shadow-lg transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="relative group">
                                        <div className="flex items-center">
                                            <span
                                                className="px-3 py-1 rounded-lg text-lg font-bold text-white shadow-sm cursor-pointer transition-transform hover:scale-105"
                                                style={{ backgroundColor: provider.color || '#6b7280' }}
                                                title="Hacer clic para cambiar color"
                                            >
                                                {provider.name}

                                                {/* Hidden Color Picker on the badge */}
                                                <input
                                                    type="color"
                                                    value={provider.color || '#6b7280'}
                                                    onChange={(e) => handleColorChange(provider, e.target.value)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </span>
                                        </div>
                                        <CardDescription className="text-sm mt-2">
                                            {provider.delimiter === ';' ? 'Punto y coma' : 'Coma'} | {provider.dateFormat}
                                        </CardDescription>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Configuration Details */}
                            <div className="space-y-3 mb-4">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-muted-foreground">Delimitador:</div>
                                    <div className="font-medium">{provider.delimiter}</div>

                                    <div className="text-muted-foreground">Formato Fecha:</div>
                                    <div className="font-medium">{provider.dateFormat}</div>

                                    <div className="text-muted-foreground">Números:</div>
                                    <div className="font-medium">
                                        {provider.numberFormat === 'comma-decimal' ? 'Coma' : 'Punto'} decimal
                                    </div>

                                    <div className="text-muted-foreground">Omitir filas:</div>
                                    <div className="font-medium">{provider.skipRows}</div>
                                </div>

                                {/* Column Mappings */}
                                <div className="pt-3 border-t border-border">
                                    <div className="text-sm font-medium mb-2">Mapeo de Columnas</div>
                                    <div className="grid grid-cols-1 gap-1 text-xs">
                                        {Object.entries(provider.columnMapping).slice(0, 3).map(([key, value]) => (
                                            <div key={key} className="flex justify-between">
                                                <span className="text-muted-foreground">{key}:</span>
                                                <span className="font-mono text-xs text-primary">{value}</span>
                                            </div>
                                        ))}
                                        {Object.keys(provider.columnMapping).length > 3 && (
                                            <div className="text-muted-foreground italic">
                                                +{Object.keys(provider.columnMapping).length - 3} más...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-2 pt-3 border-t border-border">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleEditProvider(provider)}
                                >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleShowDetails(provider)}
                                >
                                    <Settings className="h-4 w-4 mr-2" />
                                    Detalles
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteProvider(provider.id, provider.name)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Empty State */}
            {providers.length === 0 && (
                <Card className="glass glass-dark">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Settings className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No hay proveedores configurados</h3>
                        <p className="text-muted-foreground mb-6 text-center max-w-md">
                            Comienza agregando un nuevo proveedor para importar transacciones
                        </p>
                        <Button onClick={handleCreateProvider}>
                            <Plus className="h-5 w-5 mr-2" />
                            Agregar Primer Proveedor
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Provider Form Dialog */}
            <ProviderFormDialog
                open={isDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveProvider}
                provider={editingProvider}
            />

            {/* Provider Details Dialog */}
            <ProviderDetailsDialog
                open={isDetailsOpen}
                onClose={handleCloseDetails}
                provider={detailsProvider}
            />
        </div>
    );
};
