export type NumberFormat = 'comma-decimal' | 'dot-decimal';

export function detectNumberFormat(samples: string[]): NumberFormat {
    let commaDecimalCount = 0;
    let dotDecimalCount = 0;

    for (const sample of samples.slice(0, 20)) {
        if (!sample || typeof sample !== 'string') continue;

        // Check for comma as decimal separator (1.000,00)
        if (/^\d{1,3}(\.\d{3})*(,\d{2})?$/.test(sample.trim())) {
            commaDecimalCount++;
        }

        // Check for dot as decimal separator (1,000.00 or 1000.00)
        if (/^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(sample.trim()) || /^\d+\.\d{2}$/.test(sample.trim())) {
            dotDecimalCount++;
        }
    }

    return commaDecimalCount > dotDecimalCount ? 'comma-decimal' : 'dot-decimal';
}

export function parseNumber(numStr: string, numberFormat: NumberFormat): number {
    if (!numStr) return 0;

    const cleaned = numStr.toString().trim();

    if (numberFormat === 'comma-decimal') {
        // Argentine format: 1.000,00 -> 1000.00
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
        // International format: 1,000.00 -> 1000.00
        return parseFloat(cleaned.replace(/,/g, ''));
    }
}

export function formatNumber(num: number, numberFormat: NumberFormat = 'comma-decimal'): string {
    if (numberFormat === 'comma-decimal') {
        // Format as 1.000,00
        return num.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    } else {
        // Format as 1,000.00
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
}

export function formatNumberForExport(num: number): string {
    // Always use Argentine format for export
    return formatNumber(num, 'comma-decimal');
}
