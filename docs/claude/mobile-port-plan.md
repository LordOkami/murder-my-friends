# Plan de Port a iOS y Android - Murder My Friends

## Estado actual de la app

| Aspecto | Detalle |
|---------|---------|
| Stack | HTML/CSS/JS vanilla, sin framework ni bundler |
| Firebase | Compat SDK 9.23.0 (Auth + Realtime Database) |
| Tamano total | ~141 KB (5 ficheros JS, 1 CSS, 1 HTML) |
| Fotos | Base64 almacenadas directamente en Realtime DB |
| APIs nativas | Camera (getUserMedia), Clipboard, Canvas, FileReader |
| PWA | Manifest presente, pero sin Service Worker |
| Hosting | Netlify (deploy desde main) |

---

## Alternativas de port

| # | Alternativa | Esfuerzo | Resultado |
|---|-------------|----------|-----------|
| A | **PWA mejorada** | Bajo | Web app instalable, sin App Store |
| B | **Capacitor** (wrapper nativo) | Medio-bajo | App Store + codigo web existente |
| C | **React Native** | Alto | UI nativa, reescritura completa |
| D | **Flutter** | Alto | UI nativa, reescritura completa |
| E | **Nativo puro** (Swift + Kotlin) | Muy alto | Maximo rendimiento, doble codebase |

---

## Alternativa A: PWA Mejorada

### Descripcion
Mejorar la web app actual para que sea instalable desde el navegador en iOS y Android sin pasar por App Store. No requiere reescribir codigo.

### Que hay que hacer

1. **Service Worker** — Crear `sw.js` para cache offline de assets estaticos
   ```
   sw.js
   - Cache: index.html, css/styles.css, js/*.js, fonts, favicon
   - Estrategia: Network First para API/Firebase, Cache First para assets
   - Mostrar pantalla offline si no hay conexion
   ```

2. **Iconos nativos** — Generar iconos en multiples tamanos
   ```
   img/icons/
   - icon-72x72.png
   - icon-96x96.png
   - icon-128x128.png
   - icon-144x144.png
   - icon-152x152.png (iOS)
   - icon-192x192.png (Android)
   - icon-384x384.png
   - icon-512x512.png
   ```

3. **Manifest mejorado** — Actualizar `manifest.json`
   ```json
   {
     "name": "Murder My Friends",
     "short_name": "Murder",
     "start_url": "/?source=pwa",
     "display": "standalone",
     "background_color": "#0a0a0f",
     "theme_color": "#ff3366",
     "orientation": "portrait",
     "icons": [
       { "src": "img/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "img/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" },
       { "src": "img/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" }
     ],
     "screenshots": [
       { "src": "img/screenshots/home.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" }
     ]
   }
   ```

4. **Meta tags iOS** — Anadir en `<head>`
   ```html
   <link rel="apple-touch-icon" href="img/icons/icon-152x152.png">
   <meta name="apple-mobile-web-app-title" content="Murder">
   ```

5. **Banner de instalacion** — Prompt personalizado para "Anadir a pantalla de inicio"

6. **Push Notifications** (opcional) — Firebase Cloud Messaging para notificar asesinatos
   - Requiere Service Worker
   - Solo funciona en Android (iOS Safari no soporta Web Push en PWA aun de forma fiable)

### Pros
- Cero cambios en la logica de la app
- Sin coste de App Store (25$ Google, 99$/ano Apple)
- Deploy instantaneo via Netlify
- Un solo codebase

### Contras
- No aparece en App Store / Google Play (menor descubribilidad)
- iOS limita PWAs: sin push notifications fiables, 50MB storage, se borra cache tras 7 dias sin uso
- Sin acceso a APIs nativas avanzadas (haptics, contactos, etc.)
- No se puede compartir via App Store link

### Cuando elegir esta opcion
- Si los usuarios son tech-savvy y saben instalar PWAs
- Si no necesitas presencia en stores
- Como primer paso rapido antes de una app nativa

---

## Alternativa B: Capacitor (Recomendada)

### Descripcion
Capacitor (de Ionic) envuelve la web app en un WebView nativo, dando acceso a APIs nativas y permitiendo publicar en App Store y Google Play. **Reutiliza el 95% del codigo actual.**

### Arquitectura

```
murder-my-friends/
├── www/                    # Web app actual (copiada aqui)
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── img/
├── ios/                    # Proyecto Xcode generado por Capacitor
│   └── App/
├── android/                # Proyecto Android Studio generado
│   └── app/
├── capacitor.config.ts     # Config de Capacitor
└── package.json
```

### Pasos de implementacion

#### Fase 1: Setup del proyecto

```bash
# Inicializar npm
npm init -y

# Instalar Capacitor
npm install @capacitor/core @capacitor/cli

# Inicializar Capacitor
npx cap init "Murder My Friends" "com.murdermyfriends.app"

# Instalar plataformas
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

#### Fase 2: Configuracion de Capacitor

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.murdermyfriends.app',
  appName: 'Murder My Friends',
  webDir: 'www',
  server: {
    // En desarrollo: cargar desde servidor local
    // url: 'http://localhost:8080',
    // En produccion: usar archivos locales (comentar url)
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0a0a0f',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0f',
    },
  },
  ios: {
    scheme: 'Murder My Friends',
  },
};

export default config;
```

#### Fase 3: Adaptaciones al codigo web

1. **Firebase Auth** — Cambiar Google Sign-In para nativo:
   ```bash
   npm install @capacitor-firebase/authentication
   ```
   - En iOS/Android, el plugin maneja Google Sign-In nativamente
   - Evita el problema del popup/redirect por completo

2. **Camara** — Usar plugin nativo en vez de getUserMedia:
   ```bash
   npm install @capacitor/camera
   ```
   ```javascript
   import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

   async function takePhoto() {
     const image = await Camera.getPhoto({
       quality: 80,
       width: 200,
       height: 200,
       allowEditing: true,
       resultType: CameraResultType.DataUrl,
       source: CameraSource.Camera,
     });
     return image.dataUrl;
   }
   ```

3. **Share** — Compartir enlace de partida:
   ```bash
   npm install @capacitor/share
   ```
   ```javascript
   import { Share } from '@capacitor/share';

   async function shareGameLink(code) {
     await Share.share({
       title: 'Murder My Friends',
       text: `Unete a mi partida!`,
       url: `https://murdermyfriends.netlify.app/?code=${code}`,
     });
   }
   ```

4. **Haptics** — Vibracion al revelar mision o al morir:
   ```bash
   npm install @capacitor/haptics
   ```

5. **Local Notifications** — Notificar cuando te asesinan:
   ```bash
   npm install @capacitor/local-notifications
   ```

6. **Deep Links** — Abrir la app desde `murdermyfriends.netlify.app/?code=XXXX`:
   ```bash
   npm install @capacitor/app
   ```
   - Configurar Universal Links (iOS) y App Links (Android)

#### Fase 4: Splash Screen e iconos

```
resources/
├── icon.png          # 1024x1024 (App Store / Play Store)
├── icon-foreground.png  # 1024x1024 (Android adaptive icon)
├── splash.png        # 2732x2732 (centered logo on #0a0a0f bg)
└── splash-dark.png   # Igual (ya es dark por defecto)
```

```bash
# Generar todos los tamanos automaticamente
npm install @capacitor/assets
npx capacitor-assets generate
```

#### Fase 5: Build y publicacion

**iOS:**
```bash
npx cap sync ios
npx cap open ios
# En Xcode:
# - Configurar Signing & Capabilities (Apple Developer Account)
# - Seleccionar team
# - Archive → Distribute App → App Store Connect
```

**Android:**
```bash
npx cap sync android
npx cap open android
# En Android Studio:
# - Build → Generate Signed Bundle / APK
# - Crear keystore para firmar
# - Subir .aab a Google Play Console
```

### Pros
- Reutiliza el 95% del codigo web existente
- Un solo codebase para web + iOS + Android
- Acceso a APIs nativas (camara, haptics, share, notificaciones)
- Publicable en App Store y Google Play
- Actualizaciones de la logica via web sin re-publicar (si usas servidor remoto)
- Comunidad grande, bien documentado

### Contras
- Rendimiento ligeramente inferior a nativo puro (WebView)
- UI no es 100% nativa (sigue siendo HTML/CSS renderizado)
- Dependencia del ecosistema Capacitor
- Las animaciones complejas (confetti, flip card) pueden ir menos fluidas en dispositivos bajos

### Cuando elegir esta opcion
- **Recomendada como primera opcion** por el ratio esfuerzo/resultado
- La app es ligera y la UI ya esta optimizada para movil
- No hay necesidad de rendimiento nativo pesado (no hay 3D, video, etc.)

### Costes

| Concepto | Coste |
|----------|-------|
| Apple Developer Program | 99 USD/ano |
| Google Play Console | 25 USD (unico pago) |
| Capacitor + plugins | Gratis (MIT) |

---

## Alternativa C: React Native

### Descripcion
Reescritura completa de la app usando React Native. UI nativa real en ambas plataformas. Comparte logica de negocio pero cada componente se renderiza con widgets nativos.

### Arquitectura

```
murder-my-friends-rn/
├── src/
│   ├── screens/
│   │   ├── AuthScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── CreateGameScreen.tsx
│   │   ├── JoinScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── LobbyScreen.tsx
│   │   ├── GameScreen.tsx
│   │   ├── MissionScreen.tsx
│   │   ├── KillScreen.tsx
│   │   └── GameOverScreen.tsx
│   ├── components/
│   │   ├── PlayerCard.tsx
│   │   ├── WeaponChip.tsx
│   │   ├── MissionCard.tsx      # Animated flip card
│   │   ├── ProfilePhoto.tsx
│   │   ├── WebcamCapture.tsx
│   │   └── Toast.tsx
│   ├── services/
│   │   ├── firebase.ts          # Firebase config + init
│   │   ├── auth.ts              # Auth logic (port from auth.js)
│   │   ├── game.ts              # Game logic (port from multiplayer.js)
│   │   └── notifications.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGame.ts
│   │   └── useProfile.ts
│   ├── navigation/
│   │   └── AppNavigator.tsx     # React Navigation stack
│   ├── theme/
│   │   └── theme.ts             # Colores, tipografia (port de CSS vars)
│   └── App.tsx
├── ios/
├── android/
├── package.json
└── tsconfig.json
```

### Dependencias principales

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-native": "^0.74.x",
    "@react-navigation/native": "^6.x",
    "@react-navigation/native-stack": "^6.x",
    "@react-native-firebase/app": "^20.x",
    "@react-native-firebase/auth": "^20.x",
    "@react-native-firebase/database": "^20.x",
    "@react-native-google-signin/google-signin": "^12.x",
    "react-native-camera": "^4.x",
    "react-native-image-picker": "^7.x",
    "react-native-reanimated": "^3.x",
    "react-native-share": "^10.x",
    "react-native-haptic-feedback": "^2.x"
  }
}
```

### Mapeo de funcionalidad web → React Native

| Web | React Native |
|-----|-------------|
| `showScreen()` | React Navigation stack |
| `showModal()` / `hideModal()` | React Native Modal component |
| `showToast()` | `react-native-toast-message` |
| CSS animations | `react-native-reanimated` |
| `getUserMedia` | `react-native-camera` |
| `<input type="file">` | `react-native-image-picker` |
| `navigator.clipboard` | `@react-native-clipboard/clipboard` |
| CSS Grid/Flexbox | React Native Flexbox (similar) |
| `firebase.database().ref().on()` | `@react-native-firebase/database` `.on()` |
| Base64 photos | Igual, o migrar a Firebase Storage |
| Mission card flip | `react-native-reanimated` 3D transform |
| Confetti | `react-native-confetti-cannon` |
| Google Fonts | Bundled fonts (Creepster, Inter) |

### Pasos de implementacion

1. **Setup**: `npx react-native init MurderMyFriends --template react-native-template-typescript`
2. **Theme**: Portar CSS variables a objeto de tema
3. **Navigation**: Configurar stack navigator con 10 pantallas
4. **Firebase**: Instalar y configurar `@react-native-firebase/*`
5. **Auth**: Portar `auth.js` a servicio TypeScript con Google Sign-In nativo
6. **Game logic**: Portar `MultiplayerGame` class (se reutiliza casi tal cual)
7. **Screens**: Reescribir cada pantalla como componente React
8. **Animations**: Recrear flip card, confetti, transitions con Reanimated
9. **Camera**: Integrar captura de foto nativa
10. **Testing**: Probar en simuladores + dispositivos reales
11. **Deploy**: Configurar builds para App Store + Google Play

### Pros
- UI 100% nativa (mejor look & feel)
- Mejor rendimiento que WebView
- Acceso completo a APIs nativas
- Hot reload en desarrollo
- Gran ecosistema de librerias
- Se puede compartir logica con una version web (React)

### Contras
- Reescritura completa (no se reutiliza HTML/CSS/JS)
- Mas complejo de mantener (React + Native modules)
- Requiere conocimiento de React + TypeScript
- Debugging mas dificil que web
- Build times mas lentos
- Actualizaciones requieren re-publicar en stores

### Cuando elegir esta opcion
- Si se planea escalar la app significativamente
- Si la UI del WebView no es suficientemente fluida
- Si ya hay experiencia con React/React Native en el equipo

---

## Alternativa D: Flutter

### Descripcion
Reescritura completa con Flutter (Dart). Una sola codebase que compila a ARM nativo para iOS y Android. Tambien puede compilar para web, desktop y embedded.

### Arquitectura

```
murder_my_friends_flutter/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── theme/
│   │   └── app_theme.dart        # Dark theme con colores del juego
│   ├── models/
│   │   ├── player.dart
│   │   ├── game.dart
│   │   └── weapon.dart
│   ├── services/
│   │   ├── auth_service.dart      # Firebase Auth
│   │   ├── game_service.dart      # Realtime DB game logic
│   │   └── notification_service.dart
│   ├── providers/                 # State management (Riverpod)
│   │   ├── auth_provider.dart
│   │   └── game_provider.dart
│   ├── screens/
│   │   ├── auth_screen.dart
│   │   ├── home_screen.dart
│   │   ├── create_game_screen.dart
│   │   ├── join_screen.dart
│   │   ├── profile_screen.dart
│   │   ├── lobby_screen.dart
│   │   ├── game_screen.dart
│   │   ├── mission_screen.dart
│   │   ├── kill_screen.dart
│   │   └── game_over_screen.dart
│   └── widgets/
│       ├── player_card.dart
│       ├── weapon_chip.dart
│       ├── mission_card.dart      # Flip animation
│       ├── profile_photo.dart
│       └── confetti_overlay.dart
├── ios/
├── android/
├── pubspec.yaml
└── test/
```

### Dependencias principales

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.x
  firebase_auth: ^5.x
  firebase_database: ^11.x
  google_sign_in: ^6.x
  camera: ^0.11.x
  image_picker: ^1.x
  share_plus: ^9.x
  flutter_riverpod: ^2.x
  go_router: ^14.x
  google_fonts: ^6.x
  confetti_widget: ^0.4.x
  haptic_feedback: ^0.5.x
```

### Mapeo de funcionalidad web → Flutter

| Web | Flutter |
|-----|---------|
| Screens (HTML sections) | Rutas con GoRouter |
| CSS variables | `ThemeData` con colores/tipografia |
| Flexbox/Grid | `Column`, `Row`, `Wrap`, `GridView` |
| Animaciones CSS | `AnimationController` + `Transform` |
| Modal | `showDialog()` / `showModalBottomSheet()` |
| Toast | `ScaffoldMessenger.showSnackBar()` |
| getUserMedia | `camera` plugin |
| File input | `image_picker` plugin |
| Clipboard | `Clipboard.setData()` (dart:services) |
| Firebase Realtime | `FirebaseDatabase.instance.ref().onValue` |
| Base64 photos | Igual, o `firebase_storage` |
| 3D flip card | `Transform` con `Matrix4.rotationY()` |
| Google Fonts CDN | `google_fonts` package (cached) |

### Pros
- Compila a codigo nativo ARM (mejor rendimiento que React Native)
- Una codebase para iOS + Android + Web + Desktop
- Hot reload muy rapido
- Widgets personalizables (facil replicar el dark theme)
- Dart es facil de aprender
- Excelente soporte de Firebase (plugins oficiales de Google)

### Contras
- Reescritura completa en Dart (lenguaje nuevo)
- UI no usa widgets nativos del OS (todo es custom, como la web actual)
- Tamano del binario mayor (~15-20 MB minimo)
- Menos librerias que React Native
- Debugging de plugins nativos requiere conocimiento de Swift/Kotlin

### Cuando elegir esta opcion
- Si se quiere una sola codebase para todo (movil + web + desktop)
- Si se busca maximo rendimiento en animaciones
- Si el equipo tiene experiencia con Dart/Flutter

---

## Alternativa E: Nativo Puro (Swift + Kotlin)

### Descripcion
Dos apps independientes: una en Swift/SwiftUI para iOS y otra en Kotlin/Jetpack Compose para Android. Maximo rendimiento y mejor integracion con cada plataforma.

### Arquitectura iOS (SwiftUI)

```
MurderMyFriends-iOS/
├── MurderMyFriends/
│   ├── App/
│   │   └── MurderMyFriendsApp.swift
│   ├── Models/
│   │   ├── Player.swift
│   │   ├── Game.swift
│   │   └── Weapon.swift
│   ├── Services/
│   │   ├── AuthService.swift
│   │   ├── GameService.swift
│   │   └── NotificationService.swift
│   ├── ViewModels/
│   │   ├── AuthViewModel.swift
│   │   ├── GameViewModel.swift
│   │   └── LobbyViewModel.swift
│   ├── Views/
│   │   ├── Auth/
│   │   ├── Home/
│   │   ├── Game/
│   │   └── Components/
│   ├── Theme/
│   │   └── AppTheme.swift
│   └── Resources/
│       ├── Assets.xcassets
│       └── Fonts/
├── MurderMyFriends.xcodeproj
└── Podfile (o SPM)
```

### Arquitectura Android (Jetpack Compose)

```
MurderMyFriends-Android/
├── app/src/main/
│   ├── java/com/murdermyfriends/
│   │   ├── MainActivity.kt
│   │   ├── models/
│   │   ├── services/
│   │   ├── viewmodels/
│   │   ├── ui/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   └── theme/
│   │   └── navigation/
│   └── res/
├── build.gradle.kts
└── google-services.json
```

### Dependencias

**iOS (Swift Package Manager):**
```
firebase-ios-sdk (Auth + Database)
GoogleSignIn-iOS
```

**Android (Gradle):**
```kotlin
implementation(platform("com.google.firebase:firebase-bom:33.x"))
implementation("com.google.firebase:firebase-auth-ktx")
implementation("com.google.firebase:firebase-database-ktx")
implementation("com.google.android.gms:play-services-auth:21.x")
```

### Pros
- Maximo rendimiento y fluidez
- 100% look & feel nativo de cada plataforma
- Acceso completo a todas las APIs del OS
- Mejor soporte de accesibilidad
- Sin dependencia de frameworks intermedios
- Tamano de app optimo

### Contras
- **Doble codebase** — hay que mantener dos apps independientes
- Mayor esfuerzo de desarrollo (x2)
- Se necesita conocimiento de Swift Y Kotlin
- La logica de negocio se duplica (o se extrae a un modulo compartido)
- Cualquier feature nueva hay que implementarla dos veces
- Mas caro en tiempo y recursos

### Cuando elegir esta opcion
- Si hay equipo dedicado para cada plataforma
- Si se necesita rendimiento extremo o integracion profunda con el OS
- Si la app va a crecer mucho y tener features nativas complejas (AR, widgets, etc.)

---

## Comparativa final

| Criterio | PWA | Capacitor | React Native | Flutter | Nativo |
|----------|-----|-----------|-------------|---------|--------|
| Codigo reutilizado | 100% | 95% | 10% (logica) | 0% | 0% |
| Rendimiento | Medio | Medio-alto | Alto | Alto | Maximo |
| UI nativa | No | No | Si | Custom | Si |
| App Store | No | Si | Si | Si | Si |
| Push notifications | Limitado | Si | Si | Si | Si |
| Acceso APIs nativas | Limitado | Si | Si | Si | Total |
| Mantenimiento | 1 codebase | 1 codebase | 1 codebase | 1 codebase | 2 codebases |
| Conocimiento requerido | HTML/CSS/JS | HTML/CSS/JS | React + TS | Dart | Swift + Kotlin |

---

## Recomendacion

### Fase 1 (inmediata): PWA mejorada
- Anadir Service Worker + iconos + meta tags
- Esfuerzo minimo, mejora la experiencia movil ya
- Permite instalacion desde navegador

### Fase 2 (corto plazo): Capacitor
- Envolver la web app actual en Capacitor
- Publicar en App Store y Google Play
- Anadir plugins nativos: camara, share, haptics, notificaciones
- Reutiliza casi todo el codigo actual

### Fase 3 (solo si necesario): React Native o Flutter
- Solo si la app crece significativamente y la experiencia WebView no es suficiente
- Reescritura completa con UI nativa

---

## Requisitos previos comunes

### Cuentas necesarias
- **Apple Developer Program**: 99 USD/ano (obligatorio para App Store)
- **Google Play Console**: 25 USD pago unico

### Configuracion Firebase
- Anadir app iOS en Firebase Console → descargar `GoogleService-Info.plist`
- Anadir app Android en Firebase Console → descargar `google-services.json`
- Registrar SHA-1 del keystore Android para Google Sign-In
- Configurar URL types en iOS para Google Sign-In redirect

### Assets necesarios
- Icono de app: 1024x1024 PNG sin transparencia
- Splash screen: logo centrado sobre fondo #0a0a0f
- Screenshots para stores: minimo 3 por plataforma
- Descripcion, keywords, categoria (Juegos > Party)

### Consideraciones legales
- Politica de privacidad (obligatoria en ambos stores)
- Clasificacion por edad (probablemente 12+ por la tematica)
- Terminos de uso
