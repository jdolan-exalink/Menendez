export type TransactionType = 'Cupón' | 'QR' | 'Transferencia';

export interface Transaction {
    id: string; // UUID
    import_batch_id: string | null; // UUID to track which import batch this belongs to (null for manual transactions)
    provider: string; // "Payway", "MercadoPago", etc.

    // Card information
    original_card_name: string; // Raw value from CSV
    normalized_card: string; // Normalized/grouped value

    // Transaction details
    coupon_number: string;
    auth_code: string;
    batch_number: string;
    terminal_number: string;
    currency: string;

    // Dates
    transaction_date: Date;
    payment_date: Date;

    // Type and amount
    type: 'Cupón' | 'QR' | 'Transferencia';
    amount: number;

    // Metadata
    created_at: Date;
    updated_at: Date;
}

export interface ImportBatch {
    id: string; // UUID
    provider: string;
    filename: string;
    imported_at: Date;
    transaction_count: number;
    total_amount: number;
    duplicate_count: number;
}

export interface TransactionFilter {
    startDate?: Date;
    endDate?: Date;
    providers?: string[];
    types?: TransactionType[];
    searchTerm?: string;
}
