import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { ApiError } from '@/api/client';
import { SessionProvider, useSession } from '@/providers/session-provider';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// ponytail: expo-router 57.0.24 bug. Its linking code sets state before its own NavigationContainer mounts.
// Dev-only and harmless. Remove once an expo-router update stops the warning.
LogBox.ignoreLogs(["Can't perform a React state update on a component that hasn't mounted yet"]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry client errors (401/403/404/422); retry network/5xx once.
      retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
  },
});

function RootNavigator() {
  const { isLoading, token, activeShop } = useSession();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '600', color: colors.text },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!!token && !!activeShop}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="voice" options={{ title: 'Voice entry' }} />
        <Stack.Screen name="brief" options={{ title: 'Daily brief' }} />
        <Stack.Screen name="offline" options={{ title: 'Offline recordings' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="shops" options={{ title: 'Select shop' }} />
        <Stack.Screen name="create-shop" options={{ title: 'New shop', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SessionProvider>
    </QueryClientProvider>
  );
}
