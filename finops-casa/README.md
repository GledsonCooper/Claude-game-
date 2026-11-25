# 🏠 FinOps Casa — FinOps residencial

O método FinOps (o que empresas usam para controlar o custo da nuvem) aplicado às contas da casa.
É um arquivo só (`index.html`): **abra no navegador e use**. Não precisa instalar nada nem criar conta, e os dados ficam salvos só no seu navegador (faça backup em *Casa & Dados*).

## Como começar (2 minutos)
1. Abra `finops-casa/index.html` no navegador (PC ou celular).
2. Clique em **Começar do zero**: nome da casa, área, renda e moradores. Se quiser só conhecer, use **Ver com dados de exemplo**.
3. Lance gastos com **+ Lançar gasto** ou importe o **extrato CSV** do banco em *Lançamentos*.
4. Uma vez por mês, siga o **Ritual mensal** (checklist de 10 itens, 15 a 30 minutos).

## Cobertura do FinOps Framework

| Fase | Domínio / capacidade FinOps | Tela |
|---|---|---|
| **Informar** | Ingestão de dados | Lançamentos (manual + CSV com categorização automática e deduplicação) |
| | Alocação | Alocação & Rateio (categoria, essencial/estilo, quem consumiu) |
| | Relatórios & Análises | Relatórios (12 meses, composição, top 10, exportação CSV) |
| | Gestão de anomalias | Anomalias (categoria acima da média, valor fora do padrão, cobrança duplicada) |
| | Economia unitária | Custos unitários (por morador, m², dia, R$/kWh, R$/m³, % da renda) |
| **Otimizar** | Orçamento + Previsão | Orçamento & Previsão (por categoria, fechamento do mês e próximos 3 meses) |
| | Planejamento & Estimativa / Onboarding | Planejamento (novos gastos recorrentes, à vista × parcelado, quanto guardar) |
| | Otimização de tarifas | Tarifas & Contratos (alternativas cotadas, plano anual × mensal) |
| | Otimização de uso / Arquitetura / Sustentabilidade | Consumo (leituras por pessoa, payback de melhorias, CO₂) |
| | Licenças & SaaS | Assinaturas (inventário, uso, ociosidade) |
| | Motor de otimização | Recomendações (economia estimada; "Apliquei" registra o valor) |
| **Operar** | Políticas & Governança | Políticas (aprovação de compras grandes, tetos 50/30/20, regras de categorização) |
| | Quantificar valor | Valor & Metas (economia realizada, metas, cobertura da reserva) |
| | Benchmarking | Benchmarking (50/30/20, moradia × renda, mês × histórico) |
| | Faturamento & Chargeback | Alocação & Rateio (showback por morador e acerto "quem paga quem") |
| | Operações da prática | Ritual mensal |
| | Avaliação de maturidade | Maturidade (Engatinhar → Andar → Correr) |
| | Educação & Capacitação / Disciplinas que se cruzam | Aprender (princípios, glossário, papéis) |
| | Ferramentas & Serviços | Casa & Dados (backup/restauração JSON, CSV, tema) |

A tela **Mapa FinOps** dentro do app mostra essa mesma tabela, com links.

## Formato do CSV
Precisa ter cabeçalho com colunas de **data**, **descrição/histórico** e **valor**, em qualquer ordem, separadas por `;` ou `,`. Datas no formato `dd/mm/aaaa` ou `aaaa-mm-dd`. Se o arquivo tiver valores negativos, só eles (os débitos) são importados.
