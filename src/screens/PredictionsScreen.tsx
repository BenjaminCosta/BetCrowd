import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';

const predictions = [
  {
    id: 1,
    tournament: 'Final Champions League',
    match: 'Real Madrid vs Manchester City',
    prediction: 'Real Madrid',
    status: 'pending',
    date: '15 Dic',
  },
  {
    id: 2,
    tournament: 'La Liga Jornada 15',
    match: 'Barcelona vs Atlético Madrid',
    prediction: 'Empate',
    status: 'won',
    date: '12 Dic',
  },
  {
    id: 3,
    tournament: 'NBA All-Stars',
    match: 'Lakers vs Warriors',
    prediction: 'Lakers',
    status: 'lost',
    date: '10 Dic',
  },
];

const PredictionsScreen = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return colors.success;
      case 'lost':
        return colors.destructive;
      default:
        return colors.accent;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'won':
        return 'Ganada';
      case 'lost':
        return 'Perdida';
      default:
        return 'Pendiente';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar />
      <ScrollView style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Mis Apuestas
        </Text>

        <View style={styles.predictionsList}>
          {predictions.map((pred) => (
            <View
              key={pred.id}
              style={[styles.predictionCard, { backgroundColor: colors.card }]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.tournamentName, { color: colors.mutedForeground }]}>
                  {pred.tournament}
                </Text>
                <Text style={[styles.date, { color: colors.mutedForeground }]}>
                  {pred.date}
                </Text>
              </View>
              
              <Text style={[styles.match, { color: colors.foreground }]}>
                {pred.match}
              </Text>
              
              <View style={styles.cardFooter}>
                <View style={styles.predictionInfo}>
                  <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
                    Mi predicción:
                  </Text>
                  <Text style={[styles.predictionValue, { color: colors.primary }]}>
                    {pred.prediction}
                  </Text>
                </View>
                
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(pred.status) + '20' },
                  ]}
                >
                  <Text style={[styles.statusText, { color: getStatusColor(pred.status) }]}>
                    {getStatusText(pred.status)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  predictionsList: {
    gap: 12,
  },
  predictionCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tournamentName: {
    fontSize: 12,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
  },
  match: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predictionInfo: {
    gap: 4,
  },
  predictionLabel: {
    fontSize: 12,
  },
  predictionValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default PredictionsScreen;
