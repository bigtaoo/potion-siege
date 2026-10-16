"""Squash the top of a draft vertically, e.g. a tall crown that eats an ultimate's height budget, so the body
fills more of the 150-tall box. Rows above <split y> are resized to <factor> of their height; the rest is kept.
usage: python squash_top.py <in> <out> <split y> <factor>"""
import sys
from PIL import Image

src, dst, split, k = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
im = Image.open(src).convert('RGB')
top = im.crop((0, 0, im.width, split))
top = top.resize((im.width, round(split * k)), Image.LANCZOS)
out = Image.new('RGB', (im.width, top.height + im.height - split), (255, 255, 255))
out.paste(top, (0, 0))
out.paste(im.crop((0, split, im.width, im.height)), (0, top.height))
out.save(dst)
