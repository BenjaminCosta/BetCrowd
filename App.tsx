import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { TournamentsProvider } from './src/context/TournamentsContext';
import { SocialProvider } from './src/context/SocialContext';
import { AppNavigator } from './src/navigation/AppNavigator';

function AppContent() {
  const { theme } = useTheme();
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocialProvider>
          <TournamentsProvider>
            <AppContent />
          </TournamentsProvider>
        </SocialProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
