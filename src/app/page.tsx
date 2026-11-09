"use client";

import Home from "@/views/Home";
import { PublicOnlyRoute } from "@/components/guards";
import MainLayout from "@/components/layout/MainLayout";

export default function Page() {
  return (
    <PublicOnlyRoute><MainLayout><Home /></MainLayout></PublicOnlyRoute>
  );
}
