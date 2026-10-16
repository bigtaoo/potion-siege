"""Clean the wind gourd draft (art/style/potion_wind_body_r2.png) before flatten.py: drop the dark teal
background and the sparkle, cut the cork, close the neck with an ink bar, and repaint the pale glossy glass
as flat potion (full up to the neck) with glass only at the neck; the face is kept.
usage: python fix_wind_body.py <draft> <out>; coordinates fit that 1024x768 draft only."""
import sys
from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size
INK = (14, 12, 18); GLASS = (160, 222, 250); WHITE = (255, 255, 255)
LIQ = (176, 240, 234); LIQ_SHADE = (118, 206, 208)
for corner in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
    ImageDraw.floodfill(im, corner, WHITE, thresh=40)
px = im.load()
# inside the bottle = flood from seeds in the neck and both bulbs, with the ink lines as the wall;
# everything else that is not ink (the white sticker rim) goes to the background
wall = Image.new('L', (W, H), 0); wp = wall.load()
for y in range(H):
    for x in range(W):
        wp[x, y] = 255 if sum(px[x, y]) < 330 else 0
for seed in ((520, 165), (520, 270), (520, 640), (440, 620), (620, 620)):
    if wp[seed] == 0:
        ImageDraw.floodfill(wall, seed, 128)
eyes = [(428, 475, 46), (610, 466, 46)]
mouth = (478, 498, 572, 562)
NECK_Y = 190  # under the rim: everything above is glass
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        if y < 128 or (300 <= x <= 400 and 200 <= y <= 260):  # cork and the sparkle
            px[x, y] = WHITE; continue
        if wp[x, y] == 0 and not any((x - ex) ** 2 + (y - ey) ** 2 < er * er for ex, ey, er in eyes)                 and not (mouth[0] <= x <= mouth[2] and mouth[1] <= y <= mouth[3]) and not r > g + 40:
            px[x, y] = WHITE; continue
        if abs(r - 199) + abs(g - 251) + abs(b - 249) < 30:  # the draft's potion colour, also inside the face boxes
            px[x, y] = GLASS if y < NECK_Y else LIQ; continue
        if any((x - ex) ** 2 + (y - ey) ** 2 < er * er for ex, ey, er in eyes):
            continue
        if mouth[0] <= x <= mouth[2] and mouth[1] <= y <= mouth[3]:
            continue
        if r > g + 40:  # blush
            continue
        if min(r, g, b) > 225 and y >= NECK_Y:  # gloss
            px[x, y] = LIQ; continue
        if r + g + b < 330:
            px[x, y] = INK; continue
        if b >= r:  # pale cyan glass and its gloss
            if y < NECK_Y:
                px[x, y] = GLASS
            else:
                px[x, y] = LIQ if r > 175 else LIQ_SHADE
ImageDraw.Draw(im).rounded_rectangle((462, 122, 584, 146), 10, fill=INK)
im.save(dst)
