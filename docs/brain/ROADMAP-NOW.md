# ROADMAP-NOW — Wedge atual

## Estado

- **Wedge escolhido?** Sim — **Supply-first** (D004)
- **TEKNA:** peer apenas (D005) — sem papel especial
- **Foco técnico recente:** Onboarding maker + APIs + cotação/orders
- **Próximo movimento:** **L1 Designers (D021)** em execução. Core Supply-first + SMTP + auth orders fechados.
- **SMTP:** ligado (Zoho `contato@` / `smtp.zoho.com`)
- **Autonomia:** orquestrar ROADMAP sem menus “A ou B”; humano só em secrets/risco/pivot
- **Prod:** https://fabmakers.com.br
- **D014:** backlog L1–L3
- **Autonomia:** **sempre pode seguir** o ROADMAP (permissão founder 2026-07-22). Sem menus A/B. Humano só em secrets/risco/bloqueio. Freio 3x só para desvio fora do plano.
- **Foco:** regra `fabmakers-focus.mdc`

## Wedge ativo

**Supply-first:** fab homologada pega jobs da fila, prova QA e matching.

### Caminho feliz (maker)

1. Cadastro / KYC + calibração
2. Homologação admin
3. Vê fila de demandas disponíveis
4. Aceita job → produz / despacha
5. QA + pagamento liberado

### Sucesso em 2–4 semanas

- Funil: início cadastro → homologado (H5)
- ≥1 job real aceito e entregue com QA ok
- Demanda seed de **qualquer** origem (sem privilégio TEKNA)

### Persona / Job

- **Persona:** Maker / fab cadastrada
- **Job:** Monetizar impressora ociosa com pedidos claros e pouco risco de fraude

## Dívida explícita (UX / infra)

- ~~Layout do **wizard maker** (onboarding)~~ — redesign Layer A 2026-07-21
- ~~E-mail de ativação com código (SMTP real)~~ — D013 + D018 (Zoho em prod). Bypass só localhost (D025).
- ~~Seed demanda + polish~~ — catálogo/canal/e2e:all
- ~~Dois SQLite locais~~ — unificado em `prisma/dev.db` (D010)

## Escopo operacional (só Core + Support **agora**)

- **Core:** onboarding/KYC/calibração → homologação admin → fila/aceite de job → status → pagamento
- **Support:** auth, quote (seed), **catálogo curado (D006)**, cliente mínimo, PrinterModel, CEP/geo
- **Deploy:** SMTP Zoho em prod (D018)
- **Later (no plano — não executar enquanto Core/deploy não estiver estável):** ver seção abaixo
- **Park:** scrape MakerWorld como catálogo comercial (D002/D006)

## Backlog Later — manter no plano (não é foco agora)

Trilhas **prometidas** para depois do Supply-first estável. Não competem com o caminho feliz do maker; entram na fila quando o wedge validar.

### L1 — Designers (oferta de modelos / royalties)

- **O quê:** persona Designer; publicação de modelos com licença OK; royalties no fluxo de pedido.
- **Já existe (esqueleto):** role `DESIGNER`, `Model3D`, UI Later atrás de flag.
- **Quando:** após matching Supply-first vivo + demanda seed estável (não antes de diluir a home).
- **Não fazer agora:** hero multi-persona; scrape de catálogos externos.

### L2 — Técnicos de impressoras (manutenção / H7)

- **O quê:** rede de técnicos / oficinas; peças; manuais e vídeos de reparo; matching “preciso de manutenção”.
- **Hipótese:** H7 — makers pagam por manutenção e achar técnico via FabMakers.
- **Quando:** vertical **após** Core (homologação + jobs reais).
- **Freio:** não abrir UI/Core de manutenção no passo atual.

### L3 — Dropshipping (canal de demanda / fulfillment)

- **O quê:** canal em que pedidos de marketplaces/lojas alimentam a fila das fabs (fulfillment local), sem virar o posicionamento do produto.
- **Já existe (esqueleto):** rota Shopee afiliado — **não evoluir como narrativa principal**.
- **Quando:** depois do caminho feliz fab→job→pagamento provar valor; dropship = **origem de demanda**, não o hero.
- **Não fazer agora:** affiliate/Shopee como pitch; clonar loja externa.

**Ordem sugerida pós-Core:** L1 Designers → L3 Dropshipping (demanda) **ou** L2 Técnicos (H7), conforme hipótese que quiser testar primeiro — decisão explícita na hora (product-council).

## Próximos movimentos

1. ~~Atualizar VISION + ICP + D004~~ 
2. ~~concept-reconnect~~ 
3. ~~product-ui Layer A~~ 
4. ~~Motor Core claim/advance/release~~ 
5. ~~E2E API seed → COMPLETED~~ (pass)
6. ~~Smoke UI browser: aceite → despacho → pagamento~~ (pass, ≥2 jobs)
7. ~~Dívida UX: redesign wizard maker (product-ui)~~ 
8. ~~Polish light (mistral.ai) + logo + Material Symbols~~ 
9. ~~D006: catálogo curado + orçamento → fila~~ 
10. ~~Smoke API + UI: catálogo → quote → fila maker~~ 
11. ~~Layer B rotas (D007)~~ 
12. ~~Funil H5 API + UI admin~~ 
13. ~~Smoke deep-link rotas + funil H5~~ 
14. ~~Polish admin light (Core)~~ 
15. ~~Gate auth `/admin` (D008)~~ 
16. ~~Auth servidor nas APIs admin (D009)~~ 
17. ~~SMTP real — só no deploy~~ (D018)
18. ~~Job real E2E: catálogo → fila → aceite → QA → pagamento (D010)~~ 
19. ~~Auth maker em claim/advance (D011)~~ 
20. ~~Gate `/maker` + conta MVP roda@ (D012)~~ 
21. ~~Pipeline e-mail verify (D013)~~ — SMTP_* no deploy
22. ~~Auth GET queue/mine (D015)~~
23. ~~STLs demo catálogo (D016)~~
24. ~~SMTP_* em prod (D018)~~
25. ~~Build produção TypeScript OK~~ (MakerProfile.id + key rede)
26. ~~Frota/estoque demo maker MVP (D017)~~
27. ~~SMTP real Zoho em prod (D018)~~
28. ~~Wizard copy alinhada a SMTP real~~ (bypass só emergência)
29. ~~Auth POST seed orders (D019)~~
30. ~~Auth GET listagem orders (D020)~~
31. ~~**L1 Designers (D021)**~~ — MVP PASS
32. ~~**L3 canal de demanda (D022)**~~ — MVP PASS
33. ~~**L2 Técnicos / H7 (D023)**~~ — MVP PASS
34. ~~Polish H5 funil + e2e:all (D024)~~
35. ~~Ops harden: ADMIN_API_SECRET + bypass e-mail só localhost (D025)~~

## Candidatos descartados (esta rodada)

1. ~~Demand-first~~ — adiado; cliente entra como support mínimo de seed
2. ~~Process-first (Tekna-as-factory)~~ — rejeitado (D005)
