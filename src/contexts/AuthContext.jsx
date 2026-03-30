import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const refreshProfile = useCallback(async (userId) => {
    if (!userId || !mountedRef.current) return;
    profileFetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (mountedRef.current) setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (mountedRef.current) {
        setProfile({
          name: 'Usuário',
          role: 'USER',
          faltas_nao_justificadas: 0,
          inadimplente: false
        });
      }
    } finally {
      profileFetchingRef.current = false;
    }
  }, []);

  // Função para garantir que a sessão está ativa e renovar se necessário
  const ensureSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return null;

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;

      // Se expira em menos de 5 minutos, renova preventivamente
      if (expiresAt - nowSec < 300) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.warn('Não foi possível renovar a sessão');
          return null;
        }
        return refreshData.session;
      }

      return session;
    } catch (err) {
      console.error('ensureSession error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const initializeAuth = async () => {
      const fallbackTimer = setTimeout(() => {
        if (mountedRef.current) setLoading(false);
      }, 8000);

      try {
        // Verifica se usuário escolheu NÃO ser lembrado
        const noPersist = localStorage.getItem('jantatrembo-no-persist') === '1';
        const hasActiveSession = sessionStorage.getItem('jantatrembo-session-active') === '1';

        if (noPersist && !hasActiveSession) {
          await supabase.auth.signOut({ scope: 'local' });
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        const session = await ensureSession();

        if (session) {
          const currentUser = session.user;
          if (mountedRef.current) {
            sessionStorage.setItem('jantatrembo-session-active', '1');
            setUser(currentUser);
            await refreshProfile(currentUser.id);
          }
        } else {
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('AuthContext: Erro ao inicializar:', err);
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mountedRef.current) {
          clearTimeout(fallbackTimer);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listener de eventos de auth do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const currentUser = session?.user || null;
        if (mountedRef.current) {
          if (currentUser) {
            sessionStorage.setItem('jantatrembo-session-active', '1');
            setUser(currentUser);
            await refreshProfile(currentUser.id);
          } else {
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        }
        return;
      }

      // Fallback para outros eventos
      const currentUser = session?.user || null;
      if (mountedRef.current) {
        setUser(currentUser);
        if (currentUser && !profileFetchingRef.current) {
          await refreshProfile(currentUser.id);
        } else if (!currentUser) {
          setProfile(null);
        }
        setLoading(false);
      }
    });

    // ─── RENOVAÇÃO PERIÓDICA DE SESSÃO ───────────────────────────────────────
    // Roda a cada 10 minutos para garantir que o token nunca expira enquanto
    // o usuário está ativo na página
    const refreshInterval = setInterval(async () => {
      if (!mountedRef.current) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;

      // Renova se expira em menos de 10 minutos
      if (expiresAt - nowSec < 600) {
        console.log('AuthContext: renovando token preventivamente...');
        await supabase.auth.refreshSession();
      }
    }, 10 * 60 * 1000); // a cada 10 minutos

    // ─── RECONEXÃO QUANDO A ABA VOLTA AO FOCO ────────────────────────────────
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !mountedRef.current) return;

      // Quando o usuário volta à aba, verifica se a sessão ainda é válida
      const session = await ensureSession();
      if (!session && mountedRef.current) {
        // Sessão expirou enquanto estava fora — força logout
        setUser(null);
        setProfile(null);
      } else if (session && mountedRef.current) {
        const currentUser = session.user;
        setUser(currentUser);
        // Reload silencioso do perfil para garantir dados frescos
        if (currentUser && !profileFetchingRef.current) {
          await refreshProfile(currentUser.id);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ensureSession, refreshProfile]);

  const signIn = async (email, password, rememberMe = true) => {
    if (!rememberMe) {
      localStorage.setItem('jantatrembo-no-persist', '1');
    } else {
      localStorage.removeItem('jantatrembo-no-persist');
    }
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error) {
      sessionStorage.setItem('jantatrembo-session-active', '1');
    }
    return result;
  };

  const signUp = async (email, password, meta) => {
    return supabase.auth.signUp({
      email,
      password,
      options: { data: meta }
    });
  };

  const signOut = async () => {
    localStorage.removeItem('jantatrembo-no-persist');
    sessionStorage.removeItem('jantatrembo-session-active');
    return supabase.auth.signOut();
  };

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin, refreshProfile, ensureSession }}>
      {loading ? (
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center justify-center gap-3">
          <div className="animate-spin h-8 w-8 border-4 border-zinc-900 border-t-transparent rounded-full dark:border-white dark:border-t-transparent"></div>
          <p className="text-xs text-zinc-400 font-medium">Verificando sessão...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
