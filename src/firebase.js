import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Your real configuration
const firebaseConfig = {
  apiKey: "AIzaSyBJhHojs2TfYuGsgBBFRkdkgx1f-h-oFcg",
  authDomain: "thirdthinginjapan.firebaseapp.com",
  databaseURL: "https://thirdthinginjapan-default-rtdb.firebaseio.com",
  projectId: "thirdthinginjapan",
  storageBucket: "thirdthinginjapan.firebasestorage.app",
  messagingSenderId: "530583062307",
  appId: "1:530583062307:web:6cf343f48a5b87abacee96"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services so other files can use them
export const db = getDatabase(app);
export const auth = getAuth(app);