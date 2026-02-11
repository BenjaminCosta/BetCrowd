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
  // Denormalized fields for fast loading
  name: string;
  format: string;
  contribution: number;
  participantsEstimated: number;
  inviteCode: string;
  status: string;
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

        // Create user tournament reference with denormalized data
        const userTournamentRef = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
        transaction.set(userTournamentRef, {
          role: 'owner',
          joinedAt: serverTimestamp(),
          // Denormalized fields for fast loading
          name: input.name,
          format: input.format,
          contribution: input.contribution,
          participantsEstimated: input.participantsEstimated,
          inviteCode,
          status: 'active',
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

    // Get tournament data for denormalization
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    if (!tournamentDoc.exists()) {
      throw new Error('El torneo no existe');
    }

    const tournamentData = tournamentDoc.data();

    // Create member entry
    await setDoc(memberRef, {
      role: 'member',
      joinedAt: serverTimestamp(),
    });

    // Create user tournament reference with denormalized data
    const userTournamentRef = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
    await setDoc(userTournamentRef, {
      role: 'member',
      joinedAt: serverTimestamp(),
      // Denormalized fields for fast loading
      name: tournamentData.name,
      format: tournamentData.format,
      contribution: tournamentData.contribution,
      participantsEstimated: tournamentData.participantsEstimated,
      inviteCode: tournamentData.inviteCode,
      status: tournamentData.status,
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
 * Listen to user's tournament refs in real-time
 * Returns unsubscribe function
 * Now returns denormalized data directly from tournamentRefs
 */
export const listenMyTournamentRefs = (
  uid: string,
  callback: (refs: TournamentRef[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const tournamentRefsRef = collection(db, 'users', uid, 'tournamentRefs');
  const q = query(tournamentRefsRef, orderBy('joinedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const refs: TournamentRef[] = snapshot.docs.map(doc => ({
        tournamentId: doc.id,
        role: doc.data().role || 'member',
        joinedAt: doc.data().joinedAt,
        // Denormalized fields
        name: doc.data().name || '',
        format: doc.data().format || '',
        contribution: doc.data().contribution || 0,
        participantsEstimated: doc.data().participantsEstimated || 0,
        inviteCode: doc.data().inviteCode || '',
        status: doc.data().status || 'active',
      }));

      // Check if any refs are missing denormalized data or have mismatched status and fix them
      refs.forEach(async (ref) => {
        if (!ref.name || !ref.status) {
          try {
            const tournamentDoc = await getDoc(doc(db, 'tournaments', ref.tournamentId));
            if (tournamentDoc.exists()) {
              const tournamentData = tournamentDoc.data();
              const userTournamentRef = doc(db, 'users', uid, 'tournamentRefs', ref.tournamentId);
              await setDoc(userTournamentRef, {
                name: tournamentData.name,
                format: tournamentData.format,
                contribution: tournamentData.contribution,
                participantsEstimated: tournamentData.participantsEstimated,
                inviteCode: tournamentData.inviteCode,
                status: tournamentData.status || 'active',
              }, { merge: true });
            }
          } catch (error) {
            // Silent fail for migration
          }
        }
      });

      callback(refs);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Listen to a single tournament in real-time
 * Returns unsubscribe function
 */
export const listenTournament = (
  tournamentId: string,
  callback: (tournament: Tournament | null) => void
): Unsubscribe => {
  const tournamentRef = doc(db, 'tournaments', tournamentId);

  return onSnapshot(tournamentRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({
        id: snapshot.id,
        ...snapshot.data(),
      } as Tournament);
    } else {
      callback(null);
    }
  });
};

/**
 * Listen to user's role in a tournament in real-time
 * Returns unsubscribe function
 */
export const listenMyRole = (
  tournamentId: string,
  uid: string,
  callback: (role: string | null) => void
): Unsubscribe => {
  const memberRef = doc(db, 'tournaments', tournamentId, 'members', uid);

  return onSnapshot(memberRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data()?.role || null);
    } else {
      callback(null);
    }
  });
};

/**
 * Helper: Sync denormalized tournament data to all members' tournamentRefs
 * Call this after updating tournament fields that are denormalized
 */
const syncDenormalizedData = async (
  tournamentId: string,
  updates: Partial<Pick<TournamentRef, 'name' | 'format' | 'contribution' | 'participantsEstimated' | 'inviteCode' | 'status'>>
): Promise<void> => {
  try {
    // Get all members
    const membersRef = collection(db, 'tournaments', tournamentId, 'members');
    const membersSnapshot = await getDocs(membersRef);

    // Update each member's tournamentRef
    const updatePromises = membersSnapshot.docs.map(memberDoc => {
      const userId = memberDoc.id;
      const userTournamentRef = doc(db, 'users', userId, 'tournamentRefs', tournamentId);
      return setDoc(userTournamentRef, updates, { merge: true });
    });

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error syncing denormalized data:', error);
  }
};

/**
 * Update basic tournament fields (always allowed)
 * Also syncs denormalized data to all members
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

    // Sync denormalized data if name changed
    if (updates.name) {
      await syncDenormalizedData(tournamentId, { name: updates.name });
    }
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo actualizar el torneo');
  }
};

/**
 * Update tournament configuration (only if hasActivity is false)
 * Also syncs denormalized data to all members
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

    // Sync denormalized data
    const denormalizedUpdates: Partial<TournamentRef> = {};
    if (config.format) denormalizedUpdates.format = config.format;
    if (config.contribution !== undefined) denormalizedUpdates.contribution = config.contribution;
    if (config.participantsEstimated !== undefined) denormalizedUpdates.participantsEstimated = config.participantsEstimated;

    if (Object.keys(denormalizedUpdates).length > 0) {
      await syncDenormalizedData(tournamentId, denormalizedUpdates);
    }
  } catch (error: any) {
    throw error;
  }
};

/**
 * Archive a tournament (soft delete with status=archived)
 * Also syncs status to all members
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

    // Sync status to all members
    await syncDenormalizedData(tournamentId, { status: 'archived' });
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo archivar el torneo');
  }
};

/**
 * Soft delete a tournament (status=deleted)
 * Also syncs status to all members
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

    // Sync status to all members' tournamentRefs
    await syncDenormalizedData(tournamentId, { status: 'deleted' });
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo eliminar el torneo');
  }
};

/**
 * Search tournaments by name (searches all tournaments the user has access to)
 * Excludes deleted tournaments
 */
export const searchTournaments = async (searchQuery: string): Promise<Tournament[]> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para buscar torneos');
  }

  try {
    // Get all user's tournaments
    const myTournaments = await listMyTournaments();
    
    // Filter by search query (case insensitive) and exclude deleted tournaments
    const searchLower = searchQuery.toLowerCase();
    const filtered = myTournaments.filter(tournament => 
      tournament.status !== 'deleted' &&
      (tournament.name.toLowerCase().includes(searchLower) ||
      tournament.description?.toLowerCase().includes(searchLower) ||
      tournament.inviteCode.toLowerCase().includes(searchLower))
    );

    return filtered;
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo buscar torneos');
  }
};

/**
 * Utility function to fix desynchronized tournament refs
 * Syncs tournament status from main document to all members' refs
 * Useful after database updates or migrations
 */
export const syncTournamentRefsFromMain = async (tournamentId: string): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión');
  }

  try {
    // Get main tournament document
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    
    if (!tournamentDoc.exists()) {
      throw new Error('Torneo no encontrado');
    }

    const tournamentData = tournamentDoc.data() as Tournament;

    // Sync all denormalized fields to members
    await syncDenormalizedData(tournamentId, {
      name: tournamentData.name,
      format: tournamentData.format,
      contribution: tournamentData.contribution,
      participantsEstimated: tournamentData.participantsEstimated,
      inviteCode: tournamentData.inviteCode,
      status: tournamentData.status,
    });

    console.log(`✅ Synced tournament ${tournamentId} refs successfully`);
  } catch (error: any) {
    console.error('Error syncing tournament refs:', error);
    throw error;
  }
};
