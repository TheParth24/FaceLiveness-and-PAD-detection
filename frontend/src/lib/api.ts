export const API_BASE = "http://127.0.0.1:8000";
export const WS_BASE = "ws://127.0.0.1:8000";

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  role: "admin" | "supervisor" | "operator";
  is_active?: number;
  created_at: string;
  last_login?: string;
}

export interface BiometricTelemetry {
  session_id: string;
  face_detected: boolean;
  bbox: [number, number, number, number] | null;
  identity: {
    status: string;
    similarity: number;
    threshold: number;
  };
  pad: {
    score: number;
    label: "REAL" | "SPOOF" | "WAITING";
    threshold: number;
  };
  passive: {
    frames: number;
    max_frames: number;
    ready: boolean;
    motion: number;
    flow: number;
    geometry: number;
    texture: number;
    consistency: number;
  };
  active_challenge: {
    challenge: string;
    passed: boolean;
    status: string;
    progress: string;
    metrics?: Record<string, number>;
  };
  final_decision: "LIVE_VERIFIED" | "CHECK_IN_PROGRESS" | "SPOOF_DETECTED" | "IDENTITY_MISMATCH" | "USER_NOT_REGISTERED" | "READY_TO_REGISTER";
  error?: string;
}

export interface AuditLogItem {
  id: number;
  timestamp: string;
  role: string;
  username: string;
  event_type: string;
  details: string;
  ip_address: string;
}

export interface RegisteredProfilesResponse {
  residents: Array<{ name: string; registered_at: string }>;
  operators: Array<{ name: string; registered_at: string }>;
  supervisors: Array<{ name: string; registered_at: string }>;
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.detail || err.message || msg;
    } catch {
      // noop
    }
    throw new Error(msg);
  }

  return res.json();
}

export const api = {
  // Health
  getHealth: () => fetchJson<{ status: string; models_loaded: boolean; engine: string }>("/api/health"),

  // Auth
  login: (username: string, password: string) =>
    fetchJson<{ success: boolean; token: string; username: string; role: string; full_name: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }
    ),

  logout: () => fetchJson<{ success: boolean }>("/api/auth/logout", { method: "POST" }),

  getMe: () => fetchJson<UserProfile>("/api/auth/me"),

  // Biometrics
  startSession: (mode: "verify" | "register", role: "resident" | "operator" | "supervisor", name: string, challenge?: string) =>
    fetchJson<{
      success: boolean;
      session_id: string;
      mode: string;
      role: string;
      name: string;
      challenge: string;
      user_exists?: boolean;
    }>("/api/biometrics/session/start", {
      method: "POST",
      body: JSON.stringify({ mode, role, name, challenge }),
    }),

  nextChallenge: (sessionId: string) =>
    fetchJson<{ success: boolean; session_id: string; challenge: string }>(
      `/api/biometrics/session/${sessionId}/challenge/next`,
      { method: "POST" }
    ),

  completeRegistration: (sessionId: string) =>
    fetchJson<{ success: boolean; name: string; role: string; message: string }>(
      `/api/biometrics/session/${sessionId}/complete-registration`,
      { method: "POST" }
    ),

  closeSession: (sessionId: string) =>
    fetchJson<{ success: boolean }>(`/api/biometrics/session/${sessionId}/close`, { method: "POST" }),

  getProfiles: () => fetchJson<RegisteredProfilesResponse>("/api/biometrics/profiles"),

  // Admin
  getUsers: () => fetchJson<UserProfile[]>("/api/admin/users"),

  createUser: (data: { username: string; password: string; full_name: string; role: string }) =>
    fetchJson<{ success: boolean; message: string }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  toggleUserStatus: (userId: number) =>
    fetchJson<{ success: boolean; is_active: number }>(`/api/admin/users/${userId}/toggle`, {
      method: "PUT",
    }),

  getAuditLogs: (limit = 100, role?: string) => {
    const q = new URLSearchParams({ limit: limit.toString() });
    if (role) q.set("role", role);
    return fetchJson<AuditLogItem[]>(`/api/admin/audit-logs?${q.toString()}`);
  },
};
