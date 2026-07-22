# HYPOTHESES — Apostas abertas

Formato: **Aposta → Como invalidar → Status**

| ID | Aposta | Como invalidar (experimento) | Status |
|----|--------|------------------------------|--------|
| H1 | O gargalo inicial é **oferta de makers confiáveis**, não demanda | Abrir cotação pública sem makers → pedidos somem / sem matching | open (alinha Supply-first) |
| H2 | O gargalo inicial é **demanda com STL pronto** | Recruit makers sem pedidos → churn de makers | open — seed via **D006** catálogo curado (não MakerWorld) |
| H3 | TEKNA como âncora de demanda valida o processo ponta a ponta antes do marketplace | — | **superseded** (D005) |
| H4 | Cotação automática (cloud slice) é o diferencial que reduz atrito vs orçamento manual | Comparar conversão cotação auto vs orçamento humano | open |
| H5 | Onboarding pesado (KYC+calibração) aumenta confiança mais do que reduz conversão de makers | Funil: início cadastro → homologado (`GET /api/funnel/h5`) | open — **instrumento D007** |
| H6 | Integrações tipo MakerWorld/Shopee desviam do posicionamento “infraestrutura BR” | Se narrativa do pitch depender delas, H6 confirmada como risco | open |
| H7 | Makers (e donos de impressora) pagam por **manutenção**: oficinas, peças, manuais/vídeos de reparo | Landing/entrevistas: zero intenção de pagar ou achar técnico via FabMakers | **testing** — MVP L2 (D023) `e2e:tech-job` |
| H8 | **Dropshipping** como origem de demanda (fulfillment local) escala a fila sem virar o posicionamento | Se o pitch depender de Shopee/afiliado, H8 falha como risco de narrativa | **testing** — L3 canal (D022) |
| H9 | **Designers** + royalties fecham o lado da oferta de modelos depois do matching de fabs | Sem fabs/jobs, designers churn | **testing** — L1 (D021) |

## Regras

- Não construir feature grande sem apontar para uma hipótese.
- Ao invalidar, registrar em `DECISIONS.md`.
- H7 / L1–L3 não viram UI/Core até o matching Supply-first estar estável (D014).
