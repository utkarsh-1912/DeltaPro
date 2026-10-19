"use client";

import { useState, useRef, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowUpRight, BarChart3, CalendarCheck, Check, Clock, Fingerprint, MapPin, PlaneTakeoff, ShieldCheck, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import {
  Reveal, SplitHeading, ScrubText, ScrollProgress, Counter, Marquee, Magnetic, LiveClock, ScrubTint, ScrollWordmark, EASE,
} from "@/components/motion";

const img = (id: string, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;
const PHOTOS = {
  office: img("photo-1497366216548-37526070297c"),
  team: img("photo-1522071820081-009f0129c71c"),
  meeting: img("photo-1521737604893-d14cc237f11d"),
  tower: img("photo-1486406146926-c627a92ad1ab"),
  desk: img("photo-1497366811353-6870744d04b2"),
  work: img("photo-1504384308090-c894fdcc538d"),
};

const STEPS = [
  { icon: Clock, tag: "01 / Attendance", title: "Clock in with proof, not trust.", body: "The server checks every office clock-in against the geofence and GPS accuracy. Sessions close themselves when someone leaves the radius or forgets to clock out.", metric: "500 m", metricLabel: "default office radius" },
  { icon: PlaneTakeoff, tag: "02 / Leave", title: "Time off that plans itself.", body: "Weekdays counted for you, overlaps blocked, balances reserved while pending. Approval deducts the balance atomically; cancelling refunds it.", metric: "4", metricLabel: "leave types out of the box" },
  { icon: CalendarCheck, tag: "03 / Rota", title: "Fair rotas in one click.", body: "A generator that respects fixed shifts, extreme-shift limits, team sizes and approved leave, then publishes shifts to Google or Outlook calendars.", metric: "1–4 wk", metricLabel: "rota periods" },
  { icon: ShieldCheck, tag: "04 / Control", title: "Role-based by design.", body: "Admins, HR, project managers, developers and staff each see what they should. Managers approve only their own reports, and every decision is audited.", metric: "5", metricLabel: "access roles" },
];

const CONNECTORS = [
  ["Slack", "Messaging", "In · Out"], ["Microsoft Teams", "Messaging", "Out"], ["Email", "Messaging", "Out"],
  ["Google Calendar", "Calendar", "Out"], ["Outlook", "Calendar", "Out"], ["Zoho People", "HR", "In · Out"],
  ["BambooHR", "HR", "In"], ["Any HRIS", "HR", "In · Out"], ["Jira Cloud", "Dev tools", "In · Out"],
  ["GitHub", "Dev tools", "In"], ["Badge devices", "Devices", "In"], ["SCIM", "Identity", "In"], ["Webhooks", "Platform", "Out"],
];

const CAPS = [
  { i: Fingerprint, t: "Geofenced attendance", d: "Office and WFH clock-ins, GPS accuracy limits, automatic clock-out and manager-approved corrections." },
  { i: Users, t: "People directory", d: "Profiles, reporting lines, departments and SSO, provisioned from your HR system or identity provider." },
  { i: CalendarCheck, t: "Smart rotas", d: "Shift rotation, weekend cover and swaps that stay fair over months." },
  { i: PlaneTakeoff, t: "Leave and approvals", d: "Balances, half days, approvals from Slack, and out-of-office on the calendar." },
  { i: BarChart3, t: "Payroll export", d: "Monthly CSV with days present, hours, paid and unpaid leave and loss-of-pay days." },
  { i: MapPin, t: "Projects and knowledge", d: "Kanban tasks synced with Jira and GitHub, plus team workspaces for documentation." },
];

const SCENE_LINES = ["Someone is clocking in.", "A manager is approving leave.", "Payroll is closing.", "One platform keeps all three in sync."];

function UiCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-4 shadow-[0_18px_50px_-24px_hsl(var(--primary)/0.35)] ${className ?? ""}`}>{children}</div>;
}

function Photo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-cover grayscale contrast-[1.05] ${className ?? ""}`} />;
}

function PresenceBoard() {
  const rows = ["Engineering", "Support L1", "Support L2", "Operations", "Finance"];
  return (
    <div className="relative grid h-full grid-rows-[auto_1fr] text-[hsl(220_38%_92%)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">
        <span>deltapro / presence</span>
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />live</span>
      </div>
      <div className="relative grid gap-5 p-5 sm:p-8 md:grid-cols-[1fr_1.6fr]">
        <div className="grid grid-cols-2 gap-3 content-start">
          {[["Present", "142"], ["On leave", "11"], ["WFH", "38"], ["Approvals", "6"]].map(([l, v], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: EASE }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">{l}</p>
              <p className="wordmark mt-3 text-5xl">{v}</p>
            </motion.div>
          ))}
        </div>
        <div className="space-y-2.5">
          {rows.map((r, ri) => (
            <div key={r} className="grid grid-cols-[110px_1fr] items-center gap-3">
              <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/50">{r}</span>
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0,1fr))" }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <motion.span key={i}
                    initial={{ opacity: 0, scaleY: 0.3 }} whileInView={{ opacity: 1, scaleY: 1 }} viewport={{ once: true }}
                    transition={{ delay: 0.3 + ri * 0.07 + i * 0.025, duration: 0.5, ease: EASE }}
                    className={["h-6 rounded-[4px]", (i + ri) % 6 === 2 ? "bg-[hsl(221_92%_66%)]" : (i * ri) % 9 === 4 ? "bg-white/25" : i % 7 >= 5 ? "bg-white/[0.04]" : "bg-white/[0.12]"].join(" ")} />
                ))}
              </div>
            </div>
          ))}
          <div className="relative mt-4 h-px overflow-hidden bg-white/10"><span className="animate-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[hsl(221_92%_66%)] to-transparent" /></div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const isUserLoading = status === "loading";
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(0);
  const [line, setLine] = useState(0);

  const heroRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLElement>(null);

  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const panelScale = useTransform(heroProgress, [0, 0.6], [1, 0.94]);
  const panelRadius = useTransform(heroProgress, [0, 0.6], [24, 40]);

  const { scrollYProgress: sceneProgress } = useScroll({ target: sceneRef, offset: ["start start", "end end"] });
  const colFast = useTransform(sceneProgress, [0, 1], ["10%", "-55%"]);
  const colSlow = useTransform(sceneProgress, [0, 1], ["30%", "-25%"]);
  useMotionValueEvent(sceneProgress, "change", (v) => setLine(Math.min(SCENE_LINES.length - 1, Math.floor(v * SCENE_LINES.length * 0.999))));

  const { scrollYProgress: stepProgress } = useScroll({ target: stepsRef, offset: ["start start", "end end"] });
  useMotionValueEvent(stepProgress, "change", (v) => setStep(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)))));

  useEffect(() => {
    if (!isUserLoading && user) router.push("/dashboard");
  }, [user, isUserLoading, router]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = "Message from DeltaPro Landing Page";
    window.location.href = `mailto:go.fixpert@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
  };

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Skeleton className="h-[400px] w-full max-w-4xl rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="relative overflow-x-clip">
      <ScrollProgress />

      {/* HERO: headline + dark media panel (Reminous), meta row with clock (Eddy) */}
      <section ref={heroRef} className="relative pt-36 sm:pt-44">
        <div className="dotgrid absolute inset-x-0 top-0 h-[70vh] opacity-60 [mask-image:linear-gradient(#000,transparent)]" />
        <div className="container relative mx-auto px-5 sm:px-8">
          <Reveal>
            <p className="eyebrow flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-signal" /> HR · Attendance · Rotas · Integrations</p>
          </Reveal>
          <SplitHeading tag="h1" text="People operations, without the patchwork." delay={0.1}
            className="mt-6 max-w-5xl font-display text-[clamp(2.6rem,6.6vw,5.75rem)] font-bold leading-[0.98] tracking-[-0.03em]" />
          <Reveal delay={0.45} className="mt-6 max-w-3xl">
            <p className="text-[clamp(1.15rem,2.1vw,1.6rem)] leading-snug text-muted-foreground">
              Attendance, leave, shift rotas and people in one auditable platform, <span className="text-foreground">wired into the chat, calendar and HR tools your teams already use.</span>
            </p>
          </Reveal>
          <Reveal delay={0.6} className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Button asChild size="lg" className="h-14 rounded-full px-8 text-base">
                <Link href="/signup">Start your workspace <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </Magnetic>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full bg-card px-7 text-base">
              <Link href="/#workflows">See how it runs</Link>
            </Button>
          </Reveal>
        </div>

        <motion.div style={{ scale: panelScale }} className="relative mx-auto mt-16 max-w-[1400px] origin-top px-3 sm:px-6">
          <motion.div style={{ borderRadius: panelRadius }} className="bg-ink grain relative overflow-hidden shadow-[0_60px_140px_-40px_hsl(222_57%_13%/0.55)]">
            <div className="aspect-[16/10] sm:aspect-[16/8]">
              <PresenceBoard />
            </div>
            <div className="absolute bottom-0 inset-x-0 flex flex-wrap items-end justify-between gap-4 p-5 sm:p-8">
              <div className="flex max-w-xs items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-2.5 pr-4 backdrop-blur-md">
                <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md"><Photo src={PHOTOS.desk} alt="" /></span>
                <span className="text-xs leading-snug text-white/80">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Latest release</span>
                  Zoho People, SCIM and Slack approvals, October 2026
                </span>
              </div>
              <LiveClock label="Mumbai" timeZone="Asia/Kolkata" className="text-white/60" />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* WORDMARK (Eddy) */}
      <section className="py-16 sm:py-24">
        <ScrollWordmark left="Delta" right="Pro" chip={<Photo src={PHOTOS.office} alt="" />} />
      </section>

      {/* MANIFESTO */}
      <section className="bg-night grain relative">
        <div className="container mx-auto px-5 py-36 sm:px-8">
          <p className="mb-10 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Why DeltaPro</p>
          <ScrubText
            className="max-w-5xl font-display text-[clamp(1.75rem,4.4vw,4rem)] font-semibold leading-[1.08] tracking-[-0.02em]"
            text="Spreadsheets drift. Shifts clash. Leave gets lost in chat. DeltaPro replaces the patchwork with one source of truth, so every manager knows who is working, where, and why."
          />
        </div>
      </section>

      {/* STICKY SCENE (Reminous): two columns of product moments drift at different speeds */}
      <section id="workflows" ref={sceneRef} className="relative" style={{ height: "320vh" }}>
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <div className="container relative mx-auto grid h-full grid-cols-[1fr] items-center px-5 sm:px-8 md:grid-cols-[1fr_1.1fr_1fr] md:gap-10">
            <motion.div style={{ y: colFast }} className="hidden flex-col gap-5 md:flex">
              <UiCard>
                <p className="eyebrow">Attendance · 09:02</p>
                <p className="mt-2 font-medium">Asha Rao clocked in at the office</p>
                <p className="mt-1 text-sm text-muted-foreground">42 m from office · GPS ±9 m</p>
                <span className="pill mt-3 border-success/30 bg-success/10 text-success">Inside geofence</span>
              </UiCard>
              <div className="h-56 overflow-hidden rounded-2xl"><Photo src={PHOTOS.work} alt="People working at desks" /></div>
              <UiCard>
                <p className="eyebrow">Slack · #team-leave</p>
                <p className="mt-2 font-medium">Leave request from Dev Mehta</p>
                <p className="mt-1 text-sm text-muted-foreground">Casual leave, Thu 23 – Fri 24 Oct (2 days)</p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">Approve</span>
                  <span className="rounded-full border px-3 py-1 text-xs">Reject</span>
                </div>
              </UiCard>
              <div className="h-48 overflow-hidden rounded-2xl"><Photo src={PHOTOS.tower} alt="Office tower" /></div>
            </motion.div>

            <div className="relative z-10 text-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={line}
                  initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
                  transition={{ duration: 0.55, ease: EASE }}
                  className={`font-display text-[clamp(2.4rem,5.4vw,4.75rem)] font-bold leading-[0.98] tracking-[-0.03em] ${line === SCENE_LINES.length - 1 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {SCENE_LINES[line]}
                </motion.p>
              </AnimatePresence>
              <div className="mx-auto mt-8 flex w-40 gap-1.5">
                {SCENE_LINES.map((_, i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= line ? "bg-primary" : "bg-border"}`} />
                ))}
              </div>
            </div>

            <motion.div style={{ y: colSlow }} className="hidden flex-col gap-5 md:flex">
              <div className="h-60 overflow-hidden rounded-2xl"><Photo src={PHOTOS.meeting} alt="Team meeting" /></div>
              <UiCard>
                <p className="eyebrow">Google Calendar</p>
                <p className="mt-2 font-medium">Dev Mehta: Casual leave</p>
                <p className="mt-1 text-sm text-muted-foreground">Out of office · 23 – 24 Oct</p>
              </UiCard>
              <UiCard>
                <p className="eyebrow">Rota published</p>
                <div className="mt-3 space-y-2 text-sm">
                  {[["Morning", "06:00–14:00", "bg-chart-3"], ["Evening", "14:00–22:00", "bg-chart-2"], ["Night", "22:00–06:00", "bg-chart-1"]].map(([n, t, c]) => (
                    <div key={n} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${c}`} />{n}</span><span className="mono-num text-muted-foreground">{t}</span></div>
                  ))}
                </div>
              </UiCard>
              <UiCard>
                <p className="eyebrow">Payroll · Oct 2026</p>
                <p className="mt-2 font-medium">CSV ready for 186 employees</p>
                <p className="mt-1 text-sm text-muted-foreground">Present days, hours, paid and unpaid leave, LOP</p>
              </UiCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PINNED STEPS */}
      <section id="platform" ref={stepsRef} className="relative border-t" style={{ height: `${STEPS.length * 85}vh` }}>
        <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
          <div className="container relative mx-auto grid items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="eyebrow">The platform</p>
              <ol className="mt-8 space-y-1">
                {STEPS.map((st, i) => (
                  <li key={st.tag} className={`flex items-center gap-4 py-1.5 transition-all duration-500 ${i === step ? "opacity-100" : "opacity-25"}`}>
                    <span className="w-8 font-mono text-xs text-muted-foreground">0{i + 1}</span>
                    <span className="wordmark text-5xl sm:text-7xl">{st.tag.split("/ ")[1]}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="surface relative min-h-[380px] rounded-3xl p-8 shadow-xl sm:p-12">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, y: 24, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: EASE }}>
                  {(() => { const Icon = STEPS[step].icon; return <Icon className="h-6 w-6 text-signal" />; })()}
                  <h3 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-4xl">{STEPS[step].title}</h3>
                  <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{STEPS[step].body}</p>
                  <div className="mt-10 border-t pt-6">
                    <p className="wordmark text-6xl">{STEPS[step].metric}</p>
                    <p className="eyebrow mt-2">{STEPS[step].metricLabel}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-b-3xl bg-border">
                <motion.div style={{ scaleX: stepProgress }} className="h-full origin-left bg-signal" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" className="border-t">
        <div className="container mx-auto px-5 py-28 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">Integrations</p>
              <ScrubTint lead="Connected where work happens:" text="approvals in Slack, leave on the calendar, employees from your HR system, tasks with Jira and GitHub."
                className="mt-6 font-display text-[clamp(1.8rem,3.4vw,2.9rem)] font-bold leading-[1.05] tracking-[-0.02em]" />
              <p className="mt-6 max-w-md text-muted-foreground">Every change is queued in the same transaction, delivered with retries and visible in a delivery log, so a slow vendor never blocks an approval.</p>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-3">
              {CONNECTORS.map(([n, c, d], i) => (
                <Reveal key={n} delay={(i % 3) * 0.05} y={14} className="group bg-card p-5 transition-colors hover:bg-secondary">
                  <p className="font-display text-lg font-bold">{n}</p>
                  <div className="mt-6 flex items-center justify-between gap-2">
                    <span className="eyebrow text-[10px]">{c}</span>
                    <span className="pill text-[9.5px] text-muted-foreground">{d}</span>
                  </div>
                </Reveal>
              ))}
              <div className="col-span-2 flex items-end bg-card p-5 sm:col-span-2">
                <Link href="/signup" className="group inline-flex items-center gap-1 text-sm font-medium">Connect yours <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
              </div>
            </div>
          </div>
        </div>
        <div className="border-y py-5">
          <Marquee className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {CONNECTORS.map(([n]) => (
              <span key={n} className="flex items-center gap-14">{n}<span className="h-1 w-1 rounded-full bg-signal" /></span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* SECTION WORDMARK */}
      <section className="py-20 sm:py-28">
        <ScrollWordmark left="People" right="Ops" chip={<Photo src={PHOTOS.team} alt="" />} drift={160} />
      </section>

      {/* CAPABILITIES */}
      <section className="container mx-auto px-5 pb-28 sm:px-8">
        <SplitHeading text="Everything HR needs. Nothing it doesn't." className="max-w-3xl font-display text-4xl font-bold leading-[1] sm:text-6xl" />
        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((f, idx) => (
            <Reveal key={f.t} delay={(idx % 3) * 0.08} y={20} className="group relative bg-card p-8 transition-colors hover:bg-secondary">
              <f.i className="h-6 w-6 text-signal transition-transform duration-500 group-hover:-translate-y-1" />
              <h3 className="mt-10 font-display text-xl font-bold">{f.t}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{f.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FACTS */}
      <section className="border-y">
        <div className="container mx-auto grid gap-10 px-5 py-20 sm:grid-cols-3 sm:px-8">
          {([[13, "", "integrations built in"], [19, "", "events you can subscribe to"], [5, "", "access roles, manager-scoped"]] as const).map(([n, suffix, label]) => (
            <Reveal key={label}>
              <p className="wordmark text-[clamp(5rem,10vw,9rem)]"><Counter to={n} suffix={suffix} /></p>
              <p className="eyebrow mt-3">{label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink grain relative overflow-hidden">
        <div className="animate-drift absolute -right-40 top-1/2 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-[hsl(221_92%_60%/0.25)] blur-[140px]" />
        <div className="container relative mx-auto px-5 py-36 text-center sm:px-8">
          <SplitHeading text="Run your people, not your spreadsheets." className="mx-auto max-w-4xl font-display text-5xl font-bold leading-[0.98] sm:text-7xl" />
          <Reveal delay={0.3} className="mt-12">
            <Magnetic>
              <Button asChild size="lg" className="h-14 rounded-full bg-white px-10 text-base text-[hsl(222_57%_13%)] hover:bg-white/90">
                <Link href="/signup">Create your organisation</Link>
              </Button>
            </Magnetic>
          </Reveal>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="container mx-auto grid gap-14 px-5 py-28 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <p className="eyebrow">Contact</p>
          <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">Talk to our implementation team.</h2>
          <ul className="mt-8 space-y-3 text-muted-foreground">
            {["Onboarding in days, not months", "Import people from Zoho, BambooHR or CSV", "SSO with Google or Microsoft"].map((t) => (
              <li key={t} className="flex items-center gap-3"><Check className="h-4 w-4 text-signal" />{t}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <form className="surface space-y-6 rounded-3xl p-8 shadow-sm sm:p-10" onSubmit={handleSubmit}>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Business email</Label>
                <Input id="email" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" placeholder="Team size, shifts, the tools you use today…" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="resize-none rounded-xl" required />
            </div>
            <Button type="submit" size="lg" className="h-12 w-full rounded-full">Send message</Button>
          </form>
        </Reveal>
      </section>
    </div>
  );
}
