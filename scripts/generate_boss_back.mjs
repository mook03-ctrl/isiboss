/** Node fallback: node scripts/generate_boss_back.mjs */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "boss-back.svg");

const INK = "#141414";
const PAPER = "#fefefe";
const SKIN = "#f5e6d8";
const SKIN_SHADOW = "#e8cdb8";
const SUIT = "#f8f6f2";

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function hairStrands(cx, cy, rx, ry, count) {
  const paths = [];
  for (let i = 0; i < count; i++) {
    const r = rng(1000 + i);
    const angle = Math.PI * (0.15 + (0.7 * i) / Math.max(count - 1, 1));
    const x0 = cx + Math.cos(angle) * rx * (0.72 + r() * 0.26);
    const y0 = cy - Math.sin(angle) * ry * (0.55 + r() * 0.4);
    const x1 = cx + Math.cos(angle) * rx * (0.35 + r() * 0.27);
    const y1 = cy + ry * (0.35 + r() * 0.47);
    const cx1 = cx + Math.cos(angle + (r() - 0.5) * 0.5) * rx * 0.55;
    const cy1 = cy + ry * (-0.05 + r() * 0.5);
    const cx2 = cx + Math.cos(angle + (r() - 0.5) * 0.3) * rx * 0.38;
    const cy2 = cy + ry * (0.25 + r() * 0.47);
    const sw = 1.2 + r() * 1.2;
    const op = 0.55 + r() * 0.45;
    paths.push(
      `    <path d="M${x0.toFixed(1)},${y0.toFixed(1)} C${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`
    );
  }
  return paths;
}

function suitHatch(x, y, w, h, step = 9) {
  const lines = [];
  const n = Math.floor((w + h) / step) + 2;
  for (let i = 0; i < n; i++) {
    const x1 = x + i * step - h;
    const x2 = x + i * step;
    lines.push(
      `    <line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y + h).toFixed(1)}" stroke="${INK}" stroke-width="0.7" opacity="0.06"/>`
    );
  }
  return lines;
}

const hair = hairStrands(110, 46, 46, 38, 48);
const hatch = suitHatch(30, 124, 160, 44);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240" role="img" aria-hidden="true" class="boss-svg">
  <defs>
    <filter id="boss-sketch" x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${SKIN}"/>
      <stop offset="55%" stop-color="${SKIN_SHADOW}"/>
      <stop offset="100%" stop-color="${SKIN}"/>
    </linearGradient>
    <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${SUIT}"/>
      <stop offset="100%" stop-color="#ece8e0"/>
    </linearGradient>
  </defs>
  <g class="boss-chair-back">
    <path d="M62 198 Q58 188 64 176 L156 176 Q162 188 158 198 Q156 210 110 212 Q64 210 62 198 Z" fill="url(#suitGrad)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M72 182 L148 182" stroke="#141414" stroke-width="1.4" opacity="0.25"/>
    <path d="M78 190 L142 190" stroke="#141414" stroke-width="1.2" opacity="0.2"/>
    <path d="M84 198 L136 198" stroke="#141414" stroke-width="1" opacity="0.18"/>
    <path d="M68 184 Q110 192 152 184" fill="none" stroke="#141414" stroke-width="1.6" opacity="0.35"/>
  </g>
  <g class="boss-shoulders">
    <path d="M28 132 Q18 138 22 152 Q30 168 52 168 L168 168 Q190 168 198 152 Q202 138 192 132 Q170 118 110 120 Q50 118 28 132 Z" fill="url(#suitGrad)" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
${hatch.join("\n")}
    <path d="M52 132 Q110 148 168 132" fill="none" stroke="#141414" stroke-width="1.8" opacity="0.35"/>
    <path d="M74 136 Q110 142 146 136" fill="none" stroke="#141414" stroke-width="1.2" opacity="0.22"/>
    <path d="M96 152 L124 152" stroke="#141414" stroke-width="2" opacity="0.45"/>
    <path d="M88 156 Q110 162 132 156" fill="none" stroke="#141414" stroke-width="1.4" opacity="0.3"/>
  </g>
  <g class="boss-neck">
    <path d="M92 108 Q110 114 128 108 L132 128 Q110 134 88 128 Z" fill="url(#skinGrad)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M98 112 Q110 116 122 112" fill="none" stroke="#141414" stroke-width="1.2" opacity="0.25"/>
    <path d="M94 120 Q110 124 126 120" fill="none" stroke="#141414" stroke-width="1" opacity="0.2"/>
  </g>
  <g class="boss-head">
    <ellipse cx="110" cy="58" rx="50" ry="54" fill="url(#skinGrad)" stroke="none" opacity="0.35"/>
    <path d="M62 78 Q58 48 78 28 Q110 12 142 28 Q162 48 158 78 Q154 96 110 98 Q66 96 62 78 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round" filter="url(#boss-sketch)"/>
    <path d="M68 40 Q74 32 82 36" fill="none" stroke="#141414" stroke-width="1.6" opacity="0.35" stroke-linecap="round"/>
    <path d="M138 40 Q132 32 124 36" fill="none" stroke="#141414" stroke-width="1.6" opacity="0.35" stroke-linecap="round"/>
    <g class="boss-hair-back">
    <path class="boss-hair-outline" d="M58 82 Q56 38 110 18 Q164 38 162 82 Q152 92 110 94 Q68 92 58 82 Z" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
${hair.join("\n")}
    <path d="M64 52 Q110 46 156 52" fill="none" stroke="#141414" stroke-width="1.1" opacity="0.28" stroke-linecap="round"/>
    </g>
    <g class="boss-scalp" opacity="0">
      <ellipse cx="110" cy="56" rx="38" ry="34" fill="url(#skinGrad)"/>
    </g>
    <g class="boss-scalp-shine" opacity="0">
      <ellipse cx="118" cy="48" rx="14" ry="9" fill="#ffffff" opacity="0.85" transform="rotate(-18 118 48)"/>
    </g>
    <text class="boss-head-back" x="110" y="62" text-anchor="middle" font-family="Nanum Pen Script, cursive" font-size="14" fill="#141414" opacity="0.2" transform="rotate(-8 110 62)">뒤통수</text>
  </g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, "utf8");
console.log(`Wrote ${OUT} (${svg.length} bytes)`);
