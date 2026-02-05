import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NormalizationFormDialog } from '../components/NormalizationFormDialog';
import { dbService } from '../services/db.service';
import { normalizationService } from '../services/normalization.service';
import type { CardNormalization } from '../types';
import { Plus, Search, Trash2, Edit, CreditCard, Tag } from 'lucide-react';
import { Input } from '../components/ui/Input';

export const Normalization: React.FC = () => {
    const [normalizations, setNormalizations] = useState<CardNormalization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingNormalization, setEditingNormalization] = useState<CardNormalization | undefined>(undefined);

    useEffect(() => {
        loadNormalizations();
    }, []);

    const loadNormalizations = async () => {
        setLoading(true);
        try {
            await normalizationService.loadNormalizations();
            const data = await dbService.getAllCardNormalizations();
            // Sort by normalized name
            const sorted = [...data].sort((a, b) => a.normalized_name.localeCompare(b.normalized_name));
            setNormalizations(sorted);
        } catch (error) {
            console.error('Error loading normalizations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNormalization = () => {
        setEditingNormalization(undefined);
        setIsDialogOpen(true);
    };

    const handleEditNormalization = (norm: CardNormalization) => {
        setEditingNormalization(norm);
        setIsDialogOpen(true);
    };

    const handleDeleteNormalization = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro que deseas eliminar la normalización para "${name}"?`)) {
            return;
        }

        try {
            await normalizationService.deleteNormalization(id);
            await loadNormalizations();
        } catch (error) {
            console.error('Error deleting normalization:', error);
            alert('Error al eliminar la normalización');
        }
    };

    const filteredNormalizations = normalizations.filter(norm =>
        norm.normalized_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        norm.original_names.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Normalización de Tarjetas</h1>
                    <p className="text-muted-foreground">
                        Gestiona los nombres estándar de tarjetas y sus variantes detectadas
                    </p>
                </div>
                <Button
                    onClick={handleCreateNormalization}
                    size="lg"
                    className="shrink-0"
                >
                    <Plus className="h-5 w-5 mr-2" />
                    Nueva Normalización
                </Button>
            </div>

            {/* Search and Filters */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por tarjeta o alias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Normalization List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredNormalizations.map((norm) => (
                    <Card key={norm.id} className="glass glass-dark group transition-all duration-300 hover:shadow-lg border-primary/10">
                        <CardHeader className="pb-3 text-white">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
                                        style={{ backgroundColor: norm.color || 'hsl(var(--primary))' }}
                                    >
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold">{norm.normalized_name}</CardTitle>
                                        <CardDescription className="text-xs">
                                            {norm.original_names.length} aliases asociados
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditNormalization(norm)}
                                        className="h-8 w-8 p-0"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteNormalization(norm.id, norm.normalized_name)}
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {norm.original_names.map((name, idx) => (
                                    <span
                                        key={idx}
                                        className="flex items-center space-x-1 px-3 py-1 bg-muted/30 border border-border/50 rounded-full text-xs text-muted-foreground group-hover:border-primary/30 transition-colors"
                                    >
                                        <Tag className="h-2 w-2 opacity-50" />
                                        <span>{name}</span>
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Empty State */}
            {filteredNormalizations.length === 0 && (
                <Card className="glass glass-dark">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CreditCard className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No se encontraron normalizaciones</h3>
                        <p className="text-muted-foreground mb-6 text-center max-w-md">
                            {searchTerm
                                ? `No hay resultados para "${searchTerm}". Intenta con otra búsqueda.`
                                : 'Comienza agregando una nueva regla de normalización para agrupar tus tarjetas.'}
                        </p>
                        {!searchTerm && (
                            <Button onClick={handleCreateNormalization}>
                                <Plus className="h-5 w-5 mr-2" />
                                Agregar Primera Normalización
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Form Dialog */}
            <NormalizationFormDialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onSave={loadNormalizations}
                normalization={editingNormalization}
            />
        </div>
    );
};
