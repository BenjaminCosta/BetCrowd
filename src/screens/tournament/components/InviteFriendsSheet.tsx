import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToClose, SwipeDragHandle } from '../../../components/SheetModal';
import { Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Card } from '../../../components/CommonComponents';
import UserAvatar from '../../../components/UserAvatar';
import { useFriends, FriendWithProfile } from '../../../context/FriendsContext';
import { useToast } from '../../../context/ToastContext';
import { sendTournamentInvites } from '../../../services/inviteService';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getOrCreateTournamentInviteLink } from '../../../services/inviteLinkService';

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
  const { friends, friendsLoading } = useFriends();
  const { showToast } = useToast();
  const { onGestureEvent, onHandlerStateChange, animatedContainerStyle, doClose } =
    useSwipeToClose(visible, onClose);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [sharingLink, setSharingLink] = useState(false);
  const [memberUidSet, setMemberUidSet] = useState<Set<string>>(new Set());
  // Cache member UIDs per tournament for the lifetime of this component mount
  // so repeated open/close of the sheet doesn't re-read Firestore each time.
  const memberUidsCacheRef = React.useRef<{ tid: string; uids: Set<string> } | null>(null);

  // Fetch current tournament members when sheet opens
  useEffect(() => {
    if (!visible || !tournamentId) return;
    // Reuse cached result if it's for the same tournament
    if (memberUidsCacheRef.current?.tid === tournamentId) {
      setMemberUidSet(memberUidsCacheRef.current.uids);
      return;
    }
    let cancelled = false;
    getDocs(collection(db, 'tournaments', tournamentId, 'members'))
      .then((snap) => {
        if (!cancelled) {
          const uids = new Set(snap.docs.map((d) => d.id));
          memberUidsCacheRef.current = { tid: tournamentId, uids };
          setMemberUidSet(uids);
        }
      })
      .catch(() => { /* silent — worst case we show all as invitable */ });
    return () => { cancelled = true; };
  }, [visible, tournamentId]);

  // Reset state when sheet closes
  React.useEffect(() => {
    if (!visible) {
      setSelected(new Set());
      setSearchQuery('');
      setSending(false);
      setSharingLink(false);
      setMemberUidSet(new Set());
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
    if (memberUidSet.has(uid)) return; // already in tournament
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
        showToast({
          type: 'info',
          message: 'Los usuarios seleccionados ya son miembros o ya tienen una invitación pendiente.',
        });
      } else {
        const msg =
          sent === 1
            ? '¡Invitación enviada!'
            : `¡${sent} invitaciones enviadas!`;
        showToast({ type: 'success', message: msg });
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'No se pudieron enviar las invitaciones' });
    } finally {
      setSending(false);
    }
  };

  const handleShareLink = async () => {
    setSharingLink(true);
    try {
      const inviteLink = await getOrCreateTournamentInviteLink(tournamentId);
      await Share.share({
        message: `Únete a "${tournamentName}" en BetCrowd: ${inviteLink.shareUrl}`,
      });
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'No se pudo compartir el link del torneo' });
    } finally {
      setSharingLink(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderFriendItem = (friend: FriendWithProfile) => {
    const profile = friend.profile;
    if (!profile) return null;
    const isSelected = selected.has(friend.uid);
    const isMember = memberUidSet.has(friend.uid);

    return (
      <TouchableOpacity
        key={friend.uid}
        activeOpacity={isMember ? 1 : 0.75}
        onPress={() => !isMember && toggleSelect(friend.uid)}
        disabled={isMember}
      >
        <Card
          style={[
            styles.friendCard,
            isSelected && { borderColor: colors.primary, borderWidth: 1 },
            isMember && { opacity: 0.45 },
          ]}
        >
          <View style={styles.friendRow}>
            {/* Avatar */}
            <UserAvatar
              uid={friend.uid}
              name={profile.displayName || profile.username || ''}
              size={44}
            />

            {/* Info */}
            <View style={styles.friendInfo}>
              <Text style={[styles.displayName, { color: colors.foreground }]}>
                {profile.displayName}
              </Text>
              <Text style={[styles.username, { color: colors.mutedForeground }]}>
                @{profile.username}
              </Text>
              {isMember && (
                <View style={[styles.memberBadge, { backgroundColor: colors.muted }]}>
                  <Ionicons name="checkmark-circle" size={10} color={colors.mutedForeground} />
                  <Text style={[styles.memberBadgeText, { color: colors.mutedForeground }]}>
                    Ya está en el torneo
                  </Text>
                </View>
              )}
            </View>

            {/* Checkbox — only for non-members */}
            {!isMember && (
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
            )}
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
                <TouchableOpacity
                  style={[
                    styles.shareLinkChip,
                    {
                      backgroundColor: colors.primary + '10',
                      borderColor: colors.primary + '35',
                    },
                    sharingLink && { opacity: 0.7 },
                  ]}
                  onPress={handleShareLink}
                  disabled={sharingLink}
                  activeOpacity={0.8}
                >
                  {sharingLink ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="share-social-outline" size={13} color={colors.primary} />
                      <Text style={[styles.shareLinkChipText, { color: colors.primary }]}>
                        Compartir link
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
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
  shareLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 34,
  },
  shareLinkChipText: {
    fontSize: 12,
    fontWeight: '700',
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
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: '600',
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
