"""Cut a character out and push it toward the house style: flat colours and a uniform outline.
usage: python flatten.py <in> <out.png> <height> [colours] [outline px at output size]
AI images come with glossy highlights, soft gradients, a pale ground shadow and a white sticker
border. This cuts the background (including pale tinted shadows), reduces the figure to a small
palette so gradients become flat bands, then draws one even black outline around the silhouette."""
import sys
from PIL import Image, ImageChops, ImageFilter

from cutout import background_mask


def flatten(src, height, colours=18, outline=6):
    im = Image.open(src).convert("RGBA")
    rgb = im.convert("RGB")
    # a looser chroma limit also takes the lavender ground shadow and the grey sticker rim
    bg = background_mask(rgb, min_light=150, max_chroma=55)
    fg = ImageChops.invert(bg)
    # drop specks: open the mask a little
    fg = fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    box = fg.getbbox()
    rgb, fg = rgb.crop(box), fg.crop(box)

    # work at full resolution and shrink last, so edges stay smooth
    scale = height / rgb.height
    line = max(1, round(outline / scale))
    flat = rgb.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    flat = flat.convert("RGB").filter(ImageFilter.ModeFilter(5)).filter(ImageFilter.MedianFilter(5))

    pad = line + 4
    canvas = Image.new("RGBA", (rgb.width + 2 * pad, rgb.height + 2 * pad), (0, 0, 0, 0))
    mask = Image.new("L", canvas.size, 0)
    mask.paste(fg, (pad, pad))
    ring = mask.filter(ImageFilter.MaxFilter(2 * line + 1)).filter(ImageFilter.GaussianBlur(line / 4))
    ring = ring.point(lambda v: 255 if v >= 128 else 0)
    canvas.paste(Image.new("RGBA", canvas.size, (14, 12, 18, 255)), (0, 0), ring)
    body = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    body.paste(flat.convert("RGBA"), (pad, pad))
    canvas.paste(body, (0, 0), mask)
    canvas = canvas.resize((round(canvas.width * scale), round(canvas.height * scale)), Image.LANCZOS)
    return canvas


if __name__ == "__main__":
    src, dst, h = sys.argv[1], sys.argv[2], int(sys.argv[3])
    colours = int(sys.argv[4]) if len(sys.argv) > 4 else 18
    outline = int(sys.argv[5]) if len(sys.argv) > 5 else 6
    flatten(src, h, colours, outline).save(dst, optimize=True)
