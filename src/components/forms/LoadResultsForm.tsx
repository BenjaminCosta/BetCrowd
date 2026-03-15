import React, { useState, useEffect } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { Card, Badge } from '../CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getTournament } from '../../services/tournamentService';
import { listenEvents, Event } from '../../services/eventService';
import { listenBets, settleBet, Bet } from '../../services/betService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface LoadResultsFormProps {
  tournamentId: string;
  onOpenEvent?: (event: Event) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const LoadResultsForm: React.FC<LoadResultsFormProps> = ({ tournamentId, onOpenEvent }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tournament, setTournament] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventBets, setEventBets] = useState<Record<string, Bet[]>>({});
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const eventIds = events.map((e) => e.id).join(',');

  useEffect(() => {
    if (!tournamentId) return;
    loadTournament();
    const unsub = listenEvents(tournamentId, (updatedEvents) => {
      setEvents(updatedEvents.filter((e) => e.status === 'finished' || e.status === 'locked'));
      setLoading(false);
    });
    return () => unsub();
  }, [tournamentId]);

  useEffect(() => {
    if (!expandedEventId || !tournamentId) return;
    const unsub = listenBets(tournamentId, expandedEventId, (bets) => {
      setEventBets((prev) => ({
        ...prev,
        [expandedEventId]: bets.filter((b) => b.status === 'locked' || b.status === 'open'),
      }));
    });
    return () => unsub();
  }, [expandedEventId, tournamentId]);

  // Subscribe to bets for ALL events to track pending counts for dot badges
  useEffect(() => {
    if (!events.length || !tournamentId) return;
    const unsubs = events.map((event) =>
      listenBets(tournamentId, event.id, (bets) => {
        const count = bets.filter((b) => b.status === 'locked' || b.status === 'open').length;
        setPendingCounts((prev) => ({ ...prev, [event.id]: count }));
      })
    );
    return () => unsubs.forEach((u) => { u(); });
  }, [eventIds, tournamentId]);

  const loadTournament = async () => {
    try {
      const data = await getTournament(tournamentId);
      setTournament(data);
    } catch (e) {
      console.error('LoadResultsForm:', e);
    }
  };

  const toggleEvent = (eventId: string) =>
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));

  const handleSettleBet = (eventId: string, bet: Bet) => {
    Alert.alert(
      'Resolver Apuesta',
      `¿Cuál es el resultado de "${bet.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        ...bet.options.map((option) => ({
          text: option,
          onPress: async () => {
            try {
              await settleBet(tournamentId, eventId, bet.id, { winner: option });
              showToast({ type: 'success', message: `Apuesta resuelta: ${option}` });
            } catch (e: any) {
              showToast({ type: 'error', message: e.message || 'No se pudo resolver' });
            }
          },
        })),
      ]
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Sin fecha';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Cargando eventos...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Ionicons name="trophy" size={26} color={colors.primary} />
        <View>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Cargar Resultados</Text>
          {tournament?.name ? (
            <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>{tournament.name}</Text>
          ) : null}
        </View>
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No hay resultados para cargar</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Los eventos cerrados o finalizados con apuestas pendientes aparecerán aquí
          </Text>
        </View>
      ) : (
        events.map((event) => {
          const isExpanded = expandedEventId === event.id;
          const bets = eventBets[event.id] || [];

          return (
            <Card key={event.id} style={styles.eventCard}>
              <TouchableOpacity onPress={() => toggleEvent(event.id)} activeOpacity={0.7}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventInfo}>
                    <View style={styles.eventTitleRow}>
                      <Text style={[styles.eventTitle, { color: colors.foreground }]}>{event.title}</Text>
                      {(pendingCounts[event.id] ?? 0) > 0 && (
                        <View style={[styles.pendingDot, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    {(event.homeTeam || event.awayTeam) && (
                      <Text style={[styles.eventTeams, { color: colors.mutedForeground }]}>
                        {event.homeTeam || 'TBD'} vs {event.awayTeam || 'TBD'}
                      </Text>
                    )}
                    {event.startsAt && (
                      <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                        {formatDate(event.startsAt)}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={colors.mutedForeground}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.betsSection}>
                  {bets.length === 0 ? (
                    <View style={styles.allSettledWrapper}>
                      <Text style={[styles.noBetsText, { color: colors.mutedForeground }]}>
                        Todas las apuestas están resueltas
                      </Text>
                      {onOpenEvent && (
                        <TouchableOpacity
                          style={[styles.adjustBtn, { borderColor: colors.primary + '40' }]}
                          onPress={() => onOpenEvent(event)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="options-outline" size={14} color={colors.primary} />
                          <Text style={[styles.adjustBtnText, { color: colors.primary }]}>
                            Ajustar resultado
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <>
                      <View style={[styles.betsSectionHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.betsSectionTitle, { color: colors.foreground }]}>
                          Apuestas por resolver
                        </Text>
                        <Badge variant="warning">{bets.length}</Badge>
                      </View>
                      {bets.map((bet) => (
                        <View
                          key={bet.id}
                          style={[styles.betCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                        >
                          <View style={styles.betHeader}>
                            <Text style={[styles.betTitle, { color: colors.foreground }]}>{bet.title}</Text>
                            <Badge variant={bet.status === 'locked' ? 'warning' : 'success'}>
                              {bet.status === 'locked' ? 'CERRADA' : 'ABIERTA'}
                            </Badge>
                          </View>
                          {bet.description ? (
                            <Text style={[styles.betDescription, { color: colors.mutedForeground }]}>
                              {bet.description}
                            </Text>
                          ) : null}
                          <View style={styles.betMeta}>
                            <Text style={[styles.betMetaText, { color: colors.mutedForeground }]}>
                              ${(bet.totalPot || 0).toLocaleString()}
                            </Text>
                            <Text style={[styles.betMetaText, { color: colors.mutedForeground }]}>
                              {bet.totalPicks || 0} apuestas
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.settleButton, { backgroundColor: colors.primary }]}
                            onPress={() => handleSettleBet(event.id, bet)}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                            <Text style={styles.settleButtonText}>Resolver Apuesta</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
};

export default LoadResultsForm;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  loadingText: { fontSize: 14 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.xl },
  pageTitle: { fontSize: 22, fontWeight: '700' },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48, gap: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  eventCard: { marginBottom: Spacing.md },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventInfo: { flex: 1 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  pendingDot: { width: 7, height: 7, borderRadius: 3.5 },
  eventTitle: { fontSize: 15, fontWeight: '700' },
  allSettledWrapper: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  adjustBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  adjustBtnText: { fontSize: 12, fontWeight: '600' },
  eventTeams: { fontSize: 12, marginBottom: 2 },
  eventDate: { fontSize: 11 },
  betsSection: { marginTop: Spacing.md },
  betsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.sm, marginBottom: Spacing.sm, borderBottomWidth: 1 },
  betsSectionTitle: { fontSize: 13, fontWeight: '700' },
  noBetsText: { fontSize: 13, textAlign: 'center', paddingVertical: Spacing.sm },
  betCard: { padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.sm },
  betHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  betTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  betDescription: { fontSize: 12, marginBottom: 6 },
  betMeta: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.sm },
  betMetaText: { fontSize: 11 },
  settleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: Spacing.sm, borderRadius: BorderRadius.sm },
  settleButtonText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
