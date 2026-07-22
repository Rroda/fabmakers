/**
 * E2E Supply-first (D006 + D010–D015 + D019):
 * catálogo → fila (auth) → claim → SHIPPED → COMPLETED + payout.
 * Uso: node scripts/e2e-catalog-job.mjs  [BASE_URL]
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

const CATALOG_ID = "fm-cable-clip";
const MAKER_EMAIL = "roda@fabmakers.com.br";
const MAKER_PASSWORD = "123";

console.log(`E2E catalog→job @ ${BASE}`);

// 0) PATCH / queue / POST sem token → 401
{
  const patch = await fetch(`${BASE}/api/orders`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "claim", orderId: "x" }),
  });
  assert(patch.status === 401, `PATCH esperado 401, veio ${patch.status}`);
  const queueNoAuth = await fetch(`${BASE}/api/orders?filter=queue`);
  assert(queueNoAuth.status === 401, `GET queue esperado 401, veio ${queueNoAuth.status}`);
  const listNoAuth = await fetch(`${BASE}/api/orders`);
  assert(listNoAuth.status === 401, `GET orders esperado 401, veio ${listNoAuth.status}`);
  const postNoAuth = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "x.stl", status: "WAITING_MAKER", totalPrice: 1 }),
  });
  assert(postNoAuth.status === 401, `POST esperado 401, veio ${postNoAuth.status}`);
  console.log("0) PATCH + GET queue + GET list + POST sem token → 401");
}

const login = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email: MAKER_EMAIL,
    password: MAKER_PASSWORD,
    role: "MAKER",
  }),
});
assert(login.makerToken, "login maker sem makerToken");
const auth = { Authorization: `Bearer ${login.makerToken}` };
console.log(`1) login maker ok — ${login.user.name}`);

const quote = await req("/api/quote", {
  method: "POST",
  body: JSON.stringify({
    catalogId: CATALOG_ID,
    material: "PLA",
    infill: 20,
    layerHeight: "0.20",
    infillPattern: "grid",
  }),
});
assert(quote?.pricing?.totalPrice > 0, "quote sem preço");
console.log(`2) quote ok — R$ ${quote.pricing.totalPrice} · ${quote.filename}`);

const orderId = `e2e-${Date.now()}`;
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
    catalogId: CATALOG_ID,
  }),
});
assert(created.success && created.orderId === orderId, "create order falhou");
console.log(`3) order na fila — #${orderId}`);

const queue = await req("/api/orders?filter=queue", { headers: auth });
const inQueue = (queue.orders || []).find((o) => o.id === orderId);
assert(inQueue, "pedido não apareceu na fila");
assert(inQueue.catalogId === CATALOG_ID, `catalogId esperado ${CATALOG_ID}, veio ${inQueue.catalogId}`);
console.log(`4) fila ok — catalogId=${inQueue.catalogId}`);

const claimed = await req("/api/orders", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ action: "claim", orderId }),
});
assert(claimed.order?.status === "PRINTING", "claim não foi para PRINTING");
console.log(`5) claim → PRINTING (${claimed.order.makerName})`);

const shipped = await req("/api/orders", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ action: "advance", orderId }),
});
assert(shipped.order?.status === "SHIPPED", "advance 1 ≠ SHIPPED");
console.log("6) advance → SHIPPED");

const done = await req("/api/orders", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ action: "advance", orderId }),
});
assert(done.order?.status === "COMPLETED", "advance 2 ≠ COMPLETED");
assert(done.order?.payoutReleased === true, "payout não liberado");
assert(done.order?.makerPayout > 0, "makerPayout zerado");
console.log(
  `7) COMPLETED — payoutReleased · makerPayout R$ ${Number(done.order.makerPayout).toFixed(2)}`
);

const mine = await req("/api/orders?filter=mine", { headers: auth });
assert(
  (mine.orders || []).some((o) => o.id === orderId && o.status === "COMPLETED"),
  "job não apareceu em filter=mine"
);
console.log("8) filter=mine ok");

console.log("PASS — catalog → fila (auth) → claim → QA/pagamento");
