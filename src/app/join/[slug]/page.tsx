"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { UserPlus, Clock, Trophy, Copy, Check, KeyRound, RefreshCw, ThumbsDown } from "lucide-react";
import type { BoardData, Player } from "@/types";

type PageState = "loading" | "new" | "returning" | "password_reveal" | "playing" | "ended";

const LS_KEY = (slug: string) => `ph_${slug}`;

interface StoredSession {
  playerId: number;
  password: string;
  name: string;
}

export default function JoinPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [sessionName, setSessionName] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Post-join state
  const [player, setPlayer] = useState<Player | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [copied, setCopied] = useState(false);
  const [reportedLoss, setReportedLoss] = useState(false);
  const [lossLoading, setLossLoading] = useState(false);

  // Load session name
  useEffect(() => {
    fetch(`/api/sessions/${slug}`)
      .then((r) => {
        if (r.status === 404) { setPageState("ended"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const d = data as { group_name?: string };
        if (d.group_name) setSessionName(d.group_name);
      })
      .catch(() => {});
  }, [slug]);

  // Auto-restore from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY(slug));
    if (!stored) {
      setPageState("new");
      return;
    }
    const { playerId, password, name: storedName } = JSON.parse(stored) as StoredSession;
    fetch(`/api/sessions/${slug}/rejoin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
      .then((r) => r.json())
      .then((data) => {
        const d = data as { player?: Player; error?: string };
        if (d.player) {
          setPlayer(d.player);
          setName(storedName);
          setPageState("playing");
        } else {
          localStorage.removeItem(LS_KEY(slug));
          setPageState("new");
        }
      })
      .catch(() => {
        setPageState("new");
      });
    void playerId; // used only for LS
  }, [slug]);

  // Poll board when playing
  useEffect(() => {
    if (pageState !== "playing") return;
    const poll = () => {
      fetch(`/api/sessions/${slug}/board`)
        .then((r) => {
          if (r.status === 404) {
            setPageState("ended");
            return null;
          }
          return r.json();
        })
        .then((data) => { if (data) setBoard(data as BoardData); })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [pageState, slug]);

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
      const data = (await res.json()) as { player?: Player; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to join");
      const p = data.player!;
      setPlayer(p);
      localStorage.setItem(
        LS_KEY(slug),
        JSON.stringify({ playerId: p.id, password: p.password, name: p.name })
      );
      setPageState("password_reveal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRejoin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!recoveryCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${slug}/rejoin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: recoveryCode.trim() }),
      });
      const data = (await res.json()) as { player?: Player; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Code not found");
      const p = data.player!;
      setPlayer(p);
      setName(p.name);
      localStorage.setItem(
        LS_KEY(slug),
        JSON.stringify({ playerId: p.id, password: p.password, name: p.name })
      );
      setPageState("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleReportLoss(matchId: number) {
    if (reportedLoss || !player) return;
    setLossLoading(true);
    try {
      await fetch(`/api/sessions/${slug}/report-loss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, player_id: player.id }),
      });
      setReportedLoss(true);
    } catch {
      // silently fail — poll will catch state changes
    } finally {
      setLossLoading(false);
    }
  }

  function copyPassword() {
    if (!player?.password) return;
    navigator.clipboard.writeText(player.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Session ended ───────────────────────────────────────────────────────
  if (pageState === "ended") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center border border-gray-700 rounded-2xl p-8 bg-gray-900">
          <p className="text-2xl font-black text-white mb-2">Session Ended</p>
          <p className="text-gray-400 text-sm">Thank you for queueing with us!</p>
        </div>
      </main>
    );
  }

  // ── Loading / auto-restore ──────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Checking session…</div>
      </main>
    );
  }

  // ── Password reveal (after new join) ───────────────────────────────────
  if (pageState === "password_reveal") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <p className="text-green-400 font-black text-2xl">You're in! 🎉</p>
            <p className="text-gray-400 text-sm mt-1">
              Welcome, <span className="text-white font-bold">{player?.name}</span>
            </p>
          </div>

          <div className="bg-gray-900 border border-yellow-500 rounded-2xl p-6 text-center space-y-3">
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest">
              Your Recovery Code
            </p>
            <p className="text-white font-black text-4xl tracking-[0.2em]">
              {player?.password}
            </p>
            <p className="text-gray-500 text-xs">
              Save this! Use it to get back in the queue if you lose connection.
            </p>
            <button
              onClick={copyPassword}
              className="flex items-center gap-2 mx-auto bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </div>

          <button
            onClick={() => setPageState("playing")}
            className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-4 rounded-xl transition-all text-base"
          >
            Got it — Take me to the Queue
          </button>
        </div>
      </main>
    );
  }

  // ── Playing view ────────────────────────────────────────────────────────
  if (pageState === "playing") {
    const playerId = player?.id;
    const myStatus = board?.allPlayers.find((p) => p.id === playerId)?.status;
    const myQueuePos = board?.waitingPlayers.findIndex((p) => p.id === playerId);
    const myMatch = board?.activeMatches.find(
      (m) =>
        m.team_a_p1 === playerId ||
        m.team_a_p2 === playerId ||
        m.team_b_p1 === playerId ||
        m.team_b_p2 === playerId
    );

    if (!board) {
      return (
        <main className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-green-400 text-xl font-bold">Loading…</div>
        </main>
      );
    }

    // Reset loss report state when player goes back to waiting
    if (myStatus === "waiting" && reportedLoss) {
      setReportedLoss(false);
    }

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-black text-white">{sessionName}</h1>
            <p className="text-gray-400 text-sm mt-1">
              Playing as <span className="text-green-400 font-bold">{player?.name}</span>
            </p>
          </div>

          {myStatus === "playing" && myMatch ? (
            <div className="bg-green-500/10 border border-green-500 rounded-2xl p-6 text-center">
              <Trophy className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-black text-xl">YOU'RE ON COURT!</p>
              <p className="text-white text-lg font-bold mt-1">Court {myMatch.court_number}</p>
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

              <div className="mt-5 pt-4 border-t border-green-500/20">
                {reportedLoss ? (
                  <div className="text-yellow-400 text-sm font-semibold animate-pulse">
                    ⏳ Waiting for your partner to confirm…
                  </div>
                ) : (
                  <button
                    onClick={() => handleReportLoss(myMatch.id)}
                    disabled={lossLoading}
                    className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    {lossLoading ? "Reporting…" : "We Lost"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500 rounded-2xl p-6 text-center">
              <Clock className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <p className="text-yellow-400 font-black text-xl">IN THE QUEUE</p>
              {myQueuePos !== undefined && myQueuePos >= 0 && (
                <p className="text-white text-4xl font-black mt-2">#{myQueuePos + 1}</p>
              )}
              <p className="text-gray-400 text-sm mt-2">Hang tight — you'll be called up soon</p>
            </div>
          )}

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

          {/* Recovery code reminder */}
          {player?.password && (
            <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Recovery: <span className="text-gray-300 font-mono tracking-wider">{player.password}</span></span>
              </div>
              <button onClick={copyPassword} className="text-gray-600 hover:text-gray-300 transition-colors">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Join forms (new / returning) ────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white">{sessionName || "Join Session"}</h1>
          <p className="text-gray-400 text-sm mt-2">Enter the queue for pickleball</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-900 rounded-xl p-1 mb-4 border border-gray-800">
          <button
            onClick={() => { setPageState("new"); setError(""); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              pageState === "new"
                ? "bg-green-500 text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            New Player
          </button>
          <button
            onClick={() => { setPageState("returning"); setError(""); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              pageState === "returning"
                ? "bg-yellow-500 text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Rejoin
          </button>
        </div>

        {pageState === "new" ? (
          <form
            onSubmit={handleJoin}
            className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800"
          >
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Your Name</label>
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
            {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>}
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
        ) : (
          <form
            onSubmit={handleRejoin}
            className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800"
          >
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Recovery Code
              </label>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="e.g. A3X9K2M7P1"
                maxLength={10}
                autoFocus
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-xl text-center font-black tracking-[0.2em]"
              />
              <p className="text-gray-600 text-xs mt-2 text-center">
                Enter the 10-character code you saved when you first joined
              </p>
            </div>
            {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>}
            <button
              type="submit"
              disabled={loading || recoveryCode.trim().length < 10}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-base"
            >
              {loading ? (
                <span className="animate-pulse">Checking…</span>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Rejoin Queue
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-gray-700 text-xs mt-4">Session: {slug}</p>
      </div>
    </main>
  );
}
