"use client";

import AdminPage from "@/views/AdminPage";
import { AdminGuard } from "@/components/guards";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <AdminGuard><DashboardLayout><AdminPage /></DashboardLayout></AdminGuard>
  );
}
