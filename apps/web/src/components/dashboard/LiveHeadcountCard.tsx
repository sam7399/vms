"use client";

import { motion } from "framer-motion";
import { Users, UserCheck, HardHat, Briefcase, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, apiGet } from "@/lib/api";

interface HeadcountData {
  total: number;
  visitors: number;
  workers: number;
  employees: number;
  timestamp?: string;
}

const EMPTY: HeadcountData = { total: 0, visitors: 0, workers: 0, employees: 0 };

export function LiveHeadcountCard({ branchId = "" }: { branchId?: string }) {
  const [data, setData] = useState<HeadcountData>(EMPTY);
  const [connected, setConnected] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Refetch the (possibly branch-filtered) endpoint
  const refetch = () => {
    const path = branchId
      ? `/visitors/headcount/${encodeURIComponent(branchId)}`
      : "/visitors/headcount";
    apiGet<HeadcountData>(path)
      .then((d) => setData((prev) => ({ ...prev, ...d })))
      .catch(() => {});
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Refetch whenever the branch filter changes
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    const socket: Socket = io(API_URL, { transports: ["websocket", "polling"] });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    // When the server says something changed, re-fetch using current branch filter
    socket.on("headcount_update", () => refetch());
    socket.emit("request_headcount");

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const cards = [
    { label: "Total Inside", count: data.total, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Visitors", count: data.visitors, icon: UserCheck, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Contractors", count: data.workers, icon: HardHat, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Employees", count: data.employees, icon: Briefcase, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-zinc-500 px-1">
        {connected ? (
          <>
            <Wifi className="w-3 h-3 text-green-500" /> Live
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 text-zinc-500" /> Connecting…
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl hover:bg-white/10 transition-colors duration-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-400">{stat.label}</p>
                <motion.h3
                  key={stat.count}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2 text-4xl font-bold tracking-tight text-white"
                >
                  {stat.count}
                </motion.h3>
              </div>
              <div className={`p-4 rounded-full ${stat.bg}`}>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>

            <div
              className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full blur-3xl opacity-20 ${stat.bg}`}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
