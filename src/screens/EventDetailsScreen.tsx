import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Badge, Chip, SectionHeader, Divider } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { getEvent, deleteEvent, cancelEvent, type Event } from '../services/eventService';
import { isUserAdmin } from '../services/tournamentService';
import { auth } from '../lib/firebase';

const chipAmounts = ['0', '100', '200', '500', '1000'];

const EventDetailsScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { tournamentId, eventId } = route.params;

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState('0');

  useEffect(() => {
    loadEventData();
  }, []);

  const loadEventData = async () => {
    try {
      setLoading(true);
      const eventData = await getEvent(tournamentId, eventId);
      setEvent(eventData);

      if (auth.currentUser) {
        const adminStatus = await isUserAdmin(tournamentId, auth.currentUser.uid);
        setIsAdmin(adminStatus);
      }
    } catch (error: any) {
      console.error('Error loading event:', error);
      Alert.alert('Error', error.message || 'No se pudo cargar el evento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar evento',
      '¿Estás seguro que deseas eliminar este evento permanentemente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(tournamentId, eventId);
              Alert.alert('Éxito', 'Evento eliminado');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar el evento');
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar evento',
      '¿Deseas marcar este evento como cancelado?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          onPress: async () => {
            try {
              await cancelEvent(tournamentId, eventId);
              Alert.alert('Éxito', 'Evento cancelado');
              loadEventData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo cancelar el evento');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="warning">PRÓXIMO</Badge>;
      case 'live':
        return <Badge variant="danger">EN VIVO</Badge>;
      case 'finished':
        return <Badge variant="default">FINALIZADO</Badge>;
      case 'cancelled':
        return <Badge variant="default">CANCELADO</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Evento no encontrado
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Event Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.eventName, { color: colors.foreground }]}>
                {event.title}
              </Text>
              {getStatusBadge(event.status)}
            </View>

            {(event.homeTeam || event.awayTeam) && (
              <View style={styles.participants}>
                <Text style={[styles.participant, { color: colors.foreground }]}>
                  {event.homeTeam || 'TBD'}
                </Text>
                <Text style={[styles.vs, { color: colors.mutedForeground }]}>VS</Text>
                <Text style={[styles.participant, { color: colors.foreground }]}>
                  {event.awayTeam || 'TBD'}
                </Text>
              </View>
            )}

            {event.startsAt && (
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  {event.startsAt.toDate().toLocaleString('es-AR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}

            {event.notes && (
              <View style={[styles.notesCard, { backgroundColor: colors.muted }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.notesText, { color: colors.mutedForeground }]}>
                  {event.notes}
                </Text>
              </View>
            )}
          </View>

          {/* Admin Actions */}
          {isAdmin && event.status !== 'cancelled' && (
            <Card style={styles.adminCard}>
              <Text style={[styles.adminTitle, { color: colors.foreground }]}>
                Acciones de administrador
              </Text>
              <View style={styles.adminButtons}>
                <TouchableOpacity
                  style={[styles.adminButton, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    Alert.alert('Editar evento', 'Funcionalidad de edición próximamente');
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.adminButtonText}>Editar</Text>
                </TouchableOpacity>

                {event.status !== 'finished' && (
                  <TouchableOpacity
                    style={[styles.adminButton, { backgroundColor: colors.warning }]}
                    onPress={handleCancel}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.adminButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.adminButton, { backgroundColor: colors.destructive }]}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.adminButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Mercado: Ganador */}
          <Card style={styles.marketCard}>
            <View style={styles.marketHeader}>
              <View>
                <Text style={[styles.marketTitle, { color: colors.foreground }]}>
                  Ganador
                </Text>
                <Text style={[styles.marketSubtitle, { color: colors.mutedForeground }]}>
                  ¿Quién ganará el evento?
                </Text>
              </View>
              <Badge variant="pending">PENDIENTE</Badge>
            </View>

            <Divider style={{ marginVertical: Spacing.md }} />

            <View style={styles.optionsGrid}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                  selectedOption === 'A' && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedOption('A')}
              >
                <Text style={[styles.optionText, { color: colors.foreground }]}>
                  {event.homeTeam || 'Opción A'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                  selectedOption === 'B' && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedOption('B')}
              >
                <Text style={[styles.optionText, { color: colors.foreground }]}>
                  {event.awayTeam || 'Opción B'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountsSection}>
              <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>
                Monto de apuesta (ARS)
              </Text>
              <View style={styles.chipContainer}>
                {chipAmounts.map((amount) => (
                  <Chip
                    key={amount}
                    label={`$${amount}`}
                    selected={selectedAmount === amount}
                    onPress={() => setSelectedAmount(amount)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Pozo del mercado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  $2,400
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Multiplicador estimado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.accent }]}>
                  2.5x
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Cobro estimado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.success }]}>
                  $250
                </Text>
              </View>
            </View>

            <View style={[styles.disclaimer, { backgroundColor: colors.muted }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
                Se activa con 2 apuestas. Si no se activa, se devuelve el aporte.
              </Text>
            </View>
          </Card>

          {/* Mercado: Método */}
          <Card style={styles.marketCard}>
            <View style={styles.marketHeader}>
              <View>
                <Text style={[styles.marketTitle, { color: colors.foreground }]}>
                  Método de victoria
                </Text>
                <Text style={[styles.marketSubtitle, { color: colors.mutedForeground }]}>
                  ¿Cómo terminará el evento?
                </Text>
              </View>
              <Badge variant="active">ACTIVO</Badge>
            </View>

            <Divider style={{ marginVertical: Spacing.md }} />

            <View style={styles.methodOptions}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Ionicons name="flash" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.foreground }]}>
                  KO/TKO
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Ionicons name="fitness" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.foreground }]}>
                  Sumisión
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Ionicons name="trophy" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.foreground }]}>
                  Decisión
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Pozo del mercado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  $1,800
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  eventName: {
    fontSize: 24,
    fontWeight: '900',
    flex: 1,
  },
  participants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  participant: {
    fontSize: 18,
    fontWeight: '700',
  },
  vs: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  dateText: {
    fontSize: 14,
  },
  notesCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  adminCard: {
    marginBottom: Spacing.lg,
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  adminButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  marketCard: {
    marginBottom: Spacing.lg,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  marketTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  marketSubtitle: {
    fontSize: 13,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  optionButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  optionButtonSelected: {
    // Colors applied inline
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  amountsSection: {
    marginBottom: Spacing.lg,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  infoSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  methodOptions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  methodButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default EventDetailsScreen;
