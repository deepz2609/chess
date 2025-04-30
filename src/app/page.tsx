// src/app/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect logged-in users to the dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Show loading skeleton or redirecting state
  if (loading || (!loading && user)) { // Show skeleton while loading or if user exists (before redirect completes)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
         <Skeleton className="h-12 w-1/2 mb-4" />
         <Skeleton className="h-8 w-3/4 mb-8" />
         <div className="flex gap-4">
           <Skeleton className="h-12 w-24" />
           <Skeleton className="h-12 w-24" />
         </div>
      </div>
    );
  }

  // Show landing page content for logged-out users
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4 text-center">
       {/* Chess Icon or Logo Placeholder */}
       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-primary mb-6">
          <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071 1.05l.71.71H6.75a.75.75 0 0 0 0 1.5h6.953l-.71.71a.75.75 0 1 0 1.07 1.05l2.122-2.12a.75.75 0 0 0 0-1.05l-2.122-2.121Zm-.707 6.287a.75.75 0 0 0-1.05-1.07l-.71.71V2.25a.75.75 0 0 0-1.5 0v7.006l-.71-.71a.75.75 0 0 0-1.05 1.07l2.121 2.121a.75.75 0 0 0 1.05 0l2.121-2.12Z" clipRule="evenodd" />
          <path d="M6.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
          <path d="M12.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
          <path d="M18.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
        </svg>
      <h1 className="text-5xl font-bold text-primary mb-4">Welcome to ChessMate!</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-xl">
        The ultimate platform to challenge a powerful AI opponent, analyze your games, and sharpen your chess strategies.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform hover:scale-105">
          <Link href="/login">Login</Link>
        </Button>
        <Button size="lg" variant="outline" asChild className="border-primary text-primary hover:bg-primary/10 shadow-lg transition-transform hover:scale-105">
          <Link href="/signup">Sign Up</Link>
        </Button>
      </div>
       <p className="mt-12 text-sm text-muted-foreground">
         Ready to make your first move?
       </p>
    </div>
  );
}
