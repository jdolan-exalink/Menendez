const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'menedez.db');
console.log('Checking database at:', dbPath);
const db = new sqlite3.Database(dbPath);

console.log('Querying...');

db.serialize(() => {
    // Check Normalizations
    console.log('\n--- Checking Card Normalizations for Naranja ---');
    db.all("SELECT * FROM card_normalizations WHERE original_names LIKE '%Naranja%' OR normalized_name LIKE '%Naranja%'", (err, rows) => {
        if (err) {
            console.error('Error querying normalizations:', err);
        } else {
            console.log('Found normalizations:', JSON.stringify(rows, null, 2));
        }
    });

    // Check Transactions
    console.log('\n--- Checking Transactions for Naranja ---');
    const query = `
        SELECT id, original_card_name, normalized_card, provider, amount, transaction_date 
        FROM transactions 
        WHERE original_card_name LIKE '%Naranja%' 
           OR normalized_card LIKE '%Naranja%' 
           OR provider LIKE '%Naranja%'
    `;
    db.all(query, (err, rows) => {
        if (err) {
            console.error('Error querying transactions:', err);
        } else {
            console.log(`Found ${rows.length} transactions.`);
            if (rows.length > 0) {
                console.log('Sample transactions:', rows.slice(0, 5));
            }
        }
    });

    // Check all unique original_card_names to see what's actually there
    console.log('\n--- All Unique Original Card Names (Sample) ---');
    db.all("SELECT DISTINCT original_card_name FROM transactions LIMIT 50", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log(rows.map(r => r.original_card_name));
        }
    });
});

db.close();
