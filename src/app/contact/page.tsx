"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, Phone, Send, MapPin, Globe } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate premium feedback
    await new Promise(r => setTimeout(r, 1000));

    const recipientEmail = "go.fixpert@gmail.com";
    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    )}`;

    window.location.href = mailtoLink;
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px]" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          <Link href="/" className="group inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-12">
            <div className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back to Home
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            {/* Left Content Column */}
            <div className="lg:col-span-2 space-y-10">
              <div className="space-y-4">
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-5xl font-black tracking-tighter leading-none"
                >
                  Let's Talk <span className="text-primary">Strategy.</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg text-muted-foreground font-medium max-w-sm"
                >
                  Have a question about our scheduling algorithms or need a custom solution? Our engineers are ready to help.
                </motion.p>
              </div>

              <div className="space-y-6">
                {[
                  { icon: Mail, label: "Email Support", value: "go.fixpert@gmail.com", color: "bg-blue-500/10 text-blue-500" },
                  { icon: Globe, label: "Website", value: "utkristi-io.netlify.app", color: "bg-purple-500/10 text-purple-500" },
                  { icon: MapPin, label: "Headquarters", value: "Remote First, Globally Enabled", color: "bg-emerald-500/10 text-emerald-600" }
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-5 p-4 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="font-bold text-foreground">{item.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Form Column */}
            <div className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] bg-background/60 backdrop-blur-3xl overflow-hidden rounded-[2.5rem]">
                  <CardContent className="p-8 sm:p-12">
                    <form className="space-y-8" onSubmit={handleSubmit}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1" htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            className="h-14 bg-muted/40 border-none rounded-2xl px-6 text-base font-medium focus:ring-2 ring-primary transition-all shadow-inner"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1" htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            className="h-14 bg-muted/40 border-none rounded-2xl px-6 text-base font-medium focus:ring-2 ring-primary transition-all shadow-inner"
                            placeholder="john@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1" htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          className="h-14 bg-muted/40 border-none rounded-2xl px-6 text-base font-medium focus:ring-2 ring-primary transition-all shadow-inner"
                          placeholder="Project Collaboration"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1" htmlFor="message">Message Details</Label>
                        <Textarea
                          id="message"
                          className="bg-muted/40 border-none rounded-3xl px-6 py-5 text-base font-medium focus:ring-2 ring-primary transition-all shadow-inner min-h-[160px] resize-none"
                          placeholder="How can we help your team thrive?"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          required
                        />
                      </div>

                      <Button
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full h-16 rounded-2xl font-black text-lg transition-all group relative overflow-hidden shadow-xl hover:shadow-primary/20 active:scale-[0.98]"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {isSubmitting ? "Sending Connection..." : "Initialize Message"}
                          {!isSubmitting && <Send className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                        </span>
                        <div className="absolute inset-0 bg-primary opacity-100 group-hover:opacity-90 transition-opacity" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
