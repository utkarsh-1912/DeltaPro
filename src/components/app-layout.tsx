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
  X,
  Plug,
  ArrowUpRight,
  CalendarRange,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal
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
import { LiveClock, SmoothScroll } from "@/components/motion";
import { Command as CommandPrimitive, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";

const SIDEBAR_WIDTH = 256;
const COLLAPSED_WIDTH = 72;

const Logo = ({ className }: { className?: string }) => (
  <svg width="22" height="22" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14 3L3 25H25L14 3Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M14 13L8.5 24H19.5L14 13Z" fill="currentColor" />
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
          className="h-9 w-56 lg:w-72 justify-start bg-card border pl-9 pr-2 text-sm font-normal text-muted-foreground hover:bg-secondary rounded-full"
          onClick={() => setOpen(true)}
        >
          Search anything
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 uppercase">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-xl rounded-2xl bg-background/95 backdrop-blur-xl mt-[10vh]">
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
              <div className="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-medium font-mono tracking-wider uppercase opacity-40 select-none">Esc</div>
            </div>

            <CommandList className="max-h-[450px] overflow-y-auto overflow-x-hidden p-2 scrollbar-hide">
              <CommandEmpty className="py-20 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center">
                    <SearchIcon className="h-8 w-8 opacity-20" />
                  </div>
                  <p className="text-sm font-medium font-mono uppercase tracking-wider text-muted-foreground opacity-40">No records found</p>
                </div>
              </CommandEmpty>

              {Object.entries(groupedResults).map(([category, items]: [string, any]) => (
                <CommandGroup
                  key={category}
                  heading={category}
                  className="px-3 pt-6 pb-2 text-[10px] font-medium font-mono uppercase tracking-wider text-primary/40 first:pt-2"
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
                      <span className="text-[9px] font-medium font-mono uppercase tracking-wider opacity-40">Navigate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-1.5 py-0.5 rounded bg-muted-foreground/10 text-[9px] font-bold">Enter</kbd>
                      <span className="text-[9px] font-medium font-mono uppercase tracking-wider opacity-40">Open</span>
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
      <PopoverContent align="end" className="w-[380px] p-0 rounded-xl shadow-xl border-border/40 overflow-hidden bg-background/80 backdrop-blur-xl z-50">
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

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
      <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">DeltaPro</Link>
      {paths.map((path, i) => (
        <React.Fragment key={path}>
          <span className="text-muted-foreground/40">/</span>
          <span className={cn("shrink-0", i === paths.length - 1 ? "text-foreground" : "text-muted-foreground")}>
            {path.replace(/-/g, ' ')}
          </span>
        </React.Fragment>
      ))}
    </nav>
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
        <Button variant="ghost" className={cn("relative h-12 w-full justify-start gap-3 px-2 hover:bg-secondary transition-all rounded-full shrink-0 overflow-hidden", isCollapsed && "justify-center px-0")}>
          <Avatar className="h-8 w-8 border-2 border-background shadow-sm shrink-0">
            <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-start truncate overflow-hidden">
              <p className="text-sm font-bold truncate leading-none mb-1">{user?.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground truncate uppercase tracking-[0.12em] inline-flex items-center">
                {user?.role || "Team Member"}
              </p>
            </motion.div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-64 p-2 rounded-xl shadow-xl border-border/40 backdrop-blur-xl z-50 mb-2">
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
        {["ADMIN", "HR", "PM"].includes(user?.role ?? "") && (
          <DropdownMenuItem onClick={() => router.push('/admin')} className="py-2.5 rounded-lg cursor-pointer">
            <SlidersHorizontal className="mr-3 h-4 w-4 text-muted-foreground" />
            Admin console
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-muted/50" />
        <DropdownMenuItem onClick={handleLogout} className="py-2.5 rounded-lg focus:bg-rose-50 hover:text-rose-600 focus:text-rose-600 cursor-pointer text-rose-500 font-bold transition-colors">
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NavEntry = { href: string; icon: any; label: string; roles?: string[]; exact?: boolean };
type NavGroup = { title: string; items: NavEntry[] };

const MANAGERS = ["ADMIN", "HR", "PM"];

const NAV: NavGroup[] = [
  { title: "Overview", items: [{ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true }] },
  {
    title: "People",
    items: [
      { href: "/employees", icon: Users, label: "Directory" },
      { href: "/attendance", icon: Clock, label: "Attendance" },
      { href: "/leave", icon: CalendarOff, label: "Leave" },
    ],
  },
  {
    title: "Scheduling",
    items: [
      { href: "/rota", icon: GanttChartSquare, label: "Shift rota" },
      { href: "/weekend", icon: CalendarRange, label: "Weekend cover" },
      { href: "/matrix", icon: ListTree, label: "Rota matrix" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/projects", icon: Briefcase, label: "Projects" },
      { href: "/tasks", icon: CheckSquare, label: "Tasks" },
      { href: "/docs", icon: FileText, label: "Knowledge" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/admin", icon: SlidersHorizontal, label: "Admin console", roles: MANAGERS },
      { href: "/integrations", icon: Plug, label: "Integrations", roles: ["ADMIN", "HR"] },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const PUBLIC_PAGES = ["/", "/about", "/contact", "/privacy", "/terms", "/login", "/signup", "/forgot-password", "/reset-password"];

function NavItem({ item, isActive, isCollapsed }: { item: NavEntry; isActive: boolean; isCollapsed: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group relative flex h-9 items-center rounded-full px-3 text-[13.5px] font-medium transition-colors select-none whitespace-nowrap",
          isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          isCollapsed && "justify-center px-0"
        )}
        title={isCollapsed ? item.label : undefined}
      >
        {isActive && (
          <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 36 }} className="absolute inset-0 rounded-full bg-primary" />
        )}
        {!isActive && <span className="absolute inset-0 rounded-full transition-colors group-hover:bg-secondary" />}
        <Icon className="relative h-[17px] w-[17px] shrink-0" />
        {!isCollapsed && <span className="relative ml-3 truncate">{item.label}</span>}
      </Link>
    </li>
  );
}

/** Thin bar that runs across the top while a route is changing. */
function RouteProgress() {
  const pathname = usePathname();
  const [key, setKey] = React.useState(0);
  React.useEffect(() => setKey((k) => k + 1), [pathname]);
  return (
    <motion.div
      key={key}
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-signal"
      initial={{ scaleX: 0, opacity: 1 }}
      animate={{ scaleX: 1, opacity: 0 }}
      transition={{ scaleX: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }, opacity: { delay: 0.55, duration: 0.3 } }}
    />
  );
}

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      className="relative h-9 w-9 rounded-full text-muted-foreground hover:bg-secondary"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

function PublicShell({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const authPage = ["/login", "/signup", "/forgot-password", "/reset-password"].includes(pathname);
  if (authPage) return <main className="min-h-screen bg-background text-foreground">{children}</main>;

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="fixed inset-x-0 top-0 z-50">
          {/* Utility bar (Reminous) */}
          <div className={cn("border-b bg-background/80 backdrop-blur-xl transition-all duration-500", scrolled ? "h-0 overflow-hidden border-transparent opacity-0" : "h-9 opacity-100")}>
            <div className="container mx-auto flex h-9 items-center justify-between px-5 sm:px-8">
              <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Onboarding new organisations this quarter
              </p>
              <div className="hidden items-center gap-6 font-mono text-[11px] text-muted-foreground sm:flex">
                <Link href="/about" className="hover:text-foreground">Company</Link>
                <Link href="/#integrations" className="hover:text-foreground">Integrations</Link>
                <Link href="/contact" className="hover:text-foreground">Contact</Link>
              </div>
            </div>
          </div>
          <div className={cn("transition-all duration-500", scrolled ? "pt-3" : "pt-0")}>
            <div
              className={cn(
                "container mx-auto flex h-16 items-center justify-between px-5 transition-all duration-500 sm:px-8",
                scrolled ? "h-14 max-w-5xl rounded-full border bg-background/80 px-3 shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.25)] backdrop-blur-xl sm:px-3" : "bg-background/0"
              )}
            >
              <Link href="/" className="flex items-center gap-2.5 pl-1 group">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground transition-transform duration-500 group-hover:rotate-[120deg]">
                  <Logo />
                </span>
                <span className="font-display text-lg font-bold tracking-tight">DeltaPro</span>
              </Link>
              <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
                {[["Platform", "/#platform"], ["Workflows", "/#workflows"], ["Integrations", "/#integrations"], ["Company", "/about"]].map(([l, h]) => (
                  <Link key={l} href={h} className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">{l}</Link>
                ))}
              </nav>
              <div className="flex items-center gap-1.5">
                <ThemeToggle />
                <Button asChild variant="ghost" size="sm" className="hidden rounded-full sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="h-10 rounded-full px-5">
                  <Link href="/signup">Get in touch <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </header>
        <main className={cn("relative flex-1", pathname !== "/" && "pt-32")}>{children}</main>
        <footer className="bg-night relative overflow-hidden">
          <div className="container mx-auto px-5 pt-20 sm:px-8">
            <div className="grid gap-10 border-b border-white/10 pb-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div>
                <p className="font-display text-2xl font-bold">Run your people, not your spreadsheets.</p>
                <p className="mt-3 max-w-sm text-sm text-white/55">Attendance, leave, rotas, projects and people, with the integrations HR already depends on.</p>
              </div>
              {[
                ["Platform", [["Attendance", "/#platform"], ["Leave", "/#platform"], ["Rotas", "/#platform"], ["Integrations", "/#integrations"]]],
                ["Company", [["About", "/about"], ["Contact", "/contact"], ["Sign in", "/login"]]],
                ["Legal", [["Privacy", "/privacy"], ["Terms", "/terms"]]],
              ].map(([title, links]) => (
                <div key={title as string}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">{title as string}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {(links as string[][]).map(([l, h]) => (
                      <li key={l}><Link href={h} className="text-white/70 transition-colors hover:text-white">{l}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 py-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
              <span>&copy; {new Date().getFullYear()} DeltaLabs by Utkristi.io</span>
              <LiveClock label="Mumbai" timeZone="Asia/Kolkata" />
            </div>
          </div>
          <p aria-hidden className="wordmark select-none whitespace-nowrap px-3 pb-2 text-center text-[clamp(5rem,24vw,24rem)] text-white/[0.07]">DeltaPro</p>
        </footer>
      </div>
    </SmoothScroll>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, data: session } = useSession();
  const role = session?.user?.role ?? "USER";

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("deltapro.sidebar");
      if (saved) setIsSidebarOpen(saved === "open");
    } catch { }
  }, []);
  const toggleSidebar = () => {
    setIsSidebarOpen((v) => {
      try { localStorage.setItem("deltapro.sidebar", v ? "closed" : "open"); } catch { }
      return !v;
    });
  };

  React.useEffect(() => setIsMobileOpen(false), [pathname]);

  if (status === "unauthenticated" || PUBLIC_PAGES.includes(pathname)) {
    return <PublicShell pathname={pathname}>{children}</PublicShell>;
  }

  const collapsed = !isSidebarOpen && !isMobileOpen;
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((g) => g.items.length);
  const isActive = (item: NavEntry) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));
  const currentWidth = isSidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_WIDTH;

  const sidebarContent = (
    <div className="relative flex h-full flex-col bg-sidebar">
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-primary text-primary-foreground">
            <Logo />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span className="font-display text-[17px] font-bold tracking-tight">DeltaPro</span>
              <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">People operations</span>
            </span>
          )}
        </Link>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto overflow-x-hidden">
        <nav className={cn("space-y-6 px-3 py-5", collapsed && "px-2")} aria-label="Application">
          {groups.map((g) => (
            <div key={g.title}>
              {collapsed ? <div className="mx-auto mb-2 h-px w-6 bg-border" /> : <p className="eyebrow mb-2 px-3 text-[10px]">{g.title}</p>}
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <NavItem key={item.href} item={item} isActive={isActive(item)} isCollapsed={collapsed} />
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="shrink-0 space-y-2 border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn("hidden h-8 w-full justify-start gap-2 rounded-full px-3 text-xs text-muted-foreground md:flex", collapsed && "justify-center px-0")}
        >
          {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </Button>
        <UserProfileWidget isCollapsed={collapsed} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen max-w-[100vw] overflow-hidden bg-background font-body text-foreground">
      <RouteProgress />

      <aside
        className="z-30 hidden shrink-0 border-r transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] md:block"
        style={{ width: `${currentWidth}px` }}
      >
        {sidebarContent}
      </aside>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed bottom-0 left-0 top-0 z-50 w-72 border-r shadow-2xl md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-20 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-background/75 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Open navigation" onClick={() => setIsMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 truncate">
              <Breadcrumbs />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <GlobalSearch />
            <LiveClock className="hidden rounded-full border px-3 py-1.5 text-muted-foreground xl:inline-flex" />
            <NotificationCenter />
            <ThemeToggle />
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto overflow-x-hidden" data-lenis-prevent>
          <div aria-hidden className="dotgrid pointer-events-none absolute inset-x-0 top-0 h-72 opacity-50 [mask-image:linear-gradient(#000,transparent)]" />
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
