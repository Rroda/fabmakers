# CONCEPT-MAP — Conexões e desconexões

> Wedge: **Supply-first** (D004). Classificação `concept-reconnect` — 2026-07-21.
> Hard gate: sem implementação de código nesta skill.

## Frase de produto (pós-poda)

**FabMakers: fabs homologadas pegam jobs de impressão 3D da fila — com QA e pagamento.**

(15s: “É a fila de trabalho pago para quem tem impressora ociosa no Brasil.”)

## Cadeia de valor do wedge (8 elos)

```
1. Fab se cadastra (auth maker)
2. KYC + contrato + calibração (cubo)
3. Admin homologa → Sandbox / Homologated
4. Demanda entra na fila (cotação/pedido seed — Support)
5. Fab vê fila / recebe oferta de job
6. Aceita job (instruções, material, prazo, arquivo de produção)
7. Produz → atualiza status → QA
8. Entrega → pagamento liberado
```

## Classificação

### Core — caminho feliz do maker

| Peça | Onde no código | Por quê |
|------|----------------|---------|
| Onboarding maker (máquinas, materiais, disponibilidade) | `POST /api/maker`, UI maker, `MakerProfile` | Sem fab não há supply |
| KYC + calibração + sandbox | `MakerProfile` fields, UI onboarding | Confiança / H5 |
| Admin homologação | `GET/POST /api/admin` | Gate de qualidade |
| Pedidos + aceite / oferta de job | `GET/POST /api/orders`, push/timer de oferta na UI | Elo central do wedge |
| Status de produção (PRINTING → SHIPPED → …) | `Order.status` | Fecha o caminho feliz |

### Support — necessário, secundário na narrativa

| Peça | Onde | Por quê |
|------|------|---------|
| Auth (login/signup) | `/api/auth/*` | Infra |
| Cotação / quote | `/api/quote`, `quoteEngine` | Gera item na fila (seed de demanda) |
| **Catálogo curado + orçamento** | `curatedCatalog.ts`, UI home `#catalogo-curado` | **D006** — demanda Support sem MakerWorld |
| Cliente mínimo | role `CLIENT`, upload STL / catálogo na UI | Só para alimentar a fila — não é o hero |
| Catálogo `PrinterModel` | schema | Ajuda onboarding / matching |
| CEP / geo (ViaCEP) | UI | Roteamento regional |
| Radar de proximidade | UI (simulado) | Útil só com fabs reais; cosmético se supply vazio |
| `layout.tsx` / shell | app | Infra |

### Later — no plano (ROADMAP L1–L3), fora do wedge **agora**

| Peça | Onde | Nota |
|------|------|------|
| **L1 Designers** + royalties + `Model3D` | schema, auth DESIGNER, UI Later | Pós-Core; não competir com frase Supply-first |
| **L2 Técnicos / manutenção** (H7) | ainda não existe | Oficinas, peças, manuais; após jobs reais |
| **L3 Dropshipping** | esqueleto `/api/dropshipping/shopee` | Canal de demanda/fulfillment pós-Core — **não** hero do pitch |
| Chat “FabMakers AI” | UI | Assistente; não é o produto |
| DRM / G-code stream | `Model3D.gcodeStream` | Depois de matching vivo |
| API B2B / app mobile | visão | Fora do ROADMAP-NOW ativo |
| Empresa / lotes | visão | Later |

### Park — risco / não evoluir como narrativa

| Peça | Onde | Ação |
|------|------|------|
| MakerWorld search / scrape | `/api/makerworld/search` | **Park** — D002/D006; demanda via catálogo curado |
| Shopee como pitch/afiliado hero | UI dropshipping | **Park na narrativa**; L3 trata dropship como canal depois |
| Página multi-persona como padrão | monólito UI | Priorizar caminho maker até product-ui pós-Core |
| Pitch HTML / simulador solto | marketing | Fora do app produto |

## O que a UI deve esconder (até product-ui)

- Abas/fluxos **Designer** e catálogo de obras autorais
- Galeria / busca **MakerWorld** como entrada principal
- Qualquer bloco **Shopee** / afiliado
- Seção **manutenção** (ainda não construir)
- AI chat como hero da home
- Cliente como persona principal (reduzir a “criar demanda seed” se precisar)

## O que a UI deve mostrar (Core)

1. Entrar como fab
2. Completar onboarding → status de homologação
3. Fila / ofertas de job
4. Job ativo (instruções + status)
5. Histórico / pagamento (mínimo)

## Diagnóstico pós-reconnect

O código já tem **Core de supply** relativamente forte (`maker`, `admin`, `orders`) e **ruído multilateral** na mesma `page.tsx` (cliente + designer + MakerWorld + AI). O wedge não pede apagar o schema Later — pede **parar de competir por atenção na UI**.

## Próximo passo

**Motor Core** (fila → aceite → status → pagamento) no portal maker já existente.  
Layer B (rotas `/maker` etc.) opcional depois. Manutenção continua Later (H7).

> Product-ui Layer A (2026-07-21): home maker-first; Designer / MakerWorld / Shopee / AI ocultos com `SHOW_LATER_UI = false`.
