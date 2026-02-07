import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Button,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { LoadingBar } from '../components/LoadingBar';
import { useTheme } from '../context/ThemeContext';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

const tournaments = [
  {
    id: 1,
    name: 'Final Champions League',
    participants: 248,
    prize: '1,500',
    status: 'live',
    endsIn: '2h 15m',
  },
  {
    id: 2,
    name: 'La Liga Jornada 15',
    participants: 1024,
    prize: '3,000',
    status: 'upcoming',
    startsIn: '5h 30m',
  },
  {
    id: 3,
    name: 'NBA All-Stars Night',
    participants: 512,
    prize: '2,250',
    status: 'live',
    endsIn: '45m',
  },
];

const stats = [
  { label: 'Victorias', value: '12', icon: 'trophy' },
  { label: 'Efectividad', value: '68%', icon: 'trending-up' },
  { label: 'Ranking', value: '#42', icon: 'star' },
];

const HomeScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  async function probarFirestore() {
    try {
      const ref = doc(db, "debug", "ping");
      await setDoc(ref, { ok: true, createdAt: serverTimestamp() });
      const snap = await getDoc(ref);
      console.log("Firestore:", snap.exists(), snap.data());
      alert("✅ Firestore funciona! Revisa la consola");
    } catch (error) {
      console.error("Error Firestore:", error);
      alert("❌ Error: " + error);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar />
      <LoadingBar isLoading={isLoading} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Botón de prueba Firestore */}
          <View style={{ marginBottom: 16 }}>
            <Button title="🔥 Probar Firestore" onPress={probarFirestore} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
                Bienvenido de vuelta
              </Text>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                Juan García
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={[styles.statCard, { backgroundColor: colors.secondary }]}
              >
                <Ionicons
                  name={stat.icon as any}
                  size={20}
                  color="#FF8C00"
                  style={styles.statIcon}
                />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Active Tournaments */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Torneos Activos
            </Text>
            <TouchableOpacity style={styles.viewAll}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                Ver Todos
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Tournaments List */}
          <View style={styles.tournamentsList}>
            {tournaments.map((tournament) => (
              <TouchableOpacity
                key={tournament.id}
                style={[styles.tournamentCard, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate('TournamentDetails')}
              >
                <View style={styles.tournamentHeader}>
                  <View style={styles.tournamentInfo}>
                    {tournament.status === 'live' && (
                      <View style={styles.liveBadge}>
                        <Ionicons name="flame" size={12} color="#DC2E4B" />
                        <Text style={styles.liveBadgeText}>EN VIVO</Text>
                      </View>
                    )}
                    {tournament.status === 'upcoming' && (
                      <View style={styles.upcomingBadge}>
                        <Text style={styles.upcomingBadgeText}>PRÓXIMO</Text>
                      </View>
                    )}
                    <Text style={[styles.tournamentName, { color: colors.foreground }]}>
                      {tournament.name}
                    </Text>
                  </View>
                  <View style={styles.prizeContainer}>
                    <Text style={styles.prizeValue}>{tournament.prize}</Text>
                    <Text style={[styles.prizeLabel, { color: colors.mutedForeground }]}>
                      Premio
                    </Text>
                  </View>
                </View>
                
                <View style={styles.tournamentFooter}>
                  <View style={styles.tournamentMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="people" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        {tournament.participants}
                      </Text>
                    </View>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {tournament.status === 'live'
                        ? `Termina en ${tournament.endsIn}`
                        : `Inicia en ${tournament.startsIn}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      tournament.status === 'live'
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        tournament.status === 'live'
                          ? { color: '#FFFFFF' }
                          : { color: colors.foreground },
                      ]}
                    >
                      {tournament.status === 'live' ? 'Unirme' : 'Recordar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
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
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 14,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tournamentsList: {
    gap: 12,
  },
  tournamentCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tournamentInfo: {
    flex: 1,
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 46, 75, 0.2)',
    gap: 4,
  },
  liveBadgeText: {
    color: '#DC2E4B',
    fontSize: 10,
    fontWeight: '700',
  },
  upcomingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.2)',
  },
  upcomingBadgeText: {
    color: '#FF8C00',
    fontSize: 10,
    fontWeight: '700',
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '700',
  },
  prizeContainer: {
    alignItems: 'flex-end',
  },
  prizeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2E4B',
  },
  prizeLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tournamentMeta: {
    flex: 1,
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;
