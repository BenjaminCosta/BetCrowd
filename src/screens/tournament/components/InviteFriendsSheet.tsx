import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  TextInput,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToClose, SwipeDragHandle } from '../../../components/SheetModal';
import { Colors, Gradients, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Card } from '../../../components/CommonComponents';
import { useSocial, FriendWithProfile } from '../../../context/SocialContext';
import { sendTournamentInvites } from '../../../services/inviteService';
import { getInitials } from '../../../utils/formatters';

// ─── Props ────────────────────────────────────────────────────────────────────

interface InviteFriendsSheetProps {
  visible: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName: string;
  /** Invite code to display in the header — replaces the old Alert message */
  inviteCode?: string;
  /** When true shows the celebratory post-creation header; false shows a neutral "Invitar amigos" title */
  isPostCreation?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const InviteFriendsSheet: React.FC<InviteFriendsSheetProps> = ({
  visible,
  onClose,
  tournamentId,
  tournamentName,
  inviteCode,
  isPostCreation = false,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { friends, friendsLoading } = useSocial();
  const { onGestureEvent, onHandlerStateChange, animatedContainerStyle, doClose } =
    useSwipeToClose(visible, onClose);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  // Reset state when sheet closes
  React.useEffect(() => {
    if (!visible) {
      setSelected(new Set());
      setSearchQuery('');
      setSending(false);
    }
  }, [visible]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => {
      const profile = f.profile;
      if (!profile) return false;
      return (
        profile.displayName.toLowerCase().includes(q) ||
        profile.username.toLowerCase().includes(q)
      );
    });
  }, [friends, searchQuery]);

  const toggleSelect = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const toNameMap: Record<string, string> = {};
      friends.forEach((f) => {
        if (selected.has(f.uid) && f.profile) {
          toNameMap[f.uid] = f.profile.displayName || f.profile.username;
        }
      });
      const { sent, skipped } = await sendTournamentInvites(
        tournamentId,
        tournamentName,
        Array.from(selected),
        toNameMap,
      );
      doClose();
      if (skipped > 0 && sent === 0) {
        Alert.alert(
          'Sin cambios',
          'Los usuarios seleccionados ya son miembros o ya tienen una invitación pendiente.',
        );
      } else {
        const msg =
          sent === 1
            ? '¡Invitación enviada!'
            : `¡${sent} invitaciones enviadas!`;
        Alert.alert('', msg);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudieron enviar las invitaciones');
    } finally {
      setSending(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderFriendItem = (friend: FriendWithProfile) => {
    const profile = friend.profile;
    if (!profile) return null;
    const isSelected = selected.has(friend.uid);

    return (
      <TouchableOpacity
        key={friend.uid}
        activeOpacity={0.75}
        onPress={() => toggleSelect(friend.uid)}
      >
        <Card style={[styles.friendCard, isSelected && { borderColor: colors.primary, borderWidth: 1 }]}>
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

            {/* Checkbox */}
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={doClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={doClose} />

          <Animated.View
            style={[styles.container, { backgroundColor: colors.background }, animatedContainerStyle]}
          >
            {/* Drag handle */}
            <SwipeDragHandle
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
              color={colors.border}
            />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                {isPostCreation ? (
                  <View style={styles.titleRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success ?? '#22c55e'} />
                    <Text style={[styles.title, { color: colors.foreground }]}>¡Torneo creado!</Text>
                  </View>
                ) : (
                  <Text style={[styles.title, { color: colors.foreground }]}>Invitar amigos</Text>
                )}
                {tournamentName ? (
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {tournamentName}
                  </Text>
                ) : null}
                {inviteCode ? (
                  <View style={[styles.codeBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Ionicons name="key-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.codeText, { color: colors.mutedForeground }]}>
                      Código: {inviteCode}
                    </Text>
                  </View>
                ) : null}
              </View>
              {selected.size > 0 && (
                <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.selectedBadgeText}>{selected.size}</Text>
                </View>
              )}
            </View>

            {/* Search */}
            <View style={[styles.searchContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Buscar amigo..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            {/* Friends list */}
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => renderFriendItem(item)}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                friendsLoading ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : (
                  <View style={styles.centered}>
                    <Ionicons name="people-outline" size={40} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                      {searchQuery ? 'Sin resultados' : 'No tienes amigos aún'}
                    </Text>
                    {!searchQuery && (
                      <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
                        Agrega amigos desde la sección Social
                      </Text>
                    )}
                  </View>
                )
              }
            />

            {/* CTAs */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={doClose}
                disabled={sending}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground }]}>
                  Ahora no
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryBtnWrapper,
                  styles.primaryBtn,
                  { backgroundColor: colors.primary },
                  (selected.size === 0 || sending) && { opacity: 0.5 },
                ]}
                onPress={handleSend}
                disabled={selected.size === 0 || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {selected.size > 0
                      ? `Enviar ${selected.size > 1 ? `${selected.size} invitaciones` : 'invitación'}`
                      : 'Enviar invitaciones'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default InviteFriendsSheet;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  container: {
    height: '90%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  selectedBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  selectedBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 40,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  // Friend item
  friendCard: {
    padding: Spacing.sm,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Footer CTAs
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryBtnWrapper: {
    flex: 2,
  },
  primaryBtn: {
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
