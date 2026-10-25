"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { signIn } from "next-auth/react";
import { ArrowLeft, Eye, EyeOff, CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";
import { AuthPanel } from "@/components/auth-panel";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    company: z.string().max(100).optional(),
    email: z.string().email("Invalid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setIsLoading(true);
    try {
      const register = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, company: values.company || undefined, email: values.email, password: values.password }),
      });
      if (!register.ok) {
        const data = await register.json().catch(() => ({}));
        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: data.error || "Could not create the account. Please try again.",
        });
        return;
      }

      const result = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
      });

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Account created",
          description: "Your account exists but sign-in failed. Try signing in from the login page.",
        });
        router.push("/login");
      } else {
        const created = await register.json().catch(() => null);
        toast({
          title: "Account Created",
          description: created?.organization
            ? created.organization.created
              ? `${created.organization.name} is ready. You're its first admin.`
              : `You joined ${created.organization.name}.`
            : "You have been successfully signed up.",
        });
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Signup Error:", error);
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background relative overflow-hidden">

      <AuthPanel title="Start running people operations properly." body="Create your account. Your administrator can connect SSO, Slack, calendars and your HR system later." />

      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 w-full max-w-md lg:max-w-none mx-auto lg:mx-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-sm"
        >
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-8">
            <h2 className="page-title mb-3">Create an account</h2>
            <p className="text-muted-foreground">Enter your information to get started.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        className="bg-background/50 border-input/60 focus:bg-background transition-colors"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Company</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Acme Industries"
                        className="bg-background/50 border-input/60 focus:bg-background transition-colors"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">If your company already uses DeltaPro with your email domain, you'll join it instead.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        className="bg-background/50 border-input/60 focus:bg-background transition-colors"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pr-10 bg-background/50 border-input/60 focus:bg-background transition-colors"
                          {...field}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pr-10 bg-background/50 border-input/60 focus:bg-background transition-colors"
                          {...field}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isLoading}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full mt-6 shadow-md" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline transition-all">
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
