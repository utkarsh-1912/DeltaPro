"use client";

import { motion } from "framer-motion";
import { EASE, LiveClock } from "@/components/motion";

/** Left half of the sign-in / sign-up screens: night ink, grain, giant wordmark (after eddyrlora.com). */
export function AuthPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-night grain relative hidden flex-1 flex-col justify-between overflow-hidden p-10 lg:flex">
      <div className="relative z-10 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
        <span>DeltaPro · People operations</span>
        <LiveClock label="Mumbai" timeZone="Asia/Kolkata" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative z-10 max-w-md"
      >
        <h2 className="font-display text-5xl font-bold leading-[0.98] tracking-[-0.03em]">{title}</h2>
        <p className="mt-5 text-lg leading-relaxed text-white/60">{body}</p>
        <ul className="mt-8 space-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
          <li>· Geofenced attendance</li>
          <li>· Leave with approvals in Slack</li>
          <li>· Rotas on your calendar</li>
        </ul>
      </motion.div>
      <motion.p
        aria-hidden
        initial={{ y: "40%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.1, delay: 0.15, ease: EASE }}
        className="wordmark relative -mb-6 select-none whitespace-nowrap text-[clamp(6rem,13vw,13rem)] text-white/[0.9]"
      >
        DeltaPro
      </motion.p>
    </div>
  );
}
