"use client";

import AdminWaitlistPage from "@/views/AdminWaitlistPage";
import { AdminGuard } from "@/components/guards";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <AdminGuard><DashboardLayout><AdminWaitlistPage /></DashboardLayout></AdminGuard>
  );
}
