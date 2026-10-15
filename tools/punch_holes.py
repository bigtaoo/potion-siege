"""Clear the white background left in holes the cutout's flood fill cannot reach (between an arm
and the body, between the legs), and ink their rims like the outer outline.
usage: python punch_holes.py <in.png> <out.png> [lightness] [outline px] [min hole px]"""
import sys
from PIL import Image, ImageFilter

INK = (14, 12, 18, 255)


def punch(src, dst, light=215, outline=5, min_area=40):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = [[False] * h for _ in range(w)]
    hole = Image.new("L", im.size, 0)
    hp = hole.load()
    whitish = lambda x, y: px[x, y][3] and min(px[x, y][:3]) > light
    for sx in range(w):
        for sy in range(h):
            if seen[sx][sy] or not whitish(sx, sy):
                continue
            # one connected patch of white; small ones are highlights, keep them
            stack, patch = [(sx, sy)], []
            seen[sx][sy] = True
            while stack:
                x, y = stack.pop()
                patch.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and whitish(nx, ny):
                        seen[nx][ny] = True
                        stack.append((nx, ny))
            if len(patch) >= min_area:
                for x, y in patch:
                    hp[x, y] = 255
    rim = hole.filter(ImageFilter.MaxFilter(2 * outline + 1))
    rp = rim.load()
    n = 0
    for y in range(h):
        for x in range(w):
            if hp[x, y]:
                px[x, y] = (0, 0, 0, 0)
                n += 1
            elif rp[x, y] and px[x, y][3]:
                px[x, y] = INK
    im.save(dst)
    print(f"{dst}: {n} hole pixels cleared")


if __name__ == "__main__":
    a = sys.argv
    punch(a[1], a[2], *(int(v) for v in a[3:6]))
