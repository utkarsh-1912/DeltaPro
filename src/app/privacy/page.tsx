"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Eye, Lock, FileText, Database } from "lucide-react";

export default function PrivacyPage() {
    const lastUpdated = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-emerald-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
            <div className="absolute bottom-0 -right-4 w-72 h-72 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />

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
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-black uppercase tracking-widest"
                        >
                            <ShieldCheck className="h-3 w-3" /> Data Security
                        </motion.div>
                        <h1 className="text-5xl font-black tracking-tight leading-none">
                            Privacy <span className="text-emerald-500">Policy.</span>
                        </h1>
                        <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">
                            Last Updated: {lastUpdated}
                        </p>
                    </header>

                    <Card className="border-none shadow-2xl bg-background/50 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
                        <CardContent className="p-8 md:p-12 space-y-12">

                            <section className="space-y-4">
                                <div className="flex items-center gap-3 text-emerald-500 mb-2">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <Eye className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tight">Information Transparency</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed font-medium">
                                    At DeltaPro by <Link href="https://utkristi-io.netlify.app" className="text-primary hover:underline">Utkristi.io</Link>, we believe in absolute transparency. As a demonstration project, our primary goal is to showcase workforce management capabilities while respecting your digital boundaries.
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-6 rounded-3xl bg-muted/30 border border-border/40 space-y-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                        <Database className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-black">Data Collection</h3>
                                    <ul className="space-y-3 text-sm text-muted-foreground font-medium">
                                        <li className="flex gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                            Account details (Name, Email)
                                        </li>
                                        <li className="flex gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                            Workforce structure and schedules
                                        </li>
                                        <li className="flex gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                            Attendance logs and coordinates
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-6 rounded-3xl bg-muted/30 border border-border/40 space-y-4">
                                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-black">How We Use It</h3>
                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                        Personalized data is exclusively used to power the scheduling engine. We do not sell your data, use it for advertising, or share it with third parties outside of essential infrastructure providers.
                                    </p>
                                </div>
                            </div>

                            <section className="space-y-4 pt-4">
                                <div className="flex items-center gap-3 text-foreground mb-2">
                                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tight">Rights & Control</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed font-medium">
                                    As the platform evolves, you retain full control over your organization's data. You can request data deletion at any time by contacting our engineering team. We prioritize your right to be forgotten in accordance with global privacy standard practices.
                                </p>
                            </section>

                            <footer className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    Secure Workforce Intelligence
                                </p>
                                <div className="flex gap-4">
                                    <Link href="/terms" className="text-xs font-black uppercase tracking-widest text-primary hover:underline">
                                        Terms of Service
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
