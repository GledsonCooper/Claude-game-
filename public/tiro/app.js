/* Blitz Estelar — menus, progresso, hangar, loja, missões, anúncios com recompensa e pagamentos */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const Game = window.Game;
  const { SHIPS, shipById, drawShip, Sound } = Game;
  const CAT = window.CATALOG;
  const fmtBRL = (n) => 'R$ ' + n.toFixed(2).replace('.', ',');
  const fmt = (n) => Math.floor(n).toLocaleString('pt-BR');

  // ---------------- Progresso salvo no navegador ----------------
  const SAVE_KEY = 'blitz_save_v1';
  const defaults = {
    coins: 0, gems: 0, best: 0, bestWave: 0, games: 0,
    ships: ['falcon'], ship: 'falcon',
    meta: { dmg: 0, rate: 0, hp: 0, magnet: 0, xp: 0, luck: 0 },
    items: { bomb: 2, armor: 0, turbo: 0 },
    use: { armor: true, turbo: true },
    vip: false, bought: {}, txs: [], pending: [],
    daily: { last: '', streak: 0 },
    missions: { day: '', list: [], prog: {}, claimed: [], bonus: false },
    sound: true, music: true,
  };
  let S = load();
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (raw) {
        return Object.assign({}, defaults, raw, {
          meta: Object.assign({}, defaults.meta, raw.meta),
          items: Object.assign({}, defaults.items, raw.items),
          use: Object.assign({}, defaults.use, raw.use),
        });
      }
    } catch (e) { /* armazenamento indisponível */ }
    return JSON.parse(JSON.stringify(defaults));
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    refreshWallet();
  }
  Sound.on = S.sound;
  Sound.music = S.music;

  // ---------------- Configuração do servidor ----------------
  let CONFIG = { demo: true, paypal: null, pix: false, offline: true, adsense: null };
  fetch('/api/config')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((c) => { CONFIG = c; Ads.init(); recoverPending(); })
    .catch(() => Ads.init());

  // ---------------- Anúncios com recompensa (Google AdSense H5 Games Ads) ----------------
  // Configure ADSENSE_CLIENT no servidor. Sem ele, no modo demo aparece um anúncio simulado.
  const Ads = {
    real: false,
    sim: false,
    init() {
      if (CONFIG.adsense && /^ca-pub-\d+$/.test(CONFIG.adsense)) {
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CONFIG.adsense;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-ad-frequency-hint', '90s');
        if (CONFIG.adsenseTest) s.setAttribute('data-adbreak-test', 'on');
        document.head.appendChild(s);
        window.adsbygoogle = window.adsbygoogle || [];
        window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
        window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
        this.real = true;
      } else this.sim = !!CONFIG.demo;
    },
    get available() { return this.real || this.sim; },
    mute(on) { Sound.on = on ? false : S.sound; },
    reward(name, onReward) {
      if (this.real) {
        let got = false;
        window.adBreak({
          type: 'reward', name,
          beforeAd: () => this.mute(true),
          afterAd: () => this.mute(false),
          beforeReward: (showAdFn) => showAdFn(),
          adDismissed: () => {},
          adViewed: () => { got = true; },
          adBreakDone: (info) => {
            this.mute(false);
            if (got) onReward();
            else if (info && info.breakStatus !== 'dismissed') toast('Nenhum anúncio disponível agora. Tente em instantes.');
          },
        });
      } else if (this.sim) {
        $('adSim').classList.remove('hidden');
        let n = 3;
        $('adSimT').textContent = n;
        const iv = setInterval(() => {
          n--;
          $('adSimT').textContent = n;
          if (n <= 0) { clearInterval(iv); $('adSim').classList.add('hidden'); onReward(); }
        }, 1000);
      }
    },
    interstitial(name, then) {
      if (!this.real || S.vip) return then();
      window.adBreak({ type: 'next', name, beforeAd: () => this.mute(true), afterAd: () => this.mute(false), adBreakDone: () => { this.mute(false); then(); } });
    },
  };

  // ---------------- Utilidades de tela ----------------
  const screens = ['menu', 'levelup', 'pause', 'over', 'hangar', 'shop', 'missions'];
  let current = 'menu';
  function show(id) {
    current = id;
    screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
    $('hud').classList.toggle('hidden', id !== null);
    $('wallet').classList.toggle('hidden', id === null || id === 'pause' || id === 'levelup');
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
    $('wCoins').textContent = fmt(S.coins);
    $('wGemsN').textContent = fmt(S.gems);
  }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { Sound.click(); show('menu'); }));
  document.addEventListener('pointerdown', () => Sound.unlock());
  function today(offsetDays) {
    const d = new Date(Date.now() - (offsetDays || 0) * 864e5);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // ---------------- Itens de partida ----------------
  const ITEMS = [
    { id: 'bomb', icon: '💣', name: 'Bomba', desc: 'Limpa a tela. Leve até 3 por partida', offers: [{ qty: 3, coins: 600 }, { qty: 10, gems: 40, tag: '-30%' }] },
    { id: 'armor', icon: '🛡️', name: 'Blindagem', desc: '+1 vida na próxima partida', offers: [{ qty: 1, coins: 400 }, { qty: 5, gems: 50, tag: '-20%' }] },
    { id: 'turbo', icon: '⏫', name: 'Largada Turbo', desc: 'Começa com 3 melhorias', offers: [{ qty: 1, gems: 25 }, { qty: 5, gems: 100, tag: '-20%' }] },
  ];

  // ---------------- Melhorias permanentes (hangar) ----------------
  const META = [
    { id: 'dmg', icon: '💥', name: 'Canhões', desc: '+10% de dano por nível', max: 10, base: 150 },
    { id: 'rate', icon: '⚡', name: 'Gatilho', desc: '+5% de cadência por nível', max: 8, base: 200 },
    { id: 'hp', icon: '❤️', name: 'Casco', desc: '+1 vida máxima por nível', max: 2, base: 2500, mult: 3 },
    { id: 'magnet', icon: '🧲', name: 'Ímã', desc: '+15% de alcance de coleta', max: 5, base: 120 },
    { id: 'xp', icon: '📘', name: 'Treino', desc: '+10% de experiência', max: 5, base: 180 },
    { id: 'luck', icon: '🍀', name: 'Sorte', desc: '+10% de moedas por partida', max: 5, base: 250 },
  ];
  const metaCost = (m, lv) => Math.round((m.base * Math.pow(m.mult || 1.6, lv)) / 10) * 10;

  // ---------------- Menu ----------------
  function dailyReady() { return S.daily.last !== today(); }
  function renderMenu() {
    ensureMissions();
    $('bestScore').textContent = fmt(S.best);
    $('bestWave').textContent = S.bestWave;
    $('btnStarter').classList.toggle('hidden', !!S.bought.nb_starter);
    $('btnStarter').querySelector('span').textContent = fmtBRL(CAT.products.nb_starter.price);
    $('btnMissions').classList.toggle('ready', dailyReady() || missionsClaimable());
    $('btnSound').textContent = S.sound ? '🔊 Som' : '🔇 Som';
    $('btnMusic').textContent = S.music ? '🎵 Música' : '🚫 Música';
    const row = $('boosts');
    row.innerHTML = '';
    ITEMS.forEach((it) => {
      const n = S.items[it.id];
      const b = document.createElement('button');
      const togg = it.id !== 'bomb';
      const on = n > 0 && (!togg || S.use[it.id]);
      b.className = 'pill' + (on ? '' : ' off');
      b.textContent = `${it.icon} ${n > 0 ? (togg && on ? '✓ ' : '') + 'x' + n : '+'}`;
      b.title = it.name + ': ' + it.desc;
      b.onclick = () => {
        Sound.click();
        if (n === 0 || !togg) { openShop('items'); return; }
        S.use[it.id] = !S.use[it.id];
        save();
        renderMenu();
      };
      row.appendChild(b);
    });
    refreshWallet();
  }

  const mc = $('menuShip').getContext('2d');
  (function animShip(ts) {
    requestAnimationFrame(animShip);
    if (current !== 'menu') return;
    const t = ts / 1000;
    mc.clearRect(0, 0, 220, 220);
    drawShip(mc, S.ship, 110 + Math.sin(t * 1.3) * 6, 105 + Math.sin(t * 2) * 8, 62, t, Math.sin(t * 1.3) * 0.3);
  })(0);

  $('btnSound').onclick = () => { S.sound = Sound.on = !S.sound; save(); renderMenu(); };
  $('btnMusic').onclick = () => { S.music = Sound.music = !S.music; save(); renderMenu(); };
  $('btnHangar').onclick = () => { Sound.click(); openHangar('ships'); };
  $('btnShop').onclick = () => { Sound.click(); openShop('gems'); };
  $('wGems').onclick = () => { Sound.click(); openShop('gems'); };
  $('btnStarter').onclick = () => buy('nb_starter');
  $('btnMissions').onclick = () => { Sound.click(); renderMissions(); show('missions'); };

  // ---------------- Partida ----------------
  let run = null; // { banked, bombsTaken, doubled, adRevive, vipRevive, finished }
  function startGame() {
    Sound.unlock();
    const bombs = Math.min(3, S.items.bomb);
    S.items.bomb -= bombs;
    const opts = {
      ship: S.ship,
      meta: S.meta,
      coinMult: (S.vip ? 2 : 1) * (1 + 0.1 * S.meta.luck),
      bombs,
      tutorial: S.games < 2,
    };
    ['armor', 'turbo'].forEach((id) => {
      if (S.items[id] > 0 && S.use[id]) { opts[id] = true; S.items[id]--; }
    });
    S.games++;
    save();
    run = { banked: 0, doubled: false, adRevive: false, vipRevive: false, finished: false };
    Game.start(opts);
    updateBombBtn(bombs);
    show(null);
  }
  function updateBombBtn(n) {
    $('bombN').textContent = n;
    $('btnBomb').classList.toggle('empty', n <= 0);
  }
  function bankCoins(total) {
    const delta = Math.floor(total) - run.banked;
    if (delta > 0) { S.coins += delta; run.banked += delta; save(); }
  }
  // Fecha a partida: devolve bombas não usadas, atualiza missões.
  function finishRun() {
    if (!run || run.finished) return;
    const r = Game.result();
    run.finished = true;
    if (r) {
      bankCoins(r.coins);
      S.items.bomb += Game.bombs;
      ensureMissions();
      const p = S.missions.prog;
      p.kills = (p.kills || 0) + r.kills;
      p.coins = (p.coins || 0) + Math.floor(r.coins);
      p.bosses = (p.bosses || 0) + r.bosses;
      p.games = (p.games || 0) + 1;
      p.wave = Math.max(p.wave || 0, r.wave);
      p.combo = Math.max(p.combo || 0, r.combo);
      p.level = Math.max(p.level || 0, r.level);
      if (r.score > S.best) S.best = r.score;
      if (r.wave > S.bestWave) S.bestWave = r.wave;
      save();
      if (missionsClaimable()) setTimeout(() => toast('🎯 Missão concluída! Pegue a recompensa em Missões.', 3000), 400);
    }
    Game.quit();
  }

  $('btnPlay').onclick = startGame;
  $('btnAgain').onclick = () => {
    stopRevive();
    finishRun();
    if (S.games % 3 === 0) Ads.interstitial('again', startGame);
    else startGame();
  };
  $('btnMenu').onclick = () => { stopRevive(); finishRun(); show('menu'); };
  $('btnPause').onclick = () => { Game.pause(); show('pause'); };
  $('btnResume').onclick = () => { show(null); Game.resume(); };
  $('btnQuit').onclick = () => { finishRun(); show('menu'); };
  $('btnBomb').onclick = () => useBomb();
  function useBomb() {
    if (Game.state !== 'play') return;
    if (Game.bombs <= 0) { toast('Sem bombas! Compre na loja 💣'); return; }
    updateBombBtn(Game.bomb());
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.state === 'play') { Game.pause(); show('pause'); }
  });

  // escolha de melhoria
  function onLevelUp(choices, level) {
    $('lvNum').textContent = level;
    const box = $('choices');
    box.innerHTML = '';
    choices.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<span class="ic">${c.icon}</span><span><b>${c.name}</b><small>${c.desc}</small></span><span class="lv">${c.max < 99 ? 'NV ' + c.lv + '/' + c.max : ''}</span>`;
      b.onclick = () => {
        Sound.click();
        Game.choose(c.id);
        if (Game.state === 'play') show(null);
      };
      box.appendChild(b);
    });
    show('levelup');
  }

  // fim de jogo
  let reviveTimer = null;
  function stopRevive() { if (reviveTimer) { cancelAnimationFrame(reviveTimer); reviveTimer = null; } }
  const reviveCost = () => 10 * Math.pow(2, Game.revives);

  function onDie(r) {
    bankCoins(r.coins);
    const record = r.score > S.best;
    if (record) S.best = r.score;
    if (r.wave > S.bestWave) S.bestWave = r.wave;
    save();
    $('finalScore').textContent = fmt(r.score);
    $('newRecord').classList.toggle('hidden', !record);
    $('stats').innerHTML = [['Onda', r.wave], ['Abates', r.kills], ['Combo', r.combo], ['Nível', r.level]].map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('');
    $('earnedCoins').textContent = fmt(r.coins);
    $('vipTag').classList.toggle('hidden', !S.vip);
    $('doubleRow').classList.toggle('hidden', run.doubled || r.coins < 5);
    $('btnDoubleAd').classList.toggle('hidden', !Ads.available);
    $('vipUpsell').classList.toggle('hidden', S.vip || r.coins < 5);
    $('upsellCoins').textContent = fmt(r.coins * 2);
    const canRevive = Game.revives < 3;
    $('reviveBox').classList.toggle('hidden', !canRevive);
    $('reviveCost').textContent = reviveCost();
    $('btnReviveAd').classList.toggle('hidden', !Ads.available || run.adRevive);
    $('btnReviveVip').classList.toggle('hidden', !S.vip || run.vipRevive);
    show('over');
    if (canRevive) {
      const start = performance.now(), dur = 7000;
      const tick = (now) => {
        const f = 1 - (now - start) / dur;
        $('reviveBar').style.width = Math.max(0, f * 100) + '%';
        if (f <= 0) { $('reviveBox').classList.add('hidden'); reviveTimer = null; return; }
        reviveTimer = requestAnimationFrame(tick);
      };
      stopRevive();
      reviveTimer = requestAnimationFrame(tick);
    }
  }
  function doRevive() {
    stopRevive();
    show(null);
    Game.revive();
    updateBombBtn(Game.bombs);
  }
  $('btnRevive').onclick = () => {
    const cost = reviveCost();
    if (S.gems < cost) { stopRevive(); toast('Cristais insuficientes 💎'); openShop('gems'); return; }
    S.gems -= cost;
    save();
    Sound.buy();
    doRevive();
  };
  $('btnReviveVip').onclick = () => { run.vipRevive = true; doRevive(); };
  $('btnReviveAd').onclick = () => {
    stopRevive();
    Ads.reward('revive', () => { run.adRevive = true; doRevive(); });
  };
  function doubleCoins() {
    const r = Game.result();
    if (!r || run.doubled) return;
    run.doubled = true;
    S.coins += Math.floor(r.coins);
    save();
    Sound.buy();
    $('earnedCoins').textContent = fmt(r.coins * 2);
    $('doubleRow').classList.add('hidden');
    toast(`+${fmt(r.coins)} 🪙 Moedas dobradas!`);
  }
  $('btnDoubleAd').onclick = () => Ads.reward('double', doubleCoins);
  $('btnDoubleGems').onclick = () => {
    if (S.gems < 15) { toast('Cristais insuficientes 💎'); openShop('gems'); return; }
    S.gems -= 15;
    doubleCoins();
  };
  $('btnUpsell').onclick = () => buy('nb_vip');
  $('btnShare').onclick = async () => {
    const text = `Fiz ${fmt(S.best)} pontos e cheguei na onda ${S.bestWave} no Blitz Estelar 🚀 Duvido você me passar:`;
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) await navigator.share({ title: 'Blitz Estelar', text, url });
      else { await navigator.clipboard.writeText(text + ' ' + url); toast('Link copiado! Cole no WhatsApp 😉'); }
    } catch (e) { /* cancelado */ }
  };

  Game.init($('game'), {
    onDie,
    onLevelUp,
    onBombs: updateBombBtn,
    onBombKey: useBomb,
    onPauseKey: () => {
      if (Game.state === 'play') { Game.pause(); show('pause'); }
      else if (Game.state === 'pause') { show(null); Game.resume(); }
    },
  });

  // ---------------- Hangar ----------------
  function openHangar(tab) { renderHangar(); setHTab(tab); show('hangar'); }
  function setHTab(tab) {
    document.querySelectorAll('[data-htab]').forEach((b) => b.classList.toggle('active', b.dataset.htab === tab));
    $('htab-ships').classList.toggle('hidden', tab !== 'ships');
    $('htab-meta').classList.toggle('hidden', tab !== 'meta');
  }
  document.querySelectorAll('[data-htab]').forEach((b) => (b.onclick = () => setHTab(b.dataset.htab)));

  function renderHangar() {
    const box = $('htab-ships');
    box.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid';
    SHIPS.forEach((s) => {
      const owned = S.ships.includes(s.id);
      const card = document.createElement('div');
      card.className = 'card' + (S.ship === s.id ? ' selected' : '');
      const c = document.createElement('canvas');
      c.width = c.height = 192;
      drawShip(c.getContext('2d'), s.id, 96, 96, 62, 0.5, 0);
      card.appendChild(c);
      card.insertAdjacentHTML('beforeend', `<div class="name">${s.name}</div><div class="sub">${s.desc}</div>`);
      const btn = document.createElement('button');
      btn.className = 'btn';
      if (owned) {
        btn.textContent = S.ship === s.id ? '✓ Pilotando' : 'Pilotar';
        btn.onclick = () => { S.ship = s.id; save(); Sound.click(); renderHangar(); };
      } else if (s.price.coins) {
        btn.textContent = '🪙 ' + fmt(s.price.coins);
        btn.onclick = () => spend('coins', s.price.coins, () => { S.ships.push(s.id); S.ship = s.id; }, renderHangar);
      } else if (s.price.gems) {
        btn.className = 'btn gold';
        btn.textContent = '💎 ' + s.price.gems;
        btn.onclick = () => spend('gems', s.price.gems, () => { S.ships.push(s.id); S.ship = s.id; }, renderHangar);
      } else if (s.price.iap) {
        const p = CAT.products[s.price.iap];
        card.insertAdjacentHTML('afterbegin', '<div class="badge">EXCLUSIVA</div>');
        card.insertAdjacentHTML('beforeend', `<div class="sub">Vem no ${p.name}</div>`);
        btn.className = 'btn primary';
        btn.textContent = fmtBRL(p.price);
        btn.onclick = () => buy(s.price.iap);
      }
      card.appendChild(btn);
      grid.appendChild(card);
    });
    box.appendChild(grid);

    const mb = $('htab-meta');
    mb.innerHTML = '<p class="center">Melhorias permanentes: valem para todas as partidas.</p>';
    META.forEach((m) => {
      const lv = S.meta[m.id] || 0, maxed = lv >= m.max, cost = metaCost(m, lv);
      const row = document.createElement('div');
      row.className = 'meta-row';
      let pips = '';
      for (let i = 0; i < m.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
      row.innerHTML = `<span class="ic">${m.icon}</span><div class="info"><b>${m.name}</b> <small>NV ${lv}/${m.max}</small><br><small>${m.desc}</small><div class="pips">${pips}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = maxed ? 'MÁX' : '🪙 ' + fmt(cost);
      btn.disabled = maxed;
      btn.onclick = () => spend('coins', cost, () => { S.meta[m.id] = lv + 1; }, renderHangar);
      row.appendChild(btn);
      mb.appendChild(row);
    });
  }

  function spend(cur, amount, apply, after) {
    if (S[cur] < amount) {
      if (cur === 'gems') { toast('Cristais insuficientes 💎'); openShop('gems'); }
      else toast('Moedas insuficientes: jogue mais ou troque cristais! 🪙');
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
  function openShop(tab) { renderShop(); setTab(tab || 'gems'); show('shop'); }
  function setTab(tab) {
    document.querySelectorAll('#shop .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('tab-gems').classList.toggle('hidden', tab !== 'gems');
    $('tab-items').classList.toggle('hidden', tab !== 'items');
  }
  document.querySelectorAll('#shop .tab').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));

  const ICONS = { nb_starter: '🔥', nb_gems_s: '💎', nb_gems_m: '💰', nb_gems_l: '🧰', nb_mega: '👑', nb_vip: '⭐' };
  function renderShop() {
    const g = $('tab-gems');
    g.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid';
    Object.entries(CAT.products).forEach(([sku, p]) => {
      const owned = p.oncePerPlayer && S.bought[sku];
      const card = document.createElement('div');
      card.className = 'card' + (sku === 'nb_starter' || sku === 'nb_vip' ? ' featured' : '') + (owned ? ' owned' : '');
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
        btn.textContent = o.gems ? '💎 ' + o.gems : '🪙 ' + fmt(o.coins);
        btn.onclick = () => spend(o.gems ? 'gems' : 'coins', o.gems || o.coins, () => { S.items[item.id] += o.qty; }, renderShop);
        card.appendChild(btn);
        grid2.appendChild(card);
      });
    });
    const ex = document.createElement('div');
    ex.className = 'card';
    ex.innerHTML = '<div class="big-emoji">🪙</div><div class="name">2.500 moedas</div><div class="sub">Troque cristais por moedas</div>';
    const exb = document.createElement('button');
    exb.className = 'btn gold';
    exb.textContent = '💎 50';
    exb.onclick = () => spend('gems', 50, () => { S.coins += 2500; }, renderShop);
    ex.appendChild(exb);
    grid2.appendChild(ex);
    it.appendChild(grid2);
  }

  // ---------------- Missões diárias ----------------
  const MISSION_POOL = [
    { k: 'kills', txt: 'Destrua {n} inimigos', n: [150, 300, 500] },
    { k: 'wave', txt: 'Alcance a onda {n}', n: [5, 8, 11] },
    { k: 'bosses', txt: 'Derrote {n} chefe(s)', n: [1, 2, 3] },
    { k: 'coins', txt: 'Colete {n} moedas', n: [100, 220, 400] },
    { k: 'combo', txt: 'Faça um combo de {n}', n: [30, 60, 100] },
    { k: 'games', txt: 'Jogue {n} partidas', n: [3, 5, 8] },
    { k: 'level', txt: 'Chegue ao nível {n} numa partida', n: [6, 9, 12] },
  ];
  const MISSION_REWARD = [{ coins: 150 }, { coins: 350 }, { gems: 10 }];
  const BONUS_REWARD = { gems: 15, bomb: 2 };
  function seeded(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  function ensureMissions() {
    const d = today();
    if (S.missions.day === d && S.missions.list.length) return;
    const rnd = seeded('blitz' + d);
    const pool = MISSION_POOL.slice();
    const list = [];
    for (let i = 0; i < 3; i++) {
      const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const idx = Math.floor(rnd() * 3);
      list.push({ k: m.k, n: m.n[idx], idx, txt: m.txt.replace('{n}', m.n[idx]) });
    }
    S.missions = { day: d, list, prog: {}, claimed: [false, false, false], bonus: false };
    save();
  }
  const missionDone = (m) => (S.missions.prog[m.k] || 0) >= m.n;
  function missionsClaimable() {
    const ms = S.missions;
    if (!ms.list.length) return false;
    return ms.list.some((m, i) => missionDone(m) && !ms.claimed[i]) || (!ms.bonus && ms.claimed.every(Boolean));
  }
  const rewardLabel = (r) => [r.coins && `🪙${r.coins}`, r.gems && `💎${r.gems}`, r.bomb && `💣x${r.bomb}`, r.armor && `🛡️x${r.armor}`].filter(Boolean).join(' ');
  function giveReward(r) {
    if (r.coins) S.coins += r.coins;
    if (r.gems) S.gems += r.gems;
    if (r.bomb) S.items.bomb += r.bomb;
    if (r.armor) S.items.armor += r.armor;
  }

  function renderMissions() {
    ensureMissions();
    const ms = S.missions;
    const box = $('missionList');
    box.innerHTML = '';
    ms.list.forEach((m, i) => {
      const prog = Math.min(m.n, ms.prog[m.k] || 0), done = prog >= m.n, rw = MISSION_REWARD[m.idx];
      const row = document.createElement('div');
      row.className = 'mission-row' + (ms.claimed[i] ? ' done' : '');
      row.innerHTML = `<div class="info"><b>${m.txt}</b><br><small>${fmt(prog)} / ${fmt(m.n)} · Prêmio ${rewardLabel(rw)}</small><div class="bar"><div style="width:${(prog / m.n) * 100}%"></div></div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn ' + (done && !ms.claimed[i] ? 'primary' : '');
      btn.textContent = ms.claimed[i] ? '✓' : done ? 'Pegar' : '…';
      btn.disabled = !done || ms.claimed[i];
      btn.onclick = () => {
        ms.claimed[i] = true;
        giveReward(rw);
        save();
        Sound.buy();
        toast('Você ganhou ' + rewardLabel(rw) + '!');
        renderMissions();
      };
      row.appendChild(btn);
      box.appendChild(row);
    });
    const all = ms.claimed.every(Boolean);
    const bonus = document.createElement('div');
    bonus.className = 'mission-row' + (ms.bonus ? ' done' : '');
    bonus.innerHTML = `<div class="info"><b>🧰 Baú bônus</b><br><small>Complete as 3 missões · ${rewardLabel(BONUS_REWARD)}</small></div>`;
    const bb = document.createElement('button');
    bb.className = 'btn ' + (all && !ms.bonus ? 'gold' : '');
    bb.textContent = ms.bonus ? '✓' : 'Abrir';
    bb.disabled = !all || ms.bonus;
    bb.onclick = () => { ms.bonus = true; giveReward(BONUS_REWARD); save(); Sound.buy(); toast('Baú aberto: ' + rewardLabel(BONUS_REWARD)); renderMissions(); };
    bonus.appendChild(bb);
    box.appendChild(bonus);
    renderDaily();
  }

  // ---------------- Prêmio diário (sequência de 7 dias) ----------------
  const DAILY = [{ coins: 100 }, { coins: 200 }, { bomb: 2 }, { gems: 5 }, { coins: 400 }, { armor: 2 }, { gems: 20 }];
  function streakNow() {
    if (S.daily.last === today()) return S.daily.streak;
    return S.daily.last === today(1) ? S.daily.streak : 0;
  }
  function renderDaily() {
    const streak = streakNow(), ready = dailyReady();
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
    const streak = streakNow(), r = DAILY[streak % 7];
    giveReward(r);
    S.daily = { last: today(), streak: streak + 1 };
    save();
    Sound.buy();
    toast('Você ganhou ' + rewardLabel(r) + '!');
    renderDaily();
  };

  // ---------------- Pagamentos com dinheiro real ----------------
  let currentSku = null, gatePassed = false, gateAnswer = 0, pixPoll = null;

  function buy(sku) {
    const p = CAT.products[sku];
    if (!p) return;
    if (p.oncePerPlayer && S.bought[sku]) { toast('Você já tem esse item ✓'); return; }
    currentSku = sku;
    $('payModal').classList.remove('hidden');
    payMsg('');
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
    const hasPP = !!CONFIG.paypal, hasPix = !!CONFIG.pix, demo = !!CONFIG.demo;
    $('pay-demo').classList.toggle('hidden', !demo);
    $('payTabs').classList.toggle('hidden', demo || !(hasPP && hasPix));
    if (demo) { $('pay-paypal').classList.add('hidden'); $('pay-pix').classList.add('hidden'); return; }
    if (!hasPP && !hasPix) {
      $('pay-paypal').classList.add('hidden');
      $('pay-pix').classList.add('hidden');
      return payMsg('Pagamentos indisponíveis no momento.', 'err');
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
    if (!res || !res.ok || !CAT.products[res.sku]) return false;
    if (S.txs.includes(res.txId)) return true; // já entregue
    const g = res.grant || {};
    if (g.gems) S.gems += g.gems;
    if (g.coins) S.coins += g.coins;
    (g.skins || []).forEach((id) => { if (!S.ships.includes(id)) S.ships.push(id); });
    if (g.skins && g.skins[0]) S.ship = g.skins[0];
    if (g.items) for (const k in g.items) S.items[k] = (S.items[k] || 0) + g.items[k];
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
      if (current === 'shop') renderShop();
      if (current === 'hangar') renderHangar();
      if (current === 'menu') renderMenu();
      if (current === 'over') {
        $('btnReviveVip').classList.toggle('hidden', !S.vip || run.vipRevive);
        $('vipUpsell').classList.toggle('hidden', S.vip);
      }
    }, 1200);
  }

  $('demoBuy').onclick = async () => {
    try {
      const res = CONFIG.offline
        ? { ok: true, sku: currentSku, grant: CAT.products[currentSku].grant, txId: 'demo_' + Date.now() }
        : await api('/api/demo/purchase', { sku: currentSku });
      success(res);
    } catch (e) { payMsg(e.message, 'err'); }
  };

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
        onError: () => payMsg('Erro no PayPal. Tente novamente ou use Pix.', 'err'),
      }).render(box);
    } catch (e) {
      box.innerHTML = '';
      payMsg(e.message, 'err');
    }
  }

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

  // Entrega compras pagas caso o jogador tenha fechado a página antes da confirmação.
  async function recoverPending() {
    for (const p of S.pending.slice()) {
      try {
        const res = p.type === 'paypal' ? await api(`/api/paypal/orders/${p.id}/capture`, {}) : await api('/api/pix/' + p.id);
        if (res.ok) { if (grant(res)) toast('🎁 Compra anterior entregue!'); }
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
