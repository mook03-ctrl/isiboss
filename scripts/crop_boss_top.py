#!/usr/bin/env python3
"""상사 PNG 상단 크롭 + 배경 투명. py -3 scripts/crop_boss_top.py"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "boss-back-source.png"
OUT = ROOT / "assets" / "boss-back.png"
CROP_RATIO = 0.64


def remove_bg(img: Image.Image, threshold: int = 242) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            mn = min(r, g, b)
            spread = max(r, g, b) - mn
            if mn >= threshold - 14 and spread <= 20:
                px[x, y] = (r, g, b, 0)
            elif mn >= threshold - 32 and spread <= 32:
                t = max(0.0, min(1.0, (mn - (threshold - 32)) / 32.0))
                px[x, y] = (r, g, b, int(a * t * t))
    return img


def main() -> None:
    src = SOURCE if SOURCE.exists() else OUT
    img = Image.open(src)
    w, h = img.size
    crop_h = max(1, int(h * CROP_RATIO))
    cropped = img.crop((0, 0, w, crop_h))
    cropped = remove_bg(cropped)
    cropped.save(OUT, "PNG")
    print(f"Cropped {w}x{h} -> {w}x{crop_h} (RGBA) -> {OUT}")


if __name__ == "__main__":
    main()
