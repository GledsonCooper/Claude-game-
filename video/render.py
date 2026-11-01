"""Renderiza o vídeo: paisagens animadas + legendas abertas (queimadas) + narração + trilha.

Uso: python3 render.py <pasta_build>
Requer em <pasta_build>: timeline.json, narracao.wav, musica.wav, legendas.srt
"""
import json, math, os, subprocess, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paisagens as P

W, H, FPS = P.W, P.H, 30
BUILD = sys.argv[1]
TL = json.load(open(f"{BUILD}/timeline.json", encoding="utf-8"))
DUR = TL["duration"]
NFRAMES = int(math.ceil(DUR * FPS))
XFADE = 1.6
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
HEART_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# limites das cenas: ponto médio da pausa entre parágrafos
sc = TL["scenes"]
BOUNDS = [0.0] + [(sc[i]["end"] + sc[i + 1]["start"]) / 2 - 0.4 for i in range(len(sc) - 1)] + [DUR]
# movimento de câmera (zoom inicial, zoom final, deslocamento x, deslocamento y)
CAM = [(1.0, 1.12, 0.3, -0.2), (1.1, 1.0, -0.3, 0.1), (1.0, 1.1, 0.4, 0.0), (1.08, 1.0, -0.4, 0.2),
       (1.0, 1.12, 0.0, 0.3), (1.1, 1.0, 0.3, -0.1), (1.0, 1.1, -0.3, -0.3), (1.0, 1.13, 0.0, 0.2),
       (1.1, 1.0, 0.0, 0.0)]


def ease(x):
    x = min(max(x, 0), 1)
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- sprites de luz
def glow_sprite(r, sharp=2.0):
    s = int(r * 3)
    y, x = np.mgrid[-s:s + 1, -s:s + 1].astype(np.float32)
    d = np.sqrt(x * x + y * y) / r
    return (np.exp(-d * d * sharp) * 0.8 + np.exp(-d * 1.2) * 0.25).astype(np.float32)


SPR = {r: glow_sprite(r) for r in (2, 3, 4, 5, 6, 8, 10, 14, 18, 24)}


def add_glow(frame, x, y, r, color, inten):
    rr = min(SPR, key=lambda k: abs(k - r))
    sp = SPR[rr]
    s = sp.shape[0] // 2
    x, y = int(x), int(y)
    x0, y0, x1, y1 = x - s, y - s, x + s + 1, y + s + 1
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        return
    sx0, sy0 = max(0, -x0), max(0, -y0)
    sx1, sy1 = sp.shape[1] - max(0, x1 - W), sp.shape[0] - max(0, y1 - H)
    patch = sp[sy0:sy1, sx0:sx1, None] * (np.array(color, np.float32) * inten)
    frame[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] += patch


# ---------------------------------------------------------------- partículas (função pura do tempo)
def particles(frame, kind, t, i, to_out, meta):
    r = np.random.default_rng(1000 + i)
    if kind in ("motes", "rays"):
        n = 70
        bx, by = r.uniform(0, W, n), r.uniform(0, H, n)
        sp = r.uniform(4, 14, n); ph = r.uniform(0, 6.28, n); sz = r.uniform(2, 6, n)
        for k in range(n):
            x = (bx[k] + t * sp[k] + 30 * math.sin(t * 0.3 + ph[k])) % W
            y = (by[k] - t * sp[k] * 0.6 + 20 * math.sin(t * 0.5 + ph[k])) % H
            a = 0.10 + 0.10 * math.sin(t * 1.3 + ph[k])
            add_glow(frame, x, y, sz[k], (1.0, 0.9, 0.7), max(a, 0))
    elif kind == "fireflies":
        n = 45
        bx, by = r.uniform(0, W, n), r.uniform(H * 0.55, H, n)
        ph = r.uniform(0, 6.28, n); fr = r.uniform(0.15, 0.4, n)
        for k in range(n):
            x = bx[k] + 60 * math.sin(t * fr[k] + ph[k])
            y = by[k] + 30 * math.sin(t * fr[k] * 1.7 + ph[k] * 2)
            a = max(0.0, math.sin(t * 1.1 + ph[k] * 3)) ** 3 * 0.9
            add_glow(frame, x, y, 4, (1.0, 0.95, 0.5), a)
            add_glow(frame, x, y, 14, (1.0, 0.8, 0.3), a * 0.25)
    elif kind == "petals":
        n = 55
        bx, by = r.uniform(-200, W, n), r.uniform(0, H, n)
        sp = r.uniform(20, 55, n); ph = r.uniform(0, 6.28, n); sz = r.uniform(3, 7, n)
        cols = [(1.0, 0.8, 0.9), (1.0, 1.0, 1.0), (1.0, 0.9, 0.6)]
        for k in range(n):
            x = (bx[k] + t * sp[k] + 40 * math.sin(t * 0.8 + ph[k])) % (W + 200) - 100
            y = (by[k] + t * sp[k] * 0.45) % H
            add_glow(frame, x, y, sz[k], cols[k % 3], 0.35)
    elif kind == "glitter":
        hy = meta["water"]
        n = 160
        for k in range(n):
            u = r.random()
            by = hy + 6 + u ** 1.6 * (P.BH - hy)
            bx = meta["sun"][0] + r.normal(0, 40 + (by - hy) * 0.9)
            ph = r.uniform(0, 6.28)
            x, y = to_out(bx, by)
            a = max(0.0, math.sin(t * 3.0 + ph)) ** 6 * 0.9
            add_glow(frame, x, y, 3, (1.0, 0.9, 0.7), a)
    elif kind == "night":
        n = 140
        for k in range(n):
            x, y = r.uniform(0, W), r.uniform(0, H * 0.7)
            ph = r.uniform(0, 6.28); fr = r.uniform(0.6, 2.0)
            a = max(0.0, math.sin(t * fr + ph)) ** 4 * 0.7
            add_glow(frame, x, y, 2, (0.9, 0.9, 1.0), a)
        # estrelas cadentes a cada ~3,5 s
        period = 3.5
        idx = int(t // period)
        rr = np.random.default_rng(5000 + idx)
        lt = (t % period) / 0.9
        if lt < 1:
            x0, y0 = rr.uniform(W * 0.2, W * 0.95), rr.uniform(40, H * 0.35)
            ang = rr.uniform(2.5, 2.9)
            L = rr.uniform(260, 420)
            hx, hy = x0 + math.cos(ang) * L * lt, y0 + math.sin(ang) * L * lt
            fade = math.sin(lt * math.pi)
            for s in range(18):
                f = s / 18
                add_glow(frame, hx - math.cos(ang) * f * 150, hy - math.sin(ang) * f * 150, 2,
                         (1.0, 1.0, 1.0), (1 - f) * 0.9 * fade)
    elif kind == "lanterns":
        n = 46
        bx = r.uniform(0, W, n); st = r.uniform(-40, 30, n)
        sp = r.uniform(14, 34, n); sz = r.uniform(0.7, 1.9, n); ph = r.uniform(0, 6.28, n)
        order = np.argsort(sz)
        for k in order:
            y = H + 60 - ((t - st[k]) * sp[k]) % (H + 160)
            x = bx[k] + 25 * math.sin(t * 0.4 + ph[k])
            fl = 0.85 + 0.15 * math.sin(t * 7 + ph[k] * 5)
            s = sz[k] * (0.7 + 0.8 * y / H)
            add_glow(frame, x, y, 24 * s, (1.0, 0.5, 0.18), 0.3 * fl)
            # corpo da lanterna (retângulo luminoso) + chama
            lw, lh = int(7 * s) + 2, int(10 * s) + 3
            yy0, yy1, xx0, xx1 = int(y - lh), int(y + lh), int(x - lw), int(x + lw)
            if 0 <= yy0 and yy1 < H and 0 <= xx0 and xx1 < W:
                grad = np.linspace(0.75, 1.0, yy1 - yy0)[:, None, None]
                frame[yy0:yy1, xx0:xx1] = frame[yy0:yy1, xx0:xx1] * 0.2 + grad * np.array([1.0, 0.62, 0.28]) * fl
            add_glow(frame, x, y + lh * 0.5, 6 * s, (1.0, 0.95, 0.75), 0.9 * fl)


# ---------------------------------------------------------------- legendas
def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if draw.textlength(cand, font=font) <= maxw or not cur:
            cur = cand
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    if len(lines) == 2:  # equilibra as duas linhas
        best = None
        ws = text.split()
        for k in range(1, len(ws)):
            a, b = " ".join(ws[:k]), " ".join(ws[k:])
            la, lb = draw.textlength(a, font=font), draw.textlength(b, font=font)
            if max(la, lb) <= maxw and (best is None or max(la, lb) < best[0]):
                best = (max(la, lb), [a, b])
        if best:
            lines = best[1]
    return lines


def render_cue(text):
    font = ImageFont.truetype(FONT, 50)
    hfont = ImageFont.truetype(HEART_FONT, 50)
    img = Image.new("RGBA", (W, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    heart = "❤️" in text
    body = text.replace("❤️", "").rstrip()
    lines = wrap(d, body, font, 1560)
    lh = 64
    widths = [d.textlength(l, font=font) for l in lines]
    if heart:
        widths[-1] += 18 + d.textlength("❤", font=hfont)
    bw = max(widths) + 64
    bh = lh * len(lines) + 34
    top = 260 - bh - 10
    d.rounded_rectangle([(W - bw) / 2, top, (W + bw) / 2, top + bh], 18, fill=(0, 0, 0, 150))
    for li, (l, w) in enumerate(zip(lines, widths)):
        x = (W - w) / 2
        y = top + 17 + li * lh
        d.text((x + 2, y + 3), l, font=font, fill=(0, 0, 0, 200))
        d.text((x, y), l, font=font, fill=(255, 255, 255, 255))
        if heart and li == len(lines) - 1:
            hx = x + d.textlength(l, font=font) + 18
            d.text((hx, y + 2), "❤", font=hfont, fill=(235, 50, 80, 255))
    a = np.asarray(img).astype(np.float32) / 255
    return a


CUES = TL["cues"]


def cue_at(t):
    for ci, c in enumerate(CUES):
        if c["start"] - 0.12 <= t < c["show_end"]:
            a = min(1.0, (t - c["start"] + 0.12) / 0.15, (c["show_end"] - t) / 0.15)
            return ci, max(0.0, a)
    return None, 0


# ---------------------------------------------------------------- quadro
_bg_cache, _cue_cache = {}, {}


def scene(i):
    if i not in _bg_cache:
        path = f"{BUILD}/bg/{i}.png"
        meta_path = f"{BUILD}/bg/{i}.json"
        _bg_cache[i] = (Image.open(path).convert("RGB"), json.load(open(meta_path)))
    return _bg_cache[i]


Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = (1 - 0.38 * np.clip(((X - W / 2) / (W * 0.62)) ** 2 + ((Y - H / 2) / (H * 0.7)) ** 2, 0, 1) ** 1.3)[..., None]
SUB_Y = H - 260 - 30


def render_scene(i, t):
    bg, meta = scene(i)
    t0, t1 = BOUNDS[i] - XFADE / 2, BOUNDS[i + 1] + XFADE / 2
    p = ease((t - t0) / (t1 - t0))
    z0, z1, dx, dy = CAM[i]
    z = z0 + (z1 - z0) * p  # zoom relativo ao enquadramento mais aberto
    cw = P.BW / z
    ch = P.BH / z
    mx, my = (P.BW - cw) / 2, (P.BH - ch) / 2
    cx = P.BW / 2 + dx * mx * (2 * p - 1)
    cy = P.BH / 2 + dy * my * (2 * p - 1)
    x0, y0 = cx - cw / 2, cy - ch / 2
    img = bg.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))
    f = np.asarray(img).astype(np.float32) / 255
    sx = W / cw

    def to_out(bx, by):
        return (bx - x0) * sx, (by - y0) * sx

    particles(f, meta["particles"], t, i, to_out, meta)
    return f


def frame_at(n):
    t = n / FPS
    # cena atual e transição
    i = max(k for k in range(len(BOUNDS) - 1) if BOUNDS[k] <= t) if t >= 0 else 0
    i = min(i, len(BOUNDS) - 2)
    f = render_scene(i, t)
    if i + 1 < len(BOUNDS) - 1 and t > BOUNDS[i + 1] - XFADE / 2:
        a = ease((t - (BOUNDS[i + 1] - XFADE / 2)) / XFADE)
        f = f * (1 - a) + render_scene(i + 1, t) * a
    elif i > 0 and t < BOUNDS[i] + XFADE / 2:
        a = ease((t - (BOUNDS[i] - XFADE / 2)) / XFADE)
        f = render_scene(i - 1, t) * (1 - a) + f * a
    f = f * VIG
    f = np.clip(f, 0, 1)
    # entrada/saída em preto
    g = min(1.0, t / 2.0, (DUR - t) / 3.0)
    f = f * max(g, 0)
    ci, a = cue_at(t)
    if ci is not None and a > 0:
        if ci not in _cue_cache:
            _cue_cache[ci] = render_cue(CUES[ci]["text"])
        c = _cue_cache[ci]
        al = c[..., 3:4] * a
        reg = f[SUB_Y:SUB_Y + c.shape[0]]
        f[SUB_Y:SUB_Y + c.shape[0]] = reg * (1 - al) + c[..., :3] * al
    return (f * 255 + 0.5).astype(np.uint8)


def work(args):
    wi, a, b = args
    out = f"{BUILD}/part{wi}.mp4"
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium",
                          "-crf", "19", "-pix_fmt", "yuv420p", "-tune", "film", out], stdin=subprocess.PIPE)
    for n in range(a, b):
        p.stdin.write(frame_at(n).tobytes())
        if (n - a) % 300 == 0:
            print(f"worker {wi}: {n - a}/{b - a}", flush=True)
    p.stdin.close(); p.wait()
    return out


def prepare_backgrounds(i):
    img, meta = P.CENAS[i]()
    img.save(f"{BUILD}/bg/{i}.png")
    meta = {k: (list(v) if isinstance(v, tuple) else v) for k, v in meta.items()}
    json.dump(meta, open(f"{BUILD}/bg/{i}.json", "w"))
    return i


if __name__ == "__main__":
    os.makedirs(f"{BUILD}/bg", exist_ok=True)
    with Pool(4) as pool:
        list(pool.imap_unordered(prepare_backgrounds, range(len(P.CENAS))))
        if os.environ.get("PREVIEW"):
            for s in os.environ["PREVIEW"].split(","):
                Image.fromarray(frame_at(int(float(s) * FPS))).save(f"{BUILD}/prev_{s}.jpg", quality=88)
            sys.exit(0)
        NW = 4
        step = math.ceil(NFRAMES / NW)
        parts = pool.map(work, [(k, k * step, min(NFRAMES, (k + 1) * step)) for k in range(NW)])
    with open(f"{BUILD}/parts.txt", "w") as fh:
        for p in parts:
            fh.write(f"file '{p}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{BUILD}/parts.txt",
                    "-c", "copy", f"{BUILD}/video_mudo.mp4"], check=True)
    print("vídeo mudo pronto")
