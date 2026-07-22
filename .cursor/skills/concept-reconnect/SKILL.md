---
name: concept-reconnect
description: Mapeia features e fluxos desconectados da narrativa do produto; classifica Core / Support / Later / Cut. Use depois do wedge e antes de redesign de UI.
---

# Concept Reconnect — FabMakers

## Objetivo

Cada peça do produto deve puxar a **mesma corrente de valor**. O que não puxa: adiar ou cortar.

## Hard gate

Sem implementação. Atualizar `docs/brain/CONCEPT-MAP.md` (e se necessário `ROADMAP-NOW.md`).

## Pré-leitura

1. `PROJECT-MEMORY.md`
2. `docs/brain/VISION.md` + `ROADMAP-NOW.md` (wedge já escolhido; se não, rodar `wedge-finder` primeiro)
3. `docs/brain/CONCEPT-MAP.md`
4. Inventário rápido: `src/app/`, `prisma/schema.prisma`, APIs existentes

## Processo

1. Reescrever a **cadeia de valor do wedge** em 5–8 elos
2. Listar features/rotas/APIs reais encontradas
3. Classificar cada uma:
   - **Core** — no caminho feliz do wedge
   - **Support** — necessário mas invisível (auth, admin mínimo)
   - **Later** — visão válida, fora do wedge
   - **Cut / Park** — desvia narrativa ou cria risco (ex.: integrações duvidosas)
4. Propor **uma frase de produto** pós-poda
5. Pedir aprovação; então gravar no `CONCEPT-MAP.md`
6. Atualizar `PROJECT-MEMORY.md` com próximo passo = `product-ui` ou plano técnico

## Perguntas-guia

- Se remover X, o wedge ainda funciona?
- X existe porque era fácil de codar ou porque o cliente paga por isso?
- X compete com a frase de 15 segundos?

## Saída esperada

Tabela Core/Support/Later/Cut + frase única do produto + lista do que a UI deve esconder.
