import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius, Gradients } from '../../theme/colors';
import { Card, EmptyState } from '../CommonComponents';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { searchTournaments, Tournament } from '../../services/tournamentService';
import { searchUsersByUsernamePrefix, getFriendshipStatus, FriendshipStatus } from '../../services/friendsService';
import { PublicProfile } from '../../services/publicProfileService';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = 'tournaments' | 'friends';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SearchPanelProps {
  /** Called to close the containing sheet (e.g. when navigating away or pressing back) */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SearchPanel: React.FC<SearchPanelProps> = ({ onClose }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();
  const { user } = useAuth();
  const { sendFriendRequest, acceptFriendRequest, cancelFriendRequest, getFriendshipStatus: checkStatus } = useSocial();
  const navigation = useNavigation<NavigationProp<any>>();

  const [activeTab, setActiveTab] = useState<TabType>('tournaments');
  const [searchQuery, setSearchQuery] = useState('');

  // Tournament search
  const [tournamentResults, setTournamentResults] = useState<Tournament[]>([]);
  const [searchingTournaments, setSearchingTournaments] = useState(false);

  // Friends search
  const [friendResults, setFriendResults] = useState<PublicProfile[]>([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, FriendshipStatus>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        if (activeTab === 'tournaments') {
          performTournamentSearch();
        } else {
          performFriendsSearch();
        }
      } else {
        setTournamentResults([]);
        setFriendResults([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab]);

  const performTournamentSearch = async () => {
    if (!user) return;
    try {
      setSearchingTournaments(true);
      const results = await searchTournaments(searchQuery.trim());
      setTournamentResults(results);
    } catch (error) {
      console.error('Error searching tournaments:', error);
      setTournamentResults([]);
    } finally {
      setSearchingTournaments(false);
    }
  };

  const performFriendsSearch = async () => {
    if (!user) return;
    try {
      setSearchingFriends(true);
      const results = await searchUsersByUsernamePrefix(searchQuery.trim());
      const filtered = results.filter((u) => u.uid !== user.uid).slice(0, 20);
      setFriendResults(filtered);
      const statuses: Record<string, FriendshipStatus> = {};
      await Promise.all(
        filtered.map(async (profile) => {
          const status = await checkStatus(profile.uid);
          statuses[profile.uid] = status;
        })
      );
      setFriendStatuses(statuses);
    } catch (error) {
      console.error('Error searching friends:', error);
      setFriendResults([]);
    } finally {
      setSearchingFriends(false);
    }
  };

  const handleSendRequest = async (targetUid: string) => {
    try {
      setActionLoading(`send-${targetUid}`);
      await sendFriendRequest(targetUid);
      setFriendStatuses({ ...friendStatuses, [targetUid]: 'pending_sent' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'No se pudo enviar la solicitud' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async (fromUid: string) => {
    try {
      setActionLoading(`accept-${fromUid}`);
      await acceptFriendRequest(fromUid);
      setFriendStatuses({ ...friendStatuses, [fromUid]: 'friends' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'No se pudo aceptar la solicitud' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (toUid: string) => {
    try {
      setActionLoading(`cancel-${toUid}`);
      await cancelFriendRequest(toUid);
      setFriendStatuses({ ...friendStatuses, [toUid]: 'none' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'No se pudo cancelar la solicitud' });
    } finally {
      setActionLoading(null);
    }
  };

  const getInitials = (name: string) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(' ').filter(Boolean);
    if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
    return trimmed.substring(0, 2).toUpperCase();
  };

  const getFormatLabel = (formatId: string) => {
    const formatMap: Record<string, string> = {
      liga: 'Liga',
      eliminatoria: 'Eliminatoria',
      'grupos-eliminatoria': 'Grupos + Eliminatoria',
      'evento-unico': 'Evento único',
      serie: 'Serie (Bo3/Bo5)',
      bracket: 'Eliminación Directa',
      points: 'Puntos',
      otro: 'Otro',
    };
    return formatMap[formatId] || formatId;
  };

  const getFormatIcon = (formatId: string): any => {
    const iconMap: Record<string, string> = {
      liga: 'trophy',
      eliminatoria: 'git-branch',
      'grupos-eliminatoria': 'grid',
      'evento-unico': 'flag',
      serie: 'list',
      bracket: 'git-branch',
      points: 'analytics',
      otro: 'ellipsis-horizontal',
    };
    return iconMap[formatId] || 'trophy';
  };

  const renderFriendActionButton = (profile: PublicProfile) => {
    const status = friendStatuses[profile.uid] || 'none';
    const loading =
      actionLoading === `send-${profile.uid}` ||
      actionLoading === `accept-${profile.uid}` ||
      actionLoading === `cancel-${profile.uid}`;

    if (loading) {
      return (
        <View style={styles.friendActionButton}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    switch (status) {
      case 'friends':
        return (
          <View style={[styles.friendActionButton, { backgroundColor: colors.muted }]}>
            <Ionicons name="checkmark" size={16} color={colors.foreground} />
            <Text style={[styles.friendActionText, { color: colors.foreground }]}>Amigo</Text>
          </View>
        );
      case 'pending_sent':
        return (
          <TouchableOpacity
            style={[styles.friendActionButton, { borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => handleCancelRequest(profile.uid)}
          >
            <Text style={[styles.friendActionText, { color: colors.mutedForeground }]}>Pendiente</Text>
          </TouchableOpacity>
        );
      case 'pending_received':
        return (
          <TouchableOpacity onPress={() => handleAcceptRequest(profile.uid)}>
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.friendActionButton}
            >
              <Text style={[styles.friendActionText, { color: '#FFF' }]}>Aceptar</Text>
            </LinearGradient>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity onPress={() => handleSendRequest(profile.uid)}>
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.friendActionButton}
            >
              <Ionicons name="person-add" size={16} color="#FFF" />
              <Text style={[styles.friendActionText, { color: '#FFF' }]}>Agregar</Text>
            </LinearGradient>
          </TouchableOpacity>
        );
    }
  };

  const renderFriendItem = (profile: PublicProfile) => (
    <Card key={profile.uid} style={styles.friendCard}>
      <View style={styles.friendRow}>
        {profile.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.friendAvatar as any} />
        ) : (
          <LinearGradient
            colors={Gradients.primary as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.friendAvatar}
          >
            <Text style={styles.friendAvatarText}>
              {getInitials(profile.displayName || profile.username)}
            </Text>
          </LinearGradient>
        )}
        <View style={styles.friendInfo}>
          <Text style={[styles.friendDisplayName, { color: colors.foreground }]}>{profile.displayName}</Text>
          <Text style={[styles.friendUsername, { color: colors.mutedForeground }]}>@{profile.username}</Text>
        </View>
        {renderFriendActionButton(profile)}
      </View>
    </Card>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Search Input */}
        <View style={styles.searchSection}>
          <View
            style={[styles.searchInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="search" size={20} color={colors.mutedForeground} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={activeTab === 'tournaments' ? 'Buscar torneos...' : 'Buscar por @usuario...'}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View
          style={[styles.tabsContainer, { backgroundColor: colors.secondary, borderRadius: BorderRadius.md }]}
        >
          {(['tournaments', 'friends'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: colors.primary }]]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.foreground },
                  activeTab === tab && { color: '#FFF' },
                ]}
              >
                {tab === 'tournaments' ? 'Torneos' : 'Amigos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Results */}
        {activeTab === 'tournaments' ? (
          searchQuery.length > 2 ? (
            <View style={styles.resultsSection}>
              {searchingTournaments ? (
                <View style={styles.centeredContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.searchingText, { color: colors.mutedForeground }]}>Buscando...</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
                    {tournamentResults.length}{' '}
                    {tournamentResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                  </Text>
                  {tournamentResults.length > 0 ? (
                    tournamentResults.map((tournament) => (
                      <TouchableOpacity
                        key={tournament.id}
                        style={[styles.tournamentCard, { backgroundColor: colors.card }]}
                        onPress={() => {
                          onClose();
                          (navigation as any).navigate('Tournament', { tournamentId: tournament.id });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardGradientOverlay}>
                          <LinearGradient
                            colors={[colors.primary + '10', 'transparent'] as any}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
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
                            <Text style={[styles.prizeValue, { color: colors.foreground }]}>
                              ${tournament.contribution}
                            </Text>
                            <Text style={[styles.prizeLabel, { color: colors.mutedForeground }]}>Aporte</Text>
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
            <View style={styles.centeredContainer}>
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
          )
        ) : searchQuery.length > 2 ? (
          <View style={styles.resultsSection}>
            {searchingFriends ? (
              <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.searchingText, { color: colors.mutedForeground }]}>Buscando...</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
                  {friendResults.length}{' '}
                  {friendResults.length === 1 ? 'usuario encontrado' : 'usuarios encontrados'}
                </Text>
                {friendResults.length > 0 ? (
                  friendResults.map((profile) => renderFriendItem(profile))
                ) : (
                  <EmptyState
                    iconName="search-outline"
                    title="Sin resultados"
                    message={`No se encontraron usuarios con "${searchQuery}"`}
                  />
                )}
              </>
            )}
          </View>
        ) : searchQuery.length > 0 ? (
          <View style={styles.centeredContainer}>
            <Ionicons name="information-circle-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Ingresa al menos 3 caracteres para buscar
            </Text>
          </View>
        ) : (
          <EmptyState
            iconName="people-outline"
            title="Buscar amigos"
            message="Busca usuarios por su @nombre de usuario"
          />
        )}
      </View>
    </ScrollView>
  );
};

export default SearchPanel;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: 40 },
  searchSection: { marginBottom: Spacing.xl },
  searchInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderRadius: BorderRadius.full, borderWidth: 1, gap: 10,
  },
  searchIcon: { marginLeft: 2 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  clearButton: { padding: 2 },
  tabsContainer: { flexDirection: 'row', padding: 4, gap: 4, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm },
  activeTab: {},
  tabText: { fontSize: 14, fontWeight: '600' },
  resultsSection: { gap: Spacing.md },
  resultsTitle: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.sm },
  centeredContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: Spacing.md },
  searchingText: { fontSize: 14 },
  hintText: { fontSize: 14, textAlign: 'center' },
  tournamentCard: {
    padding: Spacing.lg, borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md, position: 'relative', overflow: 'hidden',
  },
  cardGradientOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tournamentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  tournamentInfo: { flex: 1 },
  tournamentName: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  formatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tournamentFormat: { fontSize: 12, fontWeight: '500' },
  prizeContainer: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.sm, alignItems: 'center' },
  prizeValue: { fontSize: 16, fontWeight: '800' },
  prizeLabel: { fontSize: 10, fontWeight: '600' },
  dividerLine: { height: 1, marginBottom: Spacing.md },
  tournamentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tournamentMeta: { flex: 1, gap: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaIconCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  metaText: { fontSize: 13, fontWeight: '500' },
  viewButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  friendCard: { padding: Spacing.sm, marginBottom: Spacing.sm },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  friendAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  friendInfo: { flex: 1, gap: 2 },
  friendDisplayName: { fontSize: 16, fontWeight: '600' },
  friendUsername: { fontSize: 13 },
  friendActionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: BorderRadius.sm,
  },
  friendActionText: { fontSize: 13, fontWeight: '600' },
});
