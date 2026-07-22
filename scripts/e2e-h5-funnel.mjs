/**
 * E2E H5 funnel (D024 polish):
 * login admin → GET /api/funnel/h5 → conversão + contagens.
 * Uso: node scripts/e2e-h5-funnel.mjs [BASE_URL]
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

console.log(`E2E H5 funnel @ ${BASE}`);

const noAuth = await fetch(`${BASE}/api/funnel/h5`);
assert(noAuth.status === 401, `GET h5 sem token esperado 401, veio ${noAuth.status}`);
console.log("0) GET h5 sem token → 401");

const login = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email: "admin@fabmakers.com.br",
    password: "admin123",
    role: "ADMIN",
  }),
});
assert(login.adminToken, "adminToken ausente");
const auth = { Authorization: `Bearer ${login.adminToken}` };
console.log("1) login admin ok");

const data = await req("/api/funnel/h5", { headers: auth });
assert(data.success && data.funnel, "funnel ausente");
assert(typeof data.funnel.started === "number", "started inválido");
assert(typeof data.funnel.homologated === "number", "homologated inválido");
assert(typeof data.funnel.conversionPct === "number", "conversionPct inválido");
assert(data.hypothesis === "H5", "hypothesis ≠ H5");
console.log(
  `2) funil — início ${data.funnel.started} · homologados ${data.funnel.homologated} · conv ${data.funnel.conversionPct}%`
);
assert(Array.isArray(data.recent), "recent ausente");
console.log(`3) recent makers: ${data.recent.length}`);

console.log("PASS — H5 funnel admin");
