# Testing Guide - Sistema de Conciliación de Pagos

## 🚀 Quick Start

### 1. Access the Application
Open your browser and navigate to: **http://localhost:5173**

You should see a beautiful gradient login page with glassmorphism effects.

### 2. Login
- **Username**: `admin`
- **Password**: `admin123`

Click "Iniciar Sesión" to access the system.

---

## 📊 Testing the Dashboard

After login, you'll be on the Dashboard page showing:
- **Total Ventas**: Sum of all imported transactions (initially $0.00)
- **Ticket Promedio**: Average transaction value
- **Transacciones**: Total count
- **Proveedores**: Number of active providers

Since no data has been imported yet, you'll see an empty state message.

---

## 📤 Testing CSV Import

### Step 1: Navigate to Import
Click **"Importar"** in the left sidebar.

### Step 2: Select a Provider
Choose one of the pre-configured providers from the dropdown:
- Payway
- MercadoPago
- Fiserv
- Jerarquicos

### Step 3: Upload CSV File
Use one of the sample files in the `docs/` folder:

#### Test Jerarquicos
1. Select **"Jerarquicos"** from dropdown
2. Click file input and select `docs/sample-jerarquicos.csv`
3. Click **"Importar Transacciones"**
4. You should see: ✅ "Importadas 5 transacciones exitosamente"

#### Test Payway
1. Select **"Payway"** from dropdown
2. Upload `docs/sample-payway.csv`
3. Click import
4. Expected: ✅ "Importadas 5 transacciones exitosamente"
   - Note: First row is automatically skipped (header)

#### Test MercadoPago
1. Select **"MercadoPago"** from dropdown
2. Upload `docs/sample-mercadopago.csv`
3. Click import
4. Expected: ✅ "Importadas 4 transacciones exitosamente"
   - Note: "Retención Impuesto" rows are automatically filtered out

#### Test Fiserv
1. Select **"Fiserv"** from dropdown
2. Upload `docs/sample-fiserv.csv`
3. Click import
4. Expected: ✅ "Importadas 5 transacciones exitosamente"

### Step 4: View Dashboard
1. Click **"Dashboard"** in sidebar
2. You should now see:
   - Updated KPI cards with real values
   - **Ventas por Proveedor** section with percentage bars
   - Each provider shown with their total amount

---

## 🎨 Testing Theme Toggle

Click the **Sun/Moon** icon in the top-right header to toggle between light and dark modes.
- The theme preference is saved to localStorage
- All components should adapt colors smoothly

---

## 🔍 What to Look For

### ✅ Expected Behavior

#### Import System
- Automatic delimiter detection (`;` vs `,`)
- Automatic date format parsing (DD/MM/YYYY, ISO8601, etc.)
- Automatic number format handling (comma vs dot decimals)
- Argentine format numbers correctly parsed (e.g., `67.200,00` → `67200.00`)
- MercadoPago retentions filtered out
- Success message with transaction count

#### Dashboard
- KPIs update after import
- Provider breakdown bars show correct percentages
- Amounts displayed in Argentine format (`$67.200,00`)
- Smooth animations on mount

#### UI/UX
- Glassmorphism effects on cards
- Smooth transitions between pages
- Responsive sidebar navigation
- Active page highlighted in purple
- Loading states during import

### ⚠️ Known Limitations (Features In Progress)

- **Transactions page**: Placeholder only (table not implemented yet)
- **Providers page**: Placeholder only (CRUD UI not implemented yet)
- **Normalization page**: Placeholder only (alias management UI not implemented yet)
- **Charts**: Not yet implemented (only KPI cards work)
- **Export**: Service exists but no UI button yet

---

## 🐛 Troubleshooting

### Error: "Database not initialized"
This should be fixed with the loading screen. If you still see it:
1. Hard refresh the page (Ctrl+Shift+R)
2. Clear browser cache
3. Check browser console for other errors

### Import Not Working
1. Verify the CSV file format matches the provider
2. Check browser console for parsing errors
3. Try a different sample file

### No Data Showing After Import
1. Navigate away and back to Dashboard
2. Check browser DevTools → Application → IndexedDB → `conciliacion-pagos-db`
3. Verify transactions are stored in the `transactions` store

### Theme Not Changing
1. Check if `dark` class is being added to `<html>` element
2. Clear localStorage and try again
3. Check browser console for errors

---

## 📝 Testing Checklist

- [ ] Login with correct credentials
- [ ] Login rejects incorrect credentials
- [ ] Dashboard shows empty state initially
- [ ] Import Jerarquicos CSV successfully
- [ ] Dashboard updates with new data
- [ ] Import Payway CSV (tests header skip)
- [ ] Import MercadoPago CSV (tests ISO dates & filtering)
- [ ] Import Fiserv CSV (tests datetime format)
- [ ] Dashboard shows all 4 providers in breakdown
- [ ] Theme toggle works (light ↔ dark)
- [ ] Theme persists after page reload
- [ ] Sidebar navigation works
- [ ] Logout redirects to login
- [ ] Login again shows persistent data

---

## 🔬 Advanced Testing

### Test Data Persistence
1. Import some CSVs
2. Close browser completely
3. Reopen and navigate to http://localhost:5173
4. Login
5. Verify all imported data is still there

### Test Multiple Imports
1. Import `sample-jerarquicos.csv`
2. Import `sample-payway.csv`
3. Import same file again
4. Verify duplicates are created (no duplicate detection yet)

### Test Edge Cases
1. Try uploading a non-CSV file
2. Try importing without selecting provider
3. Try importing an empty CSV

---

## 📊 Expected Results After Full Test

If you import all 4 sample CSVs:

**Total Transactions**: ~19 transactions  
(5 Jerarquicos + 5 Payway + 4 MercadoPago + 5 Fiserv)

**Total Sales**: Sum of all amounts  
**Providers**: 4 active  

**Card Normalizations Applied**:
- "VISA DEBITO" → "Visa"
- "MASTERCARD CREDITO" → "Mastercard"
- "AMERICAN EXPRESS" → "American Express"
- "CABAL DEBITO" → "Cabal"
- "Mastercard Debit" → "Mastercard"
- "Visa Credit" → "Visa"
- etc.

---

## 🎯 Success Criteria

The implementation is working correctly if:
1. ✅ All 4 sample CSVs import without errors
2. ✅ Dashboard shows correct totals
3. ✅ Numbers are formatted in Argentine style
4. ✅ Dark/light theme works smoothly
5. ✅ Data persists across browser sessions
6. ✅ No console errors (except the React DevTools suggestion)
