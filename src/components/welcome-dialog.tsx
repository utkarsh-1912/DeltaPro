"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RotaGenerationDialog } from "@/components/admin/rota-manager";
import { CalendarCheck } from "lucide-react";

export function WelcomeDialog() {
  const [isGenerateDialogOpen, setGenerateDialogOpen] = React.useState(false);

  return (
    <>
      <div className="flex min-h-[calc(100vh-theme(height.14))] items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-md w-full text-center bg-card p-8 rounded-xl shadow-lg border"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary mb-4">
            <CalendarCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-card-foreground">Welcome to DeltaPro!</h2>
          <p className="mt-2 text-muted-foreground">
            It looks like you haven't created any rota schedules yet. Get started by generating your first one.
          </p>
          <div className="mt-6">
            <Button
              size="lg"
              onClick={() => setGenerateDialogOpen(true)}
            >
              Create First Rota
            </Button>
          </div>
        </motion.div>
      </div>
      <Dialog open={isGenerateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Your First Rota</DialogTitle>
          </DialogHeader>
          <RotaGenerationDialog open={isGenerateDialogOpen} onOpenChange={setGenerateDialogOpen} />
        </DialogContent>
      </Dialog>
    </>
  );
}
