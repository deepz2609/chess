
"use client";

import { useState, useEffect } from "react"; // Import useState and useEffect
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input
import { Label } from "@/components/ui/label"; // Import Label
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth"; // Import password and delete functions
import { auth } from "@/lib/firebase"; // Import auth
import { useForm } from "react-hook-form"; // Import react-hook-form
import { zodResolver } from "@hookform/resolvers/zod"; // Import zodResolver
import { z } from "zod"; // Import zod
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; // Import Form components
import { AlertCircle, Loader2, Trash2 } from "lucide-react"; // Import icons
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Import AlertDialog
import { useRouter } from "next/navigation"; // Import useRouter for redirect

// Schema for password change form
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"], // path of error
});

type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;


export default function ProfilePage() {
  const { user, loading, setUser } = useAuth(); // Get setUser from context to update local state
  const router = useRouter(); // Get router instance
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false); // State for password form visibility
  const [newDisplayName, setNewDisplayName] = useState(''); // Initialize empty
  const [editNameLoading, setEditNameLoading] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  // State for Delete Account Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState(""); // For re-authentication password
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form hook for password change
  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });


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

   // Update state when user changes (e.g., after login or initial load)
   useEffect(() => {
        if (user) {
            setNewDisplayName(user.displayName || ''); // Initialize with current or empty
        }
   }, [user]); // Dependency on user object


    const handleEditNameToggle = () => {
        if (!isEditingName) {
            // When starting edit, initialize input with current display name
            setNewDisplayName(user?.displayName || '');
            // Close password change form if open
            if (isChangingPassword) {
                setIsChangingPassword(false);
                passwordForm.reset(); // Reset password form fields
                setPasswordChangeError(null); // Clear any previous password errors
            }
             // Close delete dialog if open
            if (isDeleteDialogOpen) {
                setIsDeleteDialogOpen(false);
                setDeletePassword("");
                setDeleteError(null);
            }
        }
        setIsEditingName(!isEditingName);
    };

     const handleChangePasswordToggle = () => {
        if (!isChangingPassword) {
            // Close name edit form if open
            if (isEditingName) {
                setIsEditingName(false);
            }
             // Close delete dialog if open
             if (isDeleteDialogOpen) {
                 setIsDeleteDialogOpen(false);
                 setDeletePassword("");
                 setDeleteError(null);
             }
            passwordForm.reset(); // Ensure form is clear when opening
            setPasswordChangeError(null); // Clear previous errors
        }
        setIsChangingPassword(!isChangingPassword);
    };

    const handleDeleteDialogToggle = () => {
        if (!isDeleteDialogOpen) {
            // Close other forms when opening delete dialog
             if (isEditingName) setIsEditingName(false);
             if (isChangingPassword) {
                 setIsChangingPassword(false);
                 passwordForm.reset();
                 setPasswordChangeError(null);
             }
             setDeletePassword(""); // Reset password field
             setDeleteError(null); // Reset error message
        }
        setIsDeleteDialogOpen(!isDeleteDialogOpen);
    };


    const handleDisplayNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setNewDisplayName(event.target.value);
    };

    const handleUpdateProfile = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent default form submission
        // Ensure auth.currentUser is available directly from the auth instance
        const currentUser = auth.currentUser;
        if (!currentUser) {
            toast({ title: "Error", description: "No user currently signed in.", variant: "destructive" });
            return;
        }
        if (!newDisplayName.trim()) {
            toast({ title: "Error", description: "Display name cannot be empty.", variant: "destructive" });
            return;
        }

        setEditNameLoading(true);
        try {
            // Use auth.currentUser for the updateProfile call
            await updateProfile(currentUser, { displayName: newDisplayName.trim() });

            // Manually update user in context if setUser is available
            if (setUser && user) { // Ensure user exists before spreading
                const updatedUser = { ...user, displayName: newDisplayName.trim() };
                 setUser(updatedUser as any); // Use 'as any' carefully, consider type checking
            }
            toast({ title: "Success", description: "Display name updated successfully." });
            setIsEditingName(false); // Exit editing mode
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast({ title: "Error", description: `Failed to update profile: ${error.message}`, variant: "destructive" });
        } finally {
            setEditNameLoading(false);
        }
    };


     // Handle password change submission
    const handlePasswordChange = async (values: PasswordChangeFormValues) => {
        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) { // Check for email as well
            toast({ title: "Error", description: "User not found or email is missing.", variant: "destructive" });
            return;
        }

        setChangePasswordLoading(true);
        setPasswordChangeError(null); // Clear previous errors

        try {
            // Re-authenticate user - REQUIRED for password change
            const credential = EmailAuthProvider.credential(currentUser.email, values.currentPassword);
             console.log("Attempting re-authentication...");
            await reauthenticateWithCredential(currentUser, credential);
             console.log("Re-authentication successful.");

            // If re-authentication successful, update password
            console.log("Attempting password update...");
            await updatePassword(currentUser, values.newPassword);
             console.log("Password update successful.");

            toast({ title: "Success", description: "Password updated successfully." });
            setIsChangingPassword(false); // Close form on success
            passwordForm.reset(); // Reset form fields

        } catch (error: any) {
             console.error("Error changing password:", error);
             let errorMessage = "Failed to change password.";
             if (error.code === 'auth/wrong-password') {
                errorMessage = "Incorrect current password. Please try again.";
                // Set specific error for the currentPassword field
                passwordForm.setError("currentPassword", { type: "manual", message: errorMessage });
             } else if (error.code === 'auth/requires-recent-login') {
                 errorMessage = "This operation is sensitive and requires recent authentication. Please log in again before retrying this request.";
             } else if (error.code === 'auth/too-many-requests') {
                 errorMessage = "Too many attempts. Please try again later.";
             } else {
                errorMessage = error.message || errorMessage;
             }
             setPasswordChangeError(errorMessage); // Display general error in the alert
            // Keep the form open for correction
        } finally {
            setChangePasswordLoading(false);
        }
    };

      // Handle Account Deletion
      const handleConfirmDelete = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setDeleteError("User not found. Please log in again.");
          return;
        }

        setIsDeleting(true);
        setDeleteError(null);

        try {
          // Re-authentication is strongly recommended for deletion, especially for email/password users
          const isEmailPasswordUser = currentUser.providerData.some(provider => provider.providerId === 'password');

          if (isEmailPasswordUser) {
            if (!deletePassword) {
              setDeleteError("Please enter your current password to confirm deletion.");
              setIsDeleting(false);
              return;
            }
            if (!currentUser.email) {
                setDeleteError("User email not found, cannot re-authenticate.");
                setIsDeleting(false);
                return;
            }
            console.log("Attempting re-authentication for deletion...");
            const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
            await reauthenticateWithCredential(currentUser, credential);
            console.log("Re-authentication successful.");
          }
          // If re-auth not needed (e.g., Google user recently signed in) or successful, proceed with deletion

          console.log("Attempting account deletion...");
          await deleteUser(currentUser);
          console.log("Account deleted successfully.");

          toast({ title: "Account Deleted", description: "Your account has been permanently deleted." });
          setIsDeleteDialogOpen(false);
          // User is automatically signed out after deletion
          // Redirect to login or home page
          router.push('/login');

        } catch (error: any) {
          console.error("Error deleting account:", error);
          let errorMessage = "Failed to delete account.";
          if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect password. Please try again.";
          } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = "This operation is sensitive and requires recent authentication. Please log out and log in again before deleting your account.";
          } else if (error.code === 'auth/too-many-requests') {
             errorMessage = "Too many attempts. Please try again later.";
          } else {
            errorMessage = error.message || errorMessage;
          }
          setDeleteError(errorMessage);
        } finally {
          setIsDeleting(false);
        }
      };


  // Check if user signed in with email/password
  const isEmailPasswordUser = user?.providerData.some(provider => provider.providerId === 'password');


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
                  {/* Display Name Section */}
                 {!isEditingName ? (
                   <>
                     <p className="text-lg font-semibold text-foreground">{displayedName}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">User ID: {user.uid}</p>
                      {!isChangingPassword && !isDeleteDialogOpen && ( // Only show if not changing password or deleting
                          <Button variant="outline" size="sm" onClick={handleEditNameToggle} className="mt-2">
                            Edit Display Name
                         </Button>
                      )}
                   </>
                 ) : (
                   // Editing Name Form
                    <form onSubmit={handleUpdateProfile} className="space-y-3">
                         <Label htmlFor="displayName">Display Name</Label>
                         <Input
                           id="displayName"
                           type="text"
                           value={newDisplayName}
                           onChange={handleDisplayNameChange}
                           placeholder="Enter your display name"
                           disabled={editNameLoading}
                           className="max-w-xs"
                         />
                         <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={editNameLoading}>
                               {editNameLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleEditNameToggle} disabled={editNameLoading}>
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

            {/* Account Actions Section */}
            <div className="pt-4 border-t border-border space-y-4">
                <h3 className="text-md font-semibold text-foreground">Account Actions</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                     {/* Change Password Button */}
                     {!isEditingName && !isDeleteDialogOpen && ( // Hide if editing name or deleting
                         <Button
                           variant="outline"
                           onClick={handleChangePasswordToggle}
                           disabled={!isEmailPasswordUser} // Disable for non-email/password users
                           className="flex-1 sm:flex-none"
                         >
                           {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
                         </Button>
                      )}
                     {/* Delete Account Button */}
                      {!isEditingName && !isChangingPassword && ( // Hide if editing name or changing password
                          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                               <AlertDialogTrigger asChild>
                                  <Button variant="destructive" className="flex-1 sm:flex-none">
                                     <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                                   </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                   <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete your
                                      account and remove your data from our servers.
                                      {isEmailPasswordUser && (
                                        <span className="block mt-2"> Please enter your current password to confirm.</span>
                                       )}
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                  {isEmailPasswordUser && (
                                      <div className="space-y-2">
                                          <Label htmlFor="deletePassword">Current Password</Label>
                                          <Input
                                             id="deletePassword"
                                             type="password"
                                             value={deletePassword}
                                             onChange={(e) => setDeletePassword(e.target.value)}
                                             placeholder="Enter your password"
                                             disabled={isDeleting}
                                             className={deleteError ? "border-destructive focus:border-destructive focus:ring-destructive" : ""}
                                          />
                                      </div>
                                  )}
                                   {deleteError && (
                                     <Alert variant="destructive" className="mt-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{deleteError}</AlertDescription>
                                     </Alert>
                                   )}
                                 <AlertDialogFooter>
                                   <AlertDialogCancel disabled={isDeleting} onClick={() => setDeleteError(null)}>Cancel</AlertDialogCancel>
                                   <AlertDialogAction
                                       onClick={handleConfirmDelete}
                                       disabled={isDeleting || (isEmailPasswordUser && !deletePassword)}
                                       className="bg-destructive hover:bg-destructive/90"
                                   >
                                      {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Yes, Delete Account"}
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                         )}

                 </div>

                  {/* Display message for non-password users */}
                   {!isEditingName && !isDeleteDialogOpen && !isEmailPasswordUser && (
                      <p className="text-xs text-muted-foreground">Password change and standard deletion are not available for accounts signed in with Google.</p>
                   )}

                 {/* Password Change Form */}
                 {isChangingPassword && isEmailPasswordUser && (
                   <Card className="p-4 border-dashed border-primary/50 bg-background">
                     <Form {...passwordForm}>
                       <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                         <FormField
                           control={passwordForm.control}
                           name="currentPassword"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Current Password</FormLabel>
                               <FormControl>
                                 <Input type="password" placeholder="Enter your current password" {...field} disabled={changePasswordLoading} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                         <FormField
                           control={passwordForm.control}
                           name="newPassword"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>New Password</FormLabel>
                               <FormControl>
                                 <Input type="password" placeholder="Enter new password (min. 6 chars)" {...field} disabled={changePasswordLoading} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                         <FormField
                           control={passwordForm.control}
                           name="confirmNewPassword"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Confirm New Password</FormLabel>
                               <FormControl>
                                 <Input type="password" placeholder="Confirm new password" {...field} disabled={changePasswordLoading} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                          {passwordChangeError && (
                            <Alert variant="destructive">
                               <AlertCircle className="h-4 w-4" />
                               <AlertTitle>Error</AlertTitle>
                               <AlertDescription>{passwordChangeError}</AlertDescription>
                            </Alert>
                          )}
                         <Button type="submit" disabled={changePasswordLoading}>
                           {changePasswordLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : "Update Password"}
                         </Button>
                       </form>
                     </Form>
                   </Card>
                 )}
            </div>
         </CardContent>
       </Card>
    </div>
  );
}

