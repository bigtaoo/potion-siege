"""Clean the outline of a flattened figure: dark pixels near the silhouette edge become pure ink.
usage: python clean_edges.py <in.png> [out.png] [band px] [darkness]
Quantizing leaves green and purple specks where the AI's own outline meets the drawn one; this
paints every dark pixel within `band` px of the transparent edge the one outline colour."""
import sys
from PIL import Image, ImageFilter

INK = (14, 12, 18)


def clean(src, band=8, dark=110):
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    inner = alpha.filter(ImageFilter.MinFilter(2 * band + 1))
    px, a, i = im.load(), alpha.load(), inner.load()
    n = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, al = px[x, y]
            if a[x, y] and not i[x, y] and 0.3 * r + 0.59 * g + 0.11 * b < dark:
                px[x, y] = (*INK, al)
                n += 1
    return im, n


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    band = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    dark = int(sys.argv[4]) if len(sys.argv) > 4 else 110
    out, n = clean(src, band, dark)
    out.save(dst, optimize=True)
    print(f"{dst}: {n} pixels inked")
