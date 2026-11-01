# Ficha do Pulim na Google Play — textos para copiar e colar

## Detalhes do app (Presença na loja › Ficha principal)

**Nome do app** (máx. 30 caracteres)
```
Pulim: Rumo às Nuvens
```

**Descrição curta** (máx. 80 caracteres)
```
Pule de nuvem em nuvem, colete moedas e desbloqueie personagens fofos!
```

**Descrição completa** (máx. 4.000 caracteres)
```
Até onde o Pulim consegue chegar? ☁️

Pulim é um jogo de pulo infinito, fácil de aprender e difícil de largar. Toque nos lados da tela para guiar o Pulim de nuvem em nuvem, cada vez mais alto. Passe pelo pôr do sol e pela noite e chegue até o espaço!

🎮 FÁCIL DE JOGAR
• Um toque só: esquerda ou direita
• Partidas rápidas, perfeitas para qualquer momento
• Diversão para crianças, jovens, adultos e toda a família

☁️ DESAFIOS NO CAMINHO
• Nuvens que se movem e plataformas que quebram
• Molas que lançam você lá em cima
• Nuvens de tempestade: pule em cima delas para ganhar moedas!

🐉 PERSONAGENS INCRÍVEIS
• Desbloqueie a Lulu, o Sapinho, o Gatíneo, o Ninja, o Robô-X, o Unicórnio, o Astronauta e muito mais
• Cada personagem tem seu estilo e alguns deixam um rastro especial

🚀 ITENS ESPECIAIS
• Foguete para começar voando
• Escudo que salva você de uma queda
• Ímã que puxa todas as moedas

🎁 PRÊMIO DIÁRIO
Volte todo dia e ganhe recompensas cada vez maiores.

🏆 DESAFIE SEUS AMIGOS
Bata seu recorde e chame os amigos para tentar passar você.

O Pulim é gratuito para jogar. Itens opcionais podem ser comprados dentro do jogo, sempre mostrando exatamente o que você recebe, sem caixas de prêmio aleatório. Antes de qualquer compra aparece uma verificação para pais e responsáveis.

Sem anúncios. Sem cadastro. Seu progresso fica salvo no aparelho.
```

**Imagens** (pasta `store/`)
| Campo | Arquivo |
|---|---|
| Ícone do app (512×512) | `store/icone-play-512.png` |
| Imagem de destaque (1024×500) | `store/destaque-1024x500.png` |
| Capturas de tela do telefone (mín. 2) | `store/screenshots/1-menu.png` a `5-premio-diario.png` |

**Categoria:** Jogos › Casual
**Tags sugeridas:** Casual, Arcade, Pular, Fofo, Toque único
**E-mail de contato:** o mesmo de `SUPPORT_EMAIL`
**Site:** `https://SEU-DOMINIO.com.br`
**Política de privacidade:** `https://SEU-DOMINIO.com.br/privacidade.html`

---

## Conteúdo do app (Política › Conteúdo do app)

**Política de privacidade:** `https://SEU-DOMINIO.com.br/privacidade.html`

**Anúncios:** Não, meu app não contém anúncios.

**Acesso ao app:** Todas as funcionalidades estão disponíveis sem acesso especial (não tem login).

**Classificação de conteúdo** (questionário IARC). Respostas sugeridas:
- Categoria: Jogo
- Violência: apenas violência de desenho/fantasia leve (o personagem pula em cima de nuvens de tempestade, que somem). Sem sangue.
- Medo, sexualidade, linguagem imprópria, drogas, jogos de azar: **Não**
- Interação entre usuários / compartilhamento de localização: **Não**
- Compras digitais: **Sim**
- Itens aleatórios pagos (loot box): **Não**

Resultado esperado: classificação Livre (ClassInd) / PEGI 3, com o aviso "Compras no app".

**Público-alvo e conteúdo**
- Faixas etárias: marque **5 a 8, 9 a 12, 13 a 15, 16 a 17 e 18+** para atingir todos os públicos.
- Ao incluir menores de 13 anos, o app entra no **Programa Famílias** da Google. O Pulim já atende os pontos principais: sem anúncios, sem coleta de dados de crianças, sem SDKs de terceiros, preços claros e verificação para responsáveis antes de compras.
- "O app pode atrair crianças sem querer?": não se aplica, pois o público infantil é intencional.

**Segurança dos dados** (Data safety). Respostas:
- O app coleta ou compartilha algum dos tipos de dados exigidos? **Sim**, só por causa das compras:
  - **Informações financeiras › Histórico de compras:** coletado. Finalidade: funcionalidade do app (entregar o item) e prevenção de fraudes. Não é compartilhado com terceiros para outras finalidades. Coleta obrigatória para quem compra.
- Os dados são criptografados em trânsito? **Sim** (HTTPS).
- Os usuários podem pedir a exclusão dos dados? **Sim**, pelo e-mail de suporte.
- Os pagamentos são processados pelo Google Play. O app nunca recebe dados de cartão.

**App de notícias / governo / recursos financeiros / saúde:** Não.

---

## Produtos no app (Monetizar › Produtos › Produtos no app)

Crie **exatamente** estes IDs (o jogo e o servidor usam estes nomes):

| ID do produto | Nome | Descrição | Preço (BRL) |
|---|---|---|---|
| `starter` | Pacote Inicial | 300 gemas + skin Dragão + moedas em dobro para sempre | R$ 9,90 |
| `gems_small` | Punhado de Gemas | 120 gemas | R$ 4,90 |
| `gems_medium` | Saco de Gemas | 650 gemas | R$ 19,90 |
| `gems_large` | Baú de Gemas | 1.500 gemas | R$ 39,90 |
| `gems_mega` | Tesouro Lendário | 4.200 gemas + skin Galáxia | R$ 99,90 |
| `vip` | Passe VIP | Moedas em dobro para sempre + skin Rei | R$ 14,90 |

Ative cada produto depois de criar. Se mudar algum preço, altere também em `public/catalog.js`, porque o servidor usa esse arquivo para o relatório de vendas e para a versão site.
