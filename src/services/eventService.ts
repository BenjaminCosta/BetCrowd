import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

// ─── Internal helpers ────────────────────────────────────────────────────────
/** Touch lastActivityAt on the parent tournament (best-effort, non-blocking). */
const _touchTournamentActivity = (tournamentId: string): void => {
  const ref = doc(db, 'tournaments', tournamentId);
  setDoc(ref, { lastActivityAt: serverTimestamp(), hasActivity: true }, { merge: true }).catch(() => {});
  // Also update current user's ref so home-screen sort stays fresh
  const uid = auth.currentUser?.uid;
  if (uid) {
    const userRef = doc(db, 'users', uid, 'tournamentRefs', tournamentId);
    setDoc(userRef, { lastActivityAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }
};

export interface Event {
  id: string;
  title: string;
  type: 'match' | 'round' | 'custom';
  startsAt: Timestamp | null;
  status: 'upcoming' | 'live' | 'finished' | 'cancelled' | 'locked';
  order: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Optional fields
  homeTeam?: string;
  awayTeam?: string;
  roundNumber?: number;
  notes?: string;
  date?: string; // YYYY-MM-DD
}

export type EventInput = Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

/**
 * List all events for a tournament, ordered by order asc, then startsAt asc
 */
export const listEvents = async (tournamentId: string): Promise<Event[]> => {
  try {
    const eventsRef = collection(db, `tournaments/${tournamentId}/events`);
    const q = query(eventsRef, orderBy('order', 'asc'), limit(100));
    const snapshot = await getDocs(q);
    
    const events: Event[] = [];
    snapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() } as Event);
    });
    
    return events;
  } catch (error) {
    console.error('Error listing events:', error);
    throw new Error('No se pudieron cargar los eventos');
  }
};

/**
 * Listen to events in realtime
 */
export const listenEvents = (
  tournamentId: string,
  callback: (events: Event[]) => void
): (() => void) => {
  const eventsRef = collection(db, `tournaments/${tournamentId}/events`);
  const q = query(eventsRef, orderBy('order', 'asc'));
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const events: Event[] = [];
      snapshot.forEach((doc) => {
        events.push({ id: doc.id, ...doc.data() } as Event);
      });
      callback(events);
    },
    (error) => {
      console.error('Error listening to events:', error);
      callback([]);
    }
  );
  
  return unsubscribe;
};

/**
 * Lock all past-due upcoming events for a tournament.
 * Call once per session from admin clients when they open the tournament.
 */
export const lockPastEvents = async (tournamentId: string): Promise<void> => {
  try {
    const eventsRef = collection(db, `tournaments/${tournamentId}/events`);
    const q = query(eventsRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    const today = new Date().toISOString().split('T')[0];
    let currentBatch = writeBatch(db);
    let writeCounter = 0;
    const lockedEventIds: string[] = [];
    const eventDocsToLock: typeof snapshot.docs = [];

    // Flush and rotate batch when approaching Firestore's 500-write limit
    const safeUpdate = async (ref: any, data: any) => {
      if (writeCounter >= 450) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        writeCounter = 0;
      }
      currentBatch.update(ref, data);
      writeCounter++;
    };

    for (const d of snapshot.docs) {
      const data = d.data();
      if ((data.status === 'upcoming' || data.status === 'live') && data.date && data.date < today) {
        await safeUpdate(d.ref, { status: 'locked', updatedAt: serverTimestamp() });
        eventDocsToLock.push(d);
      } else if (data.status === 'locked') {
        lockedEventIds.push(d.id);
      }
    }

    // Also lock/void all non-settled bets inside each newly-locked event
    for (const eventDoc of eventDocsToLock) {
      const betsRef = collection(db, `tournaments/${tournamentId}/events/${eventDoc.id}/bets`);
      const betsSnap = await getDocs(betsRef);
      for (const betDoc of betsSnap.docs) {
        const bs = betDoc.data().status;
        if (bs === 'open') {
          await safeUpdate(betDoc.ref, { status: 'locked', updatedAt: serverTimestamp() });
        } else if (bs === 'pending') {
          // Pending = never reached 2 sides — void immediately so it doesn't block event finish
          await safeUpdate(betDoc.ref, {
            status: 'settled',
            result: { void: true },
            settledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    if (writeCounter > 0) {
      await currentBatch.commit();
    }

    // For already-locked events: lock any stale open bets, then check auto-finish
    for (const eventId of lockedEventIds) {
      try {
        const betsRef = collection(db, `tournaments/${tournamentId}/events/${eventId}/bets`);
        const betsSnap = await getDocs(betsRef);
        if (betsSnap.empty) continue;
        // Lock/void stale bets that slipped through before the cascade fix
        const staleBetDocs = betsSnap.docs.filter((d) => {
          const s = d.data().status;
          return s === 'open' || s === 'pending';
        });
        if (staleBetDocs.length > 0) {
          const BATCH_LIMIT = 500;
          for (let i = 0; i < staleBetDocs.length; i += BATCH_LIMIT) {
            const chunk = staleBetDocs.slice(i, i + BATCH_LIMIT);
            const betBatch = writeBatch(db);
            chunk.forEach((betDoc) => {
              if (betDoc.data().status === 'open') {
                betBatch.update(betDoc.ref, { status: 'locked', updatedAt: serverTimestamp() });
              } else {
                // pending → void; never reached 2 sides so there's nothing to settle
                betBatch.update(betDoc.ref, {
                  status: 'settled',
                  result: { void: true },
                  settledAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            });
            await betBatch.commit();
          }
        }
        // Re-read to reflect freshly-locked/voided status before auto-finish check
        const freshBetsSnap = await getDocs(betsRef);
        const hasPending = freshBetsSnap.docs.some((d) => {
          const s = d.data().status;
          return s === 'open' || s === 'locked' || s === 'pending';
        });
        if (!hasPending) {
          const eventRef = doc(db, `tournaments/${tournamentId}/events`, eventId);
          await updateDoc(eventRef, { status: 'finished', updatedAt: serverTimestamp() });
        }
      } catch {
        // skip this event on error
      }
    }

    // Dispatch event_locked notifications for newly auto-locked events (best-effort)
    if (eventDocsToLock.length > 0) {
      const notifActorUid = auth.currentUser?.uid;
      // Firestore rules require fromUid == request.auth.uid for writes to other users'
      // notification subcollections. Skip silently if no auth session is active.
      if (notifActorUid) {
        try {
          const membersSnap = await getDocs(collection(db, `tournaments/${tournamentId}/members`));
          const memberUids = membersSnap.docs.map((d) => d.id);
          for (const eventDoc of eventDocsToLock) {
            const eventTitle: string = eventDoc.data().title ?? 'Evento sin título';
            for (let i = 0; i < memberUids.length; i += 20) {
              const chunk = memberUids.slice(i, i + 20);
              const notifBatch = writeBatch(db);
              chunk.forEach((uid) => {
                const notifRef = doc(collection(db, 'users', uid, 'notifications'));
                notifBatch.set(notifRef, {
                  type: 'event_locked',
                  title: 'Apuestas cerradas',
                  body: `Se cerraron las apuestas de "${eventTitle}"`,
                  fromUid: notifActorUid,
                  tournamentId,
                  eventId: eventDoc.id,
                  meta: { tournamentId, eventId: eventDoc.id },
                  createdAt: serverTimestamp(),
                  readAt: null,
                });
              });
              await notifBatch.commit();
            }
          }
        } catch (err) {
          if (__DEV__) console.warn('lockPastEvents: failed to send event_locked notifications', err);
        }
      }
    }
  } catch {
    // Best-effort — non-critical
  }
};

/**
 * Get a single event by ID
 */
export const getEvent = async (tournamentId: string, eventId: string): Promise<Event | null> => {
  try {
    const eventRef = doc(db, `tournaments/${tournamentId}/events`, eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      return null;
    }
    
    return { id: eventDoc.id, ...eventDoc.data() } as Event;
  } catch (error) {
    console.error('Error getting event:', error);
    throw new Error('No se pudo cargar el evento');
  }
};

/**
 * Create a new event with auto-incremented order
 */
export const createEvent = async (
  tournamentId: string,
  input: Partial<EventInput>
): Promise<string> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Debes iniciar sesión para crear eventos');
    }
    
    // Get current max order
    const events = await listEvents(tournamentId);
    const maxOrder = events.length > 0 ? Math.max(...events.map(e => e.order)) : 0;
    
    const eventRef = doc(collection(db, `tournaments/${tournamentId}/events`));
    const eventData = {
      title: input.title || 'Evento sin título',
      type: input.type || 'custom',
      startsAt: input.startsAt || null,
      status: input.status || 'upcoming',
      order: input.order !== undefined ? input.order : maxOrder + 1,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(input.homeTeam && { homeTeam: input.homeTeam }),
      ...(input.awayTeam && { awayTeam: input.awayTeam }),
      ...(input.roundNumber !== undefined && { roundNumber: input.roundNumber }),
      ...(input.notes && { notes: input.notes }),
      ...(input.date && { date: input.date }),
    };
    
    await setDoc(eventRef, eventData);
    _touchTournamentActivity(tournamentId);
    return eventRef.id;
  } catch (error: any) {
    console.error('Error creating event:', error);
    throw new Error(error.message || 'No se pudo crear el evento');
  }
};

/**
 * Bulk create events (for templates)
 */
export const createEventsBatch = async (
  tournamentId: string,
  inputs: Partial<EventInput>[]
): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Debes iniciar sesión para crear eventos');
    }
    
    // Get current max order
    const events = await listEvents(tournamentId);
    let currentOrder = events.length > 0 ? Math.max(...events.map(e => e.order)) : 0;
    
    const batch = writeBatch(db);
    
    inputs.forEach((input) => {
      currentOrder++;
      const eventRef = doc(collection(db, `tournaments/${tournamentId}/events`));
      const eventData = {
        title: input.title || 'Evento sin título',
        type: input.type || 'custom',
        startsAt: input.startsAt || null,
        status: input.status || 'upcoming',
        order: currentOrder,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(input.homeTeam && { homeTeam: input.homeTeam }),
        ...(input.awayTeam && { awayTeam: input.awayTeam }),
        ...(input.roundNumber !== undefined && { roundNumber: input.roundNumber }),
        ...(input.notes && { notes: input.notes }),
        ...(input.date && { date: input.date }),
      };
      batch.set(eventRef, eventData);
    });
    
    await batch.commit();
  } catch (error: any) {
    console.error('Error creating events batch:', error);
    throw new Error(error.message || 'No se pudieron crear los eventos');
  }
};

/**
 * Update an existing event
 */
export const updateEvent = async (
  tournamentId: string,
  eventId: string,
  patch: Partial<Omit<Event, 'id' | 'createdBy' | 'createdAt'>>
): Promise<void> => {
  try {
    const eventRef = doc(db, `tournaments/${tournamentId}/events`, eventId);
    await updateDoc(eventRef, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    // Cascade-lock all open bets when the event is being locked
    if (patch.status === 'locked') {
      const betsRef = collection(db, `tournaments/${tournamentId}/events/${eventId}/bets`);
      const betsSnap = await getDocs(betsRef);
      const batchLock = writeBatch(db);
      let hasBets = false;
      betsSnap.docs.forEach((betDoc) => {
        const bs = betDoc.data().status;
        if (bs === 'open') {
          batchLock.update(betDoc.ref, { status: 'locked', updatedAt: serverTimestamp() });
          hasBets = true;
        } else if (bs === 'pending') {
          // Pending = never reached 2 sides — void so it doesn’t block event finish
          batchLock.update(betDoc.ref, {
            status: 'settled',
            result: { void: true },
            settledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          hasBets = true;
        }
      });
      if (hasBets) await batchLock.commit();
    }
  } catch (error: any) {
    console.error('Error updating event:', error);
    throw new Error(error.message || 'No se pudo actualizar el evento');
  }
};

/**
 * Delete an event (hard delete)
 */
export const deleteEvent = async (tournamentId: string, eventId: string): Promise<void> => {
  try {
    const eventRef = doc(db, `tournaments/${tournamentId}/events`, eventId);
    await deleteDoc(eventRef);
  } catch (error: any) {
    console.error('Error deleting event:', error);
    throw new Error(error.message || 'No se pudo eliminar el evento');
  }
};

/**
 * Soft delete an event by setting status to cancelled
 */
export const cancelEvent = async (tournamentId: string, eventId: string): Promise<void> => {
  try {
    await updateEvent(tournamentId, eventId, { status: 'cancelled' });
  } catch (error: any) {
    console.error('Error cancelling event:', error);
    throw new Error(error.message || 'No se pudo cancelar el evento');
  }
};
