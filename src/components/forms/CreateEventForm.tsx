import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, DateData } from 'react-native-calendars';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { Card, Input, SectionHeader } from '../CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { getTournament } from '../../services/tournamentService';
import {
  createEvent,
  createEventsBatch,
  listEvents,
  getEvent,
  updateEvent,
} from '../../services/eventService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateEventFormProps {
  tournamentId: string;
  eventId?: string;
  editMode?: boolean;
  /** Called after the event is successfully created or updated */
  onSuccess: () => void;
}

// ─── Event Preview Card ─────────────────────────────────────────────────────

const epStyles = StyleSheet.create({
  container: { borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.lg, overflow: 'hidden' },
  gradient: { padding: Spacing.md, paddingBottom: Spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  previewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 22, marginBottom: Spacing.sm },
  subtitle: { fontSize: 12, marginBottom: Spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm, borderWidth: 1 },
  dateText: { fontSize: 10, fontWeight: '700' },
});

interface EventPreviewCardProps {
  theme: 'light' | 'dark';
  title: string;
  homeTeam: string;
  awayTeam: string;
  eventDate: string;
}

const EventPreviewCard: React.FC<EventPreviewCardProps> = ({ theme, title, homeTeam, awayTeam, eventDate }) => {
  const colors = Colors[theme];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const statusLabel = !eventDate
    ? 'SIN FECHA'
    : eventDate === today
    ? 'HOY'
    : eventDate < today
    ? 'PASADO'
    : 'PRÓXIMO';
  const statusColor = !eventDate
    ? colors.mutedForeground
    : eventDate === today
    ? colors.success
    : eventDate < today
    ? colors.warning
    : colors.primary;

  const hasTeams = homeTeam.trim() !== '' && awayTeam.trim() !== '';

  const formatShortDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(day)).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <Animated.View
      style={[
        epStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(215, 38, 61, 0.12)', 'rgba(215, 38, 61, 0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={epStyles.gradient}
      >
        {hasTeams ? (
          <>
            {!!title && (
              <Text style={[epStyles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {title}
              </Text>
            )}
            <Text style={[epStyles.title, { color: colors.foreground }]} numberOfLines={1}>
              {homeTeam} vs {awayTeam}
            </Text>
          </>
        ) : (
          <Text
            style={[epStyles.title, { color: title ? colors.foreground : colors.mutedForeground }]}
            numberOfLines={2}
          >
            {title || 'Título del evento...'}
          </Text>
        )}
        <View style={epStyles.metaRow}>
          <View style={[epStyles.badge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[epStyles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {!!eventDate && (
            <View style={[epStyles.dateBadge, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <Ionicons name="calendar-outline" size={10} color={colors.mutedForeground} />
              <Text style={[epStyles.dateText, { color: colors.mutedForeground }]}>
                {formatShortDate(eventDate)}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const CreateEventForm: React.FC<CreateEventFormProps> = ({
  tournamentId,
  eventId,
  editMode = false,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [notes, setNotes] = useState('');
  const [bulkCount, setBulkCount] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Seleccionar fecha';
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const calendarTheme = {
    backgroundColor: colors.card,
    calendarBackground: colors.card,
    textSectionTitleColor: colors.foreground,
    selectedDayBackgroundColor: colors.primary,
    selectedDayTextColor: '#FFFFFF',
    todayTextColor: colors.primary,
    dayTextColor: colors.foreground,
    textDisabledColor: colors.mutedForeground,
    monthTextColor: colors.foreground,
    arrowColor: colors.primary,
  };

  useEffect(() => {
    if (tournamentId) loadData();
  }, [tournamentId, eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const tournamentData = await getTournament(tournamentId);
      setTournament(tournamentData);

      if (editMode && eventId) {
        const eventData = await getEvent(tournamentId, eventId);
        if (eventData) {
          setTitle(eventData.title);
          setHomeTeam(eventData.homeTeam || '');
          setAwayTeam(eventData.awayTeam || '');
          setNotes(eventData.notes || '');
          setEventDate(eventData.date || '');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTemplate = (template: string) => {
    setTitle(template);
  };

  const handleBulkCreate = async () => {
    const count = parseInt(bulkCount);
    if (!count || count < 1 || count > 20) {
      Alert.alert('Error', 'Ingresa un número entre 1 y 20');
      return;
    }
    try {
      setCreating(true);
      const events = await listEvents(tournamentId);
      const startNumber = events.length + 1;
      const format = tournament?.format ?? 'serie';

      const eventsToCreate = [];
      for (let i = 0; i < count; i++) {
        const num = startNumber + i;
        eventsToCreate.push({
          title: format === 'serie' ? `Juego ${num}` : `Fecha ${num}`,
          type: 'round' as const,
          startsAt: null,
          status: 'upcoming' as const,
        });
      }

      await createEventsBatch(tournamentId, eventsToCreate);
      Alert.alert('Éxito', `${count} eventos creados`, [{ text: 'OK', onPress: () => onSuccess() }]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCustomCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    if (!eventDate) {
      Alert.alert('Error', 'La fecha del evento es requerida');
      return;
    }
    try {
      setCreating(true);
      const eventData = {
        title: title.trim(),
        type: 'custom' as const,
        startsAt: null,
        status: 'upcoming' as const,
        date: eventDate,
        ...(homeTeam && { homeTeam: homeTeam.trim() }),
        ...(awayTeam && { awayTeam: awayTeam.trim() }),
        ...(notes && { notes: notes.trim() }),
      };

      if (editMode && eventId) {
        await updateEvent(tournamentId, eventId, eventData);
        Alert.alert('Éxito', 'Evento actualizado', [{ text: 'OK', onPress: () => onSuccess() }]);
      } else {
        await createEvent(tournamentId, eventData);
        Alert.alert('Éxito', 'Evento creado', [{ text: 'OK', onPress: () => onSuccess() }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setCreating(false);
    }
  };

  const renderTemplates = () => {
    if (!tournament || editMode) return null;

    const templates: Record<string, string[]> = {
      liga: ['Fecha 1', 'Fecha 2', 'Fecha 3'],
      eliminatoria: ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'],
      'grupos-eliminatoria': ['Grupo A - Fecha 1', 'Grupo B - Fecha 1', 'Cuartos de final', 'Semifinal', 'Final'],
      serie: ['Juego 1', 'Juego 2', 'Juego 3'],
      'evento-unico': ['Evento principal'],
    };

    const formatTemplates = templates[tournament.format] || [];
    const showBulkCreate = tournament.format === 'liga' || tournament.format === 'serie';

    if (showBulkCreate) {
      return (
        <Card style={styles.templatesCard}>
          <View style={styles.templateHeader}>
            <Ionicons name="flash" size={20} color={colors.primary} />
            <Text style={[styles.templateTitle, { color: colors.foreground }]}>Creación rápida</Text>
          </View>
          <Text style={[styles.templateHint, { color: colors.mutedForeground }]}>
            Crea múltiples {tournament.format === 'liga' ? 'fechas' : 'juegos'} simultáneamente
          </Text>
          <View style={styles.templatesGrid}>
            {formatTemplates.map((template) => (
              <TouchableOpacity
                key={template}
                style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => handleQuickTemplate(template)}
                disabled={creating}
              >
                <Text style={[styles.templateChipText, { color: colors.foreground }]}>{template}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.bulkSection}>
            <View style={styles.bulkHeader}>
              <Ionicons name="layers-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.bulkLabel, { color: colors.mutedForeground }]}>O crea varias a la vez</Text>
            </View>
            <View style={styles.bulkRow}>
              <Input
                value={bulkCount}
                onChangeText={setBulkCount}
                placeholder="Cantidad (1-20)"
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={[styles.bulkButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={handleBulkCreate}
                disabled={creating}
              >
                <Text style={[styles.bulkButtonText, { color: colors.foreground }]}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      );
    }

    if (formatTemplates.length > 0) {
      return (
        <Card style={styles.templatesCard}>
          <View style={styles.templateHeader}>
            <Ionicons name="flash" size={20} color={colors.primary} />
            <Text style={[styles.templateTitle, { color: colors.foreground }]}>Plantillas rápidas</Text>
          </View>
          <Text style={[styles.templateHint, { color: colors.mutedForeground }]}>
            Selecciona una plantilla para crear el evento instantáneamente
          </Text>
          <View style={styles.templatesGrid}>
            {formatTemplates.map((template) => (
              <TouchableOpacity
                key={template}
                style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => handleQuickTemplate(template)}
                disabled={creating}
              >
                <Text style={[styles.templateChipText, { color: colors.foreground }]}>{template}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.stickyPreview, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <EventPreviewCard
          theme={theme}
          title={title}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          eventDate={eventDate}
        />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {editMode ? 'Editar Evento' : 'Crear Evento'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {tournament?.name || 'Torneo'}
          </Text>
        </View>

        {renderTemplates()}

        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <Ionicons name="create-outline" size={20} color={colors.foreground} />
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editMode ? 'Detalles del evento' : 'Evento personalizado'}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Título del evento *</Text>
            <Input value={title} onChangeText={setTitle} placeholder="Ej: River vs Boca" />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Equipos (opcional)</Text>
            <View style={styles.teamsRow}>
              <View style={{ flex: 1 }}>
                <Input value={homeTeam} onChangeText={setHomeTeam} placeholder="Local" />
              </View>
              <View style={[styles.vsContainer, { backgroundColor: colors.muted }]}>
                <Text style={[styles.vsText, { color: colors.mutedForeground }]}>VS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Input value={awayTeam} onChangeText={setAwayTeam} placeholder="Visitante" />
              </View>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Notas (opcional)</Text>
            <Input value={notes} onChangeText={setNotes} placeholder="Información adicional..." multiline />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Fecha del evento *</Text>
            <View style={styles.dateChipsRow}>
              {[
                { label: 'Hoy', offset: 0 },
                { label: 'Mañana', offset: 1 },
                { label: '+2 días', offset: 2 },
              ].map(({ label, offset }) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const val = `${d.getFullYear()}-${mm}-${dd}`;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.dateChip,
                      {
                        backgroundColor: eventDate === val ? colors.primary + '20' : colors.secondary,
                        borderColor: eventDate === val ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setEventDate(val)}
                  >
                    <Text style={[styles.dateChipText, { color: eventDate === val ? colors.primary : colors.mutedForeground }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[
                styles.dateButton,
                {
                  backgroundColor: colors.secondary,
                  borderColor: eventDate ? colors.primary : colors.border,
                  borderWidth: eventDate ? 1.5 : 1,
                },
              ]}
              onPress={() => setShowDateModal(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={eventDate ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.dateText, { color: eventDate ? colors.foreground : colors.mutedForeground }]}>
                {formatDate(eventDate)}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={handleCustomCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name={editMode ? 'checkmark-circle' : 'add-circle'} size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>{editMode ? 'Guardar Cambios' : 'Crear Evento'}</Text>
              </>
            )}
          </TouchableOpacity>
        </Card>
      </View>
    </ScrollView>
    <Modal visible={showDateModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Fecha del evento</Text>
            <TouchableOpacity onPress={() => setShowDateModal(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Calendar
            onDayPress={(day: DateData) => { setEventDate(day.dateString); setShowDateModal(false); }}
            markedDates={{ [eventDate]: { selected: true, selectedColor: colors.primary } }}
            minDate={new Date().toISOString().split('T')[0]}
            theme={calendarTheme}
          />
        </View>
      </View>
    </Modal>
  </KeyboardAvoidingView>
  );
};

export default CreateEventForm;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.lg },
  header: { marginBottom: Spacing.xl },
  title: { fontSize: 28, fontWeight: '900', marginBottom: Spacing.xs },
  subtitle: { fontSize: 15, lineHeight: 22 },
  templatesCard: { marginBottom: Spacing.lg },
  templateHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  templateTitle: { fontSize: 16, fontWeight: '700' },
  templateHint: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  templatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  templateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1 },
  templateChipText: { fontSize: 13, fontWeight: '600' },
  bulkSection: { marginTop: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  bulkHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  bulkLabel: { fontSize: 13, fontWeight: '600' },
  bulkRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  bulkButton: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1 },
  bulkButtonText: { fontSize: 14, fontWeight: '700' },
  formCard: { marginBottom: Spacing.xl },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  formTitle: { fontSize: 16, fontWeight: '700' },
  formGroup: { marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.sm },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderRadius: 12,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  dateText: { fontSize: 14, fontWeight: '600' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  vsContainer: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 13, fontWeight: '900' },
  dateChipsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  dateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.sm, borderWidth: 1 },
  dateChipText: { fontSize: 13, fontWeight: '600' },
  stickyPreview: { borderBottomWidth: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '700' },
});
