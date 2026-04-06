import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const initDoneRef = useRef(false);

  const refreshProfile = useCallback(async (userId) => {
    if (!userId || !mountedRef.current) return;
    if (profileFetchingRef.current) return; // evita fetches paralelos
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

    // Fallback de segurança: se nada resolver em 10s, libera o loading
    const fallbackTimer = setTimeout(() => {
      if (mountedRef.current && !initDoneRef.current) {
        console.warn('AuthContext: fallback timer triggered');
        setLoading(false);
        initDoneRef.current = true;
      }
    }, 10000);

    const initializeAuth = async () => {
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
            sessionStorage.setItem('jantatrembo-session-active', '1');
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
            // Só recarrega o perfil se não estiver fazendo fetch
            if (!profileFetchingRef.current) {
              await refreshProfile(currentUser.id);
            }
          } else {
            setUser(null);
            setProfile(null);
          }
          // Só define loading=false após inicialização completa
          if (initDoneRef.current) {
            setLoading(false);
          }
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
        if (initDoneRef.current) {
          setLoading(false);
        }
      }
    });

    // ─── RECONEXÃO QUANDO A ABA VOLTA AO FOCO ────────────────────────────────
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !mountedRef.current) return;

      try {
        // Tenta renovar sessão silenciosamente quando volta ao foco
        const { data: { session } } = await supabase.auth.getSession();

        if (!session && mountedRef.current) {
          // Sessão expirou enquanto estava fora — força logout
          setUser(null);
          setProfile(null);
        } else if (session?.user && mountedRef.current) {
          const currentUser = session.user;
          setUser(currentUser);
          // Reload silencioso do perfil para garantir dados frescos
          if (!profileFetchingRef.current) {
            await refreshProfile(currentUser.id);
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
