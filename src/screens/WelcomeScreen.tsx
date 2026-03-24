import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SheetModal } from '../components/SheetModal';
import CreateTournamentForm, { CreateTournamentResult } from '../components/forms/CreateTournamentForm';
import JoinCodeForm from '../components/forms/JoinCodeForm';
import { markWelcomeCompleted } from '../services/onboardingService';

const WelcomeScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const firstName = user?.displayName?.split(' ')[0] ?? 'ahí';

  const markComplete = async () => {
    if (user?.uid) await markWelcomeCompleted(user.uid);
  };

  const handleExplore = async () => {
    await markComplete();
    navigation.replace('Main');
  };

  const handleJoinSuccess = async (tournamentId: string) => {
    setShowJoinSheet(false);
    await markComplete();
    navigation.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'Tournament', params: { tournamentId } }],
    });
  };

  const handleCreateSuccess = async (result: CreateTournamentResult) => {
    setShowCreateSheet(false);
    await markComplete();
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Main' },
        { name: 'Tournament', params: { tournamentId: result.tournamentId, openInviteSheet: true } },
      ],
    });
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={[styles.greeting, { color: colors.foreground }]}>
          ¡Bienvenido, {firstName}!
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          ¿Por dónde querés empezar?
        </Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowJoinSheet(true)}
          activeOpacity={0.75}
        >
          <View style={[styles.cardIconBg, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="key-outline" size={26} color={colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Tengo un código de invitación
            </Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
              Unite a un torneo existente
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardFilled, { backgroundColor: colors.primary, borderColor: 'transparent' }]}
          onPress={() => setShowCreateSheet(true)}
          activeOpacity={0.75}
        >
          <View style={[styles.cardIconBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Ionicons name="trophy-outline" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>
              Crear mi primer torneo
            </Text>
            <Text style={[styles.cardDesc, { color: 'rgba(255,255,255,0.70)' }]}>
              Empezá tu propio grupo de apuestas
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.70)" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleExplore} style={styles.exploreBtn} activeOpacity={0.6}>
        <Text style={[styles.exploreText, { color: colors.mutedForeground }]}>
          Explorar primero
        </Text>
      </TouchableOpacity>

      <SheetModal visible={showJoinSheet} onClose={() => setShowJoinSheet(false)}>
        <JoinCodeForm onJoined={handleJoinSuccess} />
      </SheetModal>

      <SheetModal visible={showCreateSheet} onClose={() => setShowCreateSheet(false)}>
        <CreateTournamentForm onSuccess={handleCreateSuccess} />
      </SheetModal>
    </View>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl + Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  logoImage: {
    width: 72,
    height: 72,
    marginBottom: Spacing.sm,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
  },
  cards: {
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardFilled: {
    borderWidth: 0,
  },
  cardIconBg: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  exploreBtn: {
    marginTop: Spacing.xxl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  exploreText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
