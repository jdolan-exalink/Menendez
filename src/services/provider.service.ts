import { v4 as uuidv4 } from 'uuid';
import type { ProviderConfig } from '../types';
import { dbService } from './db.service';

export class ProviderService {
    async initializeDefaults(): Promise<void> {
        const defaults: Omit<ProviderConfig, 'id' | 'created_at' | 'updated_at'>[] = [
            {
                name: 'Jerarquicos',
                color: '#3b82f6', // Blue
                skipRows: 0,
                delimiter: ';',
                dateFormat: 'DD/MM/YYYY',
                numberFormat: 'comma-decimal',
                columnMapping: {
                    coupon_number: 'Cupón',
                    transaction_date: 'Fecha',
                    amount: 'Monto',
                },
            },
            {
                name: 'MercadoPago',
                color: '#fde047', // Yellow (bright)
                skipRows: 0,
                delimiter: ';',
                dateFormat: 'ISO8601',
                numberFormat: 'dot-decimal',
                columnMapping: {
                    payment_date: 'Fecha de Pago',
                    type: 'Tipo de Operación',
                    coupon_number: 'Número de Movimiento',
                    amount: 'Importe',
                    transaction_date: 'Fecha de Pago', // Use payment date as transaction date
                },
            },
            {
                name: 'Fiserv',
                color: '#f59e0b', // Orange
                skipRows: 0,
                delimiter: ';',
                dateFormat: 'DD/MM/YYYY HH:mm:ss',
                numberFormat: 'comma-decimal',
                columnMapping: {
                    original_card_name: 'Marca',
                    currency: 'Moneda',
                    transaction_date: 'Fecha',
                    payment_date: 'pago',
                    batch_number: 'Lote',
                    auth_code: 'Autorizaci',
                    amount: 'Monto Bruto',
                    coupon_number: 'Ticket',
                    terminal_number: 'Terminal',
                },
            },
            {
                name: 'Payway',
                color: '#8b5cf6', // Violet
                skipRows: 1,
                delimiter: ';',
                dateFormat: 'DD/MM/YYYY',
                numberFormat: 'dot-decimal',
                columnMapping: {
                    transaction_date: 'COMPRA',
                    payment_date: 'PAGO',
                    type: 'TIPO',
                    batch_number: 'LOTE',
                    coupon_number: 'NUM.CUPON',
                    original_card_name: 'MARCA',
                    terminal_number: 'ESTABLECIMIENTO',
                    amount: 'MONTO_BRUTO',
                    auth_code: 'NRO_AUT',
                },
            },
            {
                name: 'American Express',
                color: '#006fcf', // Amex Blue
                skipRows: 9,
                delimiter: ';', // Not used for Excel but good for uniformity
                dateFormat: 'DD/MM/YYYY',
                numberFormat: 'dot-decimal',
                columnMapping: {
                    transaction_date: 'Fecha de la transacción',
                    payment_date: 'Fecha de liquidación',
                    amount: 'Cargos totales',
                    coupon_number: 'Número de liquidación',
                    original_card_name: 'Enviando nombre de ubicación',
                },
            },
        ];

        // Get existing providers
        const existing = await dbService.getAllProviders();
        const existingNames = new Map(existing.map(p => [p.name, p]));

        // Migrate MercadoPago color if it exists with old colors
        const mercadoPago = existingNames.get('MercadoPago');
        if (mercadoPago && (mercadoPago.color === '#10b981' || mercadoPago.color === '#fbbf24')) {
            // Old green or old yellow, update to new bright yellow
            await dbService.updateProvider({
                ...mercadoPago,
                color: '#fde047',
                updated_at: new Date()
            });
        }

        // Ensure Payway has skipRows: 1 and auth_code mapping if it already exists
        const payway = existingNames.get('Payway');
        if (payway && (payway.skipRows === 0 || !payway.columnMapping['auth_code'])) {
            await dbService.updateProvider({
                ...payway,
                skipRows: 1,
                columnMapping: {
                    ...payway.columnMapping,
                    auth_code: 'NRO_AUT'
                },
                updated_at: new Date()
            });
        }

        // Create providers that don't exist yet, or update colors if missing
        for (const provider of defaults) {
            const existingProvider = existingNames.get(provider.name);
            if (!existingProvider) {
                await this.createProvider(provider);
            } else if (!existingProvider.color) {
                // Restore missing color
                await dbService.updateProvider({
                    ...existingProvider,
                    color: provider.color,
                    updated_at: new Date()
                });
            }
        }
    }

    async createProvider(
        providerData: Omit<ProviderConfig, 'id' | 'created_at' | 'updated_at'>
    ): Promise<ProviderConfig> {
        const now = new Date();
        const provider: ProviderConfig = {
            ...providerData,
            id: uuidv4(),
            created_at: now,
            updated_at: now,
        };

        await dbService.addProvider(provider);
        return provider;
    }

    async updateProvider(provider: ProviderConfig): Promise<void> {
        await dbService.updateProvider(provider);
    }

    async deleteProvider(id: string): Promise<void> {
        await dbService.deleteProvider(id);
    }

    async getProvider(id: string): Promise<ProviderConfig | undefined> {
        return dbService.getProvider(id);
    }

    async getAllProviders(): Promise<ProviderConfig[]> {
        return dbService.getAllProviders();
    }
}

export const providerService = new ProviderService();
