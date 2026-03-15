import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { Colors, Gradients, Spacing, BorderRadius } from '../../theme/colors';
import { LoadingBar } from '../LoadingBar';
import { Card, Input, SectionHeader } from '../CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { createTournament } from '../../services/tournamentService';

// ─── Constants ────────────────────────────────────────────────────────────────

const formatOptions = [
  { id: 'liga', label: 'Liga', icon: 'trophy', description: 'Jornadas regulares' },
  { id: 'eliminatoria', label: 'Eliminatoria', icon: 'git-network', description: 'Rondas hasta la final' },
  { id: 'grupos-eliminatoria', label: 'Grupos + Elim.', icon: 'grid', description: 'Fase grupal y eliminatoria' },
  { id: 'evento-unico', label: 'Evento único', icon: 'flash', description: 'Un evento principal' },
  { id: 'serie', label: 'Serie (Bo3/Bo5)', icon: 'layers', description: 'Al mejor de 3 o 5' },
  { id: 'otro', label: 'Otro', icon: 'ellipsis-horizontal', description: 'Formato libre' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CreateTournamentResult {
  tournamentId: string;
  tournamentName: string;
  inviteCode: string;
}

interface CreateTournamentFormProps {
  /** Called after the tournament is successfully created (Alert OK pressed) */
  onSuccess: (result: CreateTournamentResult) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CreateTournamentForm: React.FC<CreateTournamentFormProps> = ({ onSuccess }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [participants, setParticipants] = useState('10');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);

  const handleCreate = async () => {
    if (!tournamentName.trim()) {
      showToast({ type: 'warning', message: 'El nombre del torneo es requerido' });
      return;
    }
    if (!selectedFormat) {
      showToast({ type: 'warning', message: 'Debes seleccionar un formato de torneo' });
      return;
    }
    const participantsNum = parseInt(participants) || 0;
    if (participantsNum <= 0) {
      showToast({ type: 'warning', message: 'Debe haber al menos 1 participante' });
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      showToast({ type: 'warning', message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio' });
      return;
    }
    setIsLoading(true);
    try {
      const { tournamentId, inviteCode } = await createTournament({
        name: tournamentName.trim(),
        description: description.trim(),
        format: selectedFormat,
        contribution: 0,
        participantsEstimated: participantsNum,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      // Llamar onSuccess DIRECTAMENTE — sin Alert.alert intermediario.
      // En iOS, Alert.alert usa UIAlertController (modal nativo). Si intentamos
      // abrir un React Native <Modal> dentro del onPress del Alert, iOS puede
      // descartar silenciosamente la presentación porque el Alert todavía
      // está animando su salida. Eliminando el Alert se evita ese conflicto.
      onSuccess({ tournamentId, tournamentName: tournamentName.trim(), inviteCode });
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'No se pudo crear el torneo' });
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LoadingBar isLoading={isLoading} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name="add-circle" size={32} color={colors.primary} />
              <Text style={[styles.title, { color: colors.foreground }]}>Nuevo Torneo</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Invitá a tus amigos y empezá a competir.
            </Text>
          </View>

          {/* Información Básica */}
          <Card style={styles.section}>
            <SectionHeader title="Información básica" />
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Nombre del torneo</Text>
              <Input value={tournamentName} onChangeText={setTournamentName} placeholder="Ej: Champions League 2026" />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Descripción (opcional)</Text>
              <Input value={description} onChangeText={setDescription} placeholder="Describe el torneo..." multiline />
            </View>
          </Card>

          {/* Formato */}
          <Card style={styles.section}>
            <SectionHeader title="Formato del torneo" />
            <View style={styles.formatGrid}>
              {formatOptions.map((format) => (
              <TouchableOpacity
                  key={format.id}
                  style={[
                    styles.formatCard,
                    {
                      backgroundColor: selectedFormat === format.id ? colors.primary + '12' : colors.secondary,
                      borderColor: selectedFormat === format.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedFormat(format.id)}
                >
                  <View style={[styles.formatIconBox, { backgroundColor: selectedFormat === format.id ? colors.primary + '20' : colors.muted }]}>
                    <Ionicons
                      name={format.icon as any}
                      size={20}
                      color={selectedFormat === format.id ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.formatTextBox}>
                    <Text style={[styles.formatLabel, { color: selectedFormat === format.id ? colors.foreground : colors.foreground }]}>
                      {format.label}
                    </Text>
                    <Text style={[styles.formatDescription, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {format.description}
                    </Text>
                  </View>
                  {selectedFormat === format.id && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Fechas */}
          <Card style={styles.section}>
            <SectionHeader title="Fechas" />
            <View style={styles.dateRow}>
              <View style={styles.dateColumn}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Fecha de inicio</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: colors.input, borderColor: colors.border }]}
                  onPress={() => setShowStartDateModal(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.dateText, { color: startDate ? colors.foreground : colors.mutedForeground }]}>
                    {formatDate(startDate)}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateColumn}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Fecha de fin</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: colors.input, borderColor: colors.border }]}
                  onPress={() => setShowEndDateModal(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.dateText, { color: endDate ? colors.foreground : colors.mutedForeground }]}>
                    {formatDate(endDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Participantes */}
          <Card style={styles.section}>
            <SectionHeader title="Participantes" />
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Participantes estimados</Text>
              <Input
                value={participants}
                onChangeText={setParticipants}
                placeholder="10"
                keyboardType="numeric"
              />
            </View>
          </Card>

          {/* Dynamic Summary */}
          {(!!selectedFormat || !!startDate || !!endDate) && (
            <View style={[styles.summaryBlock, { backgroundColor: colors.secondary, borderColor: colors.border, borderLeftColor: colors.primary }]}>
              <View style={styles.summaryBlockHeader}>
                <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                <Text style={[styles.summaryBlockTitle, { color: colors.foreground }]}>Resumen</Text>
              </View>
              {!!selectedFormat && (
                <View style={styles.summaryBlockItem}>
                  <Text style={[styles.summaryBlockKey, { color: colors.mutedForeground }]}>Formato</Text>
                  <Text style={[styles.summaryBlockVal, { color: colors.foreground }]}>
                    {formatOptions.find((f) => f.id === selectedFormat)?.label || selectedFormat}
                  </Text>
                </View>
              )}
              {!!startDate && !!endDate ? (
                <View style={styles.summaryBlockItem}>
                  <Text style={[styles.summaryBlockKey, { color: colors.mutedForeground }]}>Duración</Text>
                  <Text style={[styles.summaryBlockVal, { color: colors.foreground }]}>
                    {(() => {
                      const days = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
                      return `${days} ${days === 1 ? 'día' : 'días'}`;
                    })()}
                  </Text>
                </View>
              ) : !!startDate ? (
                <View style={styles.summaryBlockItem}>
                  <Text style={[styles.summaryBlockKey, { color: colors.mutedForeground }]}>Inicio</Text>
                  <Text style={[styles.summaryBlockVal, { color: colors.foreground }]}>{formatDate(startDate)}</Text>
                </View>
              ) : null}
              {!!participants && parseInt(participants) > 0 && (
                <View style={styles.summaryBlockItem}>
                  <Text style={[styles.summaryBlockKey, { color: colors.mutedForeground }]}>Participantes</Text>
                  <Text style={[styles.summaryBlockVal, { color: colors.foreground }]}>{participants}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={handleCreate}
            style={[styles.createButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.createButtonText}>Crear Torneo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Start Date Picker */}
      <Modal visible={showStartDateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Fecha de inicio</Text>
              <TouchableOpacity onPress={() => setShowStartDateModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => { setStartDate(day.dateString); setShowStartDateModal(false); }}
              markedDates={{ [startDate]: { selected: true, selectedColor: colors.primary } }}
              theme={calendarTheme}
              minDate={new Date().toISOString().split('T')[0]}
            />
          </View>
        </View>
      </Modal>

      {/* End Date Picker */}
      <Modal visible={showEndDateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Fecha de fin</Text>
              <TouchableOpacity onPress={() => setShowEndDateModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => { setEndDate(day.dateString); setShowEndDateModal(false); }}
              markedDates={{ [endDate]: { selected: true, selectedColor: colors.primary } }}
              theme={calendarTheme}
              minDate={new Date().toISOString().split('T')[0]}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default CreateTournamentForm;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: Spacing.lg },
  header: { marginBottom: Spacing.xl },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  section: { marginBottom: Spacing.lg },
  formGroup: { marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.sm },
  formatGrid: { gap: Spacing.sm },
  formatCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md, borderWidth: 1.5,
  },
  formatIconBox: { width: 36, height: 36, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  formatTextBox: { flex: 1 },
  formatLabel: { fontSize: 14, fontWeight: '700' },
  formatDescription: { fontSize: 11, marginTop: 1 },
  selectedBadge: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
  dateRow: { flexDirection: 'row', gap: Spacing.md },
  dateColumn: { flex: 1 },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  dateText: { fontSize: 14, fontWeight: '600' },
  inputWithChip: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  currencyChip: { marginTop: 0 },
  summaryCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  summaryTitle: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  summaryTotal: { paddingTop: Spacing.md, borderTopWidth: 1, marginTop: Spacing.sm },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryValueLarge: { fontSize: 20, fontWeight: '900' },
  disclaimer: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md,
    borderRadius: BorderRadius.sm, marginTop: Spacing.lg,
  },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 16 },
  createButton: {
    marginBottom: Spacing.xxl, paddingVertical: 16,
    borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center',
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  summaryBlock: { marginBottom: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderLeftWidth: 3, gap: Spacing.sm },
  summaryBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  summaryBlockTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  summaryBlockItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryBlockKey: { fontSize: 12, fontWeight: '500' },
  summaryBlockVal: { fontSize: 13, fontWeight: '700' },
  summaryBlockRow: { fontSize: 13, lineHeight: 20 },
});
