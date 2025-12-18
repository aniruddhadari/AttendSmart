// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBqOvs5M7D8YZqYj9k-YpbX4xksq9InYQQ",
  authDomain: "attendsmart-fee27.firebaseapp.com",
  projectId: "attendsmart-fee27",
  storageBucket: "attendsmart-fee27.firebasestorage.app",
  messagingSenderId: "276412867732",
  appId: "1:276412867732:web:8b4ef0babc234870704081",
  measurementId: "G-DECT9ZR3YZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase connected successfully");
