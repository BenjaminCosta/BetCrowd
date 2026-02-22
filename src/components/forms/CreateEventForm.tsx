import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = async (template: string) => {
    try {
      setCreating(true);
      if (!tournament) {
        Alert.alert('Error', 'Torneo no cargado');
        return;
      }
      const events = await listEvents(tournamentId);
      const nextRound = events.length + 1;

      let eventTitle = '';
      let type: 'match' | 'round' | 'custom' = 'custom';
      const format = tournament.format;

      switch (format) {
        case 'liga':
          eventTitle = `Fecha ${nextRound}`;
          type = 'round';
          break;
        case 'eliminatoria':
        case 'grupos-eliminatoria':
          eventTitle = template;
          type = 'match';
          break;
        case 'serie':
          eventTitle = `Juego ${nextRound}`;
          type = 'match';
          break;
        case 'evento-unico':
          eventTitle = template || 'Evento principal';
          type = 'match';
          break;
        default:
          eventTitle = template;
      }

      await createEvent(tournamentId, { title: eventTitle, type, startsAt: null, status: 'upcoming' });
      Alert.alert('Éxito', `Evento "${eventTitle}" creado`, [{ text: 'OK', onPress: () => onSuccess() }]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setCreating(false);
    }
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
    try {
      setCreating(true);
      const eventData = {
        title: title.trim(),
        type: 'custom' as const,
        startsAt: null,
        status: 'upcoming' as const,
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
                onPress={() => handleQuickCreate(template)}
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
                onPress={() => handleQuickCreate(template)}
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
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Equipo/Participante Local (opcional)
            </Text>
            <Input value={homeTeam} onChangeText={setHomeTeam} placeholder="Ej: River Plate" />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Equipo/Participante Visitante (opcional)
            </Text>
            <Input value={awayTeam} onChangeText={setAwayTeam} placeholder="Ej: Boca Juniors" />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Notas (opcional)</Text>
            <Input value={notes} onChangeText={setNotes} placeholder="Información adicional..." multiline />
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
});
