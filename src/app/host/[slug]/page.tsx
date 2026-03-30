"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Play,
  StopCircle,
  Users,
  Trophy,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
  Trash2,
  Loader2,
  Frown,
  AlertTriangle,
  KeyRound,
  ArrowLeftRight,
  Shuffle,
} from "lucide-react";
import type { BoardData, MatchWithPlayers, Player } from "@/types";
import { ROTATION_LABELS } from "@/types";

type RevealPhase = "reveal" | "spinner";
interface RevealState {
  match: MatchWithPlayers;
  phase: RevealPhase;
}

interface SwitchModal {
  matchId: number;
  outPlayerId: number;
  outPlayerName: string;
}

interface PlayerSlot {
  id: number;
  name: string;
}

interface TeamSetupModal {
  matchId: number;
  // indices 0,1 = Team A; indices 2,3 = Team B
  arrangement: [PlayerSlot, PlayerSlot, PlayerSlot, PlayerSlot];
  selectedIdx: number | null;
}

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
  const router = useRouter();
  const slug = params.slug as string;
  const [board, setBoard] = useState<BoardData | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHostCode, setCopiedHostCode] = useState(false);
  const [endModal, setEndModal] = useState<EndMatchModal | null>(null);
  const [endingMatch, setEndingMatch] = useState(false);
  const [showEndSession, setShowEndSession] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [reveals, setReveals] = useState<Record<number, RevealState>>({});
  const seenEndedIds = useRef<Set<number>>(new Set());
  const firstLoad = useRef(true);
  const [origin, setOrigin] = useState("");
  const [idleSeconds, setIdleSeconds] = useState<number | null>(null);
  const [hostCode, setHostCode] = useState<string | null>(null);

  // Switch player state
  const [switchModal, setSwitchModal] = useState<SwitchModal | null>(null);
  const [switching, setSwitching] = useState(false);

  // Delete player state
  const [deletingPlayerId, setDeletingPlayerId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Team setup state
  const [teamSetupModal, setTeamSetupModal] = useState<TeamSetupModal | null>(null);
  const [savingTeams, setSavingTeams] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const code = localStorage.getItem(`hst_${slug}`);
    if (code) setHostCode(code);
  }, [slug]);

  const fetchBoard = useCallback(async () => {
    const res = await fetch(`/api/sessions/${slug}/board`);
    if (!res.ok) return;
    const data = (await res.json()) as BoardData;
    setBoard(data);
    setSessionStarted(data.session.is_active === 1);

    if (firstLoad.current) {
      firstLoad.current = false;
      data.recentlyEnded.forEach((m) => seenEndedIds.current.add(m.id));
      return;
    }

    data.recentlyEnded.forEach((match) => {
      if (seenEndedIds.current.has(match.id)) return;
      seenEndedIds.current.add(match.id);

      setReveals((prev) => ({ ...prev, [match.court_number]: { match, phase: "reveal" } }));

      setTimeout(() => {
        setReveals((prev) => ({
          ...prev,
          [match.court_number]: { match, phase: "spinner" },
        }));
      }, 4000);

      setTimeout(() => {
        setReveals((prev) => {
          const next = { ...prev };
          delete next[match.court_number];
          return next;
        });
      }, 6500);
    });
  }, [slug]);

  useEffect(() => {
    fetchBoard();
    const id = setInterval(fetchBoard, 5000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  useEffect(() => {
    if (!board?.session.is_active || !board.session.last_match_at) return;
    const lastMatchAt = board.session.last_match_at;
    const tick = () => setIdleSeconds(Math.floor(Date.now() / 1000) - lastMatchAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [board?.session.last_match_at, board?.session.is_active]);

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

  function handleCopyHostCode() {
    if (!hostCode) return;
    navigator.clipboard.writeText(hostCode).catch(() => {});
    setCopiedHostCode(true);
    setTimeout(() => setCopiedHostCode(false), 2000);
  }

  async function handleEndSession() {
    setEndingSession(true);
    try {
      await fetch(`/api/sessions/${slug}`, { method: "DELETE" });
      router.push("/");
    } catch {
      setEndingSession(false);
      setShowEndSession(false);
    }
  }

  async function handleSwitchPlayer(inPlayerId: number) {
    if (!switchModal) return;
    setSwitching(true);
    await fetch(`/api/sessions/${slug}/switch-player`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: switchModal.matchId,
        out_player_id: switchModal.outPlayerId,
        in_player_id: inPlayerId,
      }),
    });
    setSwitchModal(null);
    setSwitching(false);
    await fetchBoard();
  }

  async function handleDeletePlayer(playerId: number) {
    if (confirmDeleteId !== playerId) {
      setConfirmDeleteId(playerId);
      return;
    }
    setDeletingPlayerId(playerId);
    setConfirmDeleteId(null);
    await fetch(`/api/sessions/${slug}/players/${playerId}`, { method: "DELETE" });
    setDeletingPlayerId(null);
    await fetchBoard();
  }

  function openTeamSetup(match: MatchWithPlayers) {
    setTeamSetupModal({
      matchId: match.id,
      arrangement: [
        { id: match.team_a_p1, name: match.team_a_p1_name },
        { id: match.team_a_p2, name: match.team_a_p2_name },
        { id: match.team_b_p1, name: match.team_b_p1_name },
        { id: match.team_b_p2, name: match.team_b_p2_name },
      ],
      selectedIdx: null,
    });
  }

  function handleTeamSlotTap(idx: number) {
    if (!teamSetupModal) return;
    const { selectedIdx, arrangement } = teamSetupModal;
    if (selectedIdx === null) {
      setTeamSetupModal({ ...teamSetupModal, selectedIdx: idx });
    } else if (selectedIdx === idx) {
      setTeamSetupModal({ ...teamSetupModal, selectedIdx: null });
    } else {
      // Swap the two players
      const next = [...arrangement] as TeamSetupModal["arrangement"];
      [next[selectedIdx], next[idx]] = [next[idx], next[selectedIdx]];
      setTeamSetupModal({ ...teamSetupModal, arrangement: next, selectedIdx: null });
    }
  }

  async function handleSaveTeams() {
    if (!teamSetupModal) return;
    setSavingTeams(true);
    const { matchId, arrangement } = teamSetupModal;
    await fetch(`/api/sessions/${slug}/set-teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: matchId,
        team_a_p1: arrangement[0].id,
        team_a_p2: arrangement[1].id,
        team_b_p1: arrangement[2].id,
        team_b_p2: arrangement[3].id,
      }),
    });
    setTeamSetupModal(null);
    setSavingTeams(false);
    await fetchBoard();
  }

  if (!board) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse font-bold text-lg">Loading…</div>
      </main>
    );
  }

  const { session, activeMatches, waitingPlayers, allPlayers } = board;

  const activeCourts = new Set(activeMatches.map((m) => m.court_number));
  const revealCourts = new Set(Object.values(reveals).map((r) => r.match.court_number));
  const emptyCourts = sessionStarted
    ? Array.from({ length: session.num_courts }, (_, i) => i + 1).filter(
        (n) => !activeCourts.has(n) && !revealCourts.has(n)
      )
    : [];

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
          <div className="flex items-center gap-1">
            <button
              onClick={fetchBoard}
              className="text-gray-600 hover:text-gray-300 transition-colors p-2"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowEndSession(true)}
              className="text-red-500 hover:text-red-400 transition-colors p-2"
              title="End Session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Idle warning banner */}
      {sessionStarted && idleSeconds !== null && idleSeconds >= 60 * 60 && (
        <div className="mb-5 bg-yellow-500/10 border border-yellow-500/40 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-yellow-300 font-bold text-sm">No match activity in a while</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              This session will be auto-closed in{" "}
              <span className="font-mono font-bold text-yellow-300">
                {Math.floor(Math.max(0, 90 * 60 - idleSeconds) / 60)
                  .toString()
                  .padStart(2, "0")}
                :
                {(Math.max(0, 90 * 60 - idleSeconds) % 60)
                  .toString()
                  .padStart(2, "0")}
              </span>{" "}
              if no matches are played. Start a match to reset the timer.
            </p>
          </div>
        </div>
      )}

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
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mb-2"
            >
              <ExternalLink className="w-3 h-3" />
              Open Big Board
            </a>
            {hostCode && (
              <div className="flex items-center gap-2 mt-1">
                <KeyRound className="w-3 h-3 text-gray-600 flex-shrink-0" />
                <span className="text-xs text-gray-600">Host code:</span>
                <span className="text-xs font-mono font-bold text-gray-400 tracking-wider">
                  {hostCode}
                </span>
                <button
                  onClick={handleCopyHostCode}
                  className="text-gray-600 hover:text-gray-300 transition-colors"
                >
                  {copiedHostCode ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}
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
      </div>

      {/* Active Courts + Reveal Animations */}
      {(activeMatches.length > 0 || Object.keys(reveals).length > 0 || emptyCourts.length > 0) && (
        <section className="mb-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
            On Court
          </h2>
          <div className="space-y-3">
            {/* Reveal cards */}
            {Object.values(reveals).map((reveal) => {
              const idx = (reveal.match.court_number - 1) % COURT_COLORS.length;
              const isPureQueue = session.rotation_type === 1;
              const w = reveal.match.winner_team;
              const loserP1 = w === "a" ? reveal.match.team_b_p1_name : reveal.match.team_a_p1_name;
              const loserP2 = w === "a" ? reveal.match.team_b_p2_name : reveal.match.team_a_p2_name;
              const winnerP1 = w === "a" ? reveal.match.team_a_p1_name : reveal.match.team_b_p1_name;
              const winnerP2 = w === "a" ? reveal.match.team_a_p2_name : reveal.match.team_b_p2_name;
              return (
                <div
                  key={`reveal-${reveal.match.id}`}
                  className={`rounded-2xl border-2 ${COURT_COLORS[idx]} ${COURT_BG[idx]} p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black uppercase tracking-widest ${COURT_TEXT[idx]}`}>
                      Court {reveal.match.court_number}
                    </span>
                    <span className="text-xs text-gray-500 font-semibold">Match Over</span>
                  </div>

                  {reveal.phase === "reveal" ? (
                    isPureQueue ? (
                      <div className="text-center py-3">
                        <p className="text-gray-300 font-bold text-sm">All players back in queue</p>
                        <div className="flex justify-center gap-2 mt-3 flex-wrap">
                          {[reveal.match.team_a_p1_name, reveal.match.team_a_p2_name,
                            reveal.match.team_b_p1_name, reveal.match.team_b_p2_name].map((name) => (
                            <span key={name} className="bg-gray-800 text-gray-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                          <div className="flex items-center justify-center gap-1 mb-2">
                            <Frown className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">They Lost</span>
                          </div>
                          <div className="text-white font-bold text-sm">{loserP1}</div>
                          <div className="text-gray-300 text-sm">{loserP2}</div>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                          <div className="flex items-center justify-center gap-1 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Winners!</span>
                          </div>
                          <div className="text-white font-bold text-sm">{winnerP1}</div>
                          <div className="text-gray-300 text-sm">{winnerP2}</div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty court cards */}
            {emptyCourts.map((courtNum) => {
              const idx = (courtNum - 1) % COURT_COLORS.length;
              return (
                <div
                  key={`empty-${courtNum}`}
                  className={`rounded-2xl border-2 ${COURT_COLORS[idx]} ${COURT_BG[idx]} p-4`}
                >
                  <div className="mb-3">
                    <span className={`text-xs font-black uppercase tracking-widest ${COURT_TEXT[idx]}`}>
                      Court {courtNum}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-gray-400 text-sm font-medium">
                      A match just ended, gathering players in queue
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Active match cards */}
            {activeMatches.map((match) => {
              const idx = (match.court_number - 1) % COURT_COLORS.length;
              const isRevealing = !!reveals[match.court_number];
              if (isRevealing) return null;
              return (
                <div
                  key={match.id}
                  className={`rounded-2xl border-2 ${COURT_COLORS[idx]} ${COURT_BG[idx]} p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black uppercase tracking-widest ${COURT_TEXT[idx]}`}>
                      Court {match.court_number}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openTeamSetup(match)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        Set Teams
                      </button>
                      <button
                        onClick={() => setEndModal({ match })}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        End Match
                      </button>
                    </div>
                  </div>

                  {/* Team A */}
                  <div className="mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400/70 mb-1 px-1">Team A</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: match.team_a_p1, name: match.team_a_p1_name },
                        { id: match.team_a_p2, name: match.team_a_p2_name },
                      ].map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() =>
                            setSwitchModal({
                              matchId: match.id,
                              outPlayerId: slot.id,
                              outPlayerName: slot.name,
                            })
                          }
                          className="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-xl px-3 py-2.5 text-center group transition-all relative"
                          title={`Swap ${slot.name}`}
                        >
                          <span className="text-white font-bold text-sm">{slot.name}</span>
                          <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowLeftRight className="w-3 h-3 text-gray-500" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Team B */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/70 mb-1 px-1">Team B</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: match.team_b_p1, name: match.team_b_p1_name },
                        { id: match.team_b_p2, name: match.team_b_p2_name },
                      ].map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() =>
                            setSwitchModal({
                              matchId: match.id,
                              outPlayerId: slot.id,
                              outPlayerName: slot.name,
                            })
                          }
                          className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl px-3 py-2.5 text-center group transition-all relative"
                          title={`Swap ${slot.name}`}
                        >
                          <span className="text-white font-bold text-sm">{slot.name}</span>
                          <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowLeftRight className="w-3 h-3 text-gray-500" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-center mt-2">
                    <span className="text-gray-700 text-xs">Tap a player to swap from queue</span>
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
            {waitingPlayers.map((p: Player, i: number) => (
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
                <span className="text-sm font-semibold text-white flex-1">{p.name}</span>
                {i < 4 && (
                  <span className="text-[10px] text-green-400 font-bold uppercase tracking-wide">
                    Next Up
                  </span>
                )}
                {/* Delete player button */}
                {deletingPlayerId === p.id ? (
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin flex-shrink-0" />
                ) : confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDeletePlayer(p.id)}
                      className="text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold px-2 py-1 rounded-lg transition-all"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-gray-600 hover:text-gray-300 p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDeletePlayer(p.id)}
                    className="text-gray-700 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
            allPlayers.map((p: Player) => (
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

      {/* End Session Modal */}
      {showEndSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-red-500/40 w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-white text-lg">End Session?</h3>
              <button
                onClick={() => setShowEndSession(false)}
                className="text-gray-600 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              This will <span className="text-red-400 font-semibold">permanently delete</span> the
              session, all players, and all match history. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndSession(false)}
                disabled={endingSession}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                disabled={endingSession}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {endingSession ? "Ending…" : "End & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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

            {session.rotation_type === 3 ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">Everyone goes back to queue after this match.</p>
                <button
                  onClick={() => handleEndMatch(null)}
                  disabled={endingMatch}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-4 rounded-xl transition-all"
                >
                  End Match
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm mb-1">Who won?</p>
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
            )}

            {endingMatch && (
              <p className="text-center text-gray-500 text-sm mt-4 animate-pulse">
                Rotating…
              </p>
            )}
          </div>
        </div>
      )}

      {/* Team Setup Modal */}
      {teamSetupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-white text-lg">Set Teams</h3>
              <button
                onClick={() => setTeamSetupModal(null)}
                className="text-gray-600 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-xs mb-5">
              Tap two players to swap them between teams. Team A wins or Team B wins will reflect this lineup.
            </p>

            {/* Team A */}
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2">Team A</p>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((i) => {
                  const slot = teamSetupModal.arrangement[i];
                  const isSelected = teamSetupModal.selectedIdx === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleTeamSlotTap(i)}
                      className={`rounded-xl px-3 py-3 text-center font-bold text-sm transition-all border-2 ${
                        isSelected
                          ? "border-yellow-400 bg-yellow-400/20 text-yellow-300 scale-95"
                          : "border-yellow-500/30 bg-yellow-500/10 text-white hover:bg-yellow-500/20"
                      }`}
                    >
                      {slot.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-600 text-xs font-bold">vs</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* Team B */}
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Team B</p>
              <div className="grid grid-cols-2 gap-2">
                {[2, 3].map((i) => {
                  const slot = teamSetupModal.arrangement[i];
                  const isSelected = teamSetupModal.selectedIdx === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleTeamSlotTap(i)}
                      className={`rounded-xl px-3 py-3 text-center font-bold text-sm transition-all border-2 ${
                        isSelected
                          ? "border-blue-400 bg-blue-400/20 text-blue-300 scale-95"
                          : "border-blue-500/30 bg-blue-500/10 text-white hover:bg-blue-500/20"
                      }`}
                    >
                      {slot.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setTeamSetupModal(null)}
                disabled={savingTeams}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTeams}
                disabled={savingTeams}
                className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                {savingTeams ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {savingTeams ? "Saving…" : "Save Teams"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Player Modal */}
      {switchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-white text-lg">Switch Player</h3>
              <button
                onClick={() => setSwitchModal(null)}
                className="text-gray-600 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-5">
              Replace{" "}
              <span className="text-white font-bold">{switchModal.outPlayerName}</span>{" "}
              with someone from the queue.
            </p>

            {waitingPlayers.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-sm">
                No players in queue to swap in.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {waitingPlayers.map((p: Player, i: number) => (
                  <button
                    key={p.id}
                    onClick={() => handleSwitchPlayer(p.id)}
                    disabled={switching}
                    className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl px-4 py-3 text-left transition-all"
                  >
                    <span
                      className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        i < 4 ? "bg-green-500 text-black" : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-white">{p.name}</span>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-gray-600 ml-auto" />
                  </button>
                ))}
              </div>
            )}

            {switching && (
              <p className="text-center text-gray-500 text-sm mt-4 animate-pulse">
                Switching…
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
