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

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT -- JSON string
    )`);
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

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Database located at ${dbPath}`);
});
