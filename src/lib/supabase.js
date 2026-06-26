import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options) => {
      try {
        const res = await fetch(url, options);
        return res;
      } catch (err) {
        const errMsg = String(err.message || err).toLowerCase();
        if (errMsg.includes('fetch failed') || errMsg.includes('network') || errMsg.includes('failed to fetch')) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('supabase-network-error'));
          }
        }
        throw err;
      }
    }
  }
});
