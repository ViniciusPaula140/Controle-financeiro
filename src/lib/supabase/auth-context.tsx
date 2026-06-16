import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, phone?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] Inicializando AuthProvider');
    
    // Timeout de segurança para garantir que loading nunca fique travado
    const timeoutId = setTimeout(() => {
      console.warn('[AuthContext] Timeout de segurança atingido - forçando loading = false');
      setLoading(false);
    }, 5000); // 5 segundos de timeout
    
    // Check if supabase is configured
    if (!supabase) {
      console.error('[AuthContext] Supabase client is not configured. Please check your environment variables.');
      setLoading(false);
      clearTimeout(timeoutId);
      return;
    }

    // Get initial session
    console.log('[AuthContext] Buscando sessão inicial...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Sessão obtida:', session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(timeoutId);
      console.log('[AuthContext] Loading definido como false após getSession');
    }).catch((error) => {
      console.error('[AuthContext] Error getting session:', error);
      setLoading(false);
      clearTimeout(timeoutId);
      console.log('[AuthContext] Loading definido como false após erro');
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event, session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(timeoutId);
      console.log('[AuthContext] Loading definido como false após onAuthStateChange');
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const signUp = async (email: string, password: string, phone?: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase client is not configured' } as AuthError };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase client is not configured' } as AuthError };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
