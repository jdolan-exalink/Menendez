import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { dbService } from '../services/db.service';
import { normalizationService } from '../services/normalization.service';
import type { Transaction } from '../types';
import { TrendingUp, DollarSign, CreditCard, Activity, Upload, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { format, eachDayOfInterval, subMonths, startOfMonth, endOfMonth, isWithinInterval, max } from 'date-fns';
import { es } from 'date-fns/locale';
import { getProviderColor, initializeProviderColors } from '../utils/providerColors';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

export const Dashboard: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Initialize with last month with data
    const [selectedDate, setSelectedDate] = useState(new Date());

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        loadTransactions();
    }, []);

    const loadTransactions = async () => {
        try {
            // Initialize provider colors
            await initializeProviderColors();

            const data = await dbService.getAllTransactions();
            setTransactions(data);

            // Find last month with data
            if (data.length > 0) {
                const mostRecentDate = max(data.map(t => new Date(t.transaction_date)));
                setSelectedDate(mostRecentDate);
            } else {
                setSelectedDate(subMonths(new Date(), 1));
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const clearDatabase = async () => {
        if (!confirm('⚠️ ADVERTENCIA: Esto eliminará TODAS las transacciones, importaciones y configuraciones de proveedores. ¿Estás seguro?')) {
            return;
        }

        setLoading(true);
        try {
            // Clear all transactions
            await dbService.clearAllTransactions();

            // Clear all import batches
            const batches = await dbService.getAllImportBatches();
            for (const batch of batches) {
                await dbService.deleteImportBatch(batch.id);
            }

            // Clear all providers
            const providers = await dbService.getAllProviders();
            for (const provider of providers) {
                await dbService.deleteProvider(provider.id);
            }

            // Reload page to reinitialize
            window.location.reload();
        } catch (error) {
            console.error('Error clearing database:', error);
            alert('Error al limpiar base de datos');
            setLoading(false);
        }
    };

    // Filter transactions by selected month
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    const filteredTransactions = transactions.filter(t =>
        isWithinInterval(new Date(t.transaction_date), { start: monthStart, end: monthEnd })
    );

    // Navigation functions
    const goToPreviousMonth = () => {
        setSelectedDate(prev => subMonths(prev, 1));
    };

    const goToNextMonth = () => {
        setSelectedDate(prev => {
            const next = subMonths(new Date(), 0); // Current month
            const nextMonth = subMonths(prev, -1);
            // Don't allow going to future months
            return nextMonth <= next ? nextMonth : prev;
        });
    };

    const totalSales = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgTicket = filteredTransactions.length > 0 ? totalSales / filteredTransactions.length : 0;
    const transactionCount = filteredTransactions.length;

    // Group by provider
    const byProvider = filteredTransactions.reduce((acc, t) => {
        acc[t.provider] = (acc[t.provider] || 0) + t.amount;
        return acc;
    }, {} as Record<string, number>);

    // Prepare data for daily sales chart (days of selected month)
    const daysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd,
    });

    const dailySalesData = daysInMonth.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const daySales = filteredTransactions
            .filter(t => format(new Date(t.transaction_date), 'yyyy-MM-dd') === dayStr)
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            date: format(day, 'dd/MM'),
            ventas: daySales,
        };
    });

    // Prepare data for card/QR ranking
    const cardSales = filteredTransactions.reduce((acc, t) => {
        const cardName = normalizationService.getFormattedCardName(t);

        acc[cardName] = (acc[cardName] || 0) + t.amount;
        return acc;
    }, {} as Record<string, number>);

    const cardRankingData = Object.entries(cardSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([card, amount]) => ({
            tarjeta: card,
            monto: amount,
        }));

    // QR vs Tarjetas
    const qrSales = filteredTransactions
        .filter(t => t.type === 'QR')
        .reduce((sum, t) => sum + t.amount, 0);

    const cardOnlySales = filteredTransactions
        .filter(t => t.type === 'Cupón')
        .reduce((sum, t) => sum + t.amount, 0);

    const qrVsCardData = [
        { name: 'Tarjetas', value: cardOnlySales, count: filteredTransactions.filter(t => t.type === 'Cupón').length },
        { name: 'QR', value: qrSales, count: filteredTransactions.filter(t => t.type === 'QR').length },
    ];

    // Colors for QR vs Card sales
    const pieColors = ['#3b82f6', getProviderColor('MercadoPago')];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Resumen de {format(selectedDate, 'MMMM yyyy', { locale: es })}
                    </p>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Month Selector */}
                    <div className="flex items-center space-x-2 bg-card border rounded-lg p-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToPreviousMonth}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="px-3 text-sm font-medium min-w-[140px] text-center">
                            {format(selectedDate, 'MMMM yyyy', { locale: es })}
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToNextMonth}
                            className="h-8 w-8 p-0"
                            disabled={selectedDate >= subMonths(new Date(), 0)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Export PDF Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrint}
                        className="bg-primary/10 text-primary hover:bg-primary/20"
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        Exportar Reporte
                    </Button>

                    {/* Dev Tools - Remove in production */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={clearDatabase}
                        className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                        🗑️ Limpiar DB (Dev)
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="glass glass-dark hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#c6ff00]">
                            ${totalSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {transactionCount} transacciones
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass glass-dark hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${avgTicket.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Por transacción
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass glass-dark hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{transactionCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Total de pagos
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass glass-dark hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
                        <CreditCard className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Object.keys(byProvider).length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Activos
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 1: Daily Sales */}
            {dailySalesData.length > 0 && (
                <Card className="glass glass-dark">
                    <CardHeader>
                        <CardTitle>Ventas Diarias - {format(selectedDate, 'MMMM yyyy', { locale: es })}</CardTitle>
                        <CardDescription>Evolución de ventas por día</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dailySalesData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="date"
                                    className="text-xs"
                                    tick={{ fill: 'hsl(var(--foreground))' }}
                                />
                                <YAxis
                                    className="text-xs"
                                    tick={{ fill: 'hsl(var(--foreground))' }}
                                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
                                        padding: '12px'
                                    }}
                                    itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '13px', fontWeight: '600' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: 'bold' }}
                                    formatter={(value: any) => {
                                        const numValue = typeof value === 'number' ? value : 0;
                                        return [`$${numValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 'Ventas'];
                                    }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="ventas"
                                    stroke="#c6ff00"
                                    strokeWidth={3}
                                    dot={{ fill: '#c6ff00', r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                    name="Ventas"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Charts Row 2: Card Ranking and QR vs Cards */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Card Ranking */}
                {cardRankingData.length > 0 && (
                    <Card className="glass glass-dark">
                        <CardHeader>
                            <CardTitle>Ranking de Tarjetas / QR</CardTitle>
                            <CardDescription>Top 10 por volumen de ventas</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={cardRankingData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        type="number"
                                        tick={{ fill: 'hsl(var(--foreground))' }}
                                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="tarjeta"
                                        width={120}
                                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '12px',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
                                            padding: '12px'
                                        }}
                                        itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '13px', fontWeight: '600' }}
                                        labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: 'bold' }}
                                        formatter={(value: any) => {
                                            const numValue = typeof value === 'number' ? value : 0;
                                            return [`$${numValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 'Monto'];
                                        }}
                                    />
                                    <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
                                        {cardRankingData.map((entry, index) => {
                                            const defaultColors = [
                                                '#2563eb', // Blue 600
                                                '#3b82f6', // Blue 500
                                                '#60a5fa', // Blue 400
                                                '#0ea5e9', // Sky 500
                                                '#38bdf8', // Sky 400
                                                '#06b6d4', // Cyan 500
                                                '#22d3ee', // Cyan 400
                                                '#14b8a6', // Teal 500
                                                '#2dd4bf', // Teal 400
                                                '#10b981', // Emerald 500
                                            ];

                                            // Prefer normalization color, then provider color, then default
                                            const normColor = normalizationService.getCardColor(entry.tarjeta);
                                            let barColor = normColor || defaultColors[index % defaultColors.length];

                                            if (!normColor) {
                                                if (entry.tarjeta.toLowerCase().includes('mercadopago')) {
                                                    barColor = getProviderColor('MercadoPago');
                                                } else if (entry.tarjeta.toLowerCase().includes('jerarquicos')) {
                                                    barColor = getProviderColor('Jerarquicos');
                                                }
                                            }

                                            return <Cell key={`cell-${index}`} fill={barColor} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* QR vs Tarjetas */}
                {qrVsCardData.some(d => d.value > 0) && (
                    <Card className="glass glass-dark">
                        <CardHeader>
                            <CardTitle>QR vs Tarjetas</CardTitle>
                            <CardDescription>Distribución de ventas por método de pago</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-center">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={qrVsCardData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ cx, cy, midAngle = 0, outerRadius, name, percent = 0 }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = outerRadius * 1.2;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                const p = (percent * 100).toFixed(1);

                                                return (
                                                    <text
                                                        x={x}
                                                        y={y}
                                                        fill="hsl(var(--foreground))"
                                                        textAnchor={x > cx ? 'start' : 'end'}
                                                        dominantBaseline="central"
                                                        className="text-[10px] font-bold"
                                                    >
                                                        {`${name}: ${p}%`}
                                                    </text>
                                                );
                                            }}
                                        >
                                            {qrVsCardData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
                                                padding: '12px'
                                            }}
                                            itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '13px', fontWeight: '600' }}
                                            labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: 'bold' }}
                                            formatter={(value: any) => {
                                                const numValue = typeof value === 'number' ? value : 0;
                                                return `$${numValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Legend with amounts */}
                            <div className="mt-4 space-y-2">
                                {qrVsCardData.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center space-x-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: pieColors[index] }}
                                            />
                                            <span>{entry.name}</span>
                                        </div>
                                        <span className="font-medium">
                                            ${entry.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Provider Breakdown */}
            {Object.keys(byProvider).length > 0 && (
                <Card className="glass glass-dark">
                    <CardHeader>
                        <CardTitle>Ventas por Proveedor</CardTitle>
                        <CardDescription>Distribución de montos por proveedor de pago</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Object.entries(byProvider).map(([provider, amount]) => {
                                const percentage = (amount / totalSales) * 100;
                                const color = getProviderColor(provider);
                                return (
                                    <div key={provider} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span
                                                className="inline-flex items-center px-2 py-1 rounded-md text-white text-xs font-medium"
                                                style={{ backgroundColor: color }}
                                            >
                                                {provider}
                                            </span>
                                            <span className="font-bold tracking-tight text-[#c6ff00]">
                                                ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                            <div
                                                className="h-full transition-all duration-500"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: color
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {transactionCount === 0 && (
                <Card className="glass glass-dark">
                    <CardContent className="py-12">
                        <div className="text-center space-y-3">
                            <Upload className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-medium">No hay transacciones</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Comienza importando archivos CSV de tus proveedores de pago para ver métricas y análisis.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
