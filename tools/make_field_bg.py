"""Turn a Mistral field draft into the playfield background: portrait crop, quieter colours.

usage: make_field_bg.py <draft.png> <out.jpg> [--cold x0,y0,x1,y1 ...]
The road goes from yellow sand to grey-beige stone (yellow belongs to lightning), violet
decorations turn to pale stone (violet belongs to arcane), and the whole picture loses some
saturation and contrast so heroes, enemies and effects sit on top of it. The sand step fades in
over a small band of saturation and value, so near-grey paving does not break into speckles.
--cold puts out the fires and glowing embers inside those boxes (output pixels; bright saturated
orange and yellow turn to dark iron): orange flames belong to the fire potion. Grass gets the same
soft fade by saturation.
"""
import sys
import numpy as np
from PIL import Image

W, H = 1080, 1456

src = Image.open(sys.argv[1]).convert('RGB')
cw = round(src.height * W / H)
x = (src.width - cw) // 2
im = src.crop((x, 0, x + cw, src.height)).resize((W, H), Image.LANCZOS)

hsv = np.asarray(im.convert('HSV')).astype(np.float32)
h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255

sand = ((h > 18) & (h < 55)) * np.clip((s - 0.1) / 0.1, 0, 1) * np.clip((v - 0.45) / 0.1, 0, 1)
if '--cold' in sys.argv:
    box = np.zeros(h.shape, bool)
    for b in sys.argv[sys.argv.index('--cold') + 1:]:
        x0, y0, x1, y1 = map(int, b.split(','))
        box[y0:y1, x0:x1] = True
    ember = box & (h > 8) & (h < 70) & (s > 0.2) & (v > 0.6)
    s = np.where(ember, 0.08, s)
    v = np.where(ember, 0.3, v)
grass = ((h >= 55) & (h < 140)) * np.clip((s - 0.08) / 0.1, 0, 1)
violet = (h > 250) & (h < 320) & (s > 0.2)

s = s + (np.minimum(s * 0.35, 0.13) - s) * sand
h = h + (35 - h) * sand
v = v + (0.55 + (v - 0.55) * 0.7 - v) * sand
s = np.where(violet, s * 0.12, s)
v = np.where(violet, np.clip(v * 1.15, 0, 0.85), v)
h = h + (100 - h) * 0.25 * grass
v = v * (1 - 0.1 * grass)

# quieter overall: less saturation, values pulled toward the middle
s *= 0.78
v = 0.52 + (v - 0.52) * 0.78

out = np.stack([h * 255 / 360, np.clip(s, 0, 1) * 255, np.clip(v, 0, 1) * 255], -1).astype(np.uint8)
Image.fromarray(out, 'HSV').convert('RGB').save(sys.argv[2], quality=84, optimize=True)
