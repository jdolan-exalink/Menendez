import type { Transaction, ImportBatch, ProviderConfig, CardNormalization } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
    private async fetchJson(endpoint: string, options?: RequestInit) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }
        return response.json();
    }

    // Transactions
    async getAllTransactions(): Promise<Transaction[]> {
        const transactions = await this.fetchJson('/transactions');
        return transactions.map((t: any) => ({
            ...t,
            transaction_date: new Date(t.transaction_date),
            payment_date: new Date(t.payment_date),
            created_at: new Date(t.created_at),
            updated_at: new Date(t.updated_at)
        }));
    }

    async addTransactions(transactions: Transaction[]): Promise<void> {
        return this.fetchJson('/transactions/bulk', {
            method: 'POST',
            body: JSON.stringify(transactions),
        });
    }


    async addTransaction(transaction: Transaction): Promise<void> {
        return this.fetchJson('/transactions', {
            method: 'POST',
            body: JSON.stringify(transaction),
        });
    }

    async deleteTransaction(id: string): Promise<void> {
        return this.fetchJson(`/transactions/${id}`, { method: 'DELETE' });
    }

    async deleteTransactionsByBatch(batchId: string): Promise<void> {
        return this.fetchJson(`/transactions/batch/${batchId}`, { method: 'DELETE' });
    }

    // Import Batches
    async getAllImportBatches(): Promise<ImportBatch[]> {
        const batches = await this.fetchJson('/import-batches');
        return batches.map((b: any) => ({
            ...b,
            imported_at: new Date(b.imported_at)
        }));
    }

    async addImportBatch(batch: ImportBatch): Promise<void> {
        return this.fetchJson('/import-batches', {
            method: 'POST',
            body: JSON.stringify(batch),
        });
    }

    async deleteImportBatch(id: string): Promise<void> {
        return this.fetchJson(`/import-batches/${id}`, { method: 'DELETE' });
    }

    // Providers
    async getAllProviders(): Promise<ProviderConfig[]> {
        const providers = await this.fetchJson('/providers');
        return providers.map((p: any) => ({
            ...p,
            created_at: new Date(p.created_at),
            updated_at: new Date(p.updated_at)
        }));
    }

    async updateProvider(provider: ProviderConfig): Promise<void> {
        return this.fetchJson('/providers', {
            method: 'POST',
            body: JSON.stringify(provider),
        });
    }

    async deleteProvider(id: string): Promise<void> {
        return this.fetchJson(`/providers/${id}`, { method: 'DELETE' });
    }

    // Normalizations
    async getAllCardNormalizations(): Promise<CardNormalization[]> {
        const normalizations = await this.fetchJson('/normalizations');
        return normalizations.map((n: any) => ({
            ...n,
            created_at: new Date(n.created_at),
            updated_at: new Date(n.updated_at)
        }));
    }

    async updateCardNormalization(normalization: CardNormalization): Promise<void> {
        return this.fetchJson('/normalizations', {
            method: 'POST',
            body: JSON.stringify(normalization),
        });
    }

    async deleteCardNormalization(id: string): Promise<void> {
        return this.fetchJson(`/normalizations/${id}`, { method: 'DELETE' });
    }


    // Settings
    async getSetting(key: string): Promise<any> {
        return this.fetchJson(`/settings/${key}`);
    }

    async setSetting(key: string, value: any): Promise<void> {
        return this.fetchJson(`/settings/${key}`, {
            method: 'POST',
            body: JSON.stringify(value),
        });
    }
}

export const apiService = new ApiService();
