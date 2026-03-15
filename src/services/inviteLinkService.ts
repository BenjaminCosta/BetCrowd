import {
  Timestamp,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getTournamentCodePreview, TournamentCodePreview } from './inviteService';
import { joinTournamentByInviteCode } from './tournamentService';

const INVITE_LINK_TTL_DAYS = 30;
export const INVITE_LINK_WEB_BASE_URL = 'https://betcrowd.vercel.app/join';

type TournamentInviteLinkStatus = 'active' | 'revoked' | 'expired';

interface TournamentInviteLinkDoc {
  tournamentId: string;
  token: string;
  inviteCode: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  expiresAt: Timestamp;
  status: TournamentInviteLinkStatus;
}

export interface TournamentInviteLink {
  tournamentId: string;
  token: string;
  inviteCode: string;
  expiresAt: Timestamp;
  status: TournamentInviteLinkStatus;
  shareUrl: string;
}

export interface TournamentInviteLinkPreview extends Omit<TournamentCodePreview, 'inviteCode'> {
  token: string;
  expiresAt: Timestamp;
}

const getInviteLinkRef = (tournamentId: string) => doc(db, 'tournamentInviteLinks', tournamentId);

const buildExpiryDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + INVITE_LINK_TTL_DAYS);
  return date;
};

const generateInviteToken = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

const isExpired = (expiresAt?: Timestamp | null): boolean => {
  if (!expiresAt) return true;
  return expiresAt.toMillis() <= Date.now();
};

const buildInviteLinkData = (tournamentId: string, inviteCode: string, createdBy: string): TournamentInviteLinkDoc => ({
  tournamentId,
  token: generateInviteToken(),
  inviteCode,
  createdBy,
  expiresAt: Timestamp.fromDate(buildExpiryDate()),
  status: 'active',
});

const getValidatedLinkDoc = async (
  tournamentId: string,
  token: string,
): Promise<TournamentInviteLinkDoc> => {
  const snap = await getDoc(getInviteLinkRef(tournamentId));
  if (!snap.exists()) {
    throw new Error('El link de invitación no existe o ya no está disponible.');
  }

  const data = snap.data() as TournamentInviteLinkDoc;
  if (data.token !== token) {
    throw new Error('El link de invitación es inválido.');
  }
  if (data.status === 'revoked') {
    throw new Error('El link de invitación fue revocado.');
  }
  if (data.status !== 'active' || isExpired(data.expiresAt)) {
    throw new Error('El link de invitación expiró.');
  }
  if (!data.inviteCode) {
    throw new Error('El torneo ya no tiene un código de invitación válido.');
  }

  return data;
};

const ensureAdminCanShare = async (tournamentId: string, uid: string): Promise<void> => {
  const memberSnap = await getDoc(doc(db, 'tournaments', tournamentId, 'members', uid));
  const role = memberSnap.data()?.role;
  if (role !== 'admin' && role !== 'owner') {
    throw new Error('Solo los administradores pueden compartir el link del torneo.');
  }
};

const ensureTournamentCanBeShared = async (tournamentId: string): Promise<{ inviteCode: string }> => {
  const tournamentSnap = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!tournamentSnap.exists()) {
    throw new Error('El torneo no existe.');
  }

  const data = tournamentSnap.data();
  if (!data?.inviteCode) {
    throw new Error('El torneo no tiene un código de invitación disponible.');
  }
  if (data.status === 'finished' || data.status === 'deleted' || data.status === 'archived') {
    throw new Error('Este torneo ya no acepta invitaciones.');
  }

  return { inviteCode: data.inviteCode };
};

export const buildTournamentInviteLandingUrl = ({
  tournamentId,
  token,
}: {
  tournamentId: string;
  token: string;
}): string => {
  const url = new URL(INVITE_LINK_WEB_BASE_URL);
  url.searchParams.set('tournamentId', tournamentId);
  url.searchParams.set('token', token);
  return url.toString();
};

export const getOrCreateTournamentInviteLink = async (tournamentId: string): Promise<TournamentInviteLink> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para compartir el link del torneo.');

  await ensureAdminCanShare(tournamentId, user.uid);
  const { inviteCode } = await ensureTournamentCanBeShared(tournamentId);

  const ref = getInviteLinkRef(tournamentId);

  const result = await runTransaction(db, async (transaction) => {
    const existingSnap = await transaction.get(ref);
    const existing = existingSnap.exists() ? (existingSnap.data() as TournamentInviteLinkDoc) : null;

    if (
      existing &&
      existing.status === 'active' &&
      !isExpired(existing.expiresAt) &&
      existing.inviteCode === inviteCode &&
      existing.token
    ) {
      return {
        tournamentId,
        token: existing.token,
        inviteCode: existing.inviteCode,
        expiresAt: existing.expiresAt,
        status: existing.status,
        shareUrl: buildTournamentInviteLandingUrl({ tournamentId, token: existing.token }),
      };
    }

    const next = buildInviteLinkData(tournamentId, inviteCode, user.uid);
    transaction.set(ref, {
      ...next,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      tournamentId,
      token: next.token,
      inviteCode: next.inviteCode,
      expiresAt: next.expiresAt,
      status: next.status,
      shareUrl: buildTournamentInviteLandingUrl({ tournamentId, token: next.token }),
    };
  });

  return result;
};

export const getTournamentInviteLinkPreview = async ({
  tournamentId,
  token,
}: {
  tournamentId: string;
  token: string;
}): Promise<TournamentInviteLinkPreview> => {
  const data = await getValidatedLinkDoc(tournamentId, token);
  const preview = await getTournamentCodePreview(data.inviteCode);

  if (!preview || preview.tournamentId !== tournamentId) {
    throw new Error('No se pudo cargar la vista previa del torneo.');
  }

  return {
    tournamentId: preview.tournamentId,
    name: preview.name,
    memberPreviews: preview.memberPreviews,
    token,
    expiresAt: data.expiresAt,
  };
};

export const joinTournamentByInviteLink = async ({
  tournamentId,
  token,
}: {
  tournamentId: string;
  token: string;
}): Promise<string> => {
  const data = await getValidatedLinkDoc(tournamentId, token);
  return joinTournamentByInviteCode(data.inviteCode);
};

export const revokeTournamentInviteLink = async (
  tournamentId: string,
  status: Extract<TournamentInviteLinkStatus, 'revoked' | 'expired'> = 'revoked',
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para revocar el link del torneo.');

  await ensureAdminCanShare(tournamentId, user.uid);

  const snap = await getDoc(getInviteLinkRef(tournamentId));
  if (!snap.exists()) return;

  await updateDoc(getInviteLinkRef(tournamentId), {
    status,
    updatedAt: serverTimestamp(),
  });
};
