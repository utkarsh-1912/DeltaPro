"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Settings,
  Moon,
  Sun,
  LogOut,
  ListTree,
  User as UserIcon,
  CalendarOff,
  GanttChartSquare,
  Briefcase,
  FileText,
  CheckSquare,
  Users,
  Clock,
  ChevronRight,
  Search as SearchIcon,
  Bell,
  AlertCircle,
  CheckCircle2,
  Menu,
  X
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Command as CommandPrimitive, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";

const SIDEBAR_WIDTH = 260;
const COLLAPSED_WIDTH = 80;

const Logo = ({ className }: { className?: string }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14 4L4 24H24L14 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 24L14 14L24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch (e) { } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const getIcon = (category: string) => {
    switch (category) {
      case "Employee": return Users;
      case "Project": return Briefcase;
      case "Task": return CheckSquare;
      case "Workspace": return FileText;
      default: return FileText;
    }
  };

  const groupedResults = React.useMemo(() => {
    return results.reduce((acc: any, item: any) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [results]);

  return (
    <>
      <div className="relative hidden md:block group">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Button
          variant="outline"
          className="h-9 w-64 justify-start bg-muted/50 border-none pl-9 pr-4 text-sm font-normal text-muted-foreground hover:bg-muted/80 rounded-full"
          onClick={() => setOpen(true)}
        >
          Search enterprise...
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 uppercase">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-3xl rounded-2xl bg-background/95 backdrop-blur-xl mt-[10vh]">
          <DialogTitle className="sr-only">Enterprise Search</DialogTitle>
          <DialogDescription className="sr-only">Search across all modules including tasks, projects, employees and workspaces.</DialogDescription>
          <CommandPrimitive className="flex h-full w-full flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center border-b px-4 py-4 gap-3">
              <SearchIcon className="h-5 w-5 text-primary animate-pulse" />
              <CommandInput
                placeholder="Search across all modules..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-bold outline-none placeholder:text-muted-foreground/30"
                value={query}
                onValueChange={setQuery}
              />
              <div className="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-black tracking-widest uppercase opacity-40 select-none">Esc</div>
            </div>

            <CommandList className="max-h-[450px] overflow-y-auto overflow-x-hidden p-2 scrollbar-hide">
              <CommandEmpty className="py-20 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center">
                    <SearchIcon className="h-8 w-8 opacity-20" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-40">No records found</p>
                </div>
              </CommandEmpty>

              {Object.entries(groupedResults).map(([category, items]: [string, any]) => (
                <CommandGroup
                  key={category}
                  heading={category}
                  className="px-3 pt-6 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 first:pt-2"
                >
                  <div className="space-y-1 mt-1">
                    {items.map((item: any, i: number) => {
                      const Icon = getIcon(item.category);
                      return (
                        <CommandItem
                          key={i}
                          onSelect={() => { setOpen(false); router.push(item.href); }}
                          className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-primary/5 group transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-muted/40 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm tracking-tight">{item.label}</span>
                              {item.subLabel && <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{item.subLabel}</span>}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                        </CommandItem>
                      );
                    })}
                  </div>
                </CommandGroup>
              ))}

              {query.length === 0 && (
                <div className="p-10 text-center space-y-4">
                  <div className="px-4 py-2 inline-flex gap-4 bg-muted/20 rounded-2xl border border-dashed">
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded bg-muted-foreground/10 text-[9px] font-bold">↑↓</kbd>
                      <span className="text-[9px] font-black uppercase tracking-tighter opacity-40">Navigate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded bg-muted-foreground/10 text-[9px] font-bold">Enter</kbd>
                      <span className="text-[9px] font-black uppercase tracking-tighter opacity-40">Open</span>
                    </div>
                  </div>
                </div>
              )}
            </CommandList>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationCenter() {
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id?: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify(id ? { id } : { markAll: true })
      });
      fetchNotifications();
    } catch (err) { }
  };

  const handleClear = async (id?: string) => {
    try {
      await fetch(`/api/notifications?${id ? `id=${id}` : 'all=true'}`, { method: "DELETE" });
      fetchNotifications();
    } catch (err) { }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "task": return <CheckSquare className="h-4 w-4 text-blue-500" />;
      case "alert": return <AlertCircle className="h-4 w-4 text-rose-500" />;
      default: return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "JUST NOW";
    if (hours < 24) return `${hours} HOURS AGO`;
    return `${Math.floor(hours / 24)} DAYS AGO`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full relative text-muted-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full border-2 border-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 rounded-2xl shadow-2xl border-border/40 overflow-hidden bg-background/80 backdrop-blur-xl z-50">
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold">Notifications</h3>
            {unreadCount > 0 && <Badge variant="outline" className="text-[10px] font-bold">{unreadCount} New</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs font-medium" onClick={() => handleMarkRead()}>Mark all read</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-rose-500 hover:text-rose-600" onClick={() => handleClear()}>Clear</Button>
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading feed...</div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-border/40">
              {notifications.map((n) => (
                <div key={n.id} className="w-full p-4 flex gap-4 text-left hover:bg-primary/5 transition-all group relative">
                  <div className="mt-1 h-8 w-8 rounded-full bg-background flex items-center justify-center border border-border/40 shrink-0 group-hover:scale-110 transition-transform">
                    {getIcon(n.type)}
                  </div>
                  <div className="space-y-1 overflow-hidden flex-1">
                    <p className={cn("text-sm font-bold leading-none", n.read ? "text-muted-foreground" : "")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                    <p className="text-[10px] text-muted-foreground/60 font-bold uppercase pt-1">{formatTime(n.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!n.read && <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-auto">
                      {!n.read && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}><CheckCircle2 className="h-3 w-3" /></Button>}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500" onClick={(e) => { e.stopPropagation(); handleClear(n.id); }}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center space-y-3">
              <div className="h-12 w-12 bg-primary/5 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold">You're all caught up!</p>
                <p className="text-xs text-muted-foreground">No new notifications.</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const paths = pathname.split('/').filter(Boolean);

  if (paths.length === 0) return <span className="text-sm font-medium text-muted-foreground">Home</span>;

  return (
    <div className="flex items-center gap-2 text-sm z-10 relative">
      <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium">DeltaPro</Link>
      {paths.map((path, i) => (
        <React.Fragment key={path}>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          <span className={cn(
            "capitalize shrink-0",
            i === paths.length - 1 ? "font-bold text-foreground" : "text-muted-foreground font-medium"
          )}>
            {path.replace(/-/g, ' ')}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function UserProfileWidget({ isCollapsed }: { isCollapsed?: boolean }) {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-12 w-full justify-start gap-3 px-2 hover:bg-muted/50 transition-all rounded-xl border border-transparent hover:border-border/40 shrink-0 overflow-hidden">
          <Avatar className="h-8 w-8 border-2 border-background shadow-sm shrink-0">
            <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-start truncate overflow-hidden">
              <p className="text-sm font-bold truncate leading-none mb-1">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-tight inline-flex items-center">
                {user?.role || "Team Member"}
              </p>
            </motion.div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-64 p-2 rounded-2xl shadow-2xl border-border/40 backdrop-blur-xl z-50 mb-2">
        <DropdownMenuLabel className="font-normal px-3 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md transform transition-transform hover:scale-105">
              <AvatarImage src={user?.image || undefined} />
              <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-0.5 overflow-hidden">
              <p className="text-sm font-bold leading-none truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-muted/50" />
        <DropdownMenuItem onClick={() => router.push('/settings')} className="py-2.5 rounded-lg focus:bg-primary/5 cursor-pointer">
          <UserIcon className="mr-3 h-4 w-4 text-muted-foreground" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/admin')} className="py-2.5 rounded-lg focus:bg-primary/5 cursor-pointer text-blue-500 font-medium">
          <Settings className="mr-3 h-4 w-4" />
          Admin Panel
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-muted/50" />
        <DropdownMenuItem onClick={handleLogout} className="py-2.5 rounded-lg focus:bg-rose-50 hover:text-rose-600 focus:text-rose-600 cursor-pointer text-rose-500 font-bold transition-colors">
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavSection({ title, children, isCollapsed }: { title: string; children: React.ReactNode; isCollapsed: boolean }) {
  return (
    <div className="space-y-1 mb-6 px-3 relative">
      {!isCollapsed && (
        <motion.h4 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 mb-2 text-[10px] font-extrabold text-muted-foreground/60 uppercase tracking-[0.2em] truncate">
          {title}
        </motion.h4>
      )}
      <ul className="space-y-1">
        {children}
      </ul>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  isCollapsed
}: {
  href: string;
  icon: any;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center relative h-10 px-3 transition-colors font-medium rounded-xl group select-none whitespace-nowrap overflow-hidden",
          isActive
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
        title={isCollapsed ? label : undefined}
      >
        <Icon className={cn("h-5 w-5 shrink-0", isActive ? "stroke-[2.5px]" : "stroke-2")} />
        {!isCollapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-3 truncate">{label}</motion.span>
        )}
        {isActive && !isCollapsed && (
          <motion.div
            layoutId="sidebar-active-indicator"
            className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary-foreground shadow-sm"
          />
        )}
      </Link>
    </li>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();
  const { setTheme, theme } = useTheme();

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const isPublicPage = ["/", "/about", "/contact", "/privacy", "/terms", "/login", "/signup"].includes(pathname);

  if (status === "unauthenticated" || isPublicPage) {
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl border-border/40 shrink-0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                <Logo />
              </div>
              <span className="font-extrabold text-xl tracking-tight">DeltaPro</span>
            </Link>

            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="font-bold px-2 h-8">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full px-4 h-8 font-bold shadow-lg shadow-primary/20">
                <Link href="/signup">Join</Link>
              </Button>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <Button asChild variant="ghost" size="sm" className="font-bold">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full px-6 font-bold shadow-xl shadow-primary/20 hover:-translate-y-0.5 transition-transform">
                <Link href="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>
        <main className="relative flex-1">{children}</main>
        {pathname !== "/login" && pathname !== "/signup" && (
          <footer className="py-12 border-t bg-muted/20 shrink-0">
            <div className="container mx-auto px-4 text-center">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  &copy; {new Date().getFullYear()} DeltaLabs by Utkristi.io
                </p>
                <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <Link href="/about" className="hover:text-primary transition-colors">About</Link>
                  <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
                  <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                  <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
                </div>
              </div>
            </div>
          </footer>
        )}
      </div>
    );
  }

  // --- PRIVATE EXACT LAYOUT ARCHITECTURE ---
  // Using native CSS Flexbox & CSS Custom Properties for perfect adherence and 0 overlap
  const currentSidebarWidth = isSidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_WIDTH;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Sidebar Header */}
      <div className="h-16 shrink-0 flex items-center px-4 border-b border-border/40">
        <div className="flex items-center gap-3 overflow-hidden ml-1">
          <div className="h-9 w-9 shrink-0 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Logo />
          </div>
          {!isSidebarOpen && !isMobileOpen ? null : (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
              <span className="text-lg font-black tracking-tight leading-none uppercase text-foreground">DeltaPro</span>
              <span className="text-[9px] font-bold text-primary tracking-widest uppercase">Enterprise</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Sidebar Scrollable Nav */}
      <ScrollArea className="flex-1 overflow-y-auto overflow-x-hidden pt-6 pb-4">
        <NavSection title="Overview" isCollapsed={!isSidebarOpen && !isMobileOpen}>
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" isActive={pathname === "/dashboard"} isCollapsed={!isSidebarOpen && !isMobileOpen} />
        </NavSection>

        <NavSection title="HRM & Workforce" isCollapsed={!isSidebarOpen && !isMobileOpen}>
          <NavItem href="/attendance" icon={Clock} label="Attendance" isActive={pathname.startsWith("/attendance")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
          <NavItem href="/leave" icon={CalendarOff} label="Leave Matrix" isActive={pathname.startsWith("/leave")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
          <NavItem href="/employees" icon={Users} label="Employee Directory" isActive={pathname.startsWith("/employees")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
        </NavSection>

        <NavSection title="Project & Tasks" isCollapsed={!isSidebarOpen && !isMobileOpen}>
          <NavItem href="/projects" icon={Briefcase} label="Projects" isActive={pathname.startsWith("/projects")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
          <NavItem href="/tasks" icon={CheckSquare} label="My Tasks" isActive={pathname.startsWith("/tasks")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
        </NavSection>

        <NavSection title="Knowledge & Docs" isCollapsed={!isSidebarOpen && !isMobileOpen}>
          <NavItem href="/docs" icon={FileText} label="Workspaces" isActive={pathname.startsWith("/docs")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
        </NavSection>

        <NavSection title="Operations" isCollapsed={!isSidebarOpen && !isMobileOpen}>
          <NavItem href="/rota" icon={GanttChartSquare} label="Shift Rota" isActive={pathname.startsWith("/rota")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
          <NavItem href="/matrix" icon={ListTree} label="Rota Matrix" isActive={pathname.startsWith("/matrix")} isCollapsed={!isSidebarOpen && !isMobileOpen} />
        </NavSection>
      </ScrollArea>

      {/* Sidebar Footer Menu */}
      <div className="shrink-0 p-3 border-t border-border/40 bg-muted/10">
        <UserProfileWidget isCollapsed={!isSidebarOpen && !isMobileOpen} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-body max-w-[100vw]">

      {/* DESKTOP SIDEBAR (FIXED LEFT) */}
      <aside
        className="hidden md:block shrink-0 border-r border-border/40 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform z-30"
        style={{ width: `${currentSidebarWidth}px` }}
      >
        {sidebarContent}
      </aside>

      {/* MOBILE SIDEBAR MODAL */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-background border-r border-border/50 z-50 md:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* FLEX MAIN AREA (TAKES REMAINING WIDTH PERFECTLY) */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/10 overflow-hidden relative z-20 transition-all duration-300">
        {/* HEADER */}
        <header className="h-16 shrink-0 border-b border-border/40 bg-background/60 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 relative z-30 transition-all duration-300">
          <div className="flex items-center gap-3 md:gap-4 overflow-hidden min-w-0">
            {/* Mobile Toggle */}
            <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setIsMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>

            {/* Desktop Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex shrink-0 h-9 w-9 hover:bg-muted/80 text-muted-foreground mr-1"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block shrink-0" />

            <div className="min-w-0 flex-1 truncate py-1">
              <Breadcrumbs />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-4">
            <GlobalSearch />
            <NotificationCenter />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground bg-muted/20 hover:bg-muted/60 transition-colors"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </header>

        {/* SCROLLABLE MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full w-full max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
