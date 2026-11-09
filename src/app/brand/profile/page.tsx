"use client";

import BrandProfilePage from "@/views/BrandProfilePage";
import { RoleProtectedRoute } from "@/components/guards";
import { Role } from "@/api/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Page() {
  return (
    <RoleProtectedRoute allowedRoles={[Role.BRAND]}><DashboardLayout><BrandProfilePage /></DashboardLayout></RoleProtectedRoute>
  );
}
