import { supabase } from '@/lib/supabaseClient';
import { Capacitor } from '@capacitor/core';

/**
 * URL de redirect tras verificar email, recuperar contraseña o entrar con Google.
 * Debe estar registrada en Supabase → Authentication → URL Configuration → Redirect URLs.
 */
const getAuthRedirectUrl = () => {
  if (Capacitor.isNativePlatform()) return 'polarier://auth/callback';
  return `${window.location.origin}/auth/callback`;
};

export const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: fullName ? { full_name: fullName } : undefined,
    },
  });
  if (error) throw error;
  return data;
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

/**
 * Login/alta con Google: si la cuenta no existe, Supabase la crea (el trigger
 * handle_new_user copia a profiles el full_name que da Google). En Android la
 * WebView abre el navegador del sistema (Google no deja hacer OAuth dentro de una
 * WebView) y vuelve por el deep link polarier://auth/callback, que canjea main.tsx.
 */
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const requestPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
  if (error) throw error;
};

export const updatePassword = async (password: string) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
};

export const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};
