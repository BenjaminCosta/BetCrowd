import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/userService';

interface TopBarProps {
  showBackButton?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ showBackButton = false }) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const [photoURL, setPhotoURL] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setPhotoURL(profile.photoURL || '');
        setFullName(profile.fullName || profile.displayName || '');
      }
    } catch (error) {
      console.error('Error loading profile in TopBar:', error);
    }
  };

  const getInitials = () => {
    if (fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

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
          <TouchableOpacity 
            style={styles.logoContainer}
            onPress={() => handleNavigate('Inicio')}
          >
            <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
            <Text style={[styles.logoText, { color: colors.foreground }]}>
              <Text style={{ color: colors.primary }}>BET</Text>
              <Text>CROWD</Text>
            </Text>
          </TouchableOpacity>
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
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={Gradients.primary as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </LinearGradient>
            )}
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
  logoImage: {
    width: 40,
    height: 40,
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
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});