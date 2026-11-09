"use client";

import CreatorToolsPage from "@/views/CreatorTools/CreatorToolsPage";
import { RoleGuard } from "@/components/guards";
import { Role } from "@/api/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <RoleGuard requiredRole={Role.INFLUENCER}><DashboardLayout><CreatorToolsPage /></DashboardLayout></RoleGuard>
  );
}
