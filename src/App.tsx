import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Import } from './pages/Import';
import { Providers } from './pages/Providers';
import { Normalization } from './pages/Normalization';
import { ImportHistory } from './pages/ImportHistory';
import { Reconciliation } from './pages/Reconciliation';
import { dbService } from './services/db.service';
import { providerService } from './services/provider.service';
import { normalizationService } from './services/normalization.service';
import { useAuthStore } from './stores/auth.store';
import './index.css';

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize database and load defaults
    const initApp = async () => {
      try {
        await dbService.init();
        await providerService.initializeDefaults();
        await normalizationService.initializeDefaults();
        await normalizationService.loadNormalizations();
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitialized(true); // Still allow app to load
      }
    };

    checkAuth();
    initApp();
  }, [checkAuth]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 dark:from-purple-900 dark:via-purple-950 dark:to-indigo-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Inicializando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/import" element={<Import />} />
            <Route path="/import-history" element={<ImportHistory />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/normalization" element={<Normalization />} />
            <Route path="/reconciliation" element={<Reconciliation />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
