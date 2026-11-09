"use client";

import AccountPage from "@/views/AccountPage";
import { ProtectedRoute } from "@/components/guards";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <ProtectedRoute><DashboardLayout><AccountPage /></DashboardLayout></ProtectedRoute>
  );
}
