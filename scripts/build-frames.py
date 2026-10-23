"""
Generate optimized WebP frame sequences for the Dwaar scroll-scrub hero.

Source frames (1920x1080 JPEG) live in the untrusted-data folder and are never
modified. Output goes to assets/frames/{hd,sd}/frame-0001.webp ... frame-0192.webp

Usage: python scripts/build-frames.py
"""

import os
import sys
import time
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Building_construction_video_crea…_1080p_20261019002642-frames")
OUT = os.path.join(ROOT, "assets", "frames")

# (folder, width, webp quality)
TIERS = [
    ("hd", 1280, 70),
    ("md", 960, 68),
    ("sd", 640, 66),
]

TOTAL = 192


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"Source frame folder not found: {SRC}")

    start = time.time()
    for folder, width, quality in TIERS:
        dest = os.path.join(OUT, folder)
        os.makedirs(dest, exist_ok=True)
        height = round(width * 9 / 16)
        for i in range(1, TOTAL + 1):
            src = os.path.join(SRC, f"frame-{i:04d}.jpg")
            dst = os.path.join(dest, f"frame-{i:04d}.webp")
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                continue
            with Image.open(src) as im:
                im = im.convert("RGB").resize((width, height), Image.LANCZOS)
                im.save(dst, "WEBP", quality=quality, method=5)
            if i % 16 == 0:
                print(f"  {folder}: {i}/{TOTAL}", flush=True)
        size = sum(os.path.getsize(os.path.join(dest, f)) for f in os.listdir(dest))
        print(f"{folder}: {len(os.listdir(dest))} files, {size / 1048576:.1f} MB", flush=True)

    print(f"done in {time.time() - start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
