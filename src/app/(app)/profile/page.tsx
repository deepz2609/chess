"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { user, loading } = useAuth();

   const getInitials = (email: string | null | undefined) => {
     if (!email) return "U";
     const nameParts = email.split('@')[0].split('.').map(part => part.charAt(0).toUpperCase());
     return nameParts.length > 1 ? nameParts[0] + nameParts[nameParts.length - 1] : nameParts[0];
   };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-primary">Profile</h1>
       <Card className="w-full max-w-lg shadow-lg rounded-xl bg-card border border-border">
         <CardHeader>
           <CardTitle>Your Information</CardTitle>
           <CardDescription>Manage your account details.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-6">
           {loading ? (
              <div className="flex items-center space-x-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[250px]" />
                  </div>
              </div>
           ) : user ? (
             <div className="flex items-center space-x-4">
                 <Avatar className="h-16 w-16 border-2 border-accent">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">{getInitials(user.email)}</AvatarFallback>
                 </Avatar>
               <div>
                 <p className="text-lg font-semibold text-foreground">{user.displayName || "No display name set"}</p>
                 <p className="text-sm text-muted-foreground">{user.email}</p>
                 <p className="text-xs text-muted-foreground mt-1">User ID: {user.uid}</p>
               </div>
             </div>
           ) : (
             <p>Could not load user information.</p>
           )}

            {/* Add form fields for editing profile later */}
            <div className="pt-4 border-t border-border">
                <h3 className="text-md font-semibold mb-2 text-foreground">Account Actions</h3>
                <Button variant="outline" disabled>Update Profile (Soon)</Button>
                {/* Add password change, delete account etc. here */}
            </div>
         </CardContent>
       </Card>
    </div>
  );
}
