"use client";

import FreelancerTemplatesPage from "@/views/FreelancerTemplatesPage";
import { RoleProtectedRoute } from "@/components/guards";
import { Role } from "@/api/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <RoleProtectedRoute allowedRoles={[Role.FREELANCER]}><DashboardLayout><FreelancerTemplatesPage /></DashboardLayout></RoleProtectedRoute>
  );
}
