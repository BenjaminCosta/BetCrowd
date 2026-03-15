# Tipos de notificaciones y cuándo aparecen

Este documento recoge los tipos de notificación que la app crea actualmente, el momento en que se generan y dónde se muestran.

**Archivo(s) principales analizados:**
- `src/services/notificationsService.ts`
- `src/services/friendsService.ts`
- `src/services/inviteService.ts`
- `src/screens/NotificationCenterScreen.tsx`
- `src/context/SocialContext.tsx`

Resumen rápido: la app usa notificaciones "in-app" almacenadas en Firestore bajo `users/{uid}/notifications`. No hay implementación de notificaciones push/device en el código actual (ver README: TODO de push).

Tipos de notificación (enumeradas en el servicio)

1. `friend_request`
   - ¿Cuándo se crea?: cuando un usuario envía una solicitud de amistad mediante `sendFriendRequest` (`src/services/friendsService.ts`).
   - ¿Para quién?: el receptor (`toUid`) de la solicitud.
   - Contenido típico (campos del documento):
     - `type: 'friend_request'`
     - `title: 'Nueva solicitud de amistad'`
     - `body: '@{fromUsername} te ha enviado una solicitud de amistad'`
     - `fromUid`: UID del remitente
     - `createdAt`, `readAt` (null si no leída)
     - `meta`: {} (vacío por defecto)
   - Dónde aparece: en el Centro de Notificaciones (`NotificationCenterScreen`) y en el contador de notificaciones no leídas (listener en `SocialContext`).

2. `friend_accepted`
   - ¿Cuándo se crea?: cuando un usuario acepta una solicitud de amistad con `acceptFriendRequest` (`src/services/friendsService.ts`).
   - ¿Para quién?: quien envió originalmente la solicitud (el requester).
   - Contenido típico:
     - `type: 'friend_accepted'`
     - `title: 'Solicitud aceptada'`
     - `body: '@{currentUsername} aceptó tu solicitud de amistad'`
     - `fromUid`: UID del que aceptó
     - `createdAt`, `readAt`
     - `meta`: {} (vacío por defecto)
   - Dónde aparece: Centro de Notificaciones y contador de no leídos.

3. `tournament_invite`
   - ¿Cuándo se crea?: cuando un miembro envía una invitación a un torneo usando `sendTournamentInvites` (`src/services/inviteService.ts`). El código crea un documento en `tournamentInvites` y también escribe una notificación en `users/{toUid}/notifications` como "best-effort".
   - ¿Para quién?: destinatario de la invitación (`toUid`).
   - Contenido típico:
     - `type: 'tournament_invite'`
     - `title: 'Invitación a torneo'`
     - `body: '{fromName} te invitó a "{tournamentName}"'`
     - `fromUid`: UID del remitente
     - `tournamentId`: id del torneo (también en `meta.inviteId`)
     - `meta`: { inviteId, tournamentId }
     - `createdAt`, `readAt`
   - Dónde aparece: Centro de Notificaciones y contador de no leídos.

Acciones relacionadas
- `listenNotifications(uid, cb)` — escucha en tiempo real las últimas 50 notificaciones de `users/{uid}/notifications` y las muestra en `NotificationCenterScreen`.
- `listenUnreadCount(uid, cb)` — escucha la cantidad de notificaciones con `readAt == null` para mostrar el badge/contador.
- `markAsRead(uid, notificationId)` — marca una notificación como leída (`readAt = serverTimestamp()`).
- `markAllAsRead(uid)` — marca todas las notificaciones no leídas como leídas (batch).
- `deleteNotification(uid, notificationId)` — borra permanentemente la notificación.

Notas y observaciones
- Todas las notificaciones son creadas por writes en Firestore (no hay lógica de push/server en este repositorio). El README indica que las notificaciones push todavía están pendientes de implementar.
- Las notificaciones se muestran en `NotificationCenterScreen` que formatea `title`, `body` y `createdAt` y permite marcar/abrir/borrar.
- La estructura de `Notification` está tipada en `src/services/notificationsService.ts` y actualmente limita `type` a los tres valores listados arriba.
- Cuando una operación crea una notificación, suele ser "best-effort": si la escritura de la notificación falla, la operación principal (p.ej. enviar invitaciones) no falla por ello.

Referencias en el código
- `src/services/notificationsService.ts` — definición de `Notification`, listeners y acciones (mark/read/delete).
- `src/services/friendsService.ts` — creación de `friend_request` y `friend_accepted`.
- `src/services/inviteService.ts` — creación de `tournament_invite` al enviar invitaciones.
- `src/screens/NotificationCenterScreen.tsx` — renderizado y acciones de UI.
- `src/context/SocialContext.tsx` — donde se inician los listeners de notificaciones y se exponen funciones a la UI.

## TODO / Future enhancements

- Add real Firestore JSON examples for each notification type as stored in the database.
- Add unit tests with Firestore mocks to verify notification object creation in services.

Fin.
