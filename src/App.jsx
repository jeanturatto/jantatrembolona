import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JantasPage from './pages/JantasPage';
import RelatoriosPage from './pages/RelatoriosPage';
import AdminPage from './pages/AdminPage';
import ForcePasswordChange from './components/ForcePasswordChange';

// Protected Route Wrapper
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, isAdmin, loading, profile } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen bg-[#f2f1fb] dark:bg-[#090914] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 bg-[#2842B5] rounded-xl flex items-center justify-center opacity-80 animate-pulse" />
        <span className="text-[11px] font-medium text-zinc-400 dark:text-[#5a5a80] tracking-widest uppercase">Carregando...</span>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.must_change_password) return <ForcePasswordChange />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rotas protegidas (com Layout) */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="jantas" element={<JantasPage />} />
            <Route path="relatorios" element={<RelatoriosPage />} />
            <Route path="admin" element={
              <ProtectedRoute requireAdmin={true}>
                <AdminPage />
              </ProtectedRoute>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
