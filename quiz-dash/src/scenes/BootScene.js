window.BootScene = class BootScene extends Phaser.Scene {
  constructor() { super("boot"); }

  create() {
    this.paint();
    this.scene.start("menu");
  }

  tex(key, w, h, draw) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    draw(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  paint() {
    this.tex("sky", 16, 1280, (g) => {
      g.fillGradientStyle(0x14082e, 0x14082e, 0x070414, 0x02010a, 1);
      g.fillRect(0, 0, 16, 1280);
      g.fillStyle(0xff2bd6, 0.16);
      g.fillEllipse(8, 430, 16, 220);
    });
    this.tex("stars", 128, 128, (g) => {
      for (let i = 0; i < 18; i += 1) {
        g.fillStyle(0xffffff, 0.25 + Math.random() * 0.75);
        g.fillCircle(Math.random() * 128, Math.random() * 128, Math.random() * 1.6 + 0.3);
      }
    });
    this.tex("grid", 96, 96, (g) => {
      g.lineStyle(2, 0x2de2ff, 0.45);
      g.strokeRect(0, 0, 96, 96);
      g.lineStyle(1, 0xff2bd6, 0.25);
      g.beginPath();
      g.moveTo(0, 96);
      g.lineTo(48, 48);
      g.lineTo(96, 96);
      g.strokePath();
    });
    this.tex("mount", 320, 180, (g) => {
      g.fillStyle(0x2b1460, 1);
      g.beginPath();
      g.moveTo(0, 180);
      g.lineTo(40, 90);
      g.lineTo(90, 140);
      g.lineTo(150, 40);
      g.lineTo(210, 120);
      g.lineTo(270, 60);
      g.lineTo(320, 180);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xff2bd6, 0.35);
      g.fillTriangle(150, 40, 168, 78, 132, 78);
    });
    this.tex("ground", 64, 64, (g) => {
      g.fillStyle(0xffffff, 0.16);
      g.fillRect(0, 8, 64, 56);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 64, 8);
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(0, 8, 64, 3);
    });
    this.tex("cube", 64, 64, (g) => {
      g.fillStyle(0x9dfff8, 0.25);
      g.fillRoundedRect(2, 2, 60, 60, 12);
      g.fillStyle(0x062028, 1);
      g.fillRoundedRect(8, 8, 48, 48, 8);
      g.lineStyle(4, 0xc8fff8, 1);
      g.strokeRoundedRect(8, 8, 48, 48, 8);
      g.fillStyle(0x39fff0, 0.85);
      g.fillRoundedRect(16, 16, 16, 16, 3);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(22, 20, 3);
    });
    this.tex("bomb", 72, 72, (g) => {
      const cx = 36;
      const cy = 38;
      g.fillStyle(0xff2a3c, 1);
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        const tip = angle;
        const left = angle - 0.34;
        const right = angle + 0.34;
        g.fillTriangle(
          cx + Math.cos(left) * 15,
          cy + Math.sin(left) * 15,
          cx + Math.cos(right) * 15,
          cy + Math.sin(right) * 15,
          cx + Math.cos(tip) * 34,
          cy + Math.sin(tip) * 34
        );
      }
      g.fillStyle(0x140810, 1);
      g.fillCircle(cx, cy, 16);
      g.fillStyle(0x2a0c14, 1);
      g.fillCircle(cx, cy, 13);
      g.lineStyle(3, 0xff3355, 1);
      g.strokeCircle(cx, cy, 13);
      g.fillStyle(0xfff1c4, 0.95);
      g.fillCircle(cx - 4, cy - 4, 3);
      g.fillStyle(0x6a3a16, 1);
      g.fillRect(cx - 2, 6, 4, 12);
      g.fillStyle(0xffe14a, 1);
      g.fillCircle(cx, 5, 3.5);
    });
    this.tex("spike", 48, 48, (g) => {
      g.fillStyle(0xffffff, 0.25);
      g.fillTriangle(24, 0, 46, 48, 2, 48);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(24, 6, 40, 46, 8, 46);
      g.fillStyle(0xffffff, 0.85);
      g.fillTriangle(24, 14, 30, 46, 18, 46);
    });
    this.tex("coin", 32, 32, (g) => {
      g.fillStyle(0xfff1a8, 1);
      g.fillCircle(16, 16, 14);
      g.lineStyle(3, 0xffb703, 1);
      g.strokeCircle(16, 16, 10);
      g.fillStyle(0xfffce4, 0.9);
      g.fillCircle(12, 11, 3);
    });
    this.tex("pad", 56, 24, (g) => {
      g.fillStyle(0xfff35a, 1);
      g.fillRoundedRect(0, 6, 56, 16, 6);
      g.lineStyle(3, 0xffffff, 0.9);
      g.beginPath();
      g.moveTo(16, 18);
      g.lineTo(28, 8);
      g.lineTo(40, 18);
      g.strokePath();
    });
    this.tex("portal", 80, 140, (g) => {
      g.lineStyle(8, 0xffffff, 0.95);
      g.strokeEllipse(40, 70, 52, 120);
      g.lineStyle(3, 0xffffff, 0.7);
      g.strokeEllipse(40, 70, 28, 78);
      g.fillStyle(0xffffff, 0.18);
      g.fillEllipse(40, 70, 24, 70);
    });
    this.tex("spark", 32, 32, (g) => {
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(16, 16, 8);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 3);
    });
    this.tex("saw", 64, 64, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(32, 32, 14);
      for (let i = 0; i < 10; i += 1) {
        const a = (Math.PI * 2 * i) / 10;
        const x = 32 + Math.cos(a) * 18;
        const y = 32 + Math.sin(a) * 18;
        g.fillTriangle(
          32 + Math.cos(a) * 10,
          32 + Math.sin(a) * 10,
          x + Math.cos(a + 0.4) * 8,
          y + Math.sin(a + 0.4) * 8,
          32 + Math.cos(a) * 30,
          32 + Math.sin(a) * 30
        );
      }
      g.fillStyle(0x111111, 1);
      g.fillCircle(32, 32, 6);
    });
    this.tex("bar", 16, 16, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(0, 2, 16, 12, 4);
    });
  }
};
