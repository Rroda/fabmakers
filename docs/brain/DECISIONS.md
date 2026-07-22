# DECISIONS — Registro de decisões (ADR leve)

## D001 — Marcas separadas: TEKNA vs FabMakers

- **Decisão:** TEKNA = D2C premium; FabMakers = orquestrador de manufatura.
- **Por quê:** Escalar asset-light sem misturar loja física/marca premium com marketplace.
- **Data:** (origem estratégica — docs históricos)
- **Atualização:** Ver D005 — TEKNA não tem papel especial no produto FabMakers.

## D002 — Não raspar MakerWorld como catálogo comercial

- **Decisão:** Designers publicam com licença adequada; royalties no fluxo.
- **Por quê:** Risco jurídico / Non-Commercial.
- **Data:** (origem da ideia)

## D003 — Crescimento em 3 etapas (próprio → parceiros → marketplace)

- **Decisão:** Validar processo com capacidade **controlada/homologada** antes de marketplace puro.
- **Por quê:** Qualidade, precificação, logística.
- **Status:** Mantido em espírito; “próprio/controlado” = fabs homologadas na plataforma, **não** capacidade especial TEKNA (D005). Docs históricos que citam Tekna-as-factory estão superseded.

## D004 — Wedge operacional: Supply-first

- **Decisão:** Wedge = **Supply-first** — fab homologada → fila de demandas → aceita job → produz/entrega → pagamento.
- **Persona:** Maker / fab cadastrada.
- **Job:** Receber trabalho pago com instruções claras e pouco risco.
- **Sucesso (30 dias):** N fabs homologadas + ≥1 job real aceito/entregue com QA.
- **Explicitamente fora:** app mobile, API corporativa, designers em escala, UI de manutenção, qualquer privilégio TEKNA.
- **Por quê:** Onboarding já existe; prova matching/QA com demanda seed (qualquer origem) sem cold-start de marketplace multilateral.
- **Data:** 2026-07-21
- **Próxima skill:** `concept-reconnect`

## D006 — Demanda via catálogo curado + cotação (sem scrape MakerWorld)

- **Decisão:** Origem de demanda Support = **catálogo curado próprio** + **orçamento com parâmetros ajustáveis** → pedido na fila `WAITING_MAKER`. MakerWorld permanece Park (D002). Não clonar/raspar catálogo externo.
- **Por quê:** Alimenta a fila do wedge Supply-first (H2) sem risco jurídico nem diluir a narrativa com marketplace multilateral.
- **Escopo:** modelos com licença OK / assets demo FabMakers; quote (material, infill, camada, padrão) → job para fabs homologadas.
- **Fora:** scrape MakerWorld/Printables; vitrine como hero multi-persona; designer royalties em escala (Later).
- **Data:** 2026-07-21
- **Wedge:** mantém D004 (Supply-first); só muda a origem do seed de demanda.

## D007 — Layer B: rotas reais + funil H5

- **Decisão:** Extrair shell `FabMakersApp` com URLs Core: `/` (pitch maker), `/client` (catálogo seed), `/quote` (cotação), `/maker` (portal fab), `/admin`. Layout `(app)` mantém o shell montado. Funil H5 via `GET /api/funnel/h5` + painel admin.
- **Por quê:** monólito sem URL bloqueia deep-link e métrica do caminho feliz Supply-first.
- **Fora:** split completo em micro-frontends; SMTP; H7.
- **Data:** 2026-07-21

## D008 — Gate de `/admin` (sessão client-side)

- **Decisão:** Deep-link `/admin` só mostra o painel se `currentUser.role === "ADMIN"`. Sem sessão (ou outro role) → “Acesso restrito” + login admin. Sessão em `sessionStorage` (`fm_session_v1`) para refresh.
- **Por quê:** Layer B (D007) expôs o painel sem autenticação.
- **Limite:** gate é UI; auth de servidor nas APIs admin = D009.
- **Data:** 2026-07-21

## D009 — Auth de servidor nas APIs admin

- **Decisão:** `GET/POST /api/admin` e `GET /api/funnel/h5` exigem `Authorization: Bearer <adminToken>`. Token HMAC (`ADMIN_API_SECRET` ou fallback de dev) emitido no login ADMIN (`POST /api/auth/login`). UI guarda em `sessionStorage` e reenvia via `adminAuthHeaders()`.
- **Por quê:** D008 só fechava a UI; APIs admin/H5 ficavam abertas.
- **Escopo:** admin + funil H5. Atalho “homologação de teste” do maker = só estado local (não chama `/api/admin`).
- **Fora:** auth em todas as APIs maker/cliente; OAuth/JWT de produto; SMTP.
- **Smoke:** sem token → 401; com token do login → 200.
- **Data:** 2026-07-21

## D010 — Job E2E catálogo + SQLite canônico

- **Decisão:** Pedidos do catálogo curado persistem `catalogId`; script `npm run e2e:catalog-job` prova quote → fila → claim → SHIPPED → COMPLETED + `payoutReleased`. SQLite local canônico = `prisma/dev.db` (fim do dual `./dev.db` vs `prisma/dev.db`).
- **Por quê:** Sucesso do wedge exige job rastreável da demanda seed até pagamento; dual DB quebrava migrations vs runtime.
- **Fora:** SMTP; STLs binários reais.
- **Data:** 2026-07-21

## D011 — Auth maker no motor Core (PATCH orders)

- **Decisão:** `PATCH /api/orders` (claim / advance / release) exige `Authorization: Bearer <makerToken>`. Token HMAC emitido no login MAKER; maker do job = e-mail do token (não confiar em `makerName` do body). Advance/release só pelo maker alocado.
- **Por quê:** Qualquer um podia claimar/avançar jobs com um nome inventado.
- **Escopo:** só PATCH do motor Core. GET/POST orders (fila/seed) seguem abertos no MVP.
- **Smoke:** sem token → 401; `e2e:catalog-job` com login + Bearer → COMPLETED.
- **Data:** 2026-07-21

## D012 — Gate `/maker` + conta MVP canônica

- **Decisão:** Deep-link `/maker` com role ≠ MAKER → “Portal da fab” + login (visitante ainda vê wizard de cadastro). Sessão MAKER sem `makerToken` força re-login. Conta MVP `roda@fabmakers.com.br` / `123` é criada/homologada no login (como o admin hardcode).
- **Por quê:** Cliente/admin não deve ver a fila; docs citavam `roda@` mas o DB só tinha outro e-mail; D011 quebra claim sem token após refresh antigo.
- **Fora:** SMTP; gate de cadastro wizard para anônimos.
- **Smoke:** `e2e:catalog-job` com `roda@` → COMPLETED.
- **Data:** 2026-07-21

## D013 — Pipeline de e-mail (SMTP deploy-ready)

- **Decisão:** `src/lib/mail.ts` + `POST /api/auth/verify-email` (send/confirm). Sem `SMTP_*` → modo console (`devCode` na API + log). Com SMTP (Zoho etc.) → envio real. Wizard maker usa a API; bypass “confirmar sessão” fica em `<details>` MVP. `verificationToken` volta a ser só código de e-mail (CEP fica em `MakerProfile.city`).
- **Por quê:** dívida de deploy do ROADMAP sem bloquear o Core local.
- **Fora:** obrigar SMTP em local; provedor específico além de SMTP genérico.
- **Smoke:** send → console+devCode; confirm → emailVerified; E2E job ainda PASS.
- **Data:** 2026-07-22

## D014 — Backlog Later explícito (sem mudar wedge)

- **Decisão:** Manter no plano, **sem executar agora**, três trilhas pós-Core: **L1 Designers**, **L2 Técnicos/manutenção (H7)**, **L3 Dropshipping** (canal de demanda, não hero). Wedge ativo continua Supply-first (D004).
- **Por quê:** o produto multilaterais futuro não deve ser esquecido nem misturado com o passo atual.
- **Fora:** abrir UI/código dessas trilhas antes de Core estável + deploy básico.
- **Data:** 2026-07-22

## D015 — Auth GET fila/mine (pré-prod)

- **Decisão:** `GET /api/orders?filter=queue` e `?filter=mine` exigem `makerToken`. `mine` usa o maker do token. Listagem sem filter e POST seed permanecem abertos no MVP.
- **Por quê:** fila e jobs do maker não devem ser públicos.
- **Smoke:** queue sem token → 401; e2e com Bearer → PASS + filter=mine.
- **Data:** 2026-07-22

## D016 — STLs demo no catálogo curado

- **Decisão:** Arquivos em `public/catalog/*.stl` (caixas ASCII geradas); cada modelo tem `stlUrl`; fila do maker oferece “Baixar STL” quando há `catalogId`.
- **Por quê:** job na fila precisa de arquivo de produção baixável (seed), sem scrape externo.
- **Limite:** geometria demo (caixa), não peças finais de engenharia.
- **Data:** 2026-07-22

## D017 — Frota/estoque demo no maker MVP (roda@)

- **Decisão:** No login `roda@` / `123`, se `machines` ou `materials` estiverem vazios (`[]`), seed com P1S + PLA/PETG (`mvpMakerDefaults`). Homologação/KYC/contrato também reforçados nesse path.
- **Por quê:** perfil “Especificações do maker” vazio quebrava o demo Supply-first mesmo com fila ok.
- **Smoke prod:** login → machines `Bambu Lab P1S`, filaments PLA/PETG.
- **Data:** 2026-07-22

## D018 — SMTP real Zoho em produção

- **Decisão:** Envs `SMTP_*` na Vercel; host `smtp.zoho.com` (não `smtppro` / não `.com.br`); user `contato@fabmakers.com.br` + senha de app; `mail.ts` resolve IPv4 explícito.
- **Por quê:** dívida D013; verify-email deixa de ser console em prod.
- **Smoke:** `POST /api/auth/verify-email` → `mode: "smtp"`, HTTP 200.
- **Data:** 2026-07-22

## D019 — Auth POST criar pedido (seed)

- **Decisão:** `POST /api/orders` exige Bearer `makerToken` | `adminToken` | `clientToken`. Login CLIENT emite `clientToken`. UI usa `orderAuthHeaders()`.
- **Por quê:** fecha residual D015 — fila não pode receber seed anônimo em prod.
- **Fora:** OAuth; auth em GET listagem geral (ainda aberta no MVP).
- **Smoke:** POST sem token → 401; e2e com makerToken → PASS.
- **Data:** 2026-07-22

## D020 — Auth GET listagem de pedidos

- **Decisão:** Todo `GET /api/orders` exige Bearer maker|admin|client. Sem filter: CLIENT só vê os próprios; MAKER/ADMIN veem a lista. `filter=queue|mine` continua só MAKER.
- **Por quê:** fecha residual D019 — pedidos não são públicos.
- **Smoke:** GET sem token → 401; e2e PASS.
- **Data:** 2026-07-22

## D021 — Abrir L1 Designers (pós-Core)

- **Decisão:** Com Core estável, executar **L1** (persona Designer: publicar `Model3D` com licença OK + royalty no pedido). Manter home maker-first; `SHOW_L1_DESIGNER` separado de MakerWorld/Shopee/AI (`SHOW_LATER_UI` continua false).
- **Por quê:** ordem do ROADMAP pós-Core; usuário confirmou autonomia para seguir sem micro-menus.
- **Fora:** scrape MakerWorld; DRM/G-code stream.
- **Smoke:** `e2e:designer-job` PASS em prod.
- **Data:** 2026-07-22

## D022 — L3 Dropshipping = canal de demanda (não hero)

- **Decisão:** Após L1, abrir L3 como **origem de pedidos** para a fila (`POST /api/channels/fulfillment`), não como pitch/afiliado. UI Shopee continua `SHOW_LATER_UI=false`.
- **Por quê:** reforça Supply-first (mais jobs na fila) sem diluir a frase do produto.
- **Fora:** clonar loja; afiliado hero.
- **Smoke:** `e2e:channel-job` PASS em prod.
- **Data:** 2026-07-22

## D023 — L2 Técnicos / manutenção (H7)

- **Decisão:** MVP L2: `TechRequest` + `TechnicianProfile`; maker abre chamado (`POST /api/tech/requests`); tech `tech@` / `123` lista OPEN, claim e DONE. UI: botão no portal maker (não hero).
- **Por quê:** testar H7 sem diluir Supply-first.
- **Smoke:** `e2e:tech-job` em prod.
- **Data:** 2026-07-22

## D024 — Polish H5 + suite E2E master

- **Decisão:** Funil H5 trata `APPROVED` legado como HOMOLOGATED; admin mostra makers recentes; `npm run e2e:all` cobre catalog/designer/channel/tech/h5.
- **Por quê:** fechar instrumento H5 e um único script de regressão para o founder.
- **Data:** 2026-07-22

## D025 — Ops harden (teste founder)

- **Decisão:** `ADMIN_API_SECRET` definido na Vercel (Production+Preview). Bypass de e-mail no wizard **só em localhost**. Prod exige código SMTP.
- **Por quê:** fechar buracos antes do roteiro de teste manual do founder.
- **Data:** 2026-07-22
