"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Skeleton } from "@/components/ui/skeleton"; // Use Skeleton for loading state

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
     // Show loading skeleton or a simple loading message while checking auth
     // Or redirect immediately if preferred, but showing loading provides better UX
     return (
       <div className="flex items-center justify-center h-screen">
         <Skeleton className="w-full h-full rounded-lg" />
       </div>
     );
  }

  return <>{children}</>;
};
