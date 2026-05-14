import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initCrash } from '@/lib/crash';
import { track } from '@/lib/analytics';
import { usePingBackend } from '@/features/health/usePingBackend';
import { SplashOverlay } from '@/components/SplashOverlay';

export const unstable_settings = {
  anchor: '(tabs)',
};

const MIN_SPLASH_MS = 1500;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const status = usePingBackend();
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);

  useEffect(() => {
    initCrash();
    track('app_open');
    const t = setTimeout(() => setMinDelayElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const showSplash = !minDelayElapsed || status === 'loading';

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="verify" options={{ headerShown: false }} />
        <Stack.Screen name="select-course" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      {showSplash ? <SplashOverlay status={status} /> : null}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
