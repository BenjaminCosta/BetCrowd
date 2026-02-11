import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Input } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { updateBet, getBet } from '../services/betService';
import { getTournament } from '../services/tournamentService';
import { getEvent } from '../services/eventService';

const EditBetScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { tournamentId, eventId, betId } = route.params || {};

  const [tournament, setTournament] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<'winner' | 'score' | 'over_under' | 'custom'>('winner');
  const [options, setOptions] = useState<string[]>(['']);
  const [stakeAmount, setStakeAmount] = useState('');
  const [line, setLine] = useState(''); // for over_under

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tournamentData, eventData, betData] = await Promise.all([
        getTournament(tournamentId),
        getEvent(tournamentId, eventId),
        getBet(tournamentId, eventId, betId),
      ]);
      
      setTournament(tournamentData);
      setEvent(eventData);
      
      // Load existing bet data into form
      if (betData) {
        setTitle(betData.title || '');
        setDescription(betData.description || '');
        setSelectedType(betData.type || 'winner');
        setOptions(betData.options || ['']);
        setStakeAmount(betData.stakeAmount?.toString() || '');
        setLine(betData.line?.toString() || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const applyWinnerTemplate = () => {
    setSelectedType('winner');
    setTitle('Ganador del partido');
    
    if (event?.homeTeam && event?.awayTeam) {
      setOptions([event.homeTeam, 'Empate', event.awayTeam]);
    } else {
      setOptions(['Local', 'Empate', 'Visitante']);
    }
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

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleUpdate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }

    const cleanOptions = options.filter((opt) => opt.trim() !== '');
    if (selectedType !== 'score' && cleanOptions.length < 2) {
      Alert.alert('Error', 'Debes agregar al menos 2 opciones');
      return;
    }

    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake < 0) {
      Alert.alert('Error', 'El monto de apuesta debe ser un número válido');
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

      if (selectedType === 'over_under' && line) {
        betData.line = parseFloat(line);
      }

      await updateBet(tournamentId, eventId, betId, betData);

      Alert.alert('Éxito', 'Apuesta actualizada', [
        { 
          text: 'OK', 
          onPress: () => navigation.goBack()
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la apuesta');
    } finally {
      setUpdating(false);
    }
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
              Editar Apuesta
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {event?.title || 'Evento'}
            </Text>
          </View>

          {/* Templates */}
          <Card style={styles.templatesCard}>
            <View style={styles.templateHeader}>
              <Ionicons name="flash" size={20} color={colors.accent} />
              <Text style={[styles.templateTitle, { color: colors.foreground }]}>
                Plantillas rápidas
              </Text>
            </View>
            <Text style={[styles.templateHint, { color: colors.mutedForeground }]}>
              Usa una plantilla para editar la apuesta más rápido
            </Text>

            <View style={styles.templatesGrid}>
              <TouchableOpacity
                style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={applyWinnerTemplate}
              >
                <Ionicons name="trophy-outline" size={16} color={colors.foreground} />
                <Text style={[styles.templateChipText, { color: colors.foreground }]}>
                  Ganador
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={applyOverUnderTemplate}
              >
                <Ionicons name="trending-up-outline" size={16} color={colors.foreground} />
                <Text style={[styles.templateChipText, { color: colors.foreground }]}>
                  Más/Menos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={applyScoreTemplate}
              >
                <Ionicons name="calculator-outline" size={16} color={colors.foreground} />
                <Text style={[styles.templateChipText, { color: colors.foreground }]}>
                  Resultado
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Form */}
          <Card style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="create-outline" size={20} color={colors.foreground} />
              <Text style={[styles.formTitle, { color: colors.foreground }]}>
                Detalles de la apuesta
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Título *
              </Text>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Ej: ¿Quién ganará el partido?"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Descripción (opcional)
              </Text>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Información adicional..."
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Tipo de apuesta *
              </Text>
              <View style={styles.typeGrid}>
                {[
                  { value: 'winner', label: 'Ganador', icon: 'trophy-outline' },
                  { value: 'over_under', label: 'Más/Menos', icon: 'trending-up-outline' },
                  { value: 'score', label: 'Resultado', icon: 'calculator-outline' },
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
                    onPress={() => setSelectedType(type.value as any)}
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
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Línea (número)
                </Text>
                <Input
                  value={line}
                  onChangeText={setLine}
                  placeholder="Ej: 2.5"
                  keyboardType="numeric"
                />
              </View>
            )}

            {selectedType !== 'score' && (
              <View style={styles.formGroup}>
                <View style={styles.optionsHeader}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    Opciones *
                  </Text>
                  <TouchableOpacity onPress={addOption}>
                    <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
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
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Monto de apuesta *
              </Text>
              <Input
                value={stakeAmount}
                onChangeText={setStakeAmount}
                placeholder="Monto en $"
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: colors.primary }]}
              onPress={handleUpdate}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.updateButtonText}>Actualizar Apuesta</Text>
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
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  templateHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  templateChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: {
    marginBottom: Spacing.xl,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default EditBetScreen;
