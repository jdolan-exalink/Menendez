import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { providerService } from '../services/provider.service';
import { csvParserService } from '../services/csv-parser.service';
import { normalizationService } from '../services/normalization.service';
import { dbService } from '../services/db.service';
import { generateUUID } from '../utils/uuid.utils';
import type { ProviderConfig } from '../types';

export const Import: React.FC = () => {
    const [providers, setProviders] = useState<ProviderConfig[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        loadProviders();
    }, []);

    const loadProviders = async () => {
        const data = await providerService.getAllProviders();
        setProviders(data);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleImport = async () => {
        if (!file || !selectedProvider) {
            alert('Por favor selecciona un proveedor y un archivo');
            return;
        }

        setImporting(true);
        setResult(null);

        try {
            const provider = providers.find((p) => p.id === selectedProvider);
            if (!provider) throw new Error('Proveedor no encontrado');

            // Generate batch ID
            const batchId = generateUUID();

            // Parse CSV with batch ID
            const parseResult = await csvParserService.parseFile(file, provider, batchId);

            if (parseResult.errors.length > 0) {
                setResult({
                    success: false,
                    message: `Errores: ${parseResult.errors.join(', ')}`,
                });
                return;
            }

            // Apply normalization
            const normalized = await normalizationService.applyNormalizations(parseResult.transactions);

            // Fetch existing transactions once for bulk duplicate detection
            const allExisting = await dbService.getAllTransactions();
            const existingMap = new Set(
                allExisting.map(t => {
                    const date = new Date(t.transaction_date);
                    return `${t.provider}|${t.coupon_number}|${date.getFullYear()}-${date.getMonth()}-${date.getDate()}|${Number(t.amount).toFixed(2)}`;
                })
            );

            // Detect duplicates
            let duplicateCount = 0;
            const uniqueTransactions = [];

            for (const transaction of normalized) {
                const date = transaction.transaction_date;
                const key = `${transaction.provider}|${transaction.coupon_number}|${date.getFullYear()}-${date.getMonth()}-${date.getDate()}|${Number(transaction.amount).toFixed(2)}`;

                if (!existingMap.has(key)) {
                    uniqueTransactions.push(transaction);
                } else {
                    duplicateCount++;
                }
            }

            // Save unique transactions to database in chunks
            const CHUNK_SIZE = 500;
            if (uniqueTransactions.length > 0) {
                for (let i = 0; i < uniqueTransactions.length; i += CHUNK_SIZE) {
                    const chunk = uniqueTransactions.slice(i, i + CHUNK_SIZE);
                    await dbService.addTransactions(chunk);
                }
            }

            // Create import batch record
            const totalAmount = uniqueTransactions.reduce((sum, t) => sum + t.amount, 0);
            await dbService.addImportBatch({
                id: batchId,
                provider: provider.name,
                filename: file.name,
                imported_at: new Date(),
                transaction_count: uniqueTransactions.length,
                total_amount: totalAmount,
                duplicate_count: duplicateCount,
            });

            // Log warnings to console for debugging
            if (parseResult.warnings.length > 0) {
                console.warn(`Import warnings (${parseResult.warnings.length} total):`, parseResult.warnings.slice(0, 10));
            }

            const warningsSummary = parseResult.warnings.length > 0
                ? `⚠️ ${parseResult.warnings.length} advertencias. Primera: ${parseResult.warnings[0]}`
                : '';

            const message = `✅ Importadas ${uniqueTransactions.length} transacciones exitosamente. ${duplicateCount > 0 ? `⚠️ ${duplicateCount} duplicados omitidos. ` : ''
                }${warningsSummary}`;

            setResult({
                success: true,
                message,
            });

            setFile(null);
            setSelectedProvider('');
        } catch (error) {
            console.error('CRITICAL IMPORT ERROR:', error);
            setResult({
                success: false,
                message: `Error crítico: ${error instanceof Error ? error.message : 'Error desconocido'}. Revisa la consola (F12) para más detalles.`,
            });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Importar CSV</h1>
                <p className="text-muted-foreground">
                    Carga archivos CSV de diferentes proveedores de pago
                </p>
            </div>

            <Card className="glass glass-dark max-w-2xl">
                <CardHeader>
                    <CardTitle>Subir Archivo</CardTitle>
                    <CardDescription>Selecciona el proveedor y el archivo CSV a importar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Proveedor</label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                        >
                            <option value="">Seleccionar proveedor...</option>
                            {providers.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Archivo CSV</label>
                        <div className="flex items-center space-x-2">
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="flex-1"
                            />
                            {file && (
                                <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
                                    <FileText className="w-4 h-4" />
                                    <span>{file.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {result && (
                        <div
                            className={`p-4 rounded-lg flex items-start space-x-3 ${result.success
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                }`}
                        >
                            {result.success ? (
                                <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            )}
                            <p className="text-sm">{result.message}</p>
                        </div>
                    )}

                    <Button
                        onClick={handleImport}
                        disabled={!file || !selectedProvider || importing}
                        className="w-full"
                        size="lg"
                    >
                        {importing ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Importando...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Importar Transacciones
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};
