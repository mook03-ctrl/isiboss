window.QuizDash = {
  sound: true,
  playerName: "Player",
  handlers: {},
  on(name, fn) { this.handlers[name] = fn; },
  emit(name, data) {
    const fn = this.handlers[name];
    if (fn) fn(data);
  },
};

const RANK_KEY = "quizdash_rank_v1";
const NAME_KEY = "quizdash_player_name";
const SOUND_KEY = "quizdash_sound";
const BOARD_URL = "https://crudcrud.com/api/efc52c338c4d4a82b36c8a3100b124e9/quizdash/6ad627fdf4dd0003e8b3a339";

const $ = (id) => document.getElementById(id);

function cleanName(value) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 16);
}

function money(n) {
  return Number(n || 0).toLocaleString("ko-KR");
}

function day(ts) {
  try { return new Date(ts).toLocaleDateString("ko-KR"); }
  catch (err) { return ""; }
}

function normalize(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter((row) => row && typeof row.name === "string" && Number.isFinite(Number(row.score)))
    .map((row) => ({
      name: cleanName(row.name) || "Player",
      score: Math.floor(Number(row.score) || 0),
      chapter: Math.max(1, Math.floor(Number(row.chapter) || 1)),
      combo: Math.max(0, Math.floor(Number(row.combo) || 0)),
      ts: Number(row.ts) || 0,
    }))
    .filter((row) => {
      const key = row.name + "|" + row.score + "|" + row.ts;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score || b.ts - a.ts)
    .slice(0, 10);
}

function readLocal() {
  try { return normalize(JSON.parse(localStorage.getItem(RANK_KEY) || "[]")); }
  catch (err) { return []; }
}

function writeLocal(list) {
  try { localStorage.setItem(RANK_KEY, JSON.stringify(normalize(list))); }
  catch (err) { /* private mode */ }
}

function mergeRanks(a, b) {
  return normalize(a.concat(b));
}

let ranks = readLocal();
let offline = false;
let playing = false;
let over = false;
let game = null;

async function pullRanks() {
  const response = await fetch(BOARD_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("rank");
  const doc = await response.json();
  const remote = normalize(doc && doc.scores);
  ranks = mergeRanks(remote, readLocal());
  writeLocal(ranks);
  offline = false;
  return ranks;
}

async function pushRanks(list) {
  const response = await fetch(BOARD_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "QUIZDASH_BOARD", scores: normalize(list) }),
  });
  if (!response.ok) throw new Error("save");
}

async function refreshRanks() {
  try {
    await pullRanks();
  } catch (err) {
    offline = true;
    ranks = readLocal();
  }
  paintRanks();
}

async function submitRank(entry) {
  if (!entry || entry.score <= 0) return { list: ranks, kept: false, offline: false };
  ranks = mergeRanks(readLocal(), [entry]);
  writeLocal(ranks);
  paintRanks();
  try {
    const remote = await pullRanks();
    ranks = mergeRanks(remote, [entry]);
    writeLocal(ranks);
    await pushRanks(ranks);
    offline = false;
  } catch (err) {
    try {
      await pushRanks(mergeRanks(readLocal(), [entry]));
      ranks = mergeRanks(readLocal(), [entry]);
      offline = false;
    } catch (again) {
      offline = true;
      ranks = mergeRanks(readLocal(), [entry]);
      writeLocal(ranks);
    }
  }
  paintRanks();
  const kept = ranks.some((row) => row.ts === entry.ts && row.score === entry.score);
  return { list: ranks, kept, offline };
}

function paintRanks() {
  const note = $("rank-note");
  note.textContent = offline ? "오프라인 · 이 기기의 TOP 10" : "공용 TOP 10 · 이 기기 기록과 합산";
  const best = ranks[0] ? ranks[0].score : 0;
  $("best-line").textContent = "BEST  " + money(best);
  const preview = $("preview-list");
  preview.replaceChildren();
  if (!ranks.length) {
    const li = document.createElement("li");
    li.textContent = "아직 기록이 없습니다";
    preview.appendChild(li);
  } else {
    ranks.slice(0, 5).forEach((row, index) => {
      const li = document.createElement("li");
      li.textContent = (index + 1) + ".  " + row.name + "  ·  " + money(row.score);
      preview.appendChild(li);
    });
  }
  const body = $("rank-body");
  body.replaceChildren();
  for (let i = 0; i < 10; i += 1) {
    const row = ranks[i];
    const tr = document.createElement("tr");
    if (row && window.QuizDash.latest && row.ts === window.QuizDash.latest.ts) tr.classList.add("me");
    const cells = [
      String(i + 1),
      row ? row.name : "—",
      row ? money(row.score) : "—",
      row ? "CH " + row.chapter : "—",
      row ? "x" + row.combo : "—",
      row ? day(row.ts) : "—",
    ];
    cells.forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
}

function setPause(reason, on) {
  if (!game || !game.scene.isActive("game")) return;
  const scene = game.scene.getScene("game");
  if (!scene.pauseReasons) scene.pauseReasons = new Set();
  if (on) scene.pauseReasons.add(reason);
  else scene.pauseReasons.delete(reason);
  const paused = scene.pauseReasons.size > 0;
  scene.paused = paused;
  if (scene.physics) {
    if (paused) scene.physics.pause();
    else scene.physics.resume();
  }
}

function openRank() {
  if (playing && !over) setPause("rank", true);
  $("screen-rank").classList.remove("hidden");
  paintRanks();
  refreshRanks();
}

function closeRank() {
  $("screen-rank").classList.add("hidden");
  setPause("rank", false);
}

function showStart() {
  playing = false;
  over = false;
  $("screen-start").classList.remove("hidden");
  $("screen-over").classList.add("hidden");
  $("hud").classList.add("hidden");
  $("chapter-card").classList.add("hidden");
  $("screen-rank").classList.add("hidden");
  if (game && game.scene.isActive("game")) game.scene.stop("game");
  if (game && !game.scene.isActive("menu")) game.scene.start("menu");
  refreshRanks();
}

function startRun() {
  const typed = cleanName($("player-name").value);
  window.QuizDash.playerName = typed || "Player";
  $("player-name").value = window.QuizDash.playerName;
  try { localStorage.setItem(NAME_KEY, window.QuizDash.playerName); } catch (err) { /* ignore */ }
  if (window.QuizDashSfx) window.QuizDashSfx.ensure();
  playing = true;
  over = false;
  window.QuizDash.latest = null;
  $("screen-start").classList.add("hidden");
  $("screen-over").classList.add("hidden");
  $("screen-rank").classList.add("hidden");
  $("hud").classList.remove("hidden");
  $("hud-name").textContent = window.QuizDash.playerName;
  if (game.scene.isActive("game")) game.scene.stop("game");
  if (game.scene.isActive("menu")) game.scene.stop("menu");
  game.scene.start("game");
}

function paintHud(data) {
  $("hud-score").textContent = money(data.score);
  $("hud-mult").textContent = "x" + data.multiplier;
  $("hud-chapter").textContent = "CH " + data.chapter + " · " + data.subject + " · " + data.gate + "/5";
  $("hud-name").textContent = data.name;
  $("hud-combo").textContent = data.combo > 0 ? "COMBO x" + data.combo : "";
}

function showStatus(data) {
  const banner = $("status-banner");
  banner.classList.remove("hidden", "good", "bad");
  if (data.flow === "right") {
    banner.classList.add("good");
    banner.textContent = "CORRECT  ·  SMOOTH x2  ·  COMBO " + data.combo;
  } else if (data.flow === "wrong") {
    banner.classList.add("bad");
    banner.textContent = "WRONG PATH  ·  SURVIVE";
  } else {
    banner.classList.add("hidden");
  }
}

function showChapter(meta) {
  const card = $("chapter-card");
  $("ch-kicker").textContent = meta.intro ? "READY" : "CHAPTER CLEAR";
  $("ch-title").textContent = "CHAPTER " + meta.chapter;
  $("ch-sub").textContent = meta.subjectEn + " · " + meta.subject;
  card.classList.remove("hidden");
  clearTimeout(showChapter.timer);
  showChapter.timer = setTimeout(() => card.classList.add("hidden"), meta.intro ? 1400 : 1800);
}

function showQuestion(q) {
  $("q-card").classList.remove("hidden");
  $("q-prompt").textContent = q.prompt;
  $("q-a").textContent = q.A;
  $("q-b").textContent = q.B;
  $("status-banner").classList.add("hidden");
}

async function showOver(entry) {
  over = true;
  playing = false;
  window.QuizDash.latest = entry;
  $("over-name").textContent = entry.name;
  $("over-score").textContent = money(entry.score);
  $("over-meta").textContent = "CHAPTER " + entry.chapter + " · " + entry.subject + "  ·  COMBO x" + entry.combo;
  $("screen-over").classList.remove("hidden");
  $("q-card").classList.add("hidden");
  $("status-banner").classList.add("hidden");
  const result = await submitRank(entry);
  const place = result.list.findIndex((row) => row.ts === entry.ts && row.score === entry.score);
  $("over-rank").textContent = entry.score <= 0
    ? "점수를 내면 랭킹에 오릅니다"
    : place >= 0
      ? "랭킹 " + (place + 1) + "위"
      : "TOP 10 밖입니다";
  if (result.offline) $("over-rank").textContent += " · 오프라인 저장";
}

function boot() {
  try {
    const saved = cleanName(localStorage.getItem(NAME_KEY) || "");
    if (saved) $("player-name").value = saved;
    if (localStorage.getItem(SOUND_KEY) === "0") window.QuizDash.sound = false;
  } catch (err) { /* ignore */ }
  $("btn-sound").textContent = window.QuizDash.sound ? "🔊" : "🔇";
  paintRanks();
  refreshRanks();

  if (!window.Phaser) {
    $("boot-error").classList.remove("hidden");
    return;
  }

  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "game-root",
    width: 720,
    height: 960,
    backgroundColor: "#07041a",
    physics: { default: "arcade", arcade: { gravity: { y: 2800 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60, smoothStep: true },
    audio: { noAudio: true },
    render: { antialias: true, powerPreference: "high-performance" },
    scene: [window.BootScene, window.MenuScene, window.GameScene],
    input: { activePointers: 2 },
    banner: false,
  });
  window.QuizDash.game = game;

  QuizDash.on("hud", paintHud);
  QuizDash.on("question", showQuestion);
  QuizDash.on("question-hide", () => $("q-card").classList.add("hidden"));
  QuizDash.on("status", showStatus);
  QuizDash.on("chapter", showChapter);
  QuizDash.on("hint", (on) => $("hint").classList.toggle("hidden", !on));
  QuizDash.on("over", showOver);

  $("start-form").addEventListener("submit", (event) => {
    event.preventDefault();
    startRun();
  });
  $("btn-rank").addEventListener("click", openRank);
  $("btn-hud-rank").addEventListener("click", openRank);
  $("over-rank-btn").addEventListener("click", openRank);
  $("rank-close").addEventListener("click", closeRank);
  $("screen-rank").addEventListener("click", (event) => {
    if (event.target === $("screen-rank")) closeRank();
  });
  $("btn-back").addEventListener("click", showStart);
  $("over-title").addEventListener("click", showStart);
  $("over-retry").addEventListener("click", startRun);
  $("btn-sound").addEventListener("click", () => {
    window.QuizDash.sound = !window.QuizDash.sound;
    $("btn-sound").textContent = window.QuizDash.sound ? "🔊" : "🔇";
    try { localStorage.setItem(SOUND_KEY, window.QuizDash.sound ? "1" : "0"); } catch (err) { /* ignore */ }
    if (window.QuizDash.sound && window.QuizDashSfx) window.QuizDashSfx.ensure();
  });
  document.addEventListener("visibilitychange", () => {
    if (!playing || over) return;
    setPause("hidden", document.hidden);
  });
}

boot();
