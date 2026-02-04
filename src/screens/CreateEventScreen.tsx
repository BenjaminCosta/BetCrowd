import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Input, PrimaryButton, SectionHeader } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';

const CreateEventScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const [eventName, setEventName] = useState('');
  const [participantA, setParticipantA] = useState('');
  const [participantB, setParticipantB] = useState('');

  const handleCreateEvent = () => {
    // Solo UI - navegar de vuelta
    navigation.goBack();
  };

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
              Configura los participantes del evento único
            </Text>
          </View>

          <Card style={styles.formCard}>
            <SectionHeader title="Detalles del evento" />
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Nombre del evento
              </Text>
              <Input
                value={eventName}
                onChangeText={setEventName}
                placeholder="Ej: Pelea estelar UFC 300"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Participante A
              </Text>
              <Input
                value={participantA}
                onChangeText={setParticipantA}
                placeholder="Nombre del participante A"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Participante B
              </Text>
              <Input
                value={participantB}
                onChangeText={setParticipantB}
                placeholder="Nombre del participante B"
              />
            </View>
          </Card>

          <PrimaryButton onPress={handleCreateEvent} style={styles.createButton}>
            Crear Evento
          </PrimaryButton>
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
    marginBottom: Spacing.xxl,
  },
});

export default CreateEventScreen;
