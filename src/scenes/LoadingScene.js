import Phaser from 'phaser';

const LOADING_DISPLAY_FONT = "'Lilita One', 'Bebas Neue', 'Segoe UI', sans-serif";
const LOADING_UI_FONT = "'Nunito', 'Rajdhani', 'Segoe UI', sans-serif";

export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super('LoadingScene');

    this.targetSceneKey = 'GameScene';
    this.targetData = {};
    this.loadingLabel = 'Prepping Shift';
    this.readyLabel = 'Line Ready';

    this.readyEventName = '';
    this.readyListener = null;
    this.awaitingToken = null;
    this.isFinishing = false;

    this.loadingText = null;
    this.loadingDotsText = null;
    this.progressFill = null;
    this.progressGlow = null;

    this.dotsEvent = null;
    this.fallbackEvent = null;
  }

  init(data) {
    this.targetSceneKey = typeof data?.targetSceneKey === 'string' ? data.targetSceneKey : 'GameScene';
    this.targetData = data?.targetData && typeof data.targetData === 'object' ? { ...data.targetData } : {};
    this.loadingLabel = typeof data?.loadingLabel === 'string' ? data.loadingLabel : 'Prepping Shift';
    this.readyLabel = typeof data?.readyLabel === 'string' ? data.readyLabel : 'Line Ready';

    this.readyEventName = `scene-ready:${this.targetSceneKey}`;
    this.readyListener = null;
    this.awaitingToken = null;
    this.isFinishing = false;
    this.dotsEvent = null;
    this.fallbackEvent = null;
  }

  create() {
    this.createVisuals();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.launchTargetScene();
  }

  createVisuals() {
    this.add.rectangle(640, 360, 1280, 720, 0x2a100a, 1).setDepth(-30);

    const grid = this.add.graphics().setDepth(-29);
    grid.lineStyle(1, 0x7a4327, 0.16);
    for (let x = 32; x <= 1248; x += 84) {
      grid.lineBetween(x, 0, x, 720);
    }
    for (let y = 16; y <= 704; y += 64) {
      grid.lineBetween(0, y, 1280, y);
    }

    const topGlow = this.add.circle(280, 146, 270, 0xf59e0b, 0.15).setDepth(-28).setBlendMode(Phaser.BlendModes.ADD);
    const botGlow = this.add.circle(1020, 580, 320, 0x34d399, 0.11).setDepth(-28).setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: [topGlow, botGlow],
      alpha: { from: 0.08, to: 0.2 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    const panelShadow = this.add.rectangle(640, 362, 820, 300, 0x1b0905, 0.52).setDepth(10);
    const panel = this.add.rectangle(640, 356, 820, 300, 0x4a2012, 0.95).setDepth(11).setStrokeStyle(2, 0xf0bd85, 1);
    const panelStrip = this.add.rectangle(640, 252, 774, 34, 0xffffff, 0.13).setDepth(12);

    const title = this.add
      .text(640, 182, 'ASSEMBLY LINE CHAOS', {
        fontFamily: LOADING_DISPLAY_FONT,
        fontSize: '64px',
        color: '#fff0da',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(13)
      .setLetterSpacing(1.4)
      .setShadow(0, 3, '#000000', 8);

    if (title.width > 740) {
      const fitScale = 740 / title.width;
      title.setScale(fitScale);
    }

    this.loadingText = this.add
      .text(640, 254, this.loadingLabel, {
        fontFamily: LOADING_UI_FONT,
        fontSize: '30px',
        color: '#ffd9b3',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(13)
      .setLetterSpacing(1);

    this.loadingDotsText = this.add
      .text(640, 306, 'Loading', {
        fontFamily: LOADING_UI_FONT,
        fontSize: '24px',
        color: '#ffe9cf',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(13)
      .setLetterSpacing(0.9);

    const progressTrack = this.add.rectangle(640, 378, 430, 18, 0x1b0905, 0.8).setDepth(12).setStrokeStyle(1, 0xf0bd85, 0.6);
    this.progressGlow = this.add.rectangle(425, 378, 112, 24, 0x34d399, 0.2).setOrigin(0, 0.5).setDepth(13);
    this.progressFill = this.add.rectangle(425, 378, 112, 14, 0x34d399, 1).setOrigin(0, 0.5).setDepth(14);

    this.tweens.add({
      targets: [this.progressFill, this.progressGlow],
      displayWidth: { from: 112, to: 386 },
      duration: 640,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    const helperText = this.add
      .text(640, 438, 'Calibrating belts, claws, and chest orders...', {
        fontFamily: LOADING_UI_FONT,
        fontSize: '22px',
        color: '#ffd6ab',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(13);

    this.tweens.add({
      targets: [panelShadow, panel, panelStrip, title, this.loadingText, this.loadingDotsText, progressTrack, this.progressGlow, this.progressFill, helperText],
      alpha: { from: 0, to: 1 },
      duration: 220,
      ease: 'Quad.Out'
    });

    const entryWipe = this.add.rectangle(1280, 360, 1280, 720, 0x1b0905, 1).setOrigin(1, 0.5).setDepth(200);
    const entryWipeAccent = this.add.rectangle(1280, 360, 1280, 720, 0xf59e0b, 0.13).setOrigin(1, 0.5).setDepth(201);
    this.tweens.add({
      targets: [entryWipe, entryWipeAccent],
      displayWidth: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => {
        entryWipe.destroy();
        entryWipeAccent.destroy();
      }
    });

    this.dotsEvent = this.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => {
        if (!this.loadingDotsText?.active || this.isFinishing) {
          return;
        }

        const currentText = this.loadingDotsText.text || 'Loading';
        const dotCount = (currentText.match(/\./g) || []).length;
        const nextDots = '.'.repeat((dotCount + 1) % 4);
        this.loadingDotsText.setText(`Loading${nextDots}`);
      }
    });
  }

  launchTargetScene() {
    const loadingToken = Phaser.Utils.String.UUID();
    const launchData = {
      ...this.targetData,
      loadingToken
    };

    this.awaitingToken = loadingToken;

    this.readyListener = (payload) => {
      if (payload?.loadingToken !== this.awaitingToken) {
        return;
      }

      this.finishLoading();
    };

    this.game.events.on(this.readyEventName, this.readyListener);

    this.time.delayedCall(80, () => {
      if (this.scene.isActive(this.targetSceneKey) || this.scene.isSleeping(this.targetSceneKey)) {
        this.scene.stop(this.targetSceneKey);
      }

      this.scene.launch(this.targetSceneKey, launchData);
      this.scene.bringToTop(this.scene.key);
    });

    this.fallbackEvent = this.time.delayedCall(12000, () => {
      if (this.isFinishing) {
        return;
      }

      if (this.scene.isActive(this.targetSceneKey)) {
        this.finishLoading();
      }
    });
  }

  finishLoading() {
    if (this.isFinishing) {
      return;
    }

    this.isFinishing = true;

    if (this.loadingText?.active) {
      this.loadingText.setText(this.readyLabel);
    }

    if (this.loadingDotsText?.active) {
      this.loadingDotsText.setText('Ready');
    }

    if (this.progressFill?.active) {
      this.tweens.killTweensOf([this.progressFill, this.progressGlow]);
      this.tweens.add({
        targets: [this.progressFill, this.progressGlow],
        displayWidth: 430,
        duration: 140,
        ease: 'Quad.Out'
      });
    }

    this.time.delayedCall(120, () => {
      const exitWipe = this.add.rectangle(0, 360, 0, 720, 0x1b0905, 1).setOrigin(0, 0.5).setDepth(220);
      const exitWipeAccent = this.add.rectangle(0, 360, 0, 720, 0xf59e0b, 0.13).setOrigin(0, 0.5).setDepth(221);

      this.tweens.add({
        targets: [exitWipe, exitWipeAccent],
        displayWidth: 1280,
        duration: 240,
        ease: 'Cubic.In',
        onComplete: () => {
          this.scene.bringToTop(this.targetSceneKey);
          this.scene.stop(this.scene.key);
        }
      });
    });
  }

  handleShutdown() {
    if (this.readyListener) {
      this.game.events.off(this.readyEventName, this.readyListener);
      this.readyListener = null;
    }

    this.awaitingToken = null;

    if (this.dotsEvent) {
      this.dotsEvent.remove(false);
      this.dotsEvent = null;
    }

    if (this.fallbackEvent) {
      this.fallbackEvent.remove(false);
      this.fallbackEvent = null;
    }
  }
}
