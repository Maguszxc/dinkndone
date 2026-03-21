"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Play,
  StopCircle,
  Download,
  Users,
  Trophy,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import type { BoardData, MatchWithPlayers } from "@/types";
import { ROTATION_LABELS } from "@/types";

const COURT_COLORS = [
  "border-yellow-400",
  "border-blue-400",
  "border-green-400",
  "border-purple-400",
  "border-orange-400",
  "border-pink-400",
];
const COURT_BG = [
  "bg-yellow-400/5",
  "bg-blue-400/5",
  "bg-green-400/5",
  "bg-purple-400/5",
  "bg-orange-400/5",
  "bg-pink-400/5",
];
const COURT_TEXT = [
  "text-yellow-400",
  "text-blue-400",
  "text-green-400",
  "text-purple-400",
  "text-orange-400",
  "text-pink-400",
];

interface EndMatchModal {
  match: MatchWithPlayers;
}

export default function HostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [board, setBoard] = useState<BoardData | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [endModal, setEndModal] = useState<EndMatchModal | null>(null);
  const [endingMatch, setEndingMatch] = useState(false);
  const [removingPlayer, setRemovingPlayer] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fetchBoard = useCallback(async () => {
    const res = await fetch(`/api/sessions/${slug}/board`);
    if (res.ok) {
      const data = (await res.json()) as BoardData;
      setBoard(data);
      setSessionStarted(data.session.is_active === 1);
    }
  }, [slug]);

  useEffect(() => {
    fetchBoard();
    const id = setInterval(fetchBoard, 5000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  const joinUrl = origin ? `${origin}/join/${slug}` : "";
  const boardUrl = origin ? `${origin}/board/${slug}` : "";

  async function handleStart() {
    setLoading(true);
    await fetch(`/api/sessions/${slug}/start`, { method: "POST" });
    await fetchBoard();
    setLoading(false);
  }

  async function handleEndMatch(winnerId: "a" | "b" | null) {
    if (!endModal) return;
    setEndingMatch(true);
    await fetch(`/api/sessions/${slug}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: endModal.match.id, winner_team: winnerId }),
    });
    setEndModal(null);
    setEndingMatch(false);
    await fetchBoard();
  }

  function handleCopy() {
    navigator.clipboard.writeText(joinUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCsvDownload() {
    window.open(`/api/sessions/${slug}/csv`, "_blank");
  }

  if (!board) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse font-bold text-lg">Loading…</div>
      </main>
    );
  }

  const { session, activeMatches, waitingPlayers, allPlayers } = board;

  return (
    <main className="min-h-screen p-4 pb-16 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">
              {session.group_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span className="font-mono text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                {slug}
              </span>
              <span className="text-xs text-gray-500">
                {ROTATION_LABELS[session.rotation_type]}
              </span>
              <span className="text-xs text-gray-500">
                {session.num_courts} court{session.num_courts !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <button
            onClick={fetchBoard}
            className="text-gray-600 hover:text-gray-300 transition-colors p-2 flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QR + Links */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-5">
        <div className="flex gap-5 items-start">
          {joinUrl && (
            <div className="flex-shrink-0 bg-white rounded-xl p-2">
              <QRCodeSVG value={joinUrl} size={100} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">
              Players scan to join
            </p>
            <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2 mb-2">
              <span className="text-sm text-gray-300 font-mono truncate flex-1">
                {joinUrl.replace(/^https?:\/\//, "")}
              </span>
              <button
                onClick={handleCopy}
                className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <a
              href={boardUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open Big Board
            </a>
          </div>
        </div>
      </div>

      {/* Start / Stats bar */}
      <div className="flex gap-2 mb-5">
        {!sessionStarted ? (
          <button
            onClick={handleStart}
            disabled={loading || allPlayers.length < 4}
            className="flex-1 bg-green-500 hover:bg-green-400 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {loading ? (
              <span className="animate-pulse">Starting…</span>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Session
                {allPlayers.length < 4 && (
                  <span className="text-xs font-normal ml-1 opacity-70">
                    (need {4 - allPlayers.length} more)
                  </span>
                )}
              </>
            )}
          </button>
        ) : (
          <div className="flex-1 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 font-bold text-sm">Session Live</span>
            <span className="text-gray-500 text-xs ml-auto">
              {allPlayers.length} players
            </span>
          </div>
        )}
        <button
          onClick={handleCsvDownload}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-4 py-3 rounded-xl flex items-center gap-2 transition-all text-sm"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
      </div>

      {/* Active Courts */}
      {activeMatches.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
            Active Matches
          </h2>
          <div className="space-y-3">
            {activeMatches.map((match) => {
              const idx = (match.court_number - 1) % COURT_COLORS.length;
              return (
                <div
                  key={match.id}
                  className={`rounded-2xl border-2 ${COURT_COLORS[idx]} ${COURT_BG[idx]} p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black uppercase tracking-widest ${COURT_TEXT[idx]}`}>
                      Court {match.court_number}
                    </span>
                    <button
                      onClick={() => setEndModal({ match })}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      End Match
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-900/80 rounded-xl p-3">
                      <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mb-1">
                        Team A
                      </div>
                      <div className="text-white font-bold text-sm">{match.team_a_p1_name}</div>
                      <div className="text-gray-400 text-sm">{match.team_a_p2_name}</div>
                    </div>
                    <div className="bg-gray-900/80 rounded-xl p-3">
                      <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">
                        Team B
                      </div>
                      <div className="text-white font-bold text-sm">{match.team_b_p1_name}</div>
                      <div className="text-gray-400 text-sm">{match.team_b_p2_name}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Waiting Queue */}
      <section className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">
            Queue — {waitingPlayers.length} waiting
          </h2>
          {sessionStarted && waitingPlayers.length >= 4 && activeMatches.length < session.num_courts && (
            <button
              onClick={handleStart}
              className="text-xs text-green-400 hover:text-green-300 font-semibold flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              Fill Courts
            </button>
          )}
        </div>

        {waitingPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-700 bg-gray-900 rounded-2xl border border-gray-800">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No one waiting</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 divide-y divide-gray-800">
            {waitingPlayers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    i < 4
                      ? "bg-green-500 text-black"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-white">{p.name}</span>
                {i < 4 && (
                  <span className="ml-auto text-[10px] text-green-400 font-bold uppercase tracking-wide">
                    Next Up
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All Players */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
          All Players ({allPlayers.length})
        </h2>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 divide-y divide-gray-800">
          {allPlayers.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-600 text-sm">
              Share the QR code to get players in
            </div>
          ) : (
            allPlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    p.status === "playing" ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
                <span className="text-sm font-medium text-white">{p.name}</span>
                <span
                  className={`ml-auto text-[10px] font-bold uppercase ${
                    p.status === "playing" ? "text-green-400" : "text-yellow-400"
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* End Match Modal */}
      {endModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-white text-lg">
                End — Court {endModal.match.court_number}
              </h3>
              <button
                onClick={() => setEndModal(null)}
                className="text-gray-600 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-5">Who won?</p>

            <div className="space-y-3">
              <button
                onClick={() => handleEndMatch("a")}
                disabled={endingMatch}
                className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-bold py-4 rounded-xl flex flex-col items-center gap-1 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Team A Wins
                </div>
                <span className="text-xs text-yellow-400/70 font-normal">
                  {endModal.match.team_a_p1_name} &amp; {endModal.match.team_a_p2_name}
                </span>
              </button>

              <button
                onClick={() => handleEndMatch("b")}
                disabled={endingMatch}
                className="w-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold py-4 rounded-xl flex flex-col items-center gap-1 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Team B Wins
                </div>
                <span className="text-xs text-blue-400/70 font-normal">
                  {endModal.match.team_b_p1_name} &amp; {endModal.match.team_b_p2_name}
                </span>
              </button>

              {session.rotation_type === 1 && (
                <button
                  onClick={() => handleEndMatch(null)}
                  disabled={endingMatch}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 font-semibold py-3 rounded-xl transition-all text-sm"
                >
                  No winner / Skip
                </button>
              )}
            </div>

            {endingMatch && (
              <p className="text-center text-gray-500 text-sm mt-4 animate-pulse">
                Rotating…
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
