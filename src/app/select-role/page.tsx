"use client";

import SelectRolePage from "@/views/SelectRolePage";
import { RoleSelectionRoute } from "@/components/guards";

export default function Page() {
  return (
    <RoleSelectionRoute><SelectRolePage /></RoleSelectionRoute>
  );
}
