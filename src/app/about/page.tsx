
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-extrabold tracking-tight">About DeltaPro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 text-muted-foreground">
            <p className="text-lg">
              DeltaPro by FIXpert is your intelligent partner for seamless team scheduling. We transform the complex, time-consuming task of creating and managing rotas into a streamlined, automated process. Our mission is to empower managers with tools that ensure fairness, efficiency, and clarity, allowing teams to focus on what they do best.
            </p>
            
            <section>
              <h3 className="text-xl font-semibold text-foreground mb-4">Core Features</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Intelligent Rota Generation</h4>
                    <p>Leverage our smart algorithm to automatically generate fair and balanced schedules. It accounts for shift constraints, staffing requirements, and historical data to prevent burnout and ensure equitable assignments.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Centralized Configuration</h4>
                    <p>Manage every aspect of your schedule from a single Config Panel. Define custom shifts with specific timings and rules, and easily manage your team members and their fixed assignments.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Flexible Scheduling Tools</h4>
                    <p>Adapt to changing needs with tools for ad-hoc support planning, automated weekend rotas, and a comprehensive Rota Matrix for analyzing historical assignment data to maintain long-term fairness.</p>
                  </div>
                </li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-foreground pt-4">Our Vision</h3>
              <p>
                We envision a world where scheduling is no longer a chore but a strategic tool that boosts operational efficiency and employee morale. By automating the tedious aspects of rota management, DeltaPro gives you back your most valuable asset: time.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

