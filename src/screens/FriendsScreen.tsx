import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, EmptyState } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useSocial } from '../context/SocialContext';

type TabType = 'friends' | 'incoming' | 'outgoing';

const FriendsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    friendsLoading,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeFriend,
  } = useSocial();

  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAccept = async (fromUid: string) => {
    try {
      setActionLoading(`accept-${fromUid}`);
      await acceptFriendRequest(fromUid);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo aceptar la solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (fromUid: string) => {
    try {
      setActionLoading(`reject-${fromUid}`);
      await rejectFriendRequest(fromUid);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo rechazar la solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (toUid: string) => {
    try {
      setActionLoading(`cancel-${toUid}`);
      await cancelFriendRequest(toUid);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo cancelar la solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (friendUid: string, username: string) => {
    Alert.alert(
      'Quitar amigo',
      `¿Estás seguro que deseas eliminar a @${username} de tus amigos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(`remove-${friendUid}`);
              await removeFriend(friendUid);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo quitar el amigo');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const renderFriendItem = (friend: any, showRemove: boolean = false) => {
    const profile = friend.profile;
    if (!profile) return null;

    return (
      <Card key={friend.uid} style={styles.friendCard}>
        <View style={styles.friendRow}>
          {/* Avatar */}
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {getInitials(profile.displayName || profile.username)}
              </Text>
            </LinearGradient>
          )}

          {/* Info */}
          <View style={styles.friendInfo}>
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {profile.displayName}
            </Text>
            <Text style={[styles.username, { color: colors.mutedForeground }]}>
              @{profile.username}
            </Text>
          </View>

          {/* Action */}
          {showRemove && (
            <TouchableOpacity
              style={[styles.removeButton, { borderColor: colors.border }]}
              onPress={() => handleRemove(friend.uid, profile.username)}
              disabled={actionLoading === `remove-${friend.uid}`}
            >
              {actionLoading === `remove-${friend.uid}` ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Text style={[styles.removeButtonText, { color: colors.destructive }]}>
                  Quitar
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  const renderIncomingItem = (request: any) => {
    const profile = request.profile;
    if (!profile) return null;

    return (
      <Card key={request.uid} style={styles.friendCard}>
        <View style={styles.friendRow}>
          {/* Avatar */}
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {getInitials(profile.displayName || profile.username)}
              </Text>
            </LinearGradient>
          )}

          {/* Info */}
          <View style={styles.friendInfo}>
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {profile.displayName}
            </Text>
            <Text style={[styles.username, { color: colors.mutedForeground }]}>
              @{profile.username}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.incomingActions}>
            <TouchableOpacity
              style={[styles.rejectButton, { borderColor: colors.border }]}
              onPress={() => handleReject(request.uid)}
              disabled={actionLoading === `reject-${request.uid}`}
            >
              {actionLoading === `reject-${request.uid}` ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Ionicons name="close" size={20} color={colors.foreground} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAccept(request.uid)}
              disabled={actionLoading === `accept-${request.uid}`}
            >
              <LinearGradient
                colors={Gradients.primary as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.acceptButton}
              >
                {actionLoading === `accept-${request.uid}` ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  const renderOutgoingItem = (request: any) => {
    const profile = request.profile;
    if (!profile) return null;

    return (
      <Card key={request.uid} style={styles.friendCard}>
        <View style={styles.friendRow}>
          {/* Avatar */}
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {getInitials(profile.displayName || profile.username)}
              </Text>
            </LinearGradient>
          )}

          {/* Info */}
          <View style={styles.friendInfo}>
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {profile.displayName}
            </Text>
            <Text style={[styles.username, { color: colors.mutedForeground }]}>
              @{profile.username}
            </Text>
          </View>

          {/* Action */}
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={() => handleCancel(request.uid)}
            disabled={actionLoading === `cancel-${request.uid}`}
          >
            {actionLoading === `cancel-${request.uid}` ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.cancelButtonText, { color: colors.mutedForeground }]}>
                Cancelar
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderContent = () => {
    if (friendsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (activeTab === 'friends') {
      if (friends.length === 0) {
        return (
          <EmptyState
            iconName="people-outline"
            title="No tienes amigos aún"
            message="Busca usuarios y envía solicitudes de amistad"
          />
        );
      }
      return friends.map(friend => renderFriendItem(friend, true));
    }

    if (activeTab === 'incoming') {
      if (incomingRequests.length === 0) {
        return (
          <EmptyState
            iconName="mail-outline"
            title="No hay solicitudes"
            message="No tienes solicitudes de amistad pendientes"
          />
        );
      }
      return incomingRequests.map(request => renderIncomingItem(request));
    }

    if (activeTab === 'outgoing') {
      if (outgoingRequests.length === 0) {
        return (
          <EmptyState
            iconName="paper-plane-outline"
            title="No hay solicitudes enviadas"
            message="No has enviado solicitudes de amistad"
          />
        );
      }
      return outgoingRequests.map(request => renderOutgoingItem(request));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Amigos</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'friends' && styles.activeTab,
            activeTab === 'friends' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setActiveTab('friends')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.mutedForeground },
              activeTab === 'friends' && styles.activeTabText,
              activeTab === 'friends' && { color: colors.primary },
            ]}
          >
            Amigos
          </Text>
          {friends.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{friends.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'incoming' && styles.activeTab,
            activeTab === 'incoming' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setActiveTab('incoming')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.mutedForeground },
              activeTab === 'incoming' && styles.activeTabText,
              activeTab === 'incoming' && { color: colors.primary },
            ]}
          >
            Solicitudes
          </Text>
          {incomingRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{incomingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'outgoing' && styles.activeTab,
            activeTab === 'outgoing' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setActiveTab('outgoing')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.mutedForeground },
              activeTab === 'outgoing' && styles.activeTabText,
              activeTab === 'outgoing' && { color: colors.primary },
            ]}
          >
            Enviadas
          </Text>
          {outgoingRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={styles.badgeText}>{outgoingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {renderContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  activeTab: {
    backgroundColor: 'rgba(215, 38, 61, 0.15)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    fontWeight: '700',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  friendCard: {
    padding: Spacing.sm,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
  },
  username: {
    fontSize: 13,
  },
  removeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default FriendsScreen;
