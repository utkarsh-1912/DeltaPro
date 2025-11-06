"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, Settings, ListTree, CalendarOff, LifeBuoy, CalendarDays } from "lucide-react";

const featureCards = [
  {
    title: "Rota Management",
    description: "Generate, view, and manage your active team rotas.",
    href: "/rota",
    icon: <LayoutDashboard className="h-8 w-8 text-primary" />,
  },
  {
    title: "Config Panel",
    description: "Manage team members, shifts, and rota rules.",
    href: "/admin",
    icon: <Settings className="h-8 w-8 text-primary" />,
  },
  {
    title: "Rota Matrix",
    description: "Analyze historical assignment data for fairness.",
    href: "/matrix",
    icon: <ListTree className="h-8 w-8 text-primary" />,
  },
    {
    title: "Leave Matrix",
    description: "Schedule and track upcoming holidays and leave.",
    href: "/leave",
    icon: <CalendarOff className="h-8 w-8 text-primary" />,
  },
  {
    title: "Support Rota",
    description: "Plan and manage ad-hoc weekly support duties.",
    href: "/support",
    icon: <LifeBuoy className="h-8 w-8 text-primary" />,
  },
    {
    title: "Weekend Rota",
    description: "View and manage the automated weekend schedule.",
    href: "/weekend",
    icon: <CalendarDays className="h-8 w-8 text-primary" />,
  },
];

export default function DashboardPage() {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
      },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6"
    >
        <Card className="mb-6">
            <CardHeader>
                <CardTitle>Dashboard</CardTitle>
                <CardDescription>Navigate to different sections of your DeltaPro application.</CardDescription>
            </CardHeader>
        </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {featureCards.map((card, i) => (
          <motion.div
            key={card.title}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <Link href={card.href}>
              <Card className="h-full hover:border-primary/80 hover:shadow-lg transition-all group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
                  {card.icon}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </CardContent>
                 <div className="p-6 pt-0">
                    <div className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                        Go to section <ArrowRight className="h-4 w-4" />
                    </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
