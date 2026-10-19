window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor() { super("menu"); }

  create() {
    this.add.tileSprite(360, 480, 720, 960, "sky").setDepth(0);
    this.stars = this.add.tileSprite(360, 480, 720, 960, "stars").setDepth(1).setAlpha(0.9);
    this.add.image(500, 210, "sun").setDepth(2).setScale(0.9);
    this.mount = this.add.tileSprite(360, 560, 720, 260, "mount").setDepth(3);
    this.grid = this.add.tileSprite(360, 720, 720, 520, "grid").setDepth(4).setAlpha(0.4);
    this.floor = this.add.rectangle(360, 824, 760, 48, 0x123048).setDepth(5);
    this.physics.add.existing(this.floor, true);
    this.cube = this.physics.add.image(360, 680, "cube").setDepth(6);
    this.cube.setDisplaySize(78, 78);
    this.cube.body.setSize(52, 52, true);
    this.physics.add.collider(this.cube, this.floor);
    try { if (this.cube.preFX) this.cube.preFX.addGlow(0x7efbff, 4, 0, false, 0.12, 10); } catch (err) { /* glow is optional */ }
    this.time.addEvent({
      delay: 760,
      loop: true,
      callback: () => {
        const down = this.cube.body.blocked.down || this.cube.body.touching.down;
        if (down) this.cube.setVelocityY(-760);
      },
    });
  }

  update(_t, dt) {
    this.stars.tilePositionX += dt * 0.012;
    this.grid.tilePositionX += dt * 0.05;
    this.mount.tilePositionX += dt * 0.02;
    const down = this.cube.body.blocked.down || this.cube.body.touching.down;
    if (!down) this.cube.angle += dt * 0.45;
    else this.cube.angle *= 0.6;
  }
};
