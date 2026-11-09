"use client";

import FreelancerSearchPage from "@/views/FreelancerSearchPage";
import { RoleGuard } from "@/components/guards";
import { Role } from "@/api/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <RoleGuard requiredRole={Role.INFLUENCER}><DashboardLayout><FreelancerSearchPage /></DashboardLayout></RoleGuard>
  );
}
