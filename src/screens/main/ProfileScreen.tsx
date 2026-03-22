import React, { useState, useEffect } from 'react';
import {
  Alert,
  Linking,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import UserAvatar from '../../components/UserAvatar';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import { useInvites } from '../../context/InvitesContext';
import { getUserProfile } from '../../services/userService';

const ProfileScreen = ({ navigation }: any) => {
  const { theme, toggleTheme } = useTheme();
  const colors = Colors[theme];
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const { friends, incomingRequests } = useFriends();
  const { pendingInviteCount } = useInvites();
  const [fullName, setFullName] = useState<string>('');

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
      console.error('Error loading profile:', error);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              showToast({ type: 'error', message: 'No se pudo cerrar sesión. Intenta nuevamente.' });
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar />
      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <UserAvatar
            uid={user?.uid ?? ''}
            name={fullName || user?.displayName || user?.email || ''}
            size={80}
            style={{ marginBottom: 16 }}
          />
          
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {fullName || user?.displayName || 'Usuario'}
          </Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>
            {user?.email}
          </Text>

          <TouchableOpacity 
            onPress={() => navigation.navigate('EditProfile')}
            style={[styles.editButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.editButtonText}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>


        {/* Friends Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Social
          </Text>

          <TouchableOpacity
            style={[styles.friendsCard, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate('Friends')}
            activeOpacity={0.7}
          >
            <View style={styles.friendsRow}>
              <View style={styles.friendsLeft}>
                <View style={[styles.friendsIconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="people" size={24} color={colors.primary} />
                </View>
                <View style={styles.friendsInfo}>
                  <Text style={[styles.friendsTitle, { color: colors.foreground }]}>
                    Amigos
                  </Text>
                  <Text style={[styles.friendsSubtitle, { color: colors.mutedForeground }]}>
                    {friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}
                  </Text>
                </View>
              </View>
              <View style={styles.friendsRight}>
                {incomingRequests.length > 0 && (
                  <View style={[styles.requestsBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.requestsBadgeText}>
                      {incomingRequests.length}
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Invitaciones */}
          <TouchableOpacity
            style={[styles.friendsCard, { backgroundColor: colors.card, marginTop: 10 }]}
            onPress={() => navigation.navigate('Invitations')}
            activeOpacity={0.7}
          >
            <View style={styles.friendsRow}>
              <View style={styles.friendsLeft}>
                <View style={[styles.friendsIconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="trophy" size={24} color={colors.primary} />
                </View>
                <View style={styles.friendsInfo}>
                  <Text style={[styles.friendsTitle, { color: colors.foreground }]}>
                    Invitaciones
                  </Text>
                  <Text style={[styles.friendsSubtitle, { color: colors.mutedForeground }]}>
                    Torneos
                  </Text>
                </View>
              </View>
              <View style={styles.friendsRight}>
                {pendingInviteCount > 0 && (
                  <View style={[styles.requestsBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.requestsBadgeText}>{pendingInviteCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Configuración
          </Text>

          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="moon" size={20} color={colors.foreground} />
                <Text style={[styles.settingText, { color: colors.foreground }]}>
                  Modo Oscuro
                </Text>
              </View>
              <Switch
                value={theme === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: '#999999', true: colors.primary }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#999999"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => navigation.navigate('Notifications')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="notifications" size={20} color={colors.foreground} />
                <Text style={[styles.settingText, { color: colors.foreground }]}>
                  Notificaciones
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                Linking.openURL('https://betcrowd.vercel.app/privacy').catch(() => {
                  Alert.alert('Error', 'No se pudo abrir la página de privacidad.');
                });
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="lock-closed" size={20} color={colors.foreground} />
                <Text style={[styles.settingText, { color: colors.foreground }]}>
                  Privacidad
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => navigation.navigate('HelpSupport')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="help-circle" size={20} color={colors.foreground} />
                <Text style={[styles.settingText, { color: colors.foreground }]}>
                  Ayuda y Soporte
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleSignOut}
        >
          <Text style={[styles.logoutText, { color: colors.destructive }]}>
            Cerrar Sesión
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 16,
  },
  editButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  friendsCard: {
    borderRadius: 16,
    padding: 16,
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  friendsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsInfo: {
    gap: 2,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendsSubtitle: {
    fontSize: 13,
  },
  friendsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestsBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  requestsBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsCard: {
    borderRadius: 16,
    padding: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  logoutButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
