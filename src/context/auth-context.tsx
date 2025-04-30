"use client";

import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
// Removed Skeleton import as ProtectedRoute handles loading display

interface AuthContextProps {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextProps>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
       // console.log("Auth State Changed:", currentUser ? currentUser.uid : 'No user'); // Optional: Log auth changes
    });

    // Cleanup subscription on unmount
    return () => {
       // console.log("Unsubscribing auth listener"); // Optional: Log cleanup
       unsubscribe();
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // The value provided by the context includes the user and loading state.
  // Components consuming this context (like ProtectedRoute) will handle conditional rendering based on these values.
  // No need to render a loading state directly within the provider itself.
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
