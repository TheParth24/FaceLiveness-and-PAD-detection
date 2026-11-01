"use client";

import { useState, useEffect } from "react";
import { Activity, ShieldAlert, Users, Clock, RefreshCw, Filter, Shield } from "lucide-react";
import { api, AuditLogItem, RegisteredProfilesResponse } from "@/lib/api";
import CameraWorkspace from "@/components/camera/CameraWorkspace";

export default function SupervisorDashboardPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [profiles, setProfiles] = useState<RegisteredProfilesResponse | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [authRequired, setAuthRequired] = useState<boolean>(false);

  // Supervisor self-biometric check state
  const [supervisorName, setSupervisorName] = useState<string>("Supervisor");
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    mode: "verify" | "register";
    role: string;
    name: string;
    challenge: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setAuthRequired(false);
    try {
      const [logData, profileData] = await Promise.all([
        api.getAuditLogs(100, roleFilter || undefined),
        api.getProfiles(),
      ]);
      setLogs(logData);
      setProfiles(profileData);
    } catch (err: unknown) {
      const error = err as Error;
      if (
        error.message?.includes("Authentication session required") ||
        error.message?.includes("401") ||
        error.message?.includes("credentials")
      ) {
        setAuthRequired(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roleFilter]);

  const handleStartSupervisorAuth = async () => {
    try {
      const res = await api.startSession("verify", "supervisor", supervisorName.trim() || "Supervisor");
      setActiveSession({
        sessionId: res.session_id,
        mode: "verify",
        role: "supervisor",
        name: supervisorName.trim() || "Supervisor",
        challenge: res.challenge,
      });
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Error starting session: ${error.message}`);
    }
  };

  const totalResidents = profiles?.residents?.length || 0;
  const totalOperators = profiles?.operators?.length || 0;
  const totalSupervisors = profiles?.supervisors?.length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#176B68]">
            Supervisor Workspace • Tier 2
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Operational Monitoring & Telemetry
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time audit trail, security events, and supervisor authentication.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#176B68]" : ""}`} />
          Refresh Activity Logs
        </button>
      </div>

      {authRequired && (
        <div className="mb-8 p-5 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Supervisor Authentication Required</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Audit logs and telemetry require an active Supervisor or Administrator session.
              </p>
            </div>
          </div>
          <a
            href="/login?role=supervisor&redirect=/supervisor"
            className="px-4 py-2 bg-[#176B68] hover:bg-[#0f4b49] text-white text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap transition-colors"
          >
            Sign In with Supervisor Account
          </a>
        </div>
      )}

      {activeSession ? (
        <div className="mb-8">
          <CameraWorkspace
            sessionId={activeSession.sessionId}
            mode={activeSession.mode}
            role={activeSession.role}
            name={activeSession.name}
            initialChallenge={activeSession.challenge}
            onSuccess={() => setActiveSession(null)}
            onCancel={() => setActiveSession(null)}
          />
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Enrolled Residents
            </span>
            <Users className="w-5 h-5 text-[#176B68]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalResidents}</div>
          <span className="text-[11px] text-slate-400">Total resident database records</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Operators Onboarded
            </span>
            <Shield className="w-5 h-5 text-[#176B68]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalOperators}</div>
          <span className="text-[11px] text-slate-400">Authorized enrollment staff</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Audit Events Captured
            </span>
            <Activity className="w-5 h-5 text-[#D6B77A]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{logs.length}</div>
          <span className="text-[11px] text-slate-400">Recent logged operations</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Supervisor Check
            </span>
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
          </div>
          <button
            onClick={handleStartSupervisorAuth}
            className="mt-2 w-full py-1.5 px-3 bg-[#f0f7f6] hover:bg-[#176B68] text-[#176B68] hover:text-white border border-[#9ec5c3] rounded-lg text-xs font-bold transition-colors"
          >
            Authenticate Face
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#176B68]" />
            <h3 className="text-sm font-bold text-slate-900">Operational Audit Trail</h3>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#176B68]"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="OPERATOR">Operator</option>
              <option value="RESIDENT">Resident</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">User / Actor</th>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Event Details</th>
                <th className="px-6 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : log.role === "SUPERVISOR"
                            ? "bg-blue-100 text-blue-800"
                            : log.role === "OPERATOR"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {log.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-800">{log.username}</td>
                    <td className="px-6 py-3 text-slate-700 font-bold">{log.event_type}</td>
                    <td className="px-6 py-3 font-sans text-slate-600 max-w-md truncate">
                      {log.details || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-400 whitespace-nowrap">{log.ip_address}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-sans">
                    {loading ? "Loading audit events..." : "No audit events found matching the filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
