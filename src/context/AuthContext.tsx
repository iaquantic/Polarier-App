import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut as authSignOut,
  requestPasswordReset as authRequestPasswordReset,
  updatePassword as authUpdatePassword,
} from '@/services/auth';
import { getProfile } from '@/services/chat';

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  authProcessing: boolean;
  setAuthProcessing: (v: boolean) => void;
  isRecovery: boolean;
  setIsRecovery: (v: boolean) => void;
  login: (email: string, password: string) => Promise<{ user: User | null }>;
  loginGoogle: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ session: Session | null }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authProcessing, setAuthProcessing] = useState(
    typeof window !== 'undefined' && window.location.pathname === '/auth/callback'
  );
  const [isRecovery, setIsRecovery] = useState(false);

  const loadProfile = async () => {
    try {
      const p = await getProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      if (newSession?.user) setTimeout(loadProfile, 0);
      else setProfile(null);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      if (initialSession?.user) loadProfile();
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await signInWithEmail(email, password);
    return { user: result.user ?? null };
  };

  const loginGoogle = async () => {
    await signInWithGoogle();
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const result = await signUpWithEmail(email, password, fullName);
    return { session: result.session ?? null };
  };

  const requestPasswordReset = async (email: string) => {
    await authRequestPasswordReset(email);
  };

  const updatePassword = async (password: string) => {
    await authUpdatePassword(password);
  };

  const logout = async () => {
    setIsRecovery(false);
    await authSignOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        authProcessing,
        setAuthProcessing,
        isRecovery,
        setIsRecovery,
        login,
        loginGoogle,
        signUp,
        requestPasswordReset,
        updatePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
