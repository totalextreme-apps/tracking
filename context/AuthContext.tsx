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
  });

  // Fallback: Force loading false after 3 seconds (reduced from 5)
  // We use a ref to track if we've already finished to avoid race conditions
  const isFinished = { current: false };

  const timeoutId = setTimeout(() => {
    if (!isFinished.current) {
      console.warn('Auth check timed out, forcing load completion');
      isFinished.current = true;
      setIsLoading(false);
    }
  }, 3000);

  const initAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (isFinished.current) return; // Don't update if timed out

      if (session?.user?.id) {
        setUserId(session.user.id);
        setSession(session);
      } else {
        // ... anonymous logic
        const { data: { session: anonSession }, error } = await supabase.auth.signInAnonymously();
        if (isFinished.current) return;

        if (!error && anonSession?.user?.id) {
          setUserId(anonSession.user.id);
          setSession(anonSession);
        }
      }
    } catch (e) {
      console.error('Auth Init Error', e);
    } finally {
      if (!isFinished.current) {
        isFinished.current = true;
        setIsLoading(false);
        clearTimeout(timeoutId);
      }
    }
  };

  initAuth();

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
