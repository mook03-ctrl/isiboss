#!/usr/bin/env python3
"""PNG 밝은 배경을 투명으로 변환. pip install pillow"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent


def remove_bg(src: Path, dst: Path, threshold: int = 242) -> None:
    img = Image.open(src).convert("RGBA")
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
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "PNG")
    print(f"Wrote {dst} ({dst.stat().st_size} bytes)")


def main() -> None:
    boss_src = ROOT / "assets" / "boss-back-source.png"
    if not boss_src.exists():
        boss_src = ROOT / "assets" / "boss-back.png"
    scalp_src = ROOT / "assets" / "boss-scalp.png"

    remove_bg(boss_src, ROOT / "assets" / "boss-back.png")
    if scalp_src.exists() and boss_src != scalp_src:
        remove_bg(scalp_src, ROOT / "assets" / "boss-scalp.png", threshold=248)


if __name__ == "__main__":
    main()
