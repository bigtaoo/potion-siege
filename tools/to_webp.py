"""Write the game's art (art/web/*.png|jpg, the finished sources) as WebP into public/art, which is
what the game fetches (src/view/art.ts). Lossy q85: the alpha plane stays lossless, so the outlines
keep a clean edge on any field; at 3x zoom the bottles look the same as the PNGs. About a quarter of
the bytes. usage: python tools/to_webp.py [file ...]  (all of art/web when none given)"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent
SRC, OUT = ROOT / "art/web", ROOT / "public/art"

files = [Path(f) for f in sys.argv[1:]] or sorted(p for p in SRC.iterdir() if p.suffix in (".png", ".jpg"))
OUT.mkdir(exist_ok=True)
for f in files:
    im = Image.open(f)
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    dst = OUT / f"{f.stem}.webp"
    im.save(dst, "WEBP", quality=85, method=6)
    print(f"{f.name}: {f.stat().st_size // 1000} kB -> {dst.stat().st_size // 1000} kB")
