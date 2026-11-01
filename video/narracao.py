"""Gera a narração (Kokoro TTS, offline) frase a frase e a linha do tempo das legendas."""
import json, re, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = sys.argv[1]
OUT = sys.argv[2]
VOICE, SPEED, SR = "pm_alex", 0.92, 24000
LEAD, GAP_SENT, GAP_PARA, TAIL = 2.5, 0.45, 1.6, 6.0
MAX_CUE = 92  # caracteres por legenda (2 linhas)

def sentences(par):
    # divide em frases mantendo a pontuação original (inclui "…")
    parts = re.split(r'(?<=[.!?…])\s+', par.strip())
    out = []
    for p in parts:
        if out and not re.search(r'\w', p):  # ex.: o emoji ❤️ fica junto da frase anterior
            out[-1] += " " + p
        elif p:
            out.append(p)
    return out

def split_cue(s):
    """Divide frases longas em legendas de até ~2 linhas, preferindo vírgulas e conjunções."""
    if len(s) <= MAX_CUE:
        return [s]
    best = None
    for m in re.finditer(r'(?<=,) | (?=(e|mas|são|com|que|por) )', s):
        i = m.start()
        left, right = s[:i].strip(), s[i:].strip()
        pen = 0 if s[i - 1] == ',' else 12
        score = max(len(left), len(right)) + pen
        if min(len(left), len(right)) >= 15 and (best is None or score < best[0]):
            best = (score, left, right)
    if best is None:
        return [s]
    return split_cue(best[1]) + split_cue(best[2])

def tts_text(s):
    s = s.replace("❤️", "").replace("❤", "").replace("…", "...")
    return s.strip()

k = Kokoro(f"{MODEL_DIR}/kokoro.onnx", f"{MODEL_DIR}/voices.bin")
paras = [p for p in open("texto.txt", encoding="utf-8").read().split("\n\n") if p.strip()]
audio = [np.zeros(int(LEAD * SR), np.float32)]
t = LEAD
cues, scenes = [], []
for pi, par in enumerate(paras):
    p_start = t
    sents = sentences(par)
    for si, s in enumerate(sents):
        wav, sr = k.create(tts_text(s), voice=VOICE, speed=SPEED, lang="pt-br")
        assert sr == SR
        wav = wav.astype(np.float32)
        # apara silêncio das pontas
        idx = np.where(np.abs(wav) > 0.01)[0]
        wav = wav[max(0, idx[0] - 600): idx[-1] + 2400]
        dur = len(wav) / SR
        chunks = split_cue(s)
        total = sum(len(c) for c in chunks)
        ct = t
        for c in chunks:
            d = dur * len(c) / total
            cues.append({"start": round(ct, 3), "end": round(ct + d, 3), "text": c, "para": pi})
            ct += d
        audio.append(wav); t += dur
        gap = GAP_SENT if si < len(sents) - 1 else (GAP_PARA if pi < len(paras) - 1 else TAIL)
        audio.append(np.zeros(int(gap * SR), np.float32)); t += gap
        print(f"{t:7.2f}s  {s[:70]}", flush=True)
    scenes.append({"start": p_start, "end": t})

full = np.concatenate(audio)
# tempo de exibição: mantém a legenda até a próxima (se a pausa for curta) para facilitar a leitura
for i, c in enumerate(cues):
    nxt = cues[i + 1]["start"] if i + 1 < len(cues) else len(full) / SR - 1.0
    c["show_end"] = round(nxt - 0.05 if nxt - c["end"] < 0.7 or i + 1 == len(cues) else c["end"] + 0.5, 3)
full = full / np.max(np.abs(full)) * 0.89
sf.write(f"{OUT}/narracao.wav", full, SR)
json.dump({"duration": len(full) / SR, "cues": cues, "scenes": scenes},
          open(f"{OUT}/timeline.json", "w"), ensure_ascii=False, indent=1)

def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int(round((s % 1) * 1000)):03}"
with open(f"{OUT}/legendas.srt", "w", encoding="utf-8") as f:
    for i, c in enumerate(cues, 1):
        f.write(f"{i}\n{ts(c['start'])} --> {ts(c['show_end'])}\n{c['text']}\n\n")
print("duração total", len(full) / SR)
