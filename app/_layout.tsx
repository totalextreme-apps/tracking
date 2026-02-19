import { asyncStoragePersister, queryClient } from '@/lib/query-client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import '../global.css';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { OnboardingModal } from '@/components/OnboardingModal';
import { StaticOverlay } from '@/components/StaticOverlay';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { SoundProvider } from '@/context/SoundContext';
import { ThriftModeProvider } from '@/context/ThriftModeContext';
import { usePathname } from 'expo-router';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

import { DesktopBlocker } from '@/components/DesktopBlocker';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const { width } = useWindowDimensions();
  const [isDesktop, setIsDesktop] = useState(() => {
    if (Platform.OS !== 'web') return false;
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    const isMobileUA = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // If it's a mobile UA or a touch device, it's definitely not a desktop blocker target
    if (isMobileUA || isTouch) return false;

    // Otherwise, if it's a wide screen, it's desktop
    return window.innerWidth > 900;
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const ua = navigator.userAgent;
      const isMobileUA = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const { width: windowWidth } = Dimensions.get('window');

      if (isMobileUA || isTouch) {
        setIsDesktop(false);
      } else {
        setIsDesktop(windowWidth > 900);
      }
    }
  }, [width]);

  if (!loaded) {
    return null;
  }

  if (isDesktop) {
    return <DesktopBlocker />;
  }

  return (
    <SettingsProvider>
      <RootLayoutNav />
    </SettingsProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [showStatic, setShowStatic] = useState(false);
  const { staticEnabled, onboardingKey } = useSettings();

  useEffect(() => {
    // Trigger static on route change IF enabled
    if (staticEnabled) {
      setShowStatic(true);
      const timer = setTimeout(() => {
        setShowStatic(false);
      }, 400); // 400ms static burst
      return () => clearTimeout(timer);
    } else {
      // Force it off if static is disabled (handles toggle during effect)
      setShowStatic(false);
    }
  }, [pathname, staticEnabled]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <SoundProvider>
        <AuthProvider>
          <ThriftModeProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
                  <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="movie/[id]" options={{ presentation: 'modal', headerShown: false }} />
                </Stack>
                <StaticOverlay visible={showStatic} />
                <OnboardingModal key={onboardingKey} />
              </ThemeProvider>
            </GestureHandlerRootView>
          </ThriftModeProvider>
        </AuthProvider>
      </SoundProvider>
    </PersistQueryClientProvider>
  );
}

