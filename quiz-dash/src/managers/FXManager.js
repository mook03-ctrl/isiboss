window.FXManager = class FXManager {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.flow = "cruise";
    this.lines = [];
    for (let i = 0; i < 22; i += 1) this.lines.push(this.spawnLine(true));
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(48);
    this.sfx = window.QuizDashSfx;
    const spark = {
      lifespan: { min: 160, max: 380 },
      speed: { min: 30, max: 170 },
      angle: { min: 155, max: 205 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: "ADD",
      follow: player,
      followOffset: { x: -78, y: 6 },
    };
    this.idle = scene.add.particles(0, 0, "spark", Object.assign({}, spark, { frequency: 36, tint: 0x7ef6ff, quantity: 1 })).setDepth(18);
    this.green = scene.add.particles(0, 0, "spark", Object.assign({}, spark, {
      frequency: 12,
      quantity: 3,
      tint: [0x14ff8a, 0x7dfff6, 0xd8ffe8],
      speed: { min: 40, max: 220 },
      scale: { start: 1.45, end: 0 },
    })).setDepth(18);
    this.red = scene.add.particles(0, 0, "spark", Object.assign({}, spark, {
      frequency: 8,
      quantity: 3,
      tint: [0xff1a36, 0xff6a1a, 0xffe0a8],
      speed: { min: 90, max: 360 },
      scale: { start: 1.7, end: 0 },
      lifespan: { min: 140, max: 320 },
    })).setDepth(18);
    this.purple = scene.add.particles(0, 0, "spark", Object.assign({}, spark, {
      frequency: 16,
      quantity: 1,
      tint: [0x7a1cff, 0xff2bd6, 0x2a0638],
      speed: { min: 40, max: 240 },
      angle: { min: 140, max: 220 },
    })).setDepth(18);
    this.burst = scene.add.particles(0, 0, "spark", {
      lifespan: { min: 280, max: 640 },
      speed: { min: 80, max: 420 },
      scale: { start: 0.9, end: 0 },
      blendMode: "ADD",
      emitting: false,
      gravityY: 200,
    }).setDepth(30);
    this.setFlow("cruise");
    this.beatAt = 0;
    this.step = 0;
  }

  setFlow(flow) {
    this.flow = flow;
    this.idle.emitting = flow === "cruise";
    this.green.emitting = flow === "right";
    this.red.emitting = flow === "wrong";
    this.purple.emitting = flow === "wrong";
  }

  spawnLine(anyY) {
    return {
      y: anyY ? Math.random() * 960 : 860 + Math.random() * 80,
      x: Math.random() * 720,
      w: 40 + Math.random() * 120,
      v: 0.4 + Math.random() * 1.4,
      a: 0.15 + Math.random() * 0.5,
    };
  }

  update(time, dt, speed) {
    const rush = this.flow === "wrong" ? 1 : this.flow === "right" ? 0.42 : 0.12;
    this.gfx.clear();
    if (rush > 0.05) {
      this.lines.forEach((line) => {
        line.x -= (speed * 0.02 + 8) * line.v * (0.35 + rush) * (dt / 16.6);
        if (line.x + line.w < 0) {
          line.x = 740 + Math.random() * 80;
          line.y = Math.random() * 960;
          line.w = 30 + rush * 160 * Math.random();
        }
        const color = this.flow === "wrong" ? 0xff3355 : 0x9dfff4;
        this.gfx.lineStyle(this.flow === "wrong" ? 3 : 2, color, Math.min(0.85, line.a * rush * 1.4));
        this.gfx.beginPath();
        this.gfx.moveTo(line.x, line.y);
        this.gfx.lineTo(line.x + line.w * (0.6 + rush), line.y);
        this.gfx.strokePath();
      });
    }
    if (!this.sfx || !window.QuizDash.sound) return;
    const bpm = this.flow === "wrong" ? 184 : 118;
    if (time >= this.beatAt) {
      this.beatAt = time + 60000 / bpm / 2;
      this.step += 1;
      if (this.step % 2 === 0) this.sfx.kick(this.flow === "wrong" ? 90 : 120);
      else this.sfx.hat(this.flow === "wrong" ? 0.03 : 0.018);
    }
  }

  explode(x, y, correct) {
    try {
      this.burst.setParticleTint(correct ? 0x39ffb0 : 0xff2a3c);
      this.burst.explode(correct ? 28 : 42, x, y);
    } catch (err) { /* burst is visual only */ }
  }

  jump() { if (this.sfx) this.sfx.tone(560, 0.07, "square", 0.035, 880); }
  coin() { if (this.sfx) this.sfx.tone(980, 0.05, "square", 0.03, 1400); }
  pad() { if (this.sfx) this.sfx.tone(220, 0.12, "sawtooth", 0.04, 720); }
  correct() {
    if (!this.sfx) return;
    this.sfx.tone(523, 0.08, "triangle", 0.05, 659);
    setTimeout(() => this.sfx.tone(784, 0.12, "triangle", 0.05), 90);
  }
  wrong() {
    if (!this.sfx) return;
    this.sfx.tone(180, 0.18, "sawtooth", 0.05, 70);
  }
  die() {
    if (!this.sfx) return;
    this.sfx.tone(420, 0.22, "sawtooth", 0.06, 60);
  }
  chapter() {
    if (!this.sfx) return;
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => this.sfx.tone(freq, 0.1, "triangle", 0.04), i * 90);
    });
  }
};

window.QuizDashSfx = {
  ctx: null,
  ensure() {
    if (!window.QuizDash.sound) return null;
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  tone(freq, dur, type, gain, slide) {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain || 0.04, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  },
  kick(freq) {
    this.tone(freq || 120, 0.09, "sine", 0.08, 48);
  },
  hat(gain) {
    const ctx = this.ensure();
    if (!ctx) return;
    const frames = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    src.buffer = buffer;
    amp.gain.value = gain || 0.02;
    src.connect(amp);
    amp.connect(ctx.destination);
    src.start();
  },
};
