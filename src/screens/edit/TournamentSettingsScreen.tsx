import React, { useState, useEffect } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { LoadingBar } from '../../components/LoadingBar';
import { Card, Input, PrimaryButton, SectionHeader } from '../../components/CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  getTournament,
  updateTournamentBasic,
  updateTournamentConfig,
  archiveTournament,
  deleteTournamentSoft,
  Tournament,
} from '../../services/tournamentService';

const TournamentSettingsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();
  const { user } = useAuth();
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contribution, setContribution] = useState('');
  const [participantsEstimated, setParticipantsEstimated] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      setLoading(true);
      const tournamentData = await getTournament(tournamentId);
      if (tournamentData) {
        setTournament(tournamentData);
        setName(tournamentData.name);
        setDescription(tournamentData.description || '');
        setContribution(tournamentData.contribution?.toString() || '0');
        setParticipantsEstimated(tournamentData.participantsEstimated?.toString() || '0');
        setStartDate(tournamentData.startDate || '');
        setEndDate(tournamentData.endDate || '');
      }
    } catch (error) {
      console.error('Error loading tournament:', error);
      showToast({ type: 'error', message: 'No se pudo cargar el torneo' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasic = async () => {
    if (!name.trim()) {
      showToast({ type: 'warning', message: 'El nombre del torneo es requerido' });
      return;
    }

    try {
      setSaving(true);
      await updateTournamentBasic(tournamentId, {
        name: name.trim(),
        description: description.trim(),
      });
      showToast({ type: 'success', message: 'Información básica actualizada' });
      loadTournament();
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'No se pudo actualizar' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!tournament) return;
    if (['finished', 'deleted', 'archived'].includes(tournament.status)) {
      showToast({ type: 'warning', message: 'No se puede editar un torneo finalizado o archivado.' });
      return;
    }

    const contributionNum = parseInt(contribution) || 0;
    const participantsNum = parseInt(participantsEstimated) || 0;

    if (contributionNum < 0) {
      showToast({ type: 'warning', message: 'El aporte no puede ser negativo' });
      return;
    }
    if (participantsNum <= 0) {
      showToast({ type: 'warning', message: 'Debe haber al menos 1 participante' });
      return;
    }
    if (endDate && startDate) {
      const startParsed = new Date(startDate);
      const endParsed = new Date(endDate);
      if (isNaN(startParsed.getTime()) || isNaN(endParsed.getTime())) {
        showToast({ type: 'warning', message: 'Formato de fecha inválido. Usa YYYY-MM-DD.' });
        return;
      }
      if (endParsed < startParsed) {
        showToast({ type: 'warning', message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio' });
        return;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const isStartDateLocked = !!(tournament.startDate && today >= tournament.startDate);

    try {
      setSaving(true);
      await updateTournamentConfig(tournamentId, {
        contribution: contributionNum,
        participantsEstimated: participantsNum,
        endDate: endDate || undefined,
        ...(isStartDateLocked ? {} : { startDate: startDate || undefined }),
      });
      showToast({ type: 'success', message: 'Configuración actualizada' });
      loadTournament();
    } catch (error: any) {
      showToast({ type: 'error', message: error?.message || 'No se pudo actualizar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    Alert.alert(
      'Archivar torneo',
      '¿Estás seguro de que deseas archivar este torneo? No se eliminará, pero ya no aparecerá en tu lista activa.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await archiveTournament(tournamentId);
              setSaving(false);
              showToast({ type: 'success', message: 'Torneo archivado' });
              navigation.goBack();
            } catch (error: any) {
              showToast({ type: 'error', message: error?.message || 'No se pudo archivar el torneo' });
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar torneo',
      '¿Estás seguro de que deseas eliminar este torneo? Esta acción marcará el torneo como eliminado y no se podrá recuperar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deleteTournamentSoft(tournamentId);
              setSaving(false);
              showToast({ type: 'success', message: 'Torneo eliminado' });
              navigation.navigate('Main');
            } catch (error: any) {
              showToast({ type: 'error', message: error?.message || 'No se pudo eliminar el torneo' });
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando configuración...
          </Text>
        </View>
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            Torneo no encontrado
          </Text>
        </View>
      </View>
    );
  }

  const isOwner = tournament.ownerId === user?.uid;

  if (!isOwner) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            Sin permisos
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.mutedForeground }]}>
            Solo el creador puede editar este torneo
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      <LoadingBar isLoading={saving} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        <View style={styles.header}>
          <Ionicons name="settings" size={32} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Configuración del torneo
          </Text>
        </View>

        {/* Basic Info - Always editable */}
        <Card style={styles.section}>
          <SectionHeader title="Información básica (siempre editable)" />

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Nombre del torneo
            </Text>
            <Input value={name} onChangeText={setName} placeholder="Nombre" />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Descripción
            </Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción"
              multiline
            />
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              saving && { opacity: 0.5 },
            ]}
            onPress={handleSaveBasic}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>Guardar información básica</Text>
          </TouchableOpacity>
        </Card>

        {/* Config - editable by status+date rules */}
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const isFinished = ['finished', 'deleted', 'archived'].includes(tournament.status);
          const isStartDateLocked = !!(tournament.startDate && today >= tournament.startDate);
          return (
            <Card style={styles.section}>
              <View style={styles.sectionHeaderWithBadge}>
                <SectionHeader title="Configuración del torneo" />
                {isFinished && (
                  <View style={[styles.lockedBadge, { backgroundColor: colors.destructive + '20' }]}>
                    <Ionicons name="lock-closed" size={12} color={colors.destructive} />
                    <Text style={[styles.lockedBadgeText, { color: colors.destructive }]}>BLOQUEADO</Text>
                  </View>
                )}
              </View>

              {isFinished && (
                <View style={[styles.warningBox, { backgroundColor: colors.destructive + '20' }]}>
                  <Ionicons name="alert-circle" size={20} color={colors.destructive} />
                  <Text style={[styles.warningText, { color: colors.destructive }]}>
                    El torneo está finalizado o archivado. No se puede editar.
                  </Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Aporte por persona</Text>
                <Input
                  value={contribution}
                  onChangeText={(text) => { if (!isFinished) setContribution(text); }}
                  placeholder="1000"
                  keyboardType="numeric"
                  editable={!isFinished}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Participantes estimados</Text>
                <Input
                  value={participantsEstimated}
                  onChangeText={(text) => { if (!isFinished) setParticipantsEstimated(text); }}
                  placeholder="10"
                  keyboardType="numeric"
                  editable={!isFinished}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  {isStartDateLocked
                    ? 'Fecha de inicio (bloqueada — torneo ya comenzó)'
                    : 'Fecha de inicio (AAAA-MM-DD)'}
                </Text>
                <Input
                  value={startDate}
                  onChangeText={(text) => { if (!isFinished && !isStartDateLocked) setStartDate(text); }}
                  placeholder="2025-06-01"
                  editable={!isFinished && !isStartDateLocked}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Fecha de fin (AAAA-MM-DD)</Text>
                <Input
                  value={endDate}
                  onChangeText={(text) => { if (!isFinished) setEndDate(text); }}
                  placeholder="2025-12-31"
                  editable={!isFinished}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.primary },
                  (saving || isFinished) && { opacity: 0.5 },
                ]}
                onPress={handleSaveConfig}
                disabled={saving || isFinished}
              >
                <Text style={styles.saveButtonText}>Guardar configuración</Text>
              </TouchableOpacity>
            </Card>
          );
        })()}

        {/* Danger Zone */}
        <Card style={[styles.section, styles.dangerZone, { borderColor: colors.destructive }]}>
          <SectionHeader title="Zona de peligro" />

          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: colors.secondary }]}
            onPress={handleArchive}
            disabled={saving}
          >
            <Ionicons name="archive-outline" size={20} color={colors.foreground} />
            <Text style={[styles.dangerButtonText, { color: colors.foreground }]}>
              Archivar torneo
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: colors.destructive + '20' }]}
            onPress={handleDelete}
            disabled={saving}
          >
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            <Text style={[styles.dangerButtonText, { color: colors.destructive }]}>
              Eliminar torneo
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.destructive} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionHeaderWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  dangerZone: {
    borderWidth: 1,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  dangerButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default TournamentSettingsScreen;
