import { Bytes, doc, DocumentReference, FieldPath, GeoPoint, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export type CharacterDocumentTarget =
  | { kind: "base"; id: string }
  | { kind: "custom"; id: string; uid: string };

function characterRef(target: CharacterDocumentTarget) {
  return target.kind === "base"
    ? doc(db, "characters", target.id)
    : doc(db, "users", target.uid, "characters", target.id);
}

export async function readCharacterFields(target: CharacterDocumentTarget): Promise<Record<string, unknown>> {
  const snapshot = await getDoc(characterRef(target));
  if (!snapshot.exists()) throw new Error("Character document no longer exists.");
  return snapshot.data();
}

export async function writeCharacterField(target: CharacterDocumentTarget, field: string, value: unknown): Promise<void> {
  await updateDoc(characterRef(target), new FieldPath(field), value);
}

export function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(isJsonValue);
}

export function describeFirestoreValue(value: unknown): unknown {
  if (value instanceof Timestamp) return { type: "Timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { type: "GeoPoint", latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { type: "DocumentReference", path: value.path };
  if (value instanceof Bytes) return { type: "Bytes", base64: value.toBase64() };
  if (Array.isArray(value)) return value.map(describeFirestoreValue);
  if (value !== null && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) return { type: value.constructor?.name || "Unknown", value: String(value) };
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, describeFirestoreValue(item)]));
  }
  if (typeof value === "number" && !Number.isFinite(value)) return { type: "Number", value: String(value) };
  return value;
}
