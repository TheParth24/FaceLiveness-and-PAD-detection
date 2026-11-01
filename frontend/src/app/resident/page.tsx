"use client";

import { useState, useEffect } from "react";
import { User, ShieldCheck, Camera, UserPlus, RefreshCw, Users, AlertCircle } from "lucide-react";
import CameraWorkspace from "@/components/camera/CameraWorkspace";
import { api, RegisteredProfilesResponse } from "@/lib/api";

export default function ResidentPortalPage() {
  const [mode, setMode] = useState<"verify" | "register">("verify");
  const [name, setName] = useState<string>("");
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    mode: "verify" | "register";
    role: string;
    name: string;
    challenge: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<RegisteredProfilesResponse | null>(null);

  // Load existing registered resident profiles for convenience
  const loadProfiles = async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the resident name to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.startSession(mode, "resident", name.trim());
      setActiveSession({
        sessionId: res.session_id,
        mode: mode,
        role: "resident",
        name: name.trim(),
        challenge: res.challenge,
      });
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to start biometric session. Ensure the backend engine is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExistingUser = (selectedName: string) => {
    setName(selectedName);
    setMode("verify");
    setError(null);
  };

  const handleSessionClosed = () => {
    setActiveSession(null);
    loadProfiles();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" suppressHydrationWarning>
      {/* Page Heading */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-wider text-[#176B68]">
          Public Self-Service Portal
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          Resident Biometric Verification & Registration
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Perform live Presentation Attack Detection (PAD), passive 30-frame temporal analysis, and interactive action verification.
        </p>
      </div>

      {activeSession ? (
        /* Live Camera & HUD Workspace */
        <div className="space-y-4">
          <CameraWorkspace
            sessionId={activeSession.sessionId}
            mode={activeSession.mode}
            role={activeSession.role}
            name={activeSession.name}
            initialChallenge={activeSession.challenge}
            onSuccess={handleSessionClosed}
            onCancel={handleSessionClosed}
          />
        </div>
      ) : (
        /* Launch Form & Resident Profiles Directory */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Setup Card (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#176B68]" /> Start a Verification Session
            </h2>

            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl mb-6" suppressHydrationWarning>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setMode("verify");
                  setError(null);
                }}
                className={`py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === "verify"
                    ? "bg-white text-[#176B68] shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> Verify Registered Resident
              </button>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === "register"
                    ? "bg-white text-[#176B68] shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus className="w-4 h-4" /> Enroll New Resident
              </button>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleStartSession} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Resident Full Name or Identifier
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Parth"
                    required
                    className="block w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#176B68] focus:border-[#176B68] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {mode === "verify"
                    ? "Enter the exact name used during registration to match against the reference facial embedding."
                    : "A new biometric record and reference embedding will be securely created under this profile."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-slate-600">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Prerequisites for Live Evaluation:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                  <li>Allow browser webcam access when prompted.</li>
                  <li>Ensure consistent ambient lighting without severe backlighting.</li>
                  <li>Follow the assigned interactive action (Blink, Smile, or Turn Head).</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 bg-[#176B68] hover:bg-[#0f4b49] text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Initializing Biometric Engine...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" /> Open Camera & Begin Evaluation
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Enrolled Profiles List (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#176B68]" />
                <h3 className="text-sm font-bold text-slate-900">Registered Residents</h3>
              </div>
              <button
                onClick={loadProfiles}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                title="Refresh profiles"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {profiles?.residents && profiles.residents.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {profiles.residents.map((r) => (
                  <div
                    key={r.name}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-[#f0f7f6] hover:border-[#9ec5c3] transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{r.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.registered_at}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectExistingUser(r.name)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#176B68] bg-white border border-[#9ec5c3] rounded-lg group-hover:bg-[#176B68] group-hover:text-white transition-colors"
                    >
                      Verify This User
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No resident profiles enrolled yet. Use the enrollment mode above to register a resident.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
