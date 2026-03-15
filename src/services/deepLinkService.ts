import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_TOURNAMENT_INVITE_KEY = '@pending_tournament_invite';

export interface PendingTournamentInvite {
  tournamentId: string;
  token: string;
  receivedAt: number;
}

export const parseTournamentInviteUrl = (url: string | null | undefined): PendingTournamentInvite | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const isJoinRoute = parsed.hostname === 'join' || parsed.pathname === '/join';
    if (parsed.protocol !== 'betcrowd:' || !isJoinRoute) return null;

    const tournamentId = parsed.searchParams.get('tournamentId')?.trim();
    const token = parsed.searchParams.get('token')?.trim();
    if (!tournamentId || !token) return null;

    return {
      tournamentId,
      token,
      receivedAt: Date.now(),
    };
  } catch {
    return null;
  }
};

export const savePendingTournamentInvite = async (invite: PendingTournamentInvite): Promise<void> => {
  await AsyncStorage.setItem(PENDING_TOURNAMENT_INVITE_KEY, JSON.stringify(invite));
};

export const getPendingTournamentInvite = async (): Promise<PendingTournamentInvite | null> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_TOURNAMENT_INVITE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingTournamentInvite>;
    if (!parsed.tournamentId || !parsed.token) return null;

    return {
      tournamentId: parsed.tournamentId,
      token: parsed.token,
      receivedAt: typeof parsed.receivedAt === 'number' ? parsed.receivedAt : Date.now(),
    };
  } catch {
    return null;
  }
};

export const clearPendingTournamentInvite = async (): Promise<void> => {
  await AsyncStorage.removeItem(PENDING_TOURNAMENT_INVITE_KEY);
};
