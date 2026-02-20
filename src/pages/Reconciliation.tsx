import { useState, useEffect, useMemo } from 'react';
import { Upload, RefreshCw, CheckCircle, AlertCircle, AlertTriangle, FileText, Download, Search, Filter, ChevronLeft, ChevronRight, Settings, Calendar, DollarSign, Edit2, X, Save, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

interface ERPTransaction {
    id: string;
    IdCuponTarjetaCredito: string;
    IdTarjeta: string;
    CuponNumero: string;
    CuponFecha: string;
    CuponRazonSocial: string;
    CuponImporte: number;
    NumeroTarjeta: string;
    CuponDocumento: string;
    AcreditadoEnSeleccion: string;
    IdCierreTurno: string;
    IdCaja: string;
    TurnoDescripcion: string;
    IdLoteTarjetasCredito: string;
    LotePrefijo: string;
    LoteNumero: string;
    LoteFecha: string;
    LoteComprobante: string;
    NombreTarjeta: string;
    ComprobanteAcreditacion: string;
    Telefono: string;
    CodigoAprobacion: string;
    CuponPendiente: string;
    TipoAcreditacion: string;
    import_batch_id?: string;
    imported_at?: string;
}

interface ProviderTransaction {
    id: string;
    provider: string;
    original_card_name: string;
    normalized_card: string;
    coupon_number: string;
    auth_code: string;
    batch_number: string;
    transaction_date: string;
    amount: number;
    type: string;
}

interface MatchDetails {
    auth_match: boolean;
    card_match: boolean;
    date_match: boolean;
    amount_diff: number;
}

interface ReconciliationResult {
    erp_transaction: ERPTransaction | null;
    provider_transaction: ProviderTransaction | null;
    status: 'matched' | 'erp_only' | 'provider_only' | 'amount_mismatch';
    amount_difference: number;
    match_score?: number;
    match_details?: MatchDetails | null;
}

interface ReconciliationSummary {
    total: number;
    matched: number;
    erp_only: number;
    provider_only: number;
    amount_mismatch: number;
    options_used?: {
        amountTolerance: number;
        dateToleranceDays: number;
        useFuzzyCardMatching: boolean;
        useAmountFuzzyMatch: boolean;
    };
    results: ReconciliationResult[];
}

interface ReconciliationOptions {
    amountTolerance: number;
    dateToleranceDays: number;
    useFuzzyCardMatching: boolean;
    useAmountFuzzyMatch: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ITEMS_PER_PAGE = 50;

export function Reconciliation() {
    const [erpTransactions, setErpTransactions] = useState<ERPTransaction[]>([]);
    const [reconciliationResults, setReconciliationResults] = useState<ReconciliationSummary | null>(null);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [reconciling, setReconciling] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    
    // Filter states
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterProvider, setFilterProvider] = useState<string>('all');
    const [filterCard, setFilterCard] = useState<string>('all');
    const [minAmount, setMinAmount] = useState<string>('');
    const [maxAmount, setMaxAmount] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    
    // Reconciliation options
    const [showOptions, setShowOptions] = useState(false);
    const [reconcileOptions, setReconcileOptions] = useState<ReconciliationOptions>({
        amountTolerance: 1.0,
        dateToleranceDays: 2,
        useFuzzyCardMatching: true,
        useAmountFuzzyMatch: true
    });
    
    // Edit ERP values
    const [editingERP, setEditingERP] = useState<ERPTransaction | null>(null);
    const [editAmount, setEditAmount] = useState<string>('');
    const [saving, setSaving] = useState(false);
    
    // Export options
    const [showExportMenu, setShowExportMenu] = useState(false);

    useEffect(() => {
        loadERPTransactions();
        loadAvailableMonths();
    }, []);

    // Load available months with data
    const loadAvailableMonths = async () => {
        try {
            const response = await fetch(`${API_BASE}/available-months`);
            const data = await response.json();
            setAvailableMonths(data);
        } catch (error) {
            console.error('Error loading available months:', error);
        }
    };

    // Helper function to get month range
    const getMonthRange = (monthValue: string) => {
        if (!monthValue) return { start: '', end: '' };
        const [year, month] = monthValue.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
        
        const formatDate = (date: Date) => {
            return date.toISOString().split('T')[0];
        };
        
        return {
            start: formatDate(startDate),
            end: formatDate(endDate)
        };
    };

    // Handle month selection
    const handleMonthChange = (monthValue: string) => {
        setSelectedMonth(monthValue);
        if (monthValue) {
            const range = getMonthRange(monthValue);
            setStartDate(range.start);
            setEndDate(range.end);
        }
    };

    // Quick month buttons - only work if month has data
    const setThisMonth = () => {
        const now = new Date();
        const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (availableMonths.includes(monthValue)) {
            handleMonthChange(monthValue);
        }
    };

    const setLastMonth = () => {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthValue = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        if (availableMonths.includes(monthValue)) {
            handleMonthChange(monthValue);
        }
    };

    // Generate month options from available months with data
    const generateMonthOptions = () => {
        return availableMonths.map(monthValue => {
            const [year, month] = monthValue.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            return { value: monthValue, label: label.charAt(0).toUpperCase() + label.slice(1) };
        });
    };

    const loadERPTransactions = async () => {
        try {
            const response = await fetch(`${API_BASE}/erp-transactions`);
            const data = await response.json();
            setErpTransactions(data);
        } catch (error) {
            console.error('Error loading ERP transactions:', error);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportProgress(0);
        setImportTotal(0);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const totalRows = results.data.length;
                    setImportTotal(totalRows);
                    setImportProgress(0);

                    const batchId = uuidv4();
                    const importedAt = new Date().toISOString();

                    // Process rows and update progress
                    const transactions: ERPTransaction[] = results.data.map((row: any, index: number) => {
                        // Update progress every 10 rows or on last row
                        if (index % 10 === 0 || index === totalRows - 1) {
                            setImportProgress(index + 1);
                        }

                        return {
                            id: uuidv4(),
                            IdCuponTarjetaCredito: row.IdCuponTarjetaCredito || '',
                            IdTarjeta: row.IdTarjeta || '',
                            CuponNumero: row.CuponNumero || '',
                            CuponFecha: parseERPDate(row.CuponFecha),
                            CuponRazonSocial: row.CuponRazonSocial || '',
                            CuponImporte: parseERPNumber(row.CuponImporte),
                            NumeroTarjeta: row.NumeroTarjeta || '',
                            CuponDocumento: row.CuponDocumento || '',
                            AcreditadoEnSeleccion: row.AcreditadoEnSeleccion || '',
                            IdCierreTurno: row.IdCierreTurno || '',
                            IdCaja: row.IdCaja || '',
                            TurnoDescripcion: row.TurnoDescripcion || '',
                            IdLoteTarjetasCredito: row.IdLoteTarjetasCredito || '',
                            LotePrefijo: row.LotePrefijo || '',
                            LoteNumero: row.LoteNumero || '',
                            LoteFecha: row.LoteFecha || '',
                            LoteComprobante: row.LoteComprobante || '',
                            NombreTarjeta: row.NombreTarjeta || '',
                            ComprobanteAcreditacion: row.ComprobanteAcreditacion || '',
                            Telefono: row.Telefono || '',
                            CodigoAprobacion: row.CodigoAprobacion || '',
                            CuponPendiente: row.CuponPendiente || '',
                            TipoAcreditacion: row.TipoAcreditacion || '',
                            import_batch_id: batchId,
                            imported_at: importedAt
                        };
                    });

                    setImportProgress(totalRows);

                    // Save to database
                    const response = await fetch(`${API_BASE}/erp-transactions/bulk`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(transactions)
                    });

                    if (!response.ok) throw new Error('Failed to import transactions');

                    await loadERPTransactions();
                    alert(`Se importaron ${transactions.length} transacciones del ERP exitosamente`);
                } catch (error) {
                    console.error('Error importing ERP transactions:', error);
                    alert('Error al importar el archivo CSV');
                } finally {
                    setImporting(false);
                    setImportProgress(0);
                    setImportTotal(0);
                    e.target.value = ''; // Reset file input
                }
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                alert('Error al procesar el archivo CSV');
                setImporting(false);
                setImportProgress(0);
                setImportTotal(0);
            }
        });
    };

    const parseERPDate = (dateStr: string): string => {
        if (!dateStr) return '';
        // Format: "01/12/2025 00:00:00.000"
        try {
            const parts = dateStr.split(' ');
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
                const [day, month, year] = dateParts;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    const parseERPNumber = (numStr: string): number => {
        if (!numStr) return 0;
        // Format: "115829,00000000" (comma as decimal separator)
        try {
            return parseFloat(String(numStr).replace(',', '.'));
        } catch {
            return 0;
        }
    };

    const handleReconcile = async () => {
        if (!startDate || !endDate) {
            alert('Por favor selecciona un rango de fechas');
            return;
        }

        setReconciling(true);
        setCurrentPage(1); // Reset to first page
        try {
            const response = await fetch(`${API_BASE}/reconcile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    startDate, 
                    endDate,
                    options: reconcileOptions
                })
            });

            if (!response.ok) throw new Error('Failed to reconcile');

            const data: ReconciliationSummary = await response.json();
            setReconciliationResults(data);
        } catch (error) {
            console.error('Error reconciling:', error);
            alert('Error al conciliar las transacciones');
        } finally {
            setReconciling(false);
        }
    };

    const exportResults = () => {
        if (!reconciliationResults) return;

        // Export filtered results
        const dataToExport = filteredResults;
        
        const csvData = dataToExport.map(result => ({
            Estado: getStatusLabel(result.status),
            // ERP Data
            'ERP - Fecha': result.erp_transaction?.CuponFecha || '',
            'ERP - Tarjeta': result.erp_transaction?.NombreTarjeta || '',
            'ERP - Importe': result.erp_transaction?.CuponImporte || '',
            'ERP - Código Aprobación': result.erp_transaction?.CodigoAprobacion || '',
            'ERP - Lote': result.erp_transaction?.LoteNumero || '',
            'ERP - Documento': result.erp_transaction?.CuponDocumento || '',
            // Provider Data
            'Proveedor': result.provider_transaction?.provider || '',
            'Proveedor - Fecha': result.provider_transaction?.transaction_date || '',
            'Proveedor - Tarjeta': result.provider_transaction?.normalized_card || '',
            'Proveedor - Importe': result.provider_transaction?.amount || '',
            'Proveedor - Código Autorización': result.provider_transaction?.auth_code || '',
            'Proveedor - Lote': result.provider_transaction?.batch_number || '',
            // Difference
            'Diferencia': result.amount_difference || 0
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const monthLabel = selectedMonth ? selectedMonth.replace('-', '_') : `${startDate}_${endDate}`;
        const statusLabel = filterStatus !== 'all' ? `_${filterStatus}` : '';
        link.download = `conciliacion_${monthLabel}${statusLabel}.csv`;
        link.click();
    };

    // Export in ERP format (same columns as original ERP file)
    const exportERPFormat = () => {
        if (!reconciliationResults) return;

        const dataToExport = filteredResults;
        
        const erpData = dataToExport
            .filter(r => r.erp_transaction)
            .map(result => ({
                IdCuponTarjetaCredito: result.erp_transaction?.IdCuponTarjetaCredito || '',
                IdTarjeta: result.erp_transaction?.IdTarjeta || '',
                CuponNumero: result.erp_transaction?.CuponNumero || '',
                CuponFecha: result.erp_transaction?.CuponFecha || '',
                CuponRazonSocial: result.erp_transaction?.CuponRazonSocial || '',
                CuponImporte: result.erp_transaction?.CuponImporte || '',
                NumeroTarjeta: result.erp_transaction?.NumeroTarjeta || '',
                CuponDocumento: result.erp_transaction?.CuponDocumento || '',
                AcreditadoEnSeleccion: result.erp_transaction?.AcreditadoEnSeleccion || '',
                IdCierreTurno: result.erp_transaction?.IdCierreTurno || '',
                IdCaja: result.erp_transaction?.IdCaja || '',
                TurnoDescripcion: result.erp_transaction?.TurnoDescripcion || '',
                IdLoteTarjetasCredito: result.erp_transaction?.IdLoteTarjetasCredito || '',
                LotePrefijo: result.erp_transaction?.LotePrefijo || '',
                LoteNumero: result.erp_transaction?.LoteNumero || '',
                LoteFecha: result.erp_transaction?.LoteFecha || '',
                LoteComprobante: result.erp_transaction?.LoteComprobante || '',
                NombreTarjeta: result.erp_transaction?.NombreTarjeta || '',
                ComprobanteAcreditacion: result.erp_transaction?.ComprobanteAcreditacion || '',
                Telefono: result.erp_transaction?.Telefono || '',
                CodigoAprobacion: result.erp_transaction?.CodigoAprobacion || '',
                CuponPendiente: result.erp_transaction?.CuponPendiente || '',
                TipoAcreditacion: result.erp_transaction?.TipoAcreditacion || ''
            }));

        const csv = Papa.unparse(erpData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const monthLabel = selectedMonth ? selectedMonth.replace('-', '_') : `${startDate}_${endDate}`;
        const statusLabel = filterStatus !== 'all' ? `_${filterStatus}` : '';
        link.download = `erp_${monthLabel}${statusLabel}.csv`;
        link.click();
    };

    // Edit ERP transaction
    const openEditERP = (erpTransaction: ERPTransaction) => {
        setEditingERP(erpTransaction);
        setEditAmount(erpTransaction.CuponImporte?.toString() || '');
    };

    const saveEditERP = async () => {
        if (!editingERP) return;
        
        setSaving(true);
        try {
            const updatedTransaction = {
                ...editingERP,
                CuponImporte: parseFloat(editAmount) || 0
            };
            
            const response = await fetch(`${API_BASE}/erp-transactions/${editingERP.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTransaction)
            });
            
            if (!response.ok) throw new Error('Error al guardar');
            
            // Update local state
            setErpTransactions(prev => 
                prev.map(t => t.id === editingERP.id ? updatedTransaction : t)
            );
            
            // Re-run reconciliation to update results
            if (startDate && endDate) {
                handleReconcile();
            }
            
            setEditingERP(null);
            setEditAmount('');
        } catch (error) {
            console.error('Error saving ERP transaction:', error);
            alert('Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    const getStatusLabel = (status: string): string => {
        const labels: Record<string, string> = {
            matched: 'Conciliado',
            erp_only: 'Solo en ERP',
            provider_only: 'Solo en Proveedor',
            amount_mismatch: 'Diferencia de Monto'
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            matched: 'text-green-600 dark:text-green-400',
            erp_only: 'text-yellow-600 dark:text-yellow-400',
            provider_only: 'text-orange-600 dark:text-orange-400',
            amount_mismatch: 'text-red-600 dark:text-red-400'
        };
        return colors[status] || '';
    };

    const getStatusIcon = (status: string) => {
        const icons: Record<string, React.ReactElement> = {
            matched: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
            erp_only: <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
            provider_only: <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
            amount_mismatch: <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        };
        return icons[status] || null;
    };

    // Get unique providers and cards for filter dropdowns
    const uniqueProviders = useMemo(() => {
        if (!reconciliationResults) return [];
        const providers = new Set<string>();
        reconciliationResults.results.forEach(r => {
            if (r.provider_transaction?.provider) {
                providers.add(r.provider_transaction.provider);
            }
        });
        return Array.from(providers).sort();
    }, [reconciliationResults]);

    const uniqueCards = useMemo(() => {
        if (!reconciliationResults) return [];
        const cards = new Set<string>();
        reconciliationResults.results.forEach(r => {
            const card = r.erp_transaction?.NombreTarjeta || r.provider_transaction?.normalized_card;
            if (card) cards.add(card);
        });
        return Array.from(cards).sort();
    }, [reconciliationResults]);

    // Enhanced filtering with search, provider, card, and amount range
    const filteredResults = useMemo(() => {
        if (!reconciliationResults) return [];
        
        return reconciliationResults.results.filter(result => {
            // Status filter
            if (filterStatus !== 'all' && result.status !== filterStatus) return false;
            
            // Provider filter
            if (filterProvider !== 'all') {
                const resultProvider = result.provider_transaction?.provider;
                if (resultProvider !== filterProvider) return false;
            }
            
            // Card filter
            if (filterCard !== 'all') {
                const resultCard = result.erp_transaction?.NombreTarjeta || result.provider_transaction?.normalized_card;
                if (resultCard !== filterCard) return false;
            }
            
            // Amount range filter
            const erpAmount = result.erp_transaction?.CuponImporte || 0;
            const provAmount = result.provider_transaction?.amount || 0;
            const amount = erpAmount || provAmount;
            
            if (minAmount && amount < parseFloat(minAmount)) return false;
            if (maxAmount && amount > parseFloat(maxAmount)) return false;
            
            // Search query filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const searchableText = [
                    result.erp_transaction?.CodigoAprobacion,
                    result.erp_transaction?.NombreTarjeta,
                    result.erp_transaction?.CuponDocumento,
                    result.erp_transaction?.LoteNumero,
                    result.provider_transaction?.auth_code,
                    result.provider_transaction?.normalized_card,
                    result.provider_transaction?.provider,
                    result.provider_transaction?.batch_number
                ].filter(Boolean).join(' ').toLowerCase();
                
                if (!searchableText.includes(query)) return false;
            }
            
            return true;
        });
    }, [reconciliationResults, filterStatus, filterProvider, filterCard, minAmount, maxAmount, searchQuery]);

    // Pagination
    const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
    const paginatedResults = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredResults.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredResults, currentPage]);

    const handlePageChange = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const clearFilters = () => {
        setFilterStatus('all');
        setFilterProvider('all');
        setFilterCard('all');
        setMinAmount('');
        setMaxAmount('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const hasActiveFilters = filterStatus !== 'all' || filterProvider !== 'all' || filterCard !== 'all' || 
                            minAmount || maxAmount || searchQuery;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Conciliaciones</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Importa datos del ERP y concilia con las transacciones de los proveedores
                </p>
            </div>

            {/* Import Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Importar desde ERP
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {erpTransactions.length} transacciones en base de datos
                            </p>
                        </div>
                    </div>
                    <label className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium cursor-pointer hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        {importing ? 'Importando...' : 'Subir CSV'}
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={importing}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Progress Bar */}
                {importing && importTotal > 0 && (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">
                                Procesando registros...
                            </span>
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">
                                {importProgress} / {importTotal} ({Math.round((importProgress / importTotal) * 100)}%)
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300 ease-out rounded-full"
                                style={{ width: `${(importProgress / importTotal) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Reconciliation Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                        <RefreshCw className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Conciliar Transacciones
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    {/* Month Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Seleccionar Mes
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={e => handleMonthChange(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                            disabled={availableMonths.length === 0}
                        >
                            <option value="">{availableMonths.length === 0 ? 'Sin datos importados' : '-- Seleccionar --'}</option>
                            {generateMonthOptions().map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Fecha Inicio
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setSelectedMonth(''); }}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Fecha Fin
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setSelectedMonth(''); }}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleReconcile}
                            disabled={reconciling || !startDate || !endDate}
                            className="w-full px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <RefreshCw className={`w-5 h-5 ${reconciling ? 'animate-spin' : ''}`} />
                            {reconciling ? 'Conciliando...' : 'Conciliar'}
                        </button>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setShowOptions(!showOptions)}
                            className="w-full px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-medium hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                            <Settings className="w-5 h-5" />
                            Opciones
                        </button>
                    </div>
                </div>

                {/* Quick month buttons */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={setThisMonth}
                        disabled={(() => {
                            const now = new Date();
                            const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                            return !availableMonths.includes(monthValue);
                        })()}
                        className="px-4 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Este mes
                    </button>
                    <button
                        onClick={setLastMonth}
                        disabled={(() => {
                            const now = new Date();
                            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                            const monthValue = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
                            return !availableMonths.includes(monthValue);
                        })()}
                        className="px-4 py-1.5 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Mes anterior
                    </button>
                </div>

                {/* Reconciliation Options */}
                {showOptions && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Opciones de Conciliación
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    <DollarSign className="w-3 h-3 inline mr-1" />
                                    Tolerancia de Monto ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={reconcileOptions.amountTolerance}
                                    onChange={e => setReconcileOptions({...reconcileOptions, amountTolerance: parseFloat(e.target.value) || 0})}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    <Calendar className="w-3 h-3 inline mr-1" />
                                    Tolerancia de Días
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={reconcileOptions.dateToleranceDays}
                                    onChange={e => setReconcileOptions({...reconcileOptions, dateToleranceDays: parseInt(e.target.value) || 0})}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={reconcileOptions.useFuzzyCardMatching}
                                    onChange={e => setReconcileOptions({...reconcileOptions, useFuzzyCardMatching: e.target.checked})}
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                Matching difuso de tarjetas
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={reconcileOptions.useAmountFuzzyMatch}
                                    onChange={e => setReconcileOptions({...reconcileOptions, useAmountFuzzyMatch: e.target.checked})}
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                Matching difuso de montos
                            </label>
                        </div>
                    </div>
                )}

                {/* Results Summary */}
                {reconciliationResults && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border transition-all text-left ${filterStatus === 'all' ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700' : 'border-blue-200 dark:border-blue-800 hover:border-blue-400'}`}
                            >
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {reconciliationResults.total}
                                </div>
                                <div className="text-sm text-blue-700 dark:text-blue-300">Total</div>
                            </button>
                            <button
                                onClick={() => setFilterStatus('matched')}
                                className={`bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border transition-all text-left ${filterStatus === 'matched' ? 'border-green-500 ring-2 ring-green-300 dark:ring-green-700' : 'border-green-200 dark:border-green-800 hover:border-green-400'}`}
                            >
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {reconciliationResults.matched}
                                </div>
                                <div className="text-sm text-green-700 dark:text-green-300">Conciliados</div>
                            </button>
                            <button
                                onClick={() => setFilterStatus('erp_only')}
                                className={`bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg p-4 border transition-all text-left ${filterStatus === 'erp_only' ? 'border-yellow-500 ring-2 ring-yellow-300 dark:ring-yellow-700' : 'border-yellow-200 dark:border-yellow-800 hover:border-yellow-400'}`}
                            >
                                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                    {reconciliationResults.erp_only}
                                </div>
                                <div className="text-sm text-yellow-700 dark:text-yellow-300">Solo ERP</div>
                            </button>
                            <button
                                onClick={() => setFilterStatus('provider_only')}
                                className={`bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-4 border transition-all text-left ${filterStatus === 'provider_only' ? 'border-orange-500 ring-2 ring-orange-300 dark:ring-orange-700' : 'border-orange-200 dark:border-orange-800 hover:border-orange-400'}`}
                            >
                                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {reconciliationResults.provider_only}
                                </div>
                                <div className="text-sm text-orange-700 dark:text-orange-300">Solo Proveedor</div>
                            </button>
                            <button
                                onClick={() => setFilterStatus('amount_mismatch')}
                                className={`bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg p-4 border transition-all text-left ${filterStatus === 'amount_mismatch' ? 'border-red-500 ring-2 ring-red-300 dark:ring-red-700' : 'border-red-200 dark:border-red-800 hover:border-red-400'}`}
                            >
                                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {reconciliationResults.amount_mismatch}
                                </div>
                                <div className="text-sm text-red-700 dark:text-red-300">Dif. Monto</div>
                            </button>
                        </div>

                        {/* Filters and Export */}
                        <div className="space-y-4">
                            {/* Search and Quick Filters */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por código, tarjeta, lote..."
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 text-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                                        showFilters || hasActiveFilters
                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                                    }`}
                                >
                                    <Filter className="w-4 h-4" />
                                    Filtros
                                    {hasActiveFilters && (
                                        <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            !
                                        </span>
                                    )}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Exportar
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                                            <button
                                                onClick={() => { exportResults(); setShowExportMenu(false); }}
                                                className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 rounded-t-lg"
                                            >
                                                <Download className="w-4 h-4 text-purple-600" />
                                                <div>
                                                    <div className="font-medium">Conciliación</div>
                                                    <div className="text-xs text-gray-500">Archivo con datos comparados</div>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => { exportERPFormat(); setShowExportMenu(false); }}
                                                className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 rounded-b-lg border-t border-gray-100 dark:border-gray-700"
                                            >
                                                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                                <div>
                                                    <div className="font-medium">Formato ERP</div>
                                                    <div className="text-xs text-gray-500">Compatible con sistema ERP</div>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Advanced Filters */}
                            {showFilters && (
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Estado
                                            </label>
                                            <select
                                                value={filterStatus}
                                                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="all">Todos</option>
                                                <option value="matched">Conciliados</option>
                                                <option value="erp_only">Solo ERP</option>
                                                <option value="provider_only">Solo Proveedor</option>
                                                <option value="amount_mismatch">Diff. Monto</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Proveedor
                                            </label>
                                            <select
                                                value={filterProvider}
                                                onChange={e => { setFilterProvider(e.target.value); setCurrentPage(1); }}
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="all">Todos</option>
                                                {uniqueProviders.map(provider => (
                                                    <option key={provider} value={provider}>{provider}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Tarjeta
                                            </label>
                                            <select
                                                value={filterCard}
                                                onChange={e => { setFilterCard(e.target.value); setCurrentPage(1); }}
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="all">Todas</option>
                                                {uniqueCards.map(card => (
                                                    <option key={card} value={card}>{card}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Monto Mín.
                                            </label>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                value={minAmount}
                                                onChange={e => { setMinAmount(e.target.value); setCurrentPage(1); }}
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Monto Máx.
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="∞"
                                                    value={maxAmount}
                                                    onChange={e => { setMaxAmount(e.target.value); setCurrentPage(1); }}
                                                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                                />
                                                {hasActiveFilters && (
                                                    <button
                                                        onClick={clearFilters}
                                                        className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Limpiar filtros"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Results count */}
                            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                                <span>
                                    Mostrando <strong>{paginatedResults.length}</strong> de <strong>{filteredResults.length}</strong> resultados
                                    {hasActiveFilters && ' (filtrados)'}
                                </span>
                                {reconciliationResults.options_used && (
                                    <span className="text-xs">
                                        Tolerancia: ${reconciliationResults.options_used.amountTolerance.toFixed(2)} | 
                                        Días: ±{reconciliationResults.options_used.dateToleranceDays}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Fecha
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Tarjeta
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Lote
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Código Aut.
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            ERP Importe
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Proveedor Importe
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Diferencia
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Proveedor
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {paginatedResults.map((result, index) => (
                                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(result.status)}
                                                    <div>
                                                        <span className={`text-sm font-medium ${getStatusColor(result.status)}`}>
                                                            {getStatusLabel(result.status)}
                                                        </span>
                                                        {result.match_score !== undefined && result.match_score > 0 && (
                                                            <div className="text-xs text-gray-400">
                                                                Score: {result.match_score}%
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {result.erp_transaction?.CuponFecha || result.provider_transaction?.transaction_date || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {result.erp_transaction?.NombreTarjeta || result.provider_transaction?.normalized_card || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {result.erp_transaction?.LoteNumero || result.provider_transaction?.batch_number || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                                                {result.erp_transaction?.CodigoAprobacion || result.provider_transaction?.auth_code || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                ${result.erp_transaction?.CuponImporte?.toLocaleString() || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                ${result.provider_transaction?.amount?.toLocaleString() || '-'}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${result.amount_difference !== 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                                {result.amount_difference !== 0 ? `$${result.amount_difference.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {result.provider_transaction?.provider || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {result.erp_transaction && (
                                                    <button
                                                        onClick={() => openEditERP(result.erp_transaction!)}
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Editar valor ERP"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    
                                    {/* Page numbers */}
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum: number;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }
                                            
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => handlePageChange(pageNum)}
                                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                                        currentPage === pageNum
                                                            ? 'bg-purple-600 text-white'
                                                            : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit ERP Dialog */}
            {editingERP && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Editar Transacción ERP
                            </h3>
                            <button
                                onClick={() => setEditingERP(null)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-1">
                                <div className="text-xs text-gray-500">Fecha</div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {editingERP.CuponFecha}
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-1">
                                <div className="text-xs text-gray-500">Tarjeta</div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {editingERP.NombreTarjeta}
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-1">
                                <div className="text-xs text-gray-500">Lote / Autorización</div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {editingERP.LoteNumero} / {editingERP.CodigoAprobacion}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Importe ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 text-lg font-semibold"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setEditingERP(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveEditERP}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
