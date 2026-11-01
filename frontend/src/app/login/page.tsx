"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      // Role-aware redirection
      if (res.role === "admin") {
        router.push("/admin");
      } else if (res.role === "supervisor") {
        router.push("/supervisor");
      } else if (res.role === "operator") {
        router.push("/operator");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  const fillQuickCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-50" suppressHydrationWarning>
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8" suppressHydrationWarning>
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#176B68] text-white flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff Sign In</h1>
          <p className="text-xs text-slate-500 mt-1">
            Access Operator, Supervisor, or Administrative workspaces
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="block w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#176B68] focus:border-[#176B68] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="block w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#176B68] focus:border-[#176B68] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#176B68] hover:bg-[#0f4b49] text-white font-bold text-sm rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In to Platform"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Quick Demo Credentials Seed */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2 text-center">
            Development Quick Credentials
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillQuickCredentials("admin", "Admin@123")}
              className="py-1.5 px-2 bg-slate-50 hover:bg-[#f0f7f6] hover:text-[#176B68] border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials("supervisor", "Supervisor@123")}
              className="py-1.5 px-2 bg-slate-50 hover:bg-[#f0f7f6] hover:text-[#176B68] border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors"
            >
              Supervisor
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials("operator", "Operator@123")}
              className="py-1.5 px-2 bg-slate-50 hover:bg-[#f0f7f6] hover:text-[#176B68] border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors"
            >
              Operator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
