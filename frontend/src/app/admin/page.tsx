"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  UserPlus,
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  Cpu,
  Lock,
  AlertCircle
} from "lucide-react";
import { api, UserProfile } from "@/lib/api";

export default function AdminConsolePage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [health, setHealth] = useState<{ status: string; models_loaded: boolean; engine: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New staff modal/form state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newFullName, setNewFullName] = useState<string>("");
  const [newRole, setNewRole] = useState<"operator" | "supervisor">("operator");
  const [creating, setCreating] = useState<boolean>(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userData, healthData] = await Promise.all([
        api.getUsers(),
        api.getHealth(),
      ]);
      setUsers(userData);
      setHealth(healthData);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to load admin data. Ensure you are signed in as Administrator.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleUser = async (userId: number) => {
    try {
      await api.toggleUserStatus(userId);
      loadData();
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Action failed: ${error.message}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        full_name: newFullName.trim(),
        role: newRole,
      });
      setCreateMsg(`Account for ${newUsername} created successfully.`);
      setNewUsername("");
      setNewPassword("");
      setNewFullName("");
      setShowCreateModal(false);
      loadData();
    } catch (err: unknown) {
      const error = err as Error;
      setCreateMsg(`Error: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" suppressHydrationWarning>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#176B68]">
            Administrative Console • Tier 3
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            System Administration & Identity Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage authorized staff accounts, role permissions, and biometric engine status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#176B68] hover:bg-[#0f4b49] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Create Staff Account
          </button>
          <button
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#176B68]" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-5 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Administrator Access Required</h3>
              <p className="text-xs text-slate-600 mt-0.5">{error}</p>
            </div>
          </div>
          <a
            href="/login?role=admin&redirect=/admin"
            className="px-4 py-2 bg-[#176B68] hover:bg-[#0f4b49] text-white text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap transition-colors"
          >
            Sign In with Admin Account
          </a>
        </div>
      )}

      {/* Engine Status Banner */}
      <div className="mb-8 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f0f7f6] text-[#176B68] flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              Biometric Engine Service
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> Operational
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Pipeline: {health?.engine || "MediaPipe + MiniFASNetV2 + InsightFace buffalo_l"}
            </div>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          <div>Port 8000 • WebSocket Frame Streamer • SQLite Database</div>
        </div>
      </div>

      {/* Staff Accounts Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#176B68]" />
            <h3 className="text-sm font-bold text-slate-900">Staff Account Roster</h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{users.length} Registered Accounts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created On</th>
                <th className="px-6 py-3">Last Login</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-bold text-slate-900">{u.full_name}</div>
                    <div className="font-mono text-slate-400 text-[11px]">@{u.username}</div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : u.role === "supervisor"
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    {u.is_active === 1 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                        <XCircle className="w-3.5 h-3.5" /> Deactivated
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-slate-500 font-mono">{u.created_at}</td>
                  <td className="px-6 py-3.5 text-slate-500 font-mono">{u.last_login || "Never"}</td>
                  <td className="px-6 py-3.5 text-right">
                    {u.username !== "admin" && (
                      <button
                        onClick={() => handleToggleUser(u.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          u.is_active === 1
                            ? "border-rose-300 text-rose-700 hover:bg-rose-50"
                            : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {u.is_active === 1 ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 sm:p-8 relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#176B68]" /> Create Staff Account
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Create an operator or supervisor login with cryptographic password hashing.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#176B68]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. jdoe"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#176B68]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#176B68]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "operator" | "supervisor")}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#176B68]"
                >
                  <option value="operator">Operator (Enrollment & Verification Station)</option>
                  <option value="supervisor">Supervisor (Monitoring & Audit Authority)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-[#176B68] hover:bg-[#0f4b49] text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  {creating ? "Creating..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
