"""Quiet a finished field (art/web/bg_*.jpg, from make_field_bg.py) so the clockwork enemies stand
off it: 12% less saturation, 12% darker, and a soft vignette that darkens the outer edges and the
top by up to another 22%, fading out well before the middle, so the road the enemies walk stays
clean. Grades the source in place; run it once on a new field, then tools/to_webp.py on it.

usage: python tools/grade_field.py art/web/bg_snow.jpg [...]
"""
import sys
import numpy as np
from PIL import Image

DESAT, DARK, EDGE = 0.12, 0.12, 0.22
# how far in (fraction of the width / height) the vignette reaches from the sides / the top
SIDE, TOP = 0.2, 0.12

for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32) / 255
    h, w = a.shape[:2]
    grey = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    a = grey + (a - grey) * (1 - DESAT)
    x = np.linspace(0, 1, w, dtype=np.float32)
    y = np.linspace(0, 1, h, dtype=np.float32)
    side = np.clip(1 - np.minimum(x, 1 - x) / SIDE, 0, 1) ** 2
    top = np.clip(1 - y / TOP, 0, 1) ** 2
    edge = np.maximum(side[None, :], top[:, None])
    a *= ((1 - DARK) * (1 - EDGE * edge))[..., None]
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(f, quality=95)
    print(f, 'graded')
