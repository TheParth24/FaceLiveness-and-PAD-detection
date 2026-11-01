"use client";

import { useState, useEffect } from "react";
import { UserCheck, UserPlus, Users, Shield, RefreshCw, AlertCircle, Camera } from "lucide-react";
import CameraWorkspace from "@/components/camera/CameraWorkspace";
import { api, RegisteredProfilesResponse } from "@/lib/api";

export default function OperatorDashboardPage() {
  const [selectedRole, setSelectedRole] = useState<"resident" | "operator">("resident");
  const [mode, setMode] = useState<"verify" | "register">("verify");
  const [subjectName, setSubjectName] = useState<string>("");
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
    if (!subjectName.trim()) {
      setError("Please specify the subject's name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.startSession(mode, selectedRole, subjectName.trim());
      setActiveSession({
        sessionId: res.session_id,
        mode: mode,
        role: selectedRole,
        name: subjectName.trim(),
        challenge: res.challenge,
      });
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to initialize verification session.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (name: string, role: "resident" | "operator") => {
    setSubjectName(name);
    setSelectedRole(role);
    setMode("verify");
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" suppressHydrationWarning>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#176B68]">
            Operator Workspace • Tier 1
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Enrollment & Verification Station
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Assisted onboarding, face verification, and operator attendance authentication.
          </p>
        </div>
      </div>

      {activeSession ? (
        <CameraWorkspace
          sessionId={activeSession.sessionId}
          mode={activeSession.mode}
          role={activeSession.role}
          name={activeSession.name}
          initialChallenge={activeSession.challenge}
          onSuccess={() => {
            setActiveSession(null);
            loadProfiles();
          }}
          onCancel={() => setActiveSession(null)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Operator Action Console (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#176B68]" /> Launch Biometric Station
            </h2>

            {/* Target Role Selector */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Subject Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("resident")}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                    selectedRole === "resident"
                      ? "bg-[#f0f7f6] text-[#176B68] border-[#9ec5c3] shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Users className="w-4 h-4" /> Resident Subject
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("operator")}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                    selectedRole === "operator"
                      ? "bg-[#f0f7f6] text-[#176B68] border-[#9ec5c3] shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Shield className="w-4 h-4" /> Operator Biometric Login
                </button>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Operation Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("verify")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                    mode === "verify"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Verification (Compare Embedding)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                    mode === "register"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Enrollment (Capture & Save)
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleStartSession} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subject Identifier / Name
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Parth"
                  required
                  className="block w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#176B68] focus:border-[#176B68]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#176B68] hover:bg-[#0f4b49] text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Preparing Session...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" /> Start Live Biometric Capture
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Records & Biometrics Directory (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#176B68]" /> Registered Operators
                </h3>
              </div>
              <div className="space-y-2">
                {profiles?.operators?.map((op) => (
                  <div
                    key={op.name}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{op.name}</div>
                      <div className="text-[10px] text-slate-400">Operator Profile</div>
                    </div>
                    <button
                      onClick={() => handleSelectUser(op.name, "operator")}
                      className="text-xs font-semibold text-[#176B68] hover:underline"
                    >
                      Verify
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#176B68]" /> Resident Records
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {profiles?.residents?.map((r) => (
                  <div
                    key={r.name}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{r.name}</div>
                      <div className="text-[10px] text-slate-400">{r.registered_at}</div>
                    </div>
                    <button
                      onClick={() => handleSelectUser(r.name, "resident")}
                      className="text-xs font-semibold text-[#176B68] hover:underline"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
