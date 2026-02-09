# Sistema CRUD de Apuestas (Bets) - BetCrowd

## Resumen
Sistema completo de gestión de apuestas con picks de participantes usando Firebase Firestore. Los administradores pueden crear/editar/cerrar/resolver apuestas, y los miembros pueden realizar sus predicciones.

## Estructura de Datos Firestore

### Bets (Apuestas)
```
tournaments/{tournamentId}/events/{eventId}/bets/{betId}
├── id: string
├── title: string
├── description?: string
├── type: "winner" | "score" | "over_under" | "custom"
├── options: string[] (opciones para elegir)
├── stakeType: "fixed" | "free"
├── stakeAmount: number (monto de la apuesta)
├── status: "open" | "locked" | "settled" | "cancelled"
├── closesAt?: Timestamp | null
├── createdBy: uid
├── createdAt: serverTimestamp()
├── updatedAt: serverTimestamp()
├── result?: any (resultado ganador, se llena al resolver)
└── line?: number (solo para over_under)
```

### Picks (Predicciones)
```
tournaments/{tournamentId}/events/{eventId}/bets/{betId}/picks/{uid}
├── uid: string (mismo que docId)
├── selection: string | { home: number, away: number }
├── stakeAmount: number
├── createdAt: serverTimestamp()
└── updatedAt: serverTimestamp()
```

## Archivos Implementados

### 1. **src/services/betService.ts** (NUEVO)
Servicio completo con todas las operaciones CRUD:

#### Funciones de Bets:
- `listBets(tournamentId, eventId)`: Lista todas las apuestas ordenadas por fecha
- `listenBets(tournamentId, eventId, callback)`: Listener en tiempo real
- `getBet(tournamentId, eventId, betId)`: Obtiene una apuesta específica
- `createBet(tournamentId, eventId, input)`: Crea nueva apuesta (admin only)
- `updateBet(tournamentId, eventId, betId, patch)`: Actualiza apuesta (admin only)
- `deleteBet(tournamentId, eventId, betId)`: Eliminación permanente
- `cancelBet(tournamentId, eventId, betId)`: Soft delete (status='cancelled')
- `lockBet(tournamentId, eventId, betId)`: Cierra apuesta (status='locked')
- `settleBet(tournamentId, eventId, betId, result)`: Resuelve apuesta (status='settled')

#### Funciones de Picks:
- `getMyPick(tournamentId, eventId, betId, uid)`: Obtiene pick del usuario
- `upsertMyPick(tournamentId, eventId, betId, uid, selection, stakeAmount)`: Crea/actualiza pick
- `listenMyPick(tournamentId, eventId, betId, uid, callback)`: Listener en tiempo real
- `getAllPicks(tournamentId, eventId, betId)`: Obtiene todos los picks (admin)
- `hasUserPicked(tournamentId, eventId, betId, uid)`: Verifica si usuario apostó

### 2. **src/screens/BetsListScreen.tsx** (NUEVO)
Lista de apuestas por evento con actualización en tiempo real:

**Características:**
- Listener `onSnapshot` para actualizaciones automáticas
- Badges de estado:
  - ABIERTA (verde) - Se pueden hacer apuestas
  - CERRADA (amarillo) - No se aceptan más apuestas
  - RESUELTA (gris) - Ya tiene ganador
  - CANCELADA (gris) - Fue cancelada
- Botón "Crear Apuesta" solo para admins (neutral style)
- Cards muestran:
  - Título y tipo de apuesta
  - Descripción si existe
  - Monto de apuesta
  - Indicador "Ya apostaste" si el usuario tiene pick
- Empty state adaptado según permisos
- Navegación a BetDetails con tournamentId + eventId + betId

### 3. **src/screens/CreateBetScreen.tsx** (NUEVO)
Formulario de creación de apuestas con templates inteligentes:

#### Plantillas Rápidas:
1. **Ganador**:
   - Precarga título "Ganador del partido"
   - Si evento tiene equipos: usa nombres reales
   - Si no: usa "Local", "Empate", "Visitante"

2. **Más/Menos**:
   - Título "Total de goles"
   - Línea por defecto: 2.5
   - Opciones: "Más de 2.5", "Menos de 2.5"

3. **Resultado Exacto**:
   - Título "Resultado exacto"
   - Tipo 'score' para input de marcador

#### Formulario:
- **Título*** (requerido)
- **Descripción** (opcional)
- **Tipo de apuesta**: Winner, Más/Menos, Resultado, Personalizada
- **Línea** (solo para Más/Menos)
- **Opciones**: Lista dinámica con botones +/- (no aplica para score)
- **Monto de apuesta***: Por defecto usa `tournament.contribution`

#### UI:
- Templates con íconos (trophy, trending-up, calculator)
- Chips de tipo con selección visual (borde primary)
- Botón "Crear Apuesta" con primary color
- Validaciones antes de crear

### 4. **src/screens/BetDetailsScreen.tsx** (NUEVO)
Vista detallada de apuesta con UI para hacer picks:

#### Información de la Apuesta:
- Título y badge de status
- Descripción si existe
- Monto de apuesta
- Metadatos adicionales

#### Acciones de Admin (solo para owner/admin):
- **Cerrar**: Cambia status a 'locked' (no más picks)
- **Resolver**: Cambia status a 'settled' + ingresa resultado
- **Cancelar**: Soft delete (status='cancelled')
- Botones con estilo neutral (card background)

#### Tu Apuesta (si existe):
- Muestra selección actual
- Si apuesta está abierta: permite editar
- Hint "Puedes cambiar tu selección mientras esté abierta"

#### Hacer/Editar Apuesta:
**Para tipo "winner", "over_under", "custom":**
- Chips de opciones con selección visual
- Click en opción deseada
- Botón "Confirmar Apuesta" / "Actualizar Apuesta"

**Para tipo "score":**
- Inputs grandes para marcador Local - Visitante
- Teclado numérico
- Separador visual "-"

#### Estados:
- Si apuesta cerrada/resuelta/cancelada: muestra mensaje y deshabilita UI
- Loading states durante operaciones
- Alerts de confirmación en acciones admin

### 5. **src/navigation/AppNavigator.tsx** (MODIFICADO)
Agregadas rutas:
- `BetsList`: Lista de apuestas de un evento
- `CreateBet`: Crear nueva apuesta
- `BetDetails`: Detalles y hacer pick

### 6. **src/screens/EventDetailsScreen.tsx** (MODIFICADO)
Agregado:
- Botón "Ver Apuestas" con navegación a BetsList
- Estilo neutral con ícono cash-outline y chevron-forward
- Ubicado entre header y admin actions

## Flujo de Usuario

### Admin/Owner:
1. Entra a EventDetails
2. Click "Ver Apuestas" → BetsListScreen
3. Click "Crear Apuesta" → CreateBetScreen
4. Elige plantilla O llena formulario custom
5. Apuesta aparece automáticamente en lista (realtime)
6. Click en apuesta → BetDetailsScreen
7. Puede ver picks de usuarios
8. Acciones disponibles:
   - **Cerrar** (cuando quiera detener predicciones)
   - **Resolver** (cuando tenga resultado ganador)
   - **Cancelar** (si apuesta no procede)

### Miembro Regular:
1. Entra a EventDetails
2. Click "Ver Apuestas" → BetsListScreen
3. Ve lista de apuestas con status
4. Click en apuesta → BetDetailsScreen
5. Si apuesta está abierta:
   - Ve formulario "Hacer tu apuesta"
   - Selecciona opción (o ingresa marcador si es score)
   - Click "Confirmar Apuesta"
   - Aparece "Tu apuesta" con selección
6. Si ya apostó y apuesta sigue abierta:
   - Puede cambiar selección
   - Click "Actualizar Apuesta"
7. Si apuesta cerrada/resuelta:
   - Ve su pick pero no puede editar
   - Ve mensaje de estado

## Tipos de Apuestas

### 1. Winner (Ganador)
```typescript
{
  type: 'winner',
  options: ['Local', 'Empate', 'Visitante'],
  // Pick: selection: string
}
```

### 2. Over/Under (Más/Menos)
```typescript
{
  type: 'over_under',
  line: 2.5,
  options: ['Más de 2.5', 'Menos de 2.5'],
  // Pick: selection: string
}
```

### 3. Score (Resultado Exacto)
```typescript
{
  type: 'score',
  options: ['Formato: Local X - X Visitante'],
  // Pick: selection: { home: number, away: number }
}
```

### 4. Custom (Personalizada)
```typescript
{
  type: 'custom',
  options: ['Opción 1', 'Opción 2', 'Opción 3', ...],
  // Pick: selection: string
}
```

## Estados de Apuestas

| Status | Color | Significado | Acciones Disponibles |
|--------|-------|-------------|---------------------|
| **open** | Verde (success) | Abierta para picks | Miembros: hacer/editar pick<br>Admin: cerrar, cancelar |
| **locked** | Amarillo (warning) | Cerrada, esperando resultado | Admin: resolver, cancelar |
| **settled** | Gris (default) | Resuelta con ganador | Solo lectura |
| **cancelled** | Gris (default) | Cancelada | Solo lectura |

## Reglas de Negocio

### Permisos:
- ✅ **Miembros** pueden:
  - Ver lista de apuestas
  - Ver detalles de cualquier apuesta
  - Crear/editar su propio pick (solo si apuesta está abierta)
  
- ✅ **Admins/Owners** pueden:
  - Todo lo anterior +
  - Crear apuestas
  - Editar apuestas (con restricciones)
  - Cerrar apuestas (cambiar a locked)
  - Resolver apuestas (cambiar a settled + resultado)
  - Cancelar apuestas

### Validaciones:
- ✅ Título requerido
- ✅ Mínimo 2 opciones para winner/custom/over_under
- ✅ Monto debe ser número válido >= 0
- ✅ No se puede editar apuesta crítica si ya hay picks (opcional, pendiente implementar)
- ✅ Solo se puede hacer pick si apuesta está "open"
- ✅ Pick usa stakeAmount de la apuesta

### Default Values:
- `stakeAmount`: tournament.contribution o 0
- `status`: "open" al crear
- `options`: [] si no se especifica
- `closesAt`: null (sin límite de tiempo por ahora)

## Estilos y Diseño

### Paleta de Colores:
- ✅ **Neutral surfaces**: `card` + `border` para la mayoría de botones
- ✅ **Primary (red)**: Solo CTA principal "Crear", "Confirmar"
- ✅ **Accent (orange)**: Íconos decorativos en headers
- ✅ **Success (green)**: Status "ABIERTA", indicador "Ya apostaste"
- ✅ **Warning (yellow)**: Status "CERRADA"
- ✅ **Destructive (red)**: Botón cancelar, íconos de eliminar

### Componentes Consistentes:
- ✅ TopBar con back button
- ✅ Cards para agrupación
- ✅ Badges para status
- ✅ Chips para selección de opciones
- ✅ Input component reutilizado
- ✅ Loading states con ActivityIndicator
- ✅ Empty states con íconos grandes

### Jerarquía Visual:
- ✅ Títulos grandes y bold (28px, 900 weight)
- ✅ Subtítulos con color muted
- ✅ Secciones separadas por Cards
- ✅ Spacing consistente (lg=16, xl=24)
- ✅ BorderRadius uniforme (md=12)

## Testing Checklist

### Creación:
- [ ] Admin puede crear apuesta con plantilla "Ganador"
- [ ] Plantilla precarga equipos si evento los tiene
- [ ] Admin puede crear apuesta "Más/Menos" con línea
- [ ] Admin puede crear apuesta personalizada con opciones custom
- [ ] Monto por defecto es tournament.contribution
- [ ] Apuesta aparece en lista instantáneamente

### Visualización:
- [ ] Lista muestra todas las apuestas del evento
- [ ] Badges de status correctos
- [ ] "Ya apostaste" aparece si usuario tiene pick
- [ ] Empty state correcto para admin vs miembro
- [ ] Realtime updates funcionan

### Hacer Pick:
- [ ] Miembro puede hacer pick en apuesta abierta
- [ ] Opciones se muestran como chips seleccionables
- [ ] Score type muestra inputs para marcador
- [ ] Pick se guarda correctamente
- [ ] "Tu apuesta" muestra selección actual
- [ ] Puede editar pick si apuesta sigue abierta

### Acciones Admin:
- [ ] Solo admin ve botones de administración
- [ ] Cerrar apuesta funciona (status→locked)
- [ ] Resolver apuesta funciona (status→settled)
- [ ] Cancelar apuesta funciona (status→cancelled)
- [ ] Confirmaciones Alert antes de acciones destructivas

### Edge Cases:
- [ ] No se puede hacer pick si apuesta cerrada
- [ ] No se puede editar pick si apuesta cerrada
- [ ] Mensaje correcto si apuesta cancelada
- [ ] Validación de campos requeridos
- [ ] Manejo de NaN en montos

## Próximos Pasos (Opcionales)

1. **Resolver Apuesta - UI mejorada**:
   - Modal para seleccionar opción ganadora
   - Calcular ganadores automáticamente
   - Mostrar distribución de apuestas

2. **Fecha de cierre automática**:
   - Implementar `closesAt` con date picker
   - Job automático que cierra apuestas vencidas

3. **Estadísticas**:
   - Mostrar distribución de picks (% por opción)
   - Total apostado en cada opción
   - Odds calculados

4. **Historial**:
   - Ver apuestas ganadas/perdidas
   - Leaderboard de participantes
   - Stats por torneo

5. **Notificaciones**:
   - Push cuando se crea nueva apuesta
   - Recordatorio antes de que cierre
   - Notificación cuando se resuelve

6. **Edición Avanzada**:
   - Verificar si hay picks antes de editar
   - Permitir editar solo campos no-críticos
   - Mostrar warning si intenta cambiar opciones

## Firestore Security Rules (Sugeridas)

```javascript
match /tournaments/{tournamentId}/events/{eventId}/bets/{betId} {
  // Leer: cualquier miembro del torneo
  allow read: if isAuthenticated() && isTournamentMember(tournamentId);
  
  // Crear/Actualizar/Eliminar: solo owner/admin
  allow create, update, delete: if isAuthenticated() && 
    (getTournamentRole(tournamentId) == 'owner' || 
     getTournamentRole(tournamentId) == 'admin');
  
  // Picks subcollection
  match /picks/{uid} {
    // Leer: cualquier miembro
    allow read: if isAuthenticated() && isTournamentMember(tournamentId);
    
    // Crear/Actualizar/Eliminar: solo el dueño del pick
    allow create, update, delete: if isAuthenticated() && 
      request.auth.uid == uid &&
      isTournamentMember(tournamentId);
  }
}
```

## Notas Técnicas

- ✅ Todos los timestamps usan `serverTimestamp()`
- ✅ Picks se crean/actualizan con `upsertMyPick` (idempotente)
- ✅ Status badge usa variant system de CommonComponents
- ✅ Loading states previenen doble-submit
- ✅ Navegación automática tras crear apuesta
- ✅ Alerts nativos para confirmaciones
- ✅ Pick.uid es mismo que docId para facilitar queries
- ✅ Spanish copy en toda la UI

## Integración con Sistema Existente

- ✅ Usa `isUserAdmin()` de tournamentService
- ✅ Usa `getTournament()` y `getEvent()` para contexto
- ✅ Compatible con navigation stack existente
- ✅ Usa components de CommonComponents
- ✅ Sigue theme system (Colors, Spacing, BorderRadius)
- ✅ Botón "Ver Apuestas" agregado a EventDetails
- ✅ No refactoriza código no relacionado
