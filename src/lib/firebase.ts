// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDeUETYmJyLlQXDjc0YWVm-h9qiwRnUcPc",
  authDomain: "fall-detection-system-1e8a0.firebaseapp.com",
  databaseURL: "https://fall-detection-system-1e8a0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fall-detection-system-1e8a0",
  storageBucket: "fall-detection-system-1e8a0.firebasestorage.app",
  messagingSenderId: "928815473814",
  appId: "1:928815473814:web:adf2036a2bf6a3be00ceb7",
  measurementId: "G-417JVYKCWC"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app); 
