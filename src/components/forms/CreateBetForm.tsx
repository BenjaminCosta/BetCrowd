import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { Card, Input } from '../CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { createBet } from '../../services/betService';
import { getTournament } from '../../services/tournamentService';
import { getEvent } from '../../services/eventService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateBetFormProps {
  tournamentId: string;
  eventId: string;
  /** Called after the bet is successfully created */
  onSuccess: () => void;
}

// ─── Quick Amounts & Live Preview ───────────────────────────────────────────

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

const previewCardStyles = StyleSheet.create({
  container: { borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.lg, overflow: 'hidden' },
  gradient: { padding: Spacing.md, paddingBottom: Spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  previewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 22, marginBottom: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  typeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  amountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm, borderWidth: 1 },
  amountText: { fontSize: 10, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.md },
  optionsRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  optionPill: { borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontWeight: '600', textAlign: 'center' },
});

interface BetPreviewCardProps {
  theme: 'light' | 'dark';
  title: string;
  type: string;
  options: string[];
  amount: string;
}

const BetPreviewCard: React.FC<BetPreviewCardProps> = ({ theme, title, type, options, amount }) => {
  const colors = Colors[theme];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const cleanOpts = options.filter((o) => o.trim() !== '');
  const useColumns = cleanOpts.length >= 4;
  const optFontSize = cleanOpts.length >= 6 ? 10 : cleanOpts.length >= 4 ? 12 : 13;
  const optPadding = cleanOpts.length >= 4 ? 6 : 9;
  const typeLabels: Record<string, string> = {
    winner: 'GANADOR',
    over_under: 'MÁS/MENOS',
    score: 'RESULTADO',
    custom: 'CUSTOM',
  };

  return (
    <Animated.View
      style={[
        previewCardStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(215, 38, 61, 0.14)', 'rgba(215, 38, 61, 0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={previewCardStyles.gradient}
      >
        <Text
          style={[previewCardStyles.title, { color: title ? colors.foreground : colors.mutedForeground }]}
          numberOfLines={2}
        >
          {title || 'Título de la apuesta...'}
        </Text>
        <View style={previewCardStyles.metaRow}>
          <View style={[previewCardStyles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[previewCardStyles.typeBadgeText, { color: colors.primary }]}>
              {typeLabels[type] || type.toUpperCase()}
            </Text>
          </View>
          {!!amount && parseFloat(amount) > 0 && (
            <View style={[previewCardStyles.amountBadge, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <Ionicons name="cash-outline" size={10} color={colors.mutedForeground} />
              <Text style={[previewCardStyles.amountText, { color: colors.mutedForeground }]}>
                ${parseFloat(amount).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
      {cleanOpts.length > 0 && (
        <>
          <View style={[previewCardStyles.divider, { backgroundColor: colors.border }]} />
          <View style={useColumns ? previewCardStyles.optionsGrid : previewCardStyles.optionsRow}>
            {cleanOpts.map((opt, i) => (
              <View
                key={i}
                style={[
                  previewCardStyles.optionPill,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    paddingHorizontal: optPadding,
                    paddingVertical: optPadding - 2,
                    flex: useColumns ? undefined : 1,
                    width: useColumns ? '48%' : undefined,
                  },
                ]}
              >
                <Text
                  style={[previewCardStyles.optionText, { color: colors.mutedForeground, fontSize: optFontSize }]}
                  numberOfLines={1}
                >
                  {opt}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const CreateBetForm: React.FC<CreateBetFormProps> = ({ tournamentId, eventId, onSuccess }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();

  const [tournament, setTournament] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<'winner' | 'score' | 'over_under' | 'custom'>('winner');
  const [options, setOptions] = useState<string[]>(['']);
  const [stakeAmount, setStakeAmount] = useState('');
  const [line, setLine] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadData();
  }, [tournamentId, eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentData, eventData] = await Promise.all([
        getTournament(tournamentId),
        getEvent(tournamentId, eventId),
      ]);
      setTournament(tournamentData);
      setEvent(eventData);
    } catch (error) {
      showToast({ type: 'error', message: 'No se pudo cargar los datos' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Event blocked check ─────────────────────────────────────────────────
  const isEventBlocked = (): boolean => {
    if (!event) return false;
    if (event.status === 'finished' || event.status === 'cancelled' || event.status === 'locked') return true;
    if (event.date) {
      const today = new Date().toISOString().split('T')[0];
      if (event.date < today) return true;
    }
    return false;
  };

  const applyWinnerTemplate = () => {
    setSelectedType('winner');
    setTitle('Ganador del partido');
    if (event?.homeTeam && event?.awayTeam) {
      setOptions([event.homeTeam, 'Empate', event.awayTeam]);
    } else {
      setOptions(['Local', 'Empate', 'Visitante']);
    }
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 400, animated: true }), 150);
  };

  const applyOverUnderTemplate = () => {
    setSelectedType('over_under');
    setTitle('Total de goles');
    setLine('2.5');
    setOptions(['Más de 2.5', 'Menos de 2.5']);
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 400, animated: true }), 150);
  };

  const applyScoreTemplate = () => {
    setSelectedType('score');
    setTitle('Resultado exacto');
    setOptions(['1-0', '2-0', '2-1', '1-1', '0-0', 'Otro']);
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 400, animated: true }), 150);
  };

  const handleTypeSelect = (type: 'winner' | 'score' | 'over_under' | 'custom') => {
    setSelectedType(type);
    if (type === 'score' && options.every((o) => o.trim() === '')) {
      setTitle((prev) => prev || 'Resultado exacto');
      setOptions(['1-0', '2-0', '2-1', '1-1', '0-0', 'Otro']);
    }
  };

  const addOption = () => setOptions([...options, '']);
  const removeOption = (index: number) => setOptions(options.filter((_, i) => i !== index));
  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    if (isEventBlocked()) {
      showToast({ type: 'warning', message: 'No se pueden crear apuestas en eventos finalizados.' });
      return;
    }
    if (!title.trim()) {
      showToast({ type: 'warning', message: 'El título es requerido' });
      return;
    }
    const cleanOptions = options.filter((opt) => opt.trim() !== '');
    if (selectedType !== 'score' && cleanOptions.length < 2) {
      showToast({ type: 'warning', message: 'Debes agregar al menos 2 opciones' });
      return;
    }
    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake < 0) {
      showToast({ type: 'warning', message: 'El monto de apuesta debe ser un número válido' });
      return;
    }
    try {
      setCreating(true);
      const betData: any = {
        title: title.trim(),
        description: description.trim(),
        type: selectedType,
        options: cleanOptions,
        stakeType: 'fixed' as const,
        stakeAmount: stake,
      };
      if (selectedType === 'over_under' && line) {
        betData.line = parseFloat(line);
      }
      await createBet(tournamentId, eventId, betData);
      showToast({ type: 'success', message: 'Apuesta creada' });
      onSuccess();
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'No se pudo crear la apuesta' });
    } finally {
      setCreating(false);
    }
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
      {/* Sticky live preview — stays pinned while user scrolls the form */}
      <View style={[styles.stickyPreviewContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.stickyPreviewInner}>
          <BetPreviewCard
            theme={theme}
            title={title}
            type={selectedType}
            options={options}
            amount={stakeAmount}
          />
        </View>
      </View>
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: Spacing.xl }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Crear Apuesta</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{event?.title || 'Evento'}</Text>
        </View>

        {/* Blocked banner */}
        {isEventBlocked() && (
          <View style={[styles.blockedBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.blockedText, { color: colors.mutedForeground }]}>
              No se pueden crear apuestas en eventos finalizados.
            </Text>
          </View>
        )}

        {/* Templates */}
        <Card style={styles.templatesCard}>
          <View style={styles.templateHeader}>
            <Ionicons name="flash" size={20} color={colors.primary} />
            <Text style={[styles.templateTitle, { color: colors.foreground }]}>Plantillas rápidas</Text>
          </View>
          <Text style={[styles.templateHint, { color: colors.mutedForeground }]}>
            Usa una plantilla para crear la apuesta más rápido
          </Text>
          <View style={styles.templatesGrid}>
            <TouchableOpacity
              style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={applyWinnerTemplate}
            >
              <Ionicons name="trophy-outline" size={16} color={colors.foreground} />
              <Text style={[styles.templateChipText, { color: colors.foreground }]}>Ganador</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={applyOverUnderTemplate}
            >
              <Ionicons name="trending-up-outline" size={16} color={colors.foreground} />
              <Text style={[styles.templateChipText, { color: colors.foreground }]}>Más/Menos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={applyScoreTemplate}
            >
              <Ionicons name="calculator-outline" size={16} color={colors.foreground} />
              <Text style={[styles.templateChipText, { color: colors.foreground }]}>Resultado exacto</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Form */}
        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <Ionicons name="create-outline" size={20} color={colors.foreground} />
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Detalles de la apuesta</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Título *</Text>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: ¿Quién ganará el partido?"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Descripción (opcional)</Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Información adicional..."
              multiline
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Tipo de apuesta *</Text>
            <View style={styles.typeGrid}>
              {[
                { value: 'winner', label: 'Ganador', icon: 'trophy-outline' },
                { value: 'over_under', label: 'Más/Menos', icon: 'trending-up-outline' },
                { value: 'score', label: 'Resultado exacto', icon: 'calculator-outline' },
                { value: 'custom', label: 'Personalizada', icon: 'create-outline' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeChip,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                    selectedType === type.value && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + '10',
                    },
                  ]}
                  onPress={() => handleTypeSelect(type.value as any)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={18}
                    color={selectedType === type.value ? colors.primary : colors.foreground}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: selectedType === type.value ? colors.primary : colors.foreground },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedType === 'over_under' && (
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Línea (número)</Text>
              <Input value={line} onChangeText={setLine} placeholder="Ej: 2.5" keyboardType="numeric" />
            </View>
          )}

          <View style={styles.formGroup}>
            <View style={styles.optionsHeader}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Opciones *</Text>
              <TouchableOpacity onPress={addOption}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <Input
                  value={option}
                  onChangeText={(value) => updateOption(index, value)}
                  placeholder={`Opción ${index + 1}`}
                  style={{ flex: 1 }}
                />
                {options.length > 1 && (
                  <TouchableOpacity onPress={() => removeOption(index)}>
                    <Ionicons name="close-circle" size={24} color={colors.destructive} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <View style={[styles.stakeGroup, { backgroundColor: colors.secondary, borderColor: colors.primary + '40' }]}>
            <View style={styles.stakeLabelRow}>
              <Ionicons name="cash" size={16} color={colors.primary} />
              <Text style={[styles.stakeLabel, { color: colors.foreground }]}>Monto de apuesta *</Text>
            </View>
            <Text style={[styles.stakeHint, { color: colors.mutedForeground }]}>
              Monto fijo por participante para esta apuesta
            </Text>
            <Input
              value={stakeAmount}
              onChangeText={setStakeAmount}
              placeholder="Ej: 500"
              keyboardType="numeric"
            />
            <View style={styles.quickAmountsRow}>
              {QUICK_AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.quickAmountChip,
                    {
                      backgroundColor: stakeAmount === String(amt) ? colors.primary + '20' : colors.muted,
                      borderColor: stakeAmount === String(amt) ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setStakeAmount(String(amt))}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      { color: stakeAmount === String(amt) ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    ${amt.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.createButton,
              { backgroundColor: isEventBlocked() ? colors.secondary : colors.primary },
              (creating || isEventBlocked()) && { opacity: 0.6 },
            ]}
            onPress={handleCreate}
            disabled={creating || isEventBlocked()}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Crear Apuesta</Text>
              </>
            )}
          </TouchableOpacity>
        </Card>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default CreateBetForm;

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
  templatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  templateChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  templateChipText: { fontSize: 13, fontWeight: '600' },
  formCard: { marginBottom: Spacing.xl },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  formTitle: { fontSize: 16, fontWeight: '700' },
  formGroup: { marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.sm },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: BorderRadius.md, borderWidth: 1.5,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  optionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.md,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  stakeGroup: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  stakeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  stakeLabel: { fontSize: 14, fontWeight: '700' },
  stakeHint: { fontSize: 12, lineHeight: 16, marginBottom: Spacing.sm },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  blockedText: { flex: 1, fontSize: 13, lineHeight: 18 },
  stickyPreviewContainer: { borderBottomWidth: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  stickyPreviewInner: { marginBottom: 0 },
  quickAmountsRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs, flexWrap: 'wrap' },
  quickAmountChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1 },
  quickAmountText: { fontSize: 12, fontWeight: '700' },
});
