# Reglas de Seguridad de Firebase Firestore

Este archivo contiene las reglas de seguridad para tu base de datos Firebase Firestore.

## Cómo aplicar las reglas

### Opción 1: Desde Firebase Console (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. En el menú lateral, ve a **Firestore Database**
4. Click en la pestaña **Reglas** (Rules)
5. Copia todo el contenido del archivo `firestore.rules`
6. Pega el contenido en el editor de reglas
7. Click en **Publicar** (Publish)

### Opción 2: Usando Firebase CLI

Si tienes Firebase CLI instalado:

```bash
# Instalar Firebase CLI (si no lo tienes)
npm install -g firebase-tools

# Login a Firebase
firebase login

# Inicializar Firebase en tu proyecto (si no lo has hecho)
firebase init firestore

# Aplicar las reglas
firebase deploy --only firestore:rules
```

## Estructura de las Reglas

### 🔐 Permisos Principales

#### **User Profiles** (`/users/{userId}`)
- ✅ Lectura: Solo el propio usuario
- ✅ Creación/Actualización: Solo el propio usuario
- ❌ Eliminación: Nadie

#### **Tournaments** (`/tournaments/{tournamentId}`)
- ✅ Lectura: Cualquier usuario autenticado (para join via código)
- ✅ Creación: Cualquier usuario autenticado
- ✅ Actualización/Eliminación: Solo el owner del torneo

#### **Members** (`/tournaments/{tournamentId}/members/{userId}`)
- ✅ Lectura: Cualquier miembro del torneo
- ✅ Creación: Usuarios pueden unirse (crear su propio doc)
- ✅ Actualización: Admin puede cambiar roles, usuarios pueden actualizar su doc (excepto role)
- ✅ Eliminación: Solo admin/owner

#### **Events** (`/tournaments/{tournamentId}/events/{eventId}`)
- ✅ Lectura: Cualquier miembro del torneo
- ✅ Creación/Actualización/Eliminación: Solo admin/owner

#### **Bets** (`/tournaments/{tournamentId}/events/{eventId}/bets/{betId}`)
- ✅ Lectura: Cualquier miembro del torneo
- ✅ Creación/Actualización/Eliminación: Solo admin/owner

#### **Picks** (`/tournaments/{tournamentId}/events/{eventId}/bets/{betId}/picks/{userId}`)
- ✅ Lectura: Cualquier miembro del torneo
- ✅ Creación/Actualización/Eliminación: Solo el propio usuario (y debe ser miembro)

### 🛠️ Funciones Helper

Las reglas incluyen funciones helper para simplificar la lógica:

- `isAuthenticated()`: Verifica si el usuario está logueado
- `isUserDoc(userId)`: Verifica si el documento pertenece al usuario actual
- `getTournamentRole(tournamentId)`: Obtiene el rol del usuario en el torneo
- `isTournamentMember(tournamentId)`: Verifica si el usuario es miembro del torneo
- `isTournamentAdmin(tournamentId)`: Verifica si el usuario es admin u owner
- `isTournamentOwner(tournamentId)`: Verifica si el usuario es el owner del torneo

## Validación de Reglas

Después de aplicar las reglas, puedes probarlas en la consola:

1. Ve a Firebase Console > Firestore Database > Reglas
2. Click en **Simulador de reglas** (Rules Playground)
3. Prueba diferentes escenarios:
   - Lectura de torneo como usuario autenticado
   - Creación de pick como miembro
   - Intento de eliminación de evento como miembro (debe fallar)
   - etc.

## Notas Importantes

⚠️ **IMPORTANTE**: Estas reglas asumen la estructura de datos actual:

```
tournaments/{tournamentId}
├── members/{userId}
├── events/{eventId}
│   └── bets/{betId}
│       └── picks/{userId}
└── predictions/{predictionId}
```

Si cambias la estructura de datos, deberás actualizar las reglas en consecuencia.

### Validaciones Adicionales en el Cliente

Algunas validaciones deben hacerse en el cliente porque Firestore Rules no puede acceder al documento padre durante operaciones de escritura:

- **Picks**: El cliente debe verificar que `bet.status === 'open'` antes de crear/actualizar picks
- **Event dates**: El cliente debe validar fechas y restricciones de tiempo
- **Member limits**: El cliente debe verificar límites de participantes

### Seguridad vs Funcionalidad

Las reglas actuales priorizan **flexibilidad** para el MVP. Para producción considera:

1. **Validar campos requeridos**:
```javascript
allow create: if isAuthenticated() 
  && request.resource.data.keys().hasAll(['title', 'type', 'options'])
  && request.resource.data.title is string
  && request.resource.data.title.size() > 0;
```

2. **Prevenir modificaciones de campos críticos**:
```javascript
allow update: if isAuthenticated() 
  && isTournamentAdmin(tournamentId)
  && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['createdBy', 'createdAt']);
```

3. **Limitar tamaño de datos**:
```javascript
allow create: if isAuthenticated()
  && request.resource.data.options.size() <= 10
  && request.resource.data.stakeAmount <= 1000000;
```

## Testing

Para probar las reglas localmente:

```bash
# Instalar emulador de Firestore
npm install -g @firebase/rules-unit-testing

# Correr tests (debes crear tests primero)
npm test
```

## Troubleshooting

### Error: "Missing or insufficient permissions"

Esto significa que las reglas bloquearon la operación. Verifica:

1. El usuario está autenticado (`auth.currentUser != null`)
2. El usuario tiene el rol correcto en el torneo
3. La ruta del documento es correcta
4. Las reglas están publicadas en Firebase

### Error: "PERMISSION_DENIED"

Similar al anterior. Revisa en la consola de Firebase:
- Firestore Database > Uso y facturación > Logs
- Busca el error específico y la ruta que falló

### Testing en Desarrollo

Durante desarrollo, puedes usar reglas más permisivas:

```javascript
// ⚠️ SOLO PARA DESARROLLO - NUNCA EN PRODUCCIÓN
match /{document=**} {
  allow read, write: if isAuthenticated();
}
```

**NO OLVIDES** revertir a las reglas seguras antes de deployment!

## Deployment Checklist

Antes de hacer deploy a producción:

- [ ] Revisa todas las reglas cuidadosamente
- [ ] Prueba escenarios de seguridad en el simulador
- [ ] Verifica que no hay `allow read, write: if true` en ningún lado
- [ ] Confirma que las rutas coinciden con tu estructura de datos
- [ ] Testea con diferentes roles (owner, admin, member, no-member)
- [ ] Aplica las reglas: `firebase deploy --only firestore:rules`
- [ ] Monitorea los logs después del deploy

## Recursos

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Security Rules Best Practices](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Rules Playground](https://firebase.google.com/docs/rules/simulator)
