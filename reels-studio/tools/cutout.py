#!/usr/bin/env python3
"""Cut a character off a plain white background: flood-fill near-white from the borders, feather the edge,
trim to the bounding box. usage: cutout.py in.png out.png"""
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
im = Image.open(sys.argv[1]).convert("RGB")
a = np.asarray(im).astype(np.int16)
white = (a.min(axis=2) > 232) & ((a.max(axis=2) - a.min(axis=2)) < 22)
lab, _ = ndimage.label(white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
alpha = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
out = im.convert("RGBA"); out.putalpha(alpha)
box = out.getbbox(); out = out.crop(box)
out.save(sys.argv[2]); print(sys.argv[2], out.size)
