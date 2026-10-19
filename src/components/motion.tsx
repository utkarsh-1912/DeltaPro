"use client";

import * as React from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  animate,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + rise when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as: _as,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: never;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Masked per-word headline reveal that plays on enter. */
export function SplitHeading({
  text,
  className,
  delay = 0,
  tag: Tag = "h2",
}: {
  text: string;
  className?: string;
  delay?: number;
  tag?: "h1" | "h2" | "h3";
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const words = text.split(" ");
  return (
    <Tag ref={ref as any} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]" aria-hidden>
          <motion.span
            className="inline-block will-change-transform"
            initial={reduce ? false : { y: "110%" }}
            animate={inView ? { y: 0 } : undefined}
            transition={{ duration: 0.9, delay: delay + i * 0.06, ease: EASE }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Paragraph whose words light up as the section scrolls through (Eddy-style scrub). */
export function ScrubText({ text, className }: { text: string; className?: string }) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.4"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={cn("flex flex-wrap", className)}>
      {words.map((w, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        return <ScrubWord key={i} progress={scrollYProgress} range={[start, end]}>{w}</ScrubWord>;
      })}
    </p>
  );
}

function ScrubWord({
  children,
  progress,
  range,
}: {
  children: React.ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return (
    <motion.span style={{ opacity }} className="mr-[0.28em] inline-block">
      {children}
    </motion.span>
  );
}

/** Thin reading-progress bar pinned to the top of the viewport. */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });
  return (
    <motion.div
      style={{ scaleX }}
      className={cn("fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-signal", className)}
    />
  );
}

/** Number that counts up when visible. */
export function Counter({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  React.useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    if (reduce) {
      el.textContent = `${prefix}${to.toFixed(decimals)}${suffix}`;
      return;
    }
    const c = animate(0, to, {
      duration: 1.8,
      ease: EASE,
      onUpdate: (v) => (el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`),
    });
    return () => c.stop();
  }, [inView, to, prefix, suffix, decimals, reduce]);
  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}

/** Infinite horizontal ticker. */
export function Marquee({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]", className)}>
      <div className="animate-marquee flex w-max items-center gap-14 whitespace-nowrap">
        {children}
        {children}
      </div>
    </div>
  );
}

/** Element drifts toward the cursor. */
export function Magnetic({ children, strength = 0.25 }: { children: React.ReactNode; strength?: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 16 });
  const sy = useSpring(y, { stiffness: 200, damping: 16 });
  return (
    <motion.div
      style={{ x: sx, y: sy }}
      className="inline-block"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Wrapper that moves its child at a different speed than the scroll. */
export function Parallax({
  children,
  speed = 60,
  className,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Halftone dot blob that follows the pointer inside its parent, Reminous-style. */
export function HalftoneField({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current?.parentElement;
    const node = ref.current;
    if (!el || !node) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      node.style.setProperty("--hx", `${((e.clientX - r.left) / r.width) * 100}%`);
      node.style.setProperty("--hy", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, []);
  return <div ref={ref} aria-hidden className={cn("halftone pointer-events-none absolute inset-0 opacity-70 transition-[mask-position]", className)} />;
}

/** Lenis smooth scrolling on window (marketing pages). Respects reduced motion. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  React.useEffect(() => {
    if (reduce) return;
    let lenis: any;
    let frame = 0;
    let cancelled = false;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a");
      const href = a?.getAttribute("href");
      if (!lenis || !href || !/^\/?#/.test(href) || (href.startsWith("/") && location.pathname !== "/")) return;
      const target = document.querySelector(href.replace(/^\//, ""));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    };
    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ duration: 1.15, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      const raf = (time: number) => {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    });
    document.addEventListener("click", onClick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      lenis?.destroy();
    };
  }, [reduce]);
  return <>{children}</>;
}

/** Ticking clock in mono type, e.g. "Mumbai 09:41:07" (Eddy-style meta line). */
export function LiveClock({ label, timeZone, className }: { label?: string; timeZone?: string; className?: string }) {
  const [now, setNow] = React.useState<string>("");
  React.useEffect(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone });
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeZone]);
  return (
    <span className={cn("font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums", className)}>
      {label && <span className="mr-2 opacity-60">{label}</span>}
      {now || "--:--:--"}
    </span>
  );
}

/** Headline whose words fill from muted to ink as it scrolls past (Reminous-style). `lead` stays solid. */
export function ScrubTint({ lead, text, className }: { lead?: string; text: string; className?: string }) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.45"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      {lead && <span>{lead} </span>}
      {words.map((w, i) => (
        <TintWord key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {w}
        </TintWord>
      ))}
    </p>
  );
}

function TintWord({ children, progress, range }: { children: React.ReactNode; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.3, 1]);
  return (
    <motion.span style={{ opacity }} className="inline">
      {children}{" "}
    </motion.span>
  );
}

/** Children fade-rise one after another on mount (dashboard widgets, list rows). */
export function Stagger({ children, className, delay = 0, step = 0.06 }: { children: React.ReactNode; className?: string; delay?: number; step?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } }}
    >
      {React.Children.map(children, (child) =>
        child == null || child === false ? null : (
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }} className="min-w-0">
            {child}
          </motion.div>
        )
      )}
    </motion.div>
  );
}

/** Giant condensed wordmark that slides sideways with scroll, with an optional inline chip (Eddy "EQUITY ▣ RESEARCH"). */
export function ScrollWordmark({ left, right, chip, className, drift = 120 }: { left: string; right?: string; chip?: React.ReactNode; className?: string; drift?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], [drift, -drift]);
  const chipScale = useTransform(scrollYProgress, [0.15, 0.5], [0.3, 1]);
  return (
    <div ref={ref} className={cn("overflow-hidden", className)} role="img" aria-label={[left, right].filter(Boolean).join(" ")}>
      <motion.div style={{ x }} className="wordmark flex items-center justify-center gap-[0.16em] whitespace-nowrap text-[clamp(3.5rem,14vw,14rem)]" aria-hidden>
        <span>{left}</span>
        {chip && (
          <motion.span style={{ scale: chipScale }} className="inline-flex h-[0.66em] w-[1em] shrink-0 overflow-hidden rounded-[0.06em]">
            {chip}
          </motion.span>
        )}
        {right && <span>{right}</span>}
      </motion.div>
    </div>
  );
}
