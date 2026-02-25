import React from 'react';
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
import { Colors, Spacing } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Chip, EmptyState } from '../../../components/CommonComponents';
import { EventCard, SwipeableRow } from '../../../components/BetanoComponents';
import { Event } from '../../../services/eventService';

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

  return (
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
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {EVENT_FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={eventFilter === f.key}
            onPress={() => onFilterChange(f.key)}
            style={styles.filterChip}
          />
        ))}
      </ScrollView>

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
        filteredEvents.map((event) => (
          <SwipeableRow
            key={event.id}
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
        ))
      )}
    </ScrollView>
  );
};

export default EventsTab;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabScroll: { flex: 1 },
  tabContent: { padding: Spacing.lg, paddingBottom: 100 },
  chipRow: { marginBottom: Spacing.lg },
  filterChip: { marginRight: Spacing.sm },
  centeredLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
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
