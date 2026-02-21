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
    console.log('AuthProvider State:', { userId, session: !!session, showCaptcha, isLoading });
  }, [userId, session, showCaptcha, isLoading]);

  useEffect(() => {
    const isFinished = { current: false };

    const timeoutId = setTimeout(() => {
      if (!isFinished.current) {
        console.warn('Auth check timed out, forcing load completion');
        setAuthPhase('TIMED_OUT');
        isFinished.current = true;
        setIsLoading(false);
      }
    }, 5000); // 5 seconds for slow web sessions

    const initAuth = async () => {
      setAuthPhase('GET_SESSION');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isFinished.current) return;

        setAuthPhase('SESSION_RECEIVED');
        if (session?.user?.id) {
          setUserId(session.user.id);
          setSession(session);
          setAuthPhase('AUTHENTICATED');
        } else {
          // If no session, show CAPTCHA before signing in (Initial anonymous load)
          setAuthPhase('REQUIRE_CAPTCHA');
          setShowCaptcha(true);
        }
      } catch (e) {
        console.error('Auth Init Error', e);
        setAuthPhase('ERROR');
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

  const handleCaptchaSuccess = async (token: string) => {
    console.log('Captcha Success, token received. Length:', token.length);

    // 1. Check for pending callbacks (e.g. from Sign In or Sign Up screen)
    if (pendingCaptchaCallback) {
      console.log('Executing pending CAPTCHA callback');
      pendingCaptchaCallback(token);
      setPendingCaptchaCallback(null);
      setShowCaptcha(false);
      return;
    }

    // 2. Default behavior (Initial Anonymous Sign-in)
    // Development Bypass Logic
    if (__DEV__ && (token === 'manual-bypass-token' || token === 'dev-manual-bypass')) {
      console.warn('Handling Manual CAPTCHA Bypass (DEV MODE)');
      try {
        const { data: { session: anonSession }, error } = await supabase.auth.signInAnonymously();

        if (!error && anonSession?.user?.id) {
          setUserId(anonSession.user.id);
          setSession(anonSession);
          setShowCaptcha(false);
          setIsLoading(false);
          return;
        }

        console.warn('Anonymous sign-in without token failed, falling back to mock session for UI testing');
        // Fallback: MOCK session for UI testing if backend enforces CAPTCHA
        setUserId('00000000-0000-0000-0000-000000000000');
        setSession({ user: { id: '00000000-0000-0000-0000-000000000000', is_anonymous: true } } as any);
        setShowCaptcha(false);
        setIsLoading(false);
        return;
      } catch (e) {
        console.error('Bypass error', e);
      }
    }

    try {
      const { data: { session: anonSession }, error } = await supabase.auth.signInAnonymously({
        options: {
          captchaToken: token,
        },
      });

      if (!error && anonSession?.user?.id) {
        setUserId(anonSession.user.id);
        setSession(anonSession);
        setShowCaptcha(false);
        setIsLoading(false);
      } else if (error) {
        console.error('Anonymous Sign-in Error:', error.message);
        setShowCaptcha(false); // Close modal so user can see the error screen
        setIsLoading(false);
      }
    } catch (e) {
      console.error('handleCaptchaSuccess Error', e);
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
          console.warn('Captcha cancelled');
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
