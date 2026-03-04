import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { LoadingBar } from '../../components/LoadingBar';
import { EmptyState } from '../../components/CommonComponents';
import { SwipeableRow } from '../../components/BetanoComponents';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { SheetModal } from '../../components/SheetModal';
import CreateTournamentForm from '../../components/forms/CreateTournamentForm';
import JoinCodeForm from '../../components/forms/JoinCodeForm';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  listMyTournaments,
  getTournamentMemberCount,
  deleteTournamentSoft,
  getMyRolesMap,
  Tournament,
} from '../../services/tournamentService';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Types ────────────────────────────────────────────────────────────────────

type TorneoFilter = 'active' | 'finished';

const FILTER_LABELS: { key: TorneoFilter; label: string }[] = [
  { key: 'active', label: 'Activos' },
  { key: 'finished', label: 'Finalizados' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  liga: 'Liga',
  eliminatoria: 'Eliminatoria',
  'grupos-eliminatoria': 'Grupos + Eliminatoria',
  'evento-unico': 'Evento único',
  serie: 'Serie (Bo3/Bo5)',
  bracket: 'Eliminación Directa',
  points: 'Puntos',
  otro: 'Otro',
};

const getFormatLabel = (formatId: string) => FORMAT_LABELS[formatId] || formatId;

const getFormatIcon = (formatId: string): string => {
  const icons: Record<string, string> = {
    liga: 'trophy',
    eliminatoria: 'git-branch',
    'grupos-eliminatoria': 'grid',
    'evento-unico': 'flag',
    serie: 'list',
    bracket: 'git-branch',
    points: 'analytics',
    otro: 'ellipsis-horizontal',
  };
  return icons[formatId] || 'trophy';
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const TorneosScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [myRoles, setMyRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TorneoFilter>('active');
  const isFirstFocusRef = useRef(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showJoinCodeSheet, setShowJoinCodeSheet] = useState(false);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    loadTournaments();
  }, [user]);

  // ── Reload on focus (skip first mount, same pattern as EventsScreen) ──────

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      loadTournaments(false, true); // silent reload
    }, [])
  );

  // ── Data loader ───────────────────────────────────────────────────────────

  const loadTournaments = async (isRefreshing = false, silent = false) => {
    if (isRefreshing) setRefreshing(true);
    else if (!silent) setLoading(true);

    try {
      const [data, roles] = await Promise.all([
        listMyTournaments(),
        getMyRolesMap(),
      ]);
      const filtered = data.filter((t) => t.status !== 'deleted');
      setTournaments(filtered);
      setMyRoles(roles);

      // Load all member counts in parallel
      const counts: Record<string, number> = {};
      await Promise.all(
        filtered.map(async (t) => {
          counts[t.id] = await getTournamentMemberCount(t.id);
        })
      );
      setMemberCounts(counts);
    } catch (e) {
      console.error('TorneosScreen loadTournaments:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => loadTournaments(true);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredTournaments = (() => {
    const list = tournaments.filter((t) => {
      if (filter === 'active') return t.status === 'active' || t.status === 'locked';
      if (filter === 'finished') return t.status === 'finished';
      return false;
    });
    list.sort((a, b) => {
      const aTime = (a as any).lastActivityAt?.toMillis?.() ?? (a as any).createdAt?.toMillis?.() ?? 0;
      const bTime = (b as any).lastActivityAt?.toMillis?.() ?? (b as any).createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    return list;
  })();

  // ── Swipe actions ─────────────────────────────────────────────────────────

  const handleEdit = (t: Tournament) => {
    navigation.navigate('TournamentSettings', { tournamentId: t.id });
  };

  const handleDelete = (t: Tournament) => {
    Alert.alert(
      'Eliminar torneo',
      `¿Estás seguro que deseas eliminar "${t.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTournamentSoft(t.id);
              setTournaments((prev) => prev.filter((x) => x.id !== t.id));
            } catch (e: any) {
              Alert.alert('Error', e.message || 'No se pudo eliminar el torneo');
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  const renderTabsControl = () => {
    const activeCount = tournaments.filter(
      (t) => t.status === 'active' || t.status === 'locked',
    ).length;
    const finishedCount = tournaments.filter((t) => t.status === 'finished').length;
    const counts: Record<TorneoFilter, number> = { active: activeCount, finished: finishedCount };

    return (
      <View style={[styles.tabsBar, { borderBottomColor: colors.border }]}>
        {FILTER_LABELS.map(({ key, label }) => {
          const isActive = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tabItem,
                isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[
                  styles.tabItemText,
                  { color: isActive ? colors.primary : colors.mutedForeground },
                ]}
              >
                {label} ({counts[key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const getRoleInfo = (tournamentId: string, ownerId: string) => {
    const role = myRoles[tournamentId] || (ownerId === user?.uid ? 'owner' : 'member');
    switch (role) {
      case 'owner':
      case 'admin':  return { label: 'Admin',    icon: 'shield-checkmark-outline' as const, color: colors.mutedForeground };
      default:       return { label: 'Miembro',  icon: 'person-outline' as const,           color: colors.mutedForeground };
    }
  };

  const renderTournamentCard = ({ item: t }: { item: Tournament }) => {
    const isOwner = t.ownerId === user?.uid ||
      (myRoles[t.id] === 'owner');
    const count = memberCounts[t.id] ?? 0;
    const max = Math.max(t.participantsEstimated || 1, 1);
    const roleInfo = getRoleInfo(t.id, t.ownerId);

    return (
      <SwipeableRow
        enabled={isOwner}
        actions={[
          {
            label: 'Editar',
            icon: 'create-outline',
            color: colors.primary,
            onPress: () => handleEdit(t),
          },
          {
            label: 'Eliminar',
            icon: 'trash-outline',
            color: colors.destructive,
            onPress: () => handleDelete(t),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Tournament', { tournamentId: t.id })}
          activeOpacity={0.7}
        >
          {/* Gradient overlay */}
          <LinearGradient
            colors={[colors.primary + '10', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Header: name + format badge + contribution box */}
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                {t.name}
              </Text>
              <View style={styles.cardFormatRow}>
                <Ionicons name={getFormatIcon(t.format) as any} size={12} color={colors.primary} />
                <Text style={[styles.cardFormat, { color: colors.mutedForeground }]}>
                  {getFormatLabel(t.format)}
                </Text>
              </View>
            </View>
            <View style={styles.cardBadgeStack}>
              {t.status === 'finished' && (
                <View
                  style={[
                    styles.cardFinishedBadge,
                    { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' },
                  ]}
                >
                  <Text style={[styles.cardFinishedText, { color: colors.primary }]}>FINALIZADO</Text>
                </View>
              )}
              <View style={[styles.cardRoleBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name={roleInfo.icon} size={13} color={roleInfo.color} />
                <Text style={[styles.cardRoleText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

          {/* Footer: participants */}
          <View style={styles.cardFooter}>
            <View style={styles.cardMeta}>
              <View style={styles.cardMetaItem}>
                <View style={[styles.cardMetaIconCircle, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="people" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.cardMetaText, { color: colors.foreground }]}>
                  {count}/{max} participantes
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyWrapper}>
      <EmptyState
        iconName="trophy-outline"
        title={filter === 'active' ? 'Sin torneos activos' : 'Sin torneos finalizados'}
        message={
          filter === 'active'
            ? 'Crea un torneo o únete a uno con un código de invitación'
            : 'Los torneos finalizados aparecer\u00e1n aqu\u00ed'
        }
      />
      {filter === 'active' && (
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreateSheet(true)}
        >
          <Text style={styles.ctaButtonText}>Crear torneo</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando torneos...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading={refreshing} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Torneos</Text>
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowJoinCodeSheet(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="key-outline" size={14} color="#FFFFFF" />
            <Text style={styles.joinBtnText}>Unirse con código</Text>
          </TouchableOpacity>
        </View>

        {renderTabsControl()}

        <FlatList
          data={filteredTournaments}
          keyExtractor={(item) => item.id}
          renderItem={renderTournamentCard}
          contentContainerStyle={[
            styles.listContent,
            filteredTournaments.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />

        {/* FAB — Crear torneo */}
        <FloatingActionButton onPress={() => setShowCreateSheet(true)} />
      </View>

      {/* Create Tournament Sheet */}
      <SheetModal
        visible={showCreateSheet}
        onClose={() => { setShowCreateSheet(false); loadTournaments(false, true); }}
      >
        <CreateTournamentForm
          onSuccess={() => { setShowCreateSheet(false); loadTournaments(false, true); }}
        />
      </SheetModal>
      {/* Join Code Sheet */}
      <SheetModal
        visible={showJoinCodeSheet}
        onClose={() => setShowJoinCodeSheet(false)}
      >
        <JoinCodeForm
          onJoined={(tournamentId) => {
            setShowJoinCodeSheet(false);
            navigation.navigate('Tournament', { tournamentId });
          }}
        />
      </SheetModal>
    </GestureHandlerRootView>
  );
};

export default TorneosScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: { fontSize: 14 },

  // Header
  header: {
    paddingHorizontal: 14,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: Spacing.sm },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  joinBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Tabs underline (same style as TournamentPredictionsScreen)
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 14,
    marginBottom: Spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // FlatList
  listContent: { padding: 14, paddingBottom: 100 },
  listContentEmpty: { flex: 1, justifyContent: 'center' as const },

  // Empty state
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  ctaButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Tournament card
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 13,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  cardFormat: { fontSize: 13, fontWeight: '500' },
  cardDivider: { height: 1, marginBottom: 10 },

  // Card layout
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardInfo: { flex: 1, marginRight: 12, gap: 4 },
  cardFormatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardRoleText: { fontSize: 11, fontWeight: '500' },
  cardBadgeStack: { alignItems: 'flex-end', gap: 4 },
  cardFinishedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardFinishedText: { fontSize: 10, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardMeta: { flex: 1, gap: 6 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMetaIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMetaText: { fontSize: 13, fontWeight: '500' },

});
