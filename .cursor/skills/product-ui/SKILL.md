---
name: product-ui
description: Melhora interface e usabilidade do FabMakers alinhadas ao wedge e à narrativa. Use só depois de wedge-finder e concept-reconnect (ou se ROADMAP-NOW já tiver wedge explícito).
---

# Product UI — FabMakers

## Objetivo

UI a serviço do **conceito escolhido**, não redesign cosmético do ecossistema inteiro.

## Hard gate

Antes de qualquer edição de UI:

1. Confirmar wedge em `docs/brain/ROADMAP-NOW.md` (D004 preenchido)
2. Ler classificação Core/Later em `CONCEPT-MAP.md`
3. Se wedge ausente → parar e indicar `wedge-finder`

## Princípios

- **Base visual (páginas novas / light):** [mistral.ai](https://mistral.ai/) — regra `.cursor/rules/fabmakers-ui.mdc`
- **Uma persona por jornada principal** na primeira viewport / fluxo feliz
- Esconder ou rebaixar Later/Cut (não deletar código sem plano; pode feature-flag ou rota secundária)
- Reduzir a “página monolítica” que mistura Client + Maker + Admin + pitch
- Preferir clareza do job (“orçar e pedir peça”) a dashboard de marketplace
- No light: inputs/cards claros; nunca blocos pretos órfãos

## Processo

1. Descrever o **caminho feliz** em 5 telas/estados máx.
2. Mapear o que existe em `src/app` que atrapalha esse caminho
3. Propor mudanças em camadas:
   - A) Informação / hierarquia (copy, ordem)
   - B) Estrutura de rotas / navegação
   - C) Componentes novos
4. Apresentar plano curto; só então implementar
5. Se Superpowers estiver disponível no ambiente, preferir brainstorm→spec→plan para mudanças grandes

## Anti-padrões

- Cards/stats/promos de todos os lados do marketplace no hero
- Onboarding maker completo no mesmo fluxo visual do cliente
- “Melhorar a cara” sem cortar ruído de conceito
- Tema light com fills pretos (`#050506` / `#09090b`) em campos e sidebars

## Saída

- Plano de UI alinhado ao wedge
- Lista do que fica oculto
- Depois da implementação: atualizar `PROJECT-MEMORY.md`
