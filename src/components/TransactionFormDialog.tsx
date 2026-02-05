import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { Transaction } from '../types/transaction.types';
import type { ProviderConfig } from '../types/provider.types';
import { dbService } from '../services/db.service';
import { normalizationService } from '../services/normalization.service';
import { v4 as uuidv4 } from 'uuid';

interface TransactionFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    transaction?: Transaction; // Si se pasa, es edición. Si no, es creación
}

export const TransactionFormDialog: React.FC<TransactionFormDialogProps> = ({
    open,
    onClose,
    onSave,
    transaction
}) => {
    const isEdit = !!transaction;

    const [providers, setProviders] = useState<ProviderConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    // Form state
    const [formData, setFormData] = useState({
        provider: '',
        original_card_name: '',
        coupon_number: '',
        auth_code: '',
        batch_number: '',
        terminal_number: '',
        currency: 'ARS',
        transaction_date: '',
        payment_date: '',
        type: 'Cupón' as 'Cupón' | 'QR' | 'Transferencia',
        amount: ''
    });

    // Load providers on mount
    useEffect(() => {
        const loadProviders = async () => {
            await normalizationService.loadNormalizations(); // Cargar normalizaciones
            const allProviders = await dbService.getAllProviders();
            setProviders(allProviders);
        };
        loadProviders();
    }, []);

    // Initialize form with transaction data if editing
    useEffect(() => {
        if (transaction) {
            setFormData({
                provider: transaction.provider,
                original_card_name: transaction.original_card_name,
                coupon_number: transaction.coupon_number,
                auth_code: transaction.auth_code,
                batch_number: transaction.batch_number,
                terminal_number: transaction.terminal_number,
                currency: transaction.currency,
                transaction_date: transaction.transaction_date.toISOString().split('T')[0],
                payment_date: transaction.payment_date.toISOString().split('T')[0],
                type: transaction.type,
                amount: transaction.amount.toString()
            });
        } else {
            // Reset form for new transaction
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                provider: providers[0]?.name || '',
                original_card_name: '',
                coupon_number: '',
                auth_code: '',
                batch_number: '',
                terminal_number: '',
                currency: 'ARS',
                transaction_date: today,
                payment_date: today,
                type: 'Cupón',
                amount: ''
            });
        }
    }, [transaction, providers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Validation
            if (!formData.provider) {
                throw new Error('Proveedor es requerido');
            }
            if (!formData.amount || parseFloat(formData.amount) <= 0) {
                throw new Error('El monto debe ser mayor a 0');
            }
            if (!formData.transaction_date) {
                throw new Error('Fecha de transacción es requerida');
            }

            // Normalize card name
            const normalizedCard = normalizationService.findNormalizedName(
                formData.original_card_name || 'Sin especificar'
            ) || formData.original_card_name || 'Sin especificar';

            // Create transaction object
            const transactionData: Transaction = {
                id: transaction?.id || uuidv4(),
                provider: formData.provider,
                original_card_name: formData.original_card_name || 'Sin especificar',
                normalized_card: normalizedCard,
                coupon_number: formData.coupon_number,
                auth_code: formData.auth_code,
                batch_number: formData.batch_number,
                terminal_number: formData.terminal_number,
                currency: formData.currency,
                transaction_date: new Date(formData.transaction_date),
                payment_date: new Date(formData.payment_date),
                type: formData.type,
                amount: parseFloat(formData.amount),
                import_batch_id: transaction?.import_batch_id || null, // mantener o null para manual
                created_at: transaction?.created_at || new Date(),
                updated_at: new Date()
            };

            // Save to database
            if (isEdit) {
                await dbService.updateTransaction(transactionData);
            } else {
                await dbService.addTransaction(transactionData);
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar la transacción');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent onClose={onClose}>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Editar Transacción' : 'Nueva Transacción'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Modifica los campos de la transacción'
                            : 'Completa el formulario para crear una nueva transacción manualmente'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <DialogBody>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Proveedor */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-2">
                                    Proveedor <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="provider"
                                    value={formData.provider}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                >
                                    <option value="">Seleccionar proveedor...</option>
                                    {providers.map(provider => (
                                        <option key={provider.id} value={provider.name}>
                                            {provider.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Tipo de Transacción */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Tipo <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                >
                                    <option value="Cupón">Cupón</option>
                                    <option value="QR">QR</option>
                                    <option value="Transferencia">Transferencia</option>
                                </select>
                            </div>

                            {/* Monto */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Monto <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            {/* Tarjeta */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Tarjeta
                                </label>
                                <Input
                                    type="text"
                                    name="original_card_name"
                                    value={formData.original_card_name}
                                    onChange={handleChange}
                                    placeholder="Ej: Visa, Mastercard, etc."
                                />
                            </div>

                            {/* Moneda */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Moneda
                                </label>
                                <Input
                                    type="text"
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleChange}
                                    placeholder="ARS, USD, etc."
                                />
                            </div>

                            {/* Fecha de Transacción */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Fecha de Transacción <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="date"
                                    name="transaction_date"
                                    value={formData.transaction_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            {/* Fecha de Pago */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Fecha de Pago <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="date"
                                    name="payment_date"
                                    value={formData.payment_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            {/* Número de Cupón */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Número de Cupón
                                </label>
                                <Input
                                    type="text"
                                    name="coupon_number"
                                    value={formData.coupon_number}
                                    onChange={handleChange}
                                    placeholder="Ej: 123456"
                                />
                            </div>

                            {/* Código de Autorización */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Código de Autorización
                                </label>
                                <Input
                                    type="text"
                                    name="auth_code"
                                    value={formData.auth_code}
                                    onChange={handleChange}
                                    placeholder="Ej: ABC123"
                                />
                            </div>

                            {/* Número de Lote */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Número de Lote
                                </label>
                                <Input
                                    type="text"
                                    name="batch_number"
                                    value={formData.batch_number}
                                    onChange={handleChange}
                                    placeholder="Ej: 001"
                                />
                            </div>

                            {/* Terminal */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Terminal
                                </label>
                                <Input
                                    type="text"
                                    name="terminal_number"
                                    value={formData.terminal_number}
                                    onChange={handleChange}
                                    placeholder="Ej: TERM01"
                                />
                            </div>
                        </div>
                    </DialogBody>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Transacción')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
