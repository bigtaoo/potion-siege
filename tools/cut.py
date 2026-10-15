"""Cut a generated sprite out of its white background, resize it and save a 256-colour PNG.
usage: python cut.py <in> <out.png> <height> [--hole X,Y ...] [--keep-shadow]

Wraps standing's cutout.py with what fang's art needs:
- the grey ground shadow the image model keeps drawing under characters is removed too
  (neutral grey connected to the border), unless --keep-shadow;
- --hole X,Y (source pixels) clears an enclosed white area, e.g. between a bow and its string;
- the result is quantised to 256 colours with alpha, like standing's shipped art.
"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter


def background_mask(rgb, holes, shadow):
    r, g, b = rgb.split()
    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    chroma = ImageChops.subtract(hi, lo)
    # white paper: light and low saturation
    paper = ImageChops.multiply(lo.point(lambda v: 255 if v >= 130 else 0), chroma.point(lambda v: 255 if v <= 30 else 0))
    cand = paper
    if shadow:
        # ground shadow: mid grey with almost no colour; the black outline still stops the flood
        grey = ImageChops.multiply(lo.point(lambda v: 255 if v >= 90 else 0), chroma.point(lambda v: 255 if v <= 12 else 0))
        cand = ImageChops.lighter(paper, grey)
    pad = Image.new("L", (cand.width + 2, cand.height + 2), 255)
    pad.paste(cand, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    for x, y in holes:
        ImageDraw.floodfill(pad, (x + 1, y + 1), 128)
    return pad.crop((1, 1, cand.width + 1, cand.height + 1)).point(lambda v: 255 if v == 128 else 0)


def cut(src, holes=(), shadow=True):
    im = Image.open(src).convert("RGBA")
    bg = background_mask(im.convert("RGB"), holes, shadow)
    alpha = ImageChops.invert(bg).filter(ImageFilter.GaussianBlur(0.6))  # 1px feather
    im.putalpha(alpha)
    return im.crop(ImageChops.invert(bg).getbbox())


def main(argv):
    src, dst, h = argv[0], argv[1], int(argv[2])
    holes, shadow, rest = [], True, argv[3:]
    while rest:
        flag = rest.pop(0)
        if flag == "--hole":
            x, y = rest.pop(0).split(",")
            holes.append((int(x), int(y)))
        elif flag == "--keep-shadow":
            shadow = False
        else:
            sys.exit(f"unknown option {flag}")
    im = cut(src, holes, shadow)
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(dst, optimize=True)
    print(f"{dst} {im.width}x{im.height}")


if __name__ == "__main__":
    main(sys.argv[1:])
