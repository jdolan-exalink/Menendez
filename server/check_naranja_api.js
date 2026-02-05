const http = require('http');

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error('Failed to parse JSON:', data.substring(0, 100));
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function check() {
    try {
        console.log('Fetching transactions...');
        const transactions = await fetch('http://localhost:3001/api/transactions');
        console.log(`Total transactions: ${transactions.length}`);

        console.log('Fetching normalizations...');
        const normalizations = await fetch('http://localhost:3001/api/normalizations');

        const naranjaNorms = normalizations.filter(n =>
            (n.normalized_name && n.normalized_name.toLowerCase().includes('naranja')) ||
            (n.original_names && n.original_names.some(on => on.toLowerCase().includes('naranja')))
        );
        console.log('Naranja Normalizations:', JSON.stringify(naranjaNorms, null, 2));

        const naranjaTx = transactions.filter(t => {
            const orig = (t.original_card_name || '').toLowerCase();
            const norm = (t.normalized_card || '').toLowerCase();
            const prov = (t.provider || '').toLowerCase();
            return orig.includes('naranja') || norm.includes('naranja') || prov.includes('naranja');
        });

        console.log(`Found ${naranjaTx.length} transactions related to Naranja.`);
        if (naranjaTx.length > 0) {
            console.log('Sample Naranja transactions:', naranjaTx.slice(0, 5));
        }

        // Also check if there are any transactions that *should* be Naranja but aren't labeled as such
        // Maybe by checking unique original names again
        const uniqueNames = [...new Set(transactions.map(t => t.original_card_name))].filter(Boolean);
        console.log('\nUnique Original Card Names in DB:', uniqueNames.sort());

    } catch (error) {
        console.error('Error executing script:', error);
    }
}

check();
