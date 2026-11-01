/*
 * Servidor do Pulim — serve o jogo e processa pagamentos.
 * Sem dependências: precisa apenas de Node.js 18+.
 *
 *   node server.js
 *
 * Pagamentos suportados (configure no arquivo .env — veja .env.example):
 *   - PayPal (cartão de crédito/débito e saldo PayPal, no mundo todo)   -> versão site
 *   - Pix via Mercado Pago (Brasil, aprovação instantânea)              -> versão site
 *   - Google Play Billing (obrigatório dentro do app da Play Store)     -> versão Android
 * Sem chaves configuradas, o servidor roda em MODO DEMO (compras de teste grátis).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- .env simples ----------
(function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

const CATALOG = require('./public/catalog.js');
// Catálogo do Blitz Estelar (jogo de tiro em /tiro/). Os códigos começam com "nb_".
const TIRO_CATALOG = require('./public/tiro/catalog.js');
const PRODUCTS = Object.assign({}, CATALOG.products, TIRO_CATALOG.products);
const PORT = Number(process.env.PORT) || 3000;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API =
  (process.env.PAYPAL_ENV || 'sandbox') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
// Google AdSense (anúncios com recompensa no Blitz Estelar). Ex.: ca-pub-1234567890123456
const ADSENSE_CLIENT = /^ca-pub-\d+$/.test(process.env.ADSENSE_CLIENT || '') ? process.env.ADSENSE_CLIENT : null;
const ADSENSE_TEST = process.env.ADSENSE_TEST === 'true';
// Google Play (app Android)
const GP_PACKAGE = process.env.GOOGLE_PLAY_PACKAGE || 'br.com.coopercloud.pulim';
const GP_SHA256 = (process.env.TWA_SHA256_FINGERPRINTS || '').split(',').map((x) => x.trim()).filter(Boolean);
const GP_SERVICE_ACCOUNT = loadServiceAccount();
const GP_ENABLED = Boolean(GP_SERVICE_ACCOUNT);
const PAYPAL_ENABLED = Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
const PIX_ENABLED = Boolean(MP_ACCESS_TOKEN);
const DEMO =
  process.env.DEMO_PURCHASES === 'true' ||
  (process.env.DEMO_PURCHASES !== 'false' && !PAYPAL_ENABLED && !PIX_ENABLED && !GP_ENABLED);

function loadServiceAccount() {
  // Aceita o JSON da conta de serviço como caminho de arquivo, JSON puro ou base64.
  const v = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!v) return null;
  try {
    let txt = v.trim();
    if (!txt.startsWith('{')) {
      txt = fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8') : Buffer.from(txt, 'base64').toString('utf8');
    }
    const j = JSON.parse(txt);
    return j.client_email && j.private_key ? j : null;
  } catch (e) {
    console.error('GOOGLE_SERVICE_ACCOUNT_JSON inválido:', e.message);
    return null;
  }
}

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'purchases.json');

// ---------- registro de vendas ----------
function loadPurchases() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}
let purchases = loadPurchases();
function recordPurchase(p) {
  if (purchases.some((x) => x.provider === p.provider && x.txId === p.txId)) return;
  purchases.push({ ...p, at: new Date().toISOString() });
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(purchases, null, 2));
  } catch (e) {
    console.error('Falha ao salvar compra:', e.message);
  }
  console.log(`💰 Venda: ${p.sku} R$${p.amount} via ${p.provider} (${p.txId})`);
}

function product(sku) {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, sku) ? PRODUCTS[sku] : null;
}
const money = (n) => Number(n).toFixed(2);

// ---------- PayPal ----------
let ppToken = { value: '', exp: 0 };
async function paypalToken() {
  if (ppToken.value && Date.now() < ppToken.exp) return ppToken.value;
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error('PayPal auth: ' + JSON.stringify(j));
  ppToken = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return ppToken.value;
}

async function paypalCreateOrder(sku) {
  const p = product(sku);
  if (!p) throw httpError(400, 'Produto inválido');
  const r = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await paypalToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: sku,
          description: `${p.game || 'Pulim'} - ${p.name}`,
          amount: { currency_code: CATALOG.currency, value: money(p.price) },
        },
      ],
      application_context: { brand_name: p.game || 'Pulim', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('PayPal create: ' + JSON.stringify(j));
  return { id: j.id };
}

async function paypalCapture(orderId) {
  if (!/^[A-Z0-9]{5,40}$/.test(orderId)) throw httpError(400, 'Pedido inválido');
  const headers = { Authorization: `Bearer ${await paypalToken()}`, 'Content-Type': 'application/json' };
  let r = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers });
  let j = await r.json();
  // Se já foi capturado antes (ex.: o jogador recarregou a página), busca o pedido.
  if (!r.ok && j && j.details && j.details.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) {
    r = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, { headers });
    j = await r.json();
  }
  if (!r.ok) throw new Error('PayPal capture: ' + JSON.stringify(j));
  const unit = j.purchase_units && j.purchase_units[0];
  const cap = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
  const sku = (cap && cap.custom_id) || (unit && unit.custom_id);
  const p = product(sku);
  if (j.status !== 'COMPLETED' || !cap || cap.status !== 'COMPLETED' || !p) {
    return { ok: false, status: (cap && cap.status) || j.status };
  }
  if (cap.amount.currency_code !== CATALOG.currency || money(cap.amount.value) !== money(p.price)) {
    return { ok: false, status: 'AMOUNT_MISMATCH' };
  }
  recordPurchase({ provider: 'paypal', txId: orderId, sku, amount: money(p.price) });
  return { ok: true, sku, grant: p.grant, txId: 'pp_' + orderId };
}

// ---------- Pix (Mercado Pago) ----------
async function pixCreate(sku, email) {
  const p = product(sku);
  if (!p) throw httpError(400, 'Produto inválido');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) throw httpError(400, 'E-mail inválido');
  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: Number(money(p.price)),
      description: `${p.game || 'Pulim'} - ${p.name}`,
      payment_method_id: 'pix',
      external_reference: sku,
      payer: { email },
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('Z', '-00:00'),
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Mercado Pago: ' + JSON.stringify(j));
  const td = (j.point_of_interaction && j.point_of_interaction.transaction_data) || {};
  return { id: String(j.id), qrBase64: td.qr_code_base64, qrCode: td.qr_code };
}

async function pixStatus(id) {
  if (!/^\d{1,20}$/.test(id)) throw httpError(400, 'Pagamento inválido');
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Mercado Pago status: ' + JSON.stringify(j));
  const sku = j.external_reference;
  const p = product(sku);
  if (j.status !== 'approved' || !p) return { ok: false, status: j.status };
  if (Math.abs(Number(j.transaction_amount) - p.price) > 0.001) return { ok: false, status: 'AMOUNT_MISMATCH' };
  recordPurchase({ provider: 'pix', txId: id, sku, amount: money(p.price) });
  return { ok: true, sku, grant: p.grant, txId: 'pix_' + id };
}


// ---------- Google Play Billing ----------
let gpToken = { value: '', exp: 0 };
async function googleToken() {
  if (gpToken.value && Date.now() < gpToken.exp) return gpToken.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned =
    b64({ alg: 'RS256', typ: 'JWT' }) +
    '.' +
    b64({
      iss: GP_SERVICE_ACCOUNT.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(GP_SERVICE_ACCOUNT.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Google auth: ' + JSON.stringify(j));
  gpToken = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return gpToken.value;
}

async function googlePlayVerify(sku, token) {
  const p = product(sku);
  if (!p) throw httpError(400, 'Produto inválido');
  if (typeof token !== 'string' || !/^[\w.\-]{10,600}$/.test(token)) throw httpError(400, 'Token inválido');
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GP_PACKAGE)}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
  const headers = { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' };
  const r = await fetch(base, { headers });
  const j = await r.json();
  if (!r.ok) throw new Error('Google Play verify: ' + JSON.stringify(j));
  // purchaseState: 0 = comprado, 1 = cancelado, 2 = pendente
  if (j.purchaseState !== 0) return { ok: false, status: ['PURCHASED', 'CANCELLED', 'PENDING'][j.purchaseState] || 'UNKNOWN' };
  // Itens de compra única são "reconhecidos"; gemas são "consumidas" (podem ser compradas de novo).
  // Sem isso o Google reembolsa a compra automaticamente em 3 dias.
  if (p.oncePerPlayer) {
    if (j.acknowledgementState === 0) {
      const a = await fetch(base + ':acknowledge', { method: 'POST', headers, body: '{}' });
      if (!a.ok) throw new Error('Google Play acknowledge: ' + (await a.text()));
    }
  } else if (j.consumptionState === 0) {
    const c = await fetch(base + ':consume', { method: 'POST', headers });
    if (!c.ok) throw new Error('Google Play consume: ' + (await c.text()));
  }
  const txId = j.orderId || token.slice(0, 40);
  recordPurchase({ provider: 'googleplay', txId, sku, amount: money(p.price) });
  return { ok: true, sku, grant: p.grant, txId: 'gp_' + txId };
}

// ---------- HTTP ----------
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': type.startsWith('application/json') ? 'no-store' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e5) {
        reject(httpError(413, 'Corpo muito grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(httpError(400, 'JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Preenche os dados da empresa nas páginas legais a partir do .env
const COMPANY = {
  '[PREENCHER CNPJ]': process.env.COMPANY_CNPJ,
  '[PREENCHER ENDEREÇO]': process.env.COMPANY_ADDRESS,
  '[PREENCHER E-MAIL DE SUPORTE]': process.env.SUPPORT_EMAIL,
};
function fillCompany(html) {
  for (const [k, v] of Object.entries(COMPANY)) if (v) html = html.split(k).join(v.replace(/[<>&"]/g, ''));
  return html;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Proibido', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
    if (file.endsWith('.html')) buf = fillCompany(buf.toString('utf8'));
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p === '/api/config' && req.method === 'GET') {
      return send(res, 200, {
        demo: DEMO,
        paypal: PAYPAL_ENABLED ? { clientId: PAYPAL_CLIENT_ID } : null,
        pix: PIX_ENABLED,
        googlePlay: GP_ENABLED,
        currency: CATALOG.currency,
        adsense: ADSENSE_CLIENT,
        adsenseTest: ADSENSE_TEST,
      });
    }
    if (p === '/api/paypal/orders' && req.method === 'POST') {
      if (!PAYPAL_ENABLED) throw httpError(503, 'PayPal não configurado');
      const { sku } = await readJson(req);
      return send(res, 200, await paypalCreateOrder(sku));
    }
    let m;
    if ((m = p.match(/^\/api\/paypal\/orders\/([^/]+)\/capture$/)) && req.method === 'POST') {
      if (!PAYPAL_ENABLED) throw httpError(503, 'PayPal não configurado');
      return send(res, 200, await paypalCapture(m[1]));
    }
    if (p === '/api/pix' && req.method === 'POST') {
      if (!PIX_ENABLED) throw httpError(503, 'Pix não configurado');
      const { sku, email } = await readJson(req);
      return send(res, 200, await pixCreate(sku, email));
    }
    if ((m = p.match(/^\/api\/pix\/([^/]+)$/)) && req.method === 'GET') {
      if (!PIX_ENABLED) throw httpError(503, 'Pix não configurado');
      return send(res, 200, await pixStatus(m[1]));
    }
    if (p === '/api/googleplay/verify' && req.method === 'POST') {
      if (!GP_ENABLED) throw httpError(503, 'Google Play não configurado');
      const { sku, token } = await readJson(req);
      return send(res, 200, await googlePlayVerify(sku, token));
    }
    if (p === '/.well-known/assetlinks.json' && req.method === 'GET') {
      // Prova para o Android que este site pertence ao app (necessário para o app abrir sem barra de endereço).
      return send(res, 200, [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: { namespace: 'android_app', package_name: GP_PACKAGE, sha256_cert_fingerprints: GP_SHA256 },
        },
      ]);
    }
    if (p === '/api/demo/purchase' && req.method === 'POST') {
      if (!DEMO) throw httpError(403, 'Modo demo desligado');
      const { sku } = await readJson(req);
      const prod = product(sku);
      if (!prod) throw httpError(400, 'Produto inválido');
      return send(res, 200, { ok: true, sku, grant: prod.grant, txId: 'demo_' + crypto.randomUUID() });
    }
    if (p === '/api/mp/webhook' && req.method === 'POST') {
      // Opcional: Mercado Pago avisa aqui. Confirmamos consultando a API (nunca confiamos no corpo).
      const body = await readJson(req).catch(() => ({}));
      const id = body && body.data && body.data.id;
      if (PIX_ENABLED && id) pixStatus(String(id)).catch((e) => console.error(e.message));
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/stats' && req.method === 'GET') {
      if (!ADMIN_KEY || url.searchParams.get('key') !== ADMIN_KEY) throw httpError(401, 'Não autorizado');
      const bySku = {};
      let total = 0;
      for (const x of purchases) {
        bySku[x.sku] = bySku[x.sku] || { vendas: 0, receita: 0 };
        bySku[x.sku].vendas++;
        bySku[x.sku].receita += Number(x.amount);
        total += Number(x.amount);
      }
      return send(res, 200, { vendas: purchases.length, receitaTotal: money(total), porProduto: bySku, ultimas: purchases.slice(-20).reverse() });
    }
    if (p.startsWith('/api/')) throw httpError(404, 'Rota não encontrada');
    if (p === '/tiro') {
      res.writeHead(301, { Location: '/tiro/' + url.search });
      return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, 'Método não permitido');
    return serveStatic(req, res, p);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Erro no servidor. Tente novamente.' });
  }
});

server.listen(PORT, () => {
  console.log(`🎮 Pulim rodando em http://localhost:${PORT}`);
  console.log(`🚀 Blitz Estelar (tiro) em http://localhost:${PORT}/tiro/`);
  console.log(`   AdSense (anúncios com recompensa): ${ADSENSE_CLIENT ? 'ATIVO' : 'desligado'}`);
  console.log(`   PayPal: ${PAYPAL_ENABLED ? 'ATIVO (' + PAYPAL_API + ')' : 'desligado'}`);
  console.log(`   Pix (Mercado Pago): ${PIX_ENABLED ? 'ATIVO' : 'desligado'}`);
  console.log(`   Google Play Billing: ${GP_ENABLED ? 'ATIVO (' + GP_PACKAGE + ')' : 'desligado'}`);
  if (!GP_SHA256.length) console.log('   (TWA_SHA256_FINGERPRINTS vazio: o app Android vai mostrar a barra de endereço)');
  if (DEMO) console.log('   ⚠️  MODO DEMO: compras são gratuitas (configure o .env para vender de verdade)');
});
