import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabaseClient';
import { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  isPremium: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  });

  /* ── fetch profile from Supabase ──────────── */
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }
    return data as Profile;
  }, []);

  /* ── refresh profile (public) ──────────── */
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    const profile = await fetchProfile(state.user.id);
    setState((prev) => ({ ...prev, profile }));
  }, [state.user, fetchProfile]);

  /* ── listen to auth changes ──────────── */
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let profile: Profile | null = null;
      if (session?.user) {
        profile = await fetchProfile(session.user.id);
      }
      setState({
        session,
        user: session?.user ?? null,
        profile,
        loading: false,
      });
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      let profile: Profile | null = null;
      if (session?.user) {
        profile = await fetchProfile(session.user.id);
      }
      setState({
        session,
        user: session?.user ?? null,
        profile,
        loading: false,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  /* ── sign up ──────────── */
  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || '' },
          emailRedirectTo: 'https://app-pepite.web.app/auth/callback',
        },
      });
      if (error) return { error: error.message };

      // Upsert profile row (in case the DB trigger didn't fire)
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName || null,
          subscription_tier: 'free',
          onboarding_completed: false,
        });
      }
      return { error: null };
    },
    []
  );

  /* ── sign in ──────────── */
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  /* ── sign out ──────────── */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      session: null,
      user: null,
      profile: null,
      loading: false,
    });
  }, []);

  /* ── reset password ──────────── */
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app-pepite.web.app/auth/callback',
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  /* ── delete account ──────────── */
  const deleteAccount = useCallback(async () => {
    if (!state.user) return { error: 'Non authentifié' };
    // Delete user data from tables
    await supabase.from('pepites').delete().eq('user_id', state.user.id);
    await supabase.from('scans').delete().eq('user_id', state.user.id);
    await supabase.from('notifications').delete().eq('user_id', state.user.id);
    await supabase.from('profiles').delete().eq('id', state.user.id);
    // Sign out
    await supabase.auth.signOut();
    setState({ session: null, user: null, profile: null, loading: false });
    return { error: null };
  }, [state.user]);

  /* ── update profile ──────────── */
  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!state.user) return { error: 'Non authentifié' };
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', state.user.id);
      if (error) return { error: error.message };

      // Refresh local state
      const profile = await fetchProfile(state.user.id);
      setState((prev) => ({ ...prev, profile }));
      return { error: null };
    },
    [state.user, fetchProfile]
  );

  const isPremium =
    state.profile?.subscription_tier === 'gold' ||
    state.profile?.subscription_tier === 'platinum';

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signUp,
        signIn,
        signOut,
        resetPassword,
        deleteAccount,
        refreshProfile,
        updateProfile,
        isPremium,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
