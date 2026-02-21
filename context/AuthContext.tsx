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
  const [authPhase, setAuthPhase] = useState('SYNC');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [pendingCaptchaCallback, setPendingCaptchaCallback] = useState<((token: string) => void) | null>(null);

  useEffect(() => {
    let isFinished = false;

    // Emergency Failsafe
    const timeoutId = setTimeout(() => {
      if (!isFinished) {
        setAuthPhase('TIMEOUT_RECOVERY');
        setIsLoading(false);
        isFinished = true;
      }
    }, 5000);

    const initAuth = async () => {
      try {
        setAuthPhase('CONNECTING');
        const { data, error } = await supabase.auth.getSession();

        if (isFinished) return;

        if (error) {
          console.error('Session Error:', error);
          setAuthPhase('ERROR');
        }

        const sessionData = data?.session;

        if (sessionData?.user?.id) {
          setUserId(sessionData.user.id);
          setSession(sessionData);
          setAuthPhase('READY');
        } else {
          setAuthPhase('AUTHENTICATING');
          setShowCaptcha(true);
        }
      } catch (e) {
        console.error('Auth Hub Error:', e);
        setAuthPhase('FATAL');
      } finally {
        if (!isFinished) {
          setIsLoading(false);
          isFinished = true;
          clearTimeout(timeoutId);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setUserId(newSession?.user?.id);
      setSession(newSession);
      if (newSession?.user?.id) {
        setIsLoading(false);
        isFinished = true;
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleCaptchaSuccess = async (token: string) => {
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
      } else {
        setShowCaptcha(false);
        setIsLoading(false);
      }
    } catch (e) {
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
