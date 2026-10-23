"""
Build the site's image and video library from `building images/`.

Source files are never modified. Output:
  assets/media/img/<slug>.webp           photos, native resolution, q82
  assets/media/video/<slug>.mp4          H.264 web encodes
  assets/media/video/<slug>-poster.webp  first-frame poster

Usage: python scripts/build-media.py
"""

import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "building images")
IMG_OUT = os.path.join(ROOT, "assets", "media", "img")
VID_OUT = os.path.join(ROOT, "assets", "media", "video")

FFMPEG = "C:/Users/Pratham/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"

# source file -> slug
IMAGES = {
    "images (1).jpg": "villa-terrace",
    "images (10).jpg": "tower-glass",
    "images (11).jpg": "brick-balcony",
    "images (12).jpg": "house-street",
    "images (13).jpg": "stacked-boxes",
    "images (14).jpg": "villa-bougainvillea",
    "images (15).jpg": "house-courtyard",
    "images (16).jpg": "tower-facade",
    "images (17).jpg": "twin-houses",
    "images (18).jpg": "apartments-modern",
    "images (19).jpg": "interior-lounge",
    "images (2).jpg": "residence-classic",
    "images (20).jpg": "apartments-green",
    "images (21).jpg": "hotel-dusk",
    "images (22).jpg": "poolhouse",
    "images (23).jpg": "house-dusk",
    "images (24).jpg": "resort-courtyard",
    "images (25).jpg": "house-stone",
    "images (3).jpg": "towers-petronas",
    "images (4).jpg": "towers-petronas-2",
    "images (5).jpg": "curve-glass",
    "images (6).jpg": "brick-midrise",
    "images (7).jpg": "facade-white",
    "images (8).jpg": "towers-green",
    "images (9).jpg": "tower-lowangle",
    "images.jpg": "villa-pool",
    "istockphoto-838476004-612x612.webp": "workers-crane",
    "photo-1470075801209-17f9ec0cada6.avif": "glass-motion",
    "photo-1486406146926-c627a92ad1ab.avif": "city-up",
    "photo-1509130298739-651801c76e96.avif": "spiral",
    "photo-1534237710431-e2fc698436d0.avif": "towers-blue",
    "photo-1554469384-e58fac16e23a.avif": "glass-facade",
    "photo-1565008447742-97f6f38c985c.avif": "cranes-city",
    "premium_photo-1676657954811-9409c4830467.avif": "tower-blue",
    "premium_photo-1681691912442-68c4179c530c.avif": "workers-scaffold",
    "premium_photo-1693966067391-98babaeecf52.avif": "tower-terracotta",
}

# source file -> (slug, start, duration, scale, crf, gop)
# gop=1 gives every-frame keyframes, required for scroll scrubbing.
VIDEOS = {
    "12721327-hd_1080_1920_60fps.mp4": ("vantage", 0, 8.9, "720:1280", 30, 90),
    "12766654_1080_1920_50fps.mp4": ("spire", 3, 12, "720:1280", 31, 90),
    "14676288_2160_3840_30fps.mp4": ("scrub", 0, 6.8, "540:960", 34, 1),
    "15668869-uhd_3840_2160_30fps.mp4": ("aerial", 2, 18, "1280:720", 30, 90),
    "20071771-hd_1080_1920_30fps.mp4": ("curve", 0, 9.2, "720:1280", 31, 90),
    "5827634-uhd_2160_3840_24fps.mp4": ("skyline", 0, 11, "720:1280", 31, 90),
}


def build_images():
    os.makedirs(IMG_OUT, exist_ok=True)
    for src_name, slug in IMAGES.items():
        src = os.path.join(SRC, src_name)
        dst = os.path.join(IMG_OUT, slug + ".webp")
        if not os.path.exists(src):
            print("  missing", src_name)
            continue
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            if im.width > 1600:
                im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
            im.save(dst, "WEBP", quality=82, method=6)
        print(f"  {slug}.webp  {os.path.getsize(dst) // 1024}K")


def build_videos():
    os.makedirs(VID_OUT, exist_ok=True)
    for src_name, (slug, start, dur, scale, crf, gop) in VIDEOS.items():
        src = os.path.join(SRC, src_name)
        dst = os.path.join(VID_OUT, slug + ".mp4")
        poster = os.path.join(VID_OUT, slug + "-poster.webp")
        if not os.path.exists(src):
            print("  missing", src_name)
            continue
        if not os.path.exists(dst):
            cmd = [
                FFMPEG, "-y", "-ss", str(start), "-t", str(dur), "-i", src,
                "-an", "-vf", f"scale={scale}:flags=lanczos",
                "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
                "-crf", str(crf), "-g", str(gop), "-movflags", "+faststart",
                "-preset", "slow", dst,
            ]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode:
                print("  FAILED", slug, r.stderr[-400:])
                continue
        if not os.path.exists(poster):
            subprocess.run([
                FFMPEG, "-y", "-ss", "0.2", "-i", dst, "-frames:v", "1",
                "-vf", "scale=iw:ih", poster,
            ], capture_output=True)
        print(f"  {slug}.mp4  {os.path.getsize(dst) // 1024}K")


if __name__ == "__main__":
    if not os.path.isdir(SRC):
        sys.exit("Source folder not found: " + SRC)
    print("images")
    build_images()
    print("video")
    build_videos()
    print("done")
