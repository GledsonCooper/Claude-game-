# Feliz aniversário — 10 anos

Vídeo narrado e legendado (1920x1080, 2min21s) feito a partir de `texto.txt`.

- **`feliz-aniversario-10-anos.mp4`** — vídeo final. As legendas estão **queimadas na imagem** (aparecem em qualquer player) e também vão como faixa de legenda opcional em português.
- **`legendas.srt`** — as mesmas legendas em arquivo separado (para YouTube, Instagram etc.).

Tudo foi gerado offline: narração com Kokoro TTS (voz `pm_alex`, pt-BR), paisagens desenhadas por código (numpy/Pillow) e trilha sonora sintetizada, sem direitos autorais de terceiros.

## Como gerar novamente

```bash
pip install kokoro-onnx soundfile numpy pillow
# modelos: kokoro-v1.0.onnx e voices-v1.0.bin (github.com/thewh1teagle/kokoro-onnx, release model-files-v1.0)
python3 narracao.py <pasta_modelos> <build>      # narração + timeline + legendas.srt
python3 musica.py <duração_s> <build>/musica.wav
python3 render.py <build>                        # imagens + legendas -> <build>/video_mudo.mp4
# depois, mixar narração + música e juntar com o vídeo via ffmpeg
```
