/** Sessão client-side — admin/maker/client/designer tokens. */

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
  clientToken?: string | null;
  designerToken?: string | null;
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
  tokens?: {
    adminToken?: string | null;
    makerToken?: string | null;
    clientToken?: string | null;
    designerToken?: string | null;
  }
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
      clientToken:
        tokens?.clientToken !== undefined ? tokens.clientToken : prev?.clientToken ?? null,
      designerToken:
        tokens?.designerToken !== undefined
          ? tokens.designerToken
          : prev?.designerToken ?? null,
    } satisfies StoredSession)
  );
}

export function getAdminToken(): string | null {
  return loadSession()?.adminToken || null;
}

export function getMakerToken(): string | null {
  return loadSession()?.makerToken || null;
}

export function getClientToken(): string | null {
  return loadSession()?.clientToken || null;
}

export function getDesignerToken(): string | null {
  return loadSession()?.designerToken || null;
}

export function adminAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function makerAuthHeaders(): HeadersInit {
  const token = getMakerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function designerAuthHeaders(): HeadersInit {
  const token = getDesignerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Headers para POST/GET orders: maker → admin → client. */
export function orderAuthHeaders(): HeadersInit {
  const token = getMakerToken() || getAdminToken() || getClientToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
