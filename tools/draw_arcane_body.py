"""Draw the arcane test-tube body in the house style and graft the face from Mistral draft r2."""
import sys
from PIL import Image, ImageDraw, ImageChops, ImageFilter

S = 4  # work at 4x, shrink last
W, H = 190, 268
INK = (14, 12, 18, 255)
GLASS = (160, 222, 250, 255)
RIM = (214, 238, 252, 255)
LIQ = (138, 13, 208, 255)
LIQ_TOP = (178, 96, 238, 255)
LIQ_SHADE = (100, 8, 166, 255)
SHINE = (206, 158, 248, 255)
BLUSH = (255, 150, 185, 255)

X0, X1 = 30, 160          # tube sides
TOP, BOT = 30, 258        # tube top (under the rim) and bottom of the U
R = (X1 - X0) / 2
LIQ_Y = 66                # liquid surface
WALL = 7
LINE = 9


def s(v):
    return round(v * S)


def tube_mask(x0, x1, top, bot):
    m = Image.new('L', (s(W), s(H)), 0)
    d = ImageDraw.Draw(m)
    r = (x1 - x0) / 2
    d.rectangle((s(x0), s(top), s(x1), s(bot - r)), fill=255)
    d.ellipse((s(x0), s(bot - 2 * r), s(x1), s(bot)), fill=255)
    return m


def rim_mask():
    m = Image.new('L', (s(W), s(H)), 0)
    ImageDraw.Draw(m).rounded_rectangle((s(X0 - 8), s(LINE + 4), s(X1 + 8), s(TOP + 4)), radius=s(7), fill=255)
    return m


def grow(m, px):
    k = 2 * s(px) + 1
    return m.filter(ImageFilter.MaxFilter(k if k % 2 else k + 1))


def main(face_src, out):
    canvas = Image.new('RGBA', (s(W), s(H)), (0, 0, 0, 0))
    tube = tube_mask(X0, X1, TOP, BOT)
    rim = rim_mask()
    sil = ImageChops.lighter(tube, rim)
    canvas.paste(INK, (0, 0), grow(sil, LINE))
    canvas.paste(GLASS, (0, 0), tube)

    liquid = tube_mask(X0 + WALL, X1 - WALL, LIQ_Y, BOT - WALL)
    canvas.paste(LIQ, (0, 0), liquid)
    # one hard cel shadow down the right side and along the bottom
    shifted = ImageChops.offset(liquid, -s(18), -s(12))
    canvas.paste(LIQ_SHADE, (0, 0), ImageChops.subtract(liquid, shifted))
    # a lighter band at the surface
    band = Image.new('L', liquid.size, 0)
    ImageDraw.Draw(band).rectangle((0, s(LIQ_Y), s(W), s(LIQ_Y + 9)), fill=255)
    canvas.paste(LIQ_TOP, (0, 0), ImageChops.multiply(band, liquid))
    # a short shine stripe on the left
    shine = Image.new('L', liquid.size, 0)
    ImageDraw.Draw(shine).rounded_rectangle((s(X0 + WALL + 7), s(196), s(X0 + WALL + 15), s(226)), radius=s(4), fill=255)
    canvas.paste(SHINE, (0, 0), shine)

    # the rim sits on top, with an ink line under it
    canvas.paste(INK, (0, 0), ImageChops.multiply(grow(rim, 3.5), tube))
    canvas.paste(RIM, (0, 0), rim)

    # face: everything in the face box that differs from the draft's liquid colour
    src = Image.open(face_src).convert('RGB')
    box = (382, 348, 640, 512)
    face = src.crop(box)
    lr, lg, lb = 138, 13, 208
    alpha = Image.new('L', face.size, 0)
    fp, ap = face.load(), alpha.load()
    eyes = [(446 - box[0], 401 - box[1], 44), (570 - box[0], 401 - box[1], 44)]
    for y in range(face.height):
        for x in range(face.width):
            r, g, b = fp[x, y]
            d = abs(r - lr) + abs(g - lg) + abs(b - lb)
            near_eye = any((x - ex) ** 2 + (y - ey) ** 2 < er * er for ex, ey, er in eyes)
            mouth = 60 < x < 200 and 105 < y < 160
            if near_eye or mouth:
                ap[x, y] = max(0, min(255, (d - 60) * 3))
    fw = 124 * S
    scale = fw / face.width
    face = face.resize((fw, round(face.height * scale)), Image.LANCZOS)
    alpha = alpha.resize(face.size, Image.LANCZOS)
    cx, cy = (X0 + X1) / 2, 156
    fx, fy = s(cx) - face.width // 2, s(cy) - face.height // 2
    canvas.paste(face.convert('RGBA'), (fx, fy), alpha)
    # blush: flat pink ovals under the eyes
    d = ImageDraw.Draw(canvas)
    for ex in (cx - 40, cx + 40):
        d.ellipse((s(ex - 10), s(cy + 10), s(ex + 10), s(cy + 20)), fill=BLUSH)

    canvas.resize((W, H), Image.LANCZOS).save(out, optimize=True)
    canvas.save(out.replace('.png', '_4x.png'))


main(sys.argv[1], sys.argv[2])
