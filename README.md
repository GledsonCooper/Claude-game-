# 🎮 Pulim — Rumo às Nuvens

Jogo web casual (roda em qualquer navegador, celular ou PC, sem instalar nada) com **loja integrada que vende itens por dinheiro real** via **PayPal (cartão/saldo PayPal)** e **Pix (Mercado Pago)** no site, e **Google Play Billing** no app Android.

> 📱 **Play Store:** o guia completo para publicar pela Cooper Cloud está em [`PLAY_STORE.md`](PLAY_STORE.md). Os textos e imagens da ficha estão na pasta [`store/`](store/).

O jogador controla o Pulim, que pula de nuvem em nuvem o mais alto que conseguir, coleta moedas, foge de nuvens de tempestade e desbloqueia personagens. Partidas de 1 a 3 minutos, um controle só (esquerda/direita) e visual fofo. Serve para criança, adolescente, adulto e para o "jogo rápido no celular" de quem tem 40+.

---

## 💰 Como o jogo ganha dinheiro

| Produto (dinheiro real) | Preço | O que entrega |
|---|---|---|
| **Pacote Inicial** (1x por jogador) | R$ 9,90 | 300 💎 + skin exclusiva Dragão + moedas em dobro para sempre |
| Punhado de Gemas | R$ 4,90 | 120 💎 |
| Saco de Gemas ⭐ mais vendido | R$ 19,90 | 650 💎 |
| Baú de Gemas | R$ 39,90 | 1.500 💎 |
| Tesouro Lendário | R$ 99,90 | 4.200 💎 + skin Galáxia |
| **Passe VIP** (1x) | R$ 14,90 | moedas x2 para sempre + skin Rei |

As **gemas 💎** são gastas dentro do jogo em:
- **Continuar de onde parou** depois de morrer (10 → 20 → 40 💎). É o momento em que o jogador mais quer pagar, porque acabou de quase bater o recorde.
- **Personagens premium** (Robô, Unicórnio, Astronauta, Fogaréu)
- **Itens de partida**: Foguete 🚀, Escudo 🛡️, Ímã 🧲
- Troca por moedas

Ganchos de venda que já estão no jogo:
- Botão pulsante **"Oferta Inicial"** no menu (pacote inicial é o que mais converte em jogos casuais)
- Na tela de fim de jogo: *"Com o Passe VIP você teria ganhado X moedas"*
- Faltou gema para continuar? A loja abre na hora
- Skins exclusivas que só vêm nos pacotes pagos
- **Prêmio diário** com sequência de 7 dias, para o jogador voltar todo dia (quem volta mais compra mais)
- Botão **"Desafiar amigos"**, que compartilha no WhatsApp/redes (divulgação grátis)

> ⚖️ **Jogo honesto com o público infantil:** não tem caixa de prêmio aleatório ("loot box"), todo item mostra exatamente o que entrega, e antes de qualquer pagamento aparece uma **trava para responsáveis** (uma conta de multiplicação). Isso reduz estorno, reclamação de pais e risco jurídico.

---

# 🚀 Blitz Estelar — jogo de tiro espacial (em `/tiro/`)

Segundo jogo do projeto, servido pelo mesmo servidor: **http://localhost:3000/tiro/**. Roda no navegador do celular e do PC, sem instalar nada. É leve: **cerca de 115 KB no total (35 KB compactado)**, sem bibliotecas, imagens ou arquivos de áudio. A nave, os inimigos, as explosões e a música são gerados por código.

### Por que vicia
- **Um dedo só**: o tiro é automático, o jogador só arrasta para desviar (no PC: mouse ou WASD, e Espaço para a bomba).
- **Ondas cada vez mais difíceis**, com 7 tipos de inimigo e **chefe a cada 5 ondas** (5 padrões de tiro).
- **Escolha 1 de 3 melhorias a cada nível** (tiro múltiplo, mísseis teleguiados, drone, onda de choque, escudo…), então cada partida sai diferente.
- **Combo multiplicador** de até x5, explosões, tremor de tela e vibração no celular.
- **Progresso permanente**: 7 naves, 6 melhorias no hangar, recorde de pontos e de onda.
- **Volta todo dia**: 3 missões diárias mais um baú bônus, e prêmio diário com sequência de 7 dias.

### Como ganha dinheiro
| Produto (dinheiro real) | Preço | Entrega |
|---|---|---|
| **Pacote Piloto** (1x) | R$ 9,90 | 300 💎 + nave Fênix + 5 bombas |
| Cristais Pequeno | R$ 4,90 | 120 💎 |
| Cofre de Cristais ⭐ | R$ 19,90 | 650 💎 |
| Carga de Cristais | R$ 39,90 | 1.500 💎 |
| Arsenal Lendário | R$ 99,90 | 4.200 💎 + nave Abismo + 15 bombas |
| **Passe Comandante** (1x) | R$ 14,90 | moedas x2 para sempre + 1 continuar grátis por partida + nave Imperial + sem anúncios |

Os cristais 💎 servem para **continuar depois de morrer** (10 → 20 → 40), **dobrar as moedas da partida**, comprar naves, itens (Largada Turbo, Bombas, Blindagem) e trocar por moedas.

**Anúncios com recompensa (opcional):** com `ADSENSE_CLIENT` no `.env`, o jogador pode assistir a um anúncio para continuar (1x por partida) ou dobrar as moedas. Também aparece um anúncio entre partidas a cada 3 jogos, nunca para quem tem o Passe. A integração usa o **Google AdSense H5 Games Ads**: peça acesso ao programa de jogos H5 na sua conta AdSense e publique o arquivo `ads.txt` no domínio. Sem a chave, no modo demo aparece um anúncio *simulado* para testar o fluxo.

Os pagamentos usam o mesmo PayPal, Pix e painel de vendas do Pulim. Os produtos ficam em `public/tiro/catalog.js` (códigos `nb_...`), e o servidor junta os dois catálogos sozinho. A trava para responsáveis e a recuperação de compras interrompidas também valem aqui.

> 💡 **Portais de jogos** (CrazyGames, Poki, GameDistribution) pagam por anúncio exibido e trazem milhões de jogadores. O Blitz Estelar é um bom candidato: leve, carrega rápido, funciona com mouse e toque. Cada portal tem seu SDK de anúncios e regras sobre compras dentro do jogo, então leia antes de enviar.

### Arquivos
```
public/tiro/index.html   Telas
public/tiro/style.css    Visual neon
public/tiro/game.js      Motor: naves, inimigos, chefes, melhorias, som sintetizado
public/tiro/app.js       Menus, hangar, loja, missões, anúncios, pagamentos
public/tiro/catalog.js   ⭐ Produtos e preços do Blitz Estelar
```

---

## 🚀 Rodar no seu computador (5 minutos)

Requisito: [Node.js 18 ou mais novo](https://nodejs.org). Não precisa instalar pacotes.

```bash
node server.js
```

Abra http://localhost:3000. Sem chaves configuradas o jogo roda em **MODO DEMO**: as compras são grátis, só para você testar o fluxo.

---

## 💳 Ativar pagamentos de verdade

```bash
cp .env.example .env    # depois edite o .env
```

### 1) PayPal (cartão de crédito/débito no mundo todo)
1. Crie uma **conta PayPal Empresarial** (grátis) em https://www.paypal.com/br/business
2. Entre em https://developer.paypal.com/dashboard/applications e crie um app
3. Copie o **Client ID** e o **Secret** para o `.env`
4. Teste primeiro com `PAYPAL_ENV=sandbox` (dinheiro fictício). Quando tudo funcionar, troque pelas credenciais **Live** e use `PAYPAL_ENV=live`

O dinheiro cai no seu saldo PayPal, e de lá você saca para sua conta bancária.

### 2) Pix via Mercado Pago (o meio preferido no Brasil)
1. Crie uma conta em https://www.mercadopago.com.br e **cadastre uma chave Pix** nela
2. Em https://www.mercadopago.com.br/developers/panel/app crie uma aplicação
3. Copie o **Access Token de produção** (começa com `APP_USR-`) para `MP_ACCESS_TOKEN` no `.env`
4. (Opcional) Configure o webhook para `https://SEU-SITE/api/mp/webhook`

O jogador vê um QR Code e o código "copia e cola". Quando ele paga no app do banco, o item aparece no jogo em poucos segundos.

Com qualquer um dos dois configurado, o modo demo desliga sozinho.

### Ver quanto você está vendendo
Defina `ADMIN_KEY` no `.env` e acesse:
```
https://SEU-SITE/api/admin/stats?key=SUA_SENHA
```
Mostra o total de vendas, a receita por produto e as últimas compras. O registro fica em `data/purchases.json`.

### Segurança dos pagamentos
- O **preço é sempre definido pelo servidor** (`public/catalog.js`). O navegador não consegue alterar o valor cobrado.
- O servidor só entrega o item depois de **confirmar com o PayPal/Mercado Pago** que o pagamento foi aprovado e que o valor confere.
- Se o jogador fechar a página no meio do pagamento, a compra é **recuperada e entregue** na próxima visita.

---

## 🌍 Colocar no ar (para o público acessar)

Qualquer hospedagem que rode Node.js serve. Opções fáceis:

- **Render.com**: New → Web Service → conecte este repositório → Start command `node server.js` → adicione as variáveis do `.env` em *Environment*.
- **Railway.app** ou **Fly.io**: mesmo processo.
- **VPS** (Hostinger, DigitalOcean, Contabo): `node server.js` com `pm2`, atrás de Nginx com HTTPS.

⚠️ **HTTPS é obrigatório** para pagamentos (essas plataformas já entregam HTTPS). Em hospedagens com disco temporário (como o plano grátis do Render), o arquivo `data/purchases.json` pode ser apagado a cada deploy. O histórico oficial de vendas continua nos painéis do PayPal e do Mercado Pago.

Depois compre um domínio curto (ex.: `pulim.com.br`, cerca de R$ 40/ano no Registro.br).

---

## 📈 Como vender mais rápido (o que realmente traz dinheiro)

O código da loja está pronto, mas **o faturamento depende de tráfego**. Sem gente jogando, não há venda. Em jogos casuais, uma referência comum é que só 1% a 5% dos jogadores compram algo. Então:

1. **Vídeos curtos (TikTok, Reels, Shorts)** do jogo: recordes, quase-quedas, "duvido você passar de 1000m". É o canal mais barato e o que mais funciona para esse público.
2. **Portais de jogos web**: publique também no CrazyGames, Poki e itch.io. Eles trazem milhões de jogadores (alguns têm regras próprias sobre pagamentos dentro do jogo, então leia antes).
3. **WhatsApp**: o botão "Desafiar amigos" já gera o link. Faça campanhas como "quem passar meu recorde ganha 💎".
4. **Anúncios pagos** (Meta/TikTok Ads) só depois de medir que a receita por jogador cobre o custo por clique.
5. **Datas especiais**: crie pacotes temporários (Natal, Dia das Crianças, Black Friday) editando `public/catalog.js`.
6. **Teste preços**: mude os valores em `public/catalog.js` e compare as vendas no `/api/admin/stats`.

---

## 📋 Antes de lançar (obrigações legais no Brasil)

- **Termos de uso e política de privacidade** (LGPD). O jogo não coleta dados pessoais além do e-mail do pagador no Pix, que vai para o Mercado Pago.
- **Público infantil (ECA e CDC)**: a trava para responsáveis já está implementada. Evite publicidade direcionada a crianças pedindo que comprem.
- **Política de reembolso** (direito de arrependimento: 7 dias pelo CDC). Coloque um e-mail de suporte visível.
- **Impostos**: a venda de itens digitais é receita tributável. Um **MEI** ou CNPJ simples resolve no começo. Converse com um contador.

---

## 🗂️ Estrutura

```
server.js              Servidor (arquivos do jogo + API de pagamentos), sem dependências
public/index.html      Telas do jogo
public/style.css       Visual
public/game.js         Motor do jogo (física, fases, personagens desenhados por código)
public/app.js          Menus, progresso salvo, loja, PayPal, Pix, prêmio diário
public/catalog.js      ⭐ Produtos e preços. Edite aqui para mudar valores
public/privacidade.html, termos.html   Páginas legais (CNPJ e e-mail vêm do .env)
.env.example           Modelo de configuração dos pagamentos
render.yaml            Deploy em 1 clique no Render.com
PLAY_STORE.md          Guia de publicação na Google Play
android/               Configuração do app Android (Bubblewrap/TWA)
store/                 Ícone, banner, capturas de tela e textos da Play Store
tools/gerar-imagens.js Gera ícones e capturas de tela de novo, se o visual mudar
```

O progresso do jogador fica salvo no navegador dele (localStorage).
