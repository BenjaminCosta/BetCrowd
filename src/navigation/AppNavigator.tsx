import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

// Screens
import HomeScreen from '../screens/HomeScreen';
import EventsScreen from '../screens/EventsScreen';
import CreateTournamentScreen from '../screens/CreateTournamentScreen';
import TournamentPredictionsScreen from '../screens/TournamentPredictionsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import TournamentDetailsScreen from '../screens/TournamentDetailsScreen';
import TournamentEventsScreen from '../screens/TournamentEventsScreen';
import TournamentSettingsScreen from '../screens/TournamentSettingsScreen';
import JoinCodeScreen from '../screens/JoinCodeScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import SearchScreen from '../screens/SearchScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import EventDetailsScreen from '../screens/EventDetailsScreen';
import BetsListScreen from '../screens/BetsListScreen';
import CreateBetScreen from '../screens/CreateBetScreen';
import BetDetailsScreen from '../screens/BetDetailsScreen';
import LoadResultsScreen from '../screens/LoadResultsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';

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
          } else if (route.name === 'Eventos') {
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
      <Tab.Screen name="Eventos" component={EventsScreen} />
      <Tab.Screen
        name="Crear"
        component={CreateTournamentScreen}
        options={{
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <View style={styles.createButtonContainer}>
              <TouchableOpacity
                onPress={() => {
                  if (props.onPress) {
                    props.onPress({
                      nativeEvent: {},
                      currentTarget: {},
                      target: {},
                      preventDefault: () => {},
                      stopPropagation: () => {},
                    } as any);
                  }
                }}
              >
                <LinearGradient
                  colors={Gradients.primary as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createButtonGradient}
                >
                  <Ionicons name="add" size={32} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
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
      <Stack.Screen name="TournamentDetails" component={TournamentDetailsScreen} />
      <Stack.Screen name="TournamentSettings" component={TournamentSettingsScreen} />
      <Stack.Screen name="TournamentEvents" component={TournamentEventsScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="BetsList" component={BetsListScreen} />
      <Stack.Screen name="CreateBet" component={CreateBetScreen} />
      <Stack.Screen name="BetDetails" component={BetDetailsScreen} />
      <Stack.Screen name="LoadResults" component={LoadResultsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="Notifications" component={NotificationCenterScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
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
  createButtonContainer: {
    top: -5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
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
