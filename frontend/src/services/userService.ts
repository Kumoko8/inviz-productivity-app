// src/services/userService.ts
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export async function registerUser(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    createdAt: new Date(),
  });

  return user;
}

export async function getUserDoc(userId: string) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function writeUserDoc(userId: string, payload: any) {
  const ref = doc(db, "users", userId);
  await setDoc(ref, payload, { merge: true });
}

export async function getCollectionUserDoc(collectionName: string, userId: string) {
  const ref = doc(db, collectionName, userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function writeCollectionUserDoc(collectionName: string, userId: string, payload: any) {
  const ref = doc(db, collectionName, userId);
  await setDoc(ref, payload, { merge: true });
}
