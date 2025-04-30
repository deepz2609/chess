"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Example setting

export default function SettingsPage() {

  // Example state for a setting
  // const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-primary">Settings</h1>
       <Card className="w-full max-w-lg shadow-lg rounded-xl bg-card border border-border">
         <CardHeader>
           <CardTitle>Application Settings</CardTitle>
           <CardDescription>Customize your ChessMate experience.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-6">
            {/* Example Setting: Dark Mode Toggle */}
             <div className="flex items-center justify-between p-4 border border-border rounded-lg">
               <div>
                 <Label htmlFor="dark-mode" className="text-base font-medium text-foreground">
                   Dark Mode
                 </Label>
                 <p className="text-sm text-muted-foreground">Toggle dark theme (visual only, needs implementation).</p>
               </div>
               <Switch
                 id="dark-mode"
                 // checked={darkMode}
                 // onCheckedChange={setDarkMode}
                 disabled // Disabled until theme switching is implemented
               />
             </div>

              {/* Example Setting: Sound Effects */}
             <div className="flex items-center justify-between p-4 border border-border rounded-lg">
               <div>
                 <Label htmlFor="sound-effects" className="text-base font-medium text-foreground">
                   Sound Effects
                 </Label>
                 <p className="text-sm text-muted-foreground">Enable sounds for moves and checks (coming soon).</p>
               </div>
               <Switch
                 id="sound-effects"
                 disabled
               />
             </div>

             {/* Add more settings sections as needed */}
             <div className="pt-4 border-t border-border">
                 <h3 className="text-md font-semibold mb-2 text-foreground">Preferences</h3>
                 <p className="text-sm text-muted-foreground">More customization options will be available here.</p>
                 {/* e.g., Piece style selection, board theme variants */}
             </div>

         </CardContent>
       </Card>
    </div>
  );
}