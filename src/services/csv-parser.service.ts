import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import type { Transaction, ProviderConfig, TransactionType } from '../types';
import { parseDate, detectDateFormat, type DateFormat } from '../utils/date.utils';
import { parseNumber, detectNumberFormat, type NumberFormat } from '../utils/number.utils';

export interface ParsedCSVResult {
    transactions: Transaction[];
    errors: string[];
    warnings: string[];
}

export interface DetectedFormat {
    delimiter: ';' | ',';
    dateFormat: DateFormat;
    numberFormat: NumberFormat;
}

export class CSVParserService {
    async parseFile(file: File, provider: ProviderConfig, batchId: string): Promise<ParsedCSVResult> {
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension === 'xls' || extension === 'xlsx') {
            return this.parseExcelFile(file, provider, batchId);
        }

        return new Promise((resolve) => {
            Papa.parse(file, {
                encoding: 'ISO-8859-1', // Use Latin-1 encoding for Windows CSV files
                delimiter: provider.delimiter || undefined, // Use provider's delimiter if specified
                skipEmptyLines: 'greedy',
                complete: (results) => {
                    const parsed = this.processCSVData(results.data as string[][], provider, batchId);
                    resolve(parsed);
                },
                error: (error) => {
                    resolve({
                        transactions: [],
                        errors: [`Error parsing CSV: ${error.message}`],
                        warnings: [],
                    });
                },
            });
        });
    }

    private async parseExcelFile(file: File, provider: ProviderConfig, batchId: string): Promise<ParsedCSVResult> {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to array of arrays (string[][]) for compatibility with processCSVData
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

            // Convert all cells to strings
            const dataStrings: string[][] = rawData.map(row =>
                row.map(cell => {
                    if (cell === null || cell === undefined) return '';
                    if (cell instanceof Date) {
                        // Format date to DD/MM/YYYY for the existing parseDate logic
                        const d = cell;
                        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                    }
                    return String(cell).trim();
                })
            );

            return this.processCSVData(dataStrings, provider, batchId);
        } catch (error) {
            return {
                transactions: [],
                errors: [`Error parsing Excel: ${error instanceof Error ? error.message : 'Unknown error'}`],
                warnings: [],
            };
        }
    }

    detectFormat(csvData: string[][]): DetectedFormat {
        // Detect delimiter - check if semicolon or comma is more common
        const firstRow = csvData[0]?.join('') || '';
        const semicolonCount = (firstRow.match(/;/g) || []).length;
        const commaCount = (firstRow.match(/,/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';

        // Sample rows for format detection
        const sampleRows = csvData.slice(1, Math.min(21, csvData.length));

        // Detect date format from date-like columns
        const dateSamples: string[] = [];
        sampleRows.forEach((row) => {
            row.forEach((cell) => {
                if (this.looksLikeDate(cell)) {
                    dateSamples.push(cell);
                }
            });
        });
        const dateFormat = detectDateFormat(dateSamples);

        // Detect number format from number-like columns
        const numberSamples: string[] = [];
        sampleRows.forEach((row) => {
            row.forEach((cell) => {
                if (this.looksLikeNumber(cell)) {
                    numberSamples.push(cell);
                }
            });
        });
        const numberFormat = detectNumberFormat(numberSamples);

        return { delimiter, dateFormat, numberFormat };
    }

    private looksLikeDate(value: string): boolean {
        if (!value) return false;
        // Check for date patterns
        return /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value) ||
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
    }

    private looksLikeNumber(value: string): boolean {
        if (!value) return false;
        // Check for number patterns
        return /^[\d.,]+$/.test(value.trim());
    }

    private processCSVData(data: string[][], provider: ProviderConfig, batchId: string): ParsedCSVResult {
        const transactions: Transaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // Skip specified number of rows
        const startRow = provider.skipRows + 1; // +1 for header row
        const headerRow = data[provider.skipRows];

        if (!headerRow || headerRow.length === 0) {
            errors.push('CSV file is empty or has invalid format');
            return { transactions, errors, warnings };
        }

        // Create column index map
        const columnIndexMap = this.createColumnIndexMap(headerRow);

        // Debug: Log column names for troubleshooting
        const detectedCols = Array.from(columnIndexMap.keys());
        console.log('=== CSV PARSER DEBUG ===');
        console.log('Provider:', provider.name);
        console.log('Header row raw:', headerRow);
        console.log('Detected columns:', detectedCols);
        console.log('Column count:', detectedCols.length);
        console.log('Looking for transaction_date column:', provider.columnMapping['transaction_date']);
        console.log('Transaction date column found?', columnIndexMap.has(provider.columnMapping['transaction_date']));

        // Show first few column names in alert for visibility
        if (detectedCols.length > 0) {
            console.warn(`First 10 columns: ${detectedCols.slice(0, 10).join(' | ')}`);
        }

        // Process each data row
        for (let i = startRow; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || row.every(cell => !cell || cell.trim() === '')) {
                continue;
            }

            try {
                // Special handling for MercadoPago - skip non-"Cobro" transactions
                if (provider.name.toLowerCase().includes('mercadopago')) {
                    const tipoOperacion = this.getCellValue(row, columnIndexMap, provider.columnMapping['type']);
                    if (tipoOperacion && !tipoOperacion.toLowerCase().includes('cobro')) {
                        continue; // Skip retentions and other non-payment operations
                    }
                }

                // Generic check for amount - if amount column looks negative or zero, we likely don't want it
                const amountCol = provider.columnMapping['amount'];
                if (amountCol) {
                    const rawAmount = this.getCellValue(row, columnIndexMap, amountCol);
                    // Skip if starts with - (negative)
                    if (rawAmount.trim().startsWith('-')) {
                        continue;
                    }
                }

                const transaction = this.rowToTransaction(row, columnIndexMap, provider, batchId);

                if (transaction) {
                    transactions.push(transaction);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                console.warn(`Error en fila ${i + 1}:`, errorMsg, row);
                warnings.push(`Fila ${i + 1}: ${errorMsg}`);
            }
        }

        return { transactions, errors, warnings };
    }

    private createColumnIndexMap(headerRow: string[]): Map<string, number> {
        const map = new Map<string, number>();
        headerRow.forEach((columnName, index) => {
            // Clean and normalize column name (don't fix encoding on headers)
            const cleaned = columnName.trim().replace(/\uFEFF/g, ''); // Remove BOM only
            map.set(cleaned, index);
        });
        return map;
    }

    private getCellValue(row: string[], columnMap: Map<string, number>, columnName?: string): string {
        if (!columnName) return '';

        // Try exact match first
        let index = columnMap.get(columnName);

        // If not found, try fuzzy match (handles encoding issues)
        if (index === undefined) {
            // Aggressive normalization: remove all accents, special chars, spaces, convert to lowercase
            const normalizeAggressive = (str: string) => {
                return str
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric
            };

            const normalizedSearch = normalizeAggressive(columnName);

            for (const [key, value] of columnMap.entries()) {
                const normalizedKey = normalizeAggressive(key);

                // Check if they match after aggressive normalization
                // We check for exact match or if one is a very close subset of the other
                // but avoid matching the entire header row if delimiter was wrong
                if (normalizedKey === normalizedSearch ||
                    (normalizedKey.length < 20 && normalizedKey.includes(normalizedSearch)) ||
                    (normalizedSearch.length < 20 && normalizedSearch.includes(normalizedKey))) {
                    console.log(`Fuzzy match: "${columnName}" -> "${key}"`);
                    index = value;
                    break;
                }
            }
        }

        if (index === undefined) return '';
        return row[index]?.trim() || '';
    }

    private rowToTransaction(
        row: string[],
        columnMap: Map<string, number>,
        provider: ProviderConfig,
        batchId: string
    ): Transaction | null {
        const mapping = provider.columnMapping;

        // Extract transaction date
        const transactionDateStr = this.getCellValue(row, columnMap, mapping['transaction_date']);
        const transaction_date = transactionDateStr
            ? parseDate(transactionDateStr, provider.dateFormat)
            : null;

        if (!transaction_date) {
            throw new Error(`Invalid or missing transaction date: "${transactionDateStr}"`);
        }

        // Extract payment date (use transaction date as fallback)
        const paymentDateStr = this.getCellValue(row, columnMap, mapping['payment_date']);
        const payment_date = paymentDateStr
            ? parseDate(paymentDateStr, provider.dateFormat)
            : transaction_date;

        // Extract amount
        const amountStr = this.getCellValue(row, columnMap, mapping['amount']);
        const amount = amountStr ? parseNumber(amountStr, provider.numberFormat) : 0;

        if (isNaN(amount) || amount <= 0) {
            throw new Error(`Invalid amount: "${amountStr}" parsed as ${amount}`);
        }

        // Determine transaction type
        const typeStr = this.getCellValue(row, columnMap, mapping['type']);
        let type = this.determineTransactionType(typeStr);

        // Extract card name for QR detection
        const original_card_name = this.getCellValue(row, columnMap, mapping['original_card_name']) || '';

        // Special handling for MercadoPago QR
        if (provider.name === 'MercadoPago' && type === 'QR') {
            // MercadoPago QR transactions should show as "Mercadopago QR"
            // Don't change the type, but the card name will be normalized later
        }

        // Extract other fields
        const coupon_number = this.getCellValue(row, columnMap, mapping['coupon_number']) || '';
        const auth_code = this.getCellValue(row, columnMap, mapping['auth_code']) || '';
        const batch_number = this.getCellValue(row, columnMap, mapping['batch_number']) || '';
        const terminal_number = this.getCellValue(row, columnMap, mapping['terminal_number']) || '';
        let currency = this.getCellValue(row, columnMap, mapping['currency']) || 'ARS';

        // Normalize currency: "Pesos" -> "ARS"
        if (currency.toLowerCase().includes('peso')) {
            currency = 'ARS';
        }

        const now = new Date();

        return {
            id: uuidv4(),
            import_batch_id: batchId,
            provider: provider.name,
            original_card_name,
            normalized_card: original_card_name, // Will be normalized later
            coupon_number,
            auth_code,
            batch_number,
            terminal_number,
            currency,
            transaction_date,
            payment_date: payment_date || transaction_date,
            type,
            amount,
            created_at: now,
            updated_at: now,
        };
    }

    private determineTransactionType(typeStr: string): TransactionType {
        const lower = typeStr.toLowerCase();

        // MercadoPago uses "Cobro" for QR payments
        if (lower.includes('cobro') || lower.includes('qr')) {
            return 'QR';
        }
        if (lower.includes('transferencia') || lower.includes('transfer')) {
            return 'Transferencia';
        }
        return 'Cupón';
    }
}

export const csvParserService = new CSVParserService();
