"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent, // Import SidebarGroupContent
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Home, Settings, LayoutDashboard, Swords, User } from 'lucide-react'; // Added Swords for 'Play Game'
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({
        title: 'Logout Failed',
        description: error.message || 'An error occurred during logout.',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (email: string | null | undefined) => {
    if (!email) return "U";
    const nameParts = email.split('@')[0].split('.').map(part => part.charAt(0).toUpperCase());
    return nameParts.length > 1 ? nameParts[0] + nameParts[nameParts.length - 1] : nameParts[0];
  };


  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/play', label: 'Play Game', icon: Swords },
    // Add more menu items here if needed
  ];

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="items-center justify-center p-4 border-b border-sidebar-border">
         <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-primary group-data-[collapsible=icon]:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
               <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071 1.05l.71.71H6.75a.75.75 0 0 0 0 1.5h6.953l-.71.71a.75.75 0 1 0 1.07 1.05l2.122-2.12a.75.75 0 0 0 0-1.05l-2.122-2.121Zm-.707 6.287a.75.75 0 0 0-1.05-1.07l-.71.71V2.25a.75.75 0 0 0-1.5 0v7.006l-.71-.71a.75.75 0 0 0-1.05 1.07l2.121 2.121a.75.75 0 0 0 1.05 0l2.121-2.12Z" clipRule="evenodd" />
               <path d="M6.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
               <path d="M12.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
               <path d="M18.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
             </svg>

           <span className="text-xl font-bold">ChessMate</span>
         </Link>
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-primary group-data-[collapsible=icon]:flex hidden">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
               <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071 1.05l.71.71H6.75a.75.75 0 0 0 0 1.5h6.953l-.71.71a.75.75 0 1 0 1.07 1.05l2.122-2.12a.75.75 0 0 0 0-1.05l-2.122-2.121Zm-.707 6.287a.75.75 0 0 0-1.05-1.07l-.71.71V2.25a.75.75 0 0 0-1.5 0v7.006l-.71-.71a.75.75 0 0 0-1.05 1.07l2.121 2.121a.75.75 0 0 0 1.05 0l2.121-2.12Z" clipRule="evenodd" />
               <path d="M6.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
               <path d="M12.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
               <path d="M18.75 19.5a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .75.75Z" />
             </svg>
         </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <a>
                    <item.icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
       <SidebarFooter className="p-2 border-t border-sidebar-border">
         <SidebarGroup className="p-0">
            <SidebarGroupContent>
                <SidebarMenu>
                     <SidebarMenuItem>
                       <Link href="/profile" passHref legacyBehavior>
                         <SidebarMenuButton asChild isActive={pathname === '/profile'} tooltip="Profile">
                           <a>
                             <User className="h-4 w-4" />
                             <span>Profile</span>
                           </a>
                         </SidebarMenuButton>
                       </Link>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                       <Link href="/settings" passHref legacyBehavior>
                         <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip="Settings">
                           <a>
                              <Settings className="h-4 w-4" />
                              <span>Settings</span>
                           </a>
                         </SidebarMenuButton>
                       </Link>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                         <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                             <LogOut className="h-4 w-4 text-destructive" />
                             <span className="text-destructive">Logout</span>
                         </SidebarMenuButton>
                     </SidebarMenuItem>
                   </SidebarMenu>
            </SidebarGroupContent>
         </SidebarGroup>
       </SidebarFooter>
    </Sidebar>
  );
}
