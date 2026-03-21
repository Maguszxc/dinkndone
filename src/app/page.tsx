"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pickaxe } from "lucide-react";

const ROTATION_OPTIONS = [
  {
    value: 1,
    label: "Pure Queue",
    desc: "4 finish → next 4 from queue replace them",
  },
  {
    value: 2,
    label: "Winners Stay",
    desc: "Winners stay on court; 2 new challengers join",
  },
  {
    value: 3,
    label: "Social Split",
    desc: "Winners stay but split partners; 2 new join",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [numCourts, setNumCourts] = useState(2);
  const [rotationType, setRotationType] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        throw new Error((data as { error?: string }).error ?? "Failed to create session");
      }

      const data = (await res.json()) as { slug: string };
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 mb-4">
            <Pickaxe className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Pickle<span className="text-green-400">hoster</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Zero-hassle pickleball queue management
          </p>
        </div>

        {/* Form */}
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
            <div className="flex gap-2">
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
      </div>
    </main>
  );
}
