/*
 * Gera os ícones do app e as imagens da Play Store a partir do próprio jogo.
 * Uso: node server.js   (em outro terminal)   e depois   node tools/gerar-imagens.js
 * Requer Playwright (npx playwright install chromium).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ROOT = path.join(__dirname, '..');

async function canvasPng(page, w, h, drawFn, out) {
  const data = await page.evaluate(
    ([w, h, src]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      new Function('ctx', 'w', 'h', 'Game', src)(ctx, w, h, window.Game);
      return c.toDataURL('image/png').split(',')[1];
    },
    [w, h, drawFn.toString().replace(/^[^{]*{/, '').replace(/}\s*$/, '')]
  );
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('✓', path.relative(ROOT, out));
}

// fundo de céu + personagem, usado no ícone
function icon(ctx, w, h, Game) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6aa8ff');
  g.addColorStop(1, '#c7e4ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const cl = (x, y, s) => { ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.arc(x + s, y - s * 0.4, s * 0.8, 0, 7); ctx.arc(x + s * 1.9, y, s * 0.9, 0, 7); ctx.fill(); };
  cl(w * 0.08, h * 0.86, w * 0.1);
  cl(w * 0.62, h * 0.9, w * 0.09);
  Game.drawCharacter(ctx, 'classic', w / 2, h * 0.5, w * 0.26, { t: 0.3 });
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(300);

  // Ícones do app (PWA/TWA) e da Play Store
  for (const s of [192, 512]) await canvasPng(page, s, s, icon, path.join(ROOT, `public/icons/icon-${s}.png`));
  // Ícone "maskable": o Android recorta em círculo, então o personagem fica menor
  await canvasPng(page, 512, 512, function (ctx, w, h, Game) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6aa8ff');
    g.addColorStop(1, '#c7e4ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    Game.drawCharacter(ctx, 'classic', w / 2, h * 0.52, w * 0.19, { t: 0.3 });
  }, path.join(ROOT, 'public/icons/maskable-512.png'));
  await canvasPng(page, 512, 512, icon, path.join(ROOT, 'store/icone-play-512.png'));

  // Imagem de destaque da Play Store (1024x500)
  await canvasPng(page, 1024, 500, function (ctx, w, h, Game) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#5b8cff');
    g.addColorStop(1, '#b9dcff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const cl = (x, y, s) => { ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.arc(x + s, y - s * 0.4, s * 0.8, 0, 7); ctx.arc(x + s * 1.9, y, s * 0.9, 0, 7); ctx.fill(); };
    cl(60, 460, 50); cl(520, 120, 30); cl(820, 470, 45);
    const plat = (x, y, pw) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, pw, 22, 11); ctx.fill(); ctx.beginPath(); ctx.arc(x + pw * 0.3, y + 3, 13, 0, 7); ctx.arc(x + pw * 0.62, y + 2, 16, 0, 7); ctx.fill(); };
    plat(640, 400, 150); plat(840, 280, 120); plat(700, 160, 110);
    Game.drawCharacter(ctx, 'dragon', 900, 215, 42, { t: 0.2 });
    Game.drawCharacter(ctx, 'unicorn', 760, 110, 32, { t: 0.4 });
    Game.drawCharacter(ctx, 'classic', 712, 330, 52, { t: 0.3, squash: -0.1 });
    ctx.fillStyle = '#fff';
    ctx.font = '900 120px Trebuchet MS, sans-serif';
    ctx.shadowColor = '#3b5bdb';
    ctx.shadowOffsetY = 8;
    ctx.fillText('Pulim', 60, 230);
    ctx.shadowOffsetY = 3;
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.font = 'bold 40px Trebuchet MS, sans-serif';
    ctx.fillText('Rumo às Nuvens', 66, 295);
    ctx.font = 'bold 28px Trebuchet MS, sans-serif';
    ctx.fillText('Pule, colecione e bata seu recorde!', 66, 350);
  }, path.join(ROOT, 'store/destaque-1024x500.png'));
  await page.close();

  // Capturas de tela 1080x1920
  const ctxB = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  const p = await ctxB.newPage();
  await p.goto(BASE);
  await p.evaluate(() => localStorage.setItem('pulim_save_v1', JSON.stringify({
    coins: 3480, gems: 120, best: 1874, skins: ['classic', 'pink', 'frog', 'unicorn', 'dragon'], skin: 'unicorn',
    items: { jetpack: 2, shield: 1, magnet: 0 }, daily: { last: '', streak: 3 },
  })));
  await p.reload();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(ROOT, 'store/screenshots/1-menu.png') });
  await p.click('#btnPlay');
  for (let i = 0; i < 28; i++) {
    await p.evaluate(() => { const g = window.Game; if (g.state !== 'play') return; });
    await p.waitForTimeout(100);
  }
  await p.screenshot({ path: path.join(ROOT, 'store/screenshots/2-jogando.png') });
  await p.evaluate(() => window.Game.pause());
  await p.evaluate(() => window.Game.toIdle());
  await p.reload();
  await p.waitForTimeout(400);
  await p.click('#btnSkins');
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ROOT, 'store/screenshots/3-personagens.png') });
  await p.click('#skins [data-close]');
  await p.click('#btnShop');
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ROOT, 'store/screenshots/4-loja.png') });
  await p.click('#shop [data-close]');
  await p.click('#btnDaily');
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ROOT, 'store/screenshots/5-premio-diario.png') });
  console.log('✓ store/screenshots/*.png');
  await b.close();
})();
