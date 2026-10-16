"""Clean the corrosion body draft (art/style/potion_poison_body_r1.png) before flatten.py: cut the cork,
close the neck with an ink bar, drop the ground shadow and the gloss, paint the glass, add a riveted rust band.
usage: python fix_poison_body.py <draft> <out>; coordinates fit that 1024x768 draft only."""
import sys
from PIL import Image, ImageDraw
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size; px = im.load()
LIQ = (223, 253, 33); GLASS = (160, 222, 250); INK = (14, 12, 18)
def inside(x, y, boxes): return any(a <= x <= c and b <= y <= d for a, b, c, d in boxes)
# shadow: dark navy under the bottle
for y in range(640, H):
    for x in range(W):
        r, g, b = px[x, y]
        if b > 30 and b - r > 18 and b < 160: px[x, y] = (255, 255, 255)
bgim = im.copy(); ImageDraw.floodfill(bgim, (0, H - 1), (255, 0, 255), thresh=60); ImageDraw.floodfill(bgim, (W - 1, 300), (255, 0, 255), thresh=60); ImageDraw.floodfill(bgim, (0, 300), (255, 0, 255), thresh=60)
bgp = bgim.load()
keep = [(415, 440, 615, 520), (405, 350, 480, 425), (560, 350, 635, 425)]  # teeth, eyes
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        if y < 150: px[x, y] = (255, 255, 255); continue
        if y >= 712 or (y >= 686 and not 345 <= x <= 705): px[x, y] = (255, 255, 255); continue
        if not 345 <= x <= 705 or bgp[x, y] == (255, 0, 255): continue
        # glass: pale cyan
        if b > 200 and g > 190 and b > r + 25 and y > 150: px[x, y] = GLASS; continue
        # gloss on the liquid
        if 240 <= y <= 600 and 372 <= x <= 672 and min(r, g, b) > 200 and all(bgp[x + k, y] != (255, 0, 255) for k in (-14, 14)) and not inside(x, y, keep): px[x, y] = LIQ
d = ImageDraw.Draw(im)
d.rounded_rectangle((438, 140, 597, 168), 10, fill=INK)
# rusty iron band around the bottom
top, bot = 616, 676
for y in range(top, bot):
    xs = [x for x in range(340, 710) if sum(px[x, y]) < 120]
    l, r = xs[0], xs[-1]
    for x in range(l, r + 1):
        if y < top + 8 or y >= bot - 8 or x < l + 10 or x > r - 10: px[x, y] = INK
        else: px[x, y] = (200, 102, 44) if y < top + 8 + 30 else (150, 70, 32)
for i in range(5):
    cx = 395 + i * 65
    d.ellipse((cx - 15, 636 - 15, cx + 15, 636 + 15), fill=(110, 48, 22), outline=INK, width=6)
im.save(dst)
