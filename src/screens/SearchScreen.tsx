import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Input, Badge, EmptyState } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { searchTournaments, Tournament } from '../services/tournamentService';

const SearchScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Tournament[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async () => {
    if (!user) return;
    
    try {
      setSearching(true);
      const tournamentResults = await searchTournaments(searchQuery.trim());
      setResults(tournamentResults);
    } catch (error) {
      console.error('Error searching tournaments:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const getFormatLabel = (formatId: string) => {
    const formatMap: Record<string, string> = {
      'liga': 'Liga',
      'eliminatoria': 'Eliminatoria',
      'grupos-eliminatoria': 'Grupos + Eliminatoria',
      'evento-unico': 'Evento único',
      'serie': 'Serie (Bo3/Bo5)',
      'otro': 'Otro',
    };
    return formatMap[formatId] || formatId;
  };

  const getFormatIcon = (formatId: string) => {
    const iconMap: Record<string, any> = {
      'liga': 'trophy',
      'eliminatoria': 'git-branch',
      'grupos-eliminatoria': 'grid',
      'evento-unico': 'flag',
      'serie': 'list',
      'otro': 'ellipsis-horizontal',
    };
    return iconMap[formatId] || 'trophy';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Search Input */}
          <View style={styles.searchSection}>
            <View style={[styles.searchInputContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
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
          {searchQuery.length > 2 ? (
            <View style={styles.resultsSection}>
              {searching ? (
                <View style={styles.searchingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.searchingText, { color: colors.mutedForeground }]}>
                    Buscando...
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
                    {results.length} {results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                  </Text>

                  {results.length > 0 ? (
                    results.map((tournament) => (
                      <TouchableOpacity
                        key={tournament.id}
                        style={[styles.tournamentCard, { backgroundColor: colors.card }]}
                        onPress={() => navigation.navigate('TournamentDetails', { tournamentId: tournament.id })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardGradientOverlay}>
                          <LinearGradient
                            colors={[colors.primary + '10', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gradientBackground}
                          />
                        </View>
                        
                        <View style={styles.tournamentHeader}>
                          <View style={styles.tournamentInfo}>
                            <Text style={[styles.tournamentName, { color: colors.foreground }]}>
                              {tournament.name}
                            </Text>
                            <View style={styles.formatBadge}>
                              <Ionicons 
                                name={getFormatIcon(tournament.format)} 
                                size={12} 
                                color={colors.primary} 
                              />
                              <Text style={[styles.tournamentFormat, { color: colors.mutedForeground }]}>
                                {getFormatLabel(tournament.format)}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.prizeContainer, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.prizeValue, { color: colors.primary }]}>${tournament.contribution || 0}</Text>
                            <Text style={[styles.prizeLabel, { color: colors.primary }]}>
                              Aporte
                            </Text>
                          </View>
                        </View>
                        
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        
                        <View style={styles.tournamentFooter}>
                          <View style={styles.tournamentMeta}>
                            <View style={styles.metaItem}>
                              <View style={[styles.metaIconCircle, { backgroundColor: colors.secondary }]}>
                                <Ionicons name="people" size={14} color={colors.primary} />
                              </View>
                              <Text style={[styles.metaText, { color: colors.foreground }]}>
                                {tournament.participantsEstimated || 0} participantes
                              </Text>
                            </View>
                            <View style={styles.metaItem}>
                              <View style={[styles.metaIconCircle, { backgroundColor: colors.secondary }]}>
                                <Ionicons name="key" size={14} color={colors.primary} />
                              </View>
                              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                                {tournament.inviteCode}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.viewButton, { backgroundColor: colors.primary }]}>
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <EmptyState
                      iconName="search-outline"
                      title="Sin resultados"
                      message={`No se encontraron torneos con "${searchQuery}"`}
                    />
                  )}
                </>
              )}
            </View>
          ) : searchQuery.length > 0 ? (
            <View style={styles.hintContainer}>
              <Ionicons name="information-circle-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Ingresa al menos 3 caracteres para buscar
              </Text>
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
  searchingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: Spacing.md,
  },
  searchingText: {
    fontSize: 14,
  },
  hintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: Spacing.md,
  },
  hintText: {
    fontSize: 14,
    textAlign: 'center',
  },
  tournamentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBackground: {
    flex: 1,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tournamentFormat: {
    fontSize: 12,
    fontWeight: '500',
  },
  prizeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  prizeValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  prizeLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  dividerLine: {
    height: 1,
    marginBottom: Spacing.md,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tournamentMeta: {
    flex: 1,
    gap: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SearchScreen;
