import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  serverTimestamp,
  runTransaction,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface CreateTournamentInput {
  name: string;
  description?: string;
  format: string;
  contribution: number;
  participantsEstimated: number;
  startDate?: string;
  endDate?: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  format: string;
  contribution: number;
  participantsEstimated: number;
  startDate?: string;
  endDate?: string;
  ownerId: string;
  inviteCode: string;
  status: string; // active, archived, deleted, locked
  hasActivity: boolean; // true if events/bets exist
  currency?: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
  deletedBy?: string;
}

export interface TournamentRef {
  tournamentId: string;
  role: string;
  joinedAt: any;
}

/**
 * Generate a unique 6-character invite code
 */
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking characters
  const length = 6;
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Create a new tournament with invite code transaction
 * Returns { tournamentId, inviteCode }
 */
export const createTournament = async (input: CreateTournamentInput): Promise<{ tournamentId: string; inviteCode: string }> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para crear un torneo');
  }

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const inviteCode = generateInviteCode();
    
    try {
      const result = await runTransaction(db, async (transaction) => {
        // Check if invite code exists
        const inviteCodeRef = doc(db, 'inviteCodes', inviteCode);
        const inviteCodeDoc = await transaction.get(inviteCodeRef);

        if (inviteCodeDoc.exists()) {
          throw new Error('CODE_EXISTS');
        }

        // Create tournament document
        const tournamentRef = doc(collection(db, 'tournaments'));
        const tournamentId = tournamentRef.id;

        const tournamentData = {
          name: input.name,
          description: input.description || '',
          format: input.format,
          contribution: input.contribution,
          participantsEstimated: input.participantsEstimated,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          ownerId: user.uid,
          inviteCode,
          status: 'active',
          hasActivity: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        transaction.set(tournamentRef, tournamentData);

        // Create member entry for owner
        const memberRef = doc(db, 'tournaments', tournamentId, 'members', user.uid);
        transaction.set(memberRef, {
          role: 'owner',
          joinedAt: serverTimestamp(),
        });

        // Create user tournament reference
        const userTournamentRef = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
        transaction.set(userTournamentRef, {
          role: 'owner',
          joinedAt: serverTimestamp(),
        });

        // Create invite code index
        transaction.set(inviteCodeRef, {
          tournamentId,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });

        return { tournamentId, inviteCode };
      });

      return result;
    } catch (error: any) {
      if (error.message === 'CODE_EXISTS') {
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error('No se pudo generar un código de invitación único. Intenta nuevamente.');
};

/**
 * Join tournament by invite code
 */
export const joinTournamentByInviteCode = async (code: string): Promise<string> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para unirte a un torneo');
  }

  try {
    // Read invite code index
    const inviteCodeRef = doc(db, 'inviteCodes', code.toUpperCase());
    const inviteCodeDoc = await getDoc(inviteCodeRef);

    if (!inviteCodeDoc.exists()) {
      throw new Error('Código de invitación inválido');
    }

    const { tournamentId } = inviteCodeDoc.data();

    // Check if user is already a member
    const memberRef = doc(db, 'tournaments', tournamentId, 'members', user.uid);
    const memberDoc = await getDoc(memberRef);

    if (memberDoc.exists()) {
      throw new Error('Ya eres miembro de este torneo');
    }

    // Create member entry
    await setDoc(memberRef, {
      role: 'member',
      joinedAt: serverTimestamp(),
    });

    // Create user tournament reference
    const userTournamentRef = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
    await setDoc(userTournamentRef, {
      role: 'member',
      joinedAt: serverTimestamp(),
    });

    return tournamentId;
  } catch (error: any) {
    console.error('Error joining tournament:', error);
    throw error;
  }
};

/**
 * List tournaments the current user is part of
 */
export const listMyTournaments = async (): Promise<Tournament[]> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para ver torneos');
  }

  try {
    // Get tournament refs from user
    const tournamentRefsRef = collection(db, 'users', user.uid, 'tournamentRefs');
    const q = query(tournamentRefsRef, orderBy('joinedAt', 'desc'));
    const snapshot = await getDocs(q);

    // Fetch tournament details
    const tournaments: Tournament[] = [];
    
    for (const refDoc of snapshot.docs) {
      const tournamentId = refDoc.id;
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      
      if (tournamentDoc.exists()) {
        tournaments.push({
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        } as Tournament);
      }
    }

    return tournaments;
  } catch (error: any) {
    throw error;
  }
};

/**
 * Get a single tournament by ID
 */
export const getTournament = async (tournamentId: string): Promise<Tournament | null> => {
  try {
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    
    if (!tournamentDoc.exists()) {
      return null;
    }

    return {
      id: tournamentDoc.id,
      ...tournamentDoc.data(),
    } as Tournament;
  } catch (error) {
    console.error('Error getting tournament:', error);
    return null;
  }
};

/**
 * Get member count for a tournament
 */
export const getTournamentMemberCount = async (tournamentId: string): Promise<number> => {
  try {
    const membersRef = collection(db, 'tournaments', tournamentId, 'members');
    const snapshot = await getDocs(membersRef);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting member count:', error);
    return 0;
  }
};

/**
 * Get the current user's role in a tournament
 */
export const getMyTournamentRole = async (tournamentId: string, uid: string): Promise<string | null> => {
  try {
    const memberDoc = await getDoc(doc(db, 'tournaments', tournamentId, 'members', uid));
    
    if (!memberDoc.exists()) {
      return null;
    }

    return memberDoc.data()?.role || null;
  } catch (error) {
    console.error('Error getting tournament role:', error);
    return null;
  }
};

/**
 * Check if user is admin (owner or admin role)
 */
export const isUserAdmin = async (tournamentId: string, uid: string): Promise<boolean> => {
  const role = await getMyTournamentRole(tournamentId, uid);
  return role === 'owner' || role === 'admin';
};

/**
 * Listen to user's tournaments in real-time (optional)
 */
export const listenMyTournaments = (
  callback: (tournaments: Tournament[]) => void
): Unsubscribe | null => {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  const tournamentRefsRef = collection(db, 'users', user.uid, 'tournamentRefs');
  const q = query(tournamentRefsRef, orderBy('joinedAt', 'desc'));

  return onSnapshot(q, async (snapshot) => {
    const tournaments: Tournament[] = [];
    
    for (const refDoc of snapshot.docs) {
      const tournamentId = refDoc.id;
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      
      if (tournamentDoc.exists()) {
        tournaments.push({
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        } as Tournament);
      }
    }

    callback(tournaments);
  });
};

/**
 * Update basic tournament fields (always allowed)
 */
export const updateTournamentBasic = async (
  tournamentId: string,
  updates: { name?: string; description?: string }
): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para editar el torneo');
  }

  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo actualizar el torneo');
  }
};

/**
 * Update tournament configuration (only if hasActivity is false)
 */
export const updateTournamentConfig = async (
  tournamentId: string,
  config: {
    format?: string;
    contribution?: number;
    currency?: string;
    startDate?: string;
    endDate?: string;
    participantsEstimated?: number;
  }
): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para editar el torneo');
  }

  try {
    // Check if tournament has activity
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    
    if (!tournamentDoc.exists()) {
      throw new Error('Torneo no encontrado');
    }

    const tournament = tournamentDoc.data() as Tournament;

    if (tournament.hasActivity) {
      throw new Error(
        'No se pueden editar estos campos porque el torneo ya tiene actividad (eventos o predicciones)'
      );
    }

    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        ...config,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    throw error;
  }
};

/**
 * Archive a tournament (soft delete with status=archived)
 */
export const archiveTournament = async (tournamentId: string): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para archivar el torneo');
  }

  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        status: 'archived',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo archivar el torneo');
  }
};

/**
 * Soft delete a tournament (status=deleted)
 */
export const deleteTournamentSoft = async (tournamentId: string): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para eliminar el torneo');
  }

  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo eliminar el torneo');
  }
};
