import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuración de Firebase usando variables de entorno (Vite)
// Si no hay variables de entorno, usará los datos de producción originales por defecto
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDlU-O-Z9-gi260kjMp9-3_rJ8zJlZKVVU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "yoguice-cdaae.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "yoguice-cdaae",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "yoguice-cdaae.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "115939651224",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:115939651224:web:d1f728757c2af0ec48eaed",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-BSD586D373"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore (Base de datos)
export const db = getFirestore(app);
