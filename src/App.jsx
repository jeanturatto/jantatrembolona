import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JantasPage from './pages/JantasPage';
import RelatoriosPage from './pages/RelatoriosPage';
import AdminPage from './pages/AdminPage';
import AvaliacoesPage from './pages/AvaliacoesPage';
import ForcePasswordChange from './components/ForcePasswordChange';

class GlobalErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, info: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { this.setState({ info }); console.error(error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', backgroundColor: '#fff', fontFamily: 'monospace' }}>
          <h2>💥 ALERTA DE ERRO CRÍTICO (Envie para a IA) 💥</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
          <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Wrapper
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, isAdmin, loading, profile } = useAuth();
  const [profileTimeout, setProfileTimeout] = React.useState(false);

  // Aguarda o profile ser carregado após o user estar disponível.
  // Timeout de segurança de 5s para nunca travar.
  React.useEffect(() => {
    if (user && !profile) {
      const t = setTimeout(() => setProfileTimeout(true), 5000);
      return () => clearTimeout(t);
    }
    setProfileTimeout(false);
  }, [user, profile]);

  // Tela de carregando APENAS na inicialização inicial OU enquanto aguarda profile (com timeout)
  const waitingForProfile = user && !profile && !profileTimeout;
  if (loading || waitingForProfile) return (
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
    <GlobalErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rota pública */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rotas protegidas (com Layout) */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="jantas" element={<JantasPage />} />
              <Route path="avaliacoes" element={<AvaliacoesPage />} />
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
    </GlobalErrorBoundary>
  );
}
