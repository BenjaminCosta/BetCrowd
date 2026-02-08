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
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface Event {
  id: string;
  title: string;
  type: 'match' | 'round' | 'custom';
  startsAt: Timestamp | null;
  status: 'upcoming' | 'live' | 'finished' | 'cancelled';
  order: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Optional fields
  homeTeam?: string;
  awayTeam?: string;
  roundNumber?: number;
  notes?: string;
}

export type EventInput = Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

/**
 * List all events for a tournament, ordered by order asc, then startsAt asc
 */
export const listEvents = async (tournamentId: string): Promise<Event[]> => {
  try {
    const eventsRef = collection(db, `tournaments/${tournamentId}/events`);
    const q = query(eventsRef, orderBy('order', 'asc'));
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
    };
    
    await setDoc(eventRef, eventData);
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
