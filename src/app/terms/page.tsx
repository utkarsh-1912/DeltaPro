"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Gavel, FileCheck, Scale, AlertTriangle, RefreshCcw } from "lucide-react";

export default function TermsPage() {
  const lastUpdated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -right-4 w-72 h-72 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute bottom-0 -left-4 w-72 h-72 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <Link href="/" className="group inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-12">
            <div className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back to Home
          </Link>

          <header className="space-y-4 mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest"
            >
              <FileCheck className="h-3 w-3" /> Agreement
            </motion.div>
            <h1 className="text-5xl font-black tracking-tight leading-none">
              Terms of <span className="text-primary">Service.</span>
            </h1>
            <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">
              Last Updated: {lastUpdated}
            </p>
          </header>

          <Card className="border-none shadow-2xl bg-background/50 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
            <CardContent className="p-8 md:p-12 space-y-12">

              <section className="space-y-4">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Gavel className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">System Access</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  Welcome to DeltaPro by <Link href="https://utkristi-io.netlify.app" className="text-primary hover:underline">Utkristi.io</Link>. This application is an enterprise-grade demonstration platform. By accessing our services, you agree to comply with our operational framework and security protocols.
                </p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 rounded-3xl bg-muted/30 border border-border/40 space-y-4">
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" /> User Obligations
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    Account holders are responsible for maintaining the confidentiality of their credentials and for all activities that occur under their administrative instance. Accuracy of workforce data is paramount for the integrity of the scheduling engine.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-muted/30 border border-border/40 space-y-4">
                  <h3 className="text-lg font-black flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" /> Usage Rights
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    We reserve the right to modify system functionalities or reset demonstration instances to maintain platform stability. Unauthorized exploitation of platform logic or security is strictly prohibited.
                  </p>
                </div>
              </div>

              <section className="space-y-4 pt-4">
                <div className="flex items-center gap-3 text-foreground mb-2">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <RefreshCcw className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">Modifications</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  DeltaPro is rapidly evolving. We reserve the right to update these terms to reflect new enterprise capabilities or regulatory requirements. Continued use of the platform after updates constitutes acceptance of the refined framework.
                </p>
              </section>

              <footer className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Enterprise Resilience Framework
                </p>
                <div className="flex gap-4">
                  <Link href="/privacy" className="text-xs font-black uppercase tracking-widest text-emerald-600 hover:underline">
                    Privacy Policy
                  </Link>
                </div>
              </footer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
