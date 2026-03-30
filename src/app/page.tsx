"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, X, Copy, Check, KeyRound, RefreshCw } from "lucide-react";

const GCASH_NUMBER = "09279779220";

const ROTATION_OPTIONS = [
  {
    value: 1,
    label: "Pure Queue",
    desc: "4 finish → next 4 from queue replace them",
  },
  {
    value: 2,
    label: "Win vs Win & Lose vs Lose",
    desc: "Everyone rests — winners queue up against winners, losers against losers",
  },
  {
    value: 3,
    label: "Social Split",
    desc: "Everyone rests — next 4 from queue play, partners are mixed (1st+3rd vs 2nd+4th)",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [numCourts, setNumCourts] = useState(2);
  const [rotationType, setRotationType] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [atCapacity, setAtCapacity] = useState(false);
  const [activeSessions, setActiveSessions] = useState(0);
  const [showCoffee, setShowCoffee] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState("");

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!recoverCode.trim()) return;
    setRecoverLoading(true);
    setRecoverError("");
    try {
      const res = await fetch("/api/sessions/host-recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host_password: recoverCode.trim().toUpperCase() }),
      });
      const data = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Code not found");
      localStorage.setItem(`hst_${data.slug!}`, recoverCode.trim().toUpperCase());
      router.push(`/host/${data.slug}`);
    } catch (err) {
      setRecoverError(err instanceof Error ? err.message : "Something went wrong");
      setRecoverLoading(false);
    }
  }

  function handleCopyNumber() {
    navigator.clipboard.writeText(GCASH_NUMBER).then(() => {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2000);
    });
  }

  useEffect(() => {
    const id = setInterval(() => setShowCoffee(true), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        const d = data as { at_capacity: boolean; active_sessions: number };
        setAtCapacity(d.at_capacity);
        setActiveSessions(d.active_sessions);
      })
      .catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: groupName.trim(),
          num_courts: numCourts,
          rotation_type: rotationType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          (data as { error?: string }).error ?? "Failed to create session",
        );
      }

      const data = (await res.json()) as { slug: string; host_password: string };
      if (data.host_password) {
        localStorage.setItem(`hst_${data.slug}`, data.host_password);
      }
      router.push(`/host/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 mb-4"></div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Dink<span className="text-green-400">&</span>Done
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Zero-hassle pickleball queue management
          </p>
        </div>

        {atCapacity ? (
          <div className="bg-gray-900 rounded-2xl p-6 border border-yellow-500/40 text-center space-y-3">
            <div className="text-yellow-400 text-3xl font-black">10 / 10</div>
            <p className="text-white font-bold">Server is at capacity</p>
            <p className="text-gray-400 text-sm">
              All {activeSessions} session slots are currently in use. Sessions
              auto-close after 90 minutes of inactivity. Check back soon.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleCreate}
            className="bg-gray-900 rounded-2xl p-6 space-y-6 border border-gray-800"
          >
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Group / Session Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Tuesday Night Picklers"
                maxLength={60}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Number of Courts
              </label>
              <div className="flex flex-auto gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Custom"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) setNumCourts(val);
                  }}
                  className="w-20 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumCourts(n)}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      numCourts === n
                        ? "bg-green-500 text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Rotation Type
              </label>
              <div className="space-y-2">
                {ROTATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRotationType(opt.value)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      rotationType === opt.value
                        ? "border-green-500 bg-green-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                          rotationType === opt.value
                            ? "border-green-500 bg-green-500"
                            : "border-gray-600"
                        }`}
                      />
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {opt.label}
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">
                          {opt.desc}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !groupName.trim()}
              className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-base"
            >
              {loading ? (
                <span className="animate-pulse">Creating…</span>
              ) : (
                <>
                  Create Session <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Recover host session */}
        <div className="mt-4">
          {!showRecover ? (
            <div className="text-center">
              <button
                onClick={() => setShowRecover(true)}
                className="text-gray-600 hover:text-gray-400 text-xs transition-colors inline-flex items-center gap-1.5"
              >
                <KeyRound className="w-3 h-3" />
                Recover host session
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleRecover}
              className="bg-gray-900 rounded-2xl p-4 space-y-3 border border-gray-800"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Enter Host Recovery Code
                </p>
                <button
                  type="button"
                  onClick={() => { setShowRecover(false); setRecoverCode(""); setRecoverError(""); }}
                  className="text-gray-600 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={recoverCode}
                onChange={(e) => setRecoverCode(e.target.value.toUpperCase())}
                placeholder="e.g. A3X9K2M7P1"
                maxLength={10}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-center font-black tracking-[0.2em] text-lg"
              />
              {recoverError && (
                <p className="text-red-400 text-xs bg-red-500/10 rounded-lg p-2 text-center">{recoverError}</p>
              )}
              <button
                type="submit"
                disabled={recoverLoading || recoverCode.trim().length < 10}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
              >
                {recoverLoading ? (
                  <span className="animate-pulse">Looking up…</span>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Recover Session
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Buy me a coffee button */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowCoffee(true)}
            className="text-gray-600 hover:text-gray-400 text-xs transition-colors inline-flex items-center gap-1.5"
          >
            ☕ Buy me a coffee
          </button>
        </div>
      </div>

      {/* Coffee Modal */}
      {showCoffee && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-amber-800/40 bg-gray-950 overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-amber-950 to-gray-950 px-6 pt-8 pb-6 text-center border-b border-amber-900/30">
              <button
                onClick={() => setShowCoffee(false)}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-5xl mb-3">☕</div>
              <h2 className="text-white font-black text-xl">Buy me a coffee!</h2>
              <p className="text-amber-400/70 text-sm mt-1 font-medium">
                If this helped your session, I appreciate it!
              </p>
            </div>

            {/* GCash number */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest text-center">
                GCash Number
              </p>
              <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
                <span className="flex-1 text-white font-black text-2xl tracking-widest text-center">
                  {GCASH_NUMBER}
                </span>
                <button
                  onClick={handleCopyNumber}
                  className={`flex-shrink-0 p-2 rounded-xl transition-all ${
                    copiedNumber
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  {copiedNumber ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              {copiedNumber && (
                <p className="text-green-400 text-xs text-center font-semibold">
                  Copied to clipboard!
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 text-center">
              <p className="text-gray-700 text-[11px] italic">
                pang starbucks matcha latte hot grande lang ✨
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
