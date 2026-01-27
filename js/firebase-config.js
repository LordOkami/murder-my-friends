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
    apiKey: "AIzaSyDbtMcIULW0hh5L0qXJHTnJIRD8K-xlRAg",
    authDomain: "murder-my-friends.firebaseapp.com",
    databaseURL: "https://murder-my-friends-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "murder-my-friends",
    storageBucket: "murder-my-friends.firebasestorage.app",
    messagingSenderId: "504049550535",
    appId: "1:504049550535:web:1d9e9ac7049028f9c4eae2"
};

// Verificar si Firebase está configurado
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== "TU_API_KEY";
}

// Exportar
window.firebaseConfig = firebaseConfig;
window.isFirebaseConfigured = isFirebaseConfigured;
