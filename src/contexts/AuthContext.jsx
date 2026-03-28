import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async (userId) => {
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
      // Fallback per role
      setProfile({
        name: user?.email?.split('@')[0] || 'Usuário',
        email: user?.email,
        role: 'USER',
        faltas_nao_justificadas: 0,
        inadimplente: false
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // Garantia extrema: se tudo falhar, destrava em 5s
      const fallbackTimer = setTimeout(() => {
        if (mounted) setLoading(false);
      }, 5000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        const currentUser = session?.user || null;
        if (mounted) setUser(currentUser);
        
        if (currentUser && mounted) {
          await refreshProfile(currentUser.id);
        } else if (mounted) {
          setProfile(null);
        }
      } catch (err) {
        console.error("AuthContext: Erro ao obter getSession", err);
      } finally {
        if (mounted) {
          clearTimeout(fallbackTimer);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      const currentUser = session?.user || null;
      setUser(currentUser);
      
      if (currentUser) {
        await refreshProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, meta) => {
    return supabase.auth.signUp({
      email,
      password,
      options: { data: meta }
    });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin, refreshProfile }}>
      {loading ? (
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-zinc-900 border-t-transparent rounded-full dark:border-white dark:border-t-transparent"></div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
