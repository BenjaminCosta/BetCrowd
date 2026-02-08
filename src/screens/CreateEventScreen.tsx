import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Input, SectionHeader } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { getTournament } from '../services/tournamentService';
import { createEvent, createEventsBatch, listEvents } from '../services/eventService';

const CreateEventScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [notes, setNotes] = useState('');
  
  // For bulk creation
  const [bulkCount, setBulkCount] = useState('');

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      setLoading(true);
      const tournamentData = await getTournament(tournamentId);
      setTournament(tournamentData);
    } catch (error) {
      console.error('Error loading tournament:', error);
      Alert.alert('Error', 'No se pudo cargar el torneo');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = async (template: string) => {
    try {
      setCreating(true);
      const events = await listEvents(tournamentId);
      const nextRound = events.length + 1;

      let eventTitle = '';
      let type: 'match' | 'round' | 'custom' = 'custom';
      
      switch (tournament.format) {
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

      await createEvent(tournamentId, {
        title: eventTitle,
        type,
        startsAt: null,
        status: 'upcoming',
      });

      Alert.alert('Éxito', `Evento "${eventTitle}" creado`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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

      const eventsToCreate = [];
      for (let i = 0; i < count; i++) {
        const num = startNumber + i;
        eventsToCreate.push({
          title: tournament.format === 'serie' ? `Juego ${num}` : `Fecha ${num}`,
          type: 'round' as const,
          startsAt: null,
          status: 'upcoming' as const,
        });
      }

      await createEventsBatch(tournamentId, eventsToCreate);
      Alert.alert('Éxito', `${count} eventos creados`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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
      await createEvent(tournamentId, {
        title: title.trim(),
        type: 'custom',
        startsAt: null,
        status: 'upcoming',
        ...(homeTeam && { homeTeam: homeTeam.trim() }),
        ...(awayTeam && { awayTeam: awayTeam.trim() }),
        ...(notes && { notes: notes.trim() }),
      });

      Alert.alert('Éxito', 'Evento creado', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setCreating(false);
    }
  };

  const renderTemplates = () => {
    if (!tournament) return null;

    const templates: Record<string, string[]> = {
      liga: [],
      eliminatoria: ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'],
      'grupos-eliminatoria': ['Fase de grupos - Fecha 1', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'],
      serie: [],
      'evento-unico': ['Evento principal'],
    };

    const formatTemplates = templates[tournament.format] || [];
    
    if (formatTemplates.length === 0 && (tournament.format === 'liga' || tournament.format === 'serie')) {
      return (
        <Card style={styles.templatesCard}>
          <SectionHeader title="Creación rápida" />
          <Text style={[styles.templateHint, { color: colors.mutedForeground }]}>
            Crea múltiples {tournament.format === 'liga' ? 'fechas' : 'juegos'} a la vez
          </Text>
          <View style={styles.bulkRow}>
            <Input
              value={bulkCount}
              onChangeText={setBulkCount}
              placeholder="Cantidad (1-20)"
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              style={[styles.bulkButton, { backgroundColor: colors.primary }]}
              onPress={handleBulkCreate}
              disabled={creating}
            >
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text style={styles.bulkButtonText}>Crear</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }

    if (formatTemplates.length > 0) {
      return (
        <Card style={styles.templatesCard}>
          <SectionHeader title="Plantillas rápidas" />
          <Text style={[styles.templateHint, { color: colors.mutedForeground }]}>
            Crea eventos con un toque
          </Text>
          <View style={styles.templatesGrid}>
            {formatTemplates.map((template) => (
              <TouchableOpacity
                key={template}
                style={[styles.templateChip, { backgroundColor: colors.secondary }]}
                onPress={() => handleQuickCreate(template)}
                disabled={creating}
              >
                <Text style={[styles.templateChipText, { color: colors.foreground }]}>
                  {template}
                </Text>
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Crear Evento
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {tournament?.name || 'Torneo'}
            </Text>
          </View>

          {renderTemplates()}

          <Card style={styles.formCard}>
            <SectionHeader title="Evento personalizado" />
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Título del evento *
              </Text>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Ej: River vs Boca"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Equipo/Participante Local (opcional)
              </Text>
              <Input
                value={homeTeam}
                onChangeText={setHomeTeam}
                placeholder="Ej: River Plate"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Equipo/Participante Visitante (opcional)
              </Text>
              <Input
                value={awayTeam}
                onChangeText={setAwayTeam}
                placeholder="Ej: Boca Juniors"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Notas (opcional)
              </Text>
              <Input
                value={notes}
                onChangeText={setNotes}
                placeholder="Información adicional..."
                multiline
              />
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
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Crear Evento</Text>
                </>
              )}
            </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  templatesCard: {
    marginBottom: Spacing.lg,
  },
  templateHint: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  templateChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bulkRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bulkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    marginBottom: Spacing.xl,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CreateEventScreen;
