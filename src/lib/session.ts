/** Sessão client-side (Layer B) — adminToken (D009) + makerToken (D011). */

export type SessionUser = {
  name: string;
  email: string;
  role: string;
  makerStatus?: string;
};

export type StoredSession = {
  user: SessionUser;
  makerProfile?: unknown;
  adminToken?: string | null;
  makerToken?: string | null;
};

const KEY = "fm_session_v1";

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.user?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(
  user: SessionUser | null,
  makerProfile?: unknown,
  tokens?: { adminToken?: string | null; makerToken?: string | null }
) {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(KEY);
    return;
  }
  const prev = loadSession();
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      user,
      makerProfile: makerProfile ?? null,
      adminToken:
        tokens?.adminToken !== undefined ? tokens.adminToken : prev?.adminToken ?? null,
      makerToken:
        tokens?.makerToken !== undefined ? tokens.makerToken : prev?.makerToken ?? null,
    } satisfies StoredSession)
  );
}

export function getAdminToken(): string | null {
  return loadSession()?.adminToken || null;
}

export function getMakerToken(): string | null {
  return loadSession()?.makerToken || null;
}

export function adminAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function makerAuthHeaders(): HeadersInit {
  const token = getMakerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
