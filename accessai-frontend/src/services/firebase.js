// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyC2soyldiezLNB37iwOC9METGODc3xKPnU",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "disabled-674f1.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "disabled-674f1",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "disabled-674f1.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "368908420218",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:368908420218:web:c97d2b3de504e301d8a7c3",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-NC3VMDLLG1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const db       = getFirestore(app);

export const provider = new GoogleAuthProvider();