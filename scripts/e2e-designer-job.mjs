/**
 * E2E L1 Designers (D021):
 * login designer → model seed → quote com modelId/royalty → order na fila (maker token).
 * Uso: node scripts/e2e-designer-job.mjs [BASE_URL]
 */
const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log(`E2E designer→job @ ${BASE}`);

const postNoAuth = await fetch(`${BASE}/api/designer/models`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "x", royaltyPrice: 1 }),
});
assert(postNoAuth.status === 401, `POST models sem token esperado 401, veio ${postNoAuth.status}`);
console.log("0) POST models sem token → 401");

const login = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email: "designer@fabmakers.com.br",
    password: "123",
    role: "DESIGNER",
  }),
});
assert(login.designerToken, "login designer sem designerToken");
assert(login.user?.profile?.models?.length >= 1, "MVP designer sem Model3D seed");
const modelId = login.user.profile.models[0].id;
const royalty = login.user.profile.models[0].royaltyPrice;
console.log(`1) login designer ok — model #${modelId} royalty R$ ${royalty}`);

const list = await req("/api/designer/models");
assert(
  (list.models || []).some((m) => m.id === modelId),
  "modelo não listado na API pública"
);
console.log("2) GET models ok");

const quote = await req("/api/quote", {
  method: "POST",
  body: JSON.stringify({ modelId, material: "PLA", infill: 20 }),
});
assert(quote?.pricing?.totalPrice > 0, "quote sem preço");
assert(
  Number(quote.pricing.royaltyPrice) === Number(royalty),
  `royalty esperado ${royalty}, veio ${quote.pricing.royaltyPrice}`
);
console.log(`3) quote com royalty R$ ${quote.pricing.royaltyPrice} · total R$ ${quote.pricing.totalPrice}`);

const makerLogin = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email: "roda@fabmakers.com.br",
    password: "123",
    role: "MAKER",
  }),
});
assert(makerLogin.makerToken, "login maker falhou");
const auth = { Authorization: `Bearer ${makerLogin.makerToken}` };

const orderId = `e2e-des-${Date.now()}`;
const created = await req("/api/orders", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    id: orderId,
    filename: quote.filename,
    status: "WAITING_MAKER",
    totalPrice: quote.pricing.totalPrice,
    weightG: quote.metrics.weightG,
    timeFormatted: quote.metrics.timeFormatted,
    material: "PLA",
    zipCode: "01310-100",
    modelId,
  }),
});
assert(created.success, "create order falhou");
console.log(`4) order na fila com modelId — #${orderId}`);

const claimed = await req("/api/orders", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ action: "claim", orderId }),
});
assert(claimed.order?.status === "PRINTING", "claim falhou");
await req("/api/orders", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ action: "advance", orderId }),
});
const done = await req("/api/orders", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ action: "advance", orderId }),
});
assert(done.order?.status === "COMPLETED", "não COMPLETED");
console.log("5) claim → COMPLETED");

console.log("PASS — L1 designer → royalty quote → fila → pagamento");
