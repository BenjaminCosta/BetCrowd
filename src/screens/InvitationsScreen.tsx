import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
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
import { TournamentInvite } from '../services/inviteService';
import TournamentPreviewSheet from './tournament/components/TournamentPreviewSheet';

type TabType = 'received' | 'sent';

const InvitationsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const {
    receivedInvites,
    sentInvites,
    pendingInviteCount,
    acceptInvite,
    rejectInvite,
    cancelInvite,
  } = useSocial();

  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewInvite, setPreviewInvite] = useState<TournamentInvite | null>(null);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);

  const handleAcceptInvite = async (invite: TournamentInvite) => {
    try {
      setActionLoading(`accept-${invite.id}`);
      const tId = await acceptInvite(invite.id);
      navigation.navigate('Tournament', { tournamentId: tId });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo aceptar la invitación');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectInvite = async (invite: TournamentInvite) => {
    Alert.alert(
      'Rechazar invitación',
      `¿Rechazar la invitación a "${invite.tournamentName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(`reject-${invite.id}`);
              await rejectInvite(invite.id);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'No se pudo rechazar');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelInvite = async (invite: TournamentInvite) => {
    try {
      setActionLoading(`cancel-${invite.id}`);
      await cancelInvite(invite.id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo cancelar');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusInfo = (status: TournamentInvite['status']) => {
    switch (status) {
      case 'pending':   return { label: 'Pendiente',  color: colors.warning };
      case 'accepted':  return { label: 'Aceptada',   color: colors.success };
      case 'rejected':  return { label: 'Rechazada',  color: colors.destructive };
      case 'cancelled': return { label: 'Cancelada',  color: colors.mutedForeground };
      default:          return { label: status,       color: colors.mutedForeground };
    }
  };

  const renderReceivedItem = (invite: TournamentInvite) => {
    const statusInfo = getStatusInfo(invite.status);
    const isPending = invite.status === 'pending';
    const isActing =
      actionLoading === `accept-${invite.id}` ||
      actionLoading === `reject-${invite.id}`;

    return (
      <Card key={invite.id} style={styles.inviteCard}>
        <View style={styles.inviteRow}>
          {/* Icon */}
          <LinearGradient
            colors={['rgba(215,38,61,0.15)', 'rgba(255,122,0,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inviteIcon}
          >
            <Ionicons name="trophy" size={22} color={colors.primary} />
          </LinearGradient>

          {/* Info */}
          <View style={styles.inviteInfo}>
            <Text
              style={[styles.tournamentName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {invite.tournamentName}
            </Text>
            <Text style={[styles.inviteMeta, { color: colors.mutedForeground }]}>
              de {invite.fromName}
            </Text>
          </View>

          {/* Status badge (non-pending) or action buttons (pending) */}
          {!isPending ? (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusInfo.color + '22',
                  borderColor: statusInfo.color + '44',
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          ) : (
            <View style={styles.actionGroup}>
              {/* Ver */}
              <TouchableOpacity
                style={[styles.viewBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setPreviewInvite(invite);
                  setShowPreviewSheet(true);
                }}
                disabled={isActing}
              >
                <Text style={[styles.viewBtnText, { color: colors.foreground }]}>Ver</Text>
              </TouchableOpacity>

              {/* Reject */}
              <TouchableOpacity
                style={[styles.rejectBtn, { borderColor: colors.border }]}
                onPress={() => handleRejectInvite(invite)}
                disabled={isActing}
              >
                {actionLoading === `reject-${invite.id}` ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Ionicons name="close" size={18} color={colors.foreground} />
                )}
              </TouchableOpacity>

              {/* Accept */}
              <TouchableOpacity onPress={() => handleAcceptInvite(invite)} disabled={isActing}>
                <LinearGradient
                  colors={Gradients.primary as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.acceptBtn}
                >
                  {actionLoading === `accept-${invite.id}` ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Card>
    );
  };

  const renderSentItem = (invite: TournamentInvite) => {
    const statusInfo = getStatusInfo(invite.status);
    const isPending = invite.status === 'pending';
    const isCancelling = actionLoading === `cancel-${invite.id}`;

    return (
      <Card key={invite.id} style={styles.inviteCard}>
        <View style={styles.inviteRow}>
          {/* Icon */}
          <LinearGradient
            colors={['rgba(215,38,61,0.15)', 'rgba(255,122,0,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inviteIcon}
          >
            <Ionicons name="trophy" size={22} color={colors.primary} />
          </LinearGradient>

          {/* Info */}
          <View style={styles.inviteInfo}>
            <Text
              style={[styles.tournamentName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {invite.tournamentName}
            </Text>
            <Text style={[styles.inviteMeta, { color: colors.mutedForeground }]}>
              para {invite.toName || invite.toUid}
            </Text>
          </View>

          {/* Status + optional cancel */}
          <View style={styles.sentRight}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusInfo.color + '22',
                  borderColor: statusInfo.color + '44',
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
            {isPending && (
              <TouchableOpacity onPress={() => handleCancelInvite(invite)} disabled={isCancelling}>
                {isCancelling ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Text style={[styles.cancelSmall, { color: colors.mutedForeground }]}>
                    Cancelar
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  };

  const renderContent = () => {
    if (activeTab === 'received') {
      if (receivedInvites.length === 0) {
        return (
          <EmptyState
            iconName="trophy-outline"
            title="Sin invitaciones"
            message="No tienes invitaciones a torneos"
          />
        );
      }
      return receivedInvites.map(renderReceivedItem);
    }

    if (sentInvites.length === 0) {
      return (
        <EmptyState
          iconName="paper-plane-outline"
          title="Sin invitaciones enviadas"
          message="No has enviado invitaciones a torneos"
        />
      );
    }
    return sentInvites.map(renderSentItem);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Invitaciones</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'received' && styles.activeTab,
            activeTab === 'received' && { backgroundColor: 'rgba(215, 38, 61, 0.15)' },
          ]}
          onPress={() => setActiveTab('received')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.mutedForeground },
              activeTab === 'received' && styles.activeTabText,
              activeTab === 'received' && { color: colors.primary },
            ]}
          >
            Recibidas
          </Text>
          {pendingInviteCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{pendingInviteCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'sent' && styles.activeTab,
            activeTab === 'sent' && { backgroundColor: 'rgba(215, 38, 61, 0.15)' },
          ]}
          onPress={() => setActiveTab('sent')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.mutedForeground },
              activeTab === 'sent' && styles.activeTabText,
              activeTab === 'sent' && { color: colors.primary },
            ]}
          >
            Enviadas
          </Text>
          {sentInvites.filter(i => i.status === 'pending').length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={styles.badgeText}>
                {sentInvites.filter(i => i.status === 'pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {renderContent()}
      </ScrollView>

      {/* Preview sheet for "Ver" on received invites */}
      <TournamentPreviewSheet
        visible={showPreviewSheet}
        onClose={() => setShowPreviewSheet(false)}
        mode="invite"
        invite={previewInvite}
        onSuccess={(tId) => {
          setShowPreviewSheet(false);
          navigation.navigate('Tournament', { tournamentId: tId });
        }}
      />
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
  activeTab: {},
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
  inviteCard: {
    padding: Spacing.sm,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inviteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteInfo: {
    flex: 1,
    gap: 2,
  },
  tournamentName: {
    fontSize: 15,
    fontWeight: '600',
  },
  inviteMeta: {
    fontSize: 12,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cancelSmall: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default InvitationsScreen;
