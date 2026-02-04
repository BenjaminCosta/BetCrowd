# BetCrowd Mobile

Aplicación móvil de BetCrowd desarrollada con React Native y Expo. Plataforma de predicciones deportivas con torneos, apuestas y competencias.

## 🚀 Características

- ✅ Autenticación de usuarios (Login)
- ✅ Pantalla de inicio con torneos activos
- ✅ Creación de torneos personalizados
- ✅ Sistema de apuestas y predicciones
- ✅ Perfil de usuario con estadísticas
- ✅ Notificaciones en tiempo real
- ✅ Modo claro/oscuro (tema dark por defecto)
- ✅ Navegación con bottom tabs
- ✅ Diseño mobile-first con paleta rojo/naranja

## 📱 Estructura del Proyecto

```
betcrowd-mobile/
├── src/
│   ├── screens/          # Pantallas de la app
│   │   ├── LoginScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── CreateTournamentScreen.tsx
│   │   ├── TournamentDetailsScreen.tsx
│   │   ├── PredictionsScreen.tsx
│   │   ├── EventsScreen.tsx
│   │   ├── NotificationsScreen.tsx
│   │   ├── JoinCodeScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── NotFoundScreen.tsx
│   ├── components/       # Componentes reutilizables
│   │   ├── TopBar.tsx
│   │   └── LoadingBar.tsx
│   ├── navigation/       # Configuración de navegación
│   │   └── AppNavigator.tsx
│   ├── context/          # Context API (Theme)
│   │   └── ThemeContext.tsx
│   └── theme/            # Colores y estilos
│       └── colors.ts
├── App.tsx               # Punto de entrada
└── package.json

```

## 🛠️ Tecnologías

- **React Native** - Framework móvil
- **Expo** - Toolchain y SDK
- **TypeScript** - Lenguaje tipado
- **React Navigation** - Navegación
  - Bottom Tabs
  - Native Stack
- **Expo Vector Icons** - Iconos (Ionicons)
- **Expo Linear Gradient** - Gradientes
- **React Native Calendars** - Selector de fechas
- **AsyncStorage** - Almacenamiento local

## 📦 Instalación

```bash
# Navegar a la carpeta del proyecto
cd betcrowd-mobile

# Instalar dependencias (ya instaladas)
npm install

# Iniciar la aplicación
npm start

# O ejecutar en iOS
npm run ios

# O ejecutar en Android
npm run android
```

## 🎨 Paleta de Colores

### Modo Oscuro (Default)
- **Background**: `#0D0D0D`
- **Primary**: `#DC2E4B` (Rojo BetCrowd)
- **Accent**: `#FF8C00` (Naranja)
- **Card**: `#141414`
- **Text**: `#FFFFFF`

### Modo Claro
- **Background**: `#F5F5F5`
- **Primary**: `#DC2E4B`
- **Accent**: `#FF8C00`
- **Card**: `#FFFFFF`
- **Text**: `#1A1A1A`

## 🧭 Navegación

### Bottom Tab Navigator
1. **Inicio** - Lista de torneos activos y balance
2. **Eventos** - Eventos deportivos disponibles
3. **Crear** (+) - Botón central para crear torneos
4. **Apuestas** - Historial de predicciones
5. **Perfil** - Configuración y estadísticas

### Stack Navigator
- Login
- TournamentDetails
- Notifications
- JoinCode
- NotFound

## 🔄 Conversión desde Web

Este proyecto es una conversión de la aplicación web React + Vite a React Native:

### Cambios Principales
- ✅ `div` → `View`
- ✅ `button` → `TouchableOpacity` / `Pressable`
- ✅ `input` → `TextInput`
- ✅ `img` → `Image`
- ✅ CSS/Tailwind → `StyleSheet`
- ✅ React Router → React Navigation
- ✅ Radix UI → Componentes nativos
- ✅ Lucide Icons → Ionicons
- ✅ Calendario web → react-native-calendars

## 📱 Pantallas Implementadas

| Pantalla | Descripción | Estado |
|----------|-------------|--------|
| Login | Autenticación con email/password | ✅ |
| Home | Torneos activos y balance | ✅ |
| CreateTournament | Formulario de creación | ✅ |
| Predictions | Historial de apuestas | ✅ |
| Profile | Perfil y configuración | ✅ |
| Notifications | Centro de notificaciones | ✅ |
| Events | Lista de eventos | ✅ |
| TournamentDetails | Detalles del torneo | ✅ |
| JoinCode | Unirse con código | ✅ |
| NotFound | Página no encontrada | ✅ |

## 🌙 Modo Claro/Oscuro

El sistema de temas está implementado con Context API y persiste la preferencia del usuario en AsyncStorage.

```tsx
// Usar el tema
const { theme, setThemeMode } = useTheme();

// Cambiar el tema
setThemeMode('dark' | 'light' | 'system');
```

## 🎯 Próximos Pasos

- [ ] Integrar API backend
- [ ] Implementar autenticación real
- [ ] Agregar animaciones con Reanimated
- [ ] Implementar notificaciones push
- [ ] Agregar internacionalización (i18n)
- [ ] Tests unitarios y E2E

## 👨‍💻 Desarrollo

```bash
# Limpiar caché de Expo
npx expo start -c

# Actualizar dependencias
npm update

# Ver en navegador (web)
npm run web
```

## 📄 Licencia

Proyecto desarrollado para BetCrowd - Todos los derechos reservados.

---

**Nota**: Este proyecto móvil coexiste con la versión web en la carpeta `betgrow-ui-vision-main`. Ambos comparten la misma estructura lógica y diseño visual adaptado a cada plataforma.
