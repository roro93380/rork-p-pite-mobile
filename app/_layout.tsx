import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BootSplash from '@/components/BootSplash';
import Colors from '@/constants/colors';
import { PepiteProvider } from '@/providers/PepiteProvider';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { markBootTrace, resetBootTrace } from '@/services/bootPerformance';
import { checkAndApplyOtaUpdate } from '@/services/updateService';

// Suppress console.log in production builds
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.debug = () => {};
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
resetBootTrace();

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const splashHiddenRef = useRef(false);
  const otaCheckStartedRef = useRef(false);

  const hideNativeSplash = useCallback(() => {
    if (splashHiddenRef.current) {
      return;
    }

    splashHiddenRef.current = true;
    markBootTrace('native-splash:hidden');
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    markBootTrace('root-layout-nav:mounted');
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      // Not logged in → go to login
      if (!inAuthGroup) {
        router.replace('/login' as any);
      }
    } else {
      // Logged in → go to tabs (onboarding is handled inside the app)
      if (inAuthGroup) {
        router.replace('/(tabs)' as any);
      }
    }
  }, [session, loading, router, segments]);

  useEffect(() => {
    if (!loading) {
      markBootTrace(session ? 'auth:ready-with-session' : 'auth:ready-without-session');
      hideNativeSplash();
    }
  }, [hideNativeSplash, loading, session]);

  useEffect(() => {
    if (loading || otaCheckStartedRef.current) {
      return;
    }

    otaCheckStartedRef.current = true;

    checkAndApplyOtaUpdate().catch(() => {});
  }, [loading]);

  if (loading) {
    return <BootSplash onReady={hideNativeSplash} />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Retour',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="merchants"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="browse"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="scan"
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="premium"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="detail/[id]"
        options={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.gold,
          title: '',
        }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PepiteProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="light" />
            <RootLayoutNav />
          </GestureHandlerRootView>
        </PepiteProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
