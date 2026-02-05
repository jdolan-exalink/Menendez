import type { Transaction } from '../types';
import { formatDateForExport } from '../utils/date.utils';
import { formatNumberForExport } from '../utils/number.utils';

export class ExportService {
    exportToCSV(transactions: Transaction[], filename: string = 'export.csv'): void {
        if (transactions.length === 0) {
            alert('No hay transacciones para exportar');
            return;
        }

        // Define exact column headers as specified
        const headers = [
            'Proveedor',
            'Tarjeta (o QR)',
            'Nro Cupon',
            'Autorizacion',
            'Lote',
            'Terminal',
            'Moneda',
            'FECHA',
            'FECHA de pago',
            'Tipo (cupon, QR)',
            'Importe',
        ];

        // Build CSV rows
        const rows = transactions.map((t) => [
            t.provider,
            t.normalized_card || t.original_card_name,
            t.coupon_number,
            t.auth_code,
            t.batch_number,
            t.terminal_number,
            t.currency,
            formatDateForExport(t.transaction_date),
            formatDateForExport(t.payment_date),
            t.type,
            formatNumberForExport(t.amount),
        ]);

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => this.escapeCSVCell(cell)).join(',')),
        ].join('\n');

        // Create and download file
        this.downloadFile(csvContent, filename);
    }

    private escapeCSVCell(cell: string | number): string {
        const str = String(cell);

        // If cell contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }

        return str;
    }

    private downloadFile(content: string, filename: string): void {
        // Add BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }
}

export const exportService = new ExportService();
