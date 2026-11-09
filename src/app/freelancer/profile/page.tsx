"use client";

import FreelancerProfilePage from "@/views/FreelancerProfilePage";
import { RoleProtectedRoute } from "@/components/guards";
import { Role } from "@/api/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <RoleProtectedRoute allowedRoles={[Role.FREELANCER]}><DashboardLayout><FreelancerProfilePage /></DashboardLayout></RoleProtectedRoute>
  );
}
