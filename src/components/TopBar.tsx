import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

interface TopBarProps {
  showBackButton?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ showBackButton = false }) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const handleNavigate = (screen: string) => {
    try {
      navigation.navigate(screen);
    } catch (error) {
      console.log('Navigation error:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: theme === 'dark' ? '#2A2A2A' : '#E0E0E0' }]}>
      <View style={styles.content}>
        {showBackButton ? (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoGradient}
            >
              <Ionicons name="flame" size={20} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.logoText, { color: colors.foreground }]}>
              <Text style={{ color: colors.primary }}>BET</Text>
              <Text>CROWD</Text>
            </Text>
          </View>
        )}
        
        <View style={styles.rightIcons}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => handleNavigate('Search')}
          >
            <Ionicons name="search" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => handleNavigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => handleNavigate('Perfil')}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>JG</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoGradient: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    padding: Spacing.sm,
  },
  avatarGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});