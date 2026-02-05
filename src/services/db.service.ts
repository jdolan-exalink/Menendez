import { apiService } from './api.service';
import type { Transaction, ImportBatch, ProviderConfig, CardNormalization } from '../types';

class DatabaseService {
    async init(): Promise<void> {
        // No-op or we could check backend connectivity here
        console.log('Database (API) initialized');
    }

    // Transactions
    async addTransaction(transaction: Transaction): Promise<void> {
        await apiService.addTransaction(transaction);
    }

    async addTransactions(transactions: Transaction[]): Promise<void> {
        await apiService.addTransactions(transactions);
    }

    async getTransaction(id: string): Promise<Transaction | undefined> {
        const all = await apiService.getAllTransactions();
        return all.find(t => t.id === id);
    }

    async getAllTransactions(): Promise<Transaction[]> {
        return apiService.getAllTransactions();
    }

    async updateTransaction(transaction: Transaction): Promise<void> {
        transaction.updated_at = new Date();
        await apiService.addTransaction(transaction); // Both use POST/PUT interchangeably in our simple backend
    }

    async deleteTransaction(id: string): Promise<void> {
        await apiService.deleteTransaction(id);
    }

    async deleteTransactions(ids: string[]): Promise<void> {
        // Simple loop for now, can optimize backend later if needed
        for (const id of ids) {
            await apiService.deleteTransaction(id);
        }
    }

    async clearAllTransactions(): Promise<void> {
        // Dangerous, but implementation for completeness
        const all = await apiService.getAllTransactions();
        for (const t of all) {
            await apiService.deleteTransaction(t.id);
        }
    }

    async getTransactionsByBatch(batchId: string): Promise<Transaction[]> {
        const all = await apiService.getAllTransactions();
        return all.filter(t => t.import_batch_id === batchId);
    }

    async deleteTransactionsByBatch(batchId: string): Promise<void> {
        await apiService.deleteTransactionsByBatch(batchId);
    }

    async findDuplicateTransactions(
        provider: string,
        couponNumber: string,
        transactionDate: Date,
        amount: number
    ): Promise<Transaction[]> {
        const allTransactions = await apiService.getAllTransactions();
        const providerTransactions = allTransactions.filter(t => t.provider === provider);

        return providerTransactions.filter((t) => {
            const sameDate = new Date(t.transaction_date).toDateString() === transactionDate.toDateString();
            const sameAmount = Math.abs(t.amount - amount) < 0.01;
            const sameCoupon = t.coupon_number === couponNumber;
            return sameDate && sameAmount && sameCoupon;
        });
    }

    // Import Batches
    async addImportBatch(batch: ImportBatch): Promise<void> {
        await apiService.addImportBatch(batch);
    }

    async getImportBatch(id: string): Promise<ImportBatch | undefined> {
        const all = await apiService.getAllImportBatches();
        return all.find(b => b.id === id);
    }

    async getAllImportBatches(): Promise<ImportBatch[]> {
        return apiService.getAllImportBatches();
    }

    async deleteImportBatch(id: string): Promise<void> {
        await apiService.deleteImportBatch(id);
    }

    // Providers
    async addProvider(provider: ProviderConfig): Promise<void> {
        await apiService.updateProvider(provider);
    }

    async getProvider(id: string): Promise<ProviderConfig | undefined> {
        const all = await apiService.getAllProviders();
        return all.find(p => p.id === id);
    }

    async getAllProviders(): Promise<ProviderConfig[]> {
        return apiService.getAllProviders();
    }

    async updateProvider(provider: ProviderConfig): Promise<void> {
        provider.updated_at = new Date();
        await apiService.updateProvider(provider);
    }

    async deleteProvider(id: string): Promise<void> {
        await apiService.deleteProvider(id);
    }

    // Card Normalizations
    async addCardNormalization(normalization: CardNormalization): Promise<void> {
        await apiService.updateCardNormalization(normalization);
    }

    async getCardNormalization(id: string): Promise<CardNormalization | undefined> {
        const all = await apiService.getAllCardNormalizations();
        return all.find(n => n.id === id);
    }

    async getAllCardNormalizations(): Promise<CardNormalization[]> {
        return apiService.getAllCardNormalizations();
    }

    async updateCardNormalization(normalization: CardNormalization): Promise<void> {
        normalization.updated_at = new Date();
        await apiService.updateCardNormalization(normalization);
    }

    async deleteCardNormalization(id: string): Promise<void> {
        await apiService.deleteCardNormalization(id);
    }

    // Settings
    async getSetting(key: string): Promise<any> {
        return apiService.getSetting(key);
    }

    async setSetting(key: string, value: any): Promise<void> {
        await apiService.setSetting(key, value);
    }
}

export const dbService = new DatabaseService();

