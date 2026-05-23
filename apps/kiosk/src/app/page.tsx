"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type CheckInState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; visitorName: string }
  | { kind: "error"; message: string };

export default function KioskPage() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<CheckInState>({ kind: "idle" });

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;

    setState({ kind: "loading" });
    try {
      const res = await fetch(`${API_URL}/gate/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeToken: token.trim() }),
      });

      if (!res.ok) {
        const body = await res.text();
        setState({ kind: "error", message: body || `Check-in failed (${res.status})` });
        return;
      }

      const data = await res.json();
      setState({ kind: "success", visitorName: data.visitorName ?? "Visitor" });
      setToken("");
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="mb-2 text-3xl font-bold">Gate Check-In</h1>
        <p className="mb-6 text-sm text-slate-300">
          Scan your QR code or enter the token below.
        </p>

        <form onSubmit={handleCheckIn} className="space-y-4">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="QR token"
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-lg outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={state.kind === "loading" || !token.trim()}
            className="w-full rounded-lg bg-blue-500 px-4 py-3 font-semibold transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.kind === "loading" ? "Checking in…" : "Check In"}
          </button>
        </form>

        {state.kind === "success" && (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300">
            ✓ Welcome, {state.visitorName}.
          </div>
        )}
        {state.kind === "error" && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
            ✗ {state.message}
          </div>
        )}
      </div>
    </main>
  );
}
