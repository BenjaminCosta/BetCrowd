import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TournamentsProvider } from './src/context/TournamentsContext';
import { FriendsProvider } from './src/context/FriendsContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { InvitesProvider } from './src/context/InvitesContext';
import { ToastProvider } from './src/context/ToastContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import AppToast from './src/components/AppToast';
import OnboardingScreen from './src/screens/OnboardingScreen';
import {
  clearPendingTournamentInvite,
  getPendingTournamentInvite,
  parseTournamentInviteUrl,
  savePendingTournamentInvite,
} from './src/services/deepLinkService';
import { hasSeenOnboarding, markOnboardingAsSeen } from './src/services/onboardingService';
import { Colors } from './src/theme/colors';

const navigationRef = createNavigationContainerRef<any>();

function AppContent() {
  const { theme } = useTheme();
  const { user, loading } = useAuth();
  const [navigationReady, setNavigationReady] = useState(false);
  const routingInviteRef = useRef(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingSeen, setOnboardingSeen] = useState(false);
  const colors = Colors[theme];

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // setBackgroundColorAsync is a no-op with edgeToEdgeEnabled: true on Android 15+.
    // The nav bar color is determined by the content rendered behind the transparent bar.
    // We only set the button style (icon tint) which still works.
    NavigationBar.setButtonStyleAsync(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    hasSeenOnboarding()
      .then((seen) => {
        if (!mounted) return;
        setOnboardingSeen(seen);
      })
      .finally(() => {
        if (mounted) setCheckingOnboarding(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const routePendingInvite = useCallback(async () => {
    if (routingInviteRef.current || loading || !user || !navigationReady || !navigationRef.isReady()) {
      return;
    }

    routingInviteRef.current = true;
    try {
      const pendingInvite = await getPendingTournamentInvite();
      if (!pendingInvite) return;

      await clearPendingTournamentInvite();
      navigationRef.navigate('JoinCode', pendingInvite);
    } finally {
      routingInviteRef.current = false;
    }
  }, [loading, navigationReady, user]);

  useEffect(() => {
    const handleIncomingUrl = async (incomingUrl: string | null | undefined) => {
      const parsedInvite = parseTournamentInviteUrl(incomingUrl);
      if (!parsedInvite) return;

      await savePendingTournamentInvite(parsedInvite);
      await routePendingInvite();
    };

    Linking.getInitialURL()
      .then(handleIncomingUrl)
      .catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url).catch(() => {});
    });

    return () => subscription.remove();
  }, [routePendingInvite]);

  useEffect(() => {
    routePendingInvite().catch(() => {});
  }, [routePendingInvite]);

  const handleFinishOnboarding = useCallback(async () => {
    await markOnboardingAsSeen();
    setOnboardingSeen(true);
  }, []);

  if (checkingOnboarding) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <Image source={require('./assets/icon.png')} style={styles.loadingLogoImage} />
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingSpinner} />
          <Text style={[styles.loadingText, { color: colors.foreground }]}>
            <Text style={{ color: colors.primary }}>BET</Text>CROWD
          </Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!onboardingSeen) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <OnboardingScreen onFinish={handleFinishOnboarding} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => setNavigationReady(true)}
      >
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <AppNavigator />
        <AppToast />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FriendsProvider>
            <NotificationsProvider>
              <InvitesProvider>
                <TournamentsProvider>
                  <ToastProvider>
                    <AppContent />
                  </ToastProvider>
                </TournamentsProvider>
              </InvitesProvider>
            </NotificationsProvider>
          </FriendsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
  loadingLogoImage: {
    width: 105,
    height: 105,
    marginBottom: 16,
  },
  loadingSpinner: {
    marginTop: 16,
  },
  loadingText: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 16,
  },
});
