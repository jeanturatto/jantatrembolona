import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileFetchingRef = useRef(false);

  const refreshProfile = async (userId) => {
    if (!userId) return;
    profileFetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile({
        name: 'Usuário',
        role: 'USER',
        faltas_nao_justificadas: 0,
        inadimplente: false
      });
    } finally {
      profileFetchingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // Fallback: desbloqueia após 8 segundos se algo falhar
      const fallbackTimer = setTimeout(() => {
        if (mounted) setLoading(false);
      }, 8000);

      try {
        // Verifica se usuário escolheu NÃO ser lembrado
        // 'jantatrembo-no-persist' fica no localStorage setado pelo signIn
        // sessionStorage é limpa ao fechar o browser
        // Se no-persist=true e não há flag de sessão ativa na sessionStorage, 
        // o usuário fechou o browser sem querer ser lembrado → forçar login
        const noPersist = localStorage.getItem('jantatrembo-no-persist') === '1';
        const hasActiveSession = sessionStorage.getItem('jantatrembo-session-active') === '1';
        
        if (noPersist && !hasActiveSession) {
          // Limpa sessão Supabase silenciosamente
          await supabase.auth.signOut({ scope: 'local' });
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        // 1. Tenta obter sessão existente
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('Erro ao obter sessão:', sessionError.message);
          // Limpa a sessão inválida
          await supabase.auth.signOut({ scope: 'local' });
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        if (session) {
          // 2. Verifica se o token está expirado ou prestes a expirar (< 60s)
          const expiresAt = session.expires_at;
          const nowSec = Math.floor(Date.now() / 1000);
          const isExpiredOrSoon = !expiresAt || (expiresAt - nowSec) < 60;

          if (isExpiredOrSoon) {
            // Tenta renovar o token
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) {
              console.warn('Sessão expirada, redirecionando para login');
              if (mounted) {
                setUser(null);
                setProfile(null);
              }
              return;
            }
            // Usa a sessão renovada
            const renewedUser = refreshData.session.user;
            if (mounted) {
              sessionStorage.setItem('jantatrembo-session-active', '1');
              setUser(renewedUser);
              await refreshProfile(renewedUser.id);
            }
          } else {
            // Sessão válida
            const currentUser = session.user;
            if (mounted) {
              sessionStorage.setItem('jantatrembo-session-active', '1');
              setUser(currentUser);
              await refreshProfile(currentUser.id);
            }
          }
        } else {
          // Sem sessão
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('AuthContext: Erro ao inicializar autenticação:', err);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          clearTimeout(fallbackTimer);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const currentUser = session?.user || null;
        setUser(currentUser);
        if (currentUser) {
          // Mantém a sessão ativa enquanto o browser está aberto
          sessionStorage.setItem('jantatrembo-session-active', '1');
          await refreshProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
        return;
      }

      // Para outros eventos, apenas atualiza o estado
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser && !profileFetchingRef.current) {
        await refreshProfile(currentUser.id);
      } else if (!currentUser) {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password, rememberMe = true) => {
    if (!rememberMe) {
      // Usuário NÃO quer ser lembrado: seta flag no localStorage (persiste entre fechamentos)
      localStorage.setItem('jantatrembo-no-persist', '1');
    } else {
      // Quer ser lembrado: remove a flag
      localStorage.removeItem('jantatrembo-no-persist');
    }
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error) {
      // Seta flag de sessão ativa no sessionStorage (limpa ao fechar browser)
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
