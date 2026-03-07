
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-extrabold tracking-tight">Terms of Service & Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base max-w-none text-muted-foreground space-y-6">
            <p className="text-sm">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

            <section>
              <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
              <p>Welcome to DeltaPro by <Link href="https://utkristi-io.netlify.app" className="text-primary hover:underline">Utkristi.io</Link>. This application is a demonstration project provided "as is" for evaluation and showcase purposes only. By accessing or using our service, you agree to be bound by these Terms of Service and Privacy Policy. If you disagree with any part of the terms, you may not access the service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">2. Terms of Service</h2>
              <h3 className="text-lg font-semibold text-foreground">2.1. Account Registration</h3>
              <p>To use the scheduling features of DeltaPro, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password.</p>

              <h3 className="text-lg font-semibold text-foreground">2.2. Use of the Service</h3>
              <p>You agree not to use the Service for any purpose that is illegal or prohibited by these Terms. As this is a demo application, you acknowledge that functionalities may change, and data may be reset or become inaccessible without notice.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">3. Privacy Policy</h2>
              <h3 className="text-lg font-semibold text-foreground">3.1. Information We Collect</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account Information:</strong> When you create an account, we collect your name and email address for authentication purposes.</li>
                <li><strong>User-Generated Content:</strong> We store the data you provide to the application, such as team member names, shift details, rota assignments, and any other configuration data required for the service to function.</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">3.2. How We Use Your Information</h3>
              <p>Your data is used exclusively to provide and operate the features of the DeltaPro application. We do not sell, trade, or otherwise transfer your personally identifiable information or user-generated content to outside parties. We may use your email address to communicate with you about the service if necessary.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">4. Limitation of Liability</h2>
              <p>In no event shall the creators or providers of DeltaPro be liable for any direct, indirect, incidental, special, or consequential damages (including, but not limited to, loss of data) arising out of, or in any way connected with, the use or inability to use this demonstration service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">5. Changes to Terms</h2>
              <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page.</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
