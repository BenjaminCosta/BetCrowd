import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

// Screens — auth
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
// Screens — main (bottom tabs)
import HomeScreen from '../screens/main/HomeScreen';
import TorneosScreen from '../screens/main/TorneosScreen';
import TournamentPredictionsScreen from '../screens/main/TournamentPredictionsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
// Screens — edit
import EditProfileScreen from '../screens/edit/EditProfileScreen';
import TournamentSettingsScreen from '../screens/edit/TournamentSettingsScreen';
// Screens — tournament
import TournamentScreen from '../screens/tournament/TournamentScreen';
// Screens — other
import PrivacyScreen from '../screens/PrivacyScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import JoinCodeScreen from '../screens/JoinCodeScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import SearchScreen from '../screens/SearchScreen';
import BetsListScreen from '../screens/unused/BetsListScreen';
import FriendsScreen from '../screens/FriendsScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import InvitationsScreen from '../screens/InvitationsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainTabs = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Inicio') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Torneos') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Apuestas') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Torneos" component={TorneosScreen} />
      <Tab.Screen name="Apuestas" component={TournamentPredictionsScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
};

const AppStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Tournament" component={TournamentScreen} />
      <Stack.Screen name="TournamentSettings" component={TournamentSettingsScreen} />
      <Stack.Screen name="BetsList" component={BetsListScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="Notifications" component={NotificationCenterScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
      <Stack.Screen name="Invitations" component={InvitationsScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="JoinCode" component={JoinCodeScreen} />
      <Stack.Screen name="NotFound" component={NotFoundScreen} />
    </Stack.Navigator>
  );
};

const LoadingScreen = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <Image source={require('../../assets/icon.png')} style={styles.loadingLogoImage} />
      <ActivityIndicator size="large" color={colors.primary} style={styles.loadingSpinner} />
      <Text style={[styles.loadingText, { color: colors.foreground }]}>
        <Text style={{ color: colors.primary }}>BET</Text>CROWD
      </Text>
    </View>
  );
};

export const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return user ? <AppStack /> : <AuthStack />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
