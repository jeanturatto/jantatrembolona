import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'jantatrembo-auth',
    storage: window.localStorage,
  },
  global: {
    fetch: (...args) => {
      // Garante que requisições não ficam presas indefinidamente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      return fetch(args[0], { ...args[1], signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    timeout: 30000,
  },
});
