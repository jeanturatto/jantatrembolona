import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

const REMEMBER_FLAG   = 'jantatrembo-remember';
const SESSION_KEY     = 'jantatrembo-auth';
const EXPIRY_KEY      = 'jantatrembo-session-expiry';

// ─── Storage helpers ─────────────────────────────────────────────────────────
function migrateSessionFromStorage() {
  try {
    if (!localStorage.getItem(SESSION_KEY)) {
      const s = sessionStorage.getItem(SESSION_KEY);
      if (s) localStorage.setItem(SESSION_KEY, s);
    }
  } catch (_) {}
}
migrateSessionFromStorage();

function clearAllSessions() {
  try {
    [SESSION_KEY, REMEMBER_FLAG, EXPIRY_KEY].forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
    try {
      sessionStorage.removeItem(SESSION_KEY);
      Object.keys(sessionStorage).filter(k => k.startsWith('sb-')).forEach(k => sessionStorage.removeItem(k));
    } catch (_) {}
  } catch (_) {}
}

function applySessionExpiry(rememberMe) {
  try {
    if (rememberMe) localStorage.removeItem(EXPIRY_KEY);
    else localStorage.setItem(EXPIRY_KEY, String(Date.now() + 8 * 60 * 60 * 1000));
  } catch (_) {}
}

function isSessionExpired() {
  try {
    const e = localStorage.getItem(EXPIRY_KEY);
    return e ? Date.now() > Number(e) : false;
  } catch (_) { return false; }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  // loading = true só durante a verificação inicial de sessão
  const [loading, setLoading] = useState(true);

  const mountedRef      = useRef(true);
  const initDoneRef     = useRef(false);
  const fetchingRef     = useRef(false);   // guard de fetch paralelo
  const fetchAbortRef   = useRef(null);    // permite cancelar fetch anterior

  // ── Busca profile SEMPRE reseta fetchingRef no finally ────────────────────
  // Não expõe profileLoading para ProtectedRoute — isso evita flashes de loading
  // após eventos de auth (USER_UPDATED, TOKEN_REFRESHED). O estado externo relevante
  // para roteamento é apenas: loading (inicial) + user + profile.
  const fetchProfile = useCallback(async (userId) => {
    if (!userId || !mountedRef.current) return;

    // Cancela fetch anterior se houver um pendente
    if (fetchAbortRef.current) {
      fetchAbortRef.current.cancelled = true;
    }
    const ticket = { cancelled: false };
    fetchAbortRef.current = ticket;

    // Sem profileLoading — fetches silenciosos em background
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Ignora resultado de fetch cancelado
      if (ticket.cancelled || !mountedRef.current) return;

      if (error) {
        console.error('AuthContext: fetchProfile error', error);
        // Mantém profile anterior se já existir (tolerância a erros de rede)
        return;
      }

      // Usuário bloqueado → força logout
      if (data?.blocked === true) {
        console.warn('AuthContext: usuário bloqueado, forçando logout.');
        localStorage.setItem('show_blocked_modal', 'true');
        clearAllSessions();
        await supabase.auth.signOut();
        if (mountedRef.current) { setUser(null); setProfile(null); }
        return;
      }

      if (mountedRef.current) setProfile(data);
    } catch (err) {
      if (ticket.cancelled || !mountedRef.current) return;
      console.error('AuthContext: fetchProfile exception', err);
    } finally {
      if (!ticket.cancelled) fetchingRef.current = false;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Fallback: após 12s, libera loading de qualquer forma (nunca trava)
    const fallback = setTimeout(() => {
      if (mountedRef.current && !initDoneRef.current) {
        console.warn('AuthContext: fallback timeout disparado');
        fetchingRef.current = false;
        setLoading(false);
        initDoneRef.current = true;
      }
    }, 12000);

    // ── Inicialização de sessão ───────────────────────────────────────────
    const initializeAuth = async () => {
      try {
        if (isSessionExpired()) {
          clearAllSessions();
          if (mountedRef.current) { setUser(null); setProfile(null); }
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('AuthContext: getSession error', error);
          if (mountedRef.current) { setUser(null); setProfile(null); }
          return;
        }

        if (session?.user && mountedRef.current) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else if (mountedRef.current) {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('AuthContext: initializeAuth exception', err);
        if (mountedRef.current) { setUser(null); setProfile(null); }
      } finally {
        if (mountedRef.current) {
          clearTimeout(fallback);
          fetchingRef.current = false;
          setLoading(false);
          initDoneRef.current = true;
        }
      }
    };

    initializeAuth();

    // ── onAuthStateChange ─────────────────────────────────────────────────
    // Importante: não usamos await aqui para não bloquear eventos subsequentes.
    // Fazemos fetchProfile sem esperar (fire-and-forget silencioso).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      console.debug('AuthContext event:', event);

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        // Cancela qualquer fetch em andamento
        if (fetchAbortRef.current) fetchAbortRef.current.cancelled = true;
        fetchingRef.current = false;
        clearAllSessions();
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      // Para todos os outros eventos (SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED…)
      // só agimos após a inicialização terminar
      if (!initDoneRef.current) return;

      const currentUser = session?.user ?? null;
      if (!currentUser) return;

      if (mountedRef.current) {
        setUser(currentUser);
        // Fetch silencioso em background — sem profileLoading, sem trava de UI
        fetchProfile(currentUser.id);
      }
    });

    // ── Reconexão ao voltar ao foco ───────────────────────────────────────
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !mountedRef.current) return;
      if (!initDoneRef.current) return;

      if (isSessionExpired()) {
        clearAllSessions();
        supabase.auth.signOut(); // dispara SIGNED_OUT → handler acima limpa tudo
        return;
      }

      // refreshSession dispara TOKEN_REFRESHED → handler acima faz fetchProfile
      supabase.auth.refreshSession().catch(err =>
        console.warn('AuthContext: visibility refreshSession error', err)
      );
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Heartbeat a cada 5 min ────────────────────────────────────────────
    const heartbeat = setInterval(() => {
      if (!mountedRef.current || !initDoneRef.current) return;

      if (isSessionExpired()) {
        clearAllSessions();
        supabase.auth.signOut();
        return;
      }

      // Apenas renova o token — o TOKEN_REFRESHED fará fetchProfile se necessário
      supabase.auth.refreshSession().catch(err =>
        console.warn('AuthContext: heartbeat error', err)
      );
    }, 5 * 60 * 1000);

    return () => {
      mountedRef.current = false;
      if (fetchAbortRef.current) fetchAbortRef.current.cancelled = true;
      clearTimeout(fallback);
      clearInterval(heartbeat);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProfile]);

  // ─── Auth actions ─────────────────────────────────────────────────────────
  const signIn = async (email, password, rememberMe = false) => {
    if (rememberMe) localStorage.setItem(REMEMBER_FLAG, '1');
    else localStorage.removeItem(REMEMBER_FLAG);

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (!result.error && result.data?.user) {
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

      applySessionExpiry(rememberMe);
    }

    return result;
  };

  const signUp = async (email, password, meta) =>
    supabase.auth.signUp({ email, password, options: { data: meta } });

  const signOut = async () => {
    clearAllSessions();
    return supabase.auth.signOut();
  };

  // refreshProfile exposto para componentes que precisam forçar atualização pontual
  const refreshProfile = useCallback((userId) => {
    if (fetchAbortRef.current) fetchAbortRef.current.cancelled = true;
    fetchingRef.current = false;
    return fetchProfile(userId);
  }, [fetchProfile]);

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      // profileLoading removido intencionalmente — fetches são silenciosos
      signIn, signUp, signOut,
      isAdmin,
      refreshProfile,
      forceRefreshProfile: refreshProfile, // alias para compatibilidade
    }}>
      {loading ? (
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center justify-center gap-3">
          <div className="animate-spin h-8 w-8 border-4 border-zinc-900 border-t-transparent rounded-full dark:border-white dark:border-t-transparent" />
          <p className="text-xs text-zinc-400 font-medium">Verificando sessão...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
