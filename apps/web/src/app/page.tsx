"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LiveHeadcountCard } from "@/components/dashboard/LiveHeadcountCard";
import { VisitorsTable } from "@/components/dashboard/VisitorsTable";
import { ComplianceStatus } from "@/components/dashboard/ComplianceStatus";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { ComplianceAlerts } from "@/components/dashboard/ComplianceAlerts";
import { VisitsChart } from "@/components/dashboard/VisitsChart";
import { DashboardHeader } from "@/components/dashboard-header";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen w-full">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6">
        <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-white">Live Occupancy</h2>
          <BranchFilter value={branchId} onChange={setBranchId} />
        </div>
        <div className="mt-4">
          <LiveHeadcountCard branchId={branchId} />
        </div>

        <ComplianceAlerts />

        <div className="mt-8">
          <VisitsChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 pb-12">
          <div className="lg:col-span-2">
            <VisitorsTable branchId={branchId} />
          </div>
          <div>
            <ComplianceStatus />
          </div>
        </div>
      </div>
    </main>
  );
}
