/* Pulim — interface, progresso, loja e pagamentos */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const { SKINS, skinById, drawCharacter, Sound } = window.Game;
  const CAT = window.CATALOG;
  const fmtBRL = (n) => 'R$ ' + n.toFixed(2).replace('.', ',');

  // ---------------- Progresso salvo ----------------
  const SAVE_KEY = 'pulim_save_v1';
  const defaults = {
    coins: 0, gems: 0, best: 0, games: 0,
    skins: ['classic'], skin: 'classic',
    items: { jetpack: 0, shield: 0, magnet: 0 },
    use: { jetpack: true, shield: true, magnet: true },
    vip: false, bought: {}, txs: [], pending: [],
    daily: { last: '', streak: 0 }, sound: true,
  };
  let S = load();
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (raw) return Object.assign({}, defaults, raw, { items: Object.assign({}, defaults.items, raw.items), use: Object.assign({}, defaults.use, raw.use) });
    } catch (e) { /* armazenamento indisponível */ }
    return JSON.parse(JSON.stringify(defaults));
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    refreshWallet();
  }
  Sound.on = S.sound;

  // ---------------- Configuração do servidor ----------------
  let CONFIG = { demo: true, paypal: null, pix: false, offline: true };
  fetch('/api/config').then((r) => r.ok ? r.json() : Promise.reject()).then((c) => { CONFIG = c; recoverPending(); }).catch(() => {});

  // ---------------- Itens consumíveis ----------------
  const ITEMS = [
    { id: 'jetpack', icon: '🚀', name: 'Foguete', desc: 'Começa a partida voando alto', offers: [{ qty: 1, gems: 20 }, { qty: 5, gems: 80, tag: '-20%' }] },
    { id: 'shield', icon: '🛡️', name: 'Escudo', desc: 'Salva você de uma queda ou inimigo', offers: [{ qty: 1, coins: 300 }, { qty: 3, gems: 30 }] },
    { id: 'magnet', icon: '🧲', name: 'Ímã', desc: 'Puxa as moedas para você a partida toda', offers: [{ qty: 1, coins: 400 }, { qty: 5, gems: 40, tag: '-30%' }] },
  ];

  // ---------------- UI geral ----------------
  const screens = ['menu', 'pause', 'over', 'skins', 'shop', 'daily'];
  function show(id) {
    screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
    $('hud').classList.toggle('hidden', id !== null);
    $('wallet').classList.toggle('hidden', id === null || id === 'pause');
    if (id === 'menu') renderMenu();
  }
  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.add('hidden'), ms || 2500);
  }
  function refreshWallet() {
    $('wCoins').textContent = S.coins.toLocaleString('pt-BR');
    $('wGemsN').textContent = S.gems.toLocaleString('pt-BR');
  }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => show('menu')));
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: false });

  // ---------------- Menu ----------------
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function dailyReady() { return S.daily.last !== today(); }

  let boostsRow;
  function renderMenu() {
    $('bestScore').textContent = S.best + 'm';
    $('btnStarter').classList.toggle('hidden', !!S.bought.starter);
    $('btnDaily').classList.toggle('ready', dailyReady());
    $('btnSound').textContent = S.sound ? '🔊 Som: ligado' : '🔇 Som: desligado';
    if (!boostsRow) {
      boostsRow = document.createElement('div');
      boostsRow.className = 'row';
      $('btnPlay').before(boostsRow);
    }
    boostsRow.innerHTML = '';
    ITEMS.forEach((it) => {
      const n = S.items[it.id];
      const b = document.createElement('button');
      b.className = 'pill';
      const on = n > 0 && S.use[it.id];
      b.style.opacity = on ? 1 : 0.55;
      b.textContent = `${it.icon} ${n > 0 ? (on ? '✓ ' : '') + 'x' + n : '+'}`;
      b.title = it.name;
      b.onclick = () => {
        if (n === 0) { openShop('items'); return; }
        S.use[it.id] = !S.use[it.id];
        save();
        renderMenu();
      };
      boostsRow.appendChild(b);
    });
    refreshWallet();
  }

  const pv = $('menuPreview').getContext('2d');
  (function animPreview(ts) {
    const t = ts / 1000;
    pv.clearRect(0, 0, 160, 160);
    const y = 95 - Math.abs(Math.sin(t * 3)) * 30;
    const sq = Math.max(0, Math.cos(t * 3 * 2) * 0.3);
    pv.fillStyle = 'rgba(0,0,0,.12)';
    pv.beginPath();
    pv.ellipse(80, 140, 30 - (95 - y) * 0.3, 6, 0, 0, 7);
    pv.fill();
    drawCharacter(pv, S.skin, 80, y, 40, { t, squash: y > 90 ? sq : -0.05 });
    requestAnimationFrame(animPreview);
  })(0);

  $('btnSound').onclick = () => { S.sound = Sound.on = !S.sound; save(); renderMenu(); };
  $('btnSkins').onclick = () => { renderSkins(); show('skins'); };
  $('btnShop').onclick = () => openShop('gems');
  $('wGems').onclick = () => openShop('gems');
  $('btnStarter').onclick = () => buy('starter');
  $('btnDaily').onclick = () => { renderDaily(); show('daily'); };

  // ---------------- Partida ----------------
  let banked = 0;
  function startGame() {
    Sound.unlock();
    const opts = { skin: S.skin, coinMult: S.vip ? 2 : 1 };
    ITEMS.forEach((it) => {
      if (S.items[it.id] > 0 && S.use[it.id]) { opts[it.id] = true; S.items[it.id]--; }
    });
    S.games++;
    save();
    banked = 0;
    $('hudScore').textContent = '0';
    $('hudCoins').textContent = '0';
    window.Game.start(opts);
    show(null);
  }
  $('btnPlay').onclick = startGame;
  $('btnAgain').onclick = () => { stopRevive(); startGame(); };
  $('btnMenu').onclick = () => { stopRevive(); window.Game.toIdle(); show('menu'); };
  $('btnPause').onclick = () => { window.Game.pause(); show('pause'); };
  $('btnResume').onclick = () => { show(null); window.Game.resume(); };
  $('btnQuit').onclick = () => { const g = window.Game; bankCoins(g.runCoins()); g.toIdle(); show('menu'); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.Game.state === 'play') { window.Game.pause(); show('pause'); }
  });

  function bankCoins(total) {
    const delta = total - banked;
    if (delta > 0) { S.coins += delta; banked = total; save(); }
  }

  let reviveTimer = null;
  function stopRevive() { if (reviveTimer) { cancelAnimationFrame(reviveTimer); reviveTimer = null; } }
  function reviveCost() { return 10 * Math.pow(2, window.Game.revives || 0); }

  function onDie(score, runCoins) {
    bankCoins(runCoins);
    const record = score > S.best;
    if (record) S.best = score;
    save();
    $('finalScore').textContent = score + 'm';
    $('newRecord').classList.toggle('hidden', !record);
    $('earnedCoins').textContent = runCoins;
    $('vipTag').classList.toggle('hidden', !S.vip);
    $('vipUpsell').classList.toggle('hidden', S.vip || runCoins < 5);
    $('upsellCoins').textContent = runCoins * 2;
    // continuar com gemas (só até 3 vezes por partida)
    const canRevive = (window.Game.revives || 0) < 3 && score > 30;
    $('reviveBox').classList.toggle('hidden', !canRevive);
    setTimeout(() => {
      show('over');
      if (canRevive) {
        $('reviveCost').textContent = reviveCost();
        const start = performance.now(), dur = 6000;
        const tick = (now) => {
          const f = 1 - (now - start) / dur;
          $('reviveBar').style.width = Math.max(0, f * 100) + '%';
          if (f <= 0) { $('reviveBox').classList.add('hidden'); reviveTimer = null; return; }
          reviveTimer = requestAnimationFrame(tick);
        };
        stopRevive();
        reviveTimer = requestAnimationFrame(tick);
      }
    }, 600);
  }
  $('btnRevive').onclick = () => {
    const cost = reviveCost();
    if (S.gems < cost) {
      stopRevive();
      toast('Gemas insuficientes — pegue mais na loja! 💎');
      openShop('gems');
      return;
    }
    S.gems -= cost;
    save();
    stopRevive();
    show(null);
    window.Game.revive();
  };
  $('btnUpsell').onclick = () => buy('vip');
  $('btnShare').onclick = async () => {
    const text = `Pulei ${S.best}m no Pulim! 🚀 Duvido você me passar:`;
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) await navigator.share({ title: 'Pulim', text, url });
      else { await navigator.clipboard.writeText(text + ' ' + url); toast('Link copiado! Cole no WhatsApp 😉'); }
    } catch (e) { /* cancelado */ }
  };

  window.Game.init($('game'), {
    onScore: (s) => { $('hudScore').textContent = s; },
    onCoins: (c) => { $('hudCoins').textContent = c; },
    onDie,
    onPauseKey: () => {
      if (window.Game.state === 'play') { window.Game.pause(); show('pause'); }
      else if (window.Game.state === 'pause') { show(null); window.Game.resume(); }
    },
  });

  // ---------------- Personagens ----------------
  function renderSkins() {
    const grid = $('skinGrid');
    grid.innerHTML = '';
    SKINS.forEach((s) => {
      const owned = S.skins.includes(s.id);
      const card = document.createElement('div');
      card.className = 'card' + (S.skin === s.id ? ' selected' : '');
      const c = document.createElement('canvas');
      c.width = c.height = 180;
      drawCharacter(c.getContext('2d'), s.id, 90, 100, 52, { t: 0.3 });
      card.appendChild(c);
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = s.name;
      card.appendChild(name);
      const btn = document.createElement('button');
      btn.className = 'btn';
      if (owned) {
        btn.textContent = S.skin === s.id ? '✓ Usando' : 'Usar';
        btn.onclick = () => { S.skin = s.id; save(); renderSkins(); };
      } else if (s.price.coins) {
        btn.textContent = '🪙 ' + s.price.coins;
        btn.onclick = () => spend('coins', s.price.coins, () => { S.skins.push(s.id); S.skin = s.id; }, renderSkins);
      } else if (s.price.gems) {
        btn.className = 'btn gold';
        btn.textContent = '💎 ' + s.price.gems;
        btn.onclick = () => spend('gems', s.price.gems, () => { S.skins.push(s.id); S.skin = s.id; }, renderSkins);
      } else if (s.price.iap) {
        const p = CAT.products[s.price.iap];
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.textContent = 'EXCLUSIVO';
        card.appendChild(badge);
        btn.className = 'btn primary';
        btn.textContent = fmtBRL(p.price);
        const sub = document.createElement('div');
        sub.className = 'sub';
        sub.textContent = 'Vem no ' + p.name;
        card.appendChild(sub);
        btn.onclick = () => buy(s.price.iap);
      }
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }

  function spend(cur, amount, apply, after) {
    if (S[cur] < amount) {
      if (cur === 'gems') { toast('Gemas insuficientes 💎'); openShop('gems'); }
      else toast('Moedas insuficientes — jogue mais ou troque gemas! 🪙');
      return;
    }
    S[cur] -= amount;
    apply();
    save();
    Sound.buy();
    toast('Comprado! 🎉');
    after && after();
  }

  // ---------------- Loja ----------------
  function openShop(tab) {
    renderShop();
    setTab(tab || 'gems');
    show('shop');
  }
  function setTab(tab) {
    document.querySelectorAll('#shop .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('tab-gems').classList.toggle('hidden', tab !== 'gems');
    $('tab-items').classList.toggle('hidden', tab !== 'items');
  }
  document.querySelectorAll('#shop .tab').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));

  const ICONS = { starter: '🐉', gems_small: '💎', gems_medium: '💰', gems_large: '🧰', gems_mega: '👑', vip: '⭐' };
  function renderShop() {
    const g = $('tab-gems');
    g.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid';
    Object.entries(CAT.products).forEach(([sku, p]) => {
      const owned = p.oncePerPlayer && S.bought[sku];
      const card = document.createElement('div');
      card.className = 'card' + (sku === 'starter' ? ' featured' : '') + (owned ? ' owned' : '');
      card.innerHTML = `${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
        <div class="big-emoji">${ICONS[sku] || '💎'}</div>
        <div class="info"><div class="name">${p.name}</div><div class="sub">${p.desc}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.textContent = owned ? '✓ Comprado' : fmtBRL(p.price);
      btn.disabled = !!owned;
      btn.onclick = () => buy(sku);
      card.appendChild(btn);
      grid.appendChild(card);
    });
    g.appendChild(grid);

    const it = $('tab-items');
    it.innerHTML = '';
    const grid2 = document.createElement('div');
    grid2.className = 'grid';
    ITEMS.forEach((item) => {
      item.offers.forEach((o) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `${o.tag ? `<div class="badge">${o.tag}</div>` : ''}<div class="big-emoji">${item.icon}</div>
          <div class="name">${item.name} x${o.qty}</div><div class="sub">${item.desc}<br>Você tem: ${S.items[item.id]}</div>`;
        const btn = document.createElement('button');
        btn.className = o.gems ? 'btn gold' : 'btn';
        btn.textContent = o.gems ? '💎 ' + o.gems : '🪙 ' + o.coins;
        btn.onclick = () => spend(o.gems ? 'gems' : 'coins', o.gems || o.coins, () => { S.items[item.id] += o.qty; }, renderShop);
        card.appendChild(btn);
        grid2.appendChild(card);
      });
    });
    // troca de gemas por moedas
    const ex = document.createElement('div');
    ex.className = 'card';
    ex.innerHTML = '<div class="big-emoji">🪙</div><div class="name">2.000 moedas</div><div class="sub">Troque gemas por moedas</div>';
    const exb = document.createElement('button');
    exb.className = 'btn gold';
    exb.textContent = '💎 50';
    exb.onclick = () => spend('gems', 50, () => { S.coins += 2000; }, renderShop);
    ex.appendChild(exb);
    grid2.appendChild(ex);
    it.appendChild(grid2);
  }

  // ---------------- Prêmio diário ----------------
  const DAILY = [{ coins: 50 }, { coins: 100 }, { gems: 5 }, { coins: 200 }, { shield: 1 }, { coins: 300 }, { gems: 20 }];
  const rewardLabel = (r) => r.coins ? `🪙${r.coins}` : r.gems ? `💎${r.gems}` : '🛡️x1';
  function streakNow() {
    const y = new Date(Date.now() - 864e5);
    const yesterday = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    if (S.daily.last === today()) return S.daily.streak;
    return S.daily.last === yesterday ? S.daily.streak : 0;
  }
  function renderDaily() {
    const streak = streakNow();
    const ready = dailyReady();
    const idx = ready ? streak % 7 : (streak - 1) % 7;
    $('dailyGrid').innerHTML = DAILY.map((r, i) => {
      const done = i < idx || (!ready && i === idx);
      return `<div class="day ${done ? 'done' : ''} ${ready && i === idx ? 'today' : ''}">Dia ${i + 1}<span class="r">${rewardLabel(r)}</span></div>`;
    }).join('');
    $('btnClaim').disabled = !ready;
    $('btnClaim').textContent = ready ? 'Pegar prêmio' : 'Volte amanhã! ⏰';
  }
  $('btnClaim').onclick = () => {
    if (!dailyReady()) return;
    const streak = streakNow();
    const r = DAILY[streak % 7];
    if (r.coins) S.coins += r.coins;
    if (r.gems) S.gems += r.gems;
    if (r.shield) S.items.shield += r.shield;
    S.daily = { last: today(), streak: streak + 1 };
    save();
    Sound.buy();
    toast('Você ganhou ' + rewardLabel(r) + '!');
    renderDaily();
  };

  // ---------------- Pagamentos (dinheiro real) ----------------
  let currentSku = null;
  let gatePassed = false;
  let gateAnswer = 0;
  let pixPoll = null;

  function buy(sku) {
    const p = CAT.products[sku];
    if (!p) return;
    if (p.oncePerPlayer && S.bought[sku]) { toast('Você já tem esse item ✓'); return; }
    currentSku = sku;
    $('payModal').classList.remove('hidden');
    $('payMsg').textContent = '';
    $('payMsg').className = 'pay-msg';
    if (gatePassed) return openCheckout();
    const a = 6 + Math.floor(Math.random() * 4), b = 3 + Math.floor(Math.random() * 7);
    gateAnswer = a * b;
    $('gateQ').textContent = `${a} × ${b} = ?`;
    $('gateA').value = '';
    $('gate').classList.remove('hidden');
    $('checkout').classList.add('hidden');
    setTimeout(() => $('gateA').focus(), 50);
  }
  $('gateOk').onclick = () => {
    if (Number($('gateA').value) === gateAnswer) { gatePassed = true; openCheckout(); }
    else { $('gateA').value = ''; $('gateA').placeholder = 'Resposta errada, tente de novo'; }
  };
  $('gateA').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('gateOk').click(); });

  function closePay() {
    $('payModal').classList.add('hidden');
    if (pixPoll) { clearInterval(pixPoll); pixPoll = null; }
  }
  $('payClose').onclick = closePay;

  function openCheckout() {
    const p = CAT.products[currentSku];
    $('gate').classList.add('hidden');
    $('checkout').classList.remove('hidden');
    $('payTitle').textContent = p.name;
    $('payDesc').textContent = p.desc;
    $('payPrice').textContent = fmtBRL(p.price);
    $('pixForm').classList.remove('hidden');
    $('pixResult').classList.add('hidden');

    const hasPP = !!CONFIG.paypal, hasPix = !!CONFIG.pix;
    const demo = CONFIG.demo || (!hasPP && !hasPix);
    $('pay-demo').classList.toggle('hidden', !demo);
    $('payTabs').classList.toggle('hidden', demo || !(hasPP && hasPix));
    if (demo) {
      $('pay-paypal').classList.add('hidden');
      $('pay-pix').classList.add('hidden');
      return;
    }
    setPayTab(hasPP ? 'paypal' : 'pix');
    if (hasPP) renderPayPal();
  }
  function setPayTab(which) {
    document.querySelectorAll('#payTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.pay === which));
    $('pay-paypal').classList.toggle('hidden', which !== 'paypal');
    $('pay-pix').classList.toggle('hidden', which !== 'pix');
  }
  document.querySelectorAll('#payTabs .tab').forEach((b) => (b.onclick = () => setPayTab(b.dataset.pay)));

  function payMsg(text, kind) {
    $('payMsg').textContent = text;
    $('payMsg').className = 'pay-msg ' + (kind || '');
  }

  async function api(path, body) {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erro de conexão');
    return j;
  }

  function grant(res) {
    if (!res || !res.ok) return false;
    if (S.txs.includes(res.txId)) return true; // já entregue
    const g = res.grant || {};
    if (g.gems) S.gems += g.gems;
    if (g.coins) S.coins += g.coins;
    (g.skins || []).forEach((id) => { if (!S.skins.includes(id)) S.skins.push(id); });
    if (g.skins && g.skins[0]) S.skin = g.skins[0];
    if (g.vip) S.vip = true;
    S.bought[res.sku] = true;
    S.txs.push(res.txId);
    S.pending = S.pending.filter((x) => 'pp_' + x.id !== res.txId && 'pix_' + x.id !== res.txId);
    save();
    Sound.buy();
    return true;
  }
  function success(res) {
    grant(res);
    payMsg('✅ Pagamento aprovado! Itens entregues.', 'ok');
    toast('🎉 Obrigado pela compra! Itens entregues.', 3500);
    setTimeout(() => {
      closePay();
      if (!$('shop').classList.contains('hidden')) renderShop();
      if (!$('skins').classList.contains('hidden')) renderSkins();
      if (!$('menu').classList.contains('hidden')) renderMenu();
    }, 1200);
  }

  // Demo
  $('demoBuy').onclick = async () => {
    try {
      const res = CONFIG.offline
        ? { ok: true, sku: currentSku, grant: CAT.products[currentSku].grant, txId: 'demo_' + Date.now() }
        : await api('/api/demo/purchase', { sku: currentSku });
      success(res);
    } catch (e) { payMsg(e.message, 'err'); }
  };

  // PayPal
  let ppLoaded = null;
  function loadPayPal() {
    if (ppLoaded) return ppLoaded;
    ppLoaded = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CONFIG.paypal.clientId)}&currency=${CAT.currency}&intent=capture&locale=pt_BR`;
      s.onload = resolve;
      s.onerror = () => { ppLoaded = null; reject(new Error('Não foi possível carregar o PayPal')); };
      document.head.appendChild(s);
    });
    return ppLoaded;
  }
  async function renderPayPal() {
    const box = $('paypalButtons');
    box.innerHTML = '<p>Carregando…</p>';
    try {
      await loadPayPal();
      box.innerHTML = '';
      await window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'pill', label: 'pay' },
        createOrder: async () => (await api('/api/paypal/orders', { sku: currentSku })).id,
        onApprove: async (data) => {
          payMsg('Confirmando pagamento…');
          S.pending.push({ type: 'paypal', id: data.orderID });
          save();
          const res = await api(`/api/paypal/orders/${data.orderID}/capture`, {});
          if (res.ok) success(res);
          else payMsg('Pagamento não concluído (' + res.status + '). Nada foi cobrado.', 'err');
        },
        onCancel: () => payMsg('Pagamento cancelado.'),
        onError: (err) => payMsg('Erro no PayPal. Tente novamente ou use Pix.', 'err') || console.error(err),
      }).render(box);
    } catch (e) {
      box.innerHTML = '';
      payMsg(e.message, 'err');
    }
  }

  // Pix
  $('pixGo').onclick = async () => {
    const email = $('pixEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return payMsg('Digite um e-mail válido.', 'err');
    payMsg('Gerando Pix…');
    try {
      const r = await api('/api/pix', { sku: currentSku, email });
      S.pending.push({ type: 'pix', id: r.id, at: Date.now() });
      save();
      $('pixForm').classList.add('hidden');
      $('pixResult').classList.remove('hidden');
      $('pixQr').src = 'data:image/png;base64,' + r.qrBase64;
      $('pixCode').value = r.qrCode;
      payMsg('');
      if (pixPoll) clearInterval(pixPoll);
      const started = Date.now();
      pixPoll = setInterval(async () => {
        if (Date.now() - started > 30 * 60e3) { clearInterval(pixPoll); pixPoll = null; return payMsg('Pix expirou. Gere outro.', 'err'); }
        try {
          const s = await api('/api/pix/' + r.id);
          if (s.ok) { clearInterval(pixPoll); pixPoll = null; success(s); }
        } catch (e) { /* tenta de novo */ }
      }, 4000);
    } catch (e) { payMsg(e.message, 'err'); }
  };
  $('pixCopy').onclick = async () => {
    try { await navigator.clipboard.writeText($('pixCode').value); toast('Código Pix copiado!'); }
    catch (e) { $('pixCode').select(); }
  };

  // Recupera compras pagas caso o jogador tenha fechado a página antes da entrega
  async function recoverPending() {
    if (!S.pending.length) return;
    for (const p of S.pending.slice()) {
      try {
        const res = p.type === 'paypal' ? await api(`/api/paypal/orders/${p.id}/capture`, {}) : await api('/api/pix/' + p.id);
        if (res.ok) { grant(res); toast('🎁 Compra anterior entregue!'); }
        else if (['rejected', 'cancelled', 'expired', 'VOIDED', 'DECLINED'].includes(res.status) || (p.at && Date.now() - p.at > 864e5)) {
          S.pending = S.pending.filter((x) => x !== p);
          save();
        }
      } catch (e) { /* tenta na próxima visita */ }
    }
  }

  // ---------------- Início ----------------
  show('menu');
})();
