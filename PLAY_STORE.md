# 📱 Publicar o Pulim na Google Play — Cooper Cloud

Guia completo, na ordem certa. O código já está pronto. Aqui estão os cadastros e cliques que só a empresa pode fazer.

**Resumo do caminho**
1. Conta de desenvolvedor da Cooper Cloud (CNPJ)
2. Colocar o jogo no ar com domínio próprio
3. Gerar o app Android (`.aab`)
4. Criar o app no Play Console e enviar para teste interno
5. Ligar o site ao app (impressão digital)
6. Ligar o servidor ao Google Play (conta de serviço)
7. Cadastrar os produtos pagos
8. Preencher a ficha e as políticas
9. Testar uma compra e publicar

Tempo estimado: de 1 a 3 semanas, a maior parte esperando verificações da Google.

---

## Antes de começar: separe estes dados

| Item | Para quê |
|---|---|
| CNPJ, razão social e endereço da Cooper Cloud | Conta de desenvolvedor e páginas legais |
| **Número D-U-N-S** da empresa | **Obrigatório** para conta de organização. É gratuito: peça em https://www.dnb.com/duns-number/get-a-duns.html (no Brasil, pela Dun & Bradstreet). Pode levar alguns dias, então **peça primeiro**. |
| E-mail e telefone da empresa | Contato público na loja e verificação |
| Site da empresa | A Google pede um site para contas de organização |
| Conta bancária PJ | Para receber as vendas |
| Domínio para o jogo (ex.: `pulim.com.br`) | O app abre esse endereço |
| Cartão para a taxa de US$ 25 (pagamento único) | Registro da conta |

---

## Etapa 1 — Conta de desenvolvedor (organização)

1. Acesse https://play.google.com/console/signup com uma conta Google **da empresa** (ex.: `apps@coopercloud.com.br`), não uma pessoal.
2. Escolha **"Uma organização ou empresa"**.
3. Informe o D-U-N-S, os dados da Cooper Cloud e pague os US$ 25.
4. Conclua a verificação de identidade e da organização. A Google pode pedir documentos.

✅ Contas de organização **não precisam** do teste fechado obrigatório de 14 dias com 12 testadores, exigido de contas pessoais novas.

5. Depois de aprovado, vá em **Configuração › Perfil de pagamentos** e crie o **perfil de comerciante** com o CNPJ e a conta bancária PJ. Sem ele não é possível vender produtos no app.

---

## Etapa 2 — Colocar o jogo no ar

O app Android abre o site do jogo, então o servidor precisa estar online com HTTPS.

**Render.com** (o repositório já tem o arquivo `render.yaml`):
1. Crie uma conta em https://render.com e conecte o GitHub.
2. **New › Blueprint** e selecione este repositório.
3. Preencha as variáveis pedidas (`COMPANY_CNPJ`, `COMPANY_ADDRESS`, `SUPPORT_EMAIL`, e PayPal/Mercado Pago se for vender também pelo site). Deixe `GOOGLE_SERVICE_ACCOUNT_JSON` e `TWA_SHA256_FINGERPRINTS` para as etapas 5 e 6.
4. Em **Settings › Custom Domains**, adicione o seu domínio (ex.: `pulim.com.br`) e configure o DNS no Registro.br conforme o Render indicar.

Confira:
- `https://SEU-DOMINIO/` abre o jogo.
- `https://SEU-DOMINIO/privacidade.html` mostra o CNPJ e o e-mail preenchidos.

---

## Etapa 3 — Gerar o app Android (.aab)

Use o **Bubblewrap**, a ferramenta oficial do Google para transformar o site em app. Faça isso uma única vez num computador com Node.js.

```bash
npm install -g @bubblewrap/cli
mkdir pulim-android && cd pulim-android
bubblewrap init --manifest https://SEU-DOMINIO/manifest.webmanifest
```

Na primeira vez ele oferece baixar o Java e o Android SDK. Aceite. Depois responda às perguntas assim (`android/twa-manifest.json` neste repositório tem os mesmos valores, para consulta):

| Pergunta | Resposta |
|---|---|
| Domain | `SEU-DOMINIO` (sem https) |
| URL path | `/?src=twa` ← **importante**, é assim que o jogo sabe que está no app |
| Application name | `Pulim — Rumo às Nuvens` |
| Short name | `Pulim` |
| Application ID | `br.com.coopercloud.pulim` |
| Display mode | `fullscreen` |
| Orientation | `portrait` |
| Status bar color | `#5B8CFF` |
| Include support for Play Billing? | **Yes** ← obrigatório para as compras |
| Request geolocation permission? | No |
| Key store location / alias | `./pulim-upload.keystore` / `pulim` |

Ele cria a **chave de assinatura** (`pulim-upload.keystore`) e pede duas senhas.

> 🔐 **Guarde o arquivo `.keystore` e as senhas num lugar seguro, com backup** (ex.: cofre de senhas da empresa). Sem eles não dá para enviar atualizações do app. Nunca coloque esse arquivo no GitHub (o `.gitignore` já bloqueia).

Para gerar o app:
```bash
bubblewrap build
```
O resultado é `app-release-bundle.aab`, o arquivo enviado para a Play Store.

Ele também mostra a impressão digital SHA-256 da sua chave. Anote, porque ela é usada na etapa 5.

**Para lançar versões novas do app:** quase nunca é necessário, porque o jogo é atualizado direto no servidor. Só gere outro `.aab` se mudar ícone, nome ou configurações do app. Nesse caso aumente `appVersionCode` no `twa-manifest.json` e rode `bubblewrap update` e depois `bubblewrap build`.

---

## Etapa 4 — Criar o app no Play Console

1. **Criar app**: nome `Pulim: Rumo às Nuvens`, idioma padrão Português (Brasil), tipo **Jogo**, **Gratuito**. Aceite as declarações.
2. **Testar e lançar › Testes › Teste interno › Criar nova versão**.
3. Aceite o **Assinatura de apps do Google Play** (padrão).
4. Envie o `app-release-bundle.aab` e salve. Adicione o seu e-mail e o da equipe como testadores.
5. Abra o link de convite do teste interno no celular Android e instale.

---

## Etapa 5 — Ligar o site ao app (tela cheia, sem barra de endereço)

O Android só abre o jogo em tela cheia se o site provar que pertence ao app.

1. No Play Console: **Testar e lançar › Configuração › Integridade do app › Assinatura de apps**.
2. Copie o **SHA-256** do *Certificado da chave de assinatura do app* e também o da *chave de upload* (é o mesmo que o Bubblewrap mostrou).
3. No Render, defina a variável:
   ```
   TWA_SHA256_FINGERPRINTS=AA:BB:...(chave do app),CC:DD:...(chave de upload)
   ```
4. Confira em `https://SEU-DOMINIO/.well-known/assetlinks.json`. Deve aparecer `br.com.coopercloud.pulim` e as duas impressões.

Feche e reabra o app. A barra de endereço deve sumir. Se não sumir, a impressão digital está errada ou o domínio é diferente do usado no Bubblewrap.

---

## Etapa 6 — Ligar o servidor ao Google Play (validar compras)

O servidor confirma cada compra com a Google antes de entregar as gemas. Para isso ele precisa de uma **conta de serviço**.

1. Acesse https://console.cloud.google.com e crie um projeto (ex.: `pulim`).
2. **APIs e serviços › Biblioteca** e ative a **Google Play Android Developer API**.
3. **IAM e administrador › Contas de serviço › Criar conta de serviço** (nome: `pulim-billing`). Não precisa dar papéis no Cloud.
4. Abra a conta criada, vá em **Chaves › Adicionar chave › JSON** e baixe o arquivo.
5. No **Play Console › Usuários e permissões › Convidar novos usuários**, informe o e-mail da conta de serviço (termina em `iam.gserviceaccount.com`). Na aba do app Pulim, marque:
   - **Ver informações financeiras**
   - **Gerenciar pedidos e assinaturas**
6. No Render, cole **o conteúdo inteiro** do arquivo JSON na variável `GOOGLE_SERVICE_ACCOUNT_JSON`.

Ao reiniciar, o log do servidor deve mostrar `Google Play Billing: ATIVO (br.com.coopercloud.pulim)`.

> ⏳ A permissão nova pode levar até 24 horas para valer. Se a primeira compra de teste falhar com erro de permissão, espere e tente de novo.

---

## Etapa 7 — Cadastrar os produtos pagos

**Monetizar › Produtos › Produtos no app › Criar produto**. Crie os 6 produtos com os IDs exatos da tabela em [`store/ficha-play-store.md`](store/ficha-play-store.md#produtos-no-app-monetizar--produtos--produtos-no-app) e ative cada um.

(Essa tela só libera depois que um `.aab` com Play Billing foi enviado, o que já aconteceu na etapa 4.)

---

## Etapa 8 — Ficha da loja e políticas

Todos os textos e respostas estão em [`store/ficha-play-store.md`](store/ficha-play-store.md):
- **Presença na loja › Ficha principal**: nome, descrições, ícone, destaque e capturas de tela (pasta `store/`)
- **Política › Conteúdo do app**: privacidade, anúncios, classificação etária, público-alvo (Famílias), segurança dos dados

---

## Etapa 9 — Testar uma compra e publicar

1. **Configuração › Teste de licença**: adicione os e-mails de quem vai testar. Essas contas compram **sem ser cobradas**.
2. No celular com o app do teste interno, compre o Pacote Inicial:
   - aparece a trava dos responsáveis → a janela do Google Play → "Pagamento aprovado"
   - as gemas e o Dragão aparecem
   - `https://SEU-DOMINIO/api/admin/stats?key=SUA_ADMIN_KEY` mostra a venda com `provider: googleplay`
3. Desinstale e reinstale o app. O Pacote Inicial deve ser **restaurado** sozinho.
4. Tudo certo? **Testar e lançar › Produção › Criar nova versão**, use o mesmo `.aab` e envie para revisão. A primeira revisão costuma levar de alguns dias a 2 semanas.

---

## Como fica a cobrança

| Onde o jogador está | Como paga | Quem processa | Taxa |
|---|---|---|---|
| App da Play Store | Google Play (cartão, saldo Google Play, Pix pelo Google e outros) | Google | 15% até US$ 1 milhão/ano |
| Site do jogo | PayPal ou Pix | PayPal / Mercado Pago | taxa de cada um |

O jogo escolhe sozinho: dentro do app só aparece o Google Play, como a Google exige. No navegador aparecem PayPal e Pix. O dinheiro do Google Play é depositado mensalmente na conta PJ do perfil de comerciante.

**Impostos:** a Google emite os relatórios de ganhos em **Relatórios financeiros**. Passe-os ao contador da Cooper Cloud para a emissão das notas e a apuração.

---

## Checklist final

- [ ] D-U-N-S pedido
- [ ] Conta de desenvolvedor (organização) aprovada
- [ ] Perfil de comerciante com conta PJ
- [ ] Jogo no ar em `https://SEU-DOMINIO` com CNPJ e e-mail nas páginas legais
- [ ] `.aab` gerado e `.keystore` com backup seguro
- [ ] App no teste interno instalado no celular
- [ ] `assetlinks.json` correto (app abre sem barra de endereço)
- [ ] Conta de serviço ligada (`Google Play Billing: ATIVO` no log)
- [ ] 6 produtos criados e ativos
- [ ] Ficha da loja e Conteúdo do app preenchidos
- [ ] Compra de teste entregue e restaurada após reinstalar
- [ ] Enviado para produção
