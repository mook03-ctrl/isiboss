'use strict';

const CONFIG = {
  ch1Zombies: 20,
  ch1Poops: 10,
  ch2Demons: 10,
  ch5Zombies: 6,
  ch5Winged: 4,
  ch5Awakens: 2,
  awakenDuration: 8,
  energyMax: 100,
};

const ENERGY_KILL = { zombie: 14, demon: 18, winged: 20, tank: 32, tentacle: 32 };

const INTRO = {
  1: { k: 'CHAPTER 1', t: '똥 바위 산', stars: 1, d: '좀비 20마리를 물리치고\n똥을 10개 캐내 에너지 레벨업!' },
  2: { k: 'CHAPTER 2', t: '붉은 칼의 습격', stars: 2, d: '뿔 달린 빨간 얼굴들이 몰려온다.\n오는 적을 모두 쓰러뜨려라!' },
  3: { k: 'CHAPTER 3', t: '로켓맨', stars: 3, d: '탱크에서 로켓이 날아온다.\n점프로 피하고 로켓맨을 쓰러뜨려라!' },
  4: { k: 'CHAPTER 4', t: '촉수동물', stars: 4, d: '거대한 촉수동물이 나타났다.\n채찍을 피하고 쓰러뜨려라!' },
  5: { k: 'CHAPTER 5', t: 'Awakening!', stars: 5, d: 'All-Out War!\n날개 악마, 촉수, 로켓맨, 좀비가 모두 나온다.\n각성을 두 번 해야 이길 수 있다!' },
};

const HINTS = {
  1: '← → 이동   점프   공격\n똥 바위 옆에서 채굴!',
  2: '칼 악마는 휘두르기 전에 물러서거나 먼저 쳐!',
  3: '낮은 로켓은 점프, 높은 로켓은 바닥에서 피해!',
  4: '빨간 채찍은 위험! 높으면 숙이고, 낮으면 점프!',
  5: '게이지가 차면 자동 각성. 두 번 각성해야 보스를 끝낼 수 있어!',
};

const HERO_INFO = [
  { id: 'stickman', name: 'Stickman', lines: ['무기: 칼 싸움', '각성: 다이아 칼 + 불꽃 칼', '파워 2배'] },
  { id: 'jaden', name: 'Jaden', lines: ['빨간 후드, 똥 투척', '적중: 사요나라 보쿠노 바이바이!', '각성: 로켓 똥'] },
  { id: 'noob', name: 'Noob', lines: ['무기: 도넛 투척', '도넛 3개를 먹으면 천사 화살', '순진하지만 강하다'] },
  { id: 'yuri', name: 'Yuri', lines: ['빨간 머리, 모두의 친구', '응원으로 적을 밀어낸다', '처치할 때마다 함께 기뻐함'] },
];

const HEROES = {
  stickman: { hp: 120, speed: 185 },
  jaden: { hp: 110, speed: 178 },
  noob: { hp: 100, speed: 168 },
  yuri: { hp: 110, speed: 180 },
};

const CHEERS = ['좋아!', '이겼다!', '최고야!', '잘했어!'];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

let W = 390;
let H = 780;
let dpr = 1;
let time = 0;
let last = 0;

const input = {
  left: false, right: false, jump: false, jumpPrev: false, attack: false, skillHold: false,
};

const S = {
  screen: 'title',
  heroId: null,
  chapter: 1,
  level: 1,
  energy: 0,
  awakenCount: 0,
  sealBroken: false,
  poop: 0,
  kills: {},
  spawned: {},
  introT: 0,
  hintT: 0,
  banner: null,
  shoutT: 0,
  shoutCd: 0,
  flash: 0,
  flashColor: '#fff',
  shake: 0,
  clearLock: false,
  pendingClear: null,
  muted: false,
  spawnT: 0,
  levelPop: 0,
};

let player = null;
let enemies = [];
let projectiles = [];
let particles = [];
let floats = [];
let rocks = [];
let angels = [];
let booms = [];
let yuriNpc = null;
let uid = 1;
let audioCtx = null;

function gy() {
  if (S.screen === 'title') return H * 0.7;
  if (S.screen === 'select') return H * 0.9;
  return H - chromeH() - 18;
}

function chromeH() {
  if (S.screen === 'title' || S.screen === 'select') return 0;
  return H < 560 ? 86 : 116;
}

function safeTop() {
  const el = document.getElementById('sat-probe');
  return el ? el.offsetHeight : 0;
}

function maxHp() {
  return HEROES[S.heroId].hp + (S.level - 1) * 8;
}

function dmgOf(base) {
  const d = base + (S.level - 1);
  return Math.max(1, Math.round(player && player.awakened ? d * 2 : d));
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function rand(a, b) { return a + Math.random() * (b - a); }

function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function aliveCount(kind) {
  let n = 0;
  for (const e of enemies) if (!e.dead && (!kind || e.kind === kind)) n++;
  return n;
}

function nearestEnemy() {
  let best = null;
  let bestD = 1e9;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.abs(e.x - player.x) + Math.abs(e.y - player.y) * 0.4;
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

function enemyRect(e) {
  if (e.kind === 'tank') return { x: e.x - 86, y: e.y - 82, w: 168, h: 82 };
  if (e.kind === 'tentacle') return { x: e.x - 46, y: e.y - 176, w: 110, h: 176 };
  const h = e.h || 72;
  return { x: e.x - 20, y: e.y - h, w: 42, h };
}

function playerRect() {
  return { x: player.x - 16, y: player.y - 80, w: 32, h: 80 };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRect(cx, cy, r, rect) {
  const x = clamp(cx, rect.x, rect.x + rect.w);
  const y = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - x;
  const dy = cy - y;
  return dx * dx + dy * dy <= r * r;
}

function resize() {
  const app = document.getElementById('app');
  const r = app.getBoundingClientRect();
  W = Math.max(280, r.width);
  H = Math.max(320, r.height);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
}

function setScreen(name) {
  S.screen = name;
  const names = ['title', 'select', 'intro', 'clear', 'dead', 'win', 'pause'];
  for (const n of names) {
    document.getElementById('screen-' + n).classList.toggle('hidden', name !== n);
  }
  document.getElementById('controls').classList.toggle('hidden', name !== 'play');
  document.getElementById('btn-pause').classList.toggle('hidden', name !== 'play');
  if (name !== 'play') {
    input.left = input.right = input.jump = input.attack = input.skillHold = false;
  }
  syncButtons();
}

function syncButtons() {
  const mine = document.getElementById('btn-mine');
  const showMine = S.screen === 'play' && S.chapter === 1 && S.poop < CONFIG.ch1Poops;
  mine.classList.toggle('hidden', !showMine);
  const skill = document.getElementById('btn-skill');
    skill.textContent = skillLabel();
    skill.setAttribute('aria-label', skill.textContent);
  if (player && S.screen === 'play') {
    document.getElementById('btn-attack').classList.toggle('hot', !!player.awakened);
    mine.classList.toggle('ready', !!nearestRock());
    skill.classList.toggle('cooldown', player.skillCd > 0.05 && S.heroId !== 'noob');
  }
}

function skillLabel() {
  const map = { stickman: '강베기', jaden: '연사', noob: '먹기', yuri: '응원' };
  return map[S.heroId] || '기술';
}

function ensureAudio() {
  if (S.muted) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type, vol, slide) {
  const ac = ensureAudio();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + dur + 0.02);
}

function sfx(name) {
  if (name === 'ui') tone(660, 0.06, 'square', 0.04);
  else if (name === 'swing') tone(520, 0.07, 'square', 0.04, 220);
  else if (name === 'hit') tone(180, 0.08, 'triangle', 0.05, 90);
  else if (name === 'hurt') tone(90, 0.16, 'sawtooth', 0.05, 50);
  else if (name === 'mine') tone(140, 0.1, 'square', 0.05, 80);
  else if (name === 'eat') tone(700, 0.08, 'sine', 0.05, 400);
  else if (name === 'shout') tone(620, 0.22, 'square', 0.05, 180);
  else if (name === 'ko') tone(240, 0.12, 'triangle', 0.05, 80);
  else if (name === 'awaken') {
    tone(523, 0.12, 'square', 0.05);
    setTimeout(() => tone(659, 0.12, 'square', 0.05), 90);
    setTimeout(() => tone(784, 0.18, 'square', 0.05), 180);
  } else if (name === 'win') {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'square', 0.05), i * 120));
  }
}

function buzz(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function floatText(x, y, text, color) {
  floats.push({ x, y, text, color: color || '#fff', life: 0.85, age: 0 });
  if (floats.length > 28) floats.shift();
}

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 80) * (0.35 + Math.random());
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 20,
      life: 0.35 + Math.random() * 0.4,
      age: 0,
      color,
      r: 2 + Math.random() * 3,
    });
  }
  if (particles.length > 180) particles.splice(0, particles.length - 180);
}

function boom(x, y, color, r) {
  booms.push({ x, y, r: r || 18, life: 0.38, age: 0, color: color || '#ffb703' });
}

function banner(text, t) {
  S.banner = { text, t: t || 1.15 };
}

function buildCards() {
  const grid = document.getElementById('cards');
  grid.innerHTML = '';
  for (const h of HERO_INFO) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.id = h.id;
    b.innerHTML = '<strong>' + h.name + '</strong>' + h.lines.map((l) => '<span>' + l + '</span>').join('');
    b.addEventListener('click', () => {
      S.heroId = h.id;
      for (const c of document.querySelectorAll('.card')) c.classList.toggle('selected', c.dataset.id === h.id);
      document.getElementById('btn-next').disabled = false;
      sfx('ui');
    });
    grid.appendChild(b);
  }
}

function fillIntro() {
  const info = INTRO[S.chapter];
  document.getElementById('intro-k').textContent = info.k;
  document.getElementById('intro-t').textContent = info.t;
  document.getElementById('intro-d').textContent = info.d;
  document.getElementById('intro-stars').textContent = '★'.repeat(info.stars) + '☆'.repeat(5 - info.stars);
}

function resetWorld() {
  enemies = [];
  projectiles = [];
  particles = [];
  floats = [];
  rocks = [];
  angels = [];
  booms = [];
  yuriNpc = null;
  S.kills = { zombie: 0, demon: 0, winged: 0, tank: 0, tentacle: 0 };
  S.spawned = { zombie: 0, demon: 0, winged: 0, tank: 0, tentacle: 0 };
  S.energy = 0;
  S.awakenCount = 0;
  S.sealBroken = false;
  S.poop = 0;
  S.clearLock = false;
  S.pendingClear = null;
  S.banner = null;
  S.shoutT = 0;
  S.shoutCd = 0;
  S.spawnT = 0.35;
}

function setupPlayer() {
  player = {
    x: Math.min(130, W * 0.32),
    y: gy(),
    vy: 0,
    facing: 1,
    onGround: true,
    atkT: 0,
    atkDur: 0.32,
    atkCd: 0,
    didHit: false,
    skillSwing: false,
    skillCd: 0,
    mineT: 0,
    mineRock: null,
    eatT: 0,
    donuts: 0,
    cheerT: 0,
    awakened: false,
    awakenT: 0,
    banked: 0,
    iframes: 0,
    hurtT: 0,
    kx: 0,
  };
  player.hp = maxHp();
}

function makeEnemy(kind, x) {
  const table = {
    1: { zombie: { hp: 24, dmg: 6, speed: 34, h: 70 } },
    2: { demon: { hp: 58, dmg: 12, speed: 74, h: 76 } },
    3: { tank: { hp: 340, dmg: 15, speed: 30, h: 82 } },
    4: { tentacle: { hp: 460, dmg: 16, speed: 0, h: 170 } },
    5: {
      zombie: { hp: 42, dmg: 11, speed: 60, h: 70 },
      winged: { hp: 78, dmg: 14, speed: 88, h: 74 },
      tank: { hp: 680, dmg: 16, speed: 24, h: 82 },
      tentacle: { hp: 820, dmg: 18, speed: 0, h: 176 },
    },
  };
  const st = table[S.chapter][kind];
  return {
    id: ++uid,
    kind,
    x,
    y: gy(),
    hp: st.hp,
    maxHp: st.hp,
    dmg: st.dmg,
    speed: st.speed,
    h: st.h,
    facing: -1,
    dead: false,
    deathT: 0,
    hurtT: 0,
    kx: 0,
    atkCd: 0.7,
    windup: 0,
    whipT: 1.1,
    whipping: 0,
    whipHigh: false,
    warn: 0,
    warnHigh: false,
    shootT: 1.5,
    rise: 1,
    phase: Math.random() * 6,
    diving: 0,
    diveT: 1.2 + Math.random(),
    tx: x,
    boss: kind === 'tank' || kind === 'tentacle',
  };
}

function spawnEnemy(kind, x) {
  const e = makeEnemy(kind, x);
  if (kind === 'tank') {
    e.tx = W - 78;
    e.x = e.tx;
    e.speed = 0;
  }
  if (kind === 'tentacle') {
    e.x = W * (S.chapter === 5 ? 0.68 : 0.76);
    e.tx = e.x;
  }
  enemies.push(e);
  S.spawned[kind] = (S.spawned[kind] || 0) + 1;
  return e;
}

function setupSpawns() {
  if (S.chapter === 1) {
    rocks = [
      { x: W * 0.48, alive: true, respawn: null },
      { x: W * 0.78, alive: true, respawn: null },
    ];
    spawnEnemy('zombie', W + 20);
  } else if (S.chapter === 2) {
    spawnEnemy('demon', W + 10);
  } else if (S.chapter === 3) {
    spawnEnemy('tank', W + 160);
  } else if (S.chapter === 4) {
    spawnEnemy('tentacle', W * 0.76);
  } else if (S.chapter === 5) {
    spawnEnemy('tentacle', W * 0.68);
    spawnEnemy('tank', W + 120);
    spawnEnemy('winged', W * 0.8);
    spawnEnemy('winged', -20);
    spawnEnemy('zombie', W + 30);
    spawnEnemy('zombie', -10);
  }
}

function startChapter(n) {
  S.chapter = n;
  S.screen = 'intro';
  resetWorld();
  setupPlayer();
  setupSpawns();
  fillIntro();
  S.introT = 2.15;
  S.hintT = 6.5;
  S.grace = 2.4;
  setScreen('intro');
  ensureAudio();
}

function skipIntro() {
  if (S.screen !== 'intro') return;
  setScreen('play');
  last = performance.now();
}

function openPause() {
  if (S.screen !== 'play') return;
  setScreen('pause');
}

function resume() {
  setScreen('play');
  last = performance.now();
}

function addEnergy(n) {
  if (!player || n <= 0 || S.clearLock) return;
  if (player.awakened) {
    player.banked = Math.min(CONFIG.energyMax, player.banked + n);
    return;
  }
  S.energy += n;
  if (S.energy >= CONFIG.energyMax) {
    const extra = S.energy - CONFIG.energyMax;
    S.energy = 0;
    tryAwaken();
    player.banked = Math.min(CONFIG.energyMax, player.banked + extra);
  }
}

function tryAwaken() {
  if (!player || player.awakened) return;
  player.awakened = true;
  player.awakenT = CONFIG.awakenDuration;
  S.awakenCount += 1;
  const second = S.chapter === 5 && S.awakenCount >= CONFIG.ch5Awakens;
  if (second) S.sealBroken = true;
  banner(second ? '두 번째 각성! 봉인 해제!' : '각성!', 1.35);
  S.flash = 0.32;
  S.flashColor = second ? '#fff3a0' : '#8ee7ff';
  S.shake = 12;
  burst(player.x, player.y - 50, '#7ad7ff', 22, 140);
  burst(player.x, player.y - 40, '#fff', 8, 80);
  sfx('awaken');
  buzz(28);
}

function endAwaken() {
  player.awakened = false;
  player.awakenT = 0;
  if (player.banked > 0) {
    const b = player.banked;
    player.banked = 0;
    addEnergy(b);
  }
}

function doShout() {
  if (S.shoutCd > 0) {
    S.shoutT = Math.max(S.shoutT, 0.45);
    return;
  }
  S.shoutT = 1.2;
  S.shoutCd = 1.35;
  sfx('shout');
}

function firePoop(rocket, vyBias) {
  projectiles.push({
    owner: 'player',
    kind: rocket ? 'rocketpoop' : 'poop',
    x: player.x + player.facing * 22,
    y: player.y - 48,
    vx: player.facing * (rocket ? 360 : 270),
    vy: (rocket ? -20 : -70) + (vyBias || 0),
    grav: rocket ? 40 : 460,
    r: rocket ? 16 : 11,
    dmg: rocket ? 18 : 11,
    life: 2.2,
    shout: true,
    aoe: rocket ? 70 : 0,
  });
}

function fireDonut() {
  projectiles.push({
    owner: 'player',
    kind: 'donut',
    x: player.x + player.facing * 18,
    y: player.y - 42,
    vx: player.facing * 250,
    vy: -150,
    grav: 520,
    r: 11,
    dmg: 9,
    life: 2,
  });
}

function fireHeart() {
  projectiles.push({
    owner: 'player',
    kind: 'heart',
    x: player.x + player.facing * 16,
    y: player.y - 50,
    vx: player.facing * 300,
    vy: -16,
    grav: 0,
    r: 13,
    dmg: 12,
    life: 1.3,
  });
}

function summonAngels(n) {
  const dmg = dmgOf(player.awakened ? 12 : 9);
  for (let i = 0; i < n; i++) {
    angels.push({
      x: -40 - i * 28,
      y: safeTop() + 118 + (i % 3) * 34,
      vx: 150 + (i % 3) * 16,
      shot: 0.25 + i * 0.16,
      life: 5.2,
      dmg,
    });
  }
  banner(player.awakened ? '천사 군단!' : '천사 출격!', 1.15);
  sfx('awaken');
}

function novaHearts() {
  const reach = player.awakened ? 9999 : 168;
  const yReach = player.awakened ? 999 : 130;
  for (const e of enemies) {
    if (e.dead) continue;
    if (Math.abs(e.x - player.x) < reach && Math.abs(e.y - player.y) < yReach) {
      hurtEnemy(e, player.awakened ? 16 : 10);
    }
  }
  player.hp = Math.min(maxHp(), player.hp + (player.awakened ? 16 : 8));
  player.cheerT = 0.9;
  burst(player.x, player.y - 50, '#ff6b93', 16, 120);
  banner(player.awakened ? '메가 응원!' : '응원!', 0.9);
  sfx('ui');
}

function doAttack() {
  if (S.screen !== 'play' || !player) return;
  if (player.atkCd > 0 || player.mineT > 0) return;
  const awakened = player.awakened;
  player.atkCd = awakened ? 0.28 : 0.42;
  player.atkDur = awakened ? 0.24 : 0.3;
  player.atkT = player.atkDur;
  player.didHit = false;
  player.skillSwing = false;
  if (S.heroId === 'jaden') firePoop(awakened, 0);
  else if (S.heroId === 'noob') fireDonut();
  else if (S.heroId === 'yuri') fireHeart();
  sfx('swing');
}

function doSkill() {
  if (S.screen !== 'play' || !player) return;
  if (player.mineT > 0) return;
  if (S.heroId === 'noob') {
    if (player.eatT > 0) return;
    player.eatT = 0.34;
    player.donuts += 1;
    sfx('eat');
    burst(player.x, player.y - 60, '#ffb6d5', 6, 40);
    if (player.donuts >= 3) {
      player.donuts = 0;
      summonAngels(player.awakened ? 9 : 6);
    }
    return;
  }
  if (player.skillCd > 0) return;
  if (S.heroId === 'stickman') {
    player.skillCd = player.awakened ? 0.85 : 1.15;
    player.atkDur = 0.34;
    player.atkT = 0.34;
    player.didHit = false;
    player.skillSwing = true;
    sfx('swing');
  } else if (S.heroId === 'jaden') {
    player.skillCd = player.awakened ? 0.95 : 1.25;
    firePoop(player.awakened, -90);
    firePoop(player.awakened, 0);
    firePoop(player.awakened, 90);
    sfx('swing');
  } else if (S.heroId === 'yuri') {
    player.skillCd = player.awakened ? 2.1 : 1.45;
    novaHearts();
  }
}

function nearestRock() {
  if (!player || S.chapter !== 1) return null;
  let best = null;
  let bestD = 62;
  for (const r of rocks) {
    if (!r.alive) continue;
    const d = Math.abs(r.x - player.x);
    if (d < bestD) { best = r; bestD = d; }
  }
  return best;
}

function randomRockX() {
  for (let i = 0; i < 8; i++) {
    const x = rand(70, W - 70);
    if (player && Math.abs(x - player.x) < 80) continue;
    let ok = true;
    for (const r of rocks) if (r.alive && Math.abs(r.x - x) < 70) ok = false;
    if (ok) return x;
  }
  return rand(80, W - 80);
}

function startMine(rock) {
  if (S.screen !== 'play' || !player || S.chapter !== 1 || S.poop >= CONFIG.ch1Poops) return;
  const r = rock || nearestRock();
  if (!r) {
    floatText(player.x, player.y - 96, '똥 바위로!', '#ffe14a');
    return;
  }
  if (player.mineT > 0) return;
  player.mineT = 0.85;
  player.mineRock = r;
  player.facing = r.x >= player.x ? 1 : -1;
}

function completeMine(rock) {
  rock.alive = false;
  rock.respawn = 0.5;
  S.poop += 1;
  S.level += 1;
  S.levelPop = 0.45;
  player.hp = Math.min(maxHp(), player.hp + 14);
  addEnergy(10);
  floatText(rock.x, gy() - 78, 'LEVEL UP!', '#ffe14a');
  burst(rock.x, gy() - 24, '#8a5a2a', 14, 90);
  sfx('mine');
  buzz(12);
  checkClear();
}

function sealed(e) {
  return S.chapter === 5 && !S.sealBroken && (e.kind === 'tank' || e.kind === 'tentacle');
}

function hurtEnemy(e, base, o) {
  if (!e || e.dead) return;
  o = o || {};
  const amount = o.raw ? base : dmgOf(base);
  if (sealed(e) && e.hp - amount <= 0) {
    if (e.hp > 1) e.hp = 1;
    e.hurtT = 0.16;
    floatText(e.x, e.y - (e.h || 80) - 8, S.awakenCount === 0 ? '각성 봉인!' : '각성 한 번 더!', '#8ee7ff');
    if (o.shout && S.heroId === 'jaden') doShout();
    addEnergy(2);
    return;
  }
  e.hp -= amount;
  e.hurtT = 0.12;
  e.kx = (player ? player.facing : 1) * (e.boss ? 40 : 160);
  floatText(e.x + rand(-8, 8), e.y - (e.h || 70) - 6, '-' + amount, '#fff');
  addEnergy(Math.max(1, Math.round(amount * (e.boss ? 0.1 : 0.04))));
  burst(e.x, e.y - 36, '#ffe14a', 5, 70);
  if (o.shout && S.heroId === 'jaden') doShout();
  S.shake = Math.max(S.shake, e.boss ? 5 : 3);
  if (e.hp <= 0) finishEnemy(e);
  else sfx('hit');
}

function finishEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  e.deathT = 0.32;
  e.hp = 0;
  S.kills[e.kind] = (S.kills[e.kind] || 0) + 1;
  addEnergy(ENERGY_KILL[e.kind] || 14);
  floatText(e.x, e.y - 96, 'ENERGY +' + (ENERGY_KILL[e.kind] || 14), '#7ee0ff');
  boom(e.x, e.y - 40, e.boss ? '#ff5a3c' : '#ffb703', e.boss ? 46 : 24);
  burst(e.x, e.y - 30, '#fff', 10, 110);
  sfx('ko');
  buzz(16);
  if (player) {
    player.hp = Math.min(maxHp(), player.hp + 6);
    if (S.heroId === 'yuri') player.cheerT = 1;
    else showYuri();
  }
  if (e.boss) banner(e.kind === 'tank' ? '로켓맨 격파!' : '촉수 격파!', 1.1);
  checkClear();
}

function showYuri() {
  if (!player) return;
  const side = player.x < W * 0.55 ? 1 : -1;
  yuriNpc = {
    t: 1.25,
    x: clamp(player.x + side * 58, 40, W - 40),
    phrase: pick(CHEERS),
  };
}

function hurtPlayer(dmg) {
  if (!player || player.iframes > 0 || S.grace > 0 || S.clearLock || S.pendingClear != null) return;
  if (S.screen !== 'play') return;
  const hit = player.awakened ? Math.max(1, Math.round(dmg * 0.75)) : dmg;
  player.hp -= hit;
  player.iframes = 0.72;
  player.hurtT = 0.22;
  player.kx = -player.facing * 80;
  floatText(player.x, player.y - 100, '-' + hit, '#ff5a6a');
  S.shake = 8;
  S.flash = 0.18;
  S.flashColor = '#ff5a6a';
  sfx('hurt');
  buzz(20);
  if (player.mineT > 0) {
    player.mineT = 0;
    floatText(player.x, player.y - 120, '채굴 방해!', '#ffb703');
  }
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = true;
    boom(player.x, player.y - 40, '#888', 30);
    setScreen('dead');
  }
}

function checkClear() {
  if (S.clearLock || S.screen !== 'play') return;
  const k = S.kills;
  let ok = false;
  if (S.chapter === 1) ok = k.zombie >= CONFIG.ch1Zombies && S.poop >= CONFIG.ch1Poops;
  else if (S.chapter === 2) ok = k.demon >= CONFIG.ch2Demons;
  else if (S.chapter === 3) ok = k.tank >= 1;
  else if (S.chapter === 4) ok = k.tentacle >= 1;
  else if (S.chapter === 5) {
    ok = S.sealBroken && k.tank >= 1 && k.tentacle >= 1 && k.winged >= CONFIG.ch5Winged && k.zombie >= CONFIG.ch5Zombies;
  }
  if (!ok) return;
  S.clearLock = true;
  S.pendingClear = 0.75;
}

function wantMore(kind) {
  if (S.clearLock) return false;
  const spawned = S.spawned[kind] || 0;
  const kills = S.kills[kind] || 0;
  if (S.chapter === 1 && kind === 'zombie') return spawned < CONFIG.ch1Zombies;
  if (S.chapter === 2 && kind === 'demon') return spawned < CONFIG.ch2Demons;
  if (S.chapter === 5 && kind === 'zombie') {
    if (kills < CONFIG.ch5Zombies) return true;
    return S.awakenCount < CONFIG.ch5Awakens && spawned < 22;
  }
  if (S.chapter === 5 && kind === 'winged') {
    if (kills < CONFIG.ch5Winged) return true;
    return S.awakenCount < CONFIG.ch5Awakens && spawned < 14;
  }
  return false;
}

function updateSpawns(dt) {
  S.spawnT -= dt;
  if (S.spawnT > 0) return;
  if (S.chapter === 1 && wantMore('zombie') && aliveCount('zombie') < 2) {
    spawnEnemy('zombie', Math.random() < 0.5 ? -30 : W + 30);
    S.spawnT = 1.15;
  } else if (S.chapter === 2 && wantMore('demon') && aliveCount('demon') < 3) {
    spawnEnemy('demon', Math.random() < 0.75 ? W + 24 : -24);
    S.spawnT = 1.25;
  } else if (S.chapter === 5) {
    if (wantMore('zombie') && aliveCount('zombie') < 3) {
      spawnEnemy('zombie', Math.random() < 0.5 ? -30 : W + 30);
      S.spawnT = 1.05;
    } else if (wantMore('winged') && aliveCount('winged') < 2) {
      spawnEnemy('winged', Math.random() < 0.5 ? -20 : W + 20);
      S.spawnT = 1.35;
    } else S.spawnT = 0.4;
  } else S.spawnT = 0.4;
}

function updateRocks(dt) {
  if (S.chapter !== 1) return;
  for (const r of rocks) {
    if (!r.alive && r.respawn != null) {
      r.respawn -= dt;
      if (r.respawn <= 0 && S.poop < CONFIG.ch1Poops) {
        r.alive = true;
        r.x = randomRockX();
        r.respawn = null;
      }
    }
  }
}

function resolveMelee() {
  const range = player.skillSwing ? 100 : 76;
  const rect = {
    x: player.skillSwing ? player.x - range : (player.facing > 0 ? player.x - 8 : player.x - range),
    y: player.y - 86,
    w: player.skillSwing ? range * 2 : range,
    h: 86,
  };
  const base = player.skillSwing ? 22 : 15;
  for (const e of enemies) {
    if (e.dead) continue;
    if (rectsOverlap(rect, enemyRect(e))) hurtEnemy(e, base);
  }
  if (player.skillSwing && player.awakened) {
    burst(player.x + player.facing * 40, player.y - 48, '#7ef0ff', 8, 90);
    burst(player.x + player.facing * 24, player.y - 36, '#ff9a2a', 8, 90);
  }
}

function updateAttack(dt) {
  if (player.atkT <= 0) return;
  const prev = player.atkT;
  player.atkT -= dt;
  const trigger = player.atkDur * 0.48;
  if (!player.didHit && prev >= trigger && player.atkT < trigger && S.heroId === 'stickman') {
    player.didHit = true;
    resolveMelee();
  }
  if (player.atkT <= 0) player.skillSwing = false;
}

function launchRocket(e) {
  const high = e.warnHigh;
  projectiles.push({
    owner: 'enemy',
    kind: 'rocket',
    x: e.x - 78,
    y: gy() - (high ? 128 : 30),
    vx: -250 - S.chapter * 6,
    vy: 0,
    grav: 0,
    r: 13,
    dmg: e.dmg,
    life: 3.2,
  });
  sfx('swing');
}

function updateTank(e, dt) {
  e.y = gy();
  if (e.x > e.tx) e.x = Math.max(e.tx, e.x - e.speed * dt);
  e.facing = -1;
  if (e.warn > 0) {
    e.warn -= dt;
    if (e.warn <= 0) launchRocket(e);
    return;
  }
  e.shootT -= dt;
  if (e.shootT <= 0) {
    e.warnHigh = Math.random() < 0.42;
    e.warn = 0.42;
    e.shootT = S.chapter === 5 ? 1.15 : 1.55;
  }
}

function updateTentacle(e, dt) {
  e.y = gy();
  e.rise = Math.min(1, e.rise + dt * 0.8);
  if (e.whipping > 0) {
    e.whipping -= dt;
    const age = 0.62 - e.whipping;
    if (age > 0.4 && !e.whipped) {
      e.whipped = true;
      const reach = e.x - 150;
      const inX = player.x < e.x - 10 && player.x > reach;
      const high = e.whipHigh;
      const inY = high ? !player.onGround : player.onGround;
      if (inX && inY) hurtPlayer(e.dmg);
    }
    if (e.whipping <= 0) e.whipped = false;
    return;
  }
  e.whipT -= dt;
  if (e.whipT <= 0) {
    e.whipping = 0.62;
    e.whipHigh = Math.random() < 0.5;
    e.whipped = false;
    e.whipT = S.chapter === 5 ? 1.05 : 1.4;
  }
}

function updateWinged(e, dt) {
  e.diveT -= dt;
  if (e.diving > 0) {
    e.diving -= dt;
    const target = e.diving > 0.35 ? gy() - 8 : gy() - 130;
    e.y += (target - e.y) * Math.min(1, dt * 8);
    if (e.diving <= 0) e.diveT = 2.1;
  } else {
    const target = gy() - 128 + Math.sin(time * 3 + e.phase) * 18;
    e.y += (target - e.y) * Math.min(1, dt * 3);
    if (e.diveT <= 0) e.diving = 0.85;
  }
  const dir = Math.sign(player.x - e.x) || 1;
  e.facing = dir;
  e.x += dir * e.speed * dt;
  e.x = clamp(e.x, 16, W - 16);
  e.atkCd -= dt;
  if (e.diving > 0.25 && e.diving < 0.45 && e.atkCd <= 0 && Math.abs(player.x - e.x) < 48 && Math.abs(player.y - e.y) < 50) {
    hurtPlayer(e.dmg);
    e.atkCd = 1.1;
  }
}

function updateWalker(e, dt) {
  e.y = gy();
  const dir = Math.sign(player.x - e.x) || 1;
  e.facing = dir;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) {
      const reach = e.kind === 'demon' ? 76 : 48;
      if (Math.abs(player.x - e.x) < reach && Math.abs(player.y - e.y) < 64) hurtPlayer(e.dmg);
    }
    return;
  }
  e.atkCd -= dt;
  const dist = Math.abs(player.x - e.x);
  const reach = e.kind === 'demon' ? 64 : 42;
  if (dist < reach && Math.abs(player.y - e.y) < 70 && e.atkCd <= 0) {
    e.windup = e.kind === 'demon' ? 0.4 : 0.28;
    e.atkCd = e.kind === 'demon' ? 1.2 : 1.0;
    return;
  }
  e.x += dir * e.speed * dt;
}

function separateWalkers() {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      if (a.dead || b.dead || a.boss || b.boss || a.kind === 'winged' || b.kind === 'winged') continue;
      const dx = b.x - a.x;
      if (Math.abs(dx) < 34 && Math.abs(a.y - b.y) < 30) {
        const push = (34 - Math.abs(dx)) * 0.5;
        const s = Math.sign(dx) || 1;
        a.x -= s * push;
        b.x += s * push;
      }
    }
  }
}

function explodePoop(p) {
  boom(p.x, p.y, '#ff8a2a', 36);
  burst(p.x, p.y, '#c4843a', 10, 100);
  let shouted = false;
  for (const e of enemies) {
    if (e.dead) continue;
    if (circleRect(p.x, p.y, p.aoe, enemyRect(e))) {
      hurtEnemy(e, p.dmg, { shout: !shouted && p.shout });
      shouted = true;
    }
  }
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.life -= dt;
    p.vy += (p.grav || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) continue;
    if (p.owner === 'player') {
      for (const e of enemies) {
        if (e.dead) continue;
        if (!circleRect(p.x, p.y, p.r + 2, enemyRect(e))) continue;
        if (p.aoe) explodePoop(p);
        else hurtEnemy(e, p.dmg, { raw: !!p.raw, shout: !!p.shout });
        p.life = 0;
        break;
      }
    } else if (player && circleRect(p.x, p.y, p.r, playerRect())) {
      hurtPlayer(p.dmg);
      boom(p.x, p.y, '#ff5a3c', 22);
      p.life = 0;
    }
    if (p.life > 0 && p.y > gy() + 4) {
      if (p.aoe) explodePoop(p);
      else if (p.kind === 'rocket') boom(p.x, gy(), '#ff8a2a', 18);
      p.life = 0;
    }
  }
  projectiles = projectiles.filter((p) => p.life > 0 && p.x > -80 && p.x < W + 80);
}

function updateAngels(dt) {
  for (const a of angels) {
    a.x += a.vx * dt;
    a.y += Math.sin(time * 6 + a.x * 0.02) * 12 * dt;
    a.life -= dt;
    a.shot -= dt;
    if (a.shot <= 0 && a.x > 0 && a.x < W) {
      a.shot = 0.62;
      let tx = a.x + 40;
      let ty = gy() - 40;
      const target = nearestEnemy();
      if (target) {
        tx = target.x;
        ty = target.y - 40;
      }
      const dx = tx - a.x;
      const dy = ty - a.y;
      const len = Math.hypot(dx, dy) || 1;
      projectiles.push({
        owner: 'player',
        kind: 'arrow',
        x: a.x,
        y: a.y + 8,
        vx: (dx / len) * 320,
        vy: (dy / len) * 320,
        grav: 0,
        r: 5,
        dmg: a.dmg,
        raw: true,
        life: 1.5,
      });
    }
  }
  angels = angels.filter((a) => a.life > 0 && a.x < W + 40);
}

function updateFx(dt) {
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 30 * dt;
  }
  particles = particles.filter((p) => p.age < p.life);
  for (const f of floats) {
    f.age += dt;
    f.y -= 28 * dt;
  }
  floats = floats.filter((f) => f.age < f.life);
  for (const b of booms) b.age += dt;
  booms = booms.filter((b) => b.age < b.life);
  if (S.banner) {
    S.banner.t -= dt;
    if (S.banner.t <= 0) S.banner = null;
  }
  S.shoutT = Math.max(0, S.shoutT - dt);
  S.shoutCd = Math.max(0, S.shoutCd - dt);
  S.flash = Math.max(0, S.flash - dt);
  S.shake = Math.max(0, S.shake - dt * 22);
  S.hintT = Math.max(0, S.hintT - dt);
  S.levelPop = Math.max(0, S.levelPop - dt);
  if (yuriNpc) {
    yuriNpc.t -= dt;
    if (yuriNpc.t <= 0) yuriNpc = null;
  }
}

function pushOutOfBosses() {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.kind === 'tank' && player.x > e.x - 64) player.x = e.x - 64;
    if (e.kind === 'tentacle' && player.x > e.x - 40) player.x = e.x - 40;
  }
}

function updatePlay(dt) {
  S.grace = Math.max(0, (S.grace || 0) - dt);
  if (S.pendingClear != null) {
    S.pendingClear -= dt;
    updateFx(dt);
    if (S.pendingClear <= 0) {
      S.pendingClear = null;
      if (S.chapter >= 5) {
        const name = { stickman: 'Stickman', jaden: 'Jaden', noob: 'Noob', yuri: 'Yuri' }[S.heroId];
        document.getElementById('win-title').textContent = name + ' 우승!';
        document.getElementById('win-d').textContent = '다섯 챕터를 모두 클리어했다.\nThe Stickman Fight';
        setScreen('win');
        sfx('win');
      } else {
        const msgs = {
          1: '좀비 20마리 처치, 똥 10개 채굴!\n에너지 레벨 ' + S.level,
          2: '뿔 달린 칼잡이들을 물리쳤다!',
          3: '로켓맨의 탱크가 멈췄다!',
          4: '촉수동물을 쓰러뜨렸다!',
        };
        document.getElementById('clear-d').textContent = msgs[S.chapter] || '';
        setScreen('clear');
        sfx('win');
      }
    }
    return;
  }

  const hero = HEROES[S.heroId];
  let mx = 0;
  if (input.left || input.leftNudge > 0) mx -= 1;
  if (input.right || input.rightNudge > 0) mx += 1;
  input.leftNudge = Math.max(0, (input.leftNudge || 0) - dt);
  input.rightNudge = Math.max(0, (input.rightNudge || 0) - dt);
  if (player.mineT > 0) mx = 0;
  if (mx) player.facing = mx > 0 ? 1 : -1;
  else {
    const n = nearestEnemy();
    if (n) player.facing = n.x >= player.x ? 1 : -1;
  }

  if ((input.jumpEdge || (input.jump && !input.jumpPrev)) && player.onGround && player.mineT <= 0) {
    player.vy = -630;
    player.onGround = false;
  }
  input.jumpEdge = false;
  input.jumpPrev = input.jump;

  player.x += mx * hero.speed * dt + player.kx * dt;
  player.kx *= Math.max(0, 1 - dt * 8);
  player.vy += 1700 * dt;
  if (player.mineT > 0) player.vy = Math.max(0, player.vy);
  player.y += player.vy * dt;
  const g = gy();
  if (player.y >= g) {
    player.y = g;
    player.vy = 0;
    player.onGround = true;
  } else player.onGround = false;
  player.x = clamp(player.x, 26, W - 26);
  pushOutOfBosses();

  player.atkCd = Math.max(0, player.atkCd - dt);
  player.skillCd = Math.max(0, player.skillCd - dt);
  player.iframes = Math.max(0, player.iframes - dt);
  player.hurtT = Math.max(0, player.hurtT - dt);
  player.eatT = Math.max(0, player.eatT - dt);
  player.cheerT = Math.max(0, player.cheerT - dt);

  if (input.attack) doAttack();
  if ((input.skillHold || input.skillEdge) && S.heroId === 'noob') doSkill();
  input.skillEdge = false;

  if (player.mineT > 0) {
    player.mineT -= dt;
    const rock = player.mineRock;
    if (!rock || !rock.alive || Math.abs(rock.x - player.x) > 78) player.mineT = 0;
    else if (player.mineT <= 0) completeMine(rock);
  }

  updateAttack(dt);

  if (player.awakened) {
    player.awakenT -= dt;
    if (Math.random() < 0.6) {
      particles.push({
        x: player.x + rand(-22, 22),
        y: player.y - rand(10, 80),
        vx: rand(-15, 15),
        vy: rand(-80, -30),
        life: 0.35,
        age: 0,
        color: Math.random() < 0.5 ? '#7ad7ff' : '#e8fbff',
        r: rand(2, 5),
      });
    }
    if (player.awakenT <= 0) endAwaken();
  }

  updateRocks(dt);
  updateSpawns(dt);

  for (const e of enemies) {
    if (e.dead) {
      e.deathT -= dt;
      continue;
    }
    e.hurtT = Math.max(0, e.hurtT - dt);
    e.x += e.kx * dt;
    e.kx *= Math.max(0, 1 - dt * 8);
    if (e.kind === 'tank') updateTank(e, dt);
    else if (e.kind === 'tentacle') updateTentacle(e, dt);
    else if (e.kind === 'winged') updateWinged(e, dt);
    else updateWalker(e, dt);
  }
  separateWalkers();
  enemies = enemies.filter((e) => !(e.dead && e.deathT <= 0));

  updateProjectiles(dt);
  updateAngels(dt);
  updateFx(dt);
}

function ink(w) {
  ctx.lineWidth = w || 4;
  ctx.strokeStyle = '#161616';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circ(x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function outlined(text, x, y, size, fill, align) {
  ctx.save();
  ctx.font = size + 'px Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = '#161616';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill || '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawSword(type) {
  ctx.save();
  ink(3);
  if (type === 'diamond') ctx.fillStyle = '#8ef6ff';
  else if (type === 'flame') ctx.fillStyle = '#ff9a2a';
  else ctx.fillStyle = '#e6ebf2';
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(7, -6);
  ctx.lineTo(4, -40);
  ctx.lineTo(0, -50);
  ctx.lineTo(-4, -40);
  ctx.lineTo(-7, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  line(-12, -4, 12, -4);
  line(0, -4, 0, 10);
  if (type === 'flame') {
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(7, -8);
    ctx.lineTo(0, -28);
    ctx.lineTo(-6, -10);
    ctx.fill();
  } else if (type === 'diamond') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -32, 4, 8);
  }
  ctx.restore();
}

function drawPoopIcon(s) {
  ctx.save();
  ctx.scale(s || 1, s || 1);
  ink(3);
  ctx.fillStyle = '#8a5a22';
  ctx.beginPath();
  ctx.arc(0, 6, 12, Math.PI, 0);
  ctx.lineTo(12, 10);
  ctx.arc(0, 10, 12, 0, Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-1, -10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 6, 12, Math.PI, 0);
  ctx.arc(0, -2, 9, 0, Math.PI * 2);
  ctx.arc(-1, -10, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawDonutIcon(s) {
  ctx.save();
  ctx.scale(s || 1, s || 1);
  ink(3);
  ctx.fillStyle = '#f4b183';
  circ(0, 0, 11, '#f4b183');
  ctx.fillStyle = '#ff7aa2';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.arc(0, 0, 4, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-2, -8, 3, 3);
  ctx.fillRect(4, -2, 3, 3);
  ctx.fillStyle = '#7ecbff';
  ctx.fillRect(-6, 2, 3, 3);
  ctx.restore();
}

function drawHeartIcon(s) {
  ctx.save();
  ctx.scale(s || 1, s || 1);
  ink(3);
  ctx.fillStyle = '#ff5a7a';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-16, -4, -8, -14, 0, -6);
  ctx.bezierCurveTo(8, -14, 16, -4, 0, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function face(y, mood) {
  ink(2);
  ctx.fillStyle = '#161616';
  if (mood === 'hurt') {
    line(-6, y, -2, y + 3);
    line(6, y, 2, y + 3);
  } else if (mood === 'angry') {
    line(-8, y - 4, -2, y);
    line(8, y - 4, 2, y);
    circ(-5, y + 2, 1.6, '#161616');
    circ(5, y + 2, 1.6, '#161616');
  } else if (mood === 'innocent') {
    ctx.fillStyle = '#fff';
    circ(-5, y, 4.2, '#fff');
    circ(5, y, 4.2, '#fff');
    ctx.fillStyle = '#161616';
    circ(-4, y + 1, 2, '#161616');
    circ(6, y + 1, 2, '#161616');
  } else {
    circ(-5, y, 2, '#161616');
    circ(5, y, 2, '#161616');
  }
  ctx.strokeStyle = '#161616';
  ctx.lineWidth = 2;
  if (mood === 'happy' || mood === 'cheer') {
    ctx.beginPath();
    ctx.arc(0, y + 4, 6, 0.15, Math.PI - 0.15);
    ctx.stroke();
    if (mood === 'happy') {
      ctx.fillStyle = '#ff6b8a';
      ctx.beginPath();
      ctx.ellipse(2, y + 10, 3, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mood === 'innocent') {
    ctx.beginPath();
    ctx.arc(0, y + 8, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = '#ffb6c4';
    circ(-11, y + 4, 3, '#ffb6c4');
    circ(11, y + 4, 3, '#ffb6c4');
  } else if (mood === 'sad') {
    ctx.beginPath();
    ctx.arc(0, y + 12, 5, Math.PI + 0.3, -0.3);
    ctx.stroke();
  }
}

function drawStickman(o) {
  const walk = o.walk || 0;
  const atk = o.attacking ? o.atkP : 0;
  ink(4);
  ctx.strokeStyle = '#161616';
  line(0, -30, -12 + walk * 10, 0);
  line(0, -30, 12 - walk * 10, 0);
  line(0, -32, 0, -62);
  if (!o.attacking) {
    line(0, -56, -16, -40 + walk * 6);
    line(0, -56, 16, -38 - walk * 6);
  }
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -102, 12, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ink(4);
  circ(0, -78, 16, '#fff');
  face(-80, o.hurt ? 'hurt' : 'happy');
  if (o.attacking) {
    const ang = -2.3 + atk * 2.5;
    ctx.save();
    ctx.translate(12, -56);
    ctx.rotate(ang);
    drawSword(o.awakened ? 'flame' : 'iron');
    ctx.restore();
    if (o.awakened) {
      ctx.save();
      ctx.translate(-8, -54);
      ctx.rotate(-ang - 0.2);
      drawSword('diamond');
      ctx.restore();
    }
    ink(4);
    ctx.strokeStyle = o.awakened ? '#7ef0ff' : '#fff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(18, -52, 26 + atk * 10, -1.2, 0.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (o.awakened) {
    ctx.save();
    ctx.translate(18, -48);
    ctx.rotate(-0.8);
    drawSword('flame');
    ctx.restore();
    ctx.save();
    ctx.translate(-16, -48);
    ctx.rotate(0.7);
    drawSword('diamond');
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(18, -46);
    ctx.rotate(-0.9);
    drawSword('iron');
    ctx.restore();
  }
}

function drawJaden(o) {
  const walk = o.walk || 0;
  ink(4);
  ctx.strokeStyle = '#161616';
  line(-2, -28, -12 + walk * 8, 0);
  line(2, -28, 12 - walk * 8, 0);
  ctx.fillStyle = '#1d2430';
  roundRect(-11, -18, 9, 16, 3);
  roundRect(3, -18, 9, 16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e23b3b';
  roundRect(-16, -58, 32, 34, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff6b6b';
  roundRect(-6, -50, 12, 8, 3);
  ctx.fill();
  ctx.fillStyle = '#3a2418';
  ctx.beginPath();
  ctx.arc(0, -66, 15, Math.PI, 0);
  ctx.fill();
  circ(0, -62, 14, '#ffd2b8');
  face(-64, o.hurt ? 'hurt' : 'angry');
  ink(4);
  if (o.attacking) {
    line(0, -50, 26, -58);
    ctx.save();
    ctx.translate(30, -60);
    if (o.awakened) drawRocketPoop();
    else drawPoopIcon(0.7);
    ctx.restore();
  } else {
    line(0, -50, -16, -34 + walk * 4);
    line(0, -50, 14, -36);
    ctx.save();
    ctx.translate(18, -30);
    drawPoopIcon(0.45);
    ctx.restore();
  }
}

function drawRocketPoop() {
  ctx.save();
  ink(3);
  ctx.fillStyle = '#8d8d8d';
  roundRect(-8, -6, 22, 14, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.moveTo(14, -8);
  ctx.lineTo(26, 1);
  ctx.lineTo(14, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-16, 1);
  ctx.lineTo(-8, 6);
  ctx.fill();
  ctx.save();
  ctx.translate(-4, 0);
  drawPoopIcon(0.45);
  ctx.restore();
  ctx.restore();
}

function drawNoob(o) {
  const walk = o.walk || 0;
  ink(4);
  line(-6, -16, -12 + walk * 6, 0);
  line(6, -16, 12 - walk * 6, 0);
  ctx.fillStyle = '#f3c7a2';
  ctx.beginPath();
  ctx.ellipse(0, -42, 22, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  face(-48, o.hurt ? 'hurt' : 'innocent');
  ctx.strokeStyle = '#161616';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-8, -62, 6, Math.PI, Math.PI * 1.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, -62, 6, Math.PI * 1.3, 0);
  ctx.stroke();
  if (o.eating) {
    ctx.save();
    ctx.translate(0, -36);
    ctx.rotate(-0.4);
    drawDonutIcon(0.7);
    ctx.restore();
  } else if (o.attacking) {
    line(8, -36, 24, -48);
    ctx.save();
    ctx.translate(28, -50);
    drawDonutIcon(0.75);
    ctx.restore();
  } else {
    line(-10, -34, -18, -18);
    ctx.save();
    ctx.translate(16, -24);
    drawDonutIcon(0.65);
    ctx.restore();
  }
  if (!o.hurt) {
    ctx.fillStyle = '#7ecbff';
    ctx.beginPath();
    ctx.ellipse(18, -58, 4, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawYuri(o) {
  const walk = o.walk || 0;
  const cheer = o.cheer;
  ink(4);
  line(-4, -26, -12 + walk * 7, 0);
  line(4, -26, 12 - walk * 7, 0);
  ctx.fillStyle = '#ff4d5a';
  ctx.beginPath();
  ctx.moveTo(-18, -28);
  ctx.lineTo(0, -58);
  ctx.lineTo(18, -28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c4313c';
  ctx.beginPath();
  ctx.arc(-12, -70, 10, 0, Math.PI * 2);
  ctx.arc(10, -68, 9, 0, Math.PI * 2);
  ctx.arc(0, -78, 11, 0, Math.PI * 2);
  ctx.fill();
  circ(0, -64, 13, '#ffe0cc');
  ctx.fillStyle = '#e23b3b';
  ctx.beginPath();
  ctx.ellipse(-16, -62, 6, 8, -0.6, 0, Math.PI * 2);
  ctx.fill();
  face(-66, o.hurt ? 'hurt' : 'cheer');
  ink(4);
  if (cheer) {
    line(-4, -50, -18, -70);
    line(4, -50, 18, -70);
    ctx.save();
    ctx.translate(20, -74);
    drawHeartIcon(0.55);
    ctx.restore();
  } else if (o.attacking) {
    line(0, -48, 22, -58);
    ctx.save();
    ctx.translate(28, -60);
    drawHeartIcon(0.7);
    ctx.restore();
  } else {
    line(-2, -48, -16, -36 + walk * 4);
    line(2, -48, 16, -62);
  }
}

function drawZombie(o) {
  const walk = Math.sin(time * 6 + (o.phase || 0)) * 0.8;
  ink(4);
  ctx.strokeStyle = '#243028';
  line(0, -28, -10 + walk * 8, 0);
  line(0, -28, 8 - walk * 6, 0);
  line(0, -30, 2, -54);
  ctx.fillStyle = '#6d7a62';
  roundRect(-12, -52, 24, 26, 4);
  ctx.fill();
  ctx.stroke();
  circ(4, -66, 13, '#9bb896');
  face(-68, 'sad');
  ink(3);
  ctx.strokeStyle = '#243028';
  line(4, -48, 20, -36);
  line(-4, -48, -18, -58);
  ctx.fillStyle = '#203026';
  ctx.fillRect(-4, -78, 10, 4);
}

function drawDemon(o) {
  const walk = o.walk || 0;
  ink(4);
  ctx.strokeStyle = '#161616';
  line(0, -28, -11 + walk * 8, 0);
  line(0, -28, 11 - walk * 8, 0);
  line(0, -30, 0, -56);
  if (o.wings) {
    ctx.fillStyle = '#f2efe6';
    ctx.beginPath();
    ctx.moveTo(-4, -50);
    ctx.quadraticCurveTo(-36, -78, -18, -28);
    ctx.quadraticCurveTo(-16, -48, -4, -50);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -50);
    ctx.quadraticCurveTo(36, -78, 18, -28);
    ctx.quadraticCurveTo(16, -48, 4, -50);
    ctx.fill();
    ctx.stroke();
  }
  circ(0, -70, 15, '#ff3b3b');
  ctx.fillStyle = '#ffd0a8';
  ctx.beginPath();
  ctx.moveTo(-10, -84);
  ctx.lineTo(-4, -70);
  ctx.lineTo(-16, -74);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, -84);
  ctx.lineTo(4, -70);
  ctx.lineTo(16, -74);
  ctx.fill();
  ctx.stroke();
  face(-72, o.hurt ? 'hurt' : 'angry');
  const ang = o.windup ? -0.4 : -2.1 + (o.swing || 0);
  ctx.save();
  ctx.translate(10, -50);
  ctx.rotate(ang);
  drawSword('iron');
  ctx.restore();
  if (o.windup) {
    ctx.strokeStyle = '#ff5a3c';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(16, -46, 22, -1, 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawTank(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ink(4);
  ctx.fillStyle = '#4d6b32';
  roundRect(-78, -58, 150, 46, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2c241c';
  roundRect(-70, -22, 134, 16, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3e5528';
  roundRect(-20, -84, 46, 32, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6d6d6d';
  roundRect(-92, -48, 28, 12, 3);
  ctx.fill();
  ctx.stroke();
  if (e.warn > 0) {
    ctx.strokeStyle = e.warnHigh ? '#7ecbff' : '#ff5a3c';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    const y = e.warnHigh ? -128 : -30;
    line(-90, y, -170, y);
    ctx.setLineDash([]);
    outlined('!', e.x > 40 ? -110 : -20, y - 16, 18, '#ff5a3c', 'center');
  }
  ctx.save();
  ctx.translate(0, -96);
  ink(3);
  circ(0, 0, 10, '#ffe0cc');
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(-10, -12, 20, 8);
  ctx.strokeRect(-10, -12, 20, 8);
  face(-2, 'angry');
  ctx.restore();
  ctx.restore();
}

function drawTentacle(e) {
  const rise = e.rise == null ? 1 : e.rise;
  ctx.save();
  ctx.translate(e.x, e.y);
  ink(5);
  const whip = e.whipping > 0 ? (0.62 - e.whipping) / 0.62 : 0;
  for (let i = 0; i < 4; i++) {
    const base = -20 - i * 8;
    const wave = Math.sin(time * 3 + i) * 10;
    let tipX = -50 - i * 16 + wave;
    let tipY = -50 - i * 22;
    if (e.whipping > 0 && i === (e.whipHigh ? 0 : 3)) {
      tipX = -40 - whip * 120;
      tipY = e.whipHigh ? -130 + whip * 20 : -20 - (1 - whip) * 10;
      ctx.strokeStyle = '#ff5a3c';
    } else ctx.strokeStyle = '#6a3d96';
    ctx.lineWidth = 10 - i;
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.quadraticCurveTo(base, tipY * 0.5 * rise, tipX, tipY * rise);
    ctx.stroke();
  }
  ink(4);
  ctx.fillStyle = '#8d5cc4';
  ctx.beginPath();
  ctx.ellipse(10, -70 * rise, 36, 32 * rise + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -78 * rise, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#161616';
  ctx.beginPath();
  ctx.arc(-2, -78 * rise, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAngel(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ink(3);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-10, 2, 10, 6, -0.5, 0, Math.PI * 2);
  ctx.ellipse(10, 2, 10, 6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  line(0, 10, -4, 22);
  line(0, 10, 4, 22);
  line(0, 4, 0, -8);
  circ(0, -16, 8, '#fff');
  ctx.strokeStyle = '#ffe14a';
  ctx.beginPath();
  ctx.ellipse(0, -28, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ink(3);
  ctx.strokeStyle = '#8a5a22';
  ctx.beginPath();
  ctx.arc(10, -6, 10, -1.2, 0.8);
  ctx.stroke();
  ctx.restore();
}

function drawActor(id, o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale((o.facing < 0 ? -1 : 1) * (o.scale || 1), o.scale || 1);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (id === 'stickman') drawStickman(o);
  else if (id === 'jaden') drawJaden(o);
  else if (id === 'noob') drawNoob(o);
  else if (id === 'yuri') drawYuri(o);
  else if (id === 'zombie') drawZombie(o);
  else if (id === 'demon' || id === 'winged') drawDemon(o);
  ctx.restore();
}

function playerDrawOpts() {
  const moving = (input.left || input.right) && player.onGround && player.mineT <= 0;
  const atkP = player.atkT > 0 ? 1 - player.atkT / player.atkDur : 0;
  return {
    x: player.x,
    y: player.y,
    facing: player.facing,
    walk: moving || (player.mineT > 0) ? Math.sin(time * 12) : Math.sin(time * 2) * 0.15,
    attacking: player.atkT > 0,
    atkP,
    awakened: player.awakened,
    hurt: player.hurtT > 0,
    eating: player.eatT > 0,
    cheer: player.cheerT > 0,
    scale: 1.18,
    alpha: player.iframes > 0 && Math.floor(time * 18) % 2 === 0 ? 0.45 : 1,
  };
}

function drawAura() {
  if (!player || !player.awakened) return;
  const r = 54 + Math.sin(time * 10) * 4;
  const g = ctx.createRadialGradient(player.x, player.y - 48, 6, player.x, player.y - 48, r);
  g.addColorStop(0, 'rgba(180, 240, 255, 0.15)');
  g.addColorStop(0.55, 'rgba(70, 170, 255, 0.38)');
  g.addColorStop(1, 'rgba(40, 90, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(player.x, player.y - 48, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSun(x, y, angry) {
  ctx.save();
  ctx.translate(x, y);
  ink(3);
  ctx.strokeStyle = '#e09a12';
  ctx.fillStyle = '#ffe14a';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + time * 0.3;
    line(Math.cos(a) * 18, Math.sin(a) * 18, Math.cos(a) * 28, Math.sin(a) * 28);
  }
  circ(0, 0, 16, '#ffe14a');
  face(-2, angry ? 'angry' : 'happy');
  ctx.restore();
}

function drawBackground() {
  const g = gy();
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  const themes = {
    title: ['#8fd8ff', '#fff2c4'],
    select: ['#9adfff', '#fff'],
    1: ['#8fd8ff', '#e7fff0'],
    2: ['#ffb086', '#8ec8ea'],
    3: ['#f08a5a', '#6e8ea6'],
    4: ['#d7c4ff', '#6f8fd4'],
    5: ['#ff8d6a', '#6bbcff'],
  };
  const key = S.screen === 'title' || S.screen === 'select' ? S.screen : S.chapter;
  const pair = themes[key] || themes[1];
  sky.addColorStop(0, pair[0]);
  sky.addColorStop(1, pair[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  let sunX = W * 0.84;
  let sunY = safeTop() + 70;
  if (S.screen === 'select') { sunX = W - 58; sunY = H * 0.16; }
  if (S.screen !== 'title' && S.screen !== 'select') { sunX = 62; sunY = safeTop() + 214; }
  drawSun(sunX, sunY, S.chapter >= 2 && S.screen !== 'title' && S.screen !== 'select');

  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const cloudBase = (S.screen === 'title' || S.screen === 'select') ? safeTop() + 130 : safeTop() + 250;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 180 + time * 18) % (W + 160)) - 80;
    const y = cloudBase + (i % 3) * 36;
    ctx.beginPath();
    ctx.ellipse(x, y, 28, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 18, y + 4, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = S.chapter === 1 || S.screen === 'title' || S.screen === 'select' ? '#8d6b86' : '#6d5a78';
  ctx.beginPath();
  ctx.moveTo(0, g - 40);
  for (let x = 0; x <= W; x += 20) {
    ctx.lineTo(x, g - 70 - Math.sin(x * 0.02) * 26 - (x % 80 < 40 ? 16 : 0));
  }
  ctx.lineTo(W, g);
  ctx.lineTo(0, g);
  ctx.fill();

  if ((S.chapter === 1 || S.screen === 'title' || S.screen === 'select') && S.chapter !== 5) {
    ctx.fillStyle = '#2f8a4a';
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * (W / 5);
      ctx.beginPath();
      ctx.moveTo(x, g - 18);
      ctx.lineTo(x + 16, g - 62);
      ctx.lineTo(x + 32, g - 18);
      ctx.fill();
    }
    if (S.chapter === 1 && S.screen !== 'title' && S.screen !== 'select') {
      ctx.fillStyle = '#5b4636';
      ink(4);
      roundRect(W - 92, g - 78, 70, 60, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1a120e';
      ctx.beginPath();
      ctx.ellipse(W - 57, g - 40, 18, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (S.chapter >= 3 && S.screen !== 'title' && S.screen !== 'select') {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(time * 3) * 0.05;
    ctx.fillStyle = '#ff7a32';
    ctx.beginPath();
    ctx.arc(W * 0.62, g - 120, 34 + Math.sin(time * 5) * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(W * 0.62, g - 120, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (S.chapter === 5 && S.screen !== 'title' && S.screen !== 'select') {
    ctx.save();
    ctx.translate(W * 0.72, g - 150);
    ctx.rotate(0.2);
    ctx.globalAlpha = 0.85;
    ink(3);
    ctx.fillStyle = '#bff7ff';
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 28);
    ctx.lineTo(-16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const grass = S.chapter === 1 || S.screen === 'title' || S.screen === 'select';
  ctx.fillStyle = grass && S.chapter < 2 || S.screen === 'title' || S.screen === 'select' ? '#67a84a' : '#c4784a';
  if (!(S.chapter === 1 || S.screen === 'title' || S.screen === 'select')) ctx.fillStyle = '#c4784a';
  ctx.fillRect(0, g, W, H - g);
  ink(5);
  line(0, g, W, g);
  ctx.fillStyle = grass && (S.chapter === 1 || S.screen === 'title' || S.screen === 'select') ? '#8d5a32' : '#8d4a32';
  ctx.fillRect(0, g + 8, W, H - g);
}

function drawRocks() {
  const g = gy();
  for (const r of rocks) {
    if (!r.alive) continue;
    ctx.save();
    ctx.translate(r.x, g);
    ink(3);
    ctx.fillStyle = '#8d8078';
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(-18, -18);
    ctx.lineTo(0, -10);
    ctx.lineTo(16, -22);
    ctx.lineTo(30, 0);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -28);
    drawPoopIcon(1);
    ctx.restore();
    outlined('똥', 0, -52, 14, '#ffe14a');
    ctx.restore();
  }
  if (player && player.mineT > 0 && player.mineRock && player.mineRock.alive) {
    const p = 1 - player.mineT / 0.85;
    ctx.save();
    ctx.translate(player.mineRock.x, g - 64);
    ink(4);
    ctx.strokeStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
    ctx.restore();
  }
}

function drawProjectile(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.kind === 'poop') drawPoopIcon(0.85);
  else if (p.kind === 'rocketpoop') {
    ctx.rotate(Math.atan2(p.vy, p.vx));
    drawRocketPoop();
  } else if (p.kind === 'donut') {
    ctx.rotate(time * 8);
    drawDonutIcon(0.85);
  } else if (p.kind === 'heart') drawHeartIcon(0.8);
  else if (p.kind === 'arrow') {
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ink(3);
    ctx.strokeStyle = '#8a5a22';
    line(-12, 0, 8, 0);
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.fill();
  } else if (p.kind === 'rocket') {
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ink(3);
    ctx.fillStyle = '#6a6a6a';
    roundRect(-16, -7, 28, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.lineTo(24, 0);
    ctx.lineTo(12, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.moveTo(-16, -5);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-16, 5);
    ctx.fill();
  }
  ctx.restore();
}

function bar(x, y, w, h, ratio, fg, bg) {
  const r = clamp(ratio, 0, 1);
  ctx.fillStyle = bg;
  roundRect(x, y, w, h, 6);
  ctx.fill();
  if (r > 0.01) {
    ctx.fillStyle = fg;
    roundRect(x, y, Math.max(8, w * r), h, 6);
    ctx.fill();
  }
  ink(2);
  roundRect(x, y, w, h, 6);
  ctx.stroke();
}

function drawHUD() {
  if (S.screen === 'title' || S.screen === 'select') return;
  const top = safeTop() + 8;
  const info = INTRO[S.chapter];
  const panelH = S.heroId === 'noob' ? 132 : 108;
  ctx.save();
  ctx.fillStyle = 'rgba(22, 16, 14, 0.78)';
  roundRect(8, top - 2, W - 16, panelH, 16);
  ctx.fill();
  ink(3);
  roundRect(8, top - 2, W - 16, panelH, 16);
  ctx.stroke();
  ctx.restore();
  outlined(info.k + '  ' + info.t, 18, top + 16, 16, '#fff', 'left');
  const hpY = top + 36;
  const hpW = Math.min(168, W * 0.38);
  bar(18, hpY, hpW, 14, player ? player.hp / maxHp() : 0, player && player.hp < maxHp() * 0.3 ? '#ff5a6a' : '#7de37a', '#3a2018');
  outlined('HP', 24, hpY + 7, 11, '#fff', 'left');
  const lvScale = 1 + S.levelPop * 0.4;
  outlined('LV.' + S.level, 18 + hpW + 28, hpY + 8, 14 * lvScale, '#ffe14a', 'left');

  const eY = top + 58;
  const eW = W - 36;
  if (player && player.awakened) {
    bar(18, eY, eW, 22, player.awakenT / CONFIG.awakenDuration, '#49d6ff', '#16324a');
    outlined('각성', W / 2, eY + 11, 14, '#fff', 'center');
  } else {
    const ratio = S.energy / CONFIG.energyMax;
    bar(18, eY, eW, 22, ratio, '#49d6ff', '#3a2a12');
    outlined('ENERGY', W / 2, eY + 11, 13, '#fff6d2', 'center');
  }

  let mission = '';
  if (S.chapter === 1) mission = '좀비 ' + S.kills.zombie + '/' + CONFIG.ch1Zombies + '    똥 ' + S.poop + '/' + CONFIG.ch1Poops;
  else if (S.chapter === 2) mission = '칼 악마 ' + S.kills.demon + '/' + CONFIG.ch2Demons;
  else if (S.chapter === 3) mission = '로켓맨을 쓰러뜨려라';
  else if (S.chapter === 4) mission = '촉수동물을 쓰러뜨려라';
  else mission = '각성 ' + Math.min(S.awakenCount, CONFIG.ch5Awakens) + '/' + CONFIG.ch5Awakens + '   좀비 ' + S.kills.zombie + '/' + CONFIG.ch5Zombies + '   악마 ' + S.kills.winged + '/' + CONFIG.ch5Winged;

  outlined(mission, W / 2, eY + 40, 14, '#fff', 'center');

  if (S.heroId === 'noob' && player && S.screen === 'play') {
    const baseX = 16;
    const baseY = eY + 58;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(baseX + i * 22, baseY);
      ctx.globalAlpha = i < player.donuts ? 1 : 0.35;
      drawDonutIcon(0.55);
      ctx.restore();
    }
  }

  let by = eY + (S.heroId === 'noob' ? 78 : 56);
  for (const e of enemies) {
    if (e.dead || !e.boss) continue;
    const label = e.kind === 'tank' ? '로켓맨' : '촉수동물';
    outlined(label, 12, by + 6, 12, '#fff', 'left');
    bar(70, by, W - 84, 12, e.hp / e.maxHp, '#ff5a3c', '#3a2018');
    by += 20;
  }

  if (S.hintT > 0 && S.screen === 'play') {
    const hint = HINTS[S.chapter] || '';
    const lines = hint.split('\n');
    const boxH = lines.length * 18 + 12;
    const boxY = gHintY() - (lines.length - 1) * 18 - 16;
    ctx.save();
    ctx.fillStyle = 'rgba(22, 16, 14, 0.78)';
    roundRect(24, boxY, W - 48, boxH, 12);
    ctx.fill();
    ink(3);
    roundRect(24, boxY, W - 48, boxH, 12);
    ctx.stroke();
    ctx.restore();
    lines.forEach((ln, i) => outlined(ln, W / 2, gHintY() - (lines.length - 1 - i) * 18, 14, '#fff'));
  }
}

function gHintY() {
  return gy() - 28;
}

function drawBanner() {
  if (S.shoutT > 0 && S.heroId === 'jaden') {
    const y = safeTop() + 150;
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.rotate(-0.04);
    ink(4);
    ctx.fillStyle = '#fff4b0';
    const text = '사요나라 보쿠노 바이바이!';
    ctx.font = '18px Jua, "Malgun Gothic", sans-serif';
    const tw = Math.min(W - 36, ctx.measureText(text).width + 28);
    roundRect(-tw / 2, -18, tw, 36, 12);
    ctx.fill();
    ctx.stroke();
    outlined(text, 0, 0, tw > W - 80 ? 14 : 16, '#161616');
    ctx.restore();
  }
  if (S.banner && S.banner.t > 0) {
    outlined(S.banner.text, W / 2, safeTop() + 132, 28, '#fff');
  }
}

function drawTitleCast() {
  const g = gy();
  const ids = ['jaden', 'stickman', 'yuri', 'noob'];
  ids.forEach((id, i) => {
    const x = W * (0.16 + i * 0.22);
    drawActor(id, {
      x,
      y: g,
      facing: 1,
      scale: 1.05,
      walk: Math.sin(time * 8 + i) * 0.4,
      attacking: id === 'stickman' && Math.sin(time * 3) > 0.2,
      atkP: (Math.sin(time * 6) + 1) / 2,
      awakened: false,
      cheer: id === 'yuri',
    });
  });
}

function drawSelectPreview() {
  const g = Math.min(gy() - 20, H * 0.46);
  if (!S.heroId) {
    HERO_INFO.forEach((h, i) => {
      drawActor(h.id, {
        x: W * (0.18 + i * 0.22),
        y: g,
        facing: 1,
        scale: 0.85,
        walk: Math.sin(time * 6 + i) * 0.3,
        cheer: h.id === 'yuri',
      });
    });
    return;
  }
  drawActor(S.heroId, {
    x: W * 0.5,
    y: g + 30,
    facing: 1,
    scale: 1.35,
    walk: Math.sin(time * 8) * 0.35,
    attacking: S.heroId === 'stickman',
    atkP: (Math.sin(time * 5) + 1) / 2,
    awakened: Math.sin(time * 1.5) > 0.35,
    cheer: S.heroId === 'yuri' || Math.sin(time) > 0,
    eating: S.heroId === 'noob' && Math.sin(time * 2) > 0.4,
  });
}

function stickToGround() {
  const g = gy();
  if (player && player.onGround) player.y = g;
  for (const e of enemies) if (e.kind !== 'winged') e.y = g;
  for (const r of rocks) r.drawY = g;
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (S.screen !== 'title' && S.screen !== 'select') stickToGround();
  if (S.shake > 0.4 && S.screen === 'play') {
    ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
  }
  drawBackground();

  if (S.screen === 'title') {
    drawTitleCast();
    if (Math.sin(time * 2) > 0) {
      drawActor('zombie', { x: W * 0.9, y: gy(), facing: -1, scale: 0.7, phase: 1 });
    }
    return;
  }
  if (S.screen === 'select') {
    drawSelectPreview();
    return;
  }

  drawRocks();

  for (const a of angels) drawAngel(a);

  const drawList = enemies.filter((e) => e.kind !== 'tank' && e.kind !== 'tentacle');
  for (const e of enemies) if (e.kind === 'tentacle') drawTentacle(e);
  for (const e of enemies) if (e.kind === 'tank') drawTank(e);

  for (const e of drawList) {
    if (e.kind === 'zombie' || e.kind === 'demon' || e.kind === 'winged') {
      const barW = 36;
      const ratio = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = '#3a2018';
      ctx.fillRect(e.x - barW / 2, e.y - e.h - 14, barW, 5);
      ctx.fillStyle = '#ff5a3c';
      ctx.fillRect(e.x - barW / 2, e.y - e.h - 14, barW * ratio, 5);
      drawActor(e.kind === 'winged' ? 'winged' : e.kind, {
        x: e.x,
        y: e.y + (e.dead ? -e.deathT * 20 : 0),
        facing: e.facing,
        phase: e.phase,
        hurt: e.hurtT > 0,
        windup: e.windup > 0,
        wings: e.kind === 'winged',
        walk: Math.sin(time * 10 + e.phase) * (e.windup > 0 ? 0 : 1),
        alpha: e.dead ? e.deathT / 0.32 : 1,
        scale: e.dead ? 1 + (1 - e.deathT / 0.32) * 0.2 : 1,
      });
    }
  }

  if (player && player.awakened) drawAura();
  if (player && S.screen !== 'dead') {
    const o = playerDrawOpts();
    if (player.cheerT > 0) o.y -= Math.sin((1 - player.cheerT) * Math.PI) * 10;
    drawActor(S.heroId, o);
  } else if (player && S.screen === 'dead') {
    drawActor(S.heroId, { x: player.x, y: player.y, facing: player.facing, hurt: true, scale: 0.9, alpha: 0.7 });
  }

  if (yuriNpc && S.heroId !== 'yuri') {
    drawActor('yuri', {
      x: yuriNpc.x,
      y: gy() - Math.sin(yuriNpc.t * 8) * 8,
      facing: player && yuriNpc.x < player.x ? 1 : -1,
      cheer: true,
      scale: 0.82,
    });
    outlined(yuriNpc.phrase, yuriNpc.x, gy() - 110, 16, '#fff');
  }

  for (const p of projectiles) drawProjectile(p);
  for (const b of booms) {
    const t = b.age / b.life;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * (0.4 + t), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const f of floats) {
    ctx.save();
    ctx.globalAlpha = 1 - f.age / f.life;
    outlined(f.text, f.x, f.y, 15, f.color);
    ctx.restore();
  }

  drawHUD();
  drawBanner();

  if (S.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.45, S.flash);
    ctx.fillStyle = S.flashColor;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.restore();
  }

  if (S.screen === 'intro' || S.screen === 'pause' || S.screen === 'dead' || S.screen === 'clear' || S.screen === 'win') {
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(-10, -10, W + 20, H + 20);
  }

  if (S.screen === 'win') {
    for (let i = 0; i < 5; i++) {
      const x = (W / 6) * (i + 1);
      const y = safeTop() + 80 + Math.sin(time * 3 + i) * 20;
      ctx.fillStyle = ['#ff5a6a', '#ffe14a', '#7ee0ff', '#ffb703', '#c9f'][i];
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 4 + Math.sin(time * 5 + i) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function loop(now) {
  if (!last) last = now;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (S.screen !== 'pause') time += dt;
  if (S.screen === 'intro') {
    S.introT -= dt;
    if (S.introT <= 0) setScreen('play');
  } else if (S.screen === 'play') {
    updatePlay(dt);
  }
  if (S.screen === 'play') syncButtons();
  render();
  requestAnimationFrame(loop);
}

function bindControls() {
  document.querySelectorAll('#controls button').forEach((btn) => {
    const hold = btn.dataset.hold;
    const tap = btn.dataset.tap;
    const down = (e) => {
      e.preventDefault();
      if (btn.setPointerCapture) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (hold) input[hold] = true;
      if (hold === 'attack') doAttack();
      if (hold === 'jump') input.jumpEdge = true;
      if (hold === 'left') input.leftNudge = 0.16;
      if (hold === 'right') input.rightNudge = 0.16;
      if (tap === 'skill') {
        input.skillHold = true;
        input.skillEdge = true;
        if (S.heroId !== 'noob') doSkill();
      }
      if (btn.id === 'btn-mine') startMine();
    };
    const up = () => {
      if (hold) input[hold] = false;
      if (tap === 'skill' || btn.id === 'btn-skill') input.skillHold = false;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (S.screen === 'intro') {
      skipIntro();
      return;
    }
    if (S.screen !== 'play' || S.chapter !== 1 || !player) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    if (y < safeTop() + 120) return;
    for (const r of rocks) {
      if (!r.alive) continue;
      if (Math.abs(r.x - x) < 36 && Math.abs(gy() - y) < 70 && Math.abs(r.x - player.x) < 70) {
        startMine(r);
        return;
      }
    }
  });

  document.getElementById('screen-intro').addEventListener('pointerdown', skipIntro);
  document.getElementById('btn-start').addEventListener('click', () => {
    sfx('ui');
    ensureAudio();
    setScreen('select');
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (!S.heroId) return;
    sfx('ui');
    S.level = 1;
    startChapter(1);
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    sfx('ui');
    openPause();
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    sfx('ui');
    resume();
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    sfx('ui');
    startChapter(S.chapter);
  });
  document.getElementById('btn-retry2').addEventListener('click', () => {
    sfx('ui');
    startChapter(S.chapter);
  });
  document.getElementById('btn-giveup').addEventListener('click', () => {
    sfx('ui');
    S.heroId = null;
    document.getElementById('btn-next').disabled = true;
    for (const c of document.querySelectorAll('.card')) c.classList.remove('selected');
    setScreen('select');
  });
  document.getElementById('btn-next-ch').addEventListener('click', () => {
    sfx('ui');
    startChapter(S.chapter + 1);
  });
  document.getElementById('btn-to-title').addEventListener('click', () => {
    sfx('ui');
    player = null;
    S.heroId = null;
    document.getElementById('btn-next').disabled = true;
    for (const c of document.querySelectorAll('.card')) c.classList.remove('selected');
    setScreen('title');
  });
  document.getElementById('btn-replay').addEventListener('click', () => {
    sfx('ui');
    player = null;
    S.heroId = null;
    S.level = 1;
    document.getElementById('btn-next').disabled = true;
    for (const c of document.querySelectorAll('.card')) c.classList.remove('selected');
    setScreen('title');
  });
  document.getElementById('btn-mute').addEventListener('click', () => {
    S.muted = !S.muted;
    document.getElementById('btn-mute').textContent = S.muted ? '소리 켜기' : '소리 끄기';
    if (!S.muted) sfx('ui');
  });

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') input.jump = true;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'j') input.attack = true;
    if (e.key === 'x' || e.key === 'X' || e.key === 'k') {
      input.skillHold = true;
      if (S.heroId !== 'noob') doSkill();
    }
    if (e.key === 'c' || e.key === 'C') startMine();
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (S.screen === 'play') openPause();
      else if (S.screen === 'pause') resume();
    }
    if (e.key === 'Enter' && S.screen === 'intro') skipIntro();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') input.jump = false;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'j') input.attack = false;
    if (e.key === 'x' || e.key === 'X' || e.key === 'k') input.skillHold = false;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.screen === 'play') openPause();
  });
}

window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(document.getElementById('app'));

buildCards();
resize();
setScreen('title');
bindControls();
requestAnimationFrame(loop);
