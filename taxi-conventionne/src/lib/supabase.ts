import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Configuration manquante : copiez .env.example en .env.local et renseignez vos clés Supabase.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Extrait un message lisible d'une erreur Supabase / JS. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String(e.message);
  return 'Une erreur est survenue';
}
