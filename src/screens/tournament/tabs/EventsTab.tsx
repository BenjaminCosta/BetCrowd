import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { EmptyState } from '../../../components/CommonComponents';
import { EventCard, SwipeableRow } from '../../../components/BetanoComponents';
import { Event } from '../../../services/eventService';
import { useTooltip } from '../../../hooks/useTooltip';
import { ContextualTooltip } from '../../../components/ContextualTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventFilter = 'open' | 'upcoming' | 'finished';

const EVENT_FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'open', label: 'Abiertos' },
  { key: 'upcoming', label: 'Próximos' },
  { key: 'finished', label: 'Finalizados' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventsTabProps {
  filteredEvents: Event[];
  eventsLoading: boolean;
  eventsRefreshing: boolean;
  eventFilter: EventFilter;
  isAdmin: boolean;
  eventPicks: Record<string, boolean>;
  onEventPress: (event: Event) => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
  onFilterChange: (filter: EventFilter) => void;
  onRefresh: () => void;
  onCloseEvent: (event: Event) => void;
  onLoadResults: (event: Event) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EventsTab: React.FC<EventsTabProps> = ({
  filteredEvents,
  eventsLoading,
  eventsRefreshing,
  eventFilter,
  isAdmin,
  eventPicks,
  onEventPress,
  onEditEvent,
  onDeleteEvent,
  onFilterChange,
  onRefresh,
  onCloseEvent,
  onLoadResults,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  // ── T-04: swipe event tooltip (admin only, one-time) ──────────────────────
  const { seen: swipeEventTipSeen, markSeen: markSwipeEventSeen, loaded: swipeEventTipLoaded } =
    useTooltip('swipe_evento_admin');
  const [showSwipeEventTooltip, setShowSwipeEventTooltip] = useState(false);
  const firstEventCardRef = useRef<any>(null);
  const firstEventAssignedRef = useRef(false);

  // Reset ref assignment when the events list changes so the ref stays fresh
  useEffect(() => {
    firstEventAssignedRef.current = false;
  }, [filteredEvents]);

  // Trigger tooltip after first render with admin events
  useEffect(() => {
    if (!isAdmin || swipeEventTipSeen || !swipeEventTipLoaded || filteredEvents.length === 0) return;
    const timer = setTimeout(() => setShowSwipeEventTooltip(true), 700);
    return () => clearTimeout(timer);
  }, [isAdmin, swipeEventTipSeen, swipeEventTipLoaded, filteredEvents.length]);

  return (
    <>
      <View style={styles.container}>
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContent}
          refreshControl={
            <RefreshControl
              refreshing={eventsRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Filter tabs */}
          <View style={styles.filterRow}>
            {EVENT_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterTab,
                  { backgroundColor: eventFilter === f.key ? colors.primary + '26' : colors.muted },
                ]}
                onPress={() => onFilterChange(f.key)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { color: eventFilter === f.key ? colors.primary : colors.mutedForeground },
                    eventFilter === f.key && { fontWeight: '700' },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {eventsLoading ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              iconName="calendar-outline"
              title="Sin eventos"
              message={
                isAdmin
                  ? 'Crea el primer evento del torneo'
                  : 'No hay eventos en este filtro'
              }
            />
          ) : (
            filteredEvents.map((event, idx) => {
              const isFirstCard = isAdmin && idx === 0;
              if (isFirstCard && !firstEventAssignedRef.current) {
                firstEventAssignedRef.current = true;
              }
              return (
                <View
                  key={event.id}
                  ref={isFirstCard ? firstEventCardRef : undefined}
                >
                  <SwipeableRow
                    enabled={isAdmin}
                    actions={[
                      {
                        label: 'Editar',
                        icon: 'create-outline',
                        color: colors.primary,
                        onPress: () => onEditEvent(event),
                      },
                      {
                        label: 'Eliminar',
                        icon: 'trash-outline',
                        color: colors.destructive,
                        onPress: () => onDeleteEvent(event),
                      },
                    ]}
                  >
                    <EventCard
                      event={event}
                      theme={theme}
                      onPress={() => onEventPress(event)}
                      expanded={false}
                      userHasPick={eventPicks[event.id] ?? false}
                      adminActionBar={
                        isAdmin ? (
                          <>
                            {(event.status === 'upcoming' || event.status === 'live') && (
                              <TouchableOpacity
                                style={[styles.adminActionBtn, { borderColor: colors.border }]}
                                onPress={() => onCloseEvent(event)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="lock-closed-outline" size={11} color={colors.mutedForeground} />
                                <Text style={[styles.adminActionText, { color: colors.mutedForeground }]}>
                                  Cerrar apuestas
                                </Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={[styles.adminActionBtn, { borderColor: colors.border }]}
                              onPress={() => onLoadResults(event)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark-circle-outline" size={11} color={colors.mutedForeground} />
                              <Text style={[styles.adminActionText, { color: colors.mutedForeground }]}>
                                Cargar resultado
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : undefined
                      }
                    />
                  </SwipeableRow>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* T-04: swipe event tooltip (admin only, one-time) */}
      <ContextualTooltip
        visible={showSwipeEventTooltip}
        onDismiss={() => { setShowSwipeEventTooltip(false); markSwipeEventSeen(); }}
        title="Gestionar evento"
        message="Deslizá un evento hacia la izquierda para editarlo o eliminarlo."
        targetRef={firstEventCardRef}
        bubblePosition="bottom"
      />
    </>
  );
};

export default EventsTab;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabScroll: { flex: 1 },
  tabContent: { padding: Spacing.lg, paddingBottom: 100 },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  centeredLoader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  adminActionText: { fontSize: 11, fontWeight: '600' },
});
