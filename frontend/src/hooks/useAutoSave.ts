//src/hooks/useAutoSave.ts

import { useEffect, useRef, useMemo } from "react";
import { DocumentData } from "firebase/firestore";
import { getCollectionUserDoc, writeCollectionUserDoc } from "../services/userService";
import { useUser } from "../context/UserContext";
export const useAutoSave = <T extends DocumentData = DocumentData>(
  data: T,
  collectionName: string,
  delay = 1000
) => {
  const { user } = useUser();
  const lastSavedRef = useRef<string | null>(null);

  // Serialize once per render; if serialization fails we skip saving.
  const serialized = useMemo(() => {
    try {
      return JSON.stringify(data);
    } catch (err) {
      console.warn("useAutoSave: data could not be stringified", err);
      return null;
    }
  }, [data]);

  useEffect(() => {
    if (!user?.uid) return;
    if (serialized === null) return; // can't compare/serialize

    // capture stable values for use inside async callback (avoid TS "possibly undefined" errors)
    const uid = user.uid;
    const email = user.email ?? user.uid;

    // If nothing changed since the last successful save, skip scheduling.
    if (serialized === lastSavedRef.current) return;

    const timeout = setTimeout(() => {
      (async () => {
        try {
          await writeCollectionUserDoc(collectionName, uid, data);
          lastSavedRef.current = serialized;
          console.log("✅ Auto-saved data for", email);
        } catch (err) {
          console.error("useAutoSave: failed to auto-save", err);
        }
      })();
    }, delay);

    return () => clearTimeout(timeout);
  }, [serialized, collectionName, delay, user?.uid]);
};
