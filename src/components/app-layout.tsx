

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  SidebarClose,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Settings, Moon, Sun, LogOut, ListTree, HelpCircle, User as UserIcon, LifeBuoy, CalendarDays, CalendarOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "./ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { getAuth, signOut } from "firebase/auth";
import { cn } from "@/lib/utils";

const Logo = ({className}: {className?: string}) => (
  <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M24 10C17.37 10 12 15.37 12 22C12 28.63 17.37 34 24 34C30.63 34 36 28.63 36 22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24 34C30.63 34 36 28.63 36 22C36 15.37 30.63 10 24 10C17.37 10 12 15.37 12 22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 8"/>
    <path d="M24 4V10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <path d="M24 34V40" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

const getInitials = (name: string | null | undefined) => {
    if (!name) return "AD";
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

function ThemeToggle() {
    const { setTheme, theme } = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")} className={cn({"bg-accent": theme === "light"})}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className={cn({"bg-accent": theme === "dark"})}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} className={cn({"bg-accent": theme === "system"})}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function LoggedInHeaderContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { state: sidebarState, isMobile } = useSidebar();
  const isCollapsed = sidebarState === 'collapsed';

  const handleLogout = async () => {
    await signOut(getAuth());
    router.push("/");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger/>}
        {isCollapsed && !isMobile && (
             <Link href="/" className="flex items-center gap-2">
               <div className="bg-primary text-primary-foreground rounded-lg flex items-center justify-center h-8 w-8">
                <Logo />
               </div>
               <span className="font-bold text-xl">RotaPro</span>
            </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push('/settings')}>
              <UserIcon className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function PublicHeaderContent() {
    return (
    <>
        <div className="mr-4 flex items-center">
            <Link href="/" className="flex items-center gap-2">
               <Logo className="text-primary" />
               <span className="font-bold text-xl">RotaPro</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center">
              <Button asChild variant="ghost">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </nav>
          </div>
    </>
    )
}

function PublicFooter() {
    const pathname = usePathname();
    const isLandingPage = pathname === '/';
    return (
        <footer className="py-12 border-t">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} RotaPro. All rights reserved.
                </p>
                <p className="text-sm text-muted-foreground">
                    Build with <span className="text-blue-500">💙</span> by{' '}
                    <a
                    href="https://fi-xpert.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    >
                    FIXpert
                    </a>
                </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/about" className="hover:text-primary transition-colors">About Us</Link>
                <Link href={isLandingPage ? "#contact" : "/contact"} className="hover:text-primary transition-colors">Contact</Link>
                <Link href="/terms" className="hover:text-primary transition-colors">Terms & Privacy</Link>
            </div>
            </div>
        </footer>
    )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  
  const isPublicPage = ["/", "/about", "/contact", "/terms", "/login", "/signup"].includes(pathname);

  if (!user && !isPublicPage) {
    // This is handled by AuthGate, but as a fallback
    return <>{children}</>;
  }

  if (!user || isPublicPage) {
     return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center">
                   <PublicHeaderContent />
                </div>
            </header>
            <div className="flex-1">{children}</div>
            <PublicFooter />
        </div>
     )
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar>
        <SidebarHeader>
            <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
              <div className="bg-primary text-primary-foreground rounded-lg flex items-center justify-center h-8 w-8">
                  <Logo />
              </div>
              <div className="flex flex-col">
                  <span className="text-lg font-semibold">RotaPro</span>
              </div>
            </div>
             <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
               <SidebarTrigger />
            </div>
          <SidebarClose />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/dashboard"}
                tooltip="Dashboard"
              >
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/support")}
                tooltip="Support Rota"
              >
                <Link href="/support">
                  <LifeBuoy />
                  <span className="group-data-[collapsible=icon]:hidden">Support Rota</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/weekend")}
                tooltip="Weekend Rota"
              >
                <Link href="/weekend">
                  <CalendarDays />
                  <span className="group-data-[collapsible=icon]:hidden">Weekend Rota</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/leave")}
                tooltip="Leave"
              >
                <Link href="/leave">
                  <CalendarOff />
                  <span className="group-data-[collapsible=icon]:hidden">Leave</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/matrix")}
                tooltip="Rota Matrix"
              >
                <Link href="/matrix">
                  <ListTree />
                  <span className="group-data-[collapsible=icon]:hidden">Rota Matrix</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/admin")}
                tooltip="Config Panel"
              >
                <Link href="/admin">
                  <Settings />
                  <span className="group-data-[collapsible=icon]:hidden">Config Panel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
            <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    isActive={pathname === "/guide"}
                    tooltip="User Guide"
                >
                    <Link href="/guide">
                        <HelpCircle />
                        <span className="group-data-[collapsible=icon]:hidden">User Guide</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-4 border-b bg-background/50 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6">
            <LoggedInHeaderContent />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
