import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBV143OBBajnbZWj-PZPYq0NzWiCqRYp90",
  authDomain: "inviz-ae0c0.firebaseapp.com",
  projectId: "inviz-ae0c0",
  storageBucket: "inviz-ae0c0.firebasestorage.app",
  messagingSenderId: "25276007249",
  appId: "1:25276007249:web:f0565c5f6c2cbbca7b4970",
  measurementId: "G-X0XT5VMPBX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
