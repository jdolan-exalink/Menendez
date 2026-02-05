import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { dbService } from '../services/db.service';
import type { ImportBatch } from '../types';
import { Trash2, History, FileText, Calendar, Database, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const ImportHistory: React.FC = () => {
    const [batches, setBatches] = useState<ImportBatch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBatches();
    }, []);

    const loadBatches = async () => {
        setLoading(true);
        try {
            const data = await dbService.getAllImportBatches();
            setBatches(data);
        } catch (error) {
            console.error('Error loading import batches:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBatch = async (batch: ImportBatch) => {
        const confirmDelete = window.confirm(
            `¿Estás seguro de que deseas eliminar el lote de importación "${batch.filename}" de ${batch.provider}?\n\nEsta acción eliminará permanentemente las ${batch.transaction_count} transacciones asociadas.`
        );

        if (!confirmDelete) return;

        try {
            await dbService.deleteImportBatch(batch.id);
            await loadBatches();
        } catch (error) {
            console.error('Error deleting batch:', error);
            alert('Error al eliminar el lote');
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Historial de Importaciones</h1>
                <p className="text-muted-foreground">
                    Audita y gestiona tus lotes de datos importados
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {batches.length > 0 ? (
                    batches.map((batch) => (
                        <Card key={batch.id} className="glass glass-dark hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start space-x-4">
                                        <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold leading-none">{batch.filename}</h3>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                <div className="flex items-center">
                                                    <Database className="h-3.5 w-3.5 mr-1" />
                                                    {batch.provider}
                                                </div>
                                                <div className="flex items-center">
                                                    <Calendar className="h-3.5 w-3.5 mr-1" />
                                                    {format(new Date(batch.imported_at), "PPP 'a las' HH:mm", { locale: es })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                                                Transacciones
                                            </div>
                                            <div className="text-xl font-bold">{batch.transaction_count}</div>
                                        </div>

                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                                                Total Importe
                                            </div>
                                            <div className="text-xl font-bold text-primary">
                                                ${batch.total_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                            onClick={() => handleDeleteBatch(batch)}
                                            title="Eliminar lote e importaciones"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>

                                {batch.duplicate_count > 0 && (
                                    <div className="mt-4 flex items-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Se omitieron {batch.duplicate_count} transacciones duplicadas durante esta importación.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card className="glass glass-dark border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <History className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No hay historial</h3>
                            <p className="text-muted-foreground text-center max-w-md">
                                Aún no has importado ningún archivo CSV. Comienza desde la sección de Importar.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};
