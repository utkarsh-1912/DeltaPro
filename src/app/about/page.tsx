"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Rocket, Shield, Target, Zap } from "lucide-react";

const features = [
  {
    title: "Intelligent Rota Generation",
    description: "Leverage our smart algorithm to automatically generate fair and balanced schedules that prevent burnout.",
    icon: Rocket,
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    title: "Centralized Configuration",
    description: "Manage every aspect of your schedule from a single panel. Define custom shifts and team rules easily.",
    icon: Target,
    color: "text-purple-500",
    bg: "bg-purple-500/10"
  },
  {
    title: "Flexible Scheduling",
    description: "Adapt to changing needs with tools for ad-hoc support, weekend rotas, and long-term fairness analysis.",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10"
  },
  {
    title: "Enterprise Security",
    description: "Your data is protected with industry-standard security protocols and role-based access controls.",
    icon: Shield,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  }
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <Link href="/" className="group inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-12">
            <div className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back to Home
          </Link>

          <div className="space-y-4 mb-20">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl md:text-6xl font-black tracking-tighter"
            >
              Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Workforce.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-muted-foreground leading-relaxed max-w-2xl font-medium"
            >
              DeltaPro by <Link href="https://utkristi-io.netlify.app" className="text-primary hover:underline font-black">Utkristi.io</Link> is your intelligent partner for seamless team scheduling, transforming complexity into clarity.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.5 }}
              >
                <Card className="border-none shadow-2xl bg-background/50 backdrop-blur-xl hover:bg-muted/30 transition-all group overflow-hidden h-full">
                  <CardContent className="p-8">
                    <div className={`h-14 w-14 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      <feature.icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-black mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-12 py-12 border-t border-border/40"
          >
            <div className="space-y-4">
              <h3 className="text-2xl font-black flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary" /> Our Vision
              </h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                We envision a world where scheduling is no longer a chore but a strategic tool that boosts operational efficiency and employee morale. By automating the tedious aspects, DeltaPro gives you back your most valuable asset: time.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-purple-500" /> Our Mission
              </h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                To empower managers with cutting-edge tools that ensure fairness, efficiency, and clarity, allowing teams to focus on innovation and growth without the burden of administrative overhead.
              </p>
            </div>
          </motion.div>

          <footer className="mt-20 py-8 text-center border-t border-border/40">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40">
              Generated with Precision by Delta Labs
            </p>
          </footer>
        </motion.div>
      </div>
    </div>
  );
}

