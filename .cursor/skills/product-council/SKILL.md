---
name: product-council
description: Conselho multi-perspectiva para decisões de produto/negócio do FabMakers (estratégia, risco, UX, tech). Use em decisões difíceis, pivots, ou quando estiver preso entre opções.
---

# Product Council — FabMakers

## Objetivo

Obter ângulos diversos **sem** precisar de múltiplos CLIs. Simula um conselho interno (estilo council do johnlindquist, adaptado ao Cursor).

## Hard gate

Não implementar código nesta skill. Decisões vão para `docs/brain/DECISIONS.md` e/ou `HYPOTHESES.md`.

## Pré-leitura

`PROJECT-MEMORY.md` + `docs/brain/VISION.md` + `DECISIONS.md` + a pergunta do usuário.

## Cadeiras do conselho (sempre as 5)

Responda a pergunta **na voz de cada cadeira**, depois sintetize.

1. **Estrategista de plataforma** — cold-start, efeitos de rede, wedge
2. **Operador de manufatura** — QA, prazo, frete, falha física
3. **Cliente impaciente** — atrito, confiança, “por que não pedir no WhatsApp?”
4. **Maker cético** — pagamento, risco, burocracia do onboarding
5. **Engenheiro pragmático** — o que o código atual realmente aguenta em 2 semanas

## Formato

Para cada cadeira: 3–5 bullets. Depois:

- **Consenso**
- **Dissensos importantes**
- **Recomendação** (1 caminho)
- **Risco se ignorar**
- **Próximo artefato** (qual arquivo do brain atualizar)

## Quando escalar

Se a decisão mudar o wedge ou ICP, obrigar confirmação explícita do usuário antes de gravar D00x.
