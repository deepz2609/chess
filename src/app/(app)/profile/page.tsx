"use client";

import { useState } from "react"; // Import useState
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input
import { Label } from "@/components/ui/label"; // Import Label
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { updateProfile } from "firebase/auth"; // Import updateProfile
import { auth } from "@/lib/firebase"; // Import auth


export default function ProfilePage() {
  const { user, loading, setUser } = useAuth(); // Get setUser from context to update local state
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [editLoading, setEditLoading] = useState(false);


  // Get initials for avatar fallback
   const getInitials = (email: string | null | undefined, name?: string | null) => {
      if (name) {
          const nameParts = name.trim().split(' ');
          if (nameParts.length > 1) {
              return nameParts[0].charAt(0).toUpperCase() + nameParts[nameParts.length - 1].charAt(0).toUpperCase();
          }
          return nameParts[0].charAt(0).toUpperCase();
      }
      if (email) {
         const emailPrefix = email.split('@')[0];
         return emailPrefix.charAt(0).toUpperCase();
     }
     return "U";
   };

   // Extract username part from email (part before @)
   const getUsernameFromEmail = (email: string | null | undefined): string => {
        if (!email) return "User";
        return email.split('@')[0];
   };

   // Determine the display name: use Firebase displayName if set, otherwise extract from email
   const displayedName = user?.displayName || getUsernameFromEmail(user?.email);

   // Update state when user changes
   useState(() => {
        setNewDisplayName(user?.displayName || '');
   }, [user?.displayName]);


    const handleEditToggle = () => {
        if (!isEditing) {
            // When starting edit, initialize input with current display name
            setNewDisplayName(user?.displayName || '');
        }
        setIsEditing(!isEditing);
    };

    const handleDisplayNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setNewDisplayName(event.target.value);
    };

    const handleUpdateProfile = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent default form submission
        if (!user) return;
        if (!newDisplayName.trim()) {
            toast({ title: "Error", description: "Display name cannot be empty.", variant: "destructive" });
            return;
        }

        setEditLoading(true);
        try {
            await updateProfile(user, { displayName: newDisplayName.trim() });
            // Manually update user in context if setUser is available
            if (setUser) {
                const updatedUser = { ...user, displayName: newDisplayName.trim() };
                 // We need to cast the updated user object to the expected User type from firebase/auth
                 // This is a simplification; ideally, you refetch the user object or ensure type consistency.
                 setUser(updatedUser as any); // Use 'as any' carefully, consider type checking
            }
            toast({ title: "Success", description: "Display name updated successfully." });
            setIsEditing(false); // Exit editing mode
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast({ title: "Error", description: `Failed to update profile: ${error.message}`, variant: "destructive" });
        } finally {
            setEditLoading(false);
        }
    };


  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-primary">Profile</h1>
       <Card className="w-full max-w-lg shadow-lg rounded-xl bg-card border border-border">
         <CardHeader>
           <CardTitle>Your Information</CardTitle>
           <CardDescription>View and manage your account details.</CardDescription>
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
                    <AvatarImage src={user.photoURL || undefined} alt={displayedName} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">{getInitials(user.email, user.displayName)}</AvatarFallback>
                 </Avatar>
               <div>
                  {/* Display Section */}
                 {!isEditing ? (
                   <>
                     <p className="text-lg font-semibold text-foreground">{displayedName}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">User ID: {user.uid}</p>
                      <Button variant="outline" size="sm" onClick={handleEditToggle} className="mt-2">
                       Edit Display Name
                     </Button>
                   </>
                 ) : (
                   // Editing Form
                    <form onSubmit={handleUpdateProfile} className="space-y-3">
                         <Label htmlFor="displayName">Display Name</Label>
                         <Input
                           id="displayName"
                           type="text"
                           value={newDisplayName}
                           onChange={handleDisplayNameChange}
                           placeholder="Enter your display name"
                           disabled={editLoading}
                           className="max-w-xs"
                         />
                         <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={editLoading}>
                               {editLoading ? "Saving..." : "Save Changes"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleEditToggle} disabled={editLoading}>
                               Cancel
                            </Button>
                        </div>
                   </form>
                 )}
               </div>
             </div>
           ) : (
             <p>Could not load user information.</p>
           )}

            {/* Other Account Actions */}
            <div className="pt-4 border-t border-border">
                <h3 className="text-md font-semibold mb-2 text-foreground">Account Actions</h3>
                 <Button variant="outline" disabled>Change Password (Soon)</Button>
                 {/* Add delete account etc. here */}
            </div>
         </CardContent>
       </Card>
    </div>
  );
}
