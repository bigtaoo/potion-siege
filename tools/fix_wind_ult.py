"""Clean a wind ultimate draft before flatten.py: keep only the largest figure (drops the floating droplets)
and paint the bluish ground shadow under the boots white.
usage: python fix_wind_ult.py <draft> <out> [shadow top y] [x0,y0,x1,y1 box to paint white, e.g. the shadow's rim between the boots]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
a = np.array(Image.open(src).convert('RGB')).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
if len(sys.argv) > 3:
    # the shadow is a flat pale-to-mid blue ellipse; the boots are dark teal with a black outline
    top = int(sys.argv[3])
    rows = np.zeros(r.shape, bool); rows[top:] = True
    shadow = rows & (b > r + 25) & (r + g + b > 220)
    a[shadow] = 255
if len(sys.argv) > 4:
    x0, y0, x1, y1 = map(int, sys.argv[4].split(','))
    a[y0:y1, x0:x1] = 255
fg = a.min(axis=2) < 235
lab, n = ndimage.label(ndimage.binary_closing(fg, iterations=2))
if n > 1:
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = lab == (1 + int(np.argmax(sizes)))
    a[~keep] = 255
Image.fromarray(a.astype(np.uint8)).save(dst)
