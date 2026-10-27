import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default from environment variables
const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let customUrl = localStorage.getItem('finanflow_supabase_url') || envUrl;
let customKey = localStorage.getItem('finanflow_supabase_anon_key') || envKey;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseCredentials() {
  return {
    url: customUrl,
    anonKey: customKey,
    isConfigured: Boolean(customUrl && customKey && !customUrl.includes('your-project')),
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  customUrl = url.trim();
  customKey = anonKey.trim();
  if (customUrl) {
    localStorage.setItem('finanflow_supabase_url', customUrl);
  } else {
    localStorage.removeItem('finanflow_supabase_url');
  }
  if (customKey) {
    localStorage.setItem('finanflow_supabase_anon_key', customKey);
  } else {
    localStorage.removeItem('finanflow_supabase_anon_key');
  }
  supabaseInstance = null; // force re-instantiation
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return null;

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase não está configurado. Insira a URL e a Anon Key nas configurações.',
    };
  }

  try {
    const { error } = await client.from('categories').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      // If error relates to table not existing yet or auth
      return {
        success: false,
        message: `Conexão atingida, mas ocorreu erro no banco: ${error.message} (Verifique se executou a migração SQL no Supabase).`,
      };
    }
    return {
      success: true,
      message: 'Conexão com o Supabase estabelecida com sucesso!',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Falha ao conectar: ${msg}`,
    };
  }
}
