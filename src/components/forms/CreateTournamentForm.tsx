import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { Colors, Gradients, Spacing, BorderRadius } from '../../theme/colors';
import { LoadingBar } from '../LoadingBar';
import { Card, Input, SectionHeader } from '../CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { createTournament } from '../../services/tournamentService';

// ─── Constants ────────────────────────────────────────────────────────────────

const formatOptions = [
  { id: 'liga', label: 'Liga', icon: 'trophy' },
  { id: 'eliminatoria', label: 'Eliminatoria', icon: 'git-network' },
  { id: 'grupos-eliminatoria', label: 'Grupos + Eliminatoria', icon: 'grid' },
  { id: 'evento-unico', label: 'Evento único', icon: 'flash' },
  { id: 'serie', label: 'Serie (Bo3/Bo5)', icon: 'layers' },
  { id: 'otro', label: 'Otro', icon: 'ellipsis-horizontal' },
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
      Alert.alert('Error', 'El nombre del torneo es requerido');
      return;
    }
    if (!selectedFormat) {
      Alert.alert('Error', 'Debes seleccionar un formato de torneo');
      return;
    }
    const participantsNum = parseInt(participants) || 0;
    if (participantsNum <= 0) {
      Alert.alert('Error', 'Debe haber al menos 1 participante');
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      Alert.alert('Error', 'La fecha de fin debe ser igual o posterior a la fecha de inicio');
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
      Alert.alert('Error', error.message || 'No se pudo crear el torneo');
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
              Configura tu torneo privado y compite con amigos
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
                      backgroundColor: colors.secondary,
                      borderColor: selectedFormat === format.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedFormat(format.id)}
                >
                  <Ionicons
                    name={format.icon as any}
                    size={32}
                    color={selectedFormat === format.id ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.formatLabel,
                      { color: selectedFormat === format.id ? colors.foreground : colors.mutedForeground },
                    ]}
                  >
                    {format.label}
                  </Text>
                  {selectedFormat === format.id && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    </View>
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
  formatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  formatCard: {
    width: '47%', padding: Spacing.lg, borderRadius: BorderRadius.md,
    borderWidth: 2, alignItems: 'center', gap: Spacing.sm, position: 'relative',
  },
  formatLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
});
