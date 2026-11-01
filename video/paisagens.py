"""Paisagens geradas proceduralmente (numpy + Pillow), uma para cada parágrafo do texto.

Cada cena devolve um fundo estático em alta resolução (BW x BH) e um tipo de animação
(partículas, estrelas cadentes, lanternas, brilho na água...) aplicado quadro a quadro.
"""
import numpy as np
from PIL import Image, ImageFilter

W, H = 1920, 1080
BW, BH = 2208, 1242  # 15% maior para permitir zoom/pan lento (efeito Ken Burns)


def rng(seed):
    return np.random.default_rng(seed)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def vgrad(stops, h=BH, w=BW):
    ys = np.linspace(0, 1, h)
    pos = [s[0] for s in stops]
    cols = np.array([s[1] for s in stops], float) / 255
    col = np.stack([np.interp(ys, pos, cols[:, c]) for c in range(3)], -1)
    return np.repeat(col[:, None, :], w, 1).astype(np.float32)


def noise2d(w, h, base, octaves, seed, persist=0.5, sx=1.0):
    r = rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        cw = max(2, int(w / base * 2 ** o / sx))
        ch = max(2, int(h / base * 2 ** o))
        a = r.random((ch, cw)).astype(np.float32)
        out += np.asarray(Image.fromarray(a, "F").resize((w, h), Image.BICUBIC)) * amp
        tot += amp
        amp *= persist
    return out / tot


def noise1d(w, base, octaves, seed, persist=0.5):
    return noise2d(w, 2, base, octaves, seed, persist)[0]


def ridge(seed, base_y, amp, base=700, octaves=7, sharp=True, persist=0.5):
    n = noise1d(BW, base, octaves, seed, persist)
    if sharp:
        n2 = noise1d(BW, base / 2.5, 5, seed + 99)
        n = 0.65 * n + 0.35 * (1 - np.abs(2 * n2 - 1))
    n = (n - n.min()) / (n.max() - n.min() + 1e-6)
    return base_y - amp * n


def layer(img, ridge_y, top, bottom, haze=None, haze_amt=0.0, tex_seed=0, tex=0.06, depth=250):
    """Pinta uma camada de montanha/colina abaixo da linha `ridge_y`."""
    Y = np.arange(BH, dtype=np.float32)[:, None]
    a = np.clip(Y - ridge_y[None, :] + 0.5, 0, 1)
    t = np.clip((Y - ridge_y[None, :]) / depth, 0, 1)[..., None]
    col = np.array(top, np.float32) / 255 * (1 - t) + np.array(bottom, np.float32) / 255 * t
    if tex:
        n = noise2d(BW, BH, 90, 5, tex_seed)[..., None]
        col = col * (1 - tex + 2 * tex * n)
    if haze is not None:
        col = col * (1 - haze_amt) + np.array(haze, np.float32) / 255 * haze_amt
    a = a[..., None]
    return img * (1 - a) + col * a


def sun_glow(img, cx, cy, color, r_core, strength=1.0, r_glow=None, disk=True):
    Y, X = np.mgrid[0:BH, 0:BW].astype(np.float32)
    d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2)
    r_glow = r_glow or r_core * 8
    c = np.array(color, np.float32) / 255
    glow = (np.exp(-d / r_glow) * 0.55 + np.exp(-d / (r_core * 2.2)) * 0.5) * strength
    img = img + glow[..., None] * c
    if disk:
        dk = smooth(r_core + 2, r_core - 2, d)[..., None]
        img = img * (1 - dk) + np.array([1.0, 0.97, 0.88], np.float32) * dk
    return img


def clouds(img, seed, y0, y1, lit, shade, cover=0.5, sun=None, sx=3.5, alpha=0.9, base=420):
    h = BH
    n = noise2d(BW, h, base, 6, seed, 0.55, sx=sx)
    Y = np.arange(h, dtype=np.float32)[:, None]
    band = smooth(y0, y0 + (y1 - y0) * 0.3, Y) * smooth(y1, y1 - (y1 - y0) * 0.3, Y)
    dens = smooth(1 - cover, 1 - cover + 0.18, n) * band
    light = smooth(0.4, 0.8, n)
    if sun is not None:
        X = np.arange(BW, dtype=np.float32)[None, :]
        d = np.sqrt((X - sun[0]) ** 2 + (Y - sun[1]) ** 2)
        light = np.clip(light * 0.5 + np.exp(-d / 700) * 0.9, 0, 1)
    col = np.array(shade, np.float32) / 255 * (1 - light[..., None]) + np.array(lit, np.float32) / 255 * light[..., None]
    a = (dens * alpha)[..., None]
    return img * (1 - a) + col * a


def god_rays(img, cx, cy, color, seed, strength=0.35, reach=1100):
    Y, X = np.mgrid[0:BH, 0:BW].astype(np.float32)
    ang = np.arctan2(Y - cy, X - cx)
    d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2)
    r = noise1d(2048, 90, 3, seed)
    idx = ((ang + np.pi) / (2 * np.pi) * 2047).astype(int)
    rays = smooth(0.52, 0.85, r[idx])
    inten = rays * np.exp(-d / reach) * strength
    return img + inten[..., None] * (np.array(color, np.float32) / 255)


def water(img, hy, tint, seed, tint_amt=0.3, ripple=6):
    out = img.copy()
    r = rng(seed)
    ys = np.arange(hy, BH)
    depth = (ys - hy) / (BH - hy)
    phase = r.random() * 6
    for y, dp in zip(ys, depth):
        src = int(2 * hy - y)
        src = max(0, src)
        off = int(np.sin(y * 0.35 + phase) * ripple * (0.3 + dp) + np.sin(y * 0.11) * ripple * dp)
        row = np.roll(img[src], off, axis=0)
        out[y] = row * (0.82 - 0.25 * dp)
    streak = noise2d(BW, BH - hy, 60, 4, seed + 1, sx=12)[..., None]
    t = np.array(tint, np.float32) / 255
    out[hy:] = out[hy:] * (1 - tint_amt) + t * tint_amt
    out[hy:] *= 0.88 + 0.24 * streak
    return out


def stars(img, seed, n, y_max, bright=1.0):
    r = rng(seed)
    xs = r.integers(0, BW, n)
    ys = (r.random(n) ** 1.3 * y_max).astype(int)
    b = r.random(n) ** 3 * bright
    for x, y, v in zip(xs, ys, b):
        img[y, x] += v
        if v > 0.5:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < BH and 0 <= xx < BW:
                    img[yy, xx] += v * 0.35
    return img


def milky_way(img, seed):
    Y, X = np.mgrid[0:BH, 0:BW].astype(np.float32)
    # faixa diagonal
    d = np.abs(Y - (1.0 * BH - 0.55 * X)) / 300
    band = np.exp(-d ** 2)
    core = np.exp(-(d * 2.2) ** 2)
    n = noise2d(BW, BH, 160, 6, seed, 0.6)
    dust = noise2d(BW, BH, 50, 5, seed + 3, 0.6)
    glow = band * (0.25 + smooth(0.3, 0.75, n)) * 0.45
    dark = core * smooth(0.5, 0.7, dust) * 0.6
    col = np.array([0.72, 0.74, 1.0], np.float32)
    img = img + glow[..., None] * col + (core * smooth(0.4, 0.8, n) * 0.25)[..., None] * np.array([1.0, 0.8, 0.6], np.float32)
    img = stars(img, seed + 9, 9000, BH, 0.5) if False else img
    # muitas estrelas pequenas concentradas na faixa
    r = rng(seed + 9)
    xs = r.integers(0, BW, 40000); ys = r.integers(0, BH, 40000)
    keep = r.random(40000) < band[ys, xs]
    img[ys[keep], xs[keep]] += (r.random(keep.sum()) ** 2 * 0.7)[:, None]
    img = img * (1 - dark[..., None])
    return img


def flowers(img, seed, ridge_y, colors, count, size=(2, 9)):
    """Espalha flores sobre uma colina (menores ao longe, maiores perto)."""
    r = rng(seed)
    pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(pil)
    pts = []
    for _ in range(count):
        x = r.integers(0, BW)
        y = r.uniform(ridge_y[x] + 4, BH)
        pts.append((y, x))
    pts.sort()
    for y, x in pts:
        t = (y - ridge_y[x]) / (BH - ridge_y[x] + 1)
        s = size[0] + (size[1] - size[0]) * t ** 1.5
        c = colors[r.integers(0, len(colors))]
        dr.ellipse([x - s, y - s * 0.7, x + s, y + s * 0.7], fill=c)
        if s > 5:
            dr.ellipse([x - s * 0.3, y - s * 0.25, x + s * 0.3, y + s * 0.25], fill=(255, 236, 160))
    return np.asarray(pil).astype(np.float32) / 255


def lavender_rows(img, hy, seed):
    """Fileiras de lavanda convergindo para o horizonte."""
    Y, X = np.mgrid[0:BH, 0:BW].astype(np.float32)
    vx = BW * 0.5
    t = np.clip((Y - hy) / (BH - hy), 0, 1)
    persp = np.where(t > 0, (X - vx) / (t * BW * 0.9 + 1e-3), 0)
    rows = 0.5 + 0.5 * np.cos(persp * 26)
    n = noise2d(BW, BH, 30, 4, seed)
    purple = np.array([0.42, 0.26, 0.62], np.float32)
    deep = np.array([0.16, 0.10, 0.22], np.float32)
    green = np.array([0.18, 0.24, 0.12], np.float32)
    fine = noise2d(BW, BH, 6, 2, seed + 1)
    flower = smooth(0.25, 0.6, rows) * (0.65 + 0.7 * n * fine)
    col = green * (1 - flower[..., None]) + purple * flower[..., None]
    col = col * (0.55 + 0.6 * t[..., None]) + deep * (1 - t[..., None]) * 0.2
    # luz quente rasante
    col += np.array([0.35, 0.18, 0.05], np.float32) * (1 - t[..., None]) * 0.35
    hz = np.exp(-t * 9)[..., None] * 0.55
    col = col * (1 - hz) + np.array([0.9, 0.7, 0.62], np.float32) * hz
    mask = (Y >= hy)[..., None].astype(np.float32)
    return img * (1 - mask) + col * mask


def road(img, hy, seed):
    Y, X = np.mgrid[0:BH, 0:BW].astype(np.float32)
    t = np.clip((Y - hy) / (BH - hy), 0, 1)
    cx = BW * 0.5 + np.sin(t * 2.2 + 0.5) * 120 * t
    half = 6 + t * 520
    inside = smooth(half + 3, half - 3, np.abs(X - cx)) * (Y > hy)
    col = np.array([0.22, 0.18, 0.2], np.float32) * (0.5 + 0.7 * t[..., None])
    # brilho do sol no asfalto
    col += np.array([0.5, 0.32, 0.18], np.float32) * (1 - t[..., None]) ** 2 * 0.6
    line = smooth(4 + t * 6, 1 + t * 3, np.abs(X - cx)) * ((np.sin(np.log(t + 0.02) * 22) > 0.1)) * (Y > hy)
    col = col * (1 - line[..., None]) + np.array([0.95, 0.85, 0.6], np.float32) * line[..., None]
    a = inside[..., None]
    return img * (1 - a) + col * a


def finish(img, warm=None, blur=0):
    img = np.clip(img, 0, 1)
    if warm is not None:
        img = img * np.array(warm, np.float32)
    pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    if blur:
        pil = pil.filter(ImageFilter.GaussianBlur(blur))
    # leve "bloom" para dar aparência cinematográfica
    big = pil.filter(ImageFilter.GaussianBlur(18))
    a = np.asarray(pil).astype(np.float32) / 255
    b = np.asarray(big).astype(np.float32) / 255
    out = 1 - (1 - a) * (1 - np.clip(b - 0.55, 0, 1) * 0.9)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


# ---------------------------------------------------------------- cenas
def cena_amanhecer():
    """Hoje é o seu dia: nascer do sol dourado sobre montanhas em camadas."""
    img = vgrad([(0, (28, 40, 92)), (0.32, (120, 82, 140)), (0.5, (236, 128, 110)),
                 (0.6, (255, 186, 110)), (0.68, (255, 222, 150)), (1, (255, 222, 150))])
    sun = (BW * 0.62, BH * 0.63)
    img = sun_glow(img, *sun, (255, 190, 120), 46, 1.0, r_glow=420)
    img = clouds(img, 11, 80, 560, (255, 196, 170), (120, 70, 110), 0.42, sun, alpha=0.85)
    haze = (255, 196, 150)
    img = layer(img, ridge(1, BH * 0.66, 170), (150, 110, 150), (120, 90, 130), haze, 0.55, 1)
    img = layer(img, ridge(2, BH * 0.74, 200), (110, 72, 112), (80, 52, 90), haze, 0.38, 2)
    img = layer(img, ridge(3, BH * 0.84, 210), (70, 42, 74), (50, 30, 56), haze, 0.22, 3)
    # névoa no vale
    Y = np.arange(BH, dtype=np.float32)[:, None, None]
    mist = np.exp(-((Y - BH * 0.82) / 50) ** 2) * noise2d(BW, BH, 300, 4, 5, sx=4)[..., None] * 0.55
    img = img + mist * np.array([1, 0.8, 0.7], np.float32)
    img = layer(img, ridge(4, BH * 0.96, 170, sharp=False), (32, 18, 36), (18, 10, 22), None, 0, 4)
    return finish(img), {"particles": "motes", "sun": (sun[0], sun[1])}


def cena_luz_entre_nuvens():
    """Momentos difíceis, coragem e conquistas: céu dramático com a luz rompendo as nuvens."""
    img = vgrad([(0, (30, 36, 52)), (0.45, (92, 96, 112)), (0.62, (196, 170, 140)), (1, (200, 170, 140))])
    sun = (BW * 0.42, BH * 0.36)
    img = sun_glow(img, *sun, (255, 230, 180), 30, 0.9, r_glow=380, disk=False)
    img = clouds(img, 21, 0, 760, (250, 214, 170), (34, 36, 50), 0.66, sun, sx=2.2, alpha=0.96, base=380)
    img = god_rays(img, *sun, (255, 214, 150), 22, 0.32, 900)
    haze = (176, 150, 130)
    img = layer(img, ridge(31, BH * 0.72, 200, base=800, persist=0.42), (96, 88, 96), (74, 68, 78), haze, 0.42, 31)
    img = layer(img, ridge(32, BH * 0.82, 190, base=900, persist=0.42), (52, 48, 58), (38, 34, 44), haze, 0.22, 32)
    img = layer(img, ridge(33, BH * 0.93, 160, base=1000, persist=0.42), (24, 22, 30), (12, 12, 18), None, 0, 33)
    # o feixe de luz toca o vale
    img = god_rays(img, *sun, (255, 210, 150), 24, 0.1, 1400)
    return finish(img), {"particles": "rays", "sun": sun}


def cena_lago():
    """Nós nos encontramos: lago espelhado ao entardecer dourado."""
    img = vgrad([(0, (46, 62, 118)), (0.3, (150, 120, 160)), (0.48, (250, 170, 120)), (0.56, (255, 210, 150)), (1, (255, 210, 150))])
    sun = (BW * 0.35, BH * 0.5)
    img = sun_glow(img, *sun, (255, 180, 110), 38, 1.0, r_glow=380)
    img = clouds(img, 41, 60, 420, (255, 200, 170), (110, 80, 120), 0.45, sun, alpha=0.8)
    hy = int(BH * 0.6)
    haze = (240, 180, 140)
    img = layer(img, ridge(42, hy - 20, 330, base=600), (110, 90, 130), (90, 70, 110), haze, 0.45, 42)
    img = layer(img, ridge(43, hy + 2, 170, base=500), (56, 46, 74), (40, 32, 56), haze, 0.2, 43)
    img[hy:] = img[hy - 1]
    img = water(img, hy, (60, 50, 90), 44, 0.18, ripple=5)
    # margem com pinheiros em silhueta
    r = rng(45)
    pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(pil)
    for side in (0, 1):
        for i in range(26):
            x = r.uniform(0, 520) if side == 0 else r.uniform(BW - 600, BW)
            base = hy + 6 + r.uniform(0, 12)
            hgt = r.uniform(70, 230) * (1.3 if (x < 200 or x > BW - 200) else 1)
            wdt = hgt * 0.28
            for k in range(6):
                yy = base - hgt * k / 6
                ww = wdt * (1 - k / 6)
                dr.polygon([(x - ww, yy), (x + ww, yy), (x, yy - hgt / 4.5)], fill=(22, 16, 30))
    img = np.asarray(pil).astype(np.float32) / 255
    img[hy + 12:] = img[hy + 12:]  # mantém
    return finish(img), {"particles": "fireflies", "water": hy, "sun": sun}


def cena_colinas_floridas():
    """O nosso bebê: manhã suave, colinas verdes e floridas."""
    img = vgrad([(0, (110, 168, 222)), (0.45, (180, 214, 236)), (0.62, (246, 226, 212)), (1, (246, 226, 212))])
    sun = (BW * 0.78, BH * 0.22)
    img = sun_glow(img, *sun, (255, 240, 200), 40, 0.8, r_glow=500)
    img = clouds(img, 51, 40, 520, (255, 255, 255), (196, 206, 226), 0.42, sun, sx=2.0, alpha=0.9, base=300)
    haze = (210, 226, 236)
    img = layer(img, ridge(52, BH * 0.62, 90, base=900, sharp=False), (130, 170, 160), (120, 160, 140), haze, 0.5, 52)
    r3 = ridge(53, BH * 0.74, 120, base=1100, sharp=False)
    img = layer(img, r3, (130, 180, 90), (100, 150, 70), haze, 0.18, 53)
    img = flowers(img, 54, r3, [(250, 230, 120), (255, 255, 255), (246, 170, 200)], 3000, (1, 5))
    r4 = ridge(55, BH * 0.84, 170, base=1300, sharp=False)
    img = layer(img, r4, (96, 160, 60), (60, 120, 40), None, 0, 55, tex=0.1)
    img = flowers(img, 56, r4, [(255, 214, 90), (255, 255, 255), (246, 150, 190), (200, 160, 240), (255, 140, 120)], 6000, (2, 12))
    return finish(img), {"particles": "petals", "sun": sun}


def cena_por_do_sol_mar():
    """Celebrar a mulher que você é: pôr do sol rosado sobre o mar."""
    img = vgrad([(0, (60, 40, 110)), (0.25, (170, 70, 130)), (0.45, (250, 120, 110)), (0.56, (255, 190, 130)), (1, (255, 190, 130))])
    hy = int(BH * 0.6)
    sun = (BW * 0.5, hy - 50)
    img = sun_glow(img, *sun, (255, 160, 100), 74, 1.1, r_glow=520)
    img = clouds(img, 61, 30, 520, (255, 190, 200), (120, 50, 110), 0.38, sun, sx=4, alpha=0.85)
    img[hy:] = img[hy - 1]
    img = water(img, hy, (70, 30, 80), 62, 0.35, ripple=14)
    # trilha de luz do sol na água
    Y, X = np.mgrid[0:BH, 0:BW].astype(np.float32)
    t = np.clip((Y - hy) / (BH - hy), 0, 1)
    path = np.exp(-((X - sun[0]) / (60 + t * 360)) ** 2) * (Y > hy)
    sp = noise2d(BW, BH, 10, 3, 63, sx=8)
    glit = path * smooth(0.55, 0.75, sp) * 1.2
    img = img + glit[..., None] * np.array([1, 0.8, 0.55], np.float32)
    # rochas em silhueta na margem
    img = layer(img, ridge(64, BH * 1.02, 240, base=500), (30, 14, 34), (20, 10, 24), None, 0, 64, tex=0.03)
    return finish(img), {"particles": "glitter", "water": hy, "sun": sun}


def cena_lavanda():
    """Desejos para o novo ano: campo de lavanda banhado de sol."""
    img = vgrad([(0, (90, 120, 190)), (0.3, (200, 170, 200)), (0.46, (255, 206, 160)), (1, (255, 206, 160))])
    hy = int(BH * 0.5)
    sun = (BW * 0.5, hy - 30)
    img = sun_glow(img, *sun, (255, 200, 140), 44, 1.1, r_glow=480)
    img = clouds(img, 71, 40, 420, (255, 220, 200), (150, 120, 170), 0.35, sun, sx=4, alpha=0.75)
    img = god_rays(img, *sun, (255, 220, 170), 72, 0.25, 900)
    img = layer(img, ridge(73, hy + 4, 50, base=900, sharp=False), (150, 120, 150), (140, 110, 140), (255, 200, 170), 0.5, 73)
    img = lavender_rows(img, hy + 2, 74)
    # árvore solitária
    from PIL import ImageDraw
    pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    dr = ImageDraw.Draw(pil)
    tx, ty = BW * 0.78, hy + 8
    dr.polygon([(tx - 5, ty), (tx + 5, ty), (tx + 3, ty - 70), (tx - 3, ty - 70)], fill=(40, 26, 40))
    r = rng(75)
    for _ in range(60):
        a = r.uniform(0, 2 * np.pi)
        rr = r.uniform(0, 70)
        cx, cy = tx + np.cos(a) * rr * 1.3, ty - 110 + np.sin(a) * rr * 0.7
        s = r.uniform(14, 30)
        dr.ellipse([cx - s, cy - s, cx + s, cy + s], fill=(48, 34, 50))
    img = np.asarray(pil).astype(np.float32) / 255
    return finish(img), {"particles": "motes", "sun": sun}


def cena_noite_estrelada():
    """Obrigado por esses dez anos: noite estrelada com a Via Láctea."""
    img = vgrad([(0, (6, 8, 24)), (0.5, (16, 22, 56)), (0.72, (44, 50, 96)), (0.8, (90, 70, 110)), (1, (90, 70, 110))])
    img = milky_way(img, 81)
    img = stars(img, 82, 5200, BH * 0.85, 1.1)
    haze = (60, 56, 100)
    img = layer(img, ridge(83, BH * 0.8, 200, base=600), (30, 30, 56), (24, 24, 44), haze, 0.3, 83, tex=0.04)
    img = layer(img, ridge(84, BH * 0.92, 230, base=700), (12, 12, 24), (8, 8, 16), None, 0, 84, tex=0.03)
    return finish(img), {"particles": "night"}


def cena_estrada():
    """O futuro juntos: uma estrada rumo ao horizonte ao nascer do sol."""
    img = vgrad([(0, (60, 90, 150)), (0.3, (170, 150, 180)), (0.5, (255, 190, 140)), (0.56, (255, 220, 170)), (1, (255, 220, 170))])
    hy = int(BH * 0.56)
    sun = (BW * 0.5 + 40, hy - 26)
    img = sun_glow(img, *sun, (255, 200, 130), 50, 1.1, r_glow=520)
    img = clouds(img, 91, 40, 480, (255, 214, 190), (130, 110, 150), 0.4, sun, sx=4, alpha=0.8)
    img = god_rays(img, *sun, (255, 220, 170), 92, 0.2, 1000)
    haze = (255, 200, 160)
    img = layer(img, ridge(93, hy + 2, 140, base=600), (140, 110, 140), (130, 100, 130), haze, 0.55, 93)
    rl = ridge(94, hy + 30, 50, base=900, sharp=False)
    img = layer(img, rl, (150, 130, 80), (40, 60, 26), haze, 0.2, 94, depth=500, tex=0.18)
    grass = noise2d(BW, BH, 8, 3, 96, sx=0.3)[..., None]
    Yg = np.arange(BH)[:, None, None]
    img = np.where(Yg > rl[None, :, None] + 2, img * (0.8 + 0.4 * grass), img)
    img = road(img, hy + 18, 95)
    return finish(img), {"particles": "motes", "sun": sun}


def cena_lanternas():
    """Feliz aniversário: crepúsculo com lanternas subindo sobre o lago."""
    img = vgrad([(0, (20, 18, 52)), (0.35, (70, 40, 90)), (0.52, (190, 90, 100)), (0.6, (240, 150, 110)), (1, (240, 150, 110))])
    img = stars(img, 101, 1200, BH * 0.45, 0.8)
    hy = int(BH * 0.64)
    sun = (BW * 0.5, hy + 10)
    img = sun_glow(img, *sun, (255, 150, 90), 60, 0.9, r_glow=500, disk=False)
    img = clouds(img, 102, 200, 640, (255, 170, 150), (80, 40, 90), 0.3, sun, sx=5, alpha=0.6)
    haze = (200, 120, 120)
    img = layer(img, ridge(103, hy - 10, 200, base=600), (80, 50, 90), (70, 44, 80), haze, 0.4, 103)
    img = layer(img, ridge(104, hy + 2, 90, base=500), (40, 26, 52), (30, 20, 40), haze, 0.15, 104)
    img[hy:] = img[hy - 1]
    img = water(img, hy, (40, 20, 60), 105, 0.25, ripple=6)
    return finish(img), {"particles": "lanterns", "water": hy}


CENAS = [cena_amanhecer, cena_luz_entre_nuvens, cena_lago, cena_colinas_floridas,
         cena_por_do_sol_mar, cena_lavanda, cena_noite_estrelada, cena_estrada, cena_lanternas]
