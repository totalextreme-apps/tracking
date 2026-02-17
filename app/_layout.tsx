import '../global.css';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

const queryClient = new QueryClient();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};



export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
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
  const { staticEnabled } = useSettings();

  useEffect(() => {
    // Trigger static on route change IF enabled
    if (staticEnabled) {
      setShowStatic(true);
      const timer = setTimeout(() => {
        setShowStatic(false);
      }, 400); // 400ms static burst
      return () => clearTimeout(timer);
    }
  }, [pathname, staticEnabled]);

  return (
    <QueryClientProvider client={queryClient}>
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
                <OnboardingModal />
              </ThemeProvider>
            </GestureHandlerRootView>
          </ThriftModeProvider>
        </AuthProvider>
      </SoundProvider>

    </QueryClientProvider >
  );
}

