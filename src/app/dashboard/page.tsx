"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, LayoutDashboard, Settings, ListTree, CalendarOff, LifeBuoy, Users, Clock, Briefcase, FileText, CheckSquare } from "lucide-react";

const featureCards = [
  {
    title: "Employee Directory",
    description: "Manage workforce profiles, departments, and designations.",
    href: "/employees",
    icon: <Users className="h-7 w-7 text-indigo-500" />,
  },
  {
    title: "Attendance",
    description: "Real-time clock-in/out tracking with geolocation.",
    href: "/attendance",
    icon: <Clock className="h-7 w-7 text-emerald-500" />,
  },
  {
    title: "Project Portfolio",
    description: "Track enterprise initiatives, timelines, and health.",
    href: "/projects",
    icon: <Briefcase className="h-7 w-7 text-blue-500" />,
  },
  {
    title: "Task Kanban",
    description: "Manage individual task lifecycles with drag-and-drop.",
    href: "/tasks",
    icon: <CheckSquare className="h-7 w-7 text-amber-500" />,
  },
  {
    title: "Knowledge Base",
    description: "Enterprise-wide documentation and workspaces.",
    href: "/docs",
    icon: <FileText className="h-7 w-7 text-rose-500" />,
  },
  {
    title: "Rota Management",
    description: "Automated shift scheduling and team rotations.",
    href: "/rota",
    icon: <LayoutDashboard className="h-7 w-7 text-primary" />,
  },
  {
    title: "Leave Matrix",
    description: "Employee leave planning and approval workflow.",
    href: "/leave",
    icon: <CalendarOff className="h-7 w-7 text-rose-400" />,
  },
  {
    title: "System Config",
    description: "Configure global roles, rules, and parameters.",
    href: "/admin",
    icon: <Settings className="h-7 w-7 text-slate-500" />,
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "Team Member";

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        delay: i * 0.08,
        duration: 0.4,
        ease: "easeOut",
      },
    }),
  };

  return (
    <div className="space-y-8">
      {/* Premium Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl bg-slate-gradient p-8 sm:p-10 shadow-xl border border-white/10"
      >
        <div className="absolute top-0 right-0 -m-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">{userName}</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl">
            Here's what is happening with your team's schedule today. Navigate through the modules below to manage your operations.
          </p>
        </div>
      </motion.div>

      {/* Feature Cards Grid */}
      <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {featureCards.map((card, i) => (
          <motion.div
            key={card.title}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -5 }}
            className="h-full"
          >
            <Link href={card.href} className="block h-full outline-none">
              <Card className="h-full flex flex-col group relative overflow-hidden border-border/60 hover:border-primary/50 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <CardHeader className="flex flex-row items-start justify-between pb-2 relative z-10">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                      {card.title}
                    </CardTitle>
                  </div>
                  <div className="p-2 bg-secondary/80 rounded-lg group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                    {card.icon}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 relative z-10 flex flex-col justify-between pt-2">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {card.description}
                  </p>

                  <div className="flex items-center text-sm font-semibold text-primary/80 group-hover:text-primary transition-colors mt-auto">
                    Explore module
                    <ArrowRight className="ml-1 h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
