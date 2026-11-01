/*
 * Blitz Estelar — motor do jogo.
 * Canvas 2D puro, sem bibliotecas nem imagens: tudo é desenhado por código (carrega em < 100 KB).
 *
 * Loop viciante: tiro automático + arrastar para desviar, ondas cada vez mais difíceis,
 * chefe a cada 5 ondas, combo multiplicador e, a cada nível, escolher 1 de 3 melhorias.
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const LW = 420; // largura lógica da arena (a altura se adapta à tela)
  let LH = 760;
  let cv, ctx, W = 1, H = 1, DPR = 1, SC = 1, OX = 0, OY = 0, SAFE_TOP = 0, bgGrad = null;
  let cb = {};
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Sprite de brilho (um por cor), reaproveitado para tiros, partículas e auras.
  const glowCache = {};
  function glow(color) {
    let c = glowCache[color];
    if (!c) {
      c = makeCanvas(64, 64);
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.18, hexA(color, 1));
      gr.addColorStop(0.5, hexA(color, 0.3));
      gr.addColorStop(1, hexA(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      glowCache[color] = c;
    }
    return c;
  }
  function drawGlow(g, color, x, y, r) {
    g.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
  }
  function path(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function poly(n, rot, jag) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const t = rot + (i / n) * TAU;
      const rr = jag && i % 2 ? jag : 1;
      a.push([Math.sin(t) * rr, Math.cos(t) * rr]);
    }
    return a;
  }

  // ---------------------------------------------------------------- Som (sintetizado, 0 KB de áudio)
  const Sound = (function () {
    let ac = null, master = null, musicGain = null, on = true, music = true;
    let lastShot = 0, lastHit = 0, timer = null, step = 0, nextT = 0, noiseBuf = null, intense = false;
    function unlock() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain();
          master.gain.value = 0.55;
          master.connect(ac.destination);
          musicGain = ac.createGain();
          musicGain.gain.value = 0.32;
          musicGain.connect(master);
          noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { ac = null; }
      }
      if (ac && ac.state === 'suspended') ac.resume();
    }
    function tone(f, dur, type, vol, slide, at, out) {
      if (!ac || !on) return;
      const t = at || ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(out || master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    function noise(dur, vol, freq, at, out) {
      if (!ac || !on) return;
      const t = at || ac.currentTime;
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(freq || 1200, t);
      f.frequency.exponentialRampToValueAtTime(80, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(out || master);
      s.start(t);
      s.stop(t + dur + 0.02);
    }
    // trilha: baixo pulsante + arpejo, 128 bpm
    const BASS = [0, 0, 12, 0, 0, 0, 10, 0, -4, -4, 8, -4, -2, -2, 10, -2];
    const ARP = [12, 15, 19, 24, 19, 15, 12, 7];
    function sched() {
      if (!ac) return;
      while (nextT < ac.currentTime + 0.2) {
        if (on && music) {
          const s = step % 16, bar = Math.floor(step / 16) % 4;
          const root = 55 * Math.pow(2, [0, 0, -2, 3][bar] / 12);
          tone(root * Math.pow(2, BASS[s] / 12), 0.11, 'sawtooth', 0.09, 0, nextT, musicGain);
          if (s % 4 === 0) tone(110, 0.12, 'sine', 0.35, -70, nextT, musicGain); // bumbo
          if (s % 2 === 1) noise(0.03, 0.05, 6000, nextT, musicGain); // chimbal
          if (intense || step % 64 >= 32) tone(root * 4 * Math.pow(2, ARP[step % 8] / 12), 0.09, 'square', 0.025, 0, nextT, musicGain);
        }
        nextT += 60 / 128 / 4;
        step++;
      }
    }
    return {
      unlock,
      get on() { return on; },
      set on(v) { on = v; },
      get music() { return music; },
      set music(v) { music = v; },
      set intense(v) { intense = v; },
      startMusic() { if (!ac || timer) return; nextT = ac.currentTime + 0.05; timer = setInterval(sched, 60); },
      stopMusic() { clearInterval(timer); timer = null; },
      shoot() { if (!ac) return; const n = ac.currentTime; if (n - lastShot < 0.075) return; lastShot = n; tone(980, 0.05, 'square', 0.018, -500); },
      hit() { if (!ac) return; const n = ac.currentTime; if (n - lastHit < 0.05) return; lastHit = n; tone(300, 0.04, 'square', 0.03, -150); },
      boom(big) { noise(big ? 0.9 : 0.28, big ? 0.5 : 0.18, big ? 900 : 1600); if (big) tone(90, 0.7, 'sine', 0.4, -60); },
      coin() { tone(1320, 0.06, 'square', 0.04); tone(1760, 0.08, 'square', 0.035, 0, ac && ac.currentTime + 0.05); },
      xp() { tone(700 + Math.random() * 300, 0.04, 'sine', 0.035); },
      hurt() { noise(0.35, 0.4, 900); tone(160, 0.3, 'sawtooth', 0.15, -100); },
      shield() { tone(500, 0.25, 'sine', 0.15, 600); },
      nova() { tone(220, 0.35, 'sine', 0.12, 500); },
      levelup() { if (!ac) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.06, 0, ac.currentTime + i * 0.07)); },
      alarm() { if (!ac) return; for (let i = 0; i < 3; i++) tone(440, 0.22, 'sawtooth', 0.09, -200, ac.currentTime + i * 0.3); },
      buy() { if (!ac) return; [784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'triangle', 0.12, 0, ac.currentTime + i * 0.08)); },
      click() { tone(600, 0.05, 'triangle', 0.08); },
    };
  })();

  // ---------------------------------------------------------------- Naves do jogador
  const SHAPES = [
    { body: [[0, -1], [0.22, -0.45], [0.26, 0.55], [0.12, 0.8], [-0.12, 0.8], [-0.26, 0.55], [-0.22, -0.45]], wing: [[0.2, -0.1], [0.95, 0.5], [0.95, 0.72], [0.22, 0.55]], pit: [0, -0.35, 0.1, 0.22], eng: [[0, 0.85]] },
    { body: [[0, -1], [0.14, -0.6], [0.18, 0.7], [0, 0.9], [-0.18, 0.7], [-0.14, -0.6]], wing: [[0.15, -0.2], [0.8, -0.55], [1, -0.4], [0.5, 0.2], [0.75, 0.7], [0.18, 0.5]], pit: [0, -0.45, 0.07, 0.2], eng: [[0, 0.92]] },
    { body: [[0, -0.85], [0.35, -0.6], [0.42, 0.6], [0.25, 0.85], [-0.25, 0.85], [-0.42, 0.6], [-0.35, -0.6]], wing: [[0.38, -0.2], [1, 0.1], [1, 0.7], [0.4, 0.75]], pit: [0, -0.3, 0.15, 0.22], eng: [[-0.18, 0.9], [0.18, 0.9]] },
    { body: [[0.18, -1], [0.28, -0.4], [0.24, 0.7], [0, 0.85], [-0.24, 0.7], [-0.28, -0.4], [-0.18, -1], [-0.08, -0.55], [0.08, -0.55]], wing: [[0.25, 0], [0.9, 0.3], [1, 0.8], [0.25, 0.6]], pit: [0, -0.2, 0.1, 0.2], eng: [[0, 0.9]] },
    { body: [[0, -1], [0.18, -0.5], [0.2, 0.5], [0, 1], [-0.2, 0.5], [-0.18, -0.5]], wing: [[0.15, -0.3], [0.6, -0.5], [1, -0.2], [0.85, 0.1], [1, 0.35], [0.6, 0.4], [0.2, 0.45]], pit: [0, -0.4, 0.08, 0.2], eng: [[0, 0.95]] },
    { body: [[0, -1], [0.15, -0.7], [0.3, -0.85], [0.32, 0.6], [0.15, 0.85], [-0.15, 0.85], [-0.32, 0.6], [-0.3, -0.85], [-0.15, -0.7]], wing: [[0.3, -0.1], [1, 0.3], [0.9, 0.55], [1, 0.8], [0.3, 0.6]], pit: [0, -0.25, 0.12, 0.22], eng: [[-0.15, 0.9], [0.15, 0.9]] },
    { body: [[0, -0.9], [0.2, -0.3], [0.2, 0.6], [0, 0.75], [-0.2, 0.6], [-0.2, -0.3]], wing: [[0.18, -0.2], [0.7, -0.9], [1, -0.6], [0.75, 0.2], [0.95, 0.9], [0.2, 0.55]], pit: [0, -0.25, 0.09, 0.2], eng: [[0, 0.8]] },
  ];
  // price: coins/gems = compra dentro do jogo; iap = vem num pacote pago (dinheiro real)
  const SHIPS = [
    { id: 'falcon', name: 'Falcão', desc: 'Equilibrada. Ótima para começar.', price: {}, c1: '#4cc9f0', c2: '#123a66', glow: '#4cc9f0', shape: 0, mods: {} },
    { id: 'wasp', name: 'Vespa', desc: '+20% cadência de tiro', price: { coins: 2500 }, c1: '#ffd60a', c2: '#4a3b00', glow: '#ffb703', shape: 1, mods: { rate: 1.2 } },
    { id: 'titan', name: 'Titã', desc: '+1 vida máxima', price: { coins: 6000 }, c1: '#80ed99', c2: '#0b3d20', glow: '#57cc99', shape: 2, mods: { hp: 1 } },
    { id: 'viper', name: 'Víbora', desc: 'Já começa com tiro duplo', price: { gems: 120 }, c1: '#ff4d6d', c2: '#4a0717', glow: '#ff4d6d', shape: 3, mods: { multi: 1 } },
    { id: 'phoenix', name: 'Fênix', desc: 'Começa com drone ala + escudo', price: { iap: 'nb_starter' }, c1: '#ff9e00', c2: '#5a1e00', glow: '#ff6d00', shape: 4, mods: { drones: 1, shield: 1 } },
    { id: 'royal', name: 'Imperial', desc: '+25% de dano', price: { iap: 'nb_vip' }, c1: '#ffe08a', c2: '#6b4500', glow: '#ffd166', shape: 5, mods: { dmg: 1.25 } },
    { id: 'void', name: 'Abismo', desc: 'Começa com mísseis + onda de choque', price: { iap: 'nb_mega' }, c1: '#c77dff', c2: '#240046', glow: '#9d4edd', shape: 6, mods: { missile: 1, nova: 1 } },
  ];
  const shipById = (id) => SHIPS.find((s) => s.id === id) || SHIPS[0];

  function drawShip(g, id, x, y, s, t, tilt) {
    const sh = shipById(id), sp = SHAPES[sh.shape];
    g.save();
    g.translate(x, y);
    g.scale(s * (1 - Math.abs(tilt || 0) * 0.2), s);
    g.globalCompositeOperation = 'lighter';
    for (const e of sp.eng) {
      const fl = 0.45 + Math.sin(t * 40 + e[0] * 9) * 0.1 + Math.random() * 0.12;
      g.drawImage(glow(sh.glow), e[0] - 0.28, e[1] - 0.15, 0.56, fl * 1.6 + 0.3);
    }
    g.globalCompositeOperation = 'source-over';
    g.lineJoin = 'round';
    g.lineWidth = 0.05;
    const wg = g.createLinearGradient(0, -1, 0, 1);
    wg.addColorStop(0, sh.c1);
    wg.addColorStop(1, sh.c2);
    for (const m of [1, -1]) {
      g.save();
      g.scale(m, 1);
      path(g, sp.wing);
      g.fillStyle = wg;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.4)';
      g.stroke();
      g.restore();
    }
    const bg = g.createLinearGradient(-0.4, 0, 0.4, 0);
    bg.addColorStop(0, sh.c2);
    bg.addColorStop(0.5, sh.c1);
    bg.addColorStop(1, sh.c2);
    path(g, sp.body);
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.stroke();
    const [px, py, rx, ry] = sp.pit;
    const pg = g.createLinearGradient(0, py - ry, 0, py + ry);
    pg.addColorStop(0, '#f0fdff');
    pg.addColorStop(1, '#2b6cff');
    g.beginPath();
    g.ellipse(px, py, rx, ry, 0, 0, TAU);
    g.fillStyle = pg;
    g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------- Inimigos
  const ET = {
    drone: { hp: 3, r: 15, sp: 95, score: 10, xp: 1, coin: 0.22, c1: '#ff3d6e', c2: '#4a0820', core: '#ffd166', pts: [[0, 1], [0.95, -0.35], [0.5, -0.95], [0, -0.55], [-0.5, -0.95], [-0.95, -0.35]] },
    zig: { hp: 4, r: 15, sp: 80, score: 15, xp: 1, coin: 0.25, c1: '#ff9f1c', c2: '#4d2800', core: '#fff3b0', pts: [[0, 1], [0.9, 0], [0, -1], [-0.9, 0]] },
    kami: { hp: 2, r: 12, sp: 75, score: 15, xp: 1, coin: 0.22, c1: '#ffe14d', c2: '#4d4000', core: '#ff5d5d', pts: [[0, 1], [0.75, -0.8], [0, -0.35], [-0.75, -0.8]] },
    shooter: { hp: 9, r: 18, sp: 75, score: 30, xp: 2, coin: 0.45, c1: '#b06bff', c2: '#22084d', core: '#7df9ff', pts: poly(6, 0) },
    tank: { hp: 32, r: 26, sp: 38, score: 60, xp: 4, coin: 0.9, c1: '#2ee6a6', c2: '#043326', core: '#eaffd0', pts: poly(8, Math.PI / 8) },
    splitter: { hp: 12, r: 21, sp: 55, score: 35, xp: 2, coin: 0.45, c1: '#ff4fd8', c2: '#45083a', core: '#ffffff', pts: poly(10, 0, 0.82) },
    mini: { hp: 2, r: 10, sp: 150, score: 5, xp: 1, coin: 0.1, c1: '#ff8ae6', c2: '#45083a', core: '#ffffff', pts: poly(6, 0, 0.8) },
  };
  const SPR = {}, SPRW = {};
  const SS = 3; // resolução dos sprites (3x) para ficar nítido em telas retina
  function buildSprite(type, white) {
    const d = ET[type], size = Math.ceil(d.r * 2.4 * SS), c = makeCanvas(size, size), g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.scale(d.r * SS, d.r * SS);
    g.lineJoin = 'round';
    path(g, d.pts);
    if (white) g.fillStyle = '#fff';
    else {
      const gr = g.createLinearGradient(0, -1, 0, 1);
      gr.addColorStop(0, d.c2);
      gr.addColorStop(0.6, d.c1);
      gr.addColorStop(1, d.c1);
      g.fillStyle = gr;
    }
    g.fill();
    g.lineWidth = 0.09;
    g.strokeStyle = white ? '#fff' : 'rgba(255,255,255,.65)';
    g.stroke();
    if (!white) {
      g.save();
      g.scale(0.55, 0.55);
      path(g, d.pts);
      g.fillStyle = hexA(d.c2, 0.75);
      g.fill();
      g.restore();
      const cg = g.createRadialGradient(0, 0.1, 0, 0, 0.1, 0.28);
      cg.addColorStop(0, '#fff');
      cg.addColorStop(0.5, d.core);
      cg.addColorStop(1, hexA(d.core, 0));
      g.fillStyle = cg;
      g.beginPath();
      g.arc(0, 0.1, 0.3, 0, TAU);
      g.fill();
    }
    c.half = size / SS / 2;
    return c;
  }
  for (const k in ET) { SPR[k] = buildSprite(k, false); SPRW[k] = buildSprite(k, true); }

  // ---------------------------------------------------------------- Melhorias da partida (escolha 1 de 3)
  const UPGRADES = [
    { id: 'multi', icon: '🔱', name: 'Tiro Múltiplo', desc: '+1 projétil por disparo', max: 4 },
    { id: 'rate', icon: '⚡', name: 'Cadência', desc: '+18% velocidade de tiro', max: 6 },
    { id: 'dmg', icon: '💥', name: 'Poder de Fogo', desc: '+25% de dano', max: 6 },
    { id: 'pierce', icon: '🗡️', name: 'Perfuração', desc: 'Tiros atravessam +1 inimigo', max: 3 },
    { id: 'drone', icon: '🛸', name: 'Drone Ala', desc: 'Drone que mira e atira sozinho', max: 2 },
    { id: 'missile', icon: '🚀', name: 'Mísseis', desc: 'Mísseis teleguiados automáticos', max: 4 },
    { id: 'nova', icon: '🌀', name: 'Onda de Choque', desc: 'Pulso que destrói ao redor', max: 4 },
    { id: 'shield', icon: '🛡️', name: 'Escudo', desc: 'Bloqueia 1 dano e recarrega', max: 3 },
    { id: 'magnet', icon: '🧲', name: 'Ímã', desc: '+50% alcance de coleta', max: 3 },
    { id: 'crit', icon: '🎯', name: 'Crítico', desc: '+12% de chance de dano x2', max: 4 },
    { id: 'heal', icon: '❤️', name: 'Reparo Total', desc: '+1 vida máxima e cura tudo', max: 3 },
    { id: 'xp', icon: '📘', name: 'Sabedoria', desc: '+25% de experiência', max: 3 },
  ];

  // ---------------------------------------------------------------- Estado
  const G = { state: 'idle' };
  let P = null, R = null;
  let enemies = [], bullets = [], ebullets = [], pickups = [], parts = [], rings = [], texts = [];
  const keys = {};
  let ptr = null;
  let nebula = [];

  function compact(a) {
    let j = 0;
    for (let i = 0; i < a.length; i++) if (!a[i].dead) a[j++] = a[i];
    a.length = j;
  }
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  function newRun(o) {
    const sh = shipById(o.ship), m = sh.mods, meta = o.meta || {};
    const s = {
      dmg: (m.dmg || 1) * (1 + 0.1 * (meta.dmg || 0)),
      rate: 5.5 * (m.rate || 1) * (1 + 0.05 * (meta.rate || 0)),
      multi: 1 + (m.multi || 0),
      pierce: 0,
      drones: m.drones || 0,
      missile: m.missile || 0,
      nova: m.nova || 0,
      shield: m.shield || 0,
      magnet: 75 * (1 + 0.15 * (meta.magnet || 0)),
      crit: 0.05,
      xpMult: 1 + 0.1 * (meta.xp || 0),
      bspeed: 660,
    };
    const hpMax = 3 + (m.hp || 0) + (meta.hp || 0) + (o.armor ? 1 : 0);
    P = { ship: sh.id, x: LW / 2, y: LH - 120, tx: LW / 2, ty: LH - 120, r: 7, hp: hpMax, hpMax, inv: 2, tilt: 0, s };
    R = {
      t: 0, score: 0, coins: 0, kills: 0, bossKills: 0, level: 1, xp: 0, xpNext: 6, pendingLv: o.turbo ? 3 : 0,
      combo: 0, comboT: 0, bestCombo: 0, wave: 0, budget: 0, spawned: 0, spawnCd: 0, nextT: 0, boss: null, bossCount: 0,
      fireCd: 0, droneCd: 0.5, missileCd: 2, novaCd: 3, shieldUp: s.shield > 0, shieldCd: 0,
      bombs: o.bombs || 0, revives: 0, shake: 0, flash: 0, flashColor: '#fff', banner: null,
      coinMult: o.coinMult || 1, upLv: {}, magAll: 0, deadT: 0, reported: false, tutorial: !!o.tutorial,
    };
    enemies = []; bullets = []; ebullets = []; pickups = []; parts = []; rings = []; texts = [];
    startWave(o.startWave || 1);
  }

  // ---------------------------------------------------------------- Ondas e inimigos
  function banner(txt, sub) { R.banner = { txt, sub: sub || '', t: 2.4 }; }

  function startWave(n) {
    R.wave = n;
    R.spawned = 0;
    R.nextT = 0;
    if (n % 5 === 0) {
      R.budget = 0;
      spawnBoss();
      banner('⚠ CHEFE ⚠', 'Destrua o núcleo!');
      Sound.alarm();
      Sound.intense = true;
    } else {
      R.budget = Math.round(10 + n * 3);
      R.spawnCd = 1;
      banner('ONDA ' + n, R.tutorial && n === 1 ? 'Arraste para mover • o tiro é automático' : '');
      Sound.intense = n >= 10;
    }
    cb.onWave && cb.onWave(n);
  }

  function pickType() {
    const w = R.wave, pool = [['drone', 10]];
    if (w >= 2) pool.push(['zig', 7]);
    if (w >= 3) pool.push(['kami', 5]);
    if (w >= 4) pool.push(['shooter', 4 + w * 0.2]);
    if (w >= 6) pool.push(['tank', 2 + w * 0.1]);
    if (w >= 7) pool.push(['splitter', 3]);
    let tot = 0;
    for (const p of pool) tot += p[1];
    let r = Math.random() * tot;
    for (const p of pool) if ((r -= p[1]) <= 0) return p[0];
    return 'drone';
  }

  function spawnEnemy(type, x, y) {
    const d = ET[type];
    const hpScale = 1 + (R.wave - 1) * 0.22 + Math.max(0, R.wave - 15) * 0.15;
    const e = {
      type, x: x === undefined ? rand(30, LW - 30) : x, y: y === undefined ? -30 : y, r: d.r,
      hp: d.hp * hpScale, sp: d.sp * (1 + Math.min(0.5, R.wave * 0.02)), t: 0, ph: rand(0, TAU), flash: 0, cd: rand(0.8, 2), rot: 0,
    };
    e.maxHp = e.hp;
    if (type === 'zig') { e.bx = clamp(e.x, 70, LW - 70); e.amp = rand(40, 70); }
    if (type === 'shooter') { e.ty = rand(80, LH * 0.38); e.dir = Math.random() < 0.5 ? -1 : 1; }
    enemies.push(e);
    R.spawned++;
    return e;
  }

  function spawnFormation() {
    const f = Math.random();
    if (f < 0.4) {
      const cx = rand(90, LW - 90);
      for (let i = -2; i <= 2; i++) spawnEnemy('drone', cx + i * 34, -30 - Math.abs(i) * 30);
    } else if (f < 0.7) {
      for (let i = 0; i < 6; i++) {
        const e = spawnEnemy('zig', 50 + (i * (LW - 100)) / 5, -30);
        e.bx = e.x; e.amp = 30; e.ph = 0;
      }
    } else {
      const x = rand(60, LW - 60);
      for (let i = 0; i < 4; i++) spawnEnemy(R.wave >= 3 ? 'kami' : 'drone', x, -30 - i * 40);
    }
  }

  function spawner(dt) {
    if (R.boss) return;
    if (R.spawned < R.budget) {
      R.spawnCd -= dt;
      if (R.spawnCd <= 0) {
        R.spawnCd = Math.max(0.2, 0.78 - R.wave * 0.035) * rand(0.6, 1.3);
        if (R.wave >= 2 && Math.random() < 0.16) spawnFormation();
        else spawnEnemy(pickType());
      }
    } else if (enemies.length <= 2) {
      R.nextT += dt;
      if (R.nextT > 1) {
        const bonus = 2 + Math.floor(R.wave / 2);
        R.coins += bonus * R.coinMult;
        R.score += 100 * R.wave;
        text(LW / 2, LH * 0.45, `ONDA LIMPA! +${bonus * R.coinMult} 🪙`, '#ffd166', 20);
        startWave(R.wave + 1);
      }
    }
  }

  const BOSS_COLORS = ['#ff3d6e', '#b06bff', '#2ee6a6', '#ff9f1c', '#4cc9f0'];
  const PATTERNS = ['fan', 'spiral', 'ring', 'summon', 'rain'];
  function spawnBoss() {
    const k = ++R.bossCount;
    const hp = Math.round(300 * Math.pow(k, 1.6));
    const b = { type: 'boss', x: LW / 2, y: -90, r: 46, hp, maxHp: hp, t: 0, k, flash: 0, enter: true, pat: 0, patT: 0, emit: 1, ang: 0, color: BOSS_COLORS[(k - 1) % 5] };
    enemies.push(b);
    R.boss = b;
  }
  const eSpeed = () => Math.min(290, 165 + R.wave * 5);
  const aimAt = (e) => Math.atan2(P.y - e.y, P.x - e.x);
  function eShot(x, y, a, sp, big) {
    ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: big ? 7 : 5, big });
  }

  function updateBoss(b, dt) {
    if (b.enter) { b.y += 70 * dt; if (b.y >= 185) b.enter = false; return; }
    const rage = b.hp < b.maxHp * 0.5 ? 1.35 : 1;
    b.x = LW / 2 + Math.sin(b.t * 0.55) * (LW / 2 - 75);
    b.y = 185 + Math.sin(b.t * 1.1) * 18;
    b.patT += dt;
    b.emit -= dt * rage;
    if (b.patT > 4.2) {
      b.patT = 0;
      b.pat = (b.pat + 1) % Math.min(PATTERNS.length, 2 + b.k);
      b.emit = 0.7;
      b.summoned = false;
    }
    if (b.emit > 0) return;
    const sp = eSpeed() * 0.85;
    switch (PATTERNS[b.pat]) {
      case 'fan': {
        b.emit = 0.75;
        const n = 5 + b.k, a0 = aimAt(b);
        for (let i = 0; i < n; i++) eShot(b.x, b.y + 30, a0 + (i - (n - 1) / 2) * 0.16, sp);
        break;
      }
      case 'spiral': {
        b.emit = 0.075;
        const arms = b.k > 2 ? 3 : 2;
        for (let j = 0; j < arms; j++) eShot(b.x, b.y, b.ang + (j * TAU) / arms, sp * 0.8);
        b.ang += 0.23;
        break;
      }
      case 'ring': {
        b.emit = 1.05;
        const n = 14 + b.k * 2, off = Math.random() * TAU;
        for (let i = 0; i < n; i++) eShot(b.x, b.y, off + (i / n) * TAU, sp * 0.75, true);
        break;
      }
      case 'summon': {
        b.emit = 0.5;
        if (!b.summoned) {
          b.summoned = true;
          spawnEnemy('kami', b.x - 50, b.y);
          spawnEnemy('kami', b.x + 50, b.y);
          if (b.k > 2) spawnEnemy('shooter', b.x, b.y);
        }
        const a0 = aimAt(b);
        for (let i = -1; i <= 1; i++) eShot(b.x, b.y + 30, a0 + i * 0.25, sp);
        break;
      }
      case 'rain':
        b.emit = 0.11;
        eShot(rand(20, LW - 20), -10, Math.PI / 2 + rand(-0.15, 0.15), sp * 0.7);
        break;
    }
  }

  function updateEnemies(dt, alive) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      switch (e.type) {
        case 'drone': e.y += e.sp * dt; e.x += Math.sin(e.t * 2 + e.ph) * 22 * dt; break;
        case 'zig': e.y += e.sp * dt; e.x = e.bx + Math.sin(e.t * 2.6 + e.ph) * e.amp; break;
        case 'kami':
          if (e.t < 0.8 || !alive) { e.y += e.sp * dt; break; }
          if (!e.locked) {
            const a = aimAt(e);
            e.locked = true; e.v = 120; e.vx = Math.cos(a); e.vy = Math.sin(a);
            e.rot = a - Math.PI / 2;
          }
          e.v = Math.min(380, e.v + 420 * dt);
          e.x += e.vx * e.v * dt; e.y += e.vy * e.v * dt;
          break;
        case 'shooter':
          if (e.t > 12) e.y += 130 * dt;
          else if (e.y < e.ty) e.y += e.sp * dt;
          else {
            e.x += e.dir * 45 * dt;
            if (e.x < 30 || e.x > LW - 30) e.dir *= -1;
            e.cd -= dt;
            if (e.cd <= 0 && alive) { e.cd = Math.max(1.1, 2.4 - R.wave * 0.06); eShot(e.x, e.y + 12, aimAt(e), eSpeed()); }
          }
          break;
        case 'tank':
          e.y += e.sp * dt;
          e.cd -= dt;
          if (e.cd <= 0 && e.y > 40 && alive) {
            e.cd = 2.8;
            const a = aimAt(e);
            for (let i = -1; i <= 1; i++) eShot(e.x, e.y + 20, a + i * 0.22, eSpeed() * 0.9, true);
          }
          break;
        case 'splitter': e.y += e.sp * dt; e.x += Math.sin(e.t * 1.5 + e.ph) * 30 * dt; break;
        case 'mini':
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.x < 10 || e.x > LW - 10) e.vx *= -1;
          break;
        case 'boss': updateBoss(e, dt); break;
      }
      if (e.y > LH + 60 || e.x < -90 || e.x > LW + 90) { e.dead = true; continue; }
      if (alive && P.inv <= 0) {
        const rr = e.r * 0.8 + P.r, dx = e.x - P.x, dy = e.y - P.y;
        if (dx * dx + dy * dy < rr * rr) {
          hurtPlayer();
          if (e.type !== 'boss' && e.type !== 'tank') killEnemy(e);
        }
      }
    }
  }

  function hitEnemy(e, dmg, crit) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.05;
    if (crit) spark(e.x, e.y, '#ffe14d', 4);
    Sound.hit();
    if (e.hp <= 0) killEnemy(e);
  }

  const comboMult = () => Math.min(5, 1 + Math.floor(R.combo / 15) * 0.5);

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    R.kills++;
    if (e.type === 'boss') return bossDown(e);
    const d = ET[e.type];
    explode(e.x, e.y, d.c1, Math.round(e.r * 0.9));
    Sound.boom(false);
    R.combo++;
    R.comboT = 2.2;
    if (R.combo > R.bestCombo) R.bestCombo = R.combo;
    if (R.combo % 25 === 0) { text(e.x, e.y - 20, `COMBO ${R.combo}!`, '#ff4fd8', 22); Sound.levelup(); }
    R.score += Math.round(d.score * comboMult() * (1 + R.wave * 0.05));
    for (let i = 0; i < d.xp; i++) drop('xp', e.x, e.y, 1);
    if (Math.random() < d.coin) drop('coin', e.x, e.y, 1);
    const r = Math.random();
    if (r < (P.hp < P.hpMax ? 0.025 : 0.008)) drop('heart', e.x, e.y);
    else if (r < 0.04 && r > 0.03) drop('magnet', e.x, e.y);
    else if (r > 0.996) drop('bomb', e.x, e.y);
    if (e.type === 'splitter') {
      for (const s of [-1, 1]) {
        const m = spawnEnemy('mini', e.x + s * 10, e.y);
        m.vx = s * 100; m.vy = 130;
      }
    }
  }

  function bossDown(b) {
    R.boss = null;
    R.bossKills++;
    for (let i = 0; i < 6; i++) explode(b.x + rand(-40, 40), b.y + rand(-40, 40), i % 2 ? b.color : '#ffffff', 26);
    rings.push({ x: b.x, y: b.y, r: 0, R: 260, life: 0.6, max: 0.6, c: b.color });
    Sound.boom(true);
    buzz(200);
    R.shake = 22;
    R.flash = 0.6;
    R.flashColor = '#ffffff';
    for (const eb of ebullets) { eb.dead = true; spark(eb.x, eb.y, '#ffd166', 1); }
    for (let i = 0; i < 18 + b.k * 6; i++) drop('coin', b.x + rand(-30, 30), b.y + rand(-30, 30), 1);
    for (let i = 0; i < 6 + b.k * 2; i++) drop('xp', b.x + rand(-30, 30), b.y + rand(-30, 30), 4);
    drop('heart', b.x, b.y);
    R.score += 1000 * b.k;
    R.combo += 10;
    banner('CHEFE DESTRUÍDO!', `+${1000 * b.k} pontos`);
  }

  // ---------------------------------------------------------------- Jogador
  function nearestEnemy(x, y, maxY) {
    let best = null, bd = Infinity;
    for (const e of enemies) {
      if (e.dead || e.y < -20 || (maxY !== undefined && e.y > maxY)) continue;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function updatePlayer(dt) {
    const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      P.tx = P.x = clamp(P.x + (kx / l) * 380 * dt, 14, LW - 14);
      P.ty = P.y = clamp(P.y + (ky / l) * 380 * dt, 90, LH - 24);
    }
    P.tx = clamp(P.tx, 14, LW - 14);
    P.ty = clamp(P.ty, 90, LH - 24);
    const px = P.x, k = Math.min(1, dt * 20);
    P.x += (P.tx - P.x) * k;
    P.y += (P.ty - P.y) * k;
    const vx = (P.x - px) / Math.max(dt, 0.001);
    P.tilt += (clamp(vx / 500, -1, 1) - P.tilt) * Math.min(1, dt * 10);
    if (P.inv > 0) P.inv -= dt;
    if (P.s.shield > 0 && !R.shieldUp) {
      R.shieldCd -= dt;
      if (R.shieldCd <= 0) { R.shieldUp = true; Sound.shield(); }
    }
    if (parts.length < 450) {
      const sh = shipById(P.ship);
      parts.push({ x: P.x + rand(-3, 3), y: P.y + 16, vx: rand(-15, 15), vy: rand(160, 240), life: 0.25, max: 0.25, c: sh.glow, s: 6 });
    }
  }

  function dronePos(i) {
    const side = i === 0 ? -1 : 1;
    return { x: P.x + side * 32, y: P.y + 12 + Math.sin(R.t * 4 + i) * 3 };
  }

  function fireAll(dt) {
    const s = P.s;
    R.fireCd -= dt;
    if (R.fireCd < -0.1) R.fireCd = 0;
    if (R.fireCd <= 0) {
      R.fireCd += 1 / s.rate;
      const n = s.multi;
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2, a = -Math.PI / 2 + off * 0.085;
        bullets.push({ x: P.x + off * 7, y: P.y - 16, vx: Math.cos(a) * s.bspeed, vy: Math.sin(a) * s.bspeed, dmg: s.dmg, pierce: s.pierce, r: 4, hits: null, kind: 0 });
      }
      Sound.shoot();
    }
    if (s.drones > 0) {
      R.droneCd -= dt;
      if (R.droneCd <= 0) {
        R.droneCd = 1 / (s.rate * 0.55);
        for (let i = 0; i < s.drones; i++) {
          const d = dronePos(i), t = nearestEnemy(d.x, d.y, d.y - 10);
          const a = t ? Math.atan2(t.y - d.y, t.x - d.x) : -Math.PI / 2;
          bullets.push({ x: d.x, y: d.y - 6, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, dmg: s.dmg * 0.8, pierce: 0, r: 3.5, hits: null, kind: 2 });
        }
      }
    }
    if (s.missile > 0) {
      R.missileCd -= dt;
      if (R.missileCd <= 0) {
        R.missileCd = Math.max(0.6, 2.4 - 0.45 * s.missile);
        const n = 1 + (s.missile >= 3 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const side = i % 2 ? 1 : -1;
          bullets.push({ x: P.x + side * 10, y: P.y, vx: side * 160, vy: -60, v: 180, dmg: s.dmg * 5, pierce: 0, r: 5, hits: null, kind: 1, target: null, life: 3 });
        }
      }
    }
    if (s.nova > 0) {
      R.novaCd -= dt;
      if (R.novaCd <= 0) {
        R.novaCd = Math.max(1.5, 4.5 - 0.7 * s.nova);
        const rad = 85 + 20 * s.nova, dmg = s.dmg * (3 + 2 * s.nova);
        rings.push({ x: P.x, y: P.y, r: 0, R: rad, life: 0.35, max: 0.35, c: '#7df9ff' });
        for (const e of enemies) {
          const rr = rad + e.r;
          if ((e.x - P.x) ** 2 + (e.y - P.y) ** 2 < rr * rr) hitEnemy(e, dmg, false);
        }
        for (const b of ebullets) if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < rad * rad) b.dead = true;
        Sound.nova();
      }
    }
  }

  function hurtPlayer() {
    if (P.inv > 0 || G.state !== 'play') return;
    clearBulletsNear(P.x, P.y, 90);
    if (R.shieldUp) {
      R.shieldUp = false;
      R.shieldCd = Math.max(5, 15 - 3 * P.s.shield);
      P.inv = 1;
      spark(P.x, P.y, '#7df9ff', 18);
      Sound.shield();
      return;
    }
    P.hp--;
    P.inv = 1.6;
    R.shake = 12;
    R.flash = 0.35;
    R.flashColor = '#ff2a4a';
    R.combo = 0;
    buzz(80);
    Sound.hurt();
    clearBulletsNear(P.x, P.y, 120);
    if (P.hp <= 0) die();
  }
  function clearBulletsNear(x, y, rad) {
    for (const b of ebullets) if ((b.x - x) ** 2 + (b.y - y) ** 2 < rad * rad) { b.dead = true; spark(b.x, b.y, '#ff5d8f', 1); }
  }

  function die() {
    G.state = 'dead';
    R.deadT = 1.3;
    explode(P.x, P.y, shipById(P.ship).glow, 40);
    explode(P.x, P.y, '#ffffff', 20);
    rings.push({ x: P.x, y: P.y, r: 0, R: 140, life: 0.5, max: 0.5, c: '#ffffff' });
    Sound.boom(true);
    buzz(300);
    R.shake = 20;
  }

  // ---------------------------------------------------------------- Tiros, coletáveis, efeitos
  function updateBullets(dt) {
    for (const b of bullets) {
      if (b.kind === 1) {
        b.life -= dt;
        if (b.life <= 0) { b.dead = true; continue; }
        if (!b.target || b.target.dead) b.target = nearestEnemy(b.x, b.y);
        let a = Math.atan2(b.vy, b.vx);
        if (b.target) {
          const want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          let da = want - a;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          a += clamp(da, -7 * dt, 7 * dt);
        }
        b.v = Math.min(600, b.v + 900 * dt);
        b.vx = Math.cos(a) * b.v;
        b.vy = Math.sin(a) * b.v;
        if (parts.length < 450) parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, c: '#ff9e00', s: 5 });
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.y > LH + 30 || b.x < -30 || b.x > LW + 30) { b.dead = true; continue; }
      for (const e of enemies) {
        if (e.dead || e.y < -e.r) continue;
        const rr = e.r + b.r, dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy >= rr * rr) continue;
        if (b.hits && b.hits.indexOf(e) >= 0) continue;
        const crit = Math.random() < P.s.crit;
        hitEnemy(e, b.dmg * (crit ? 2 : 1), crit);
        if (b.kind === 1) explode(b.x, b.y, '#ff9e00', 6);
        else spark(b.x, b.y, '#7df9ff', 2);
        if (b.pierce > 0) { b.pierce--; (b.hits || (b.hits = [])).push(e); }
        else { b.dead = true; break; }
      }
    }
  }

  function updateEBullets(dt, alive) {
    for (const b of ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -40 || b.y > LH + 30 || b.x < -30 || b.x > LW + 30) { b.dead = true; continue; }
      if (alive && P.inv <= 0) {
        const rr = b.r * 0.7 + P.r;
        if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < rr * rr) { b.dead = true; hurtPlayer(); }
      }
    }
  }

  function drop(type, x, y, v) {
    pickups.push({ type, x, y, vx: rand(-70, 70), vy: rand(-150, -40), v: v || 1, t: rand(0, 6), hs: 0 });
  }
  function updatePickups(dt, alive) {
    const mag2 = P.s.magnet * P.s.magnet;
    for (const p of pickups) {
      p.t += dt;
      const dx = P.x - p.x, dy = P.y - p.y, d2 = dx * dx + dy * dy;
      if (alive && (p.hs || d2 < mag2 || R.magAll > 0)) {
        p.hs = Math.min(900, (p.hs || 280) + 1100 * dt);
        const d = Math.sqrt(d2) || 1;
        p.vx = (dx / d) * p.hs;
        p.vy = (dy / d) * p.hs;
      } else {
        p.vy = Math.min(p.vy + 240 * dt, 75);
        p.vx *= 0.96;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (alive && d2 < 26 * 26) collect(p);
      else if (p.y > LH + 30) p.dead = true;
    }
  }
  function collect(p) {
    p.dead = true;
    switch (p.type) {
      case 'xp': addXp(p.v); Sound.xp(); break;
      case 'coin': R.coins += R.coinMult * p.v; Sound.coin(); break;
      case 'heart':
        if (P.hp < P.hpMax) { P.hp++; text(P.x, P.y - 30, '+1 ❤️', '#ff4d6d', 18); }
        else { R.score += 250; text(P.x, P.y - 30, '+250', '#ff4d6d', 16); }
        Sound.buy();
        break;
      case 'bomb': R.bombs++; text(P.x, P.y - 30, '+1 💣', '#ffd166', 18); cb.onBombs && cb.onBombs(R.bombs); Sound.buy(); break;
      case 'magnet': R.magAll = 4; text(P.x, P.y - 30, 'ÍMÃ!', '#7df9ff', 18); Sound.buy(); break;
    }
  }
  function addXp(v) {
    R.xp += v * P.s.xpMult;
    while (R.xp >= R.xpNext) {
      R.xp -= R.xpNext;
      R.level++;
      R.xpNext = Math.round(R.xpNext * 1.2 + 4);
      R.pendingLv++;
    }
  }

  function explode(x, y, c, n) {
    for (let i = 0; i < n && parts.length < 600; i++) {
      const a = rand(0, TAU), sp = rand(40, 260);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.7), max: 0.7, c, s: rand(6, 14) });
    }
    rings.push({ x, y, r: 0, R: n * 2.2, life: 0.25, max: 0.25, c });
  }
  function spark(x, y, c, n) {
    for (let i = 0; i < n && parts.length < 600; i++) {
      const a = rand(0, TAU), sp = rand(60, 200);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.2, max: 0.25, c, s: 5 });
    }
  }
  function text(x, y, txt, c, size) { texts.push({ x, y, txt, c, size: size || 16, life: 1.2 }); }

  function updateFx(dt) {
    for (const p of parts) {
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    for (const r of rings) { r.life -= dt; if (r.life <= 0) r.dead = true; else r.r = r.R * (1 - r.life / r.max); }
    for (const t of texts) { t.life -= dt; t.y -= 30 * dt; if (t.life <= 0) t.dead = true; }
    if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 40);
    if (R.flash > 0) R.flash -= dt * 1.5;
    if (R.banner && (R.banner.t -= dt) <= 0) R.banner = null;
  }

  function levelUp() {
    G.state = 'levelup';
    Sound.levelup();
    cb.onLevelUp && cb.onLevelUp(choices(), R.level);
  }
  function choices() {
    const avail = UPGRADES.filter((u) => (R.upLv[u.id] || 0) < u.max);
    for (let i = avail.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [avail[i], avail[j]] = [avail[j], avail[i]];
    }
    const out = avail.slice(0, 3).map((u) => Object.assign({ lv: (R.upLv[u.id] || 0) + 1 }, u));
    while (out.length < 3) out.push({ id: 'cash', icon: '🪙', name: 'Bolsa de Moedas', desc: '+25 moedas agora', lv: 1, max: 99 });
    return out;
  }
  function applyUpgrade(id) {
    const s = P.s;
    R.upLv[id] = (R.upLv[id] || 0) + 1;
    switch (id) {
      case 'multi': s.multi++; break;
      case 'rate': s.rate *= 1.18; break;
      case 'dmg': s.dmg *= 1.25; break;
      case 'pierce': s.pierce++; break;
      case 'drone': s.drones = Math.min(2, s.drones + 1); break;
      case 'missile': s.missile++; break;
      case 'nova': s.nova++; R.novaCd = 0.5; break;
      case 'shield': s.shield++; R.shieldUp = true; break;
      case 'magnet': s.magnet *= 1.5; break;
      case 'crit': s.crit += 0.12; break;
      case 'heal': P.hpMax++; P.hp = P.hpMax; break;
      case 'xp': s.xpMult *= 1.25; break;
      case 'cash': R.coins += 25 * R.coinMult; break;
    }
  }

  // ---------------------------------------------------------------- Desenho
  let stars = [];
  function initStars() {
    stars = [];
    const n = Math.min(260, Math.round((W * H) / 5000));
    for (let i = 0; i < n; i++) stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.15, 1) });
    nebula = [0, 1, 2].map((i) => ({ x: rand(0, LW), y: rand(0, LH), r: rand(180, 280), c: ['#3a0ca3', '#7209b7', '#4361ee'][i] }));
  }
  const NEB = [['#3a0ca3', '#7209b7', '#4361ee'], ['#7209b7', '#f72585', '#3a0ca3'], ['#0b525b', '#06d6a0', '#3a0ca3'], ['#9d0208', '#f48c06', '#3a0ca3']];

  function render(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    const fast = G.state === 'play' ? (R && R.boss ? 1.6 : 1) : 0.35;
    ctx.fillStyle = '#cfe3ff';
    for (const s of stars) {
      s.y += (15 + s.z * 140) * dt * fast;
      if (s.y > H) { s.y = -4; s.x = rand(0, W); }
      ctx.globalAlpha = 0.25 + s.z * 0.75;
      const sz = s.z * 2;
      ctx.fillRect(s.x, s.y, sz, sz * (1 + s.z * fast * 2));
    }
    ctx.globalAlpha = 1;

    const sh = R && G.state !== 'idle' ? R.shake : 0;
    ctx.save();
    ctx.translate(OX + (sh ? rand(-sh, sh) : 0), OY + (sh ? rand(-sh, sh) : 0));
    ctx.scale(SC, SC);
    // nebulosa
    ctx.globalCompositeOperation = 'lighter';
    const pal = NEB[R ? Math.floor((R.wave - 1) / 5) % NEB.length : 0];
    nebula.forEach((n, i) => {
      n.y += 8 * dt * fast;
      if (n.y - n.r > LH) { n.y = -n.r; n.x = rand(0, LW); }
      ctx.globalAlpha = 0.16;
      drawGlow(ctx, pal[i], n.x, n.y, n.r);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (OX > 2) {
      ctx.fillStyle = 'rgba(76,201,240,.25)';
      ctx.fillRect(-2, 0, 2, LH);
      ctx.fillRect(LW, 0, 2, LH);
    }

    if (G.state !== 'idle' && R) drawWorld();
    ctx.restore();

    if (R && R.flash > 0 && G.state !== 'idle') {
      ctx.globalAlpha = Math.min(0.6, R.flash);
      ctx.fillStyle = R.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function drawWorld() {
    const t = R.t;
    // coletáveis
    for (const p of pickups) {
      const bob = Math.sin(p.t * 6) * 1.5;
      if (p.type === 'xp') {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, p.v > 1 ? '#06d6a0' : '#4cc9f0', p.x, p.y + bob, p.v > 1 ? 13 : 9);
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.type === 'coin') {
        const w = Math.abs(Math.cos(p.t * 4)) * 6 + 1;
        ctx.fillStyle = '#b8860b';
        ctx.beginPath(); ctx.ellipse(p.x, p.y + bob, w + 1, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.ellipse(p.x, p.y + bob, w, 6, 0, 0, TAU); ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, p.type === 'heart' ? '#ff4d6d' : p.type === 'bomb' ? '#ffd166' : '#7df9ff', p.x, p.y, 22);
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type === 'heart' ? '❤️' : p.type === 'bomb' ? '💣' : '🧲', p.x, p.y + bob);
      }
    }
    // inimigos
    for (const e of enemies) {
      if (e.type === 'boss') { drawBoss(e); continue; }
      const spr = e.flash > 0 ? SPRW[e.type] : SPR[e.type], h = spr.half;
      if (e.rot) {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot);
        ctx.drawImage(spr, -h, -h, h * 2, h * 2);
        ctx.restore();
      } else ctx.drawImage(spr, e.x - h, e.y - h, h * 2, h * 2);
      if (e.type === 'tank' && e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - 20, e.y - 34, 40, 4);
        ctx.fillStyle = '#2ee6a6'; ctx.fillRect(e.x - 20, e.y - 34, 40 * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
    // tiros do jogador
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      if (b.kind === 1) drawGlow(ctx, '#ff9e00', b.x, b.y, 12);
      else if (b.kind === 2) drawGlow(ctx, '#80ed99', b.x, b.y, 8);
      else ctx.drawImage(glow('#4cc9f0'), b.x - 6, b.y - 14, 12, 28);
    }
    // partículas
    for (const p of parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      drawGlow(ctx, p.c, p.x, p.y, p.s * (0.4 + k * 0.6));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const r of rings) {
      ctx.globalAlpha = r.life / r.max;
      ctx.strokeStyle = r.c;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // jogador
    if (G.state !== 'dead') {
      for (let i = 0; i < P.s.drones; i++) {
        const d = dronePos(i);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, '#80ed99', d.x, d.y, 12);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#d8f3dc';
        path(ctx, [[d.x, d.y - 8], [d.x + 6, d.y + 5], [d.x - 6, d.y + 5]]);
        ctx.fill();
      }
      if (!(P.inv > 0 && Math.floor(P.inv * 12) % 2 === 0)) {
        drawShip(ctx, P.ship, P.x, P.y, 19, t, P.tilt);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, '#ffffff', P.x, P.y, 6);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (R.shieldUp) {
        ctx.strokeStyle = `rgba(125,249,255,${0.45 + Math.sin(t * 6) * 0.2})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(P.x, P.y, 26, 0, TAU); ctx.stroke();
      }
    }
    // tiros inimigos (por cima de tudo, para ficar fácil de ver)
    for (const b of ebullets) {
      drawGlow(ctx, b.big ? '#ff9f1c' : '#ff3d6e', b.x, b.y, b.r * 2.2);
    }
    // textos
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const tx of texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      ctx.font = `900 ${tx.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(tx.txt, tx.x, tx.y);
      ctx.fillStyle = tx.c;
      ctx.fillText(tx.txt, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
    drawHUD();
  }

  function drawBoss(b) {
    const r = b.r, c = b.color;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    drawGlow(ctx, c, 0, 0, r * 2.4);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.rotate(b.t * 0.8);
    ctx.scale(r * 1.15, r * 1.15);
    path(ctx, poly(16, 0, 0.72));
    ctx.fillStyle = b.flash > 0 ? '#fff' : '#1a0b2e';
    ctx.fill();
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.rotate(-b.t * 1.4);
    ctx.scale(r * 0.75, r * 0.75);
    path(ctx, poly(6, 0));
    const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    g.addColorStop(0, b.flash > 0 ? '#fff' : c);
    g.addColorStop(1, '#12051f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
    const a = Math.atan2(P.y - b.y, P.x - b.x), pulse = 1 + Math.sin(b.t * 8) * 0.12;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12, r * 0.15, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    const top = 8 + SAFE_TOP / SC;
    // barra de experiência
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(10, top, LW - 20, 6);
    const xg = ctx.createLinearGradient(10, 0, LW - 10, 0);
    xg.addColorStop(0, '#4cc9f0');
    xg.addColorStop(1, '#06d6a0');
    ctx.fillStyle = xg;
    ctx.fillRect(10, top, (LW - 20) * Math.min(1, R.xp / R.xpNext), 6);
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    const label = (txt, x, y, size, color, align) => {
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.textAlign = align;
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
    };
    label(R.score.toLocaleString('pt-BR'), LW / 2, top + 12, 28, '#ffffff', 'center');
    if (R.combo >= 5) {
      const m = comboMult();
      label(`COMBO ${R.combo}  x${m}`, LW / 2, top + 44, 15, m >= 3 ? '#ff4fd8' : '#ffd166', 'center');
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(LW / 2 - 50, top + 62, 100, 3);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(LW / 2 - 50, top + 62, 100 * Math.max(0, R.comboT / 2.2), 3);
    }
    let hearts = '';
    for (let i = 0; i < P.hpMax; i++) hearts += i < P.hp ? '❤️' : '🖤';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(hearts, 12, top + 14);
    label(`ONDA ${R.wave}  •  NV ${R.level}`, 12, top + 36, 13, '#bde0fe', 'left');
    label(`🪙 ${R.coins}`, LW - 12, top + 58, 16, '#ffd166', 'right');
    if (R.boss) {
      const b = R.boss, w = LW * 0.62, x = (LW - w) / 2, y = top + 78;
      label(`CHEFE NV ${b.k}`, LW / 2, y - 18, 12, b.color, 'center');
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(x - 2, y - 2, w + 4, 10);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 6);
    }
    if (R.banner) {
      const bn = R.banner, a = Math.min(1, bn.t * 2, (2.4 - bn.t) * 5);
      ctx.globalAlpha = Math.max(0, a);
      ctx.textBaseline = 'middle';
      label(bn.txt, LW / 2, LH * 0.36, 40, '#ffffff', 'center');
      if (bn.sub) label(bn.sub, LW / 2, LH * 0.36 + 38, 16, '#bde0fe', 'center');
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- Loop e entrada
  function update(dt) {
    const alive = G.state === 'play';
    R.t += dt;
    if (alive) { updatePlayer(dt); fireAll(dt); spawner(dt); }
    updateEnemies(dt, alive);
    updateBullets(dt);
    updateEBullets(dt, alive);
    updatePickups(dt, alive);
    updateFx(dt);
    if (R.comboT > 0) { R.comboT -= dt; if (R.comboT <= 0) R.combo = 0; }
    if (R.magAll > 0) R.magAll -= dt;
    compact(enemies); compact(bullets); compact(ebullets); compact(pickups); compact(parts); compact(rings); compact(texts);
    if (G.state === 'play' && R.pendingLv > 0) levelUp();
    if (G.state === 'dead') {
      R.deadT -= dt;
      if (R.deadT <= 0 && !R.reported) { R.reported = true; cb.onDie && cb.onDie(result()); }
    }
  }

  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.034, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (G.state === 'play' || G.state === 'dead') update(dt);
    else if (R && G.state !== 'idle') updateFx(0);
    render(G.state === 'pause' || G.state === 'levelup' ? 0 : dt);
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    LH = clamp(Math.round((H / W) * LW), 620, 900);
    SC = Math.min(W / LW, H / LH);
    OX = (W - LW * SC) / 2;
    OY = (H - LH * SC) / 2;
    SAFE_TOP = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#03040f');
    bgGrad.addColorStop(1, '#130828');
    initStars();
  }

  function toLogical(e) { return { x: (e.clientX - OX) / SC, y: (e.clientY - OY) / SC }; }

  function init(canvas, callbacks) {
    cv = canvas;
    ctx = cv.getContext('2d');
    cb = callbacks || {};
    resize();
    window.addEventListener('resize', resize);
    cv.addEventListener('pointerdown', (e) => {
      if (!P || G.state !== 'play') return;
      const p = toLogical(e);
      ptr = { id: e.pointerId, sx: p.x, sy: p.y, px: P.tx, py: P.ty, mouse: e.pointerType === 'mouse' };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!P || G.state !== 'play') return;
      const p = toLogical(e);
      if (e.pointerType === 'mouse') { P.tx = p.x; P.ty = p.y; return; } // mouse: a nave segue o cursor
      if (!ptr || ptr.id !== e.pointerId) return;
      P.tx = ptr.px + (p.x - ptr.sx) * 1.35; // toque: arrasto relativo (o dedo não cobre a nave)
      P.ty = ptr.py + (p.y - ptr.sy) * 1.35;
    });
    const up = (e) => { if (ptr && ptr.id === e.pointerId) ptr = null; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if ((e.code === 'Escape' || e.code === 'KeyP') && cb.onPauseKey) cb.onPauseKey();
      if ((e.code === 'Space' || e.code === 'KeyB') && G.state === 'play' && cb.onBombKey) { e.preventDefault(); cb.onBombKey(); }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    requestAnimationFrame(frame);
  }

  function result() {
    return { score: R.score, wave: R.wave, kills: R.kills, bosses: R.bossKills, coins: R.coins, level: R.level, combo: R.bestCombo, time: Math.round(R.t), revives: R.revives };
  }

  window.Game = {
    SHIPS, UPGRADES, shipById, drawShip, Sound,
    init,
    get state() { return G.state; },
    start(o) { newRun(o || {}); G.state = 'play'; last = performance.now(); Sound.startMusic(); },
    pause() { if (G.state === 'play') G.state = 'pause'; },
    resume() { if (G.state === 'pause') { G.state = 'play'; last = performance.now(); } },
    choose(id) {
      if (G.state !== 'levelup') return;
      applyUpgrade(id);
      R.pendingLv--;
      if (R.pendingLv > 0) cb.onLevelUp && cb.onLevelUp(choices(), R.level);
      else { G.state = 'play'; last = performance.now(); }
    },
    revive() {
      if (G.state !== 'dead') return;
      R.revives++;
      R.reported = false;
      P.hp = P.hpMax;
      P.inv = 3;
      for (const b of ebullets) b.dead = true;
      for (const e of enemies) if (e.type !== 'boss') { e.dead = true; explode(e.x, e.y, ET[e.type].c1, 8); }
      compact(enemies); compact(ebullets);
      rings.push({ x: P.x, y: P.y, r: 0, R: 300, life: 0.6, max: 0.6, c: '#7df9ff' });
      Sound.nova();
      G.state = 'play';
      last = performance.now();
    },
    bomb() {
      if (G.state !== 'play' || R.bombs <= 0) return R ? R.bombs : 0;
      R.bombs--;
      R.flash = 0.7;
      R.flashColor = '#ffffff';
      R.shake = 16;
      for (const b of ebullets) b.dead = true;
      for (const e of enemies) {
        if (e.type === 'boss') hitEnemy(e, e.maxHp * 0.12, false);
        else killEnemy(e);
      }
      rings.push({ x: P.x, y: P.y, r: 0, R: 500, life: 0.5, max: 0.5, c: '#ffd166' });
      Sound.boom(true);
      buzz(120);
      return R.bombs;
    },
    get bombs() { return R ? R.bombs : 0; },
    result() { return R ? result() : null; },
    quit() { G.state = 'idle'; Sound.intense = false; Sound.stopMusic(); enemies = []; bullets = []; ebullets = []; pickups = []; parts = []; rings = []; texts = []; },
    get revives() { return R ? R.revives : 0; },
  };
})();
