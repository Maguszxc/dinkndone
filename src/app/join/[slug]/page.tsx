"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { UserPlus, Clock, Trophy } from "lucide-react";
import type { BoardData } from "@/types";

export default function JoinPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [sessionName, setSessionName] = useState("");

  // Load session name
  useEffect(() => {
    fetch(`/api/sessions/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data as { group_name?: string };
        if (d.group_name) setSessionName(d.group_name);
      })
      .catch(() => {});
  }, [slug]);

  // Poll board after joining
  useEffect(() => {
    if (!joined) return;
    const poll = () => {
      fetch(`/api/sessions/${slug}/board`)
        .then((r) => r.json())
        .then((data) => setBoard(data as BoardData))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [joined, slug]);

  async function handleJoin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/sessions/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = (await res.json()) as {
        player?: { id: number };
        position?: number;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "Failed to join");

      setPlayerId(data.player?.id ?? null);
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Derive my status from board
  const myStatus = board?.allPlayers.find((p) => p.id === playerId)?.status;
  const myQueuePos = board?.waitingPlayers.findIndex((p) => p.id === playerId);
  const myMatch = board?.activeMatches.find(
    (m) =>
      m.team_a_p1 === playerId ||
      m.team_a_p2 === playerId ||
      m.team_b_p1 === playerId ||
      m.team_b_p2 === playerId
  );

  if (joined && board) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-black text-white">{sessionName}</h1>
            <p className="text-gray-400 text-sm mt-1">
              Playing as <span className="text-green-400 font-bold">{name}</span>
            </p>
          </div>

          {myStatus === "playing" && myMatch ? (
            <div className="bg-green-500/10 border border-green-500 rounded-2xl p-6 text-center">
              <Trophy className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-black text-xl">YOU'RE ON COURT!</p>
              <p className="text-white text-lg font-bold mt-1">
                Court {myMatch.court_number}
              </p>
              <div className="mt-4 space-y-2">
                <div className="text-sm text-gray-300">
                  <span className="text-yellow-400 font-semibold">Team A:</span>{" "}
                  {myMatch.team_a_p1_name} &amp; {myMatch.team_a_p2_name}
                </div>
                <div className="text-gray-500 text-xs">vs</div>
                <div className="text-sm text-gray-300">
                  <span className="text-blue-400 font-semibold">Team B:</span>{" "}
                  {myMatch.team_b_p1_name} &amp; {myMatch.team_b_p2_name}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500 rounded-2xl p-6 text-center">
              <Clock className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <p className="text-yellow-400 font-black text-xl">IN THE QUEUE</p>
              {myQueuePos !== undefined && myQueuePos >= 0 && (
                <p className="text-white text-4xl font-black mt-2">
                  #{myQueuePos + 1}
                </p>
              )}
              <p className="text-gray-400 text-sm mt-2">Hang tight — you'll be called up soon</p>
            </div>
          )}

          {/* Next up preview */}
          {board.waitingPlayers.length > 0 && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Queue
              </h3>
              <div className="space-y-2">
                {board.waitingPlayers.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 ${
                      p.id === playerId ? "text-green-400" : "text-gray-300"
                    }`}
                  >
                    <span className="text-xs text-gray-600 w-5">{i + 1}</span>
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.id === playerId && (
                      <span className="ml-auto text-xs text-green-400">← you</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (joined) {
    // Loading board
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-pulse text-green-400 text-xl font-bold">
            Joining…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white">
            {sessionName || "Join Session"}
          </h1>
          <p className="text-gray-400 text-sm mt-2">Enter your name to join the queue</p>
        </div>

        <form
          onSubmit={handleJoin}
          className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800"
        >
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={30}
              autoFocus
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg text-center font-bold"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-base"
          >
            {loading ? (
              <span className="animate-pulse">Joining…</span>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Join Queue
              </>
            )}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-4">Session: {slug}</p>
      </div>
    </main>
  );
}
