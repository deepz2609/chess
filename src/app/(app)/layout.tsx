import { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar"; // Assuming a sidebar component exists or will be created
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
       <SidebarProvider>
        <div className="flex min-h-screen w-full bg-muted/40">
           <AppSidebar />
          <div className="flex flex-col flex-1">
             <AppHeader />
            <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
          </div>
        </div>
       </SidebarProvider>
    </ProtectedRoute>
  );
}
