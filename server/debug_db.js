
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('d:/DEVs/Menedez/server/data/menedez.db');

console.log('--- ERP Transactions Sample ---');
db.all("SELECT CodigoAprobacion, NombreTarjeta, CuponImporte, CuponFecha FROM erp_transactions LIMIT 10", (err, rows) => {
    if (err) console.error(err);
    console.table(rows);

    console.log('--- Provider Transactions Sample ---');
    db.all("SELECT auth_code, normalized_card, amount, transaction_date FROM transactions LIMIT 10", (err2, rows2) => {
        if (err2) console.error(err2);
        console.table(rows2);
        db.close();
    });
});
