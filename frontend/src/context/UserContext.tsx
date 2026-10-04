import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";

interface UserContextType {
  user: User | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true });

export const useUser = () => useContext(UserContext);

interface Props {
  children: ReactNode;
}

export const UserProvider: React.FC<Props> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void Promise.all([import("firebase/auth"), import("../firebase")])
      .then(([{ onAuthStateChanged }, { auth }]) => {
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
      })
      .catch((error) => {
        console.error("Failed to initialize authentication", error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return <UserContext.Provider value={{ user, loading }}>{children}</UserContext.Provider>;
};
