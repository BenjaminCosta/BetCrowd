# Sistema CRUD de Eventos - BetCrowd

## Resumen
Se ha implementado un sistema completo de gestión de eventos con integración a Firebase Firestore, incluyendo operaciones CRUD (Create, Read, Update, Delete) y UI adaptativa basada en el formato del torneo.

## Archivos Modificados/Creados

### 1. **src/services/eventService.ts** (NUEVO)
Servicio completo de gestión de eventos con las siguientes funciones:

#### Funciones de Lectura:
- `listEvents(tournamentId)`: Lista todos los eventos ordenados por campo `order`
- `listenEvents(tournamentId, callback)`: Listener en tiempo real para actualizaciones automáticas
- `getEvent(tournamentId, eventId)`: Obtiene un evento específico

#### Funciones de Escritura:
- `createEvent(tournamentId, input)`: Crea un evento con auto-incremento del campo `order`
- `createEventsBatch(tournamentId, inputs[])`: Creación masiva con `writeBatch` para liga/serie
- `updateEvent(tournamentId, eventId, patch)`: Actualiza un evento con timestamp
- `deleteEvent(tournamentId, eventId)`: Eliminación permanente
- `cancelEvent(tournamentId, eventId)`: Soft delete mediante `status='cancelled'`

#### Interface Event:
```typescript
{
  id: string;
  title: string;
  type: 'match' | 'round' | 'custom';
  startsAt: Timestamp | null;
  status: 'upcoming' | 'live' | 'finished' | 'cancelled';
  order: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Opcionales:
  homeTeam?: string;
  awayTeam?: string;
  roundNumber?: number;
  notes?: string;
}
```

### 2. **src/services/tournamentService.ts** (MODIFICADO)
Agregado:
- `isUserAdmin(tournamentId, uid)`: Retorna `true` si el usuario es 'owner' o 'admin'

### 3. **src/screens/TournamentEventsScreen.tsx** (MODIFICADO)
Lista de eventos con actualización en tiempo real:

**Características:**
- Listener onSnapshot para actualizaciones automáticas
- Badges de estado con colores:
  - PRÓXIMO (naranja)
  - EN VIVO (rojo)
  - FINALIZADO (gris)
  - CANCELADO (gris)
- Botón "Crear Evento" visible solo para admins
- Cards con título, equipos (si aplica), status y timestamp
- Navegación a EventDetails con tournamentId + eventId
- Empty state adaptado según permisos de usuario

### 4. **src/screens/CreateEventScreen.tsx** (MODIFICADO)
Sistema de creación adaptativa basado en formato de torneo:

#### Templates por Formato:
1. **liga**: 
   - Botones "Fecha 1", "Fecha 2", "Fecha 3"
   - Input numérico para crear múltiples fechas (1-20)
   - Creación masiva con `createEventsBatch()`

2. **eliminatoria**:
   - Templates: "Octavos", "Cuartos", "Semifinal", "Final"
   - Creación rápida con un tap

3. **grupos-eliminatoria**:
   - "Fase de grupos - Fecha 1", "Fase de grupos - Fecha 2"
   - Templates playoff: "Cuartos", "Semifinal", "Final"

4. **serie**:
   - Botones "Juego 1", "Juego 2"
   - Input numérico para crear múltiples juegos (1-20)
   - Creación masiva

5. **evento-unico**:
   - Template único: "Evento principal"

#### Formulario Custom:
- Campo título* (requerido)
- homeTeam (opcional)
- awayTeam (opcional)
- notes (opcional)
- Botón "Crear Evento" con loading state

**Flujo:**
1. Carga datos del torneo para detectar formato
2. Renderiza templates según formato
3. Permite creación rápida o custom
4. Alert de confirmación y navegación automática al volver

### 5. **src/screens/EventDetailsScreen.tsx** (MODIFICADO)
Vista detallada del evento con acciones de admin:

**Información mostrada:**
- Título del evento con badge de status
- Equipos (homeTeam vs awayTeam) si aplican
- Fecha/hora del evento (startsAt) formateada
- Notas adicionales si existen

**Acciones de Administrador** (solo visible para owner/admin):
- **Editar**: Botón preparado (próximamente funcional)
- **Cancelar**: Marca evento como cancelado con confirmación
- **Eliminar**: Eliminación permanente con doble confirmación

**UI:**
- Loading state mientras carga datos
- Empty state si evento no existe
- Mantiene secciones de mercados (Ganador, Método) para apuestas futuras
- Usa nombres de equipos reales en opciones de apuesta

### 6. **src/navigation/AppNavigator.tsx**
Todas las rutas ya configuradas:
- `TournamentEvents`: Lista de eventos
- `CreateEvent`: Crear nuevo evento
- `EventDetails`: Detalles del evento

## Estructura Firestore

```
tournaments/
  {tournamentId}/
    events/
      {eventId}/
        - id: string
        - title: string
        - type: 'match' | 'round' | 'custom'
        - startsAt: Timestamp | null
        - status: 'upcoming' | 'live' | 'finished' | 'cancelled'
        - order: number (auto-incrementado)
        - createdBy: string (uid)
        - createdAt: Timestamp (serverTimestamp)
        - updatedAt: Timestamp (serverTimestamp)
        - homeTeam?: string
        - awayTeam?: string
        - roundNumber?: number
        - notes?: string
```

## Reglas de Seguridad Firestore (Sugeridas)

```javascript
match /tournaments/{tournamentId}/events/{eventId} {
  // Leer: cualquier miembro del torneo
  allow read: if isAuthenticated() && isTournamentMember(tournamentId);
  
  // Crear/Actualizar/Eliminar: solo owner/admin
  allow create, update, delete: if isAuthenticated() && 
    (getTournamentRole(tournamentId) == 'owner' || 
     getTournamentRole(tournamentId) == 'admin');
}
```

## Flujo de Usuario

### Admin/Owner:
1. Entra a TournamentDetailsScreen
2. Navega a pestaña "Eventos" → TournamentEventsScreen
3. Toca "Crear Evento" → CreateEventScreen
4. Elige template según formato o crea custom
5. Evento aparece automáticamente en lista (realtime)
6. Toca evento → EventDetailsScreen
7. Puede editar, cancelar o eliminar

### Miembro Regular:
1. Entra a TournamentDetailsScreen
2. Navega a pestaña "Eventos" → TournamentEventsScreen
3. Ve lista de eventos (sin botón crear)
4. Toca evento → EventDetailsScreen
5. Ve detalles y puede hacer apuestas (sin botones admin)

## Testing Checklist

- [ ] Admin puede crear evento con template
- [ ] Admin puede crear 5 fechas masivamente (liga)
- [ ] Admin puede crear evento custom con todos los campos
- [ ] Lista de eventos se actualiza en tiempo real
- [ ] Status badges muestran colores correctos
- [ ] No-admin ve eventos pero no botón crear
- [ ] EventDetails muestra datos reales del evento
- [ ] Editar/eliminar solo visible para admins
- [ ] Cancelar evento cambia status correctamente
- [ ] Eliminar evento pide confirmación y borra permanentemente

## Próximos Pasos (Opcionales)

1. Implementar funcionalidad de edición inline
2. Agregar date/time picker para `startsAt`
3. Botones para cambiar status (upcoming → live → finished)
4. Reordenamiento drag/drop para campo `order`
5. Mostrar contador de eventos en TournamentDetailsScreen
6. Filtros por status en TournamentEventsScreen

## Notas Técnicas

- Todos los timestamps usan `serverTimestamp()` para consistencia
- Campo `order` se auto-incrementa consultando último evento
- Batch operations para evitar rate limits en creación masiva
- Realtime listeners se limpian automáticamente con `unsubscribe`
- Loading states previenen doble-submit
- Alerts nativas de React Native para confirmaciones
