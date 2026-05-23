"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Zap } from "lucide-react";

interface ComplianceItem {
  id: string;
  name: string;
  status: "compliant" | "warning" | "critical";
  detail: string;
}

const mockCompliance: ComplianceItem[] = [
  {
    id: "c1",
    name: "Medical Clearance",
    status: "compliant",
    detail: "All active workers verified",
  },
  {
    id: "c2",
    name: "Police Verification",
    status: "warning",
    detail: "2 workers pending verification",
  },
  {
    id: "c3",
    name: "Document Validity",
    status: "compliant",
    detail: "All documents current",
  },
];

export function ComplianceStatus() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-6">Compliance Status</h3>
      <div className="space-y-4">
        {mockCompliance.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4 p-4 rounded-lg border border-white/5 hover:bg-white/5 transition-colors"
          >
            <div>
              {item.status === "compliant" && (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              )}
              {item.status === "warning" && (
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              )}
              {item.status === "critical" && (
                <Zap className="w-6 h-6 text-red-500" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{item.name}</p>
              <p className="text-sm text-zinc-400">{item.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
