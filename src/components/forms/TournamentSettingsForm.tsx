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
import { Card, Input, SectionHeader } from '../CommonComponents';
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface TournamentSettingsFormProps {
  tournamentId: string;
  /** Called after a successful save (keep sheet open) */
  onSuccess?: () => void;
  /** Called after archive succeeds (parent should close sheet + reload) */
  onArchived?: () => void;
  /** Called after delete succeeds (parent should close sheet + navigate away) */
  onDeleted?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const TournamentSettingsForm: React.FC<TournamentSettingsFormProps> = ({
  tournamentId,
  onSuccess,
  onArchived,
  onDeleted,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [participantsEstimated, setParticipantsEstimated] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadTournament();
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      setLoading(true);
      const data = await getTournament(tournamentId);
      if (data) {
        setTournament(data);
        setName(data.name);
        setDescription(data.description || '');
        setParticipantsEstimated(data.participantsEstimated?.toString() || '0');
        setStartDate(data.startDate || '');
        setEndDate(data.endDate || '');
      }
    } catch (e) {
      showToast({ type: 'error', message: 'No se pudo cargar el torneo' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasic = async () => {
    if (!name.trim()) { showToast({ type: 'warning', message: 'El nombre es requerido' }); return; }
    try {
      setSaving(true);
      await updateTournamentBasic(tournamentId, { name: name.trim(), description: description.trim() });
      showToast({ type: 'success', message: 'Información actualizada' });
      loadTournament();
      onSuccess?.();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'No se pudo actualizar' });
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
    const participantsNum = parseInt(participantsEstimated) || 0;
    if (participantsNum <= 0) { showToast({ type: 'warning', message: 'Debe haber al menos 1 participante' }); return; }
    if (endDate && startDate && endDate < startDate) {
      showToast({ type: 'warning', message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio' });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const isStartDateLocked = !!(tournament.startDate && today >= tournament.startDate);
    try {
      setSaving(true);
      await updateTournamentConfig(tournamentId, {
        participantsEstimated: participantsNum,
        endDate: endDate || undefined,
        ...(isStartDateLocked ? {} : { startDate: startDate || undefined }),
      });
      showToast({ type: 'success', message: 'Configuración actualizada' });
      loadTournament();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    Alert.alert(
      'Archivar torneo',
      '¿Estás seguro de que deseas archivar este torneo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar', style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await archiveTournament(tournamentId);
              showToast({ type: 'success', message: 'Torneo archivado' });
              onArchived?.();
            } catch (e: any) {
              showToast({ type: 'error', message: e.message });
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
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deleteTournamentSoft(tournamentId);
              showToast({ type: 'success', message: 'Torneo eliminado' });
              onDeleted?.();
            } catch (e: any) {
              showToast({ type: 'error', message: e.message });
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.foreground }]}>Torneo no encontrado</Text>
      </View>
    );
  }

  if (tournament.ownerId !== user?.uid) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.foreground }]}>Solo el creador puede editar</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeader}>
        <Ionicons name="settings" size={26} color={colors.primary} />
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Configuración del torneo</Text>
      </View>

      {/* Basic info */}
      <Card style={styles.section}>
        <SectionHeader title="Información básica (siempre editable)" />
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Nombre del torneo</Text>
          <Input value={name} onChangeText={setName} placeholder="Nombre" />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Descripción</Text>
          <Input value={description} onChangeText={setDescription} placeholder="Descripción" multiline />
        </View>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}
          onPress={handleSaveBasic}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>Guardar información básica</Text>
        </TouchableOpacity>
      </Card>

      {/* Config */}
      {
        (() => {
          const today = new Date().toISOString().split('T')[0];
          const isFinished = ['finished', 'deleted', 'archived'].includes(tournament.status);
          const isStartDateLocked = !!(tournament.startDate && today >= tournament.startDate);
          return (
            <Card style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <SectionHeader title="Configuración del torneo" />
                {isFinished && (
                  <View style={[styles.lockedBadge, { backgroundColor: colors.destructive + '20' }]}>
                    <Ionicons name="lock-closed" size={11} color={colors.destructive} />
                    <Text style={[styles.lockedText, { color: colors.destructive }]}>BLOQUEADO</Text>
                  </View>
                )}
              </View>
              {isFinished && (
                <View style={[styles.warningBox, { backgroundColor: colors.destructive + '15' }]}>
                  <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                  <Text style={[styles.warningText, { color: colors.destructive }]}>
                    El torneo está finalizado o archivado. No se puede editar.
                  </Text>
                </View>
              )}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Participantes estimados</Text>
                <Input
                  value={participantsEstimated}
                  onChangeText={(t) => { if (!isFinished) setParticipantsEstimated(t); }}
                  placeholder="10"
                  keyboardType="numeric"
                  editable={!isFinished}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Fecha de inicio{isStartDateLocked ? ' (bloqueada — torneo ya comenzó)' : ' (AAAA-MM-DD)'}
                </Text>
                <Input
                  value={startDate}
                  onChangeText={(t) => { if (!isFinished && !isStartDateLocked) setStartDate(t); }}
                  placeholder="2025-06-01"
                  editable={!isFinished && !isStartDateLocked}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Fecha de fin (AAAA-MM-DD)</Text>
                <Input
                  value={endDate}
                  onChangeText={(t) => { if (!isFinished) setEndDate(t); }}
                  placeholder="2025-12-31"
                  editable={!isFinished}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.primary, opacity: (saving || isFinished) ? 0.5 : 1 },
                ]}
                onPress={handleSaveConfig}
                disabled={saving || isFinished}
              >
                <Text style={styles.saveButtonText}>Guardar configuración</Text>
              </TouchableOpacity>
            </Card>
          );
        })()
      }

      {/* Danger zone */}
      <Card style={[styles.section, styles.dangerZone, { borderColor: colors.destructive }]}>
        <SectionHeader title="Zona de peligro" />
        <TouchableOpacity
          style={[styles.dangerRow, { backgroundColor: colors.secondary }]}
          onPress={handleArchive}
          disabled={saving}
        >
          <Ionicons name="archive-outline" size={18} color={colors.foreground} />
          <Text style={[styles.dangerText, { color: colors.foreground }]}>Archivar torneo</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dangerRow, { backgroundColor: colors.destructive + '20' }]}
          onPress={handleDelete}
          disabled={saving}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
          <Text style={[styles.dangerText, { color: colors.destructive }]}>Eliminar torneo</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.destructive} />
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
};

export default TournamentSettingsForm;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.xl },
  pageTitle: { fontSize: 22, fontWeight: '700' },
  section: { marginBottom: Spacing.xl },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lockedText: { fontSize: 10, fontWeight: '700' },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, marginBottom: Spacing.md },
  warningText: { flex: 1, fontSize: 12, lineHeight: 16 },
  formGroup: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  saveButton: { padding: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
  saveButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  dangerZone: { borderWidth: 1 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  dangerText: { flex: 1, fontSize: 15, fontWeight: '600' },
});
