"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Clock, RefreshCw } from "lucide-react";
import type { BoardData, MatchWithPlayers } from "@/types";
import { ROTATION_LABELS } from "@/types";

const COURT_COLORS = [
  "border-yellow-400 bg-yellow-400/5",
  "border-blue-400 bg-blue-400/5",
  "border-green-400 bg-green-400/5",
  "border-purple-400 bg-purple-400/5",
  "border-orange-400 bg-orange-400/5",
  "border-pink-400 bg-pink-400/5",
];

const COURT_TITLE_COLORS = [
  "text-yellow-400",
  "text-blue-400",
  "text-green-400",
  "text-purple-400",
  "text-orange-400",
  "text-pink-400",
];

function CourtCard({ match, idx }: { match: MatchWithPlayers; idx: number }) {
  const color = COURT_COLORS[(idx) % COURT_COLORS.length];
  const titleColor = COURT_TITLE_COLORS[(idx) % COURT_TITLE_COLORS.length];

  return (
    <div className={`rounded-2xl border-2 p-5 ${color}`}>
      <div className={`text-xs font-black uppercase tracking-widest mb-3 ${titleColor}`}>
        Court {match.court_number}
      </div>

      <div className="space-y-3">
        {/* Team A */}
        <div className="bg-gray-900/80 rounded-xl p-3">
          <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mb-1">
            Team A
          </div>
          <div className="text-white font-bold text-base leading-snug">
            {match.team_a_p1_name}
          </div>
          <div className="text-gray-400 font-semibold text-sm">
            {match.team_a_p2_name}
          </div>
        </div>

        <div className="text-center text-gray-600 font-black text-xs tracking-widest">
          VS
        </div>

        {/* Team B */}
        <div className="bg-gray-900/80 rounded-xl p-3">
          <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">
            Team B
          </div>
          <div className="text-white font-bold text-base leading-snug">
            {match.team_b_p1_name}
          </div>
          <div className="text-gray-400 font-semibold text-sm">
            {match.team_b_p2_name}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [board, setBoard] = useState<BoardData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBoard = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch(`/api/sessions/${slug}/board`);
      if (res.ok) {
        const data = (await res.json()) as BoardData;
        setBoard(data);
        setLastUpdated(new Date());
      }
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchBoard();
    const id = setInterval(() => fetchBoard(), 10000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  if (!board) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse text-lg font-bold">Loading board…</div>
      </main>
    );
  }

  const nextUp = board.waitingPlayers.slice(0, 8);

  return (
    <main className="min-h-screen p-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">
              {board.session.group_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 font-mono">{slug}</span>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-500">
                {ROTATION_LABELS[board.session.rotation_type]}
              </span>
            </div>
          </div>
          <button
            onClick={() => fetchBoard(true)}
            className="text-gray-600 hover:text-gray-300 transition-colors p-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-500 font-semibold">LIVE</span>
          {lastUpdated && (
            <span className="text-xs text-gray-600">
              · Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Courts */}
      {board.activeMatches.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold text-lg">No active matches</p>
          <p className="text-sm mt-1">
            {board.session.is_active ? "Waiting for players…" : "Session not started yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {board.activeMatches.map((match, i) => (
            <CourtCard key={match.id} match={match} idx={match.court_number - 1} />
          ))}
        </div>
      )}

      {/* Next Up */}
      {nextUp.length > 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">
            Next Up — {board.waitingPlayers.length} waiting
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {nextUp.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-xl p-3 ${
                  i < 4 ? "bg-gray-800 border border-gray-700" : "bg-gray-900"
                }`}
              >
                <span
                  className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                    i < 4
                      ? "bg-green-500 text-black"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    i < 4 ? "text-white" : "text-gray-500"
                  }`}
                >
                  {p.name}
                </span>
              </div>
            ))}
          </div>
          {board.waitingPlayers.length > 8 && (
            <p className="text-gray-600 text-xs mt-3 text-center">
              +{board.waitingPlayers.length - 8} more in queue
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-gray-700 text-xs mt-6">
        Refreshes every 10s · scan {slug} to join
      </p>
    </main>
  );
}
