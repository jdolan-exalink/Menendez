import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'menedez.db');
const db = new sqlite3.Database(dbPath);

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '100mb' }));

// Initialize SQLite Tables
db.serialize(() => {
    // Transactions
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        import_batch_id TEXT,
        provider TEXT,
        original_card_name TEXT,
        normalized_card TEXT,
        coupon_number TEXT,
        auth_code TEXT,
        batch_number TEXT,
        terminal_number TEXT,
        currency TEXT,
        transaction_date TEXT,
        payment_date TEXT,
        type TEXT,
        amount REAL,
        created_at TEXT,
        updated_at TEXT
    )`);

    // Import Batches
    db.run(`CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        provider TEXT,
        filename TEXT,
        imported_at TEXT,
        transaction_count INTEGER,
        total_amount REAL,
        duplicate_count INTEGER
    )`);

    // Providers
    db.run(`CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT,
        color TEXT,
        skipRows INTEGER,
        delimiter TEXT,
        dateFormat TEXT,
        numberFormat TEXT,
        columnMapping TEXT, -- JSON string
        created_at TEXT,
        updated_at TEXT
    )`);

    // Normalizations
    db.run(`CREATE TABLE IF NOT EXISTS card_normalizations (
        id TEXT PRIMARY KEY,
        normalized_name TEXT,
        original_names TEXT, -- JSON string
        name TEXT, -- Legacy support
        aliases TEXT, -- Legacy support
        created_at TEXT,
        updated_at TEXT
    )`);

    // ERP Transactions (from accounting system)
    db.run(`CREATE TABLE IF NOT EXISTS erp_transactions (
        id TEXT PRIMARY KEY,
        IdCuponTarjetaCredito TEXT,
        IdTarjeta TEXT,
        CuponNumero TEXT,
        CuponFecha TEXT,
        CuponRazonSocial TEXT,
        CuponImporte REAL,
        NumeroTarjeta TEXT,
        CuponDocumento TEXT,
        AcreditadoEnSeleccion TEXT,
        IdCierreTurno TEXT,
        IdCaja TEXT,
        TurnoDescripcion TEXT,
        IdLoteTarjetasCredito TEXT,
        LotePrefijo TEXT,
        LoteNumero TEXT,
        LoteFecha TEXT,
        LoteComprobante TEXT,
        NombreTarjeta TEXT,
        ComprobanteAcreditacion TEXT,
        Telefono TEXT,
        CodigoAprobacion TEXT,
        CuponPendiente TEXT,
        TipoAcreditacion TEXT,
        import_batch_id TEXT,
        imported_at TEXT
    )`);

    // Reconciliation results
    db.run(`CREATE TABLE IF NOT EXISTS reconciliations (
        id TEXT PRIMARY KEY,
        erp_transaction_id TEXT,
        provider_transaction_id TEXT,
        status TEXT, -- 'matched', 'erp_only', 'provider_only', 'amount_mismatch'
        amount_difference REAL,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
    )`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT -- JSON string
    )`);

    // Create indexes for better query performance
    // ERP Transactions indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_erp_transactions_date ON erp_transactions(CuponFecha)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_erp_transactions_auth ON erp_transactions(CodigoAprobacion)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_erp_transactions_card ON erp_transactions(NombreTarjeta)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_erp_transactions_batch ON erp_transactions(import_batch_id)`);
    
    // Provider Transactions indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_auth ON transactions(auth_code)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_card ON transactions(normalized_card)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions(provider)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_batch ON transactions(import_batch_id)`);
    
    // Import Batches indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_import_batches_provider ON import_batches(provider)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_import_batches_date ON import_batches(imported_at)`);
    
    // Reconciliations indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON reconciliations(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_reconciliations_erp ON reconciliations(erp_transaction_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_reconciliations_provider ON reconciliations(provider_transaction_id)`);
});

// Initialize default providers if none exist
const initializeDefaultProviders = () => {
    const defaultProviders = [
        {
            name: 'Jerarquicos',
            color: '#3b82f6',
            skipRows: 0,
            delimiter: ';',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'comma-decimal',
            columnMapping: {
                coupon_number: 'Cupn',
                transaction_date: 'Fecha',
                amount: 'Monto'
            }
        },
        {
            name: 'MercadoPago',
            color: '#fde047',
            skipRows: 0,
            delimiter: ';',
            dateFormat: 'ISO8601',
            numberFormat: 'dot-decimal',
            columnMapping: {
                payment_date: 'Fecha de Pago',
                type: 'Tipo de Operacin',
                coupon_number: 'Nmero de Movimiento',
                amount: 'Importe',
                transaction_date: 'Fecha de Pago'
            }
        },
        {
            name: 'Fiserv',
            color: '#f59e0b',
            skipRows: 0,
            delimiter: ';',
            dateFormat: 'DD/MM/YYYY HH:mm:ss',
            numberFormat: 'dot-decimal',
            columnMapping: {
                original_card_name: 'Marca',
                currency: 'Moneda',
                transaction_date: 'Fecha de operacion',
                payment_date: 'Fecha de pago',
                batch_number: 'Lote',
                auth_code: 'Autorizacion',
                amount: 'Monto Bruto',
                coupon_number: 'Ticket',
                terminal_number: 'Terminal',
                type: 'Tipo de mov.'
            }
        },
        {
            name: 'Payway',
            color: '#8b5cf6',
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
                auth_code: 'NRO_AUT'
            }
        },
        {
            name: 'American Express',
            color: '#006fcf',
            skipRows: 9,
            delimiter: ';',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'dot-decimal',
            columnMapping: {
                transaction_date: 'Fecha de la transaccin',
                payment_date: 'Fecha de liquidacin',
                amount: 'Cargos totales',
                coupon_number: 'Nmero de liquidacin',
                original_card_name: 'Enviando nombre de ubicacin'
            }
        },
        {
            name: 'Getnet',
            color: '#ef4444',
            skipRows: 0,
            delimiter: ';',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'comma-decimal',
            columnMapping: {
                transaction_date: 'Fecha',
                payment_date: 'Fecha de pago',
                type: 'Tipo',
                coupon_number: 'Nmero de cupn',
                amount: 'Monto',
                auth_code: 'Cdigo de autorizacin',
                batch_number: 'Lote',
                terminal_number: 'Terminal',
                original_card_name: 'Tarjeta'
            }
        }
    ];

    // Delete all existing providers first to avoid duplicates, then insert fresh
    db.run('DELETE FROM providers', (err) => {
        if (err) {
            console.error('Error deleting providers:', err);
            return;
        }
        
        const stmt = db.prepare(`INSERT INTO providers (
            id, name, color, skipRows, delimiter, dateFormat, numberFormat, columnMapping, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        const now = new Date().toISOString();
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            defaultProviders.forEach((p) => {
                // Deterministic ID based on provider name
                const id = `provider-${p.name.toLowerCase().replace(/\s+/g, '-')}`;
                stmt.run(
                    id, p.name, p.color, p.skipRows, p.delimiter, p.dateFormat, p.numberFormat,
                    JSON.stringify(p.columnMapping), now, now
                );
            });
            db.run('COMMIT', (err) => {
                stmt.finalize();
                if (err) {
                    console.error('Error initializing default providers:', err);
                } else {
                    console.log(`Initialized ${defaultProviders.length} default providers`);
                }
            });
        });
    });
};

// Initialize default card normalizations
const initializeDefaultNormalizations = () => {
    const defaults = [
        {
            original_names: ['VISA', 'VISA DEBITO', 'VISA CREDITO', 'Visa Debit', 'Visa Credit', 'VISA PAYWAVE'],
            normalized_name: 'Visa',
            color: '#2563ea'
        },
        {
            original_names: ['MASTERCARD', 'MASTERCARD DEBITO', 'MASTERCARD CREDITO', 'Mastercard Debit', 'Master', 'MASTERCARD PAYPASS'],
            normalized_name: 'Mastercard',
            color: '#ea580c'
        },
        {
            original_names: ['AMERICAN EXPRESS', 'AMEX', 'American Exp', 'AMEX PAY'],
            normalized_name: 'American Express',
            color: '#006fcf'
        },
        {
            original_names: ['CABAL', 'Cabal Debito', 'CABAL CREDITO'],
            normalized_name: 'Cabal',
            color: '#1e3a8a'
        },
        {
            original_names: ['NARANJA', 'Naranja X'],
            normalized_name: 'Naranja',
            color: '#f97316'
        },
        {
            original_names: ['NATIVA'],
            normalized_name: 'Nativa',
            color: '#22c55e'
        },
        {
            original_names: ['DINERS'],
            normalized_name: 'Diners',
            color: '#1d4ed8'
        },
        {
            original_names: ['CENCOSUD'],
            normalized_name: 'Cencosud',
            color: '#dc2626'
        }
    ];

    db.get('SELECT COUNT(*) as count FROM card_normalizations', (err, row: any) => {
        if (err) {
            console.error('Error checking normalizations count:', err);
            return;
        }
        
        if (row.count === 0) {
            console.log('No normalizations found, initializing defaults...');
            
            const stmt = db.prepare(`INSERT INTO card_normalizations (
                id, normalized_name, original_names, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?)`);

            const now = new Date().toISOString();
            
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                defaults.forEach((n, index) => {
                    const id = `norm-${Date.now()}-${index}`;
                    stmt.run(
                        id, n.normalized_name, JSON.stringify(n.original_names), now, now
                    );
                });
                db.run('COMMIT', (err) => {
                    stmt.finalize();
                    if (err) {
                        console.error('Error initializing default normalizations:', err);
                    } else {
                        console.log(`Initialized ${defaults.length} default normalizations`);
                    }
                });
            });
        } else {
            console.log(`Found ${row.count} existing normalizations, skipping initialization`);
        }
    });
};

// Start server immediately
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Database located at ${dbPath}`);
    
    // Initialize after server is listening
    setTimeout(() => {
        initializeDefaultProviders();
        initializeDefaultNormalizations();
    }, 100);
});

// Helper for JSON parsing/stringifying
const parseJSONFields = (row: any, fields: string[]) => {
    if (!row) return row;
    const newRow = { ...row };
    fields.forEach(field => {
        if (newRow[field]) {
            try {
                newRow[field] = JSON.parse(newRow[field]);
            } catch (e) {
                console.error(`Error parsing field ${field}:`, e);
            }
        }
    });
    return newRow;
};

// Routes

// Transactions
app.get('/api/transactions', (req, res) => {
    db.all('SELECT * FROM transactions', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get available months with data from both ERP and provider transactions
app.get('/api/available-months', (req, res) => {
    const months = new Set<string>();
    
    // Get months from provider transactions
    db.all(
        `SELECT DISTINCT strftime('%Y-%m', transaction_date) as month FROM transactions WHERE transaction_date IS NOT NULL`,
        (err, providerMonths: any[]) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            providerMonths.forEach((m) => {
                if (m.month) months.add(m.month);
            });
            
            // Get months from ERP transactions
            db.all(
                `SELECT DISTINCT strftime('%Y-%m', CuponFecha) as month FROM erp_transactions WHERE CuponFecha IS NOT NULL`,
                (err2, erpMonths: any[]) => {
                    if (err2) {
                        return res.status(500).json({ error: err2.message });
                    }
                    
                    erpMonths.forEach((m) => {
                        if (m.month) months.add(m.month);
                    });
                    
                    // Sort months descending (most recent first)
                    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
                    res.json(sortedMonths);
                }
            );
        }
    );
});

app.post('/api/transactions/bulk', (req, res) => {
    const transactions = req.body;
    const stmt = db.prepare(`INSERT OR REPLACE INTO transactions (
        id, import_batch_id, provider, original_card_name, normalized_card,
        coupon_number, auth_code, batch_number, terminal_number, currency,
        transaction_date, payment_date, type, amount, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        transactions.forEach((t: any) => {
            stmt.run(
                t.id, t.import_batch_id, t.provider, t.original_card_name, t.normalized_card,
                t.coupon_number, t.auth_code, t.batch_number, t.terminal_number, t.currency,
                t.transaction_date, t.payment_date, t.type, t.amount, t.created_at, t.updated_at
            );
        });
        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, count: transactions.length });
        });
    });
    stmt.finalize();
});

app.post('/api/transactions', (req, res) => {
    const t = req.body;
    db.run(`INSERT OR REPLACE INTO transactions (
        id, import_batch_id, provider, original_card_name, normalized_card,
        coupon_number, auth_code, batch_number, terminal_number, currency,
        transaction_date, payment_date, type, amount, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            t.id, t.import_batch_id, t.provider, t.original_card_name, t.normalized_card,
            t.coupon_number, t.auth_code, t.batch_number, t.terminal_number, t.currency,
            t.transaction_date, t.payment_date, t.type, t.amount, t.created_at, t.updated_at
        ], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.delete('/api/transactions/:id', (req, res) => {
    db.run('DELETE FROM transactions WHERE id = ?', req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/transactions/batch/:batchId', (req, res) => {
    db.run('DELETE FROM transactions WHERE import_batch_id = ?', req.params.batchId, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Import Batches
app.get('/api/import-batches', (req, res) => {
    db.all('SELECT * FROM import_batches ORDER BY imported_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/import-batches', (req, res) => {
    const b = req.body;
    db.run(`INSERT OR REPLACE INTO import_batches (
        id, provider, filename, imported_at, transaction_count, total_amount, duplicate_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.provider, b.filename, b.imported_at, b.transaction_count, b.total_amount, b.duplicate_count],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.delete('/api/import-batches/:id', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM transactions WHERE import_batch_id = ?', req.params.id);
        db.run('DELETE FROM import_batches WHERE id = ?', req.params.id, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Providers
app.get('/api/providers', (req, res) => {
    db.all('SELECT * FROM providers', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => parseJSONFields(r, ['columnMapping'])));
    });
});

app.post('/api/providers', (req, res) => {
    const p = req.body;
    db.run(`INSERT OR REPLACE INTO providers (
        id, name, color, skipRows, delimiter, dateFormat, numberFormat, columnMapping, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.color, p.skipRows, p.delimiter, p.dateFormat, p.numberFormat, JSON.stringify(p.columnMapping), p.created_at, p.updated_at],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.delete('/api/providers/:id', (req, res) => {
    db.run('DELETE FROM providers WHERE id = ?', req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Initialize default providers
app.post('/api/providers/initialize-defaults', (req, res) => {
    const defaultProviders = [
        {
            id: 'jerarquicos-' + Date.now(),
            name: 'Jerarquicos',
            color: '#3b82f6',
            skipRows: 0,
            delimiter: ';',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'comma-decimal',
            columnMapping: {
                coupon_number: 'Cupn',
                transaction_date: 'Fecha',
                amount: 'Monto'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'mercadopago-' + Date.now(),
            name: 'MercadoPago',
            color: '#fde047',
            skipRows: 0,
            delimiter: ';',
            dateFormat: 'ISO8601',
            numberFormat: 'dot-decimal',
            columnMapping: {
                payment_date: 'Fecha de Pago',
                type: 'Tipo de Operacin',
                coupon_number: 'Nmero de Movimiento',
                amount: 'Importe',
                transaction_date: 'Fecha de Pago'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'fiserv-' + Date.now(),
            name: 'Fiserv',
            color: '#f59e0b',
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
                terminal_number: 'Terminal'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'payway-' + Date.now(),
            name: 'Payway',
            color: '#8b5cf6',
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
                auth_code: 'NRO_AUT'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'amex-' + Date.now(),
            name: 'American Express',
            color: '#006fcf',
            skipRows: 9,
            delimiter: ';',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'dot-decimal',
            columnMapping: {
                transaction_date: 'Fecha de la transaccin',
                payment_date: 'Fecha de liquidacin',
                amount: 'Cargos totales',
                coupon_number: 'Nmero de liquidacin',
                original_card_name: 'Enviando nombre de ubicacin'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO providers (
        id, name, color, skipRows, delimiter, dateFormat, numberFormat, columnMapping, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    let inserted = 0;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        defaultProviders.forEach((p) => {
            stmt.run(
                p.id, p.name, p.color, p.skipRows, p.delimiter, p.dateFormat, p.numberFormat,
                JSON.stringify(p.columnMapping), p.created_at, p.updated_at,
                function(this: sqlite3.RunResult) {
                    if (this.changes > 0) inserted++;
                }
            );
        });
        db.run('COMMIT', (err) => {
            stmt.finalize();
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, inserted, total: defaultProviders.length });
        });
    });
});

// Normalizations
app.get('/api/normalizations', (req, res) => {
    db.all('SELECT * FROM card_normalizations', (err, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => {
            const parsed = parseJSONFields(r, ['original_names', 'aliases']);
            return {
                id: r.id,
                normalized_name: r.normalized_name || r.name,
                original_names: parsed.original_names || parsed.aliases,
                created_at: r.created_at,
                updated_at: r.updated_at
            };
        }));
    });
});

app.post('/api/normalizations', (req, res) => {
    const n = req.body;
    db.run(`INSERT OR REPLACE INTO card_normalizations (
        id, normalized_name, original_names, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)`,
        [n.id, n.normalized_name, JSON.stringify(n.original_names), n.created_at, n.updated_at],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.delete('/api/normalizations/:id', (req, res) => {
    db.run('DELETE FROM card_normalizations WHERE id = ?', req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Settings
app.get('/api/settings/:key', (req, res) => {
    db.get('SELECT value FROM settings WHERE key = ?', req.params.key, (err, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.value) : null);
    });
});

app.post('/api/settings/:key', (req, res) => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [req.params.key, JSON.stringify(req.body)], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// ERP Transactions
app.get('/api/erp-transactions', (req, res) => {
    db.all('SELECT * FROM erp_transactions ORDER BY CuponFecha DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/erp-transactions/bulk', (req, res) => {
    const transactions = req.body;
    const stmt = db.prepare(`INSERT OR REPLACE INTO erp_transactions (
        id, IdCuponTarjetaCredito, IdTarjeta, CuponNumero, CuponFecha, CuponRazonSocial,
        CuponImporte, NumeroTarjeta, CuponDocumento, AcreditadoEnSeleccion, IdCierreTurno,
        IdCaja, TurnoDescripcion, IdLoteTarjetasCredito, LotePrefijo, LoteNumero,
        LoteFecha, LoteComprobante, NombreTarjeta, ComprobanteAcreditacion, Telefono,
        CodigoAprobacion, CuponPendiente, TipoAcreditacion, import_batch_id, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        transactions.forEach((t: any) => {
            stmt.run(
                t.id, t.IdCuponTarjetaCredito, t.IdTarjeta, t.CuponNumero, t.CuponFecha,
                t.CuponRazonSocial, t.CuponImporte, t.NumeroTarjeta, t.CuponDocumento,
                t.AcreditadoEnSeleccion, t.IdCierreTurno, t.IdCaja, t.TurnoDescripcion,
                t.IdLoteTarjetasCredito, t.LotePrefijo, t.LoteNumero, t.LoteFecha,
                t.LoteComprobante, t.NombreTarjeta, t.ComprobanteAcreditacion, t.Telefono,
                t.CodigoAprobacion, t.CuponPendiente, t.TipoAcreditacion, t.import_batch_id,
                t.imported_at
            );
        });
        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, count: transactions.length });
        });
    });
    stmt.finalize();
});

app.delete('/api/erp-transactions/batch/:batchId', (req, res) => {
    db.run('DELETE FROM erp_transactions WHERE import_batch_id = ?', req.params.batchId, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Update single ERP transaction
app.put('/api/erp-transactions/:id', (req, res) => {
    const { id } = req.params;
    const t = req.body;
    
    db.run(
        `UPDATE erp_transactions SET 
            IdCuponTarjetaCredito = ?, IdTarjeta = ?, CuponNumero = ?, CuponFecha = ?,
            CuponRazonSocial = ?, CuponImporte = ?, NumeroTarjeta = ?, CuponDocumento = ?,
            AcreditadoEnSeleccion = ?, IdCierreTurno = ?, IdCaja = ?, TurnoDescripcion = ?,
            IdLoteTarjetasCredito = ?, LotePrefijo = ?, LoteNumero = ?, LoteFecha = ?,
            LoteComprobante = ?, NombreTarjeta = ?, ComprobanteAcreditacion = ?, Telefono = ?,
            CodigoAprobacion = ?, CuponPendiente = ?, TipoAcreditacion = ?
        WHERE id = ?`,
        [t.IdCuponTarjetaCredito, t.IdTarjeta, t.CuponNumero, t.CuponFecha,
         t.CuponRazonSocial, t.CuponImporte, t.NumeroTarjeta, t.CuponDocumento,
         t.AcreditadoEnSeleccion, t.IdCierreTurno, t.IdCaja, t.TurnoDescripcion,
         t.IdLoteTarjetasCredito, t.LotePrefijo, t.LoteNumero, t.LoteFecha,
         t.LoteComprobante, t.NombreTarjeta, t.ComprobanteAcreditacion, t.Telefono,
         t.CodigoAprobacion, t.CuponPendiente, t.TipoAcreditacion, id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Reconciliation - Enhanced with configurable tolerances and better matching
app.post('/api/reconcile', (req, res) => {
    const { startDate, endDate, options = {} } = req.body;
    
    // Configurable matching options with sensible defaults
    const MATCH_OPTIONS = {
        amountTolerance: options.amountTolerance || 1.0,  // $1.00 tolerance
        dateToleranceDays: options.dateToleranceDays || 2, // 2 days tolerance
        useFuzzyCardMatching: options.useFuzzyCardMatching !== false, // default true
        useAmountFuzzyMatch: options.useAmountFuzzyMatch !== false,   // default true
        ...options
    };

    // Get all ERP transactions in date range
    db.all(
        `SELECT * FROM erp_transactions WHERE CuponFecha >= ? AND CuponFecha <= ?`,
        [startDate, endDate],
        (err, erpTransactions: any[]) => {
            if (err) return res.status(500).json({ error: err.message });

            // Get all provider transactions in date range (normalize dates to include full end day)
            const extendedEndDate = `${endDate}T23:59:59.999Z`;
            db.all(
                `SELECT * FROM transactions WHERE transaction_date >= ? AND transaction_date <= ?`,
                [startDate, extendedEndDate],
                (err2, providerTransactions: any[]) => {
                    if (err2) return res.status(500).json({ error: err2.message });

                    const results: any[] = [];
                    const matchedProviderIds = new Set<string>();

                    // Enhanced card normalization with comprehensive mappings
                    const normalizeCard = (name: string): string => {
                        if (!name) return '';
                        let normalized = name.toUpperCase().trim();
                        
                        // Remove common suffixes/prefixes
                        normalized = normalized
                            .replace(/ - FISERV - POSNET/g, '')
                            .replace(/ - GETNET/g, '')
                            .replace(/ - PAYWAY/g, '')
                            .replace(/ - PRISMA/g, '')
                            .replace(/PAGO CON QR/g, 'QR');
                        
                        // Standardize DEBITO variations
                        normalized = normalized
                            .replace(/\bDEBITO\b/g, 'DEB')
                            .replace(/\bDEBIT\b/g, 'DEB')
                            .replace(/\bDB\b/g, 'DEB');
                        
                        // Standardize CREDITO variations  
                        normalized = normalized
                            .replace(/\bCREDITO\b/g, 'CRED')
                            .replace(/\bCREDIT\b/g, 'CRED')
                            .replace(/\bCR\b/g, 'CRED');
                        
                        // Standardize card names
                        const cardMappings: Record<string, string> = {
                            'AMERICAN EXPRESS': 'AMEX',
                            'AMERICANEXPRESS': 'AMEX',
                            'AMEX': 'AMEX',
                            'VISA DEB': 'VISA_DEB',
                            'VISA CRED': 'VISA_CRED',
                            'VISA': 'VISA',
                            'MASTERCARD DEB': 'MASTERCARD_DEB',
                            'MASTERCARD CRED': 'MASTERCARD_CRED',
                            'MASTERCARD': 'MASTERCARD',
                            'MASTER DEB': 'MASTERCARD_DEB',
                            'MASTER CRED': 'MASTERCARD_CRED',
                            'MASTER': 'MASTERCARD',
                            'CABAL DEB': 'CABAL_DEB',
                            'CABAL CRED': 'CABAL_CRED',
                            'CABAL': 'CABAL',
                            'NARANJA': 'NARANJA',
                            'NARANJA X': 'NARANJA',
                            'NATIVA': 'NATIVA',
                            'DINERS': 'DINERS',
                            'TARJETA SHOPPING': 'SHOPPING',
                            'CORDOBESA': 'CORDOBESA',
                            'CORDIAL': 'CORDIAL',
                            'MERCADOPAGO QR': 'MERCADOPAGO_QR',
                            'MERCADO PAGO QR': 'MERCADOPAGO_QR',
                            'MP QR': 'MERCADOPAGO_QR',
                            'MERCADOPAGO': 'MERCADOPAGO',
                            'MERCADO PAGO': 'MERCADOPAGO',
                            'MP': 'MERCADOPAGO',
                            'JERARQUICOS': 'JERARQUICOS',
                            'JERARQUICO': 'JERARQUICOS',
                            'LINK': 'LINK',
                            'BANELCO': 'BANELCO',
                            'PAGOFACIL': 'PAGOFACIL',
                            'RAPIPAGO': 'RAPIPAGO',
                            'CENCOSUD': 'CENCOSUD',
                            'HIPERCARD': 'HIPERCARD',
                            'ELO': 'ELO',
                            'DISCOVER': 'DISCOVER',
                            'JCB': 'JCB',
                            'MAESTRO': 'MAESTRO',
                            'CIRRUS': 'CIRRUS',
                            'PLUS': 'PLUS'
                        };
                        
                        // Check for exact match first
                        if (cardMappings[normalized]) {
                            return cardMappings[normalized];
                        }
                        
                        // Check for partial matches
                        for (const [key, value] of Object.entries(cardMappings)) {
                            if (normalized.includes(key) || key.includes(normalized)) {
                                return value;
                            }
                        }
                        
                        // Remove spaces for fallback comparison
                        return normalized.replace(/\s+/g, '');
                    };

                    const normalizeAuth = (code: string | number): string => {
                        if (code === undefined || code === null) return '';
                        return String(code).trim().replace(/^0+/, '').toUpperCase();
                    };

                    const parseDate = (dateStr: string): Date | null => {
                        if (!dateStr) return null;
                        try {
                            const date = new Date(dateStr);
                            return isNaN(date.getTime()) ? null : date;
                        } catch {
                            return null;
                        }
                    };

                    const datesWithinTolerance = (date1: string, date2: string, toleranceDays: number): boolean => {
                        const d1 = parseDate(date1);
                        const d2 = parseDate(date2);
                        if (!d1 || !d2) return false;
                        
                        const diffTime = Math.abs(d1.getTime() - d2.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays <= toleranceDays;
                    };

                    // Pre-index provider transactions for efficient lookups
                    // Map: authCode -> Transaction[]
                    const providerByAuth = new Map<string, any[]>();
                    // Map: normalizedCard -> Transaction[]
                    const providerByCard = new Map<string, any[]>();
                    // Map: date -> Transaction[]
                    const providerByDate = new Map<string, any[]>();
                    // Map: authCode_amount -> Transaction[]
                    const providerByAuthAndAmount = new Map<string, any[]>();
                    // Map: date_card_amount -> Transaction[]
                    const providerByDateCardAndAmount = new Map<string, any[]>();

                    providerTransactions.forEach(prov => {
                        const amount = parseFloat(String(prov.amount || '0'));
                        const auth = normalizeAuth(prov.auth_code);
                        const card = normalizeCard(prov.normalized_card || prov.original_card_name);
                        const date = String(prov.transaction_date || '').split('T')[0];

                        // Index by auth code
                        if (auth) {
                            if (!providerByAuth.has(auth)) providerByAuth.set(auth, []);
                            providerByAuth.get(auth)!.push(prov);
                            
                            const key = `${auth}_${amount.toFixed(2)}`;
                            if (!providerByAuthAndAmount.has(key)) providerByAuthAndAmount.set(key, []);
                            providerByAuthAndAmount.get(key)!.push(prov);
                        }

                        // Index by card
                        if (card) {
                            if (!providerByCard.has(card)) providerByCard.set(card, []);
                            providerByCard.get(card)!.push(prov);
                        }

                        // Index by date
                        if (date) {
                            if (!providerByDate.has(date)) providerByDate.set(date, []);
                            providerByDate.get(date)!.push(prov);
                        }

                        const key2 = `${date}_${card}_${amount.toFixed(2)}`;
                        if (!providerByDateCardAndAmount.has(key2)) providerByDateCardAndAmount.set(key2, []);
                        providerByDateCardAndAmount.get(key2)!.push(prov);
                    });

                    // Scoring function for fuzzy matching
                    const calculateMatchScore = (erp: any, prov: any): number => {
                        let score = 0;
                        const erpAmount = parseFloat(String(erp.CuponImporte || '0').replace(',', '.'));
                        const provAmount = parseFloat(String(prov.amount || '0'));
                        const erpAuth = normalizeAuth(erp.CodigoAprobacion);
                        const provAuth = normalizeAuth(prov.auth_code);
                        const erpCard = normalizeCard(erp.NombreTarjeta);
                        const provCard = normalizeCard(prov.normalized_card || prov.original_card_name);
                        
                        // Auth code match (highest weight)
                        if (erpAuth && provAuth && erpAuth === provAuth) {
                            score += 40;
                        }
                        
                        // Amount match with tolerance
                        const amountDiff = Math.abs(erpAmount - provAmount);
                        if (amountDiff < 0.01) {
                            score += 30;
                        } else if (amountDiff <= MATCH_OPTIONS.amountTolerance) {
                            score += 20 - (amountDiff / MATCH_OPTIONS.amountTolerance * 10);
                        }
                        
                        // Card match
                        if (erpCard && provCard) {
                            if (erpCard === provCard) {
                                score += 20;
                            } else if (erpCard.includes(provCard) || provCard.includes(erpCard)) {
                                score += 10;
                            }
                        }
                        
                        // Date match with tolerance
                        const erpDate = String(erp.CuponFecha || '').split('T')[0];
                        const provDate = String(prov.transaction_date || '').split('T')[0];
                        if (datesWithinTolerance(erpDate, provDate, MATCH_OPTIONS.dateToleranceDays)) {
                            score += 10;
                        }
                        
                        return score;
                    };

                    // Match each ERP transaction
                    erpTransactions.forEach(erp => {
                        const erpAmount = parseFloat(String(erp.CuponImporte || '0').replace(',', '.'));
                        const erpAuthCode = normalizeAuth(erp.CodigoAprobacion);
                        const erpCard = normalizeCard(erp.NombreTarjeta);
                        const erpDate = String(erp.CuponFecha || '').split('T')[0];

                        let match: any = null;
                        let matchScore = 0;

                        // Level 1: Exact match - Auth Code + Amount
                        if (erpAuthCode) {
                            const key = `${erpAuthCode}_${erpAmount.toFixed(2)}`;
                            const candidates = providerByAuthAndAmount.get(key);
                            if (candidates) {
                                match = candidates.find(c => !matchedProviderIds.has(c.id));
                                if (match) matchScore = 100;
                            }
                        }

                        // Level 2: Exact match - Date + Card + Amount
                        if (!match) {
                            const key2 = `${erpDate}_${erpCard}_${erpAmount.toFixed(2)}`;
                            const candidates2 = providerByDateCardAndAmount.get(key2);
                            if (candidates2) {
                                match = candidates2.find(c => !matchedProviderIds.has(c.id));
                                if (match) matchScore = 90;
                            }
                        }

                        // Level 3: Fuzzy match - Auth Code + Amount within tolerance
                        if (!match && erpAuthCode && MATCH_OPTIONS.useAmountFuzzyMatch) {
                            const authCandidates = providerByAuth.get(erpAuthCode);
                            if (authCandidates) {
                                for (const candidate of authCandidates) {
                                    if (matchedProviderIds.has(candidate.id)) continue;
                                    const provAmount = parseFloat(String(candidate.amount || '0'));
                                    const amountDiff = Math.abs(erpAmount - provAmount);
                                    
                                    if (amountDiff <= MATCH_OPTIONS.amountTolerance) {
                                        const score = calculateMatchScore(erp, candidate);
                                        if (score > matchScore && score >= 60) {
                                            match = candidate;
                                            matchScore = score;
                                        }
                                    }
                                }
                            }
                        }

                        // Level 4: Fuzzy match - Card + Amount within date tolerance
                        if (!match && MATCH_OPTIONS.useFuzzyCardMatching) {
                            const cardCandidates = providerByCard.get(erpCard);
                            if (cardCandidates) {
                                for (const candidate of cardCandidates) {
                                    if (matchedProviderIds.has(candidate.id)) continue;
                                    const provAmount = parseFloat(String(candidate.amount || '0'));
                                    const provDate = String(candidate.transaction_date || '').split('T')[0];
                                    const amountDiff = Math.abs(erpAmount - provAmount);
                                    
                                    if (amountDiff <= MATCH_OPTIONS.amountTolerance && 
                                        datesWithinTolerance(erpDate, provDate, MATCH_OPTIONS.dateToleranceDays)) {
                                        const score = calculateMatchScore(erp, candidate);
                                        if (score > matchScore && score >= 50) {
                                            match = candidate;
                                            matchScore = score;
                                        }
                                    }
                                }
                            }
                        }

                        // Level 5: Date-based match - Same date, similar amount, any card
                        if (!match) {
                            const dateCandidates = providerByDate.get(erpDate);
                            if (dateCandidates) {
                                for (const candidate of dateCandidates) {
                                    if (matchedProviderIds.has(candidate.id)) continue;
                                    const provAmount = parseFloat(String(candidate.amount || '0'));
                                    const amountDiff = Math.abs(erpAmount - provAmount);
                                    
                                    if (amountDiff <= MATCH_OPTIONS.amountTolerance) {
                                        const score = calculateMatchScore(erp, candidate);
                                        if (score > matchScore && score >= 40) {
                                            match = candidate;
                                            matchScore = score;
                                        }
                                    }
                                }
                            }
                        }

                        if (match) {
                            matchedProviderIds.add(match.id);
                            const provAmount = parseFloat(String(match.amount || '0'));
                            const amountDiff = Math.abs(erpAmount - provAmount);
                            
                            results.push({
                                erp_transaction: erp,
                                provider_transaction: match,
                                status: amountDiff < 0.01 ? 'matched' : 'amount_mismatch',
                                amount_difference: amountDiff < 0.01 ? 0 : erpAmount - provAmount,
                                match_score: Math.round(matchScore),
                                match_details: {
                                    auth_match: normalizeAuth(erp.CodigoAprobacion) === normalizeAuth(match.auth_code),
                                    card_match: erpCard === normalizeCard(match.normalized_card || match.original_card_name),
                                    date_match: datesWithinTolerance(erpDate, String(match.transaction_date || '').split('T')[0], MATCH_OPTIONS.dateToleranceDays),
                                    amount_diff: amountDiff
                                }
                            });
                        } else {
                            // Check for amount mismatch with same auth code
                            let amountMismatch: any = null;
                            if (erpAuthCode) {
                                const authCandidates = providerByAuth.get(erpAuthCode);
                                if (authCandidates) {
                                    amountMismatch = authCandidates.find(p => !matchedProviderIds.has(p.id));
                                }
                            }

                            if (amountMismatch) {
                                matchedProviderIds.add(amountMismatch.id);
                                results.push({
                                    erp_transaction: erp,
                                    provider_transaction: amountMismatch,
                                    status: 'amount_mismatch',
                                    amount_difference: erpAmount - parseFloat(String(amountMismatch.amount || '0')),
                                    match_score: 25,
                                    match_details: {
                                        auth_match: true,
                                        card_match: false,
                                        date_match: false,
                                        amount_diff: Math.abs(erpAmount - parseFloat(String(amountMismatch.amount || '0')))
                                    }
                                });
                            } else {
                                results.push({
                                    erp_transaction: erp,
                                    provider_transaction: null,
                                    status: 'erp_only',
                                    amount_difference: 0,
                                    match_score: 0,
                                    match_details: null
                                });
                            }
                        }
                    });

                    // Add remaining provider transactions
                    providerTransactions.forEach(prov => {
                        if (!matchedProviderIds.has(prov.id)) {
                            results.push({
                                erp_transaction: null,
                                provider_transaction: prov,
                                status: 'provider_only',
                                amount_difference: 0,
                                match_score: 0,
                                match_details: null
                            });
                        }
                    });

                    res.json({
                        total: results.length,
                        matched: results.filter(r => r.status === 'matched').length,
                        erp_only: results.filter(r => r.status === 'erp_only').length,
                        provider_only: results.filter(r => r.status === 'provider_only').length,
                        amount_mismatch: results.filter(r => r.status === 'amount_mismatch').length,
                        options_used: MATCH_OPTIONS,
                        results
                    });
                }
            );
        }
    );
});

app.get('/api/reconciliations', (req, res) => {
    db.all('SELECT * FROM reconciliations ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reconciliations', (req, res) => {
    const r = req.body;
    db.run(`INSERT OR REPLACE INTO reconciliations (
        id, erp_transaction_id, provider_transaction_id, status, amount_difference, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.erp_transaction_id, r.provider_transaction_id, r.status, r.amount_difference, r.notes, r.created_at, r.updated_at],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Server already started above
// app.listen(PORT, ...) is called before initialization
