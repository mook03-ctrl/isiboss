/**
 * PNG 흰/크림 배경 → 투명 변환
 * node scripts/remove_white_bg.mjs [input] [output]
 */
import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function removeWhiteBg(inputPath, outputPath, threshold = 248) {
  const buf = readFileSync(inputPath);
  const png = PNG.sync.read(buf);

  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const spread = max - min;

    // 흰색·크림·연회색 배경
    if (min >= threshold - 12 && spread <= 18) {
      png.data[i + 3] = 0;
      continue;
    }

    // 배경 에지: 밝고 채도 낮은 픽셀 페더
    if (min >= threshold - 28 && spread <= 28) {
      const t = (min - (threshold - 28)) / 28;
      png.data[i + 3] = Math.round(Math.min(png.data[i + 3], 255 * t * t));
    }
  }

  writeFileSync(outputPath, PNG.sync.write(png));
  console.log("Wrote", outputPath);
}

const src =
  process.argv[2] ||
  join(
    ROOT,
    "..",
    "..",
    "..",
    ".cursor",
    "projects",
    "c-Users-mooga-OneDrive-conversation-coach",
    "assets",
    "c__Users_mooga_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-7f6afc53-93e0-4a97-8391-741c003a1671.png"
  );

const outBoss = process.argv[3] || join(ROOT, "assets", "boss-back.png");
const outScalp = join(ROOT, "assets", "boss-scalp.png");
const scalpSrc = join(ROOT, "assets", "boss-scalp-src.png");

removeWhiteBg(src, outBoss);
try {
  removeWhiteBg(
    scalpSrc.includes("boss-scalp-src") && readFileSync(scalpSrc)
      ? scalpSrc
      : join(ROOT, "assets", "boss-scalp.png"),
    outScalp
  );
} catch {
  removeWhiteBg(join(ROOT, "assets", "boss-scalp.png"), outScalp);
}
