import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { Card, Input } from '../CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { updateBet, getBet } from '../../services/betService';
import { getEvent } from '../../services/eventService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditBetFormProps {
  tournamentId: string;
  eventId: string;
  betId: string;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EditBetForm: React.FC<EditBetFormProps> = ({ tournamentId, eventId, betId, onSuccess }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<'winner' | 'score' | 'over_under' | 'custom'>('winner');
  const [options, setOptions] = useState<string[]>(['']);
  const [stakeAmount, setStakeAmount] = useState('');
  const [line, setLine] = useState('');

  useEffect(() => {
    loadData();
  }, [tournamentId, eventId, betId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventData, betData] = await Promise.all([
        getEvent(tournamentId, eventId),
        getBet(tournamentId, eventId, betId),
      ]);
      setEvent(eventData);
      if (betData) {
        setTitle(betData.title || '');
        setDescription(betData.description || '');
        setSelectedType(betData.type || 'winner');
        setOptions(betData.options?.length ? betData.options : ['']);
        setStakeAmount(betData.stakeAmount?.toString() || '');
        setLine(betData.line?.toString() || '');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const applyWinnerTemplate = () => {
    setSelectedType('winner');
    setTitle('Ganador del partido');
    setOptions(event?.homeTeam && event?.awayTeam
      ? [event.homeTeam, 'Empate', event.awayTeam]
      : ['Local', 'Empate', 'Visitante']);
  };

  const applyOverUnderTemplate = () => {
    setSelectedType('over_under');
    setTitle('Total de goles');
    setLine('2.5');
    setOptions(['Más de 2.5', 'Menos de 2.5']);
  };

  const applyScoreTemplate = () => {
    setSelectedType('score');
    setTitle('Resultado exacto');
    setOptions(['Formato: Local X - X Visitante']);
  };

  const addOption = () => setOptions([...options, '']);
  const removeOption = (i: number) => setOptions(options.filter((_, idx) => idx !== i));
  const updateOption = (i: number, value: string) => {
    const next = [...options];
    next[i] = value;
    setOptions(next);
  };

  const handleUpdate = async () => {
    if (!title.trim()) { Alert.alert('Error', 'El título es requerido'); return; }
    const cleanOptions = options.filter((o) => o.trim() !== '');
    if (selectedType !== 'score' && cleanOptions.length < 2) {
      Alert.alert('Error', 'Debes agregar al menos 2 opciones');
      return;
    }
    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake <= 0) {
      Alert.alert('Error', 'El monto de apuesta debe ser un número mayor a 0');
      return;
    }
    try {
      setUpdating(true);
      const betData: any = {
        title: title.trim(),
        description: description.trim(),
        type: selectedType,
        options: cleanOptions,
        stakeType: 'fixed' as const,
        stakeAmount: stake,
      };
      if (selectedType === 'over_under' && line) betData.line = parseFloat(line);
      await updateBet(tournamentId, eventId, betId, betData);
      onSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la apuesta');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Editar Apuesta</Text>
        {event?.title ? (
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>{event.title}</Text>
        ) : null}
      </View>

      {/* Templates */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="flash" size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Plantillas rápidas</Text>
        </View>
        <View style={styles.templateRow}>
          {[
            { label: 'Ganador', icon: 'trophy-outline', fn: applyWinnerTemplate },
            { label: 'Más/Menos', icon: 'trending-up-outline', fn: applyOverUnderTemplate },
            { label: 'Resultado', icon: 'calculator-outline', fn: applyScoreTemplate },
          ].map(({ label, icon, fn }) => (
            <TouchableOpacity
              key={label}
              style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={fn}
            >
              <Ionicons name={icon as any} size={14} color={colors.foreground} />
              <Text style={[styles.templateChipText, { color: colors.foreground }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Form */}
      <Card style={styles.card}>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Título *</Text>
          <Input value={title} onChangeText={setTitle} placeholder="Ej: ¿Quién ganará?" />
        </View>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Descripción (opcional)</Text>
          <Input value={description} onChangeText={setDescription} placeholder="Info adicional..." multiline />
        </View>

        {/* Type selector */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Tipo *</Text>
          <View style={styles.typeGrid}>
            {[
              { value: 'winner', label: 'Ganador', icon: 'trophy-outline' },
              { value: 'over_under', label: 'Más/Menos', icon: 'trending-up-outline' },
              { value: 'score', label: 'Resultado', icon: 'calculator-outline' },
              { value: 'custom', label: 'Custom', icon: 'create-outline' },
            ].map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.typeChip,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                  selectedType === t.value && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => setSelectedType(t.value as any)}
              >
                <Ionicons
                  name={t.icon as any}
                  size={16}
                  color={selectedType === t.value ? colors.primary : colors.foreground}
                />
                <Text style={[styles.typeChipText, { color: selectedType === t.value ? colors.primary : colors.foreground }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedType === 'over_under' && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Línea</Text>
            <Input value={line} onChangeText={setLine} placeholder="2.5" keyboardType="numeric" />
          </View>
        )}

        {selectedType !== 'score' && (
          <View style={styles.formGroup}>
            <View style={styles.optionsHeader}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Opciones *</Text>
              <TouchableOpacity onPress={addOption}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {options.map((opt, i) => (
              <View key={i} style={styles.optionRow}>
                <Input
                  value={opt}
                  onChangeText={(v) => updateOption(i, v)}
                  placeholder={`Opción ${i + 1}`}
                  style={{ flex: 1 }}
                />
                {options.length > 1 && (
                  <TouchableOpacity onPress={() => removeOption(i)}>
                    <Ionicons name="close-circle" size={22} color={colors.destructive} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Monto de apuesta *</Text>
          <Input value={stakeAmount} onChangeText={setStakeAmount} placeholder="Monto en $" keyboardType="numeric" />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary, opacity: updating ? 0.6 : 1 }]}
          onPress={handleUpdate}
          disabled={updating}
        >
          {updating
            ? <ActivityIndicator size="small" color="#FFF" />
            : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.submitButtonText}>Actualizar Apuesta</Text>
              </>
            )}
        </TouchableOpacity>
      </Card>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default EditBetForm;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  pageHeader: { marginBottom: Spacing.xl },
  pageTitle: { fontSize: 24, fontWeight: '800' },
  pageSubtitle: { fontSize: 13, marginTop: 4 },
  card: { marginBottom: Spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  templateRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  templateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1 },
  templateChipText: { fontSize: 12, fontWeight: '600' },
  formGroup: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: BorderRadius.sm, borderWidth: 1 },
  typeChipText: { fontSize: 12, fontWeight: '600' },
  optionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: BorderRadius.md },
  submitButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
