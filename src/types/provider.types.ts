export interface ProviderMapping {
    [systemField: string]: string;
}

export interface ProviderConfig {
    id: string;
    name: string;
    color: string; // Hex color for visual identification
    columnMapping: ProviderMapping;
    skipRows: number;
    dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'ISO8601' | 'DD/MM/YYYY HH:mm:ss';
    numberFormat: 'comma-decimal' | 'dot-decimal';
    delimiter: ';' | ',';
    created_at: Date;
    updated_at: Date;
}

export interface CardNormalization {
    id: string;
    original_names: string[];
    normalized_name: string;
    color?: string;
    created_at: Date;
    updated_at: Date;
}

export const SYSTEM_FIELDS = [
    'transaction_date',
    'payment_date',
    'type',
    'batch_number',
    'coupon_number',
    'original_card_name',
    'terminal_number',
    'amount',
    'auth_code',
    'currency',
] as const;

export type SystemField = typeof SYSTEM_FIELDS[number];
