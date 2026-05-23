"use client";

import { motion } from "framer-motion";
import { Clock, CheckCircle, XCircle, Hourglass } from "lucide-react";

interface Visit {
  id: string;
  visitorName: string;
  host: string;
  status: "PENDING" | "APPROVED" | "CHECKED_IN" | "CHECKED_OUT" | "REJECTED";
  expectedEntry: string;
  actualEntry?: string;
}

const mockVisits: Visit[] = [
  {
    id: "v1",
    visitorName: "John Smith",
    host: "Sarah Johnson (HR)",
    status: "APPROVED",
    expectedEntry: "2025-05-22 10:00 AM",
    actualEntry: "2025-05-22 09:55 AM",
  },
  {
    id: "v2",
    visitorName: "Emily Davis",
    host: "Mike Chen (Engineering)",
    status: "PENDING",
    expectedEntry: "2025-05-22 11:30 AM",
  },
  {
    id: "v3",
    visitorName: "Robert Wilson",
    host: "Lisa Anderson (Finance)",
    status: "CHECKED_IN",
    expectedEntry: "2025-05-22 02:00 PM",
    actualEntry: "2025-05-22 01:58 PM",
  },
];

function getStatusIcon(status: Visit["status"]) {
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

function getStatusColor(status: Visit["status"]) {
  switch (status) {
    case "APPROVED":
      return "bg-green-500/10 text-green-500";
    case "PENDING":
      return "bg-yellow-500/10 text-yellow-500";
    case "CHECKED_IN":
      return "bg-blue-500/10 text-blue-500";
    case "CHECKED_OUT":
      return "bg-gray-500/10 text-gray-500";
    default:
      return "bg-red-500/10 text-red-500";
  }
}

export function VisitorsTable() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">Today's Visitors</h3>
      </div>
      <div className="divide-y divide-white/10">
        {mockVisits.map((visit, index) => (
          <motion.div
            key={visit.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="px-6 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium text-white">{visit.visitorName}</h4>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(visit.status)}`}>
                    {visit.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">Meeting: {visit.host}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Expected: {visit.expectedEntry}
                  {visit.actualEntry && ` • Arrived: ${visit.actualEntry}`}
                </p>
              </div>
              <div className="ml-4">{getStatusIcon(visit.status)}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
