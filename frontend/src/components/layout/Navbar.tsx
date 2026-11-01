"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield, User, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { api, UserProfile } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    // Check health
    api.getHealth()
      .then((h) => setBackendHealthy(h.status === "healthy" && h.models_loaded))
      .catch(() => setBackendHealthy(false));

    // Check user profile
    api.getMe()
      .then((user) => setCurrentUser(user))
      .catch(() => setCurrentUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  const navLinks = [
    { name: "Overview", href: "/" },
    { name: "Resident Portal", href: "/resident" },
    ...(currentUser?.role === "operator" || currentUser?.role === "admin"
      ? [{ name: "Operator Workspace", href: "/operator" }]
      : []),
    ...(currentUser?.role === "supervisor" || currentUser?.role === "admin"
      ? [{ name: "Supervisor Workspace", href: "/supervisor" }]
      : []),
    ...(currentUser?.role === "admin"
      ? [{ name: "Admin Console", href: "/admin" }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-lg bg-[#176B68] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
                  FaceLiveness<span className="text-[#176B68]">PAD</span>
                </span>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-[#D6B77A]">
                  Biometric Security Platform
                </span>
              </div>
            </Link>

            {/* Backend Health Pill */}
            <div className="hidden md:flex items-center ml-4 pl-4 border-l border-slate-200">
              {backendHealthy === true ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Engine Live
                </span>
              ) : backendHealthy === false ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Backend Offline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  Connecting...
                </span>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "text-[#176B68] bg-[#f0f7f6] font-semibold border-b-2 border-[#176B68]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* User / Authentication actions */}
          <div className="flex items-center space-x-3">
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900">{currentUser.full_name}</div>
                  <div className="text-[10px] uppercase font-bold text-[#176B68] tracking-wider">
                    {currentUser.role}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
                  <User className="w-4 h-4" />
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Staff Sign In
                </Link>
                <Link
                  href="/resident"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-[#176B68] hover:bg-[#0f4b49] transition-colors shadow-sm"
                >
                  Verify Face
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
