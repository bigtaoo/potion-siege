"""Turn a Mistral field draft into the playfield background: portrait crop, quieter colours.

usage: make_field_bg.py <draft.png> <out.jpg>
The road goes from yellow sand to grey-beige stone (yellow belongs to lightning), violet
decorations turn to pale stone (violet belongs to arcane), and the whole picture loses some
saturation and contrast so heroes, enemies and effects sit on top of it.
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

sand = (h > 18) & (h < 55) & (s > 0.15) & (v > 0.5)
grass = (h >= 55) & (h < 140)
violet = (h > 250) & (h < 320) & (s > 0.2)

s = np.where(sand, np.minimum(s * 0.35, 0.13), s)
h = np.where(sand, 35, h)
v = np.where(sand, 0.55 + (v - 0.55) * 0.7, v)
s = np.where(violet, s * 0.12, s)
v = np.where(violet, np.clip(v * 1.15, 0, 0.85), v)
h = np.where(grass, h + (100 - h) * 0.25, h)
v = np.where(grass, v * 0.9, v)

# quieter overall: less saturation, values pulled toward the middle
s *= 0.78
v = 0.52 + (v - 0.52) * 0.78

out = np.stack([h * 255 / 360, np.clip(s, 0, 1) * 255, np.clip(v, 0, 1) * 255], -1).astype(np.uint8)
Image.fromarray(out, 'HSV').convert('RGB').save(sys.argv[2], quality=84, optimize=True)
