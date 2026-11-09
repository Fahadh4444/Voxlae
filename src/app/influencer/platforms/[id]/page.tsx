"use client";

import PlatformDetailPage from "@/views/PlatformDetailPage";
import { RoleGuard } from "@/components/guards";
import { Role } from "@/api/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <RoleGuard requiredRole={Role.INFLUENCER}><DashboardLayout><PlatformDetailPage /></DashboardLayout></RoleGuard>
  );
}
