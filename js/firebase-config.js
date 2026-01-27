/**
 * Firebase Configuration
 *
 * INSTRUCCIONES PARA CONFIGURAR FIREBASE:
 *
 * 1. Ve a https://console.firebase.google.com/
 * 2. Crea un nuevo proyecto (o usa uno existente)
 * 3. Ve a "Build" > "Realtime Database" y crea una base de datos
 * 4. En las reglas, usa estas reglas básicas para empezar:
 *    {
 *      "rules": {
 *        "games": {
 *          "$gameId": {
 *            ".read": true,
 *            ".write": true
 *          }
 *        }
 *      }
 *    }
 * 5. Ve a configuración del proyecto > "Tus apps" > Añadir app web
 * 6. Copia los valores de firebaseConfig aquí abajo
 */

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

// Verificar si Firebase está configurado
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== "TU_API_KEY";
}

// Exportar
window.firebaseConfig = firebaseConfig;
window.isFirebaseConfigured = isFirebaseConfigured;
