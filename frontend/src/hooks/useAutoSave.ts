import { useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useUser } from "../context/UserContext";

export const useAutoSave = (data: any, collectionName: string) => {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    const timeout = setTimeout(async () => {
      const ref = doc(db, collectionName, user.uid);
      await setDoc(ref, data, { merge: true });
      console.log("✅ Auto-saved data for", user.email);
    }, 1000); // 1 second delay to prevent excessive writes

    return () => clearTimeout(timeout);
  }, [data, user, collectionName]);
};
