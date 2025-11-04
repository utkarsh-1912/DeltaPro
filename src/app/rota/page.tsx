"use client";

import { motion } from "framer-motion";
import { RotaDashboard } from "@/components/rota-dashboard";
import { GenerationHistory } from "@/components/generation-history";
import { Separator } from "@/components/ui/separator";
import { useRotaStore } from "@/lib/store";
import { WelcomeDialog } from "@/components/welcome-dialog";

export default function RotaPage() {
  const { generationHistory } = useRotaStore();

  if (generationHistory.length === 0) {
    return <WelcomeDialog />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6 flex flex-col gap-6"
    >
      <RotaDashboard />
      <Separator />
      <GenerationHistory />
    </motion.div>
  );
}
