"""Trilha suave sintetizada (piano + pad), sem direitos autorais. Uso: musica.py <duração_s> <saida.wav>"""
import sys, numpy as np, soundfile as sf
SR = 48000
dur = float(sys.argv[1]); out = sys.argv[2]
N = int(dur * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)

def hz(m): return 440 * 2 ** ((m - 69) / 12)
# Ré maior: D  A  Bm  G  (I V vi IV), 4 tempos de 1 s cada (60 bpm)
chords = [[50, 62, 66, 69], [45, 61, 64, 69], [47, 62, 66, 71], [43, 62, 67, 71]]
CH = 4.0
pad = np.zeros(N); piano = np.zeros(N)

def env_pad(n, a=1.6, r=1.6):
    e = np.ones(n); ai = int(a * SR); ri = int(r * SR)
    e[:ai] = np.linspace(0, 1, ai) ** 2; e[-ri:] *= np.linspace(1, 0, ri) ** 2
    return e

k = 0; start = 0.0
while start < dur:
    ch = chords[k % 4]
    s0 = int(start * SR); n = min(int((CH + 1.6) * SR), N - s0)
    tt = np.arange(n) / SR
    e = env_pad(n) if n > 4 * SR else np.ones(n)
    for m in ch:
        f = hz(m)
        v = sum(np.sin(2 * np.pi * f * d * tt + rng.random() * 6) for d in (0.997, 1.0, 1.003)) / 3
        v += 0.25 * np.sin(2 * np.pi * 2 * f * tt)
        pad[s0:s0 + n] += v * e * (0.5 if m < 55 else 0.22)
    # arpejo de piano: colcheias
    tones = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[3]]
    for i, m in enumerate(tones):
        if (k * 8 + i) % 16 in (14, 15):  # respiro
            continue
        ts = start + i * CH / 8 + rng.normal(0, 0.008)
        s1 = int(ts * SR)
        if s1 >= N: break
        nn = min(int(3.0 * SR), N - s1)
        tt = np.arange(nn) / SR
        f = hz(m)
        vel = 0.55 + 0.25 * (i == 0) + rng.normal(0, 0.05)
        tone = sum(a * np.sin(2 * np.pi * f * h * np.sqrt(1 + 0.0004 * h * h) * tt) * np.exp(-tt * (1.6 + h * 0.9))
                   for h, a in ((1, 1.0), (2, 0.45), (3, 0.2), (4, 0.1), (5, 0.05)))
        tone *= np.minimum(1, tt / 0.004)
        piano[s1:s1 + nn] += tone * vel
    start += CH; k += 1

mix = pad / np.max(np.abs(pad)) * 0.45 + piano / np.max(np.abs(piano)) * 0.6
# reverb por convolução com ruído de decaimento exponencial
L = int(2.8 * SR)
ir = rng.normal(0, 1, L) * np.exp(-np.arange(L) / SR * 2.4)
ir /= np.sqrt(np.sum(ir ** 2))
nfft = 1 << int(np.ceil(np.log2(N + L)))
wet = np.fft.irfft(np.fft.rfft(mix, nfft) * np.fft.rfft(ir, nfft), nfft)[:N]
y = 0.65 * mix + 0.5 * wet / np.max(np.abs(wet)) * np.max(np.abs(mix))
fi, fo = int(3 * SR), int(5 * SR)
y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo) ** 1.5
y = y / np.max(np.abs(y)) * 0.9
sf.write(out, np.stack([y, np.roll(y, 480)], 1).astype(np.float32), SR)
