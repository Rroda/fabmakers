# Origem da Ideia: FabMakers / Tekna3D

Este documento registra a concepção original da ideia da FabMakers (inicialmente pensada como uma evolução da Tekna/Tekna3D) e os insights que moldaram o modelo de negócio de manufatura digital distribuída.

---

## 1. A Ideia Original (Ricardo)

A ideia surgiu da observação do **MakerWorld** (plataforma da Bambu Lab), que é uma das maiores comunidades de impressão 3D do mundo. 

**O Problema Identificado:**
Muitas pessoas entram no MakerWorld, gostam de algum objeto/modelo 3D, mas não podem comprá-lo porque a plataforma não vende o produto físico. O usuário precisa ter uma impressora 3D ou encontrar alguém que imprima para ele.

**A Proposta Inicial:**
"Raspar" os produtos/modelos do site MakerWorld, precificá-los de forma automatizada e vendê-los.
* **Modelo de Produção:** Inicialmente com produção própria, evoluindo para a descentralização do trabalho para makers parceiros (terceirização, de forma análoga ao mercado de costura, onde as costureiras possuem as máquinas de costura e os agentes passam o trabalho, matéria-prima e clientes).
* **Posicionamento:** Tornar o site da Tekna uma referência de conexão (como um "GetNinjas" ou "Uber" da impressão 3D), conectando donos de impressoras que estão com as máquinas ociosas a clientes finais, cobrando uma comissão pela intermediação.

---

## 2. Análise Estratégica e Ajustes (Resposta do Mentor/IA)

A ideia foi validada como tendo potencial de escala de dezenas ou centenas de milhões, desde que seguisse um modelo de **plataforma (asset-light)** e fizesse ajustes cruciais.

### 2.1. O Pivot de Mentalidade
Não criar apenas uma loja de impressão 3D, mas sim a **infraestrutura de impressão 3D no Brasil** (assim como Uber, Airbnb e iFood fizeram em seus mercados). A plataforma vende a **capacidade ociosa** (horas livres) das impressoras parceiras, e não plástico impresso.

### 2.2. A Barreira Jurídica e de Licenciamento
* **O Risco:** Raspar o catálogo do MakerWorld sem autorização infringe direitos autorais. Muitos modelos possuem licenças do tipo *Non-Commercial* (não comercial), *Attribution* (atribuição obrigatória) ou impedem a redistribuição.
* **A Solução:** Criar um ecossistema sustentável. A Tekna/FabMakers funciona como uma vitrine onde o designer publica o modelo e escolhe habilitar a opção de venda física (impressa).
  * **Fluxo de Ganhos:** Cliente compra -> Plataforma distribui -> Designer recebe royalties -> Maker parceiro imprime -> Transportadora entrega -> Plataforma retém comissão.

### 2.3. O Modelo "Costureira" (Manufatura Distribuída)
O paralelo com a costura é perfeito para a impressão 3D:
1. **Parceiros (Makers):** Cadastram suas impressoras, materiais, cores, volume máximo e horários disponíveis. Começam a receber ordens de produção conforme a capacidade ociosa.
2. **Pedidos em Lote:** Se uma empresa precisar de 400 peças, em vez de cotar com várias empresas pequenas, ela envia o arquivo para a plataforma, que divide a produção automaticamente entre múltiplos makers regionais (ex: 100 em Campinas, 80 em Curitiba, 120 em BH, 100 em SP).

### 2.4. Posicionamento Estratégico
Substituir o termo "Loja de Impressão 3D" por:
> **"A maior rede brasileira de fabricação digital sob demanda"**

---

## 3. Estrutura da Plataforma Recomendada

* **Para Clientes:** Compra de produtos físicos, upload de STL/STEP/OBJ para orçamento, contratação de serviços de modelagem 3D, acompanhamento do status em tempo real.
* **Para Designers:** Venda de licenças digitais/STL e recebimento automático de royalties por impressão física realizada.
* **Para Makers:** Cadastro de equipamentos, materiais, aceitação de ordens de serviço locais e recebimento do valor da manufatura.
* **Para Empresas:** Painel corporativo com biblioteca privada, pedidos recorrentes de protótipos/lotes e integração via API.
* **Algoritmo de Roteamento (Coração do Negócio):** Decide quem produz com base em:
  $$\text{Roteamento} = f(\text{distância}, \text{qualidade}, \text{avaliações}, \text{preço}, \text{tecnologia da impressora}, \text{material disponível})$$

---

## 4. O Roteiro de Crescimento em 3 Etapas

1. **Etapa 1 (Validação de Processo):** Produzir utilizando a capacidade interna da própria Tekna para testar o algoritmo de precificação, controle de qualidade, embalagem e logística de ponta a ponta.
2. **Etapa 2 (Escalonamento Controlado):** Introduzir makers parceiros certificados para absorver picos de demanda ou cobrir regiões de frete mais caras.
3. **Etapa 3 (Marketplace Puro):** Transicionar para a distribuição automatizada onde o papel principal da plataforma é a orquestração e a garantia de qualidade (QA), retendo comissões sobre o valor total do ecossistema.
