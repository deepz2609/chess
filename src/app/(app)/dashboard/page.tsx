"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { Swords, BarChart, UserCircle } from "lucide-react"; // Example icons

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const handleNewGame = () => {
    router.push('/play');
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-primary">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Welcome Card */}
        <Card className="shadow-lg rounded-xl bg-card hover:shadow-accent/20 transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Welcome back!</CardTitle>
             <UserCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* Changed text-2xl to text-xl */}
            <div className="text-xl font-bold">{user?.displayName || user?.email || 'Player'}</div>
            <p className="text-xs text-muted-foreground">
              Ready for your next challenge?
            </p>
          </CardContent>
        </Card>

         {/* Start New Game Card */}
        <Card className="shadow-lg rounded-xl bg-card hover:shadow-accent/20 transition-shadow duration-300 cursor-pointer" onClick={handleNewGame}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">New Game</CardTitle>
             <Swords className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Play vs AI</div>
             <Button variant="link" className="p-0 h-auto text-accent font-semibold hover:text-accent/90" onClick={handleNewGame}>
              Start Game
            </Button>
          </CardContent>
        </Card>

         {/* Stats Card (Placeholder) */}
         <Card className="shadow-lg rounded-xl bg-card hover:shadow-accent/20 transition-shadow duration-300">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium text-primary">Your Stats</CardTitle>
             <BarChart className="h-5 w-5 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">Coming Soon</div>
             <p className="text-xs text-muted-foreground">
               Track your wins, losses, and ELO rating.
             </p>
           </CardContent>
         </Card>

      </div>

       {/* Add more dashboard widgets or sections here */}
       {/* For example: Recent Games List, Friends List, Puzzles, etc. */}

     </div>
  );
}
