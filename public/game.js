/* Pulim — motor do jogo (canvas 2D, sem bibliotecas) */
(function () {
  'use strict';

  // ---------------- Personagens ----------------
  // price: { coins } | { gems } | { iap: 'sku' }
  const SKINS = [
    { id: 'classic', name: 'Pulim', color: '#4f8cff', dark: '#2f5fd0', price: null },
    { id: 'pink', name: 'Lulu', color: '#ff7ab6', dark: '#d94a8c', acc: 'bow', price: { coins: 250 } },
    { id: 'frog', name: 'Sapinho', color: '#4ade80', dark: '#16a34a', acc: 'frog', price: { coins: 600 } },
    { id: 'cat', name: 'Gatíneo', color: '#fb923c', dark: '#c2410c', acc: 'cat', price: { coins: 1200 } },
    { id: 'ninja', name: 'Ninja', color: '#334155', dark: '#0f172a', acc: 'ninja', price: { coins: 2500 } },
    { id: 'robot', name: 'Robô-X', color: '#94a3b8', dark: '#475569', acc: 'robot', trail: 'spark', price: { gems: 80 } },
    { id: 'unicorn', name: 'Unicórnio', color: '#f5f3ff', dark: '#c4b5fd', acc: 'unicorn', trail: 'rainbow', price: { gems: 150 } },
    { id: 'astro', name: 'Astronauta', color: '#e2e8f0', dark: '#94a3b8', acc: 'astro', trail: 'smoke', price: { gems: 180 } },
    { id: 'fire', name: 'Fogaréu', color: '#ef4444', dark: '#991b1b', acc: 'flame', trail: 'fire', price: { gems: 250 } },
    { id: 'dragon', name: 'Dragão', color: '#22c55e', dark: '#7c3aed', acc: 'dragon', trail: 'fire', price: { iap: 'starter' } },
    { id: 'king', name: 'Rei Pulim', color: '#fde047', dark: '#ca8a04', acc: 'crown', trail: 'gold', price: { iap: 'vip' } },
    { id: 'galaxy', name: 'Galáxia', color: '#4c1d95', dark: '#1e1b4b', acc: 'galaxy', trail: 'stars', price: { iap: 'gems_mega' } },
  ];
  const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

  function drawCharacter(ctx, skinId, x, y, r, o) {
    o = o || {};
    const s = skinById(skinId);
    const t = o.t || 0;
    const sq = o.squash || 0; // >0 achata, <0 estica
    const look = o.look || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + sq * 0.25, 1 - sq * 0.25);

    // asas do dragão (atrás)
    if (s.acc === 'dragon') {
      const flap = Math.sin(t * 12) * 0.3;
      ctx.fillStyle = '#7c3aed';
      for (const d of [-1, 1]) {
        ctx.save();
        ctx.scale(d, 1);
        ctx.rotate(-0.3 + flap);
        ctx.beginPath();
        ctx.moveTo(r * 0.6, -r * 0.1);
        ctx.quadraticCurveTo(r * 1.9, -r * 1.1, r * 1.7, r * 0.3);
        ctx.quadraticCurveTo(r * 1.2, 0, r * 0.6, r * 0.4);
        ctx.fill();
        ctx.restore();
      }
    }

    // corpo
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.1);
    g.addColorStop(0, lighten(s.color, 0.35));
    g.addColorStop(0.7, s.color);
    g.addColorStop(1, s.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    if (s.acc === 'galaxy') {
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + t * 0.5;
        ctx.fillStyle = i % 3 ? '#fff' : '#f0abfc';
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.7 * ((i % 4) / 4 + 0.3), Math.sin(a * 1.3) * r * 0.7, 1.5 + (i % 2), 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
    if (s.acc === 'robot') {
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.45);
      ctx.lineTo(r * 0.7, r * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.lineTo(0, -r * 1.35);
      ctx.stroke();
      ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ef4444' : '#fca5a5';
      ctx.beginPath();
      ctx.arc(0, -r * 1.4, r * 0.14, 0, 7);
      ctx.fill();
    }
    if (s.acc === 'ninja') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-r, -r * 0.45, r * 2, r * 0.28);
      ctx.beginPath();
      ctx.moveTo(r * 0.9, -r * 0.35);
      ctx.lineTo(r * 1.5, -r * 0.6 + Math.sin(t * 10) * 3);
      ctx.lineTo(r * 1.45, -r * 0.2 + Math.sin(t * 10 + 1) * 3);
      ctx.fill();
    }

    // olhos
    const ey = s.acc === 'frog' ? -r * 0.6 : -r * 0.15;
    const ex = r * 0.36;
    if (s.acc === 'frog') {
      ctx.fillStyle = s.color;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(d * ex, ey, r * 0.38, 0, 7);
        ctx.fill();
      }
    }
    const blink = (Math.floor(t * 10) % 40) === 0;
    for (const d of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      if (blink) ctx.ellipse(d * ex, ey, r * 0.24, r * 0.05, 0, 0, 7);
      else ctx.ellipse(d * ex, ey, r * 0.24, r * 0.28, 0, 0, 7);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = s.acc === 'robot' ? '#0ea5e9' : '#111827';
        ctx.beginPath();
        ctx.arc(d * ex + look * r * 0.09, ey + r * 0.04, r * 0.13, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(d * ex + look * r * 0.09 - r * 0.04, ey - r * 0.03, r * 0.045, 0, 7);
        ctx.fill();
      }
    }
    // bochechas e boca
    if (s.acc !== 'robot' && s.acc !== 'ninja') {
      ctx.fillStyle = 'rgba(255,100,130,.45)';
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(d * r * 0.62, r * 0.18, r * 0.15, r * 0.09, 0, 0, 7);
        ctx.fill();
      }
    }
    ctx.strokeStyle = s.acc === 'galaxy' || s.acc === 'ninja' ? '#fff' : '#111827';
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.sad) ctx.arc(0, r * 0.42, r * 0.16, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, r * 0.18, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // acessórios por cima
    switch (s.acc) {
      case 'bow':
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.moveTo(r * 0.35, -r * 0.85);
        ctx.lineTo(r * 0.05, -r * 1.15);
        ctx.lineTo(r * 0.05, -r * 0.6);
        ctx.closePath();
        ctx.moveTo(r * 0.35, -r * 0.85);
        ctx.lineTo(r * 0.7, -r * 1.15);
        ctx.lineTo(r * 0.7, -r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.37, -r * 0.86, r * 0.1, 0, 7);
        ctx.fill();
        break;
      case 'cat':
        ctx.fillStyle = s.dark;
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(d * r * 0.25, -r * 0.85);
          ctx.lineTo(d * r * 0.75, -r * 1.3);
          ctx.lineTo(d * r * 0.85, -r * 0.5);
          ctx.fill();
        }
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.2;
        for (const d of [-1, 1])
          for (const k of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(d * r * 0.5, r * 0.25);
            ctx.lineTo(d * r * 1.05, r * 0.2 + k * r * 0.12);
            ctx.stroke();
          }
        break;
      case 'unicorn': {
        const hg = ctx.createLinearGradient(0, -r * 1.6, 0, -r * 0.8);
        hg.addColorStop(0, '#fde047');
        hg.addColorStop(1, '#f472b6');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, -r * 0.85);
        ctx.lineTo(0, -r * 1.65);
        ctx.lineTo(r * 0.18, -r * 0.85);
        ctx.fill();
        const cols = ['#f472b6', '#a78bfa', '#60a5fa'];
        cols.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(-r * 0.55 - i * r * 0.12, -r * 0.7 + i * r * 0.25, r * 0.2, 0, 7);
          ctx.fill();
        });
        break;
      }
      case 'astro':
        ctx.strokeStyle = 'rgba(148,163,184,.9)';
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.12, 0, 7);
        ctx.stroke();
        ctx.fillStyle = 'rgba(186,230,253,.25)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.08, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.5, -r * 0.6, r * 0.25, r * 0.12, -0.6, 0, 7);
        ctx.fill();
        break;
      case 'flame':
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = ['#fde047', '#fb923c', '#f97316'][i];
          const h = r * (0.7 + 0.25 * Math.sin(t * 14 + i * 2));
          ctx.beginPath();
          ctx.moveTo((i - 1) * r * 0.45 - r * 0.22, -r * 0.8);
          ctx.quadraticCurveTo((i - 1) * r * 0.45, -r * 0.8 - h * 1.6, (i - 1) * r * 0.45 + r * 0.22, -r * 0.8);
          ctx.fill();
        }
        break;
      case 'dragon':
        ctx.fillStyle = '#fef3c7';
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(d * r * 0.3, -r * 0.85);
          ctx.quadraticCurveTo(d * r * 0.7, -r * 1.5, d * r * 0.85, -r * 1.4);
          ctx.quadraticCurveTo(d * r * 0.65, -r * 1.0, d * r * 0.65, -r * 0.7);
          ctx.fill();
        }
        break;
      case 'crown':
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.75);
        ctx.lineTo(-r * 0.7, -r * 1.35);
        ctx.lineTo(-r * 0.3, -r * 1.05);
        ctx.lineTo(0, -r * 1.5);
        ctx.lineTo(r * 0.3, -r * 1.05);
        ctx.lineTo(r * 0.7, -r * 1.35);
        ctx.lineTo(r * 0.6, -r * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -r * 1.0, r * 0.1, 0, 7);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  function lighten(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16,
      g = (n >> 8) & 255,
      b = n & 255;
    r = Math.round(r + (255 - r) * a);
    g = Math.round(g + (255 - g) * a);
    b = Math.round(b + (255 - b) * a);
    return `rgb(${r},${g},${b})`;
  }

  // ---------------- Som ----------------
  const Sound = {
    on: true,
    ctx: null,
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type, vol, slide) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx,
        o = c.createOscillator(),
        g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.15, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    },
    jump() { this.tone(380, 0.15, 'sine', 0.12, 720); },
    spring() { this.tone(300, 0.35, 'square', 0.08, 1200); },
    coin() { this.tone(988, 0.08, 'square', 0.06); setTimeout(() => this.tone(1319, 0.12, 'square', 0.06), 70); },
    stomp() { this.tone(200, 0.2, 'triangle', 0.2, 80); },
    die() { this.tone(500, 0.6, 'sawtooth', 0.1, 60); },
    buy() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'triangle', 0.12), i * 90)); },
    shield() { this.tone(600, 0.3, 'sine', 0.15, 300); },
  };

  // ---------------- Jogo ----------------
  const FIELD_W = 400;
  const G = 0.38;
  const JUMP = -12.5;
  const SPRING = -21;
  const R = 18;

  const Game = {
    SKINS,
    skinById,
    drawCharacter,
    Sound,
    state: 'idle', // idle | play | pause | dead
    cb: {},
  };

  let cv, ctx, dpr, scale, viewW, viewH, offX;
  let P, plats, coins, enemies, parts, floaters, clouds, stars;
  let camY, maxH, runCoins, lastPlatY, t, input, lastTime, nextMilestone, shake;

  Game.init = function (canvas, callbacks) {
    cv = canvas;
    ctx = cv.getContext('2d');
    Game.cb = callbacks || {};
    input = { left: false, right: false, touchX: null };
    resize();
    window.addEventListener('resize', resize);
    bindInput();
    clouds = [];
    for (let i = 0; i < 14; i++) clouds.push({ x: Math.random() * 1.4 - 0.2, y: Math.random(), s: 0.5 + Math.random(), p: 0.15 + Math.random() * 0.35 });
    stars = [];
    for (let i = 0; i < 80; i++) stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.6 + 0.4 });
    camY = 0;
    t = 0;
    resetWorld();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth,
      h = window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    scale = Math.min(w / FIELD_W, h / 640);
    viewW = w / scale;
    viewH = h / scale;
    offX = (viewW - FIELD_W) / 2;
  }

  function bindInput() {
    const key = (e, down) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.left = down;
      else if (k === 'arrowright' || k === 'd') input.right = down;
      else if (down && (k === 'p' || k === 'escape') && Game.cb.onPauseKey) Game.cb.onPauseKey();
    };
    window.addEventListener('keydown', (e) => key(e, true));
    window.addEventListener('keyup', (e) => key(e, false));
    const tp = (e) => {
      if (Game.state !== 'play') return;
      const touch = e.touches && e.touches[e.touches.length - 1];
      input.touchX = touch ? touch.clientX : null;
    };
    cv.addEventListener('touchstart', (e) => { Sound.unlock(); tp(e); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchmove', (e) => { tp(e); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchend', (e) => { tp(e); e.preventDefault(); }, { passive: false });
    cv.addEventListener('mousedown', (e) => { input.touchX = e.clientX; });
    window.addEventListener('mouseup', () => { input.touchX = null; });
    window.addEventListener('blur', () => { input.left = input.right = false; input.touchX = null; });
  }

  function resetWorld() {
    P = { x: FIELD_W / 2, y: -40, vx: 0, vy: JUMP, squash: 0, look: 0, jet: 0, shield: false, magnet: false, inv: 0, trailT: 0 };
    plats = [];
    coins = [];
    enemies = [];
    parts = [];
    floaters = [];
    camY = -viewH * 0.75;
    maxH = 0;
    runCoins = 0;
    shake = 0;
    nextMilestone = 500;
    plats.push({ x: FIELD_W / 2 - 50, y: 0, w: 100, type: 'normal' });
    lastPlatY = 0;
    generate();
  }

  Game.start = function (opts) {
    opts = opts || {};
    Game.skin = opts.skin || 'classic';
    Game.coinMult = opts.coinMult || 1;
    resetWorld();
    if (opts.jetpack) P.jet = 150;
    P.shield = !!opts.shield;
    P.magnet = !!opts.magnet;
    Game.state = 'play';
    Game.revives = 0;
  };
  Game.pause = () => { if (Game.state === 'play') Game.state = 'pause'; };
  Game.resume = () => { if (Game.state === 'pause') { Game.state = 'play'; lastTime = performance.now(); } };
  Game.toIdle = () => { Game.state = 'idle'; resetWorld(); };
  Game.score = () => Math.floor(maxH / 10);
  Game.runCoins = () => runCoins;
  Game.revive = function () {
    Game.revives++;
    P.y = camY + viewH * 0.55;
    P.x = FIELD_W / 2;
    P.vx = 0;
    P.vy = SPRING;
    P.jet = 90;
    P.inv = 120;
    enemies = enemies.filter((e) => Math.abs(e.y - P.y) > viewH);
    Game.state = 'play';
    lastTime = performance.now();
  };

  function difficulty() { return Math.min(1, maxH / 18000); }

  function generate() {
    const top = camY - viewH * 1.2;
    while (lastPlatY > top) {
      const d = difficulty();
      const gap = 58 + 42 * d + Math.random() * (40 + 75 * d);
      lastPlatY -= gap;
      const w = Math.max(56, 82 - 22 * d + Math.random() * 10);
      const x = Math.random() * (FIELD_W - w);
      let type = 'normal';
      const r = Math.random();
      if (r < 0.08 + 0.3 * d) type = 'moving';
      const p = { x, y: lastPlatY, w, type, vx: type === 'moving' ? (Math.random() < 0.5 ? -1 : 1) * (0.8 + 1.6 * d) : 0 };
      if (Math.random() < 0.07) p.spring = Math.random() * (w - 20) + 4;
      plats.push(p);

      // plataforma que quebra (extra, nunca é o único caminho)
      if (Math.random() < 0.06 + 0.2 * d) {
        const bx = (x + w / 2 + FIELD_W / 2 + Math.random() * 60) % (FIELD_W - 70);
        plats.push({ x: bx, y: lastPlatY - gap * 0.5, w: 70, type: 'break' });
      }
      // moedas
      if (Math.random() < 0.4) {
        const n = Math.random() < 0.25 ? 3 : 1;
        for (let i = 0; i < n; i++) coins.push({ x: x + w / 2 + (i - (n - 1) / 2) * 26, y: lastPlatY - 40 - (n > 1 ? 0 : Math.random() * 20), a: Math.random() * 6 });
      }
      if (Math.random() < 0.03) {
        // diamante raro — vale 10
        coins.push({ x: 30 + Math.random() * (FIELD_W - 60), y: lastPlatY - gap / 2, a: 0, big: true });
      }
      // inimigos
      if (maxH > 1500 && Math.random() < 0.035 + 0.07 * d) {
        enemies.push({ x: Math.random() * (FIELD_W - 40) + 20, y: lastPlatY - gap / 2, vx: (Math.random() < 0.5 ? -1 : 1) * (0.6 + d * 1.5), a: 0 });
      }
    }
    // limpa o que ficou para trás
    const bottom = camY + viewH + 100;
    plats = plats.filter((p) => p.y < bottom);
    coins = coins.filter((c) => c.y < bottom);
    enemies = enemies.filter((e) => e.y < bottom && !e.dead);
  }

  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        s = Math.random() * (spd || 3);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20, color, r: 2 + Math.random() * 3 });
    }
  }
  function floater(x, y, text, color) { floaters.push({ x, y, text, color: color || '#fff', life: 60 }); }

  function update(k) {
    t += k / 60;
    // entrada
    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;
    if (input.touchX !== null) dir = input.touchX < window.innerWidth / 2 ? -1 : 1;
    P.vx += (dir * 6.2 - P.vx) * Math.min(1, 0.18 * k);
    P.look += (Math.sign(P.vx) * Math.min(1, Math.abs(P.vx) / 3) - P.look) * 0.2;
    P.x += P.vx * k;
    if (P.x < -R) P.x += FIELD_W + 2 * R;
    if (P.x > FIELD_W + R) P.x -= FIELD_W + 2 * R;

    const prevBottom = P.y + R;
    if (P.jet > 0) {
      P.jet -= k;
      P.vy = Math.min(P.vy, -16);
      if (Math.random() < 0.8) parts.push({ x: P.x + (Math.random() - 0.5) * 10, y: P.y + R, vx: (Math.random() - 0.5) * 1.5, vy: 3 + Math.random() * 2, life: 25, color: Math.random() < 0.5 ? '#fb923c' : '#fde047', r: 3 + Math.random() * 3 });
    } else {
      P.vy += G * k;
    }
    P.y += P.vy * k;
    if (P.inv > 0) P.inv -= k;
    P.squash *= Math.pow(0.82, k);
    if (P.vy < -2) P.squash = Math.min(P.squash, -0.15);

    // plataformas
    for (const p of plats) {
      if (p.type === 'moving') {
        p.x += p.vx * k;
        if (p.x < 0 || p.x + p.w > FIELD_W) { p.vx *= -1; p.x = Math.max(0, Math.min(FIELD_W - p.w, p.x)); }
      }
      if (p.broken) { p.fall = (p.fall || 0) + 0.5 * k; p.y += p.fall * k; continue; }
      if (P.vy > 0 && prevBottom <= p.y + 2 && P.y + R >= p.y && P.x > p.x - R * 0.6 && P.x < p.x + p.w + R * 0.6) {
        if (p.type === 'break') {
          p.broken = true;
          burst(p.x + p.w / 2, p.y, '#a16207', 10, 2);
          Sound.stomp();
          continue;
        }
        const onSpring = p.spring !== undefined && Math.abs(P.x - (p.x + p.spring + 8)) < 18;
        P.y = p.y - R;
        P.vy = onSpring ? SPRING : JUMP;
        P.squash = 0.45;
        if (onSpring) { p.springT = 12; Sound.spring(); burst(P.x, p.y, '#fff', 8, 3); }
        else Sound.jump();
      }
      if (p.springT) p.springT -= k;
    }

    // moedas
    for (const c of coins) {
      c.a += 0.1 * k;
      const dx = P.x - c.x,
        dy = P.y - c.y,
        dist = Math.hypot(dx, dy);
      if (P.magnet && dist < 160 && !c.got) { c.x += (dx / dist) * 7 * k; c.y += (dy / dist) * 7 * k; }
      if (!c.got && dist < R + 12) {
        c.got = true;
        const v = (c.big ? 10 : 1) * Game.coinMult;
        runCoins += v;
        Sound.coin();
        burst(c.x, c.y, c.big ? '#67e8f9' : '#fde047', 6, 2);
        floater(c.x, c.y, '+' + v, c.big ? '#67e8f9' : '#fde047');
        Game.cb.onCoins && Game.cb.onCoins(runCoins);
      }
    }
    coins = coins.filter((c) => !c.got);

    // inimigos
    for (const e of enemies) {
      e.a += 0.08 * k;
      e.x += e.vx * k;
      if (e.x < 20 || e.x > FIELD_W - 20) e.vx *= -1;
      const ey = e.y + Math.sin(e.a) * 8;
      if (e.dead) continue;
      if (Math.abs(P.x - e.x) < R + 16 && Math.abs(P.y - ey) < R + 14) {
        if (P.jet > 0 || P.inv > 0) {
          e.dead = true;
          burst(e.x, ey, '#7c3aed', 16, 4);
          Sound.stomp();
        } else if (P.vy > 0 && P.y < ey - 6) {
          e.dead = true;
          P.vy = JUMP * 1.1;
          const v = 5 * Game.coinMult;
          runCoins += v;
          floater(e.x, ey, '+' + v + ' 🪙', '#fde047');
          burst(e.x, ey, '#7c3aed', 16, 4);
          Sound.stomp();
          Game.cb.onCoins && Game.cb.onCoins(runCoins);
        } else if (P.shield) {
          P.shield = false;
          e.dead = true;
          P.inv = 60;
          shake = 12;
          burst(e.x, ey, '#38bdf8', 20, 5);
          Sound.shield();
          floater(P.x, P.y - 30, 'Escudo!', '#38bdf8');
        } else {
          return die();
        }
      }
    }

    // partículas
    for (const p of parts) { p.x += p.vx * k; p.y += p.vy * k; p.vy += 0.1 * k; p.life -= k; }
    parts = parts.filter((p) => p.life > 0);
    for (const f of floaters) { f.y -= 0.8 * k; f.life -= k; }
    floaters = floaters.filter((f) => f.life > 0);

    // rastro de skin
    const s = skinById(Game.skin);
    if (s.trail && (P.trailT += k) > 2) {
      P.trailT = 0;
      const col = { rainbow: `hsl(${(t * 300) % 360},90%,65%)`, fire: Math.random() < 0.5 ? '#f97316' : '#fde047', gold: '#facc15', stars: Math.random() < 0.5 ? '#fff' : '#f0abfc', spark: '#38bdf8', smoke: 'rgba(255,255,255,.7)' }[s.trail];
      parts.push({ x: P.x + (Math.random() - 0.5) * 12, y: P.y + R * 0.6, vx: (Math.random() - 0.5), vy: 0.5, life: 30, color: col, r: 3 + Math.random() * 3 });
    }

    // câmera e pontuação
    const target = P.y - viewH * 0.42;
    if (target < camY) camY = target;
    const h = -P.y;
    if (h > maxH) {
      maxH = h;
      Game.cb.onScore && Game.cb.onScore(Game.score());
      if (Game.score() >= nextMilestone) {
        floater(FIELD_W / 2, P.y - 60, nextMilestone + 'm!', '#fff');
        burst(P.x, P.y, '#fde047', 24, 5);
        nextMilestone += nextMilestone < 2000 ? 500 : 1000;
      }
    }
    if (shake > 0) shake -= k;
    generate();

    // caiu
    if (P.y - camY > viewH + R * 2) {
      if (P.shield) {
        P.shield = false;
        P.vy = SPRING * 1.1;
        P.inv = 60;
        Sound.shield();
        burst(P.x, P.y - 40, '#38bdf8', 24, 5);
        floater(P.x, P.y - 80, 'Escudo salvou!', '#38bdf8');
      } else die();
    }
  }

  function die() {
    Game.state = 'dead';
    shake = 15;
    Sound.die();
    Game.cb.onDie && Game.cb.onDie(Game.score(), runCoins);
  }

  // ---------------- Desenho ----------------
  function skyColors(h) {
    // céu muda: dia -> pôr do sol -> noite -> espaço
    const stops = [
      [0, [106, 168, 255], [199, 228, 255]],
      [4000, [255, 140, 120], [255, 210, 150]],
      [9000, [40, 40, 110], [120, 80, 160]],
      [15000, [5, 5, 25], [30, 20, 70]],
    ];
    let a = stops[0],
      b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (h >= stops[i][0] && h < stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    if (h >= stops[stops.length - 1][0]) a = b;
    const f = a === b ? 0 : (h - a[0]) / (b[0] - a[0]);
    const mix = (c1, c2) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * f)).join(',')})`;
    return [mix(a[1], b[1]), mix(a[2], b[2])];
  }

  function draw() {
    const w = cv.width,
      h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const height = Math.max(0, -camY / 10);
    const [c1, c2] = skyColors(height);
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // estrelas
    const starA = Math.min(1, Math.max(0, (height - 6000) / 5000));
    if (starA > 0) {
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = starA * (0.5 + 0.5 * Math.sin(t * 2 + s.x * 50));
        const sy = ((s.y * h - camY * 0.05 * dpr * scale) % h + h) % h;
        ctx.fillRect(s.x * w, sy, s.s * dpr, s.s * dpr);
      }
      ctx.globalAlpha = 1;
    }
    // nuvens de fundo (parallax)
    ctx.fillStyle = 'rgba(255,255,255,' + (0.7 - starA * 0.5) + ')';
    for (const c of clouds) {
      const cy = ((c.y * h - camY * c.p * dpr * scale * 0.3) % (h + 200 * dpr) + h + 200 * dpr) % (h + 200 * dpr) - 100 * dpr;
      cloud(c.x * w, cy, 40 * c.s * dpr * scale);
    }

    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, (offX * scale + sx) * dpr, (-camY * scale + sy) * dpr);

    // bordas do campo em telas largas
    if (offX > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(-offX, camY, offX, viewH);
      ctx.fillRect(FIELD_W, camY, offX, viewH);
    }

    for (const p of plats) drawPlat(p);
    for (const c of coins) drawCoin(c);
    for (const e of enemies) if (!e.dead) drawEnemy(e);
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (Game.state !== 'idle') {
      if (P.inv > 0 && Math.floor(P.inv / 5) % 2 === 0) ctx.globalAlpha = 0.5;
      drawCharacter(ctx, Game.skin, P.x, P.y, R, { t, squash: P.squash, look: P.look, sad: Game.state === 'dead' });
      // espelho quando atravessa a borda
      if (P.x < R) drawCharacter(ctx, Game.skin, P.x + FIELD_W, P.y, R, { t, squash: P.squash, look: P.look });
      if (P.x > FIELD_W - R) drawCharacter(ctx, Game.skin, P.x - FIELD_W, P.y, R, { t, squash: P.squash, look: P.look });
      ctx.globalAlpha = 1;
      if (P.shield) {
        ctx.strokeStyle = `rgba(56,189,248,${0.6 + 0.3 * Math.sin(t * 8)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(P.x, P.y, R + 9, 0, 7);
        ctx.stroke();
      }
      if (P.magnet) {
        ctx.font = '14px sans-serif';
        ctx.fillText('🧲', P.x + R, P.y - R);
      }
    }

    ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 20);
      ctx.font = 'bold 20px Trebuchet MS, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s, 0, 7);
    ctx.arc(x + s, y - s * 0.4, s * 0.8, 0, 7);
    ctx.arc(x + s * 1.9, y, s * 0.9, 0, 7);
    ctx.arc(x + s * 0.9, y + s * 0.3, s * 0.9, 0, 7);
    ctx.fill();
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPlat(p) {
    const H = 14;
    if (p.type === 'break') {
      ctx.fillStyle = p.broken ? 'rgba(161,98,7,.6)' : '#d97706';
      rr(p.x, p.y, p.w, H, 6);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.4, p.y);
      ctx.lineTo(p.x + p.w * 0.5, p.y + H * 0.6);
      ctx.lineTo(p.x + p.w * 0.45, p.y + H);
      ctx.stroke();
      return;
    }
    // nuvem-plataforma
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    rr(p.x + 2, p.y + 4, p.w, H, 7);
    ctx.fill();
    ctx.fillStyle = p.type === 'moving' ? '#bae6fd' : '#ffffff';
    rr(p.x, p.y, p.w, H, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x + p.w * 0.3, p.y + 2, 8, 0, 7);
    ctx.arc(p.x + p.w * 0.62, p.y + 1, 10, 0, 7);
    ctx.fill();
    if (p.spring !== undefined) {
      const sx = p.x + p.spring,
        up = p.springT > 0 ? 14 : 6;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) ctx.lineTo(sx + 8 + (i % 2 ? 5 : -5), p.y - (i / 4) * up);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      rr(sx, p.y - up - 4, 16, 5, 2);
      ctx.fill();
    }
  }

  function drawCoin(c) {
    const sx = Math.abs(Math.cos(c.a));
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.big) {
      ctx.scale(sx * 0.4 + 0.6, 1);
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, -3);
      ctx.lineTo(0, 13);
      ctx.lineTo(-11, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(5, -3);
      ctx.lineTo(-5, -3);
      ctx.fill();
    } else {
      ctx.scale(Math.max(0.15, sx), 1);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-1.5, -4, 3, 8);
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const y = e.y + Math.sin(e.a) * 8;
    ctx.save();
    ctx.translate(e.x, y);
    // nuvem de tempestade raivosa
    ctx.fillStyle = '#6d28d9';
    ctx.beginPath();
    ctx.arc(-10, 2, 11, 0, 7);
    ctx.arc(0, -5, 13, 0, 7);
    ctx.arc(11, 2, 11, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-5, -3, 4, 0, 7);
    ctx.arc(6, -3, 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-4 + Math.sign(e.vx), -2, 2, 0, 7);
    ctx.arc(7 + Math.sign(e.vx), -2, 2, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(-2, -6);
    ctx.moveTo(10, -9);
    ctx.lineTo(3, -6);
    ctx.stroke();
    // raio
    if (Math.sin(e.a * 3) > 0.6) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-2, 10);
      ctx.lineTo(4, 10);
      ctx.lineTo(0, 18);
      ctx.lineTo(5, 18);
      ctx.lineTo(-4, 30);
      ctx.lineTo(-1, 20);
      ctx.lineTo(-5, 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Modo vitrine: no menu, o personagem pula sozinho no fundo
  function idleUpdate(k) {
    t += k / 60;
    camY -= 0.6 * k;
    generate();
    for (const p of parts) { p.x += p.vx * k; p.y += p.vy * k; p.life -= k; }
    parts = parts.filter((p) => p.life > 0);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const k = dt * 60;
    if (Game.state === 'play') {
      // sub-passos para não atravessar plataformas em quedas rápidas
      const steps = Math.ceil(k / 1.0);
      for (let i = 0; i < steps && Game.state === 'play'; i++) update(k / steps);
    } else if (Game.state === 'idle') idleUpdate(k);
    else if (Game.state === 'dead') {
      t += k / 60;
      for (const p of parts) { p.x += p.vx * k; p.y += p.vy * k; p.life -= k; }
      parts = parts.filter((p) => p.life > 0);
      if (shake > 0) shake -= k;
    }
    draw();
    requestAnimationFrame(loop);
  }

  window.Game = Game;
})();
