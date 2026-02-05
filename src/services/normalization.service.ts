import { v4 as uuidv4 } from 'uuid';
import type { CardNormalization, Transaction } from '../types';
import { dbService } from './db.service';

export class NormalizationService {
    private normalizations: CardNormalization[] = [];

    async loadNormalizations(): Promise<void> {
        this.normalizations = await dbService.getAllCardNormalizations();
    }

    private async ensureNormalizationsLoaded(): Promise<void> {
        if (this.normalizations.length === 0) {
            await this.loadNormalizations();
        }
    }

    async applyNormalization(transaction: Transaction): Promise<Transaction> {
        const normalized = this.findNormalizedName(transaction.original_card_name);
        return {
            ...transaction,
            normalized_card: normalized || transaction.original_card_name,
        };
    }

    async applyNormalizations(transactions: Transaction[]): Promise<Transaction[]> {
        await this.ensureNormalizationsLoaded();
        return transactions.map((t) => {
            let normalizedCard = this.findNormalizedName(t.original_card_name) || t.original_card_name;

            // Special handling for MercadoPago QR
            if (t.provider === 'MercadoPago' && t.type === 'QR') {
                normalizedCard = 'Mercadopago QR';
            }

            // Special handling for Jerarquicos
            if (t.provider.toLowerCase().includes('jerarquicos') && !t.original_card_name) {
                normalizedCard = 'Jerarquicos';
            }

            // Special handling for American Express
            if (t.provider === 'American Express') {
                normalizedCard = 'American Express';
            }

            return {
                ...t,
                normalized_card: normalizedCard,
            };
        });
    }

    getFormattedCardName(transaction: Transaction): string {
        // 1. Check normalization rules
        const normalized = this.findNormalizedName(transaction.original_card_name);
        if (normalized) return normalized;

        // 2. Special handling for MercadoPago QR
        if (transaction.provider === 'MercadoPago' && transaction.type === 'QR') {
            return 'Mercadopago QR';
        }

        // 3. Special handling for Jerarquicos
        if (transaction.provider.toLowerCase().includes('jerarquicos')) {
            return 'Jerarquicos';
        }

        // 4. Special handling for American Express (provider level)
        if (transaction.provider === 'American Express') {
            return 'American Express';
        }

        // 5. Fallback to original
        return transaction.normalized_card || transaction.original_card_name || 'Sin especificar';
    }

    getCardColor(cardName: string): string | null {
        if (!cardName) return null;
        const lower = cardName.toLowerCase().trim();

        const norm = this.normalizations.find(n => {
            const normNameMatch = n.normalized_name && n.normalized_name.toLowerCase().trim() === lower;
            const aliasMatch = n.original_names && Array.isArray(n.original_names) &&
                n.original_names.some(on => on && on.toLowerCase().trim() === lower);

            return normNameMatch || aliasMatch;
        });

        return norm?.color || null;
    }

    findNormalizedName(originalName: string): string | null {
        if (!originalName) return null;
        const lower = originalName.toLowerCase().trim();

        for (const norm of this.normalizations) {
            if (norm.original_names && Array.isArray(norm.original_names)) {
                if (norm.original_names.some((name) => name && name.toLowerCase().trim() === lower)) {
                    return norm.normalized_name;
                }
            }
        }

        return null;
    }

    async getDetectedOriginalNames(): Promise<{ name: string; isNormalized: boolean; currentNormalization?: string }[]> {
        const transactions = await dbService.getAllTransactions();
        const normalizations = await dbService.getAllCardNormalizations();

        const uniqueNames = new Set<string>();
        transactions.forEach(t => {
            if (t.original_card_name) uniqueNames.add(t.original_card_name);
        });

        const sortedNames = Array.from(uniqueNames).sort();

        return sortedNames.map(name => {
            const lowerName = name.toLowerCase().trim();
            const foundNorm = normalizations.find(n =>
                n.original_names.some(on => on.toLowerCase().trim() === lowerName)
            );

            return {
                name,
                isNormalized: !!foundNorm,
                currentNormalization: foundNorm?.normalized_name
            };
        });
    }

    /**
     * Updates all transactions in the database to reflect the current normalization rules.
     */
    async updateTransactionsNormalization(): Promise<void> {
        await this.loadNormalizations();
        const transactions = await dbService.getAllTransactions();
        const updatedTransactions: Transaction[] = [];

        for (const t of transactions) {
            const newNormalizedName = this.getFormattedCardName(t);
            if (t.normalized_card !== newNormalizedName) {
                updatedTransactions.push({
                    ...t,
                    normalized_card: newNormalizedName
                });
            }
        }

        if (updatedTransactions.length > 0) {
            await dbService.addTransactions(updatedTransactions);
        }
    }

    async detectNewCardNames(transactions: Transaction[]): Promise<string[]> {
        const newNames: Set<string> = new Set();

        for (const transaction of transactions) {
            const normalized = this.findNormalizedName(transaction.original_card_name);
            if (!normalized && transaction.original_card_name) {
                newNames.add(transaction.original_card_name);
            }
        }

        return Array.from(newNames);
    }

    async addNormalization(originalNames: string[], normalizedName: string, color?: string): Promise<void> {
        const normalization: CardNormalization = {
            id: uuidv4(),
            original_names: originalNames,
            normalized_name: normalizedName,
            color,
            created_at: new Date(),
            updated_at: new Date(),
        };

        await dbService.addCardNormalization(normalization);
        await this.updateTransactionsNormalization();
    }

    async updateNormalization(id: string, originalNames: string[], normalizedName: string, color?: string): Promise<void> {
        const existing = await dbService.getCardNormalization(id);
        if (!existing) {
            throw new Error('Normalization not found');
        }

        const updated: CardNormalization = {
            ...existing,
            original_names: originalNames,
            normalized_name: normalizedName,
            color,
            updated_at: new Date(),
        };

        await dbService.updateCardNormalization(updated);
        await this.updateTransactionsNormalization();
    }

    async deleteNormalization(id: string): Promise<void> {
        await dbService.deleteCardNormalization(id);
        await this.updateTransactionsNormalization();
    }

    getSimilarNormalizedNames(originalName: string): string[] {
        const lower = originalName.toLowerCase();
        const similar: Set<string> = new Set();

        for (const norm of this.normalizations) {
            // Check if any part of the original name matches
            if (lower.includes(norm.normalized_name.toLowerCase()) ||
                norm.normalized_name.toLowerCase().includes(lower)) {
                similar.add(norm.normalized_name);
            }
        }

        return Array.from(similar);
    }

    // Initialize with default card normalizations
    async initializeDefaults(): Promise<void> {
        const existing = await dbService.getAllCardNormalizations();
        if (existing.length > 0) return;

        const defaults: Array<{ original_names: string[]; normalized_name: string; color: string }> = [
            {
                original_names: ['VISA', 'VISA DEBITO', 'VISA CREDITO', 'Visa Debit', 'Visa Credit'],
                normalized_name: 'Visa',
                color: '#2563ea',
            },
            {
                original_names: ['MASTERCARD', 'MASTERCARD DEBITO', 'MASTERCARD CREDITO', 'Mastercard Debit', 'Master'],
                normalized_name: 'Mastercard',
                color: '#ea580c',
            },
            {
                original_names: ['AMERICAN EXPRESS', 'AMEX', 'American Exp'],
                normalized_name: 'American Express',
                color: '#006fcf',
            },
            {
                original_names: ['CABAL', 'Cabal Debito', 'CABAL CREDITO'],
                normalized_name: 'Cabal',
                color: '#1e3a8a',
            },
            {
                original_names: ['NARANJA', 'Naranja X'],
                normalized_name: 'Naranja',
                color: '#f97316',
            },
        ];

        for (const def of defaults) {
            await this.addNormalization(def.original_names, def.normalized_name, def.color);
        }
    }
}

export const normalizationService = new NormalizationService();
