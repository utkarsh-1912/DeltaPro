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
    <div className="flex flex-col gap-6">
      <RotaDashboard />
      <Separator />
      <GenerationHistory />
    </div>
  );
}
