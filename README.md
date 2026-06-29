# FabMakers3D — Plataforma de Manufatura Digital Distribuída

A **FabMakers3D** é um ecossistema digital que conecta a capacidade ociosa de impressoras 3D instaladas em todo o país com a demanda reprimida de indústrias, designers 3D e consumidores finais (modelo multilateral semelhante a Uber, Airbnb e iFood).

---

## 🚀 Visão do Ecossistema

O mercado de manufatura sob demanda está em plena expansão global (liderado por empresas bilionárias como Xometry e Protolabs). A FabMakers3D preenche a lacuna do mercado brasileiro e latino-americano, criando uma infraestrutura descentralizada onde:

* **Clientes B2B / B2C**: Solicitam orçamentos instantâneos através do upload de arquivos STL/STEP e recebem a peça acabada impressa localmente na sua região metropolitana com baixo custo de frete.
* **Makers (Fabricantes)**: Monetizam suas impressoras 3D paradas, recebendo pedidos pré-pagos e pré-fatiados com instruções automáticas de envio de forma geolocalizada.
* **Designers 3D**: Disponibilizam seus designs em nosso catálogo e recebem royalties automáticos sobre cada impressão física realizada na rede.
* **Modeladores & IA**: IA generativa e modeladores autônomos prestam serviços de modelagem a partir de fotografias enviadas de peças quebradas que necessitam de reposição.

---

## 🛠️ Arquitetura Técnica & Tecnologias

Para atingir escalabilidade extrema e preparar a plataforma tanto para Desktop quanto para Aplicativos de Celular (smartphones), a arquitetura adotada é:

1. **Next.js 15+ (TypeScript / Tailwind CSS / App Router)**:
   * **Responsabilidade**: Servir a plataforma Web Desktop (essencial para clientes corporativos realizarem uploads de arquivos pesados CAD) e funcionar como a **API REST/GraphQL Centralizada** para Web e Apps de Smartphone.
   * **Benefício**: SEO de altíssima performance para atração orgânica de leads no Google buscando "peças de reposição 3D".
2. **React Native com Expo (Fase Posterior)**:
   * **Responsabilidade**: Aplicativo oficial móvel para smartphones iOS e Android focado na ponta de fornecimento (Makers acompanharem pedidos e enviarem fotos para validação de qualidade) e clientes B2C.
   * **Benefício**: Compartilhamento de cerca de **70% do código** de lógica de negócios, tipos TypeScript e chamadas de API do Next.js.
3. **Prisma ORM & Banco de Dados (SQLite/LibSQL para Dev - MySQL/Postgres para Prod)**:
   * Gerenciamento das transações bilaterais e perfis dos agentes (Clientes, Makers, Designers e Administradores).

---

## 📁 Estrutura do Novo Projeto

* `prisma/schema.prisma`: Modelagem do banco de dados multilateral (Usuários, Perfis de Maker/Designer, Catálogo 3D e Pedidos).
* `public/pitch_fabmakers.html`: Apresentação comercial de Pitch Interativo e Simulador Financeiro para investidores e clientes.
* `src/app/`: Lógica das rotas do Next.js (App Router).

---

## 💾 Modelagem de Banco de Dados (Prisma)

Nosso esquema modela as seguintes entidades principais:
* **User**: Contém credenciais e atribuição de papel (`CLIENT`, `MAKER`, `DESIGNER`, `ADMIN`).
* **MakerProfile**: Especificações das máquinas disponíveis, materiais em estoque (PLA, ABS, PETG), reputação do Maker e status de homologação de qualidade.
* **DesignerProfile**: Portfólio de designs 3D protegidos.
* **Model3D**: Arquivos 3D cadastrados com seu valor de royalty de licenciamento e opção de streaming de G-code.
* **Order**: Acompanhamento de status de produção (`PENDING_QUOTATION`, `PAID`, `PRINTING`, `SHIPPED`, `DELIVERED`, `COMPLETED`), divisão financeira de pagamentos e dados logísticos.

---

## ⚡ Próximos Passos Recomendados

1. **Testes de Roteamento de API**: Criar os primeiros endpoints no Next.js (`src/app/api/`) para cotação e upload de arquivos.
2. **Motor de Fatiamento (Cloud Slicing CLI)**: Integrar bibliotecas em python/node para fatiar arquivos STL em segundo plano e retornar gramatura e tempo estimados para cotação instantânea.
3. **Validação de Qualidade de Makers**: Desenhar o teste admissional padrão de impressão de tolerância mecânica.

---

*Projeto FabMakers3D — Todos os direitos reservados.*
