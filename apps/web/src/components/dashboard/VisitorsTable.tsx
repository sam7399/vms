"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle, XCircle, Hourglass, AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/api";

type VisitStatus =
  | "PENDING"
  | "APPROVED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "REJECTED"
  | "BLACKLISTED";

interface ApiVisit {
  id: string;
  status: VisitStatus;
  expectedEntry: string;
  actualEntry: string | null;
  visitor: { fullName: string; company: string | null };
  host: { fullName: string; email: string };
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: VisitStatus }) {
  const colorMap: Record<VisitStatus, string> = {
    APPROVED: "bg-green-500/10 text-green-400",
    PENDING: "bg-yellow-500/10 text-yellow-400",
    CHECKED_IN: "bg-blue-500/10 text-blue-400",
    CHECKED_OUT: "bg-gray-500/10 text-gray-300",
    REJECTED: "bg-red-500/10 text-red-400",
    BLACKLISTED: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${colorMap[status]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StatusIcon({ status }: { status: VisitStatus }) {
  switch (status) {
    case "APPROVED":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "PENDING":
      return <Hourglass className="w-5 h-5 text-yellow-500" />;
    case "CHECKED_IN":
      return <Clock className="w-5 h-5 text-blue-500" />;
    case "CHECKED_OUT":
      return <XCircle className="w-5 h-5 text-gray-500" />;
    default:
      return <XCircle className="w-5 h-5 text-red-500" />;
  }
}

export function VisitorsTable({ branchId = "" }: { branchId?: string }) {
  const [visits, setVisits] = useState<ApiVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const path = branchId
          ? `/visitors/visit/list/${encodeURIComponent(branchId)}`
          : "/visitors/visits";
        const data = await apiGet<ApiVisit[]>(path);
        if (!cancelled) setVisits(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load visits");
      }
    }
    load();
    const interval = setInterval(load, 15_000); // refresh every 15s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [branchId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Recent Visits</h3>
        {visits && (
          <span className="text-xs text-zinc-400">{visits.length} total</span>
        )}
      </div>

      {error && (
        <div className="px-6 py-4 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!visits && !error && (
        <div className="px-6 py-8 text-center text-zinc-500 text-sm">Loading…</div>
      )}

      {visits && visits.length === 0 && (
        <div className="px-6 py-8 text-center text-zinc-500 text-sm">
          No visits yet. Create one via the API or seed the database.
        </div>
      )}

      <div className="divide-y divide-white/10 max-h-[480px] overflow-y-auto">
        {visits?.map((visit, index) => (
          <motion.div
            key={visit.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.4) }}
            className="px-6 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h4 className="font-medium text-white truncate">
                    {visit.visitor.fullName}
                  </h4>
                  <StatusBadge status={visit.status} />
                </div>
                <p className="text-sm text-zinc-400">
                  Host: {visit.host.fullName}
                  {visit.visitor.company && ` • ${visit.visitor.company}`}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Expected: {formatDate(visit.expectedEntry)}
                  {visit.actualEntry &&
                    ` • Arrived: ${formatDate(visit.actualEntry)}`}
                </p>
              </div>
              <div className="ml-4 shrink-0">
                <StatusIcon status={visit.status} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
