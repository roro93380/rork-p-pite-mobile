import { supabase } from '@/services/supabaseClient';

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  // Handle Supabase auth callback deep links (pepite://...#access_token=...)
  if (path.includes('access_token') || path.includes('refresh_token')) {
    try {
      const hashPart = path.includes('#') ? path.split('#')[1] : path.split('?')[1];
      if (hashPart) {
        const params = new URLSearchParams(hashPart);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    } catch (e) {
      console.warn('[native-intent] Failed to parse auth tokens:', e);
    }
  }
  return '/';
}
