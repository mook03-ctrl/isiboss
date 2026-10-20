const QD_W = 720;
const QD_H = 960;
const QD_BOT = 760;
const QD_TOP = 612;
const QD_FH = 48;
const QD_CUBE = 92;
const QD_FLOAT_G = 280;
const QD_LIFT = -340;
const QD_SINK = 210;

window.GameScene = class GameScene extends Phaser.Scene {
  constructor() { super("game"); }

  create() {
    this.name = window.QuizDash.playerName || "Player";
    this.quiz = new window.QuizManager(1);
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.multiplier = 1;
    this.gatesDone = 0;
    this.flow = "cruise";
    this.phase = "cruise";
    this.cursor = 0;
    this.pathY = QD_BOT;
    this.pathKind = "cruise";
    this.pathEnd = 0;
    this.nextGateX = 860;
    this.beat = 0;
    this.dead = false;
    this.paused = false;
    this.gate = null;
    this.hintOn = true;
    this.speedCurrent = 250;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.padLock = 0;
    this.landSquash = 0;
    this.wasAir = false;
    this.scoreAcc = 0;
    this.hudAcc = 0;
    this.shakeAcc = 0;
    this.decor = [];
    this.reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.physics.world.setBounds(0, -400, 2000000, 1600);
    this.cameras.main.setBackgroundColor("#07041a");
    this.cameras.main.roundPixels = false;
    this.cameras.main.setBounds(0, 0, 2000000, QD_H);
    this.physics.world.gravity.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.jumpArmed = false;

    this.add.tileSprite(0, 0, QD_W, QD_H, "sky").setOrigin(0).setScrollFactor(0).setDepth(0);
    this.stars = this.add.tileSprite(0, 0, QD_W, QD_H, "stars").setOrigin(0).setScrollFactor(0).setDepth(1);
    this.mount = this.add.tileSprite(0, 470, QD_W, 200, "mount").setOrigin(0).setScrollFactor(0).setDepth(3).setAlpha(0.95);
    this.grid = this.add.tileSprite(0, 560, QD_W, 400, "grid").setOrigin(0).setScrollFactor(0).setDepth(4).setAlpha(0.4);
    this.wash = this.add.rectangle(QD_W / 2, QD_H / 2, QD_W, QD_H, 0x000000, 0).setScrollFactor(0).setDepth(46);

    this.floors = this.physics.add.staticGroup();
    this.hazards = this.physics.add.group({ allowGravity: false, immovable: true });
    this.pickups = this.physics.add.group({ allowGravity: false, immovable: true });

    this.addFloor(0, 520, QD_BOT, "cruise");
    this.cursor = 520;

    this.player = this.physics.add.image(250, 500, "cube");
    this.player.setDepth(22);
    this.player.setScale(QD_CUBE / 64);
    this.player.body.setAllowGravity(false);
    this.player.body.setSize(56, 56, true);
    this.player.body.reset(250, 500);
    this.vy = 60;
    this.grounded = false;
    try { if (this.player.preFX) this.glow = this.player.preFX.addGlow(0x7efbff, 4, 0, false, 0.12, 10); } catch (err) { /* optional */ }

    this.physics.add.overlap(this.player, this.hazards, () => this.die());
    this.physics.add.overlap(this.player, this.pickups, (_p, item) => this.touchItem(item));

    this.fx = new window.FXManager(this, this.player);
    this.speedCurrent = this.targetSpeed();
    this.ensure();

    this.time.delayedCall(180, () => { this.jumpArmed = true; });
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });
    this.input.keyboard.on("keydown-SPACE", () => this.requestJump());
    this.input.keyboard.on("keydown-UP", () => this.requestJump());
    this.input.keyboard.on("keydown-W", () => this.requestJump());

    window.QuizDash.emit("hud", this.hud());
    window.QuizDash.emit("chapter", Object.assign({ intro: true }, this.quiz.meta()));
    window.QuizDash.emit("hint", true);
  }

  requestJump() {
    if (this.dead || this.paused || !this.jumpArmed) return;
    this.jumpBuffer = 160;
    if (window.QuizDashSfx) window.QuizDashSfx.ensure();
  }

  targetSpeed() {
    const tier = this.quiz ? this.quiz.tier : 1;
    const chapter = this.quiz ? this.quiz.chapter : 1;
    const base = Math.min(400, 228 + (tier - 1) * 26 + (chapter - 1) * 4);
    if (this.flow === "wrong") return base * 1.5;
    if (this.flow === "right") return base * 1.04;
    return base;
  }

  pathLength() {
    return 3000 + Math.min(8, this.quiz.chapter) * 70;
  }

  hud() {
    let gate = this.gatesDone;
    if (this.phase === "wait") gate += 1;
    return {
      score: Math.floor(this.score),
      chapter: this.quiz.chapter,
      subject: this.quiz.subject.ko,
      gate: Math.min(5, Math.max(1, gate)),
      combo: this.combo,
      multiplier: this.multiplier,
      name: this.name,
      flow: this.flow,
    };
  }

  ensure() {
    const horizon = this.player.x + 1500;
    let guard = 0;
    while (this.cursor < horizon && guard < 24) {
      guard += 1;
      if (this.phase === "wait") return;
      if (this.phase === "cruise") {
        if (this.cursor >= this.nextGateX - 1) {
          this.buildGate();
          return;
        }
        const len = Math.max(24, Math.min(320, this.nextGateX - this.cursor));
        this.addFloor(this.cursor, len, QD_BOT, "cruise");
        if (len > 140 && Math.random() < 0.55) this.addCoin(this.cursor + len * 0.5, QD_BOT - 78);
        if (len > 280 && (this.gatesDone > 0 || this.quiz.chapter > 1) && this.cursor - (this.lastAirX || 0) > 1400) {
          this.addBomb(this.cursor + len * 0.7, 250);
        }
        this.cursor += len;
      } else if (this.phase === "path") {
        if (this.cursor >= this.pathEnd) this.beginMerge();
        else this.addBeat();
      } else if (this.phase === "merge") {
        this.stepMerge();
      }
    }
  }

  buildGate() {
    const q = this.quiz.next();
    const lead = Math.max(760, this.targetSpeed() * 2.4);
    this.addFloor(this.cursor, lead, QD_BOT, "cruise");
    this.cursor += lead;
    const fork = 560;
    this.addFloor(this.cursor, fork, QD_BOT, "cruise");
    const topX = this.cursor + 150;
    const topW = 360;
    this.addFloor(topX, topW, QD_TOP, "cruise");
    this.addPortal(topX + 170, QD_TOP, "A", q.A);
    this.addPortal(this.cursor + 230, QD_BOT, "B", q.B);
    this.gate = {
      open: true,
      topX,
      topW,
      lockX: this.cursor + fork - 30,
      q,
    };
    this.cursor += fork;
    this.phase = "wait";
    window.QuizDash.emit("question", q);
  }

  addBeat() {
    if (this.safeUntil && this.cursor < this.safeUntil) {
      const len = Math.min(280, this.safeUntil - this.cursor);
      this.addFloor(this.cursor, len, this.pathY, this.pathKind);
      if (this.pathKind === "right") this.addCoin(this.cursor + len * 0.5, this.pathY - 110);
      this.cursor += len;
      return;
    }
    const y = this.pathY;
    const spd = Math.max(220, this.speedCurrent);
    const hard = this.pathKind === "wrong";
    const fierce = hard && this.quiz.tier >= 2;
    const n = this.beat % 5;
    this.beat += 1;
    if (!hard) {
      if (n === 0) this.beatCoins(y, spd);
      else if (n === 1) this.beatGap(y, spd, 0.28, 0.72);
      else if (n === 2) this.beatSpikes(y, spd, 1, hard);
      else if (n === 3) this.beatAirBombs(y, spd);
      else this.beatPad(y, spd, false);
      return;
    }
    if (n === 0) this.beatSpikes(y, spd, fierce ? 2 : 1, true);
    else if (n === 1) this.beatAirBombs(y, spd);
    else if (n === 2) this.beatGap(y, spd, fierce ? 0.4 : 0.33, fierce ? 0.46 : 0.58);
    else if (n === 3) this.beatPit(y, spd);
    else if (fierce) this.beatCeiling(y, spd);
    else this.beatSpikes(y, spd, 2, true);
  }

  beatCoins(y, spd) {
    const len = Math.max(280, spd * 0.9);
    this.addFloor(this.cursor, len, y, this.pathKind);
    for (let i = 0; i < 4; i += 1) {
      const arch = Math.sin((i / 3) * Math.PI) * 78;
      this.addCoin(this.cursor + 50 + i * ((len - 90) / 4), y - 64 - arch);
    }
    this.cursor += len;
  }

  beatGap(y, spd, gapFactor, platFactor) {
    const hard = this.pathKind === "wrong";
    const lead = hard ? Math.max(150, spd * 0.38) : Math.max(320, spd * 1.05);
    this.addFloor(this.cursor, lead, y, this.pathKind);
    this.cursor += lead;
    const gap = hard ? Math.max(100, spd * gapFactor) : Math.max(72, spd * gapFactor * 0.82);
    const plat = hard ? Math.max(130, spd * 0.4) : Math.max(220, spd * platFactor);
    this.cursor += gap;
    this.addFloor(this.cursor, plat, y, this.pathKind);
    this.addCoin(this.cursor + plat * 0.5, y - 96);
    this.cursor += plat;
  }

  beatSpikes(y, spd, count, hard) {
    const breathe = hard ? Math.max(120, spd * 0.28) : Math.max(340, spd * 1.15);
    this.addFloor(this.cursor, breathe, y, this.pathKind);
    this.cursor += breathe;
    const tight = hard ? (this.quiz.tier >= 2 ? 0.62 : 0.74) : 2.15;
    const spacing = hard ? Math.max(200, spd * tight) : Math.max(460, spd * tight);
    const len = spacing * count + (hard ? 110 : 300);
    this.addFloor(this.cursor, len, y, this.pathKind);
    for (let i = 0; i < count; i += 1) {
      const x = this.cursor + (hard ? 80 : 240) + i * spacing;
      if (hard && i % 2 === 1) this.addSaw(x, y - 22, true);
      else this.addSpike(x, y);
    }
    this.cursor += len;
  }

  beatPit(y, spd) {
    const pre = Math.max(150, spd * 0.36);
    const gap = Math.max(120, spd * (this.quiz.tier >= 2 ? 0.46 : 0.38));
    const plat = Math.max(140, spd * 0.38);
    this.addFloor(this.cursor, pre, y, this.pathKind);
    const pit = this.cursor + pre;
    this.addSaw(pit + gap * 0.5, y + 46, true);
    this.cursor = pit + gap;
    this.addFloor(this.cursor, plat, y, this.pathKind);
    this.cursor += plat;
  }

  beatPad(y, spd, required) {
    const pre = Math.max(380, spd * 1.2);
    this.addFloor(this.cursor, pre, y, this.pathKind);
    this.addPad(this.cursor + pre - 40, y);
    this.cursor += pre;
    const gap = Math.max(96, spd * (required ? 0.42 : 0.24));
    this.cursor += gap;
    const plat = Math.max(170, spd * 0.55);
    this.addFloor(this.cursor, plat, y, this.pathKind);
    this.addCoin(this.cursor + plat * 0.4, y - 168);
    this.addCoin(this.cursor + plat * 0.62, y - 120);
    this.cursor += plat;
  }

  beatAirBombs(y, spd) {
    const hard = this.pathKind === "wrong";
    const len = hard ? Math.max(520, spd * 1.55) : Math.max(1100, spd * 4.2);
    this.addFloor(this.cursor, len, y, this.pathKind);
    if (hard) {
      this.addBomb(this.cursor + len * 0.3, 220);
      this.addBomb(this.cursor + len * 0.72, 300);
    } else {
      this.addBomb(this.cursor + len * 0.55, 240);
    }
    this.cursor += len;
  }

  beatCeiling(y, spd) {
    const breathe = Math.max(110, spd * 0.26);
    this.addFloor(this.cursor, breathe, y, this.pathKind);
    this.cursor += breathe;
    const spikeAt = spd * 0.32;
    const barAt = spikeAt + spd * 0.72;
    const len = Math.max(barAt + spd * 0.45, spd * 1.7);
    this.addFloor(this.cursor, len, y, this.pathKind);
    this.addSpike(this.cursor + spikeAt, y);
    this.addBar(this.cursor + barAt, y - 220);
    this.cursor += len;
  }

  beginMerge() {
    this.rewardPath();
    if (Math.abs(this.pathY - QD_BOT) < 6) {
      this.finishMerge();
      return;
    }
    this.phase = "merge";
    this.mergeY = this.pathY;
  }

  stepMerge() {
    if (this.mergeY >= QD_BOT - 4) {
      this.addFloor(this.cursor, 240, QD_BOT, "cruise");
      this.cursor += 240;
      this.finishMerge();
      return;
    }
    this.addFloor(this.cursor, 210, this.mergeY, "cruise");
    this.cursor += 176;
    this.mergeY = Math.min(QD_BOT, this.mergeY + 88);
  }

  finishMerge() {
    this.phase = "cruise";
    this.pathY = QD_BOT;
    this.flow = "cruise";
    this.fx.setFlow("cruise");
    window.QuizDash.emit("status", { flow: "cruise" });
    let bridge = 1020;
    if (this.gatesDone >= 5) {
      this.gatesDone = 0;
      this.quiz.setChapter(this.quiz.chapter + 1);
      bridge = 1680;
      this.fx.chapter();
      window.QuizDash.emit("chapter", this.quiz.meta());
    }
    this.nextGateX = this.cursor + bridge;
  }

  rewardPath() {
    if (this.pathRewarded) return;
    this.pathRewarded = true;
    if (this.flow === "wrong" && !this.dead) {
      const bonus = 160 + this.quiz.chapter * 30;
      this.score += bonus;
      this.float("+" + bonus + " SURVIVE", "#ffb4c8");
    }
  }

  lockChoice(which) {
    if (!this.gate || !this.gate.open || this.dead) return;
    this.gate.open = false;
    this.hintOn = false;
    window.QuizDash.emit("hint", false);
    const correct = which === this.gate.q.answer;
    this.flow = correct ? "right" : "wrong";
    this.pathKind = this.flow;
    this.pathRewarded = false;
    this.gatesDone += 1;
    if (which === "A") {
      this.cursor = this.gate.topX + this.gate.topW;
      this.pathY = QD_TOP;
    } else {
      this.pathY = QD_BOT;
    }
    this.pathEnd = this.cursor + this.pathLength();
    this.phase = "path";
    this.beat = 0;
    const runway = this.flow === "wrong" ? 0.55 : 1.2;
    this.safeUntil = this.cursor + Math.max(this.flow === "wrong" ? 280 : 520, this.targetSpeed() * runway);
    if (correct) {
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.multiplier = 2;
      const bonus = 200 * this.combo;
      this.score += bonus;
      this.float("+" + bonus + "  x" + this.combo, "#b8ffe9");
      this.fx.correct();
      if (!this.reduce) this.cameras.main.flash(160, 80, 255, 190, true);
    } else {
      this.combo = 0;
      this.multiplier = 1;
      this.float("WRONG PATH", "#ff8aa0");
      this.fx.wrong();
      if (!this.reduce) {
        this.cameras.main.shake(420, 0.012);
        this.cameras.main.flash(140, 255, 40, 60, true);
      }
    }
    this.fx.setFlow(this.flow);
    this.fx.explode(this.player.x, this.player.y, correct);
    window.QuizDash.emit("question-hide");
    window.QuizDash.emit("status", { flow: this.flow, combo: this.combo, multiplier: this.multiplier });
    this.ensure();
  }

  resolveChoice() {
    const g = this.gate;
    if (!g || !g.open) return;
    const onTop = this.player.y < (QD_TOP + QD_BOT) / 2 && this.player.x > g.topX + 16;
    if (onTop) this.lockChoice("A");
    else if (this.player.x > g.lockX) this.lockChoice("B");
  }

  addFloor(x, len, surfaceY, kind) {
    if (len < 8) return null;
    const cx = x + len / 2;
    const cy = surfaceY + QD_FH / 2;
    const tile = this.floors.create(cx, cy, "ground");
    tile.setDisplaySize(len + 2, QD_FH);
    tile.refreshBody();
    tile.body.checkCollision.left = false;
    tile.body.checkCollision.right = false;
    tile.body.checkCollision.down = false;
    const tint = kind === "wrong" ? 0xff3355 : kind === "right" ? 0x3dffc8 : 0x3de4ff;
    tile.setTint(tint);
    tile.setDepth(8);
    return tile;
  }

  addSpike(x, surfaceY) {
    const s = this.hazards.create(x, surfaceY - 20, "spike");
    s.setDisplaySize(34, 40);
    s.body.setAllowGravity(false);
    s.body.setImmovable(true);
    s.body.setSize(16, 22, true);
    s.setDepth(12);
    s.setTint(this.pathKind === "wrong" ? 0xff2a55 : 0xff4d6a);
    return s;
  }

  addSaw(x, y, floorSaw) {
    const s = this.hazards.create(x, y, "saw");
    s.setDisplaySize(floorSaw ? 46 : 52, floorSaw ? 46 : 52);
    s.body.setAllowGravity(false);
    s.body.setImmovable(true);
    s.body.setSize(24, 24, true);
    s.setDepth(13);
    s.spin = true;
    s.setTint(0xff2bd6);
    return s;
  }

  addBomb(x, y) {
    const s = this.hazards.create(x, y, "bomb");
    s.setDisplaySize(72, 72);
    s.body.setAllowGravity(false);
    s.body.setImmovable(true);
    s.body.setSize(36, 36, true);
    s.setDepth(13);
    s.spin = true;
    s.spinRate = 0.16;
    this.lastAirX = x;
    return s;
  }

  addBar(x, y) {
    const s = this.hazards.create(x, y, "bar");
    s.setDisplaySize(128, 18);
    s.body.setAllowGravity(false);
    s.body.setImmovable(true);
    s.body.setSize(120, 14, true);
    s.setDepth(13);
    s.setTint(0xc86bff);
    return s;
  }

  addCoin(x, y) {
    const c = this.pickups.create(x, y, "coin");
    c.setDisplaySize(26, 26);
    c.body.setAllowGravity(false);
    c.body.setImmovable(true);
    c.body.setSize(20, 20, true);
    c.kind = "coin";
    c.setDepth(11);
    return c;
  }

  addPad(x, surfaceY) {
    const p = this.pickups.create(x, surfaceY - 8, "pad");
    p.setDisplaySize(54, 20);
    p.body.setAllowGravity(false);
    p.body.setImmovable(true);
    p.body.setSize(48, 16, true);
    p.kind = "pad";
    p.setDepth(11);
    return p;
  }

  addPortal(x, surfaceY, label, caption) {
    const p = this.add.image(x, surfaceY - 78, "portal").setDepth(14);
    p.setDisplaySize(68, 118);
    p.setTint(label === "A" ? 0x35f2ff : 0xff3df0);
    p.setBlendMode(Phaser.BlendModes.ADD);
    try {
      if (p.preFX) p.preFX.addGlow(label === "A" ? 0x35f2ff : 0xff3df0, 2, 0, false, 0.1, 6);
    } catch (err) { /* optional */ }
    this.tweens.add({ targets: p, alpha: 0.45, yoyo: true, repeat: -1, duration: 320 });
    const style = { fontFamily: "Orbitron, sans-serif", fontSize: "26px", color: "#ffffff", stroke: "#041018", strokeThickness: 4 };
    const letter = this.add.text(x, surfaceY - 84, label, style).setOrigin(0.5).setDepth(15);
    const cap = this.add.text(x, surfaceY - 128, caption, {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: "15px",
      color: "#f3fdff",
      align: "center",
      wordWrap: { width: 130 },
      stroke: "#120818",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    const lane = this.add.text(x, surfaceY - 36, label === "A" ? "위 길" : "아래 길", {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: "13px",
      color: label === "A" ? "#9dfff8" : "#ffb3f6",
    }).setOrigin(0.5).setDepth(15);
    this.decor.push(p, letter, cap, lane);
  }

  touchItem(item) {
    if (!item.active || this.dead) return;
    if (item.kind === "pad") {
      if (this.padLock > 0) return;
      this.padLock = 220;
      this.vy = -480;
      this.grounded = false;
      this.landSquash = 0;
      this.fx.pad();
      return;
    }
    item.disableBody(true, true);
    this.score += 20 * this.multiplier;
    this.fx.coin();
    this.float("+" + (20 * this.multiplier), "#ffe38a");
  }

  float(text, color) {
    const label = this.add.text(this.player.x, this.player.y - 36, text, {
      fontFamily: "Orbitron, sans-serif",
      fontSize: "18px",
      color: color || "#ffffff",
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: label,
      y: label.y - 48,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy(),
    });
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.player.setTint(0xff3355);
    this.vy = -420;
    this.grounded = false;
    this.fx.setFlow("cruise");
    this.fx.die();
    this.fx.explode(this.player.x, this.player.y, false);
    if (!this.reduce) this.cameras.main.shake(360, 0.02);
    window.QuizDash.emit("hint", false);
    window.QuizDash.emit("question-hide");
    this.time.delayedCall(720, () => {
      if (!this.sys.isActive()) return;
      window.QuizDash.emit("over", {
        name: this.name,
        score: Math.floor(this.score),
        chapter: this.quiz.chapter,
        subject: this.quiz.subject.ko,
        combo: this.bestCombo,
        gates: this.gatesDone,
        ts: Date.now(),
      });
    });
  }

  surfaceUnder(x, prevFeet, feet) {
    let best = null;
    const reach = Math.max(36, Math.abs(this.vy) * 0.04 + 24);
    this.floors.getChildren().forEach((floor) => {
      const b = floor.body;
      if (!b) return;
      if (x < b.left + 8 || x > b.right - 8) return;
      const surface = b.top;
      if (prevFeet <= surface + 18 && feet + 8 >= surface && feet - surface <= reach) {
        if (best == null || surface < best) best = surface;
      }
    });
    return best;
  }

  stepRunner(dt) {
    const step = dt / 1000;
    this.player.x += this.speedCurrent * step;
    this.padLock -= dt;
    if (this.jumpBuffer > 0) {
      this.vy = QD_LIFT;
      this.jumpBuffer = 0;
      this.fx.jump();
    }
    this.vy += QD_FLOAT_G * step;
    if (this.vy > QD_SINK) this.vy = QD_SINK;
    let nextY = this.player.y + this.vy * step;
    if (nextY < 168) {
      nextY = 168;
      if (this.vy < 0) this.vy = 0;
    }
    this.player.y = nextY;
    this.grounded = false;
    this.player.body.reset(this.player.x, this.player.y);
  }

  update(time, dt) {
    dt = Math.min(34, dt);
    if (this.paused) return;
    const sx = this.cameras.main.scrollX;
    this.stars.tilePositionX = sx * 0.08;
    this.mount.tilePositionX = sx * 0.28;
    this.grid.tilePositionX = sx * 0.55;

    if (!this.dead) {
      const goal = this.targetSpeed();
      this.speedCurrent += (goal - this.speedCurrent) * (this.flow === "wrong" ? 0.06 : 0.035);
      this.ensure();
      this.resolveChoice();
      this.stepRunner(dt);
      if (!this.reduce) {
        const tilt = Math.max(-16, Math.min(16, this.vy / 26));
        this.player.angle += (tilt - this.player.angle) * 0.12;
      }

      this.scoreAcc += this.speedCurrent * (dt / 1000);
      const mult = this.multiplier;
      while (this.scoreAcc >= 48) {
        this.scoreAcc -= 48;
        this.score += mult;
      }
      if (this.player.y > QD_BOT + 280) this.die();
      if (this.flow === "wrong") this.wash.setFillStyle(0xff1848, 0.08);
      else if (this.flow === "right") this.wash.setFillStyle(0x14ffb0, 0.06);
      else this.wash.setFillStyle(0x000000, 0);
    } else {
      this.vy += QD_FLOAT_G * (dt / 1000);
      this.player.y += this.vy * (dt / 1000);
      this.player.body.reset(this.player.x, this.player.y);
    }

    this.cameras.main.scrollX = Math.max(0, this.player.x - 230);
    this.hazards.getChildren().forEach((h) => { if (h.spin) h.angle += dt * (h.spinRate || 0.45); });
    this.fx.update(time, dt, this.speedCurrent);
    this.cleanup();
    this.hudAcc += dt;
    if (this.hudAcc > 120) {
      this.hudAcc = 0;
      window.QuizDash.emit("hud", this.hud());
    }
  }

  cleanup() {
    const left = this.cameras.main.scrollX - 360;
    [this.floors, this.hazards, this.pickups].forEach((group) => {
      group.getChildren().forEach((obj) => {
        const width = obj.displayWidth || 0;
        if (obj.x + width < left) obj.destroy();
      });
    });
    this.decor = this.decor.filter((obj) => {
      if (!obj.active && obj.scene == null) return false;
      if (obj.x < left) {
        obj.destroy();
        return false;
      }
      return true;
    });
  }
};
