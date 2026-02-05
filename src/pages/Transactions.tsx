import React, { useEffect, useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { TransactionFormDialog } from '../components/TransactionFormDialog';
import { dbService } from '../services/db.service';
import { normalizationService } from '../services/normalization.service';
import type { Transaction } from '../types';
import { Plus, Search, Download, ArrowUpDown, Edit, Trash2, Filter, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, max } from 'date-fns';
import { es } from 'date-fns/locale';
import { getProviderColor, initializeProviderColors } from '../utils/providerColors';
import { cn } from '../lib/utils';

export const Transactions: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [sorting, setSorting] = useState<SortingState>([{ id: 'transaction_date', desc: true }]);
    const [rowSelection, setRowSelection] = useState({});

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);

    // Provider filter state
    const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
    const [availableProviders, setAvailableProviders] = useState<string[]>([]);

    // Local search states (immediate for input display)
    const [couponSearch, setCouponSearch] = useState('');
    const [batchSearch, setBatchSearch] = useState('');
    const [cardSearch, setCardSearch] = useState('');

    // Debounced search states (delayed for filtering)
    const [debouncedCouponSearch, setDebouncedCouponSearch] = useState('');
    const [debouncedBatchSearch, setDebouncedBatchSearch] = useState('');
    const [debouncedCardSearch, setDebouncedCardSearch] = useState('');

    // Initialize with last month that has data
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Debounce search inputs - wait 400ms after user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCouponSearch(couponSearch);
            setDebouncedBatchSearch(batchSearch);
            setDebouncedCardSearch(cardSearch);
        }, 400);

        return () => clearTimeout(timer);
    }, [couponSearch, batchSearch, cardSearch]);

    useEffect(() => {
        loadTransactions();
    }, []);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            // Initialize provider colors
            await initializeProviderColors();

            const data = await dbService.getAllTransactions();
            setTransactions(data);

            // Extract unique providers for filter
            const providers = Array.from(new Set(data.map(t => t.provider))).sort();
            setAvailableProviders(providers);

            // Find last month with data
            if (data.length > 0) {
                const dates = data.map(t => new Date(t.transaction_date));
                const mostRecentDate = max(dates);
                setSelectedDate(mostRecentDate);
            } else {
                setSelectedDate(new Date());
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const monthName = format(selectedDate, 'MMMM_yyyy', { locale: es });
        const filename = `transacciones_${monthName}.csv`;

        // CSV Headers matching required order
        const headers = [
            'Proveedor',
            'Tarjeta',
            'Nro Cupón',
            'Autorización',
            'Lote',
            'Terminal',
            'Moneda',
            'Fecha',
            'Fecha de Pago',
            'Tipo',
            'Importe'
        ];

        const csvData = filteredTransactions.map(t => {
            const cardName = normalizationService.getFormattedCardName(t);

            return [
                t.provider,
                cardName,
                t.coupon_number || '',
                t.auth_code || '',
                t.batch_number || '',
                t.terminal_number || '',
                t.currency,
                format(new Date(t.transaction_date), 'dd/MM/yyyy'),
                format(new Date(t.payment_date), 'dd/MM/yyyy'),
                t.type,
                t.amount.toFixed(2)
            ];
        });

        const csv = [headers, ...csvData].map(row => row.join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };

    // Filter transactions by selected month - MEMOIZED
    const monthFilteredTransactions = useMemo(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);

        return transactions.filter(t =>
            isWithinInterval(new Date(t.transaction_date), { start: monthStart, end: monthEnd })
        );
    }, [transactions, selectedDate]);

    // Apply manual search filters - MEMOIZED (using debounced values)
    const filteredTransactions = useMemo(() => {
        return monthFilteredTransactions.filter(t => {
            const matchesCoupon = !debouncedCouponSearch ||
                (t.coupon_number && t.coupon_number.toLowerCase().includes(debouncedCouponSearch.toLowerCase()));

            const matchesBatch = !debouncedBatchSearch ||
                (t.batch_number && t.batch_number.toLowerCase().includes(debouncedBatchSearch.toLowerCase()));

            const matchesCard = !debouncedCardSearch ||
                (normalizationService.getFormattedCardName(t).toLowerCase().includes(debouncedCardSearch.toLowerCase()));

            const matchesProvider = selectedProviders.length === 0 || selectedProviders.includes(t.provider);

            return matchesCoupon && matchesBatch && matchesCard && matchesProvider;
        });
    }, [monthFilteredTransactions, debouncedCouponSearch, debouncedBatchSearch, debouncedCardSearch, selectedProviders]);

    const toggleProvider = (provider: string) => {
        setSelectedProviders(prev =>
            prev.includes(provider)
                ? prev.filter(p => p !== provider)
                : [...prev, provider]
        );
    };

    const clearProviderFilters = () => setSelectedProviders([]);

    // Navigation functions
    const goToPreviousMonth = () => {
        setSelectedDate(prev => subMonths(prev, 1));
    };

    const goToNextMonth = () => {
        if (selectedDate < new Date()) {
            setSelectedDate(prev => subMonths(prev, -1));
        }
    };

    const handleCreateTransaction = () => {
        setEditingTransaction(undefined);
        setIsDialogOpen(true);
    };

    const handleEditTransaction = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setIsDialogOpen(true);
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta transacción?')) return;

        try {
            await dbService.deleteTransaction(id);
            await loadTransactions();
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Error al eliminar la transacción');
        }
    };

    const handleBulkDelete = async () => {
        const selectedIds = Object.keys(rowSelection).map(
            (index) => filteredTransactions[parseInt(index)].id
        );

        if (selectedIds.length === 0) return;
        if (!confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.length} transacciones?`)) return;

        setLoading(true);
        try {
            for (const id of selectedIds) {
                await dbService.deleteTransaction(id);
            }
            setRowSelection({});
            await loadTransactions();
        } catch (error) {
            console.error('Error in bulk delete:', error);
            alert('Hubo un error al eliminar algunas transacciones');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkExport = () => {
        const selectedIds = Object.keys(rowSelection).map(
            (index) => filteredTransactions[parseInt(index)].id
        );

        const toExport = filteredTransactions.filter(t => selectedIds.includes(t.id));
        if (toExport.length === 0) return;

        const filename = `transacciones_seleccionadas_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;

        // Use the same export logic but with restricted data
        const headers = [
            'Proveedor', 'Tarjeta', 'Nro Cupón', 'Autorización', 'Lote',
            'Terminal', 'Moneda', 'Fecha', 'Fecha de Pago', 'Tipo', 'Importe'
        ];

        const csvData = toExport.map(t => {
            const cardName = normalizationService.getFormattedCardName(t);

            return [
                t.provider,
                cardName,
                t.coupon_number || '',
                t.auth_code || '',
                t.batch_number || '',
                t.terminal_number || '',
                t.currency,
                format(new Date(t.transaction_date), 'dd/MM/yyyy'),
                format(new Date(t.payment_date), 'dd/MM/yyyy'),
                t.type,
                t.amount.toFixed(2)
            ];
        });

        const csv = [headers, ...csvData].map(row => row.join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };

    const columns: ColumnDef<Transaction>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-primary focus:ring-primary h-4 w-4"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-primary focus:ring-primary h-4 w-4"
                    checked={row.getIsSelected()}
                    onChange={(e) => row.toggleSelected(!!e.target.checked)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'provider',
            header: 'Proveedor',
            cell: ({ row }) => {
                const provider = row.original.provider;
                const color = getProviderColor(provider);
                return (
                    <span
                        className="inline-flex items-center px-2 py-1 rounded-md text-white text-xs font-medium"
                        style={{ backgroundColor: color }}
                    >
                        {provider}
                    </span>
                );
            },
        },
        {
            accessorKey: 'normalized_card',
            header: 'Tarjeta',
            cell: ({ row }) => {
                const cardName = normalizationService.getFormattedCardName(row.original);
                const color = normalizationService.getCardColor(cardName);
                return (
                    <div className="flex items-center space-x-2">
                        {color && (
                            <div
                                className="w-2 h-2 rounded-full border border-black/10 shadow-sm"
                                style={{ backgroundColor: color }}
                            />
                        )}
                        <span>{cardName}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'coupon_number',
            header: 'Nro Cupón',
            cell: ({ row }) => row.original.coupon_number || '-',
        },
        {
            accessorKey: 'auth_code',
            header: 'Autorización',
            cell: ({ row }) => row.original.auth_code || '-',
        },
        {
            accessorKey: 'batch_number',
            header: 'Lote',
            cell: ({ row }) => row.original.batch_number || '-',
        },
        {
            accessorKey: 'currency',
            header: 'Moneda',
            cell: ({ row }) => row.original.currency,
        },
        {
            accessorKey: 'transaction_date',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Fecha
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => format(new Date(row.original.transaction_date), 'dd/MM/yyyy'),
        },
        {
            accessorKey: 'payment_date',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Fecha Pago
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => format(new Date(row.original.payment_date), 'dd/MM/yyyy'),
        },
        {
            accessorKey: 'type',
            header: 'Tipo',
            cell: ({ row }) => row.original.type,
        },
        {
            accessorKey: 'amount',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="w-full justify-end"
                >
                    Importe
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="text-right font-medium">
                    ${row.original.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            id: 'actions',
            header: 'Acciones',
            cell: ({ row }) => (
                <div className="flex items-center justify-end space-x-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditTransaction(row.original)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400"
                        onClick={() => handleDeleteTransaction(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    const table = useReactTable({
        data: filteredTransactions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: 50,
            },
        },
    });

    // Calculate totals after table is initialized
    const totalAmount = table.getRowModel().rows.reduce((sum, row) => sum + row.original.amount, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
            {/* Sidebar Filters */}
            <div className="w-full lg:w-72 space-y-4">
                <Card className="glass glass-dark sticky top-6">
                    <CardHeader className="pb-3">
                        <div className="flex items-center space-x-2">
                            <Filter className="h-5 w-5 text-primary" />
                            <CardTitle className="text-xl">Filtros</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Provider Filter */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Proveedores</h4>
                                {selectedProviders.length > 0 && (
                                    <button
                                        onClick={clearProviderFilters}
                                        className="text-[11px] text-primary hover:text-primary/80 font-semibold transition-colors"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {availableProviders.map(provider => (
                                    <button
                                        key={provider}
                                        onClick={() => toggleProvider(provider)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group",
                                            selectedProviders.includes(provider)
                                                ? "bg-primary/10 text-primary font-bold shadow-sm"
                                                : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <div className="flex items-center space-x-2.5">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                                style={{ backgroundColor: getProviderColor(provider) }}
                                            />
                                            <span className="truncate max-w-[140px]">{provider}</span>
                                        </div>
                                        {selectedProviders.includes(provider) ? (
                                            <Check className="h-4 w-4 animate-in zoom-in-50" />
                                        ) : (
                                            <div className="h-4 w-1 bg-transparent group-hover:bg-primary/20 rounded-full transition-all" />
                                        )}
                                    </button>
                                ))}
                                {availableProviders.length === 0 && (
                                    <p className="text-xs text-muted-foreground italic px-2 py-4 text-center">No hay proveedores disponibles</p>
                                )}
                            </div>
                        </div>

                        {/* Month Navigation Sidebar Sidebar */}
                        <div className="space-y-4 pt-6 border-t border-border/40">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Periodo</h4>
                            <div className="flex items-center justify-between bg-accent/20 dark:bg-accent/10 border border-border/50 rounded-2xl p-2 group">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={goToPreviousMonth}
                                    className="h-9 w-9 p-0 hover:bg-background/80 hover:shadow-sm"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <span className="text-sm font-bold capitalize select-none">
                                    {format(selectedDate, 'MMM yyyy', { locale: es })}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={goToNextMonth}
                                    disabled={selectedDate >= new Date()}
                                    className="h-9 w-9 p-0 hover:bg-background/80 hover:shadow-sm disabled:opacity-30"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content (Table) */}
            <div className="flex-1 min-w-0 space-y-4">
                <Card className="glass glass-dark border-0 shadow-lg overflow-hidden">
                    <CardHeader className="bg-muted/30 dark:bg-muted/10 border-b border-border/40">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-2xl font-black">Transacciones</CardTitle>
                                <CardDescription className="font-medium text-muted-foreground">
                                    {format(selectedDate, 'MMMM yyyy', { locale: es })} • {filteredTransactions.length} registros
                                </CardDescription>
                            </div>

                            <div className="flex items-center space-x-3">
                                {/* Bulk Actions */}
                                {Object.keys(rowSelection).length > 0 && (
                                    <div className="flex items-center space-x-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 animate-in slide-in-from-right-4 shadow-sm">
                                        <span className="text-xs font-bold text-primary mr-1">
                                            {Object.keys(rowSelection).length} selecc.
                                        </span>
                                        <div className="flex h-4 w-px bg-primary/20 mx-1" />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBulkExport}
                                            className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/20"
                                        >
                                            <Download className="h-3.5 w-3.5 mr-1" />
                                            Exportar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBulkDelete}
                                            className="h-7 px-2 text-xs font-bold text-red-500 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                                            Eliminar
                                        </Button>
                                    </div>
                                )}

                                <Button
                                    variant="outline"
                                    onClick={handleExport}
                                    disabled={filteredTransactions.length === 0}
                                    className="rounded-full px-6 border-border/60 hover:bg-background shadow-sm"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Exportar
                                </Button>

                                <Button
                                    variant="default"
                                    onClick={handleCreateTransaction}
                                    className="shadow-md hover:shadow-lg transition-all active:scale-95 rounded-full px-6"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Nueva
                                </Button>
                            </div>
                        </div>

                        {/* Search Toolbar */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Buscar Cupón..."
                                    value={couponSearch}
                                    onChange={(e) => setCouponSearch(e.target.value)}
                                    className="pl-10 h-10 bg-background/50 border-border/60 focus:bg-background transition-all rounded-xl"
                                />
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Buscar Lote..."
                                    value={batchSearch}
                                    onChange={(e) => setBatchSearch(e.target.value)}
                                    className="pl-10 h-10 bg-background/50 border-border/60 focus:bg-background transition-all rounded-xl"
                                />
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Buscar Tarjeta..."
                                    value={cardSearch}
                                    onChange={(e) => setCardSearch(e.target.value)}
                                    className="pl-10 h-10 bg-background/50 border-border/60 focus:bg-background transition-all rounded-xl"
                                />
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id} className="bg-muted/20 dark:bg-muted/5 border-b border-border/40">
                                            {headerGroup.headers.map((header) => (
                                                <th key={header.id} className="p-4 text-left font-bold text-muted-foreground uppercase tracking-tighter text-[11px]">
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {table.getRowModel().rows.length > 0 ? (
                                        table.getRowModel().rows.map((row) => (
                                            <tr
                                                key={row.id}
                                                className={cn(
                                                    "transition-colors hover:bg-muted/10",
                                                    row.getIsSelected() && "bg-primary/5 hover:bg-primary/10"
                                                )}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <td key={cell.id} className="p-4 align-middle border-b border-border/10">
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={columns.length}
                                                className="h-32 text-center text-muted-foreground italic bg-muted/5"
                                            >
                                                No se encontraron transacciones con los filtros aplicados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer statistics and Pagination */}
                        <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-muted/20 dark:bg-muted/5 border-t border-border/40 gap-4">
                            <div className="flex items-center space-x-8">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Registros</p>
                                    <p className="text-lg font-black">{table.getRowModel().rows.length}</p>
                                </div>
                                <div className="h-8 w-px bg-border/40" />
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Importe Total</p>
                                    <p className="text-xl font-black text-primary">
                                        ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.previousPage()}
                                    disabled={!table.getCanPreviousPage()}
                                    className="rounded-xl h-9 px-4 font-bold border-border/60 hover:bg-background"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Anterior
                                </Button>
                                <div className="px-4 py-1.5 bg-background rounded-full border border-border/40 text-xs font-bold shadow-sm">
                                    Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.nextPage()}
                                    disabled={!table.getCanNextPage()}
                                    className="rounded-xl h-9 px-4 font-bold border-border/60 hover:bg-background"
                                >
                                    Siguiente
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Transaction Form Dialog */}
            <TransactionFormDialog
                open={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setEditingTransaction(undefined);
                }}
                onSave={loadTransactions}
                transaction={editingTransaction}
            />
        </div>
    );
};
