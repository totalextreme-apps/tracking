import { asyncStoragePersister, queryClient } from '@/lib/query-client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";



import '../global.css';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import 'react-native-reanimated';

import { DesktopBlocker } from '@/components/DesktopBlocker';
import { OnboardingModal } from '@/components/OnboardingModal';
import { StaticOverlay } from '@/components/StaticOverlay';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { SoundProvider } from '@/context/SoundContext';
import { ThriftModeProvider } from '@/context/ThriftModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent splash screen from hiding early
SplashScreen.preventAutoHideAsync().catch(() => { });

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    // Failsafe: hide splash screen even if fonts hang (common on Safari iOS)
    const failsafe = setTimeout(() => {
      console.warn('Splash screen hide failsafe triggered');
      SplashScreen.hideAsync().catch(() => { });
    }, 7000);

    if (loaded || error) {
      clearTimeout(failsafe);
      SplashScreen.hideAsync().catch(() => { });
    }
    return () => clearTimeout(failsafe);
  }, [loaded, error]);

  return (
    <SettingsProvider>
      <SoundProvider>
        <AuthProvider>
          <ThriftModeProvider>
            <RootLayoutNav fontsLoaded={loaded} />
          </ThriftModeProvider>
        </AuthProvider>
      </SoundProvider>
    </SettingsProvider>
  );
}

function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [showStatic, setShowStatic] = useState(false);
  const { staticEnabled, onboardingKey } = useSettings();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    checkWarningDismissed();
    const checkViewport = () => {
      if (Platform.OS !== 'web') return;
      const { width } = Dimensions.get('window');
      const ua = navigator.userAgent;
      const isMobileUA = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsDesktop(!isMobileUA && !isIPad && width > 900);
    };

    checkViewport();
    const subscription = Dimensions.addEventListener('change', checkViewport);
    return () => subscription.remove();
  }, []);

  const checkWarningDismissed = async () => {
    if (Platform.OS !== 'web') return;
    try {
      const dismissed = await AsyncStorage.getItem('has_dismissed_desktop_warning');
      if (dismissed === 'true') {
        setDismissedWarning(true);
      }
    } catch (e) {
      console.error('Failed to check warning dismissal status', e);
    }
  };

  const handleDismissWarning = async () => {
    try {
      await AsyncStorage.setItem('has_dismissed_desktop_warning', 'true');
      setDismissedWarning(true);
    } catch (e) {
      console.error('Failed to save warning dismissal status', e);
    }
  };

  useEffect(() => {
    if (staticEnabled) {
      setShowStatic(true);
      const timer = setTimeout(() => setShowStatic(false), 400);
      return () => clearTimeout(timer);
    }
    setShowStatic(false);
  }, [pathname, staticEnabled]);

  // Handle Desktop Warning on Web - Only show after mount to avoid hydration mismatch
  if (Platform.OS === 'web' && isMounted && isDesktop && !dismissedWarning) {
    return <DesktopBlocker onDismiss={handleDismissWarning} />;
  }

  // Final rendering shell - No fontsLoaded guard here to allow static rendering
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* We use a black background for the root container */}
          <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
            {Platform.OS === 'web' && (
              <Head>
                <title>Tracking - Your Personal Retro Video Store</title>
                <meta name="description" content="Catalog your physical and digital collection, hunt for grails, and organize your stacks with the tactile feel of the VHS era." />
                <meta property="og:title" content="Tracking - Movie & Physical Media Collector" />
                <meta property="og:description" content="The ultimate tool for physical media collectors. VHS, 4K, Blu-ray, and more." />
                <meta property="og:image" content="https://mediatracking.app/logo_tracking.png" />
                <meta property="og:url" content="https://mediatracking.app" />
                <meta name="twitter:card" content="summary_large_image" />
                <link rel="canonical" href="https://mediatracking.app" />
              </Head>
            )}
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              <Stack.Screen name="movie/[id]" options={{ presentation: 'modal', headerShown: false }} />
            </Stack>
            <StaticOverlay visible={showStatic} />
            {!isDesktop && <OnboardingModal key={onboardingKey} />}
            {Platform.OS === 'web' && (
              <>
                <Analytics />
                <SpeedInsights />
              </>
            )}
          </View>


        </ThemeProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
