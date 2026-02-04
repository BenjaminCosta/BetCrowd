import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Input, Badge, EmptyState } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';

// Mock data - solo para mostrar layout
const mockTournaments = [
  {
    id: 1,
    name: 'Champions League Final',
    participants: 248,
    prize: '$1,500',
    status: 'ACTIVO',
  },
  {
    id: 2,
    name: 'La Liga Jornada 15',
    participants: 1024,
    prize: '$3,000',
    status: 'PENDIENTE',
  },
];

const SearchScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const [searchQuery, setSearchQuery] = useState('');
  const [results] = useState(mockTournaments);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Search Input */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.mutedForeground} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar torneos..."
                style={[styles.searchInput, { borderWidth: 0 }]}
              />
            </View>
          </View>

          {/* Results */}
          {searchQuery.length > 0 ? (
            <View style={styles.resultsSection}>
              <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
                {results.length} resultados encontrados
              </Text>

              {results.map((tournament) => (
                <TouchableOpacity
                  key={tournament.id}
                  onPress={() => navigation.navigate('TournamentDetails', { id: tournament.id })}
                >
                  <Card style={styles.tournamentCard}>
                    <View style={styles.tournamentHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tournamentName, { color: colors.foreground }]}>
                          {tournament.name}
                        </Text>
                        <Text style={[styles.tournamentInfo, { color: colors.mutedForeground }]}>
                          {tournament.participants} participantes
                        </Text>
                      </View>
                      <Badge variant={tournament.status === 'ACTIVO' ? 'active' : 'pending'}>
                        {tournament.status}
                      </Badge>
                    </View>
                    <View style={styles.tournamentFooter}>
                      <View style={styles.prizeInfo}>
                        <Ionicons name="trophy" size={16} color={colors.accent} />
                        <Text style={[styles.prizeText, { color: colors.accent }]}>
                          Pozo: {tournament.prize}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <EmptyState
              iconName="search-outline"
              title="Buscar torneos"
              message="Ingresa el nombre de un torneo para comenzar la búsqueda"
            />
          )}
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
  searchSection: {
    marginBottom: Spacing.xl,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 0,
  },
  resultsSection: {
    gap: Spacing.md,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  tournamentCard: {
    marginBottom: Spacing.md,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tournamentInfo: {
    fontSize: 13,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prizeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prizeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SearchScreen;
