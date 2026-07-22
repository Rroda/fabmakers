/**
 * E2E L3 canal de demanda (D022):
 * login → POST /api/channels/fulfillment → job na fila → claim.
 * Uso: node scripts/e2e-channel-job.mjs [BASE_URL]
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

console.log(`E2E channel→job @ ${BASE}`);

const noAuth = await fetch(`${BASE}/api/channels/fulfillment`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ catalogId: "fm-cable-clip" }),
});
assert(noAuth.status === 401, `esperado 401, veio ${noAuth.status}`);
console.log("0) POST canal sem token → 401");

const login = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "roda@fabmakers.com.br", password: "123", role: "MAKER" }),
});
const auth = { Authorization: `Bearer ${login.makerToken}` };

const created = await req("/api/channels/fulfillment", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    channel: "shopee",
    externalId: `sim-${Date.now()}`,
    catalogId: "fm-cable-clip",
    zipCode: "01310-100",
  }),
});
assert(created.success && created.orderId, "fulfillment não criou order");
console.log(`1) canal → fila #${created.orderId}`);

const queue = await req("/api/orders?filter=queue", { headers: auth });
assert(
  (queue.orders || []).some((o) => o.id === created.orderId),
  "pedido do canal não na fila"
);
console.log("2) fila ok");

const claimed = await req("/api/orders", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ action: "claim", orderId: created.orderId }),
});
assert(claimed.order?.status === "PRINTING", "claim falhou");
console.log("3) claim → PRINTING");

console.log("PASS — L3 canal de demanda → fila → claim");
