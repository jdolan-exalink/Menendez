import { parse, format, isValid } from 'date-fns';

export type DateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'ISO8601' | 'DD/MM/YYYY HH:mm:ss';

export function detectDateFormat(samples: string[]): DateFormat {
    const formats: DateFormat[] = [
        'DD/MM/YYYY',
        'YYYY-MM-DD',
        'ISO8601',
        'DD/MM/YYYY HH:mm:ss',
    ];

    const scores = formats.map((fmt) => {
        let successCount = 0;
        for (const sample of samples.slice(0, 10)) {
            if (parseDate(sample, fmt)) {
                successCount++;
            }
        }
        return { format: fmt, score: successCount };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores[0].score > 0 ? scores[0].format : 'DD/MM/YYYY';
}

export function parseDate(dateStr: string, dateFormat: DateFormat): Date | null {
    if (!dateStr) return null;

    try {
        // ISO8601 format
        if (dateFormat === 'ISO8601') {
            const date = new Date(dateStr);
            return isValid(date) ? date : null;
        }

        // DD/MM/YYYY HH:mm:ss
        if (dateFormat === 'DD/MM/YYYY HH:mm:ss') {
            const date = parse(dateStr, 'd/M/yyyy HH:mm:ss', new Date());
            return isValid(date) ? date : null;
        }

        // DD/MM/YYYY
        if (dateFormat === 'DD/MM/YYYY') {
            // Using d/M/yyyy is more flexible than dd/MM/yyyy as it handles both 1/1/2024 and 01/01/2024
            const date = parse(dateStr, 'd/M/yyyy', new Date());
            return isValid(date) ? date : null;
        }

        // YYYY-MM-DD
        if (dateFormat === 'YYYY-MM-DD') {
            const date = parse(dateStr, 'yyyy-MM-dd', new Date());
            return isValid(date) ? date : null;
        }

        return null;
    } catch {
        return null;
    }
}

export function formatDate(date: Date, dateFormat: DateFormat = 'DD/MM/YYYY'): string {
    if (dateFormat === 'ISO8601') {
        return date.toISOString();
    }
    if (dateFormat === 'DD/MM/YYYY HH:mm:ss') {
        return format(date, 'dd/MM/yyyy HH:mm:ss');
    }
    if (dateFormat === 'YYYY-MM-DD') {
        return format(date, 'yyyy-MM-dd');
    }
    return format(date, 'dd/MM/yyyy');
}

export function formatDateForExport(date: Date): string {
    return format(date, 'dd/MM/yyyy');
}
