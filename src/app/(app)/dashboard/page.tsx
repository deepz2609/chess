
"use client";

import React, { useEffect } from 'react'; // Added React import
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Table components
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { Swords, BarChart, UserCircle, Frown, Smile, Meh, Clock, CalendarDays, AlertCircle } from "lucide-react"; // Added Clock icon, Adjusted icons for stats and error
import { db } from '@/lib/firebase'; // Import Firestore instance
import { collection, query, where, getDocs, orderBy, Timestamp, limit, FirestoreError } from 'firebase/firestore'; // Import Firestore functions and FirestoreError type
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Import react-query
import { formatDistanceToNow, format } from 'date-fns'; // For relative time formatting and duration

// Define interface for game stats document
interface GameStat {
  id: string;
  userId: string;
  result: 'win' | 'loss' | 'draw';
  opponent: string;
  playerColor: 'w' | 'b';
  reason: string;
  timestamp: Timestamp;
  winner: 'Player' | 'AI' | 'Draw'; // Added winner field
  timeElapsedMs: number; // Added time elapsed field
}

// Create a react-query client
const queryClient = new QueryClient();

// Fetch game stats function
const fetchGameStats = async (userId: string): Promise<GameStat[]> => {
  if (!userId) return []; // Return empty if no user ID
  console.log("Fetching game stats for user:", userId);
  const statsRef = collection(db, "gameStats");

  // IMPORTANT: This query requires a composite index in Firestore.
  // Firestore Error: "The query requires an index..." indicates this index is missing.
  // Index Fields:
  // 1. `userId` ASCENDING
  // 2. `timestamp` DESCENDING
  // Create it here: https://console.firebase.google.com/project/_/firestore/indexes/composite/create?collectionId=gameStats&fieldId1=userId&fieldOrder1=ASCENDING&fieldId2=timestamp&fieldOrder2=DESCENDING
  // Replace '_' with your actual Firebase Project ID in the link above if it doesn't redirect correctly.
  const q = query(statsRef, where("userId", "==", userId), orderBy("timestamp", "desc"), limit(10));

  try {
      const querySnapshot = await getDocs(q);
      const stats = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameStat));
      console.log("Fetched stats:", stats);
      return stats;
  } catch (err: unknown) { // Catch unknown type
      // Check if it's a FirestoreError indicating a missing index
      // Correctly use FirestoreError type
      if (err instanceof FirestoreError && err.code === 'failed-precondition') {
          console.error("Error fetching game stats: Missing Firestore index.", err);
          // Re-throw a more specific error message that the UI can detect
          throw new Error("Firestore query requires a composite index. Please create it in the Firebase console (see code comments or error log for link).");
      } else {
        console.error("Error fetching game stats (check Firestore rules and connectivity):", err);
      }
      // Re-throw the original or modified error so react-query can handle the error state
      throw err;
  }

};

// Format duration from milliseconds to a readable string (e.g., "1m 25s")
const formatDuration = (ms: number | undefined): string => {
    if (ms === undefined || ms < 0) return 'N/A';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
};


function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();

  // Use react-query to fetch stats
  const { data: gameStats, isLoading, error, isError } = useQuery<GameStat[], Error>({
    queryKey: ['gameStats', user?.uid], // Query key includes user ID
    queryFn: () => fetchGameStats(user!.uid), // Query function
    enabled: !!user, // Only run query if user exists
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1, // Only retry once on error
  });

  useEffect(() => {
      if (error) {
          console.error("Error fetching game stats (from useQuery):", error.message);
          // Optionally show a toast notification for the error
          // toast({ title: "Error", description: "Could not load game stats.", variant: "destructive" });
      }
  }, [error]);


  const handleNewGame = () => {
    router.push('/play');
  };

   // Calculate overall stats
   const calculateStats = (stats: GameStat[] | undefined) => {
     if (!stats) return { wins: 0, losses: 0, draws: 0 };
     return stats.reduce((acc, game) => {
       if (game.result === 'win') acc.wins++;
       else if (game.result === 'loss') acc.losses++;
       else if (game.result === 'draw') acc.draws++;
       return acc;
     }, { wins: 0, losses: 0, draws: 0 });
   };

   const overallStats = calculateStats(gameStats);

  // Determine if the error is the specific missing index error by checking the message
  const isMissingIndexError = !!error?.message.includes("Firestore query requires a composite index");

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
            {/* Adjusted text size for email display */}
            <div className="text-xl font-bold">{user?.displayName || 'Player'}</div>
             <p className="text-xs text-muted-foreground truncate"> {/* Added truncate */}
                {user?.email}
             </p>
            <p className="text-xs text-muted-foreground mt-1">
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

         {/* Overall Stats Card */}
         <Card className="shadow-lg rounded-xl bg-card hover:shadow-accent/20 transition-shadow duration-300">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium text-primary">Overall Stats</CardTitle>
             <BarChart className="h-5 w-5 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                </div>
             ) : isError ? ( // Use isError state from react-query
                <p className='text-destructive text-xs'>Error loading stats.</p>
             ) : gameStats?.length === 0 ? (
                <p className='text-muted-foreground text-sm'>Play some games to see your stats!</p>
             ) : (
                 <div className="flex justify-around items-center text-center">
                   <div className="flex flex-col items-center">
                      <Smile className="h-6 w-6 text-primary mb-1" />
                     <span className="text-xl font-bold">{overallStats.wins}</span>
                     <span className="text-xs text-muted-foreground">Wins</span>
                   </div>
                   <div className="flex flex-col items-center">
                      <Frown className="h-6 w-6 text-destructive mb-1" />
                     <span className="text-xl font-bold">{overallStats.losses}</span>
                     <span className="text-xs text-muted-foreground">Losses</span>
                   </div>
                   <div className="flex flex-col items-center">
                      <Meh className="h-6 w-6 text-accent mb-1" />
                     <span className="text-xl font-bold">{overallStats.draws}</span>
                     <span className="text-xs text-muted-foreground">Draws</span>
                   </div>
                 </div>
             )}

           </CardContent>
         </Card>

      </div>

       {/* Recent Games Section */}
       <Card className="shadow-lg rounded-xl bg-card hover:shadow-accent/20 transition-shadow duration-300">
           <CardHeader>
               <CardTitle className="text-xl font-semibold text-primary">Recent Games</CardTitle>
               <CardDescription>Your last 10 games against the AI.</CardDescription>
           </CardHeader>
           <CardContent>
                <ScrollArea className="h-[300px] w-full"> {/* Adjust height as needed */}
                    {isLoading ? (
                         <div className="space-y-4 p-4">
                             {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                             ))}
                         </div>
                    ) : isError ? ( // Use isError state from react-query
                         <div className='text-destructive text-center p-4 flex flex-col items-center gap-2'>
                            <AlertCircle className="h-6 w-6" />
                            <p>Could not load recent games.</p>
                             {isMissingIndexError ? (
                                <p className="text-xs text-muted-foreground">(Action Required: Create Firestore Index in Firebase Console. See error log or code comments for details and link.)</p>
                             ) : (
                                <p className="text-xs text-muted-foreground">(Check network connection or Firestore Rules)</p>
                             )}

                             {/* Optional: Add a button to retry fetching */}
                             {/* <Button variant="outline" size="sm" onClick={() => queryClient.refetchQueries({ queryKey: ['gameStats', user?.uid] })}>Retry</Button> */}
                         </div>
                    ) : gameStats && gameStats.length > 0 ? (
                         <Table>
                             <TableHeader>
                                 <TableRow>
                                     <TableHead>Result</TableHead>
                                     <TableHead>Color</TableHead>
                                     <TableHead>Winner</TableHead>
                                     <TableHead>Reason</TableHead>
                                     <TableHead>Duration</TableHead>
                                     <TableHead className="text-right">Date</TableHead>
                                 </TableRow>
                             </TableHeader>
                             <TableBody>
                                 {gameStats.map((game) => (
                                     // Ensure no extra whitespace between TableCell components
                                     <TableRow key={game.id}><TableCell className={`font-medium ${
                                              game.result === 'win' ? 'text-primary' : game.result === 'loss' ? 'text-destructive' : 'text-accent' // Adjusted colors
                                             }`}>{game.result.charAt(0).toUpperCase() + game.result.slice(1)}</TableCell><TableCell>{game.playerColor === 'w' ? 'White' : 'Black'}</TableCell><TableCell>{game.winner}</TableCell><TableCell className="text-xs text-muted-foreground">{game.reason}</TableCell><TableCell className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/>{formatDuration(game.timeElapsedMs)}</TableCell><TableCell className="text-right text-xs text-muted-foreground">{game.timestamp ? formatDistanceToNow(game.timestamp.toDate(), { addSuffix: true }) : 'N/A'}</TableCell></TableRow>
                                 ))}
                             </TableBody>
                         </Table>
                    ) : (
                         <p className='text-muted-foreground text-center p-4'>No recent games found. Go play!</p>
                    )}
                </ScrollArea>
           </CardContent>
       </Card>

     </div>
  );
}


// Wrap the component with QueryClientProvider
export default function DashboardPage() {
    return (
        <QueryClientProvider client={queryClient}>
            <DashboardContent />
        </QueryClientProvider>
    );
}
