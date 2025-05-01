
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Chrome, AlertCircle, Loader2 } from 'lucide-react'; // Using Chrome icon for Google, AlertCircle for error, Loader2 for loading

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"), // Changed min to 1 for presence check
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null); // State for login error message

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (loginError) {
        setLoginError(null);
    }
  };

  const handleEmailLogin = async (values: LoginFormValues) => {
    setLoading(true);
    setLoginError(null); // Clear previous errors
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push("/dashboard"); // Redirect to dashboard after login
    } catch (error: any) {
      console.error("Email login error:", error);
      // Set generic error message instead of toast
      // Common error codes: auth/invalid-email, auth/invalid-credential (wrong password or email), auth/user-not-found, auth/wrong-password
      setLoginError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
     setLoading(true);
     setLoginError(null); // Clear previous errors
     const provider = new GoogleAuthProvider();
     try {
       await signInWithPopup(auth, provider);
       toast({ title: "Login Successful", description: "Welcome!" });
       router.push("/dashboard");
     } catch (error: any) {
       console.error("Google login error:", error);
       // Set generic error message instead of toast
       setLoginError("Google login failed. Please try again.");
     } finally {
       setLoading(false);
     }
   };


  const handleSignUpRedirect = () => {
    router.push("/signup");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl bg-card rounded-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">ChessMate</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEmailLogin)} className="space-y-4"> {/* Reduced space-y */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                         placeholder="you@example.com"
                         {...field}
                         disabled={loading}
                         className={`bg-input focus:ring-accent focus:border-accent ${loginError ? 'border-destructive' : ''}`}
                         onChange={(e) => { field.onChange(e); handleInputChange(); }} // Clear error on change
                       />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        disabled={loading}
                        className={`bg-input focus:ring-accent focus:border-accent ${loginError ? 'border-destructive' : ''}`}
                        onChange={(e) => { field.onChange(e); handleInputChange(); }} // Clear error on change
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Display Login Error Message */}
               {loginError && (
                 <div className="flex items-center text-sm text-destructive">
                   <AlertCircle className="mr-2 h-4 w-4" />
                   {loginError}
                 </div>
               )}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={loading}>
                 {loading && form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 {loading && form.formState.isSubmitting ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </Form>
           {/* Divider */}
           <div className="relative my-4"> {/* Reduced margin */}
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
            {/* Google Sign In Button */}
           <Button variant="outline" className="w-full border-border hover:bg-accent/10" onClick={handleGoogleLogin} disabled={loading}>
              {loading && !form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-5 w-5 text-primary" />}
             Sign in with Google
           </Button>
            {/* Display Google Login Error */}
            {loginError && loginError.includes("Google") && ( // Specific check for Google error message if needed
              <div className="mt-2 flex items-center text-sm text-destructive">
                <AlertCircle className="mr-2 h-4 w-4" />
                {loginError}
              </div>
            )}
        </CardContent>
        <CardFooter className="flex justify-center text-sm mt-2"> {/* Added margin-top */}
          <p className="text-muted-foreground">
            Don't have an account?{' '}
            <Button variant="link" className="p-0 h-auto text-accent font-semibold hover:text-accent/90" onClick={handleSignUpRedirect} disabled={loading}>
              Sign Up
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}


    