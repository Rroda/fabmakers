# FabMakers — Fila de manufatura 3D (Supply-first)

**Frase:** fabs homologadas pegam jobs de impressão 3D da fila — com QA e pagamento.

Produção: https://fabmakers.com.br

---

## Wedge atual

Persona principal = **Maker / fab**. Cliente e catálogo curado só alimentam a fila (Support).

Fora do foco agora: Designers (L1), técnicos/manutenção (L2), dropshipping (L3), scrape MakerWorld.

Detalhes: `docs/brain/ROADMAP-NOW.md` · `PROJECT-MEMORY.md`

---

## Contas MVP

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin | `admin@fabmakers.com.br` | `admin123` |
| Maker | `roda@fabmakers.com.br` | `123` |
| Cliente | qualquer e-mail | cria automático |

---

## Local

```bash
npm install
npx prisma db push
npm run dev
```

SQLite: `prisma/dev.db`. Produção usa Turso (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` na Vercel).

SMTP (prod): `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_PORT` / `SMTP_FROM` na Vercel. Sem isso, verify-email fica em modo console.

```bash
npm run e2e:catalog-job   # catálogo → fila → claim → COMPLETED
npm run build
```

---

## Rotas Core

| URL | Uso |
|-----|-----|
| `/` | Pitch maker |
| `/client` | Catálogo / seed de demanda |
| `/maker` | Portal da fab (fila) |
| `/admin` | Homologação + funil H5 |
| `/quote` | Cotação |

---

## Stack

Next.js (App Router) · Prisma · LibSQL/Turso · Tailwind

Brain de produto: `docs/brain/`. Skills: `.cursor/skills/`.
