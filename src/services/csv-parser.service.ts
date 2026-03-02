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

        // Special handling for Cabal (fixed-width format)
        if (provider.name.toLowerCase().includes('cabal')) {
            return this.parseCabalFile(file, provider, batchId);
        }

        // Special handling for American Express (Excel with specific structure)
        if (provider.name.toLowerCase().includes('american')) {
            return this.parseAmexFile(file, provider, batchId);
        }

        // Special handling for Modo text format
        if (provider.name.toLowerCase().includes('modo')) {
            return this.parseModoFile(file, provider, batchId);
        }

        if (extension === 'xls' || extension === 'xlsx') {
            return this.parseExcelFile(file, provider, batchId);
        }

        return new Promise((resolve) => {
            Papa.parse(file, {
                encoding: 'UTF-8', // Try UTF-8 first
                delimiter: provider.delimiter || undefined,
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

    // Special parser for Cabal's fixed-width format
    private async parseCabalFile(file: File, provider: ProviderConfig, batchId: string): Promise<ParsedCSVResult> {
        const transactions: Transaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/);

            console.log('=== CABAL PARSER DEBUG ===');
            console.log('Total lines:', lines.length);

            // Find where data starts (look for "*VENTAS CORRESPONDIENTES A CABAL")
            let dataStartIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].replace(/^"|"$/g, '').trim(); // Remove surrounding quotes
                if (line.includes('*VENTAS CORRESPONDIENTES A CABAL')) {
                    dataStartIndex = i + 1;
                    console.log('Found VENTAS marker at line', i);
                    break;
                }
            }

            if (dataStartIndex === -1) {
                return { transactions: [], errors: ['No se encontraron datos de transacciones en el archivo Cabal'], warnings: [] };
            }

            console.log('Cabal parser: Data starts at line', dataStartIndex);

            // Parse each data line
            for (let i = dataStartIndex; i < lines.length; i++) {
                let line = lines[i];

                // Remove surrounding quotes and trim
                line = line.replace(/^"|"$/g, '').trim();

                // Skip empty lines and subtotals
                if (!line || line.includes('*TOTAL RESUMEN*') || line.includes('TOTAL DE VENTAS') || line.includes('ARANCEL') || line.includes('CABAL DEBITO')) {
                    continue;
                }

                // Extract date (DD/MM/YYYY at start)
                const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
                if (!dateMatch) {
                    console.log('No date match in line:', line.substring(0, 50));
                    continue;
                }

                const dateStr = dateMatch[1];

                // Extract amount (number with comma decimal at end)
                let amountMatch = line.match(/([\d.]+,\d{2})\s*$/);
                if (!amountMatch) {
                    amountMatch = line.match(/([\d]+,\d{2})/);
                }
                if (!amountMatch) {
                    amountMatch = line.match(/([\d.,]+)\s*$/);
                }
                if (!amountMatch) {
                    console.log('No amount match in line:', line.substring(0, 50));
                    continue;
                }

                const amountStr = amountMatch[1].replace('.', '').replace(',', '.');
                const amount = parseFloat(amountStr);

                // Extract coupon/box numbers from middle section
                const numbersInLine = line.match(/\d{4,}/g) || [];
                const couponNumber = numbersInLine[0] || '';
                const batchNumber = numbersInLine[1] || '';

                // Parse date
                const parsedDate = parseDate(dateStr, 'DD/MM/YYYY');

                const transaction: Transaction = {
                    id: uuidv4(),
                    import_batch_id: batchId,
                    provider: provider.name,
                    original_card_name: 'CABAL DEBITO',
                    normalized_card: 'Cabal',
                    coupon_number: couponNumber,
                    auth_code: '',
                    batch_number: batchNumber,
                    terminal_number: '',
                    currency: 'ARS',
                    transaction_date: parsedDate || new Date(),
                    payment_date: parsedDate || new Date(),
                    type: 'Cupón',
                    amount: amount,
                    created_at: new Date(),
                    updated_at: new Date(),
                };

                transactions.push(transaction);
            }

            console.log(`Cabal parser: Found ${transactions.length} transactions`);

        } catch (error) {
            errors.push(`Error parsing Cabal file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return { transactions, errors, warnings };
    }

    // Special parser for MODO text format
    private async parseModoFile(file: File, provider: ProviderConfig, batchId: string): Promise<ParsedCSVResult> {
        const transactions: Transaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/);

            console.log('=== MODO PARSER DEBUG ===');
            console.log('Total lines:', lines.length);

            let dataStartLine = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('Transac Fecha') && lines[i].includes('Terminal')) {
                    // Usually line after "-------------------------------------------"
                    dataStartLine = i + 2;
                    break;
                }
            }

            if (dataStartLine === -1) {
                // If header not matched perfectly, look for "---" or "QR      "
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('QR      ')) {
                        dataStartLine = i;
                        break;
                    }
                }
            }

            if (dataStartLine === -1 || dataStartLine >= lines.length) {
                return { transactions: [], errors: ['No se encontraron datos de transacciones en el archivo MODO'], warnings: [] };
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Skip non-data lines (totals, headers, etc)
                if (!line.startsWith('QR')) {
                    continue;
                }

                // Split line by whitespace
                const parts = line.split(/\s+/);

                // MODO expected minimum parts:
                // 0: Transac (QR)
                // 1: Fecha (DD.MM.YYYY)
                // 2: Terminal
                // 3: Lote
                // 4: Cupon
                // 5: Ventas
                // 6: Arancel
                // 7: ID
                // 8+: Billetera (rest of the string)

                if (parts.length < 9) {
                    continue;
                }

                const dateStr = parts[1]; // e.g. 01.01.2026
                const terminalNumber = parts[2];
                const batchNumber = parts[3];
                const couponNumber = parts[4];
                const amountStr = parts[5];
                const billetera = parts.slice(8).join(' ');

                // Parse date
                // Format is DD.MM.YYYY -> convert to DD/MM/YYYY
                const normalizedDateStr = dateStr.replace(/\./g, '/');
                const parsedDate = parseDate(normalizedDateStr, 'DD/MM/YYYY');

                const amount = parseFloat(amountStr) || 0;

                if (!parsedDate || amount <= 0) {
                    continue;
                }

                const transaction: Transaction = {
                    id: uuidv4(),
                    import_batch_id: batchId,
                    provider: provider.name,
                    original_card_name: billetera || 'MODO',
                    normalized_card: 'Modo',
                    coupon_number: couponNumber,
                    auth_code: '', // Not consistently provided
                    batch_number: batchNumber,
                    terminal_number: terminalNumber,
                    currency: 'ARS',
                    transaction_date: parsedDate,
                    payment_date: parsedDate,
                    type: 'QR',
                    amount: amount,
                    created_at: new Date(),
                    updated_at: new Date(),
                };

                transactions.push(transaction);
            }

            console.log(`MODO parser: Found ${transactions.length} transactions`);

        } catch (error) {
            errors.push(`Error parsing MODO file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return { transactions, errors, warnings };
    }

    // Special parser for American Express Excel format
    private async parseAmexFile(file: File, provider: ProviderConfig, batchId: string): Promise<ParsedCSVResult> {
        const transactions: Transaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to array of arrays
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

            console.log('=== AMEX PARSER DEBUG ===');
            console.log('Total rows:', rawData.length);

            // AMEX structure:
            // Row 0-9: Metadata and headers
            // Row 10+: Data
            // Columns: 
            // [0] = Fecha de presentación
            // [2] = Número de liquidación (coupon)
            // [8] = Importe de la liquidación (amount)
            // [13] = Fecha de liquidación (payment date)
            // [14] = Enviando nombre de ubicación (location name)
            // [18] = Fecha de la transacción

            const dataStartRow = 10; // Data starts at row 10 (0-indexed)

            for (let i = dataStartRow; i < rawData.length; i++) {
                const row = rawData[i];

                // Skip empty rows or rows without date
                if (!row || row.length === 0 || !row[0]) continue;

                // Check if first column looks like a date
                const firstCol = String(row[0]);
                if (!firstCol.includes('/')) continue;

                const fechaPresentacion = row[0];
                const numeroLiquidacion = String(row[2] || '');
                const importeLiquidacion = row[8];
                const fechaLiquidacion = row[13];
                const nombreUbicacion = String(row[14] || '');
                const fechaTransaccion = row[18];

                // Parse dates
                let transactionDate: Date | null = null;
                let paymentDate: Date | null = null;

                // Transaction date from column 18 (Fecha de la transacción)
                if (fechaTransaccion) {
                    if (fechaTransaccion instanceof Date) {
                        transactionDate = fechaTransaccion;
                    } else {
                        const dateStr = String(fechaTransaccion);
                        transactionDate = parseDate(dateStr, 'DD/MM/YYYY');
                    }
                }

                // Fallback to Fecha de presentación
                if (!transactionDate && fechaPresentacion) {
                    if (fechaPresentacion instanceof Date) {
                        transactionDate = fechaPresentacion;
                    } else {
                        const dateStr = String(fechaPresentacion);
                        transactionDate = parseDate(dateStr, 'DD/MM/YYYY');
                    }
                }

                // Payment date from column 13
                if (fechaLiquidacion) {
                    if (fechaLiquidacion instanceof Date) {
                        paymentDate = fechaLiquidacion;
                    } else {
                        const dateStr = String(fechaLiquidacion);
                        paymentDate = parseDate(dateStr, 'DD/MM/YYYY');
                    }
                }

                // Parse amount from column 8 (Importe de la liquidación)
                let amount = 0;
                if (typeof importeLiquidacion === 'number') {
                    amount = importeLiquidacion;
                } else if (importeLiquidacion) {
                    const amountStr = String(importeLiquidacion).replace(',', '.');
                    amount = parseFloat(amountStr) || 0;
                }

                if (!transactionDate || amount === 0) {
                    console.log('AMEX: Skipping row', i, '- date:', !!transactionDate, '- amount:', amount);
                    continue;
                }

                const transaction: Transaction = {
                    id: uuidv4(),
                    import_batch_id: batchId,
                    provider: provider.name,
                    original_card_name: nombreUbicacion || 'AMERICAN EXPRESS',
                    normalized_card: 'Amex',
                    coupon_number: numeroLiquidacion,
                    auth_code: '',
                    batch_number: '',
                    terminal_number: '',
                    currency: 'ARS',
                    transaction_date: transactionDate,
                    payment_date: paymentDate || transactionDate,
                    type: 'Cupón',
                    amount: amount,
                    created_at: new Date(),
                    updated_at: new Date(),
                };

                transactions.push(transaction);
            }

            console.log(`AMEX parser: Found ${transactions.length} transactions`);

        } catch (error) {
            errors.push(`Error parsing AMEX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return { transactions, errors, warnings };
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

        // Debug: Log first 10 rows to understand file structure
        console.log('=== FILE STRUCTURE DEBUG ===');
        for (let i = 0; i < Math.min(10, data.length); i++) {
            console.log(`Row ${i}:`, data[i]?.slice(0, 5));
        }
        console.log('===========================');

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
        console.log('Looking for coupon_number column:', provider.columnMapping['coupon_number']);
        console.log('Coupon number column found?', columnIndexMap.has(provider.columnMapping['coupon_number']));

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
                    // Skip if empty or zero amount
                    if (!rawAmount.trim() || rawAmount.trim() === '0' || rawAmount.trim() === '0,00' || rawAmount.trim() === '0.00') {
                        continue;
                    }
                }

                // Check for declined transactions in Fiserv
                const estadoCol = 'Estado';
                const estadoValue = this.getCellValue(row, columnIndexMap, estadoCol);
                if (estadoValue && (
                    estadoValue.toLowerCase().includes('negada') ||
                    estadoValue.toLowerCase().includes('denegada') ||
                    estadoValue.toLowerCase().includes('rechazada') ||
                    estadoValue.toLowerCase().includes('declined')
                )) {
                    continue; // Skip declined transactions
                }

                const transaction = this.rowToTransaction(row, columnIndexMap, provider, batchId);

                if (transaction) {
                    transactions.push(transaction);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                // Only log as warning, not error - some rows may be invalid and that's ok
                console.warn(`Advertencia en fila ${i + 1}:`, errorMsg);
                // Don't add to warnings list for individual row errors to avoid cluttering the UI
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
        let original_card_name = this.getCellValue(row, columnMap, mapping['original_card_name']) || '';

        // Special handling for MercadoPago - no card column in CSV
        if (provider.name === 'MercadoPago') {
            // MercadoPago transactions don't have card info in CSV
            // Assign based on type - QR for Cobro, or generic MercadoPago
            if (type === 'QR' || typeStr?.toLowerCase().includes('cobro')) {
                original_card_name = 'MercadoPago QR';
            } else {
                original_card_name = 'MercadoPago';
            }
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
