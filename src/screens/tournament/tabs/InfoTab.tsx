import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { SectionHeader } from '../../../components/CommonComponents';
import { SheetModal } from '../../../components/SheetModal';
import TournamentSettingsForm from '../../../components/forms/TournamentSettingsForm';
import { Tournament } from '../../../services/tournamentService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getFormatLabel = (formatId: string) => {
  const map: Record<string, string> = {
    liga: 'Liga',
    eliminatoria: 'Eliminatoria',
    'grupos-eliminatoria': 'Grupos + Eliminatoria',
    'evento-unico': 'Evento único',
    serie: 'Serie (Bo3/Bo5)',
    bracket: 'Eliminación Directa',
    points: 'Puntos',
    otro: 'Otro',
  };
  return map[formatId] || formatId;
};

const getFormatIcon = (formatId: string): any => {
  const map: Record<string, string> = {
    liga: 'trophy',
    eliminatoria: 'git-branch',
    'grupos-eliminatoria': 'grid',
    'evento-unico': 'flag',
    serie: 'list',
    bracket: 'git-branch',
    points: 'analytics',
    otro: 'ellipsis-horizontal',
  };
  return map[formatId] || 'trophy';
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface InfoTabProps {
  tournament: Tournament;
  memberCount: number;
  isAdmin: boolean;
  savingInfo: boolean;
  tournamentId: string;
  onArchive: () => void;
  onDelete: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const InfoTab: React.FC<InfoTabProps> = ({
  tournament,
  memberCount,
  isAdmin,
  savingInfo,
  tournamentId,
  onArchive,
  onDelete,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  const handleFormArchived = () => setShowSettingsSheet(false);
  const handleFormDeleted = () => setShowSettingsSheet(false);

  // We receive isOwner info from parent through isAdmin; check by comparing ownerId is handled in parent.
  // isAdmin prop covers admin actions; separate isOwner passed if needed.
  // For simplicity, show all admin actions when isAdmin = true.

  return (
    <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
      {/* Info grid */}
      <View style={styles.infoGrid}>
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Inicio</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {tournament.startDate || 'Sin fecha'}
          </Text>
        </View>
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Fin</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {tournament.endDate || 'Sin fecha'}
          </Text>
        </View>
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Ionicons name="people-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Participantes</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {memberCount} / {tournament.participantsEstimated}
          </Text>
        </View>
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Ionicons name={getFormatIcon(tournament.format)} size={20} color={colors.primary} />
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Formato</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {getFormatLabel(tournament.format)}
          </Text>
        </View>
      </View>

      {tournament.description ? (
        <View style={[styles.descriptionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.descriptionText, { color: colors.mutedForeground }]}>
            {tournament.description}
          </Text>
        </View>
      ) : null}

      {/* Invite code */}
      <TouchableOpacity
        style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={async () => {
          await Clipboard.setStringAsync(tournament.inviteCode);
          Alert.alert('Copiado', 'Código de invitación copiado al portapapeles');
        }}
        activeOpacity={0.7}
      >
        <View style={styles.inviteRow}>
          <View>
            <Text style={[styles.inviteLabel, { color: colors.mutedForeground }]}>
              Código de invitación
            </Text>
            <Text style={[styles.inviteCode, { color: colors.foreground }]}>
              {tournament.inviteCode}
            </Text>
          </View>
          <View style={[styles.copyBadge, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
            <Text style={[styles.copyText, { color: colors.primary }]}>Copiar</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Admin section */}
      {isAdmin && (
        <View style={styles.adminSection}>
          <SectionHeader title="Administración" />

          <TouchableOpacity
            style={[styles.adminRow, { backgroundColor: colors.secondary }]}
            onPress={() => setShowSettingsSheet(true)}
          >
            <View style={[styles.adminIconCircle, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.adminRowText, { color: colors.foreground }]}>Editar torneo</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminRow, { backgroundColor: colors.secondary }]}
            onPress={onArchive}
            disabled={savingInfo}
          >
            <View style={[styles.adminIconCircle, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="archive-outline" size={18} color={colors.warning} />
            </View>
            <Text style={[styles.adminRowText, { color: colors.foreground }]}>Archivar torneo</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminRow, { backgroundColor: colors.destructive + '15' }]}
            onPress={onDelete}
            disabled={savingInfo}
          >
            <View style={[styles.adminIconCircle, { backgroundColor: colors.destructive + '20' }]}>
              <Ionicons name="trash-outline" size={18} color={colors.destructive} />
            </View>
            <Text style={[styles.adminRowText, { color: colors.destructive }]}>Eliminar torneo</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      )}

      {/* Settings sheet */}
      <SheetModal visible={showSettingsSheet} onClose={() => setShowSettingsSheet(false)}>
        <TournamentSettingsForm
          tournamentId={tournamentId}
          onArchived={handleFormArchived}
          onDeleted={handleFormDeleted}
        />
      </SheetModal>
    </ScrollView>
  );
};

export default InfoTab;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabScroll: { flex: 1 },
  tabContent: { padding: Spacing.lg, paddingBottom: 100 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  infoCard: { flex: 1, minWidth: '47%', padding: Spacing.lg, borderRadius: BorderRadius.md, gap: 4 },
  infoLabel: { fontSize: 12, marginTop: 4 },
  infoValue: { fontSize: 16, fontWeight: '700' },
  descriptionCard: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
  descriptionText: { fontSize: 14, lineHeight: 20 },
  balanceCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.xl },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  balanceLabel: { fontSize: 14 },
  balanceValue: { fontSize: 16, fontWeight: '600' },
  infoDivider: { height: 1, marginBottom: Spacing.md },
  inviteCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.xl },
  inviteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inviteLabel: { fontSize: 12, marginBottom: 4 },
  inviteCode: { fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  copyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm },
  copyText: { fontSize: 13, fontWeight: '600' },
  adminSection: { marginBottom: Spacing.xl },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  adminIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  adminRowText: { flex: 1, fontSize: 15, fontWeight: '600' },
});
