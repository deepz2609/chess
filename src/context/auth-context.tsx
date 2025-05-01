"use client";

import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, Dispatch, SetStateAction } from "react"; // Import Dispatch, SetStateAction
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  setUser: Dispatch<SetStateAction<User | null>>; // Add setUser type
}

// Provide a default no-op function for setUser initially
const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  setUser: () => {}, // Default function
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    // Provide the actual setUser function in the context value
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
