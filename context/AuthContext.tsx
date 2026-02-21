import { CaptchaModal } from '@/components/CaptchaModal';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  userId: string | undefined;
  isLoading: boolean;
  authPhase: string;
  session: Session | null;
  showCaptcha: boolean;
  setShowCaptcha: (show: boolean) => void;
  onCaptchaSuccess: (token: string) => Promise<void>;
  requestCaptcha: (callback: (token: string) => void) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | undefined>();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authPhase, setAuthPhase] = useState('INIT');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [pendingCaptchaCallback, setPendingCaptchaCallback] = useState<((token: string) => void) | null>(null);

  useEffect(() => {
    // Debugging exposure for web console
    if (typeof window !== 'undefined') {
      (window as any).__AUTH_STATE__ = { userId, session: !!session, authPhase, isLoading };
    }
  }, [userId, session, authPhase, isLoading]);

  useEffect(() => {
    console.log('[DEBUG] AuthProvider Signal Received');
    setAuthPhase('STARTING');

    const isFinished = { current: false };

    // Failsafe timeout
    const timeoutId = setTimeout(() => {
      if (!isFinished.current) {
        console.warn('Auth system timed out - proceeding to UI');
        setAuthPhase('FORCED_TIMEOUT');
        isFinished.current = true;
        setIsLoading(false);
      }
    }, 4000);

    const initAuth = async () => {
      try {
        setAuthPhase('CHECKING_SESSION');
        const { data, error } = await supabase.auth.getSession();

        if (isFinished.current) return;

        if (error) {
          console.error('Session check error', error);
          setAuthPhase('SESSION_ERROR');
        }

        const sessionData = data?.session;

        if (sessionData?.user?.id) {
          console.log('Valid session found for user:', sessionData.user.id);
          setUserId(sessionData.user.id);
          setSession(sessionData);
          setAuthPhase('COMPLETED');
        } else {
          console.log('No valid session - showing verification');
          setAuthPhase('AWAITING_VERIFICATION');
          setShowCaptcha(true);
        }
      } catch (e) {
        console.error('Critical Auth Init Error:', e);
        setAuthPhase('CRITICAL_ERROR');
      } finally {
        if (!isFinished.current) {
          isFinished.current = true;
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('AUTH_EVENT:', event);
      setUserId(newSession?.user?.id);
      setSession(newSession);
      if (newSession?.user?.id) {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleCaptchaSuccess = async (token: string) => {
    console.log('Verification Success');

    if (pendingCaptchaCallback) {
      pendingCaptchaCallback(token);
      setPendingCaptchaCallback(null);
      setShowCaptcha(false);
      return;
    }

    try {
      const { data: { session: anonSession }, error } = await supabase.auth.signInAnonymously({
        options: { captchaToken: token },
      });

      if (!error && anonSession?.user?.id) {
        setUserId(anonSession.user.id);
        setSession(anonSession);
        setShowCaptcha(false);
        setIsLoading(false);
      } else if (error) {
        console.error('Sign-in Error:', error.message);
        setShowCaptcha(false);
        setIsLoading(false);
      }
    } catch (e) {
      console.error('Verification Handler Error', e);
      setShowCaptcha(false);
      setIsLoading(false);
    }
  };

  const requestCaptcha = (callback: (token: string) => void) => {
    setPendingCaptchaCallback(() => callback);
    setShowCaptcha(true);
  };

  return (
    <AuthContext.Provider value={{
      userId,
      isLoading,
      authPhase,
      session,
      showCaptcha,
      setShowCaptcha,
      onCaptchaSuccess: handleCaptchaSuccess,
      requestCaptcha
    }}>
      {children}
      <CaptchaModal
        visible={showCaptcha}
        onSuccess={handleCaptchaSuccess}
        onCancel={() => {
          setShowCaptcha(false);
          setPendingCaptchaCallback(null);
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
