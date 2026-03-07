"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, Users, ArrowRight, ShieldCheck, Zap, BarChart3, Clock, PlaneTakeoff, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const isUserLoading = status === "loading";
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isUserLoading, router]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const recipientEmail = "go.fixpert@gmail.com";
    const subject = "Message from DeltaPro Landing Page";
    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    )}`;
    window.location.href = mailtoLink;
  };

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Skeleton className="h-[400px] w-full max-w-4xl rounded-2xl" />
      </div>
    );
  }

  return (
    <main className="relative bg-background overflow-hidden selection:bg-primary/30">

      {/* Dynamic Background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0">
        <div className="absolute top-0 right-0 h-[800px] w-[800px] rounded-full bg-blue-500/10 blur-[150px] transform translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
      </div>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-16 lg:pt-20 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-5xl mx-auto space-y-8"
          >
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary backdrop-blur-md mb-2">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
              Next-Gen Rota Management is Here
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight">
              Schedule. Track. <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
                Automate.
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
              DeltaPro is the enterprise-grade scheduling engine that turns complex shift logic into seamless rotas, tracks live attendance, and simplifies leave across your entire workforce.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-10">
              <Button asChild size="lg" className="h-16 px-10 text-lg rounded-2xl shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-1">
                <Link href="/signup">
                  Start Perfect Scheduling <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-16 px-10 text-lg rounded-2xl backdrop-blur-lg bg-background/50 hover:bg-muted transition-all">
                <Link href="#features">See How It Works</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* WHAT IS DELTAPRO (FEATURES) */}
      <section id="features" className="relative py-24 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Everything You Need. <span className="text-muted-foreground">In One Place.</span></h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">From autonomous rotas to live biometric-style tracking, DeltaPro handles the heavy lifting.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <CalendarCheck className="h-8 w-8 text-primary" />,
                title: "Intelligent Auto-Rotas",
                desc: "Generate monthly schedules in seconds. Our algorithm respects fixed shifts, vacation days, and consecutive working limits automatically."
              },
              {
                icon: <Clock className="h-8 w-8 text-amber-500" />,
                title: "Live Attendance Tracking",
                desc: "Staff clock in/out with precise time logging. Supervisors instantly see who's working from the office vs working from home."
              },
              {
                icon: <Users className="h-8 w-8 text-blue-500" />,
                title: "Shift Swapping System",
                desc: "Employees can propose shift swaps directly on the dashboard. Managers review and approve them with a single click."
              },
              {
                icon: <ShieldCheck className="h-8 w-8 text-emerald-500" />,
                title: "Granular RBAC",
                desc: "Enterprise role-based access. HR sees global attendance, Team Leads manage their squads, and Staff see their own shifts."
              },
              {
                icon: <PlaneTakeoff className="h-8 w-8 text-purple-500" />,
                title: "Leave Management",
                desc: "Submit, approve, and track annual leave and sick days. Approved leaves are instantly blocked out on the global rota."
              },
              {
                icon: <BarChart3 className="h-8 w-8 text-pink-500" />,
                title: "Analytics & Export",
                desc: "Generate end-of-month CSV exports for payroll, analyze punctuality, and view exact hours worked across all your teams."
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="rounded-3xl border bg-card/40 backdrop-blur-xl p-8 hover:bg-card/80 transition-all shadow-sm hover:shadow-xl group"
              >
                <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW PREVIEW SECTION */}
      <section className="relative py-24 bg-muted/20 border-y border-border/50 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Designed for <br className="hidden md:block" /> Absolute Clarity</h2>
              <div className="space-y-6 mt-10">
                {[
                  "Visualize your entire month at a glance with color-coded matrices.",
                  "Instantly filter shifts by Team, Day, or specific Employee.",
                  "Quickly identify coverage gaps before they become operational problems."
                ].map((text, i) => (
                  <div key={i} className="flex items-start">
                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mr-4 mt-1" />
                    <p className="text-xl text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md shadow-2xl p-4 overflow-hidden"
            >
              <div className="rounded-xl border border-border/50 bg-background shadow-inner overflow-hidden flex flex-col h-[400px]">
                <div className="border-b bg-muted/30 p-4 flex items-center justify-between">
                  <div className="font-semibold">March Rota Matrix</div>
                  <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Auto-Generated</div>
                </div>
                <div className="flex-1 p-4 grid grid-cols-5 gap-2 opacity-80 pointer-events-none">
                  {/* Mock cells */}
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className={`rounded-md p-2 flex flex-col justify-between ${i === 3 || i === 8 || i === 14 ? 'bg-amber-500/10 border border-amber-500/20' : i === 5 || i === 12 ? 'bg-red-500/10 border border-red-500/20' : 'bg-primary/5 border border-primary/10'}`}>
                      <div className="h-2 w-full bg-foreground/10 rounded-full mb-2" />
                      <div className="h-2 w-2/3 bg-foreground/10 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ENGAGEMENT / CTA */}
      <section className="relative py-32 z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="container mx-auto px-4"
        >
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-8">Ready to Optimize?</h2>
          <p className="text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">Stop wasting hours on manual spreadsheets. Let DeltaPro handle the rotation so you can focus on leadership.</p>
          <Button asChild size="lg" className="h-16 px-12 text-xl rounded-full shadow-2xl shadow-primary/30 hover:-translate-y-1 transition-transform">
            <Link href="/signup">Create Your Organization</Link>
          </Button>
        </motion.div>
      </section>

      {/* CONTACT FOOTER */}
      <section id="contact" className="relative py-24 bg-card/30 border-t border-border/50 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Have Questions?</h3>
              <p className="text-muted-foreground text-lg">Send us a message and our implementation team will help you get started.</p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl border border-border/50 bg-background shadow-2xl overflow-hidden p-8 md:p-12"
            >
              <form className="space-y-8" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-base font-semibold">Full Name</Label>
                    <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} className="bg-muted/30 border-border/50 h-14 rounded-xl text-lg" required />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-base font-semibold">Business Email</Label>
                    <Input id="email" type="email" placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted/30 border-border/50 h-14 rounded-xl text-lg" required />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="message" className="text-base font-semibold">Message</Label>
                  <Textarea id="message" placeholder="Tell us about your team size and scheduling needs..." rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="bg-muted/30 border-border/50 rounded-xl resize-none text-lg p-4" required />
                </div>
                <Button type="submit" size="lg" className="w-full h-14 text-lg rounded-xl shadow-lg">
                  Send to Team
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

    </main>
  );
}
