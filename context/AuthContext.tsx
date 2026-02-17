import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  userId: string | undefined;
  isLoading: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | undefined>();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        setSession(session);
      } else {
        const { data: { session: anonSession }, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Auth Error: Anonymous sign-in failed', error);
        }
        if (!error && anonSession?.user?.id) {
          setUserId(anonSession.user.id);
          setSession(anonSession);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Fallback: Force loading false after 5 seconds if Supabase hangs
    const timeoutId = setTimeout(() => {
      setIsLoading((loading) => {
        if (loading) {
          console.warn('Auth check timed out, forcing load completion');
          return false;
        }
        return loading;
      });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, 'User ID:', session?.user?.id);
      setUserId(session?.user?.id);
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ userId, isLoading, session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
