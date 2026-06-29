# Plano de Implementação: Parser STL e Rota de Cotação Instantânea (MVP)

Este plano descreve o desenvolvimento do core tecnológico da **FabMakers3D**: a capacidade de fazer upload de um modelo 3D (STL), analisar matematicamente seu volume/peso de forma nativa no servidor e retornar uma cotação financeira instantânea na interface.

---

## 1. Abordagem Técnica

Para estimar com precisão o custo da impressão sem utilizar bibliotecas em nuvem proprietárias pesadas, implementaremos um **analisador geométrico de STL nativo em TypeScript** que lê o buffer do arquivo (ASCII ou Binário) enviado e calcula o volume tridimensional em milímetros cúbicos ($mm^3$).

O volume é então convertido em peso estimado em gramas usando a densidade do material escolhido (PLA, ABS, PETG) e a porcentagem de preenchimento interna da peça (*infill*).

### Estrutura de Arquivos a Serem Criados:
* `src/lib/stlParser.ts`: Biblioteca utilitária matemática para cálculo de volume 3D.
* `src/app/api/quote/route.ts`: Rota HTTP POST que recebe o arquivo e os parâmetros e retorna o JSON de custos.
* `src/app/page.tsx`: Interface inicial drag-and-drop interativa em dark mode premium para o cliente carregar e simular o preço do arquivo em tempo real.
* `src/app/globals.css`: Classes de estilo utilitárias e paleta de cores moderna da marca FabMakers.

---

## 2. A Fórmula do Volume 3D
Para calcular o volume do arquivo STL, o analisador somará o volume assinado de tetraedros formados pelos triângulos da malha 3D e a origem $(0, 0, 0)$. O volume de cada tetraedro com vértices $A, B, C$ é dado pelo determinante:

$$V_{tetraedro} = \frac{1}{6} \cdot (-A_z B_y C_x + A_y B_z C_x + A_z B_x C_y - A_x B_z C_y - A_y B_x C_z + A_x B_y C_z)$$

Soma-se esses volumes de todas as faces da malha. O resultado absoluto final é o volume exato do sólido em $mm^3$.
