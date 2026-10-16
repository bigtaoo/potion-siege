"""Draw the wind gourd body in the house style and graft the face from Mistral draft r2.
usage: python draw_wind_body.py <face draft (potion_wind_body_r2.png)> <out.png> [a|b]
a: classic gourd, big lower bulb and a small upper bulb. b: chubby figure eight, two bulbs of almost the same size.
Mistral drew the gourd only now and then, with the face on the small bulb, a cork and glossy glass, so the
bottle is drawn here (as for arcane) and only the eyes, mouth and blush come from the draft."""
import sys
from PIL import Image, ImageDraw, ImageChops, ImageFilter

S = 4  # work at 4x, shrink last
H = 268
INK = (14, 12, 18, 255)
GLASS = (160, 222, 250, 255)
RIM = (214, 238, 252, 255)
LIQ = (176, 240, 234, 255)        # pale cyan-white, but with enough chroma that flatten-style cuts keep it
LIQ_TOP = (222, 252, 246, 255)
LIQ_SHADE = (118, 206, 208, 255)
SHINE = (240, 255, 252, 255)
WALL = 7
LINE = 9

VARIANTS = {
    # lower bulb radius, upper bulb radius, distance between centres, neck half width, face width
    'a': dict(r1=76, r2=42, d=106, neck=16, face=124),
    'b': dict(r1=66, r2=52, d=104, neck=16, face=100),
}


def s(v):
    return round(v * S)


def grow(m, px):
    k = 2 * s(px) + 1
    return m.filter(ImageFilter.MaxFilter(k if k % 2 else k + 1))


def shrink(m, px):
    k = 2 * s(px) + 1
    return m.filter(ImageFilter.MinFilter(k if k % 2 else k + 1))


def main(face_src, out, variant):
    v = VARIANTS[variant]
    r1, r2, d, neck = v['r1'], v['r2'], v['d'], v['neck']
    W = 2 * r1 + 2 * LINE + 12
    cx = W / 2
    bot = H - LINE - 2           # flat bottom
    c1 = bot - r1 + 6            # the lower circle is cut 6 px above its lowest point
    c2 = c1 - d
    neck_top = LINE + 12
    rim_top = LINE + 1

    body = Image.new('L', (s(W), s(H)), 0)
    dr = ImageDraw.Draw(body)
    dr.ellipse((s(cx - r1), s(c1 - r1), s(cx + r1), s(c1 + r1)), fill=255)
    dr.ellipse((s(cx - r2), s(c2 - r2), s(cx + r2), s(c2 + r2)), fill=255)
    dr.rectangle((s(cx - neck), s(neck_top), s(cx + neck), s(c2)), fill=255)
    # round the pinched waist a little: close, then reopen the outer shape
    body = shrink(grow(body, 2), 2)
    cut = Image.new('L', body.size, 0)
    ImageDraw.Draw(cut).rectangle((0, 0, s(W), s(bot)), fill=255)
    body = ImageChops.multiply(body, cut)

    rim = Image.new('L', body.size, 0)
    ImageDraw.Draw(rim).rounded_rectangle((s(cx - neck - 8), s(rim_top), s(cx + neck + 8), s(neck_top + 6)),
                                          radius=s(6), fill=255)
    sil = ImageChops.lighter(body, rim)

    canvas = Image.new('RGBA', body.size, (0, 0, 0, 0))
    canvas.paste(INK, (0, 0), grow(sil, LINE))
    canvas.paste(GLASS, (0, 0), body)

    # completely full: the potion fills both bulbs, the glass shows only in the neck
    liq_y = c2 - r2 + 4
    liquid = shrink(body, WALL)
    top = Image.new('L', body.size, 0)
    ImageDraw.Draw(top).rectangle((0, s(liq_y), s(W), s(H)), fill=255)
    liquid = ImageChops.multiply(liquid, top)
    canvas.paste(LIQ, (0, 0), liquid)
    # one hard cel shadow down the right side and along the bottom of each bulb
    shifted = ImageChops.offset(liquid, -s(16), -s(12))
    canvas.paste(LIQ_SHADE, (0, 0), ImageChops.subtract(liquid, shifted))
    band = Image.new('L', body.size, 0)
    ImageDraw.Draw(band).rectangle((0, s(liq_y), s(W), s(liq_y + 8)), fill=255)
    canvas.paste(LIQ_TOP, (0, 0), ImageChops.multiply(band, liquid))
    # a short shine stripe on the upper bulb (one on the lower bulb would cross the blush)
    sh = ImageDraw.Draw(canvas)
    sh.rounded_rectangle((s(cx - r2 + 14), s(c2 - 18), s(cx - r2 + 22), s(c2 + 6)), radius=s(4), fill=SHINE)

    canvas.paste(INK, (0, 0), ImageChops.multiply(grow(rim, 3.5), body))
    canvas.paste(RIM, (0, 0), rim)

    # face from r2: eyes, mouth and blush, everything that differs from the draft's liquid (199, 251, 249)
    src = Image.open(face_src).convert('RGB')
    box = (360, 420, 690, 590)
    face = src.crop(box)
    alpha = Image.new('L', face.size, 0)
    fp, ap = face.load(), alpha.load()
    for y in range(face.height):
        for x in range(face.width):
            if x > 284:          # the draft's glass rim on the right
                continue
            r, g, b = fp[x, y]
            dist = abs(r - 199) + abs(g - 251) + abs(b - 249)
            ap[x, y] = max(0, min(255, (dist - 50) * 3))
    fw = s(v['face'])
    k = fw / face.width
    face = face.resize((fw, round(face.height * k)), Image.LANCZOS)
    alpha = alpha.resize(face.size, Image.LANCZOS)
    fy = c1 - 2
    canvas.paste(face.convert('RGBA'), (s(cx) - fw // 2, s(fy) - face.height // 2), alpha)

    small = canvas.resize((round(W), H), Image.LANCZOS)
    small.save(out, optimize=True)
    # anchors for POTIONS in art.ts, as fractions of the image (eyes sit at crop x 68 / 250, y 50)
    fh = v['face'] * 170 / 330
    ex = [(cx + (e / 330 - 0.5) * v['face']) / W for e in (68, 250)]
    ey = (fy - fh / 2 + 50 / 170 * fh) / H
    print(f"{out}: {round(W)}x{H} eyes {ex[0]:.3f}/{ex[1]:.3f} @{ey:.3f} neck 0.5/{rim_top / H:.3f}")


main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'a')
