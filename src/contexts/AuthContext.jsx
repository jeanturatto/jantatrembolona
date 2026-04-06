import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// Chave usada para persistir a sessão no localStorage quando "Lembrar usuário" está marcado
const PERSIST_KEY = 'jantatrembo-auth';
const REMEMBER_FLAG = 'jantatrembo-remember';

/**
 * Copia a sessão do sessionStorage para o localStorage (para "lembrar usuário").
 * O cliente Supabase usa sessionStorage por padrão — aqui propagamos manualmente.
 */
function persistSessionToLocal() {
  try {
    const session = sessionStorage.getItem(PERSIST_KEY);
    if (session) {
      localStorage.setItem(PERSIST_KEY, session);
    }
  } catch (e) {
    console.error('Erro ao persistir sessão:', e);
  }
}

/**
 * Na inicialização, se o usuário tinha "lembrar" marcado, restaura a sessão
 * do localStorage para o sessionStorage (que é o que o cliente Supabase lê).
 */
function restoreSessionFromLocal() {
  try {
    const remembered = localStorage.getItem(REMEMBER_FLAG) === '1';
    if (remembered) {
      const session = localStorage.getItem(PERSIST_KEY);
      if (session) {
        sessionStorage.setItem(PERSIST_KEY, session);
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('Erro ao restaurar sessão:', e);
    return false;
  }
}

/**
 * Remove a sessão de ambos os storages (logout completo).
 */
function clearAllSessions() {
  try {
    sessionStorage.removeItem(PERSIST_KEY);
    localStorage.removeItem(PERSIST_KEY);
    localStorage.removeItem(REMEMBER_FLAG);
    // Limpa chaves legadas do formato sb-*
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('sb-')) sessionStorage.removeItem(key);
    });
  } catch (e) {
    console.error('Erro ao limpar sessão:', e);
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
        // Tenta restaurar sessão do localStorage se o usuário escolheu "lembrar"
        restoreSessionFromLocal();

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
            // Se "lembrar" está ativo, sincroniza a sessão atualizada no localStorage
            if (localStorage.getItem(REMEMBER_FLAG) === '1') {
              persistSessionToLocal();
            }
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

      try {
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

    return () => {
      mountedRef.current = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshProfile]);

  const signIn = async (email, password, rememberMe = false) => {
    // Limpa qualquer sessão anterior primeiro
    clearAllSessions();

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (!result.error) {
      if (rememberMe) {
        // Marca que o usuário quer ser lembrado e persiste a sessão no localStorage
        localStorage.setItem(REMEMBER_FLAG, '1');
        persistSessionToLocal();
      } else {
        // Garante que não há flag de "lembrar"
        localStorage.removeItem(REMEMBER_FLAG);
      }
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
