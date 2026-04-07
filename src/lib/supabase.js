import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// IMPORTANTE: Usamos localStorage (não sessionStorage) para que o token de sessão
// persista corretamente entre abas e sobreviva a períodos de inatividade.
// O sessionStorage era apagado após ~2 min de inatividade em alguns browsers/SO,
// causando perda de conexão com o banco. O controle de "lembrar usuário" é feito
// via lógica de expiração no AuthContext, não mudando o storage aqui.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'jantatrembo-auth',
    storage: window.localStorage,
  },
  db: {
    schema: 'public',
  },
  realtime: {
    timeout: 30000,
  },
});
