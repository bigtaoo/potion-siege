"""Cut the wall-and-workshop draft into the bottom of the battle screen.

usage: python tools/make_base_bg.py <draft.png> <out.png>

The draft is 1024x768 landscape: crenellations, the wall face, then the workshop floor.
The game looks down on the wall from the workshop side, so all it needs is the floor and
a short strip of the wall's inner face above it (the wall's foot, with the health bar in
it); the wall's top and its merlons are drawn by the game (src/view/stone.ts), because
they move as cells are built. Colours are quieted like the field so the heroes and
buttons stand out.

Prints the design y the output's top must be placed at (BASE_TOP in BattleView.ts).
"""
import sys

import numpy as np
from PIL import Image

FLOOR = 1664  # design y where the floor starts
SCALE_Y = 0.914  # vertical scale from the draft to design units
SRC_CUT, SRC_FLOOR = 383, 445  # draft rows: a mortar line low on the wall face, start of the floor


def quiet(a: np.ndarray, floor_from: int) -> np.ndarray:
    """Less saturation, the floor a little darker than the wall."""
    hsv = np.asarray(Image.fromarray(a[..., :3]).convert('HSV')).astype(float) / 255
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    s *= 0.72
    v = 0.55 + (v - 0.55) * 0.8
    floor = np.zeros_like(v, bool)
    floor[floor_from:] = True
    v = np.where(floor, v * 0.78, v)
    s = np.where(floor, s * 0.9, s)
    out = a.copy()
    out[..., :3] = np.asarray(Image.fromarray((np.stack([h, s, np.clip(v, 0, 1)], -1) * 255).astype(np.uint8), 'HSV').convert('RGB'))
    return out


def main(src: str, out: str) -> None:
    a = np.asarray(Image.open(src).convert('RGBA'))[SRC_CUT:]
    a = quiet(a, SRC_FLOOR - SRC_CUT)
    top = round(FLOOR - (SRC_FLOOR - SRC_CUT) * SCALE_Y)
    cut = Image.fromarray(a, 'RGBA').resize((1080, round(a.shape[0] * SCALE_Y)), Image.LANCZOS)
    cut = cut.crop((0, 0, 1080, 1920 - top))
    # a 256-colour palette keeps the file small; the art is flat colours anyway
    cut.quantize(256, method=Image.Quantize.FASTOCTREE).save(out, optimize=True)
    print(f'BASE_TOP = {top}')


main(sys.argv[1], sys.argv[2])
