"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LiveHeadcountCard } from "@/components/dashboard/LiveHeadcountCard";
import { VisitorsTable } from "@/components/dashboard/VisitorsTable";
import { ComplianceStatus } from "@/components/dashboard/ComplianceStatus";
import { DashboardHeader } from "@/components/dashboard-header";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

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

      {/* Live Headcount Section */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Live Occupancy
          </h2>
          <LiveHeadcountCard />
        </div>

        {/* Grid Layout for Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 pb-12">
          <div className="lg:col-span-2">
            <VisitorsTable />
          </div>
          <div>
            <ComplianceStatus />
          </div>
        </div>
      </div>
    </main>
  );
}
