"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Settings, Menu } from 'lucide-react';
import { useAuth } from "@/context/auth-context";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar"; // Import SidebarTrigger
import Link from "next/link"; // Import Link

export function AppHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login'); // Redirect to login after logout
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: error.message || "An error occurred during logout.",
        variant: "destructive",
      });
    }
  };

  // Get user initials for fallback avatar
  const getInitials = (email: string | null | undefined) => {
    if (!email) return "U"; // Default User initial
    const nameParts = email.split('@')[0].split('.').map(part => part.charAt(0).toUpperCase());
    return nameParts.length > 1 ? nameParts[0] + nameParts[nameParts.length - 1] : nameParts[0];
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 lg:px-8">
       <SidebarTrigger className="sm:hidden" /> {/* Add SidebarTrigger for mobile */}
       <div className="flex-1" /> {/* Spacer */}
       <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-9 w-9 border-2 border-accent">
              {/* Add AvatarImage if user has a photoURL */}
               <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || user?.email || 'User'} />
              <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(user?.email)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-lg rounded-lg mt-2">
          <DropdownMenuLabel className="font-normal">
             <div className="flex flex-col space-y-1">
               <p className="text-sm font-medium leading-none">{user?.displayName || 'User'}</p>
               <p className="text-xs leading-none text-muted-foreground">
                 {user?.email}
               </p>
             </div>
           </DropdownMenuLabel>
          <DropdownMenuSeparator />
           <Link href="/profile" passHref legacyBehavior>
             <DropdownMenuItem className="cursor-pointer hover:bg-accent/10">
               <User className="mr-2 h-4 w-4" />
               <span>Profile</span>
             </DropdownMenuItem>
           </Link>
           <Link href="/settings" passHref legacyBehavior>
             <DropdownMenuItem className="cursor-pointer hover:bg-accent/10">
               <Settings className="mr-2 h-4 w-4" />
               <span>Settings</span>
             </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
