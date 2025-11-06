
"use client";

import { AppLayout } from "@/components/app-layout";
import AuthGate from "@/components/auth-gate";

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <AppLayout>
        {children}
      </AppLayout>
    </AuthGate>
  );
}
