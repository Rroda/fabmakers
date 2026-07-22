/**
 * E2E L2 Técnicos / H7 (D023):
 * maker abre chamado → tech lista OPEN → claim → DONE.
 * Uso: node scripts/e2e-tech-job.mjs [BASE_URL]
 */
const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log(`E2E tech maintenance @ ${BASE}`);

const noAuth = await fetch(`${BASE}/api/tech/requests`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "x", description: "y" }),
});
assert(noAuth.status === 401, `POST sem token esperado 401, veio ${noAuth.status}`);
console.log("0) POST sem token → 401");

const makerLogin = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "roda@fabmakers.com.br", password: "123", role: "MAKER" }),
});
assert(makerLogin.makerToken, "makerToken ausente");
const makerAuth = { Authorization: `Bearer ${makerLogin.makerToken}` };

const created = await req("/api/tech/requests", {
  method: "POST",
  headers: makerAuth,
  body: JSON.stringify({
    title: "Extrusora entupida",
    description: "E2E H7 — preciso de técnico",
    zipCode: "01310-100",
    machineBrand: "Bambu Lab",
    machineModel: "P1S",
  }),
});
assert(created.success && created.request?.id, "create request falhou");
const requestId = created.request.id;
console.log(`1) maker abriu chamado #${requestId}`);

const techLogin = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "tech@fabmakers.com.br", password: "123", role: "TECH" }),
});
assert(techLogin.techToken, "techToken ausente");
const techAuth = { Authorization: `Bearer ${techLogin.techToken}` };
console.log("2) login tech ok");

const openList = await req("/api/tech/requests?filter=open", { headers: techAuth });
assert(
  (openList.requests || []).some((r) => r.id === requestId),
  "chamado não apareceu em OPEN"
);
console.log("3) fila OPEN ok");

const claimed = await req("/api/tech/requests", {
  method: "PATCH",
  headers: techAuth,
  body: JSON.stringify({ action: "claim", requestId }),
});
assert(claimed.request?.status === "CLAIMED", "claim falhou");
console.log("4) claim → CLAIMED");

const done = await req("/api/tech/requests", {
  method: "PATCH",
  headers: techAuth,
  body: JSON.stringify({ action: "done", requestId }),
});
assert(done.request?.status === "DONE", "done falhou");
console.log("5) DONE");

console.log("PASS — L2 manutenção maker→tech→done");
