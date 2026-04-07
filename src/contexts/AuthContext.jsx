import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// Flag que indica se o usuário escolheu "Lembrar usuário"
const REMEMBER_FLAG = 'jantatrembo-remember';
// Chave onde o Supabase armazena a sessão (definida em supabase.js)
const SESSION_KEY = 'jantatrembo-auth';

/**
 * Migra sessão do sessionStorage (formato antigo) para o localStorage (novo),
 * para que usuários existentes não sejam deslogados na atualização.
 */
function migrateSessionFromStorage() {
  try {
    const SESSION_KEY_LOCAL = 'jantatrembo-auth';
    const existingLocal = localStorage.getItem(SESSION_KEY_LOCAL);
    if (!existingLocal) {
      const fromSession = sessionStorage.getItem(SESSION_KEY_LOCAL);
      if (fromSession) {
        localStorage.setItem(SESSION_KEY_LOCAL, fromSession);
        console.info('AuthContext: sessão migrada do sessionStorage para localStorage.');
      }
    }
  } catch (_) {}
}

// Executa migração imediatamente ao carregar o módulo
migrateSessionFromStorage();

/**
 * Remove a sessão completamente (logout).
 * O Supabase usa localStorage agora, então basta limpar de lá.
 */
function clearAllSessions() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_FLAG);
    // Limpa chaves legadas do formato sb-*
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    // Limpa sessionStorage legado caso exista
    try {
      sessionStorage.removeItem(SESSION_KEY);
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-')) sessionStorage.removeItem(key);
      });
    } catch (_) {}
  } catch (e) {
    console.error('Erro ao limpar sessão:', e);
  }
}

/**
 * Quando "lembrar" NÃO está ativo, registra um timestamp de expiração
 * curto (8h) para simular uma sessão de aba.
 * Na próxima abertura sem "lembrar", se a sessão expirou, ela é removida.
 */
function applySessionExpiry(rememberMe) {
  try {
    if (rememberMe) {
      localStorage.removeItem('jantatrembo-session-expiry');
    } else {
      // Sessão expira em 8 horas
      const expiry = Date.now() + 8 * 60 * 60 * 1000;
      localStorage.setItem('jantatrembo-session-expiry', String(expiry));
    }
  } catch (_) {}
}

/**
 * Verifica se a sessão expirou (para usuários sem "lembrar").
 * Retorna true se deve apagar a sessão.
 */
function isSessionExpired() {
  try {
    const expiry = localStorage.getItem('jantatrembo-session-expiry');
    if (!expiry) return false; // sem expiração = lembrar ativo
    return Date.now() > Number(expiry);
  } catch (_) {
    return false;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const initDoneRef = useRef(false);

  const refreshProfile = useCallback(async (userId) => {
    if (!userId || !mountedRef.current) return;
    if (profileFetchingRef.current) return;
    profileFetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Se o usuário está bloqueado, força logout imediato
      if (data?.blocked === true) {
        console.warn('AuthContext: usuário bloqueado, forçando logout.');
        localStorage.setItem('show_blocked_modal', 'true');
        clearAllSessions();
        await supabase.auth.signOut();
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
        }
        return;
      }

      if (mountedRef.current) setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (mountedRef.current) {
        setProfile({
          name: 'Usuário',
          role: 'USER',
          faltas_nao_justificadas: 0,
          inadimplente: false,
          blocked: false,
        });
      }
    } finally {
      profileFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Fallback: libera loading em 10s caso algo falhe
    const fallbackTimer = setTimeout(() => {
      if (mountedRef.current && !initDoneRef.current) {
        console.warn('AuthContext: fallback timer triggered');
        setLoading(false);
        initDoneRef.current = true;
      }
    }, 10000);

    const initializeAuth = async () => {
      try {
        // Se a sessão sem "lembrar" expirou, limpa e não inicializa
        if (isSessionExpired()) {
          console.info('AuthContext: sessão expirada (sem lembrar), limpando.');
          clearAllSessions();
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('AuthContext: getSession error:', error);
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        if (session?.user) {
          if (mountedRef.current) {
            setUser(session.user);
            await refreshProfile(session.user.id);
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
          initDoneRef.current = true;
        }
      }
    };

    initializeAuth();

    // Listener de eventos de auth do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      console.debug('AuthContext: event=', event);

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearAllSessions();
        setUser(null);
        setProfile(null);
        if (initDoneRef.current) setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const currentUser = session?.user || null;
        if (mountedRef.current) {
          if (currentUser) {
            setUser(currentUser);
            if (!profileFetchingRef.current) {
              await refreshProfile(currentUser.id);
            }
          } else {
            setUser(null);
            setProfile(null);
          }
          if (initDoneRef.current) setLoading(false);
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
        if (initDoneRef.current) setLoading(false);
      }
    });

    // Reconexão quando a aba volta ao foco
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !mountedRef.current) return;

      // Verifica expiração ao voltar ao foco
      if (isSessionExpired()) {
        clearAllSessions();
        await supabase.auth.signOut();
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
        }
        return;
      }

      try {
        // Force an active network refresh to break dormant token locks
        await supabase.auth.refreshSession();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session && mountedRef.current) {
          setUser(null);
          setProfile(null);
        } else if (session?.user && mountedRef.current) {
          setUser(session.user);
          if (!profileFetchingRef.current) {
            await refreshProfile(session.user.id);
          }
        }
      } catch (err) {
        console.error('AuthContext: visibility change error:', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Heartbeat: renova a sessão periodicamente (a cada 5 min) para evitar deadlocks de inatividade
    const heartbeatTimer = setInterval(async () => {
      if (!mountedRef.current) return;
      if (isSessionExpired()) {
        clearAllSessions();
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return;
      }
      try {
        await supabase.auth.refreshSession();
        await supabase.auth.getSession();
      } catch (e) {
        console.warn('AuthContext: heartbeat refresh error:', e);
      }
    }, 5 * 60 * 1000);

    return () => {
      mountedRef.current = false;
      clearTimeout(fallbackTimer);
      clearInterval(heartbeatTimer);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshProfile]);

  const signIn = async (email, password, rememberMe = false) => {
    // Persiste a preferência de "lembrar" ANTES do login
    if (rememberMe) {
      localStorage.setItem(REMEMBER_FLAG, '1');
    } else {
      localStorage.removeItem(REMEMBER_FLAG);
    }

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (!result.error && result.data?.user) {
      // Verifica se o usuário está bloqueado antes de concluir o login
      const { data: prof } = await supabase
        .from('profiles')
        .select('blocked')
        .eq('id', result.data.user.id)
        .single();

      if (prof?.blocked === true) {
        clearAllSessions();
        await supabase.auth.signOut();
        return {
          data: null,
          error: { message: 'Acesso bloqueado pelo administrador. Entre em contato com o suporte.' }
        };
      }

      // Aplica expiração baseada em "lembrar usuário"
      applySessionExpiry(rememberMe);
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
    clearAllSessions();
    return supabase.auth.signOut();
  };

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin, refreshProfile }}>
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
