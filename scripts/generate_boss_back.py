#!/usr/bin/env python3
"""
직장 상사 뒷모습 SVG 생성기 (Python)
실행: python scripts/generate_boss_back.py
출력: assets/boss-back.svg
"""

from __future__ import annotations

import math
import random
from pathlib import Path

INK = "#141414"
PAPER = "#fefefe"
SKIN = "#f5e6d8"
SKIN_SHADOW = "#e8cdb8"
SUIT = "#f8f6f2"
SUIT_LINE = "rgba(20,20,20,0.08)"

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "boss-back.svg"


def wobble(x: float, y: float, amp: float, seed: int) -> tuple[float, float]:
    rng = random.Random(seed)
    return x + rng.uniform(-amp, amp), y + rng.uniform(-amp, amp)


def hair_strands(cx: float, cy: float, rx: float, ry: float, count: int) -> list[str]:
    paths: list[str] = []
    for i in range(count):
        rng = random.Random(1000 + i)
        angle = math.pi * (0.15 + 0.7 * i / max(count - 1, 1))
        x0 = cx + math.cos(angle) * rx * rng.uniform(0.72, 0.98)
        y0 = cy - math.sin(angle) * ry * rng.uniform(0.55, 0.95)
        x1 = cx + math.cos(angle) * rx * rng.uniform(0.35, 0.62)
        y1 = cy + ry * rng.uniform(0.35, 0.82)
        cx1 = cx + math.cos(angle + rng.uniform(-0.25, 0.25)) * rx * 0.55
        cy1 = cy + ry * rng.uniform(-0.05, 0.45)
        cx2 = cx + math.cos(angle + rng.uniform(-0.15, 0.15)) * rx * 0.38
        cy2 = cy + ry * rng.uniform(0.25, 0.72)
        sw = rng.uniform(1.2, 2.4)
        op = rng.uniform(0.55, 1.0)
        paths.append(
            f'    <path d="M{x0:.1f},{y0:.1f} C{cx1:.1f},{cy1:.1f} {cx2:.1f},{cy2:.1f} {x1:.1f},{y1:.1f}" '
            f'fill="none" stroke="{INK}" stroke-width="{sw:.2f}" stroke-linecap="round" opacity="{op:.2f}"/>'
        )
    return paths


def suit_hatch(x: float, y: float, w: float, h: float, step: int = 9) -> list[str]:
    lines: list[str] = []
    n = int((w + h) / step) + 2
    for i in range(n):
        x1 = x + i * step - h
        y1 = y
        x2 = x + i * step
        y2 = y + h
        lines.append(
            f'    <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{INK}" stroke-width="0.7" opacity="0.06"/>'
        )
    return lines


def build_svg() -> str:
    random.seed(42)
    head_cx, head_cy = 110.0, 52.0
    hair = hair_strands(head_cx, head_cy - 6, 46, 38, 48)

    parts: list[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240" role="img" aria-hidden="true" class="boss-svg">',
        '  <defs>',
        '    <filter id="boss-sketch" x="-4%" y="-4%" width="108%" height="108%">',
        '      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="n"/>',
        '      <feDisplacementMap in="SourceGraphic" in2="n" scale="0.6" xChannelSelector="R" yChannelSelector="G"/>',
        '    </filter>',
        '    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
        f'      <stop offset="0%" stop-color="{SKIN}"/>',
        f'      <stop offset="55%" stop-color="{SKIN_SHADOW}"/>',
        f'      <stop offset="100%" stop-color="{SKIN}"/>',
        '    </linearGradient>',
        '    <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">',
        f'      <stop offset="0%" stop-color="{SUIT}"/>',
        f'      <stop offset="100%" stop-color="#ece8e0"/>',
        '    </linearGradient>',
        '  </defs>',
        '',
        '  <g class="boss-chair-back">',
        '    <path d="M62 198 Q58 188 64 176 L156 176 Q162 188 158 198 Q156 210 110 212 Q64 210 62 198 Z"',
        f'      fill="url(#suitGrad)" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"/>',
        '    <path d="M72 182 L148 182" stroke="#141414" stroke-width="1.4" opacity="0.25"/>',
        '    <path d="M78 190 L142 190" stroke="#141414" stroke-width="1.2" opacity="0.2"/>',
        '    <path d="M84 198 L136 198" stroke="#141414" stroke-width="1" opacity="0.18"/>',
        '    <path d="M68 184 Q110 192 152 184" fill="none" stroke="#141414" stroke-width="1.6" opacity="0.35"/>',
        '  </g>',
        '',
        '  <g class="boss-shoulders">',
        '    <path d="M28 132 Q18 138 22 152 Q30 168 52 168 L168 168 Q190 168 198 152 Q202 138 192 132 Q170 118 110 120 Q50 118 28 132 Z"',
        f'      fill="url(#suitGrad)" stroke="{INK}" stroke-width="2.8" stroke-linejoin="round"/>',
        *suit_hatch(30, 124, 160, 44),
        '    <path d="M52 132 Q110 148 168 132" fill="none" stroke="#141414" stroke-width="1.8" opacity="0.35"/>',
        '    <path d="M74 136 Q110 142 146 136" fill="none" stroke="#141414" stroke-width="1.2" opacity="0.22"/>',
        '    <path d="M96 152 L124 152" stroke="#141414" stroke-width="2" opacity="0.45"/>',
        '    <path d="M88 156 Q110 162 132 156" fill="none" stroke="#141414" stroke-width="1.4" opacity="0.3"/>',
        '  </g>',
        '',
        '  <g class="boss-neck">',
        '    <path d="M92 108 Q110 114 128 108 L132 128 Q110 134 88 128 Z"',
        f'      fill="url(#skinGrad)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>',
        '    <path d="M98 112 Q110 116 122 112" fill="none" stroke="#141414" stroke-width="1.2" opacity="0.25"/>',
        '    <path d="M94 120 Q110 124 126 120" fill="none" stroke="#141414" stroke-width="1" opacity="0.2"/>',
        '  </g>',
        '',
        '  <g class="boss-head">',
        '    <ellipse cx="110" cy="58" rx="50" ry="54" fill="url(#skinGrad)" stroke="none" opacity="0.35"/>',
        '    <path d="M62 78 Q58 48 78 28 Q110 12 142 28 Q162 48 158 78 Q154 96 110 98 Q66 96 62 78 Z"',
        f'      fill="{PAPER}" stroke="{INK}" stroke-width="2.8" stroke-linejoin="round" filter="url(#boss-sketch)"/>',
        '    <path d="M68 40 Q74 32 82 36" fill="none" stroke="#141414" stroke-width="1.6" opacity="0.35" stroke-linecap="round"/>',
        '    <path d="M138 40 Q132 32 124 36" fill="none" stroke="#141414" stroke-width="1.6" opacity="0.35" stroke-linecap="round"/>',
        '    <g class="boss-hair-back">',
        f'    <path class="boss-hair-outline" d="M58 82 Q56 38 110 18 Q164 38 162 82 Q152 92 110 94 Q68 92 58 82 Z" fill="none" stroke="{INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
        *hair,
        '    <path d="M64 52 Q110 46 156 52" fill="none" stroke="#141414" stroke-width="1.1" opacity="0.28" stroke-linecap="round"/>',
        '    </g>',
        '    <g class="boss-scalp" opacity="0">',
        '      <ellipse cx="110" cy="56" rx="38" ry="34" fill="url(#skinGrad)"/>',
        '    </g>',
        '    <g class="boss-scalp-shine" opacity="0">',
        '      <ellipse cx="118" cy="48" rx="14" ry="9" fill="#ffffff" opacity="0.85" transform="rotate(-18 118 48)"/>',
        '    </g>',
        '    <text class="boss-head-back" x="110" y="62" text-anchor="middle" font-family="Nanum Pen Script, cursive" font-size="14" fill="#141414" opacity="0.2" transform="rotate(-8 110 62)">뒤통수</text>',
        '  </g>',
        '</svg>',
    ]
    return "\n".join(parts) + "\n"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    svg = build_svg()
    OUT.write_text(svg, encoding="utf-8")
    print(f"Wrote {OUT} ({len(svg)} bytes)")


if __name__ == "__main__":
    main()
