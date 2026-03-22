import React, { useState, useEffect } from 'react';
import { SheetModal } from './SheetModal';
import SearchPanel from './forms/SearchPanel';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { getUserProfile } from '../services/userService';
import UserAvatar from './UserAvatar';

interface TopBarProps {
  showBackButton?: boolean;
}

export const TopBar: React.FC<TopBarProps> = React.memo(({ showBackButton = false }) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const paddingTop = Platform.OS === 'android' ? insets.top : Math.max(insets.top, 44);
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [fullName, setFullName] = useState<string>('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setFullName(profile.fullName || profile.displayName || '');
      }
    } catch (error) {
      console.error('Error loading profile in TopBar:', error);
    }
  };

  const handleNavigate = (screen: string) => {
    // navigate() is used intentionally (not reset()) to preserve tab-internal
    // history and avoid remounting the entire navigator on tab switches.
    try {
      if (screen === 'Inicio') {
        navigation.navigate('Main', { screen: 'Inicio' } as any);
      } else if (screen === 'Perfil') {
        navigation.navigate('Main', { screen: 'Perfil' } as any);
      } else {
        navigation.navigate(screen);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <>
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: theme === 'dark' ? '#2A2A2A' : '#E0E0E0', paddingTop }]}>
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
            onPress={() => setShowSearch(true)}
          >
            <Ionicons name="search" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => handleNavigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => handleNavigate('Perfil')}
          >
            <UserAvatar
              uid={user?.uid ?? ''}
              name={fullName || user?.email || ''}
              size={30}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>

      {/* Search sheet */}
      <SheetModal visible={showSearch} onClose={() => setShowSearch(false)}>
        <SearchPanel onClose={() => setShowSearch(false)} />
      </SheetModal>
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: 2,
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
  notificationButton: {
    padding: Spacing.sm,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
});