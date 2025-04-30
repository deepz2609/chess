"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Skeleton } from "@/components/ui/skeleton"; // Use Skeleton for loading state
import { LoaderCircle } from 'lucide-react'; // Use a spinner icon

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and there's no user, redirect to login
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // While loading or if there's no user yet (and not finished loading), show a loading indicator
  if (loading || !user) {
     return (
       <div className="flex flex-col items-center justify-center h-screen bg-background text-primary">
          <LoaderCircle className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Checking authentication...</p>
         {/* Optionally keep a simple skeleton as fallback or visual structure */}
         {/* <Skeleton className="w-1/2 h-1/2 rounded-lg opacity-10" /> */}
       </div>
     );
  }

  // If loading is complete and user exists, render the children
  return <>{children}</>;
};
