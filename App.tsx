import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { TournamentsProvider } from './src/context/TournamentsContext';
import { SocialProvider } from './src/context/SocialContext';
import { ToastProvider } from './src/context/ToastContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import AppToast from './src/components/AppToast';

function AppContent() {
  const { theme } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
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
          <SocialProvider>
            <TournamentsProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </TournamentsProvider>
          </SocialProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
