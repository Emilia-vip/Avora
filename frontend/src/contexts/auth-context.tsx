import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { functionErrorMessage } from '@/lib/function-error';
import { supabase } from '@/lib/supabase';
import { clearWardrobeCache } from '@/lib/wardrobe-cache';

type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: Session['user'] | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    styleDna: string[],
    gender: string,
  ) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateStyleDna: (styleDna: string[]) => Promise<void>;
  updateGender: (gender: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    styleDna: string[],
    gender: string,
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
          style_dna: styleDna,
          gender,
        },
      },
    });

    if (error) throw error;
  };

  const updateName = async (name: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });

    if (error) throw error;
  };

  const updateStyleDna = async (styleDna: string[]) => {
    const { error } = await supabase.auth.updateUser({
      data: { style_dna: styleDna },
    });
    if (error) throw error;
  };

  const updateGender = async (gender: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { gender },
    });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  /** Deletes the account, its clothes and photos on the server, then signs out locally. */
  const deleteAccount = async () => {
    const userId = session?.user.id;
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw new Error(await functionErrorMessage(error));
    if (userId) clearWardrobeCache(userId);
    // The user no longer exists, so only the local session needs clearing.
    await supabase.auth.signOut({ scope: 'local' });
  };

  const logout = async () => {
    const userId = session?.user.id;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // The offline wardrobe holds this user's photos; don't leave them for whoever logs in next.
    if (userId) clearWardrobeCache(userId);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!session,
        isLoading,
        user: session?.user ?? null,
        login,
        signup,
        updateName,
        updateStyleDna,
        updateGender,
        resetPassword,
        deleteAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}