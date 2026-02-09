# Sistema CRUD de Eventos - BetCrowd (Refinado)

## Resumen
Sistema completo de gestión de eventos con integración Firebase Firestore, UI premium/profesional, y flujo completo de creación/edición con templates inteligentes basados en el formato del torneo.

## Últimas Mejoras (Refinamiento UI)

### 1. **Botones de Administrador Premium**
- ✅ Cambio de botones coloridos a diseño neutral y profesional
- ✅ Uso de `colors.card` y `colors.secondary` con bordes sutiles
- ✅ Solo íconos y texto tienen color (foreground, destructive, mutedForeground)
- ✅ Diseño consistente con el sistema de diseño existente
- ✅ Eliminado título "Acciones de administrador" para UI más limpia

### 2. **Funcionalidad de Edición Implementada**
- ✅ Botón "Editar" en EventDetailsScreen navega a CreateEventScreen con `editMode: true`
- ✅ CreateEventScreen detecta modo edición y precarga datos del evento
- ✅ Formulario muestra datos actuales (título, equipos, notas)
- ✅ Botón cambia a "Guardar Cambios" con ícono checkmark
- ✅ Usa `updateEvent()` con serverTimestamp para updatedAt
- ✅ Templates ocultos en modo edición (solo formulario)
- ✅ Navegación automática de vuelta tras guardar

### 3. **Templates Inteligentes Mejorados**
- ✅ Encabezados con íconos (flash para creación rápida, layers para bulk)
- ✅ Hints descriptivos más claros y profesionales
- ✅ Chips con bordes sutiles en lugar de fondos sólidos
- ✅ Sección de bulk creation con separador visual
- ✅ Mejor jerarquía visual entre templates y formulario custom
- ✅ Botones neutrales (card background) en lugar de primary
- ✅ Templates específicos por formato:
  - **liga**: "Fecha 1, Fecha 2, Fecha 3" + bulk 1-20
  - **eliminatoria**: "Octavos de final, Cuartos, Semifinal, Final"
  - **grupos-eliminatoria**: "Grupo A/B - Fecha 1" + playoffs
  - **serie**: "Juego 1, 2, 3" + bulk 1-20
  - **evento-unico**: "Evento principal"

### 4. **Botón "Crear Evento" Mejorado**
- ✅ En TournamentEventsScreen ahora usa diseño neutral
- ✅ Fondo `colors.card` con borde `colors.border`
- ✅ Ícono outline en lugar de filled
- ✅ Texto y color adaptados al tema

## Archivos Modificados

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

### 3. **src/screens/TournamentEventsScreen.tsx** (MODIFICADO + PREMIUM UI)
Lista de eventos con actualización en tiempo real:

**Características:**
- Listener onSnapshot para actualizaciones automáticas
- Badges de estado con colores:
  - PRÓXIMO (naranja)
  - EN VIVO (rojo)
  - FINALIZADO (gris)
  - CANCELADO (gris)
- **Botón "Crear Evento" premium**:
  - Fondo neutral `colors.card` con borde sutil
  - Ícono outline (`add-circle-outline`) en lugar de filled
  - Color adaptado al tema (`colors.foreground`)
  - Sin gradiente para look más profesional
- Cards con título, equipos (si aplica), status y timestamp
- Navegación a EventDetails con tournamentId + eventId
- Empty state adaptado según permisos de usuario

### 4. **src/screens/CreateEventScreen.tsx** (MODIFICADO + EDIT MODE)
Sistema de creación/edición adaptativa basado en formato de torneo:

#### Modo Edición:
- Detecta parámetro `editMode: true` del route
- Carga evento existente con `getEvent(tournamentId, eventId)`
- Precarga formulario con datos actuales
- Oculta templates (solo muestra formulario)
- Botón muestra "Guardar Cambios" con ícono checkmark
- Usa `updateEvent()` en lugar de `createEvent()`

#### Templates por Formato:
1. **liga**: 
   - Chips rápidos: "Fecha 1", "Fecha 2", "Fecha 3"
   - Sección bulk: Input numérico (1-20 fechas)
   - Diseño con separador visual entre quick y bulk

2. **eliminatoria**:
   - Templates: "Octavos de final", "Cuartos de final", "Semifinal", "Final"
   - Creación instantánea con un tap

3. **grupos-eliminatoria**:
   - "Grupo A - Fecha 1", "Grupo B - Fecha 1"
   - Templates playoff: "Cuartos de final", "Semifinal", "Final"

4. **serie**:
   - Chips rápidos: "Juego 1", "Juego 2", "Juego 3"
   - Sección bulk: Input numérico (1-20 juegos)

5. **evento-unico**:
   - Template único: "Evento principal"

#### UI Refinements:
- **Encabezados de sección** con íconos (flash, layers, create)
- **Hints descriptivos** más claros y profesionales
- **Chips neutrales** con borde sutil (`card` background + `border`)
- **Botones bulk** neutrales en lugar de primary color
- **Formulario** con encabezado icónico "Detalles del evento"
- **Jerarquía visual** clara entre templates y formulario custom
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

### 5. **src/screens/EventDetailsScreen.tsx** (MODIFICADO + PREMIUM UI)
Vista detallada del evento con acciones de admin premium:

**Información mostrada:**
- Título del evento con badge de status
- Equipos (homeTeam vs awayTeam) si aplican
- Fecha/hora del evento (startsAt) formateada
- Notas adicionales si existen

**Acciones de Administrador** (solo visible para owner/admin):
- **Diseño Premium**: Botones neutrales con fondo `card` y bordes sutiles
- **Editar**: Navega a CreateEventScreen con `editMode: true` y `eventId`
- **Cancelar**: Soft delete cambiando status a 'cancelled' con confirmación
- **Eliminar**: Hard delete permanente con doble confirmación Alert

**Mejoras UI**:
- Eliminado título "Acciones de administrador" para diseño más limpio
- Botones con borde sutil (`borderWidth: 1`, `borderColor: colors.border`)
- Íconos y texto con colores semánticos:
  - Editar: `colors.foreground` (neutral)
  - Cancelar: `colors.mutedForeground` (neutral apagado)
  - Eliminar: `colors.destructive` (rojo)
- Tamaño de ícono reducido a 18px para mejor proporción
- Font weight 600 en lugar de 700 para look más refinado
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
3. Toca botón neutral "Crear Evento" → CreateEventScreen
4. **Opción A - Template**: Elige template según formato (ej: "Fecha 1", "Semifinal")
5. **Opción B - Bulk**: Ingresa número 1-20 y crea múltiples eventos
6. **Opción C - Custom**: Completa formulario manual con todos los campos
7. Evento aparece automáticamente en lista (realtime)
8. Toca evento → EventDetailsScreen
9. Ve botones neutrales: Editar | Cancelar | Eliminar
10. **Editar**: Navega a CreateEventScreen precargado → modifica → "Guardar Cambios"
11. **Cancelar**: Marca como cancelado (soft delete)
12. **Eliminar**: Confirmación → eliminación permanente

### Miembro Regular:
1. Entra a TournamentDetailsScreen
2. Navega a pestaña "Eventos" → TournamentEventsScreen
3. Ve lista de eventos (sin botón crear)
4. Toca evento → EventDetailsScreen
5. Ve detalles completos (sin botones admin)
6. Puede hacer apuestas en los mercados disponibles

## Testing Checklist

### Creación:
- [ ] Admin puede crear evento con template rápido
- [ ] Admin puede crear 5 fechas masivamente (liga format)
- [ ] Admin puede crear evento custom con todos los campos
- [ ] Templates correctos según formato del torneo
- [ ] Bulk creation valida rango 1-20

### Edición:
- [ ] Admin puede editar evento desde EventDetailsScreen
- [ ] Formulario precarga datos actuales correctamente
- [ ] Cambios se guardan con updateEvent()
- [ ] Campo updatedAt se actualiza con serverTimestamp
- [ ] Navegación vuelve automáticamente tras guardar
- [ ] Lista se actualiza en tiempo real tras edición

### UI/UX:
- [ ] Lista de eventos se actualiza en tiempo real
- [ ] Status badges muestran colores correctos
- [ ] No-admin ve eventos pero no botón crear
- [ ] Botones admin son neutrales (no coloridos)
- [ ] Templates tienen diseño limpio con íconos
- [ ] Jerarquía visual clara entre secciones

### Permisos:
- [ ] EventDetails muestra datos reales del evento
- [ ] Editar/cancelar/eliminar solo visible para admins
- [ ] Cancelar evento cambia status correctamente
- [ ] Eliminar evento pide confirmación doble

## Próximos Pasos (Opcionales)

1. ~~Implementar funcionalidad de edición~~ ✅ COMPLETADO
2. Agregar date/time picker para `startsAt`
3. Botones para cambiar status (upcoming → live → finished)
4. Reordenamiento drag/drop para campo `order`
5. Mostrar contador de eventos en TournamentDetailsScreen
6. Filtros por status en TournamentEventsScreen
7. Animaciones sutiles en templates (opcional)
8. Haptic feedback en botones (opcional)

## Notas Técnicas

- Todos los timestamps usan `serverTimestamp()` para consistencia
- Campo `order` se auto-incrementa consultando último evento
- Batch operations para evitar rate limits en creación masiva
- Realtime listeners se limpian automáticamente con `unsubscribe`
- Loading states previenen doble-submit
- Alerts nativas de React Native para confirmaciones
