import Phaser from 'phaser';
import { DEBUG_LEVEL_ID, DEFAULT_LEVEL_ID } from '../data/levels';
import beforeFirstShiftUrl from '../../assets/audio/music/Before_the_First_Shift.mp3';

const MENU_MUSIC_GAIN = 0.82;
const MENU_DISPLAY_FONT = "'Lilita One', 'Bebas Neue', 'Segoe UI', sans-serif";
const MENU_UI_FONT = "'Nunito', 'Rajdhani', 'Segoe UI', sans-serif";
const MENU_FOOD_DECOR_GLOBS = {
  condiments: import.meta.glob('../../assets/sprites/condiments/*.png', { eager: true, import: 'default' }),
  carbs: import.meta.glob('../../assets/sprites/carb/*.png', { eager: true, import: 'default' }),
  protein: import.meta.glob('../../assets/sprites/protein/*.png', { eager: true, import: 'default' }),
  greens: import.meta.glob('../../assets/sprites/greens/*.png', { eager: true, import: 'default' })
};
const MENU_FOOD_COLORS = {
  condiments: 0xf97316,
  carbs: 0xfbbf24,
  protein: 0xfb7185,
  greens: 0x34d399
};

function pickPreviewUrl(spriteGlob) {
  const sorted = Object.entries(spriteGlob).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return sorted.length > 0 ? sorted[0][1] : null;
}

const MENU_FOOD_DECOR_TEXTURES = Object.entries(MENU_FOOD_DECOR_GLOBS).reduce((acc, [foodId, glob]) => {
  acc[foodId] = {
    key: `menu_food_${foodId}`,
    url: pickPreviewUrl(glob)
  };
  return acc;
}, {});

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');

    this.optionEntries = [];
    this.selectedIndex = 0;
    this.isTransitioning = false;

    this.menuMusicUrl = beforeFirstShiftUrl;
    this.menuAudioCtx = null;
    this.menuAudioGain = null;
    this.menuAudioBuffer = null;
    this.menuAudioLoadPromise = null;
    this.menuAudioSource = null;
    this.menuAudioPlaybackState = 'idle';
    this.menuAudioSessionToken = 0;

    this.globalUnlockInstalled = false;
    this.boundGlobalUnlock = null;
    this.keepMusicForCampaign = false;
    this.autoplayHammerIntervalId = null;
    this.autoplayHammerDeadlineAt = 0;
  }

  preload() {
    Object.values(MENU_FOOD_DECOR_TEXTURES).forEach((textureInfo) => {
      if (!textureInfo?.url) {
        return;
      }

      if (!this.textures.exists(textureInfo.key)) {
        this.load.image(textureInfo.key, textureInfo.url);
      }
    });
  }

  create() {
    this.isTransitioning = false;
    this.keepMusicForCampaign = false;
    this.optionEntries = [];
    this.selectedIndex = 0;

    this.add.rectangle(640, 360, 1280, 720, 0x2a100a, 1).setDepth(-40);

    const backTexture = this.add.graphics().setDepth(-39);
    backTexture.fillStyle(0x61311d, 0.15);
    for (let y = 16; y <= 704; y += 38) {
      backTexture.fillRect(0, y, 1280, 2);
    }

    const caramelLeft = this.add.circle(232, 132, 255, 0xf59e0b, 0.16).setDepth(-38).setBlendMode(Phaser.BlendModes.ADD);
    const berryTop = this.add.circle(980, 108, 220, 0xfb7185, 0.1).setDepth(-38).setBlendMode(Phaser.BlendModes.ADD);
    const mintBottom = this.add.circle(946, 604, 310, 0x34d399, 0.08).setDepth(-38).setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: [caramelLeft, berryTop, mintBottom],
      alpha: { from: 0.06, to: 0.22 },
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    const headerShadow = this.add.container(640, 102).setDepth(-34);
    const headerShadowMid = this.add.rectangle(0, 6, 780, 126, 0x1b0905, 0.4);
    const headerShadowLeft = this.add.circle(-390, 6, 63, 0x1b0905, 0.4);
    const headerShadowRight = this.add.circle(390, 6, 63, 0x1b0905, 0.4);
    headerShadow.add([headerShadowMid, headerShadowLeft, headerShadowRight]);

    const header = this.add.container(640, 98).setDepth(-33);
    const headerMid = this.add.rectangle(0, 0, 780, 126, 0xfde5bf, 1);
    const headerLeft = this.add.circle(-390, 0, 63, 0xfde5bf, 1);
    const headerRight = this.add.circle(390, 0, 63, 0xfde5bf, 1);
    const headerGlossMid = this.add.rectangle(0, -34, 744, 44, 0xffffff, 0.27);
    const headerGlossLeft = this.add.circle(-372, -34, 38, 0xffffff, 0.27);
    const headerGlossRight = this.add.circle(372, -34, 38, 0xffffff, 0.27);
    header.add([headerMid, headerLeft, headerRight, headerGlossMid, headerGlossLeft, headerGlossRight]);

    const foodDecorSlots = [
      { foodId: 'greens', x: 430, y: 212 },
      { foodId: 'protein', x: 542, y: 212 },
      { foodId: 'carbs', x: 738, y: 212 },
      { foodId: 'condiments', x: 850, y: 212 }
    ];

    foodDecorSlots.forEach((slot, index) => {
      const textureInfo = MENU_FOOD_DECOR_TEXTURES[slot.foodId];
      const fallbackColor = MENU_FOOD_COLORS[slot.foodId] || 0xfbbf24;
      const decorHalo = this.add.circle(slot.x, slot.y + 2, 31, 0xfff3de, 0.22).setDepth(14);
      const decorGlow = this.add
        .circle(slot.x, slot.y, 22, fallbackColor, 0.16)
        .setDepth(14)
        .setBlendMode(Phaser.BlendModes.ADD);

      let foodVisual;
      if (textureInfo?.url && this.textures.exists(textureInfo.key)) {
        foodVisual = this.add.image(slot.x, slot.y, textureInfo.key).setDepth(15);
        const maxDim = Math.max(foodVisual.width || 1, foodVisual.height || 1);
        foodVisual.setScale(46 / maxDim);
      } else {
        foodVisual = this.add.circle(slot.x, slot.y, 15, fallbackColor, 1).setDepth(15);
      }

      const baseScaleX = foodVisual.scaleX;
      const baseScaleY = foodVisual.scaleY;
      this.tweens.add({
        targets: [decorHalo, decorGlow, foodVisual],
        y: { from: slot.y - 5, to: slot.y + 5 },
        duration: 1900 + index * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      this.tweens.add({
        targets: foodVisual,
        angle: { from: -7, to: 7 },
        scaleX: { from: baseScaleX * 0.96, to: baseScaleX * 1.06 },
        scaleY: { from: baseScaleY * 0.96, to: baseScaleY * 1.06 },
        duration: 2200 + index * 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    });

    const title = this.add
      .text(640, 86, 'ASSEMBLY LINE CHAOS', {
        fontFamily: MENU_DISPLAY_FONT,
        fontSize: '62px',
        color: '#7e261b',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setLetterSpacing(1.2)
      .setShadow(0, 4, '#ffffff', 8);

    const maxTitleWidth = 744;
    if (title.width > maxTitleWidth) {
      const fitScale = maxTitleWidth / title.width;
      title.setScale(fitScale);
    }

    const strapline = this.add
      .text(640, 144, 'Prep fast. Plate clean. Keep the kitchen line alive.', {
        fontFamily: MENU_UI_FONT,
        fontSize: '24px',
        color: '#8a4e2f',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setShadow(0, 2, '#fff4de', 4);

    this.tweens.add({
      targets: title,
      scaleX: { from: 0.98, to: 1.02 },
      scaleY: { from: 0.98, to: 1.02 },
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    const menuItems = [
      {
        label: 'Campaign',
        accentColor: 0x34d399,
        baseColor: 0xd18b4b,
        selectedColor: 0xe7a25e,
        action: () => this.transitionTo('LevelSelectScene')
      },
      {
        label: 'Endless',
        accentColor: 0xf97316,
        baseColor: 0xba6b39,
        selectedColor: 0xd7834a,
        action: () => this.transitionTo('GameScene', { levelId: DEFAULT_LEVEL_ID })
      }
    ];

    const boardShadow = this.add.container(640, 426).setDepth(-32);
    const boardShadowMid = this.add.rectangle(0, 10, 1040, 360, 0x180804, 0.36);
    const boardShadowLeft = this.add.circle(-520, 10, 42, 0x180804, 0.36);
    const boardShadowRight = this.add.circle(520, 10, 42, 0x180804, 0.36);
    boardShadow.add([boardShadowMid, boardShadowLeft, boardShadowRight]);

    const board = this.add.container(640, 422).setDepth(-31);
    const boardMid = this.add.rectangle(0, 0, 1040, 360, 0x4a2012, 0.55);
    const boardLeft = this.add.circle(-520, 0, 42, 0x4a2012, 0.55);
    const boardRight = this.add.circle(520, 0, 42, 0x4a2012, 0.55);
    board.add([boardMid, boardLeft, boardRight]);

    const optionStartY = 356;
    const optionGap = 124;

    menuItems.forEach((item, index) => {
      const y = optionStartY + index * optionGap;

      const panel = this.add.container(640, y).setDepth(12);
      const shadowMid = this.add.rectangle(0, 8, 680, 88, 0x1a0a06, 0.45);
      const shadowLeft = this.add.circle(-340, 8, 44, 0x1a0a06, 0.45);
      const shadowRight = this.add.circle(340, 8, 44, 0x1a0a06, 0.45);

      const bodyMid = this.add.rectangle(0, 0, 680, 88, item.baseColor, 1);
      const bodyLeft = this.add.circle(-340, 0, 44, item.baseColor, 1);
      const bodyRight = this.add.circle(340, 0, 44, item.baseColor, 1);
      const glazeMid = this.add.rectangle(0, -18, 644, 30, 0xffffff, 0.17);
      const glazeLeft = this.add.circle(-322, -18, 15, 0xffffff, 0.17);
      const glazeRight = this.add.circle(322, -18, 15, 0xffffff, 0.17);
      const jamDot = this.add.circle(-304, 0, 10, item.accentColor, 1);

      const keycap = this.add.circle(304, 0, 20, 0xfff2de, 1);
      const keyLabel = this.add
        .text(keycap.x, keycap.y, String(index + 1), {
          fontFamily: MENU_DISPLAY_FONT,
          fontSize: '24px',
          color: '#7a3f24'
        })
        .setOrigin(0.5)
        .setLetterSpacing(0.5);

      const label = this.add
        .text(0, 0, item.label.toUpperCase(), {
          fontFamily: MENU_DISPLAY_FONT,
          fontSize: '58px',
          color: '#fff5e9'
        })
        .setOrigin(0.5)
        .setLetterSpacing(1.4)
        .setShadow(0, 2, '#6b3418', 4);

      const hitArea = this.add.zone(0, 0, 780, 104).setInteractive({ useHandCursor: true });

      const panelChildren = [
        shadowMid,
        shadowLeft,
        shadowRight,
        bodyMid,
        bodyLeft,
        bodyRight,
        glazeMid,
        glazeLeft,
        glazeRight,
        jamDot,
        keycap,
        keyLabel,
        label,
        hitArea
      ];
      panel.add(panelChildren);

      hitArea.on('pointerover', () => {
        if (this.isTransitioning) {
          return;
        }

        this.selectedIndex = index;
        this.refreshSelection();
      });

      hitArea.on('pointerdown', () => {
        if (this.isTransitioning) {
          return;
        }

        this.selectedIndex = index;
        this.refreshSelection();
        item.action();
      });

      panel.setAlpha(0);
      panel.setScale(0.97);
      panel.y += 16;

      this.tweens.add({
        targets: panel,
        alpha: 1,
        y: y,
        scaleX: 1,
        scaleY: 1,
        delay: 120 + index * 90,
        duration: 320,
        ease: 'Cubic.Out'
      });

      this.optionEntries.push({
        panel,
        bodyMid,
        bodyLeft,
        bodyRight,
        glazeMid,
        glazeLeft,
        glazeRight,
        jamDot,
        keycap,
        keyLabel,
        label,
        baseColor: item.baseColor,
        selectedColor: item.selectedColor,
        accentColor: item.accentColor,
        action: item.action,
        baseX: 640,
        selectionTween: null
      });
    });

    title.setAlpha(0);
    strapline.setAlpha(0);
    this.tweens.add({
      targets: [title, strapline],
      alpha: 1,
      duration: 360,
      ease: 'Quad.Out'
    });

    this.refreshSelection();
    this.bindInput();

    this.initMenuAudioSystem();
    this.ensureMenuMusicPlayback();
    this.startAutoplayHammer();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
  }

  bindInput() {
    this.input.keyboard?.on('keydown-UP', this.moveSelectionUp, this);
    this.input.keyboard?.on('keydown-W', this.moveSelectionUp, this);
    this.input.keyboard?.on('keydown-DOWN', this.moveSelectionDown, this);
    this.input.keyboard?.on('keydown-S', this.moveSelectionDown, this);
    this.input.keyboard?.on('keydown-ENTER', this.confirmSelection, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirmSelection, this);
    this.input.keyboard?.on('keydown', this.handleDebugShortcut, this);

    this.input.on('pointerdown', this.unlockMenuAudioContext, this);
    this.input.keyboard?.on('keydown', this.unlockMenuAudioContext, this);
    this.input.gamepad?.on('down', this.unlockMenuAudioContext, this);
    this.sound?.on(Phaser.Sound.Events.UNLOCKED, this.handleSoundUnlocked, this);

    this.installGlobalUnlockListeners();
  }

  installGlobalUnlockListeners() {
    if (this.globalUnlockInstalled || typeof window === 'undefined') {
      return;
    }

    this.boundGlobalUnlock = () => {
      this.unlockMenuAudioContext();
    };

    window.addEventListener('pointerdown', this.boundGlobalUnlock, { passive: true });
    window.addEventListener('touchstart', this.boundGlobalUnlock, { passive: true });
    window.addEventListener('keydown', this.boundGlobalUnlock);
    this.globalUnlockInstalled = true;
  }

  startAutoplayHammer() {
    if (this.autoplayHammerIntervalId || typeof window === 'undefined') {
      return;
    }

    this.autoplayHammerDeadlineAt = Date.now() + 15000;
    this.autoplayHammerIntervalId = window.setInterval(() => {
      if (this.isTransitioning || this.menuAudioPlaybackState === 'playing') {
        this.stopAutoplayHammer();
        return;
      }

      if (Date.now() > this.autoplayHammerDeadlineAt) {
        this.stopAutoplayHammer();
        return;
      }

      this.unlockMenuAudioContext();
      this.ensureMenuMusicPlayback();
    }, 280);
  }

  stopAutoplayHammer() {
    if (!this.autoplayHammerIntervalId || typeof window === 'undefined') {
      return;
    }

    window.clearInterval(this.autoplayHammerIntervalId);
    this.autoplayHammerIntervalId = null;
    this.autoplayHammerDeadlineAt = 0;
  }

  removeGlobalUnlockListeners() {
    if (!this.globalUnlockInstalled || typeof window === 'undefined' || !this.boundGlobalUnlock) {
      return;
    }

    window.removeEventListener('pointerdown', this.boundGlobalUnlock);
    window.removeEventListener('touchstart', this.boundGlobalUnlock);
    window.removeEventListener('keydown', this.boundGlobalUnlock);
    this.boundGlobalUnlock = null;
    this.globalUnlockInstalled = false;
  }

  initMenuAudioSystem() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const ctx = this.sound?.context || (AudioContextCtor ? new AudioContextCtor() : null);

    if (!ctx || typeof ctx.createGain !== 'function') {
      return;
    }

    this.menuAudioCtx = ctx;

    if (this.menuAudioGain) {
      this.menuAudioGain.disconnect();
    }

    this.menuAudioGain = ctx.createGain();
    this.menuAudioGain.gain.value = 0.0001;
    this.menuAudioGain.connect(ctx.destination);

    this.menuAudioPlaybackState = 'idle';
    this.menuAudioSessionToken += 1;

    this.loadMenuAudioBuffer();
  }

  loadMenuAudioBuffer() {
    if (!this.menuAudioCtx || !this.menuMusicUrl) {
      return Promise.resolve(null);
    }

    if (this.menuAudioBuffer) {
      return Promise.resolve(this.menuAudioBuffer);
    }

    if (this.menuAudioLoadPromise) {
      return this.menuAudioLoadPromise;
    }

    this.menuAudioLoadPromise = fetch(this.menuMusicUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Menu music fetch failed with status ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (!this.menuAudioCtx) {
          return null;
        }

        if (this.menuAudioCtx.decodeAudioData.length <= 1) {
          return this.menuAudioCtx.decodeAudioData(arrayBuffer.slice(0));
        }

        return new Promise((resolve, reject) => {
          this.menuAudioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        });
      })
      .then((buffer) => {
        if (!buffer) {
          return null;
        }

        this.menuAudioBuffer = buffer;
        return buffer;
      })
      .catch(() => null)
      .finally(() => {
        this.menuAudioLoadPromise = null;
      });

    return this.menuAudioLoadPromise;
  }

  ensureMenuMusicPlayback() {
    if (
      this.isTransitioning
      || !this.menuAudioCtx
      || !this.menuAudioGain
      || this.menuAudioPlaybackState !== 'idle'
      || this.menuAudioCtx.state !== 'running'
    ) {
      return;
    }

    this.menuAudioPlaybackState = 'loading';
    const sessionToken = this.menuAudioSessionToken;

    this.loadMenuAudioBuffer()
      .then((buffer) => {
        if (
          !buffer
          || sessionToken !== this.menuAudioSessionToken
          || this.isTransitioning
          || !this.menuAudioCtx
          || this.menuAudioCtx.state !== 'running'
          || !this.menuAudioGain
        ) {
          if (this.menuAudioPlaybackState === 'loading') {
            this.menuAudioPlaybackState = 'idle';
          }
          return;
        }

        this.startMenuMusicPlayback(sessionToken);
      })
      .catch(() => {
        if (this.menuAudioPlaybackState === 'loading') {
          this.menuAudioPlaybackState = 'idle';
        }
      });
  }

  startMenuMusicPlayback(sessionToken) {
    if (
      !this.menuAudioCtx
      || !this.menuAudioGain
      || !this.menuAudioBuffer
      || sessionToken !== this.menuAudioSessionToken
      || this.isTransitioning
    ) {
      this.menuAudioPlaybackState = 'idle';
      return;
    }

    this.stopMenuAudioSource();

    const source = this.menuAudioCtx.createBufferSource();
    source.buffer = this.menuAudioBuffer;
    source.loop = false;
    source.connect(this.menuAudioGain);

    this.menuAudioSource = source;
    this.menuAudioPlaybackState = 'playing';

    const now = this.menuAudioCtx.currentTime;
    const currentGain = Math.max(0.0001, this.menuAudioGain.gain.value);
    this.menuAudioGain.gain.cancelScheduledValues(now);
    this.menuAudioGain.gain.setValueAtTime(currentGain, now);
    this.menuAudioGain.gain.linearRampToValueAtTime(MENU_MUSIC_GAIN, now + 0.08);

    source.onended = () => {
      if (this.menuAudioSource === source) {
        this.menuAudioSource = null;
      }
      source.disconnect();

      if (
        this.isTransitioning
        || sessionToken !== this.menuAudioSessionToken
        || (!this.scene.isActive() && !this.keepMusicForCampaign)
      ) {
        this.menuAudioPlaybackState = 'idle';
        return;
      }

      this.menuAudioPlaybackState = 'idle';
      this.ensureMenuMusicPlayback();
    };

    try {
      source.start(now + 0.01, 0);
      this.removeGlobalUnlockListeners();
      this.stopAutoplayHammer();
    } catch {
      this.menuAudioPlaybackState = 'idle';
      source.onended = null;
      source.disconnect();
      if (this.menuAudioSource === source) {
        this.menuAudioSource = null;
      }
    }
  }

  stopMenuAudioSource() {
    if (!this.menuAudioSource) {
      return;
    }

    const activeSource = this.menuAudioSource;
    this.menuAudioSource = null;
    activeSource.onended = null;

    try {
      activeSource.stop(0);
    } catch {
      // Source may already be stopped.
    }

    try {
      activeSource.disconnect();
    } catch {
      // Source may already be disconnected.
    }
  }

  handleSoundUnlocked() {
    this.ensureMenuMusicPlayback();
  }

  unlockMenuAudioContext() {
    if (this.isTransitioning) {
      return;
    }

    if (typeof this.sound?.unlock === 'function') {
      try {
        this.sound.unlock();
      } catch {
        // Keep trying on next interaction.
      }
    }

    if (!this.menuAudioCtx) {
      this.ensureMenuMusicPlayback();
      return;
    }

    const onUnlocked = () => {
      this.ensureMenuMusicPlayback();
    };

    try {
      if (this.menuAudioCtx.state !== 'running' && typeof this.menuAudioCtx.resume === 'function') {
        const resumeResult = this.menuAudioCtx.resume();
        if (resumeResult && typeof resumeResult.then === 'function') {
          resumeResult.then(onUnlocked).catch(() => {});
        } else {
          onUnlocked();
        }
      } else {
        onUnlocked();
      }
    } catch {
      // Keep trying on subsequent interactions.
    }
  }

  refreshSelection() {
    this.optionEntries.forEach((entry, index) => {
      const selected = index === this.selectedIndex;
      const accentColor = entry.accentColor ?? 0x67e8f9;

      const cardColor = selected ? entry.selectedColor : entry.baseColor;
      entry.bodyMid.setFillStyle(cardColor, 1);
      entry.bodyLeft.setFillStyle(cardColor, 1);
      entry.bodyRight.setFillStyle(cardColor, 1);
      entry.glazeMid.setAlpha(selected ? 0.24 : 0.17);
      entry.glazeLeft.setAlpha(selected ? 0.24 : 0.17);
      entry.glazeRight.setAlpha(selected ? 0.24 : 0.17);
      entry.jamDot.setFillStyle(accentColor, 1);
      entry.keycap.setFillStyle(selected ? 0xffdcae : 0xfff2de, 1);
      entry.keyLabel.setColor(selected ? '#5f2b14' : '#7a3f24');
      entry.label.setColor(selected ? '#fffdf4' : '#fff5e9');

      if (entry.selectionTween) {
        entry.selectionTween.remove();
      }

      entry.selectionTween = this.tweens.add({
        targets: entry.panel,
        x: selected ? entry.baseX + 8 : entry.baseX,
        scaleX: selected ? 1.03 : 1,
        scaleY: selected ? 1.03 : 1,
        duration: 120,
        ease: 'Quad.Out'
      });

      this.tweens.add({
        targets: entry.jamDot,
        scaleX: selected ? 1.22 : 1,
        scaleY: selected ? 1.22 : 1,
        duration: 120,
        ease: 'Quad.Out'
      });
    });
  }

  moveSelectionUp() {
    if (this.isTransitioning || this.optionEntries.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex - 1 + this.optionEntries.length) % this.optionEntries.length;
    this.refreshSelection();
  }

  moveSelectionDown() {
    if (this.isTransitioning || this.optionEntries.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex + 1) % this.optionEntries.length;
    this.refreshSelection();
  }

  confirmSelection() {
    if (this.isTransitioning) {
      return;
    }

    this.optionEntries[this.selectedIndex]?.action?.();
  }

  handleDebugShortcut(event) {
    if (this.isTransitioning || !event || event.repeat) {
      return;
    }

    const isBackslash = event.code === 'Backslash' || event.key === '\\';
    if (!isBackslash) {
      return;
    }

    event.preventDefault?.();
    this.launchDebugLevel();
  }

  launchDebugLevel() {
    if (this.isTransitioning) {
      return;
    }

    this.transitionTo('GameScene', { levelId: DEBUG_LEVEL_ID });
  }

  transitionTo(sceneKey, data = undefined) {
    if (this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;

    if (sceneKey === 'LevelSelectScene') {
      this.keepMusicForCampaign = true;
      this.scene.start(sceneKey, data);
      return;
    }

    if (sceneKey === 'GameScene') {
      this.keepMusicForCampaign = false;
      this.fadeOutMenuMusic(0.18, () => {
        this.scene.start('LoadingScene', {
          targetSceneKey: 'GameScene',
          targetData: data,
          loadingLabel: 'Heating Up The Line',
          readyLabel: 'Shift Ready'
        });
      });
      return;
    }

    this.keepMusicForCampaign = false;
    this.fadeOutMenuMusic(0.18, () => {
      this.scene.start(sceneKey, data);
    });
  }

  fadeOutMenuMusic(durationSec = 0.18, onComplete = null) {
    if (!this.menuAudioCtx || !this.menuAudioGain) {
      this.stopMenuAudioSource();
      this.menuAudioPlaybackState = 'idle';
      onComplete?.();
      return;
    }

    const fadeDuration = Phaser.Math.Clamp(durationSec, 0.05, 1.4);
    const now = this.menuAudioCtx.currentTime;
    const currentGain = Math.max(0.0001, this.menuAudioGain.gain.value);
    this.menuAudioGain.gain.cancelScheduledValues(now);
    this.menuAudioGain.gain.setValueAtTime(currentGain, now);
    this.menuAudioGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);

    const delayMs = Math.round(fadeDuration * 1000) + 20;
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.stopMenuAudioSource();
        this.menuAudioPlaybackState = 'idle';
        onComplete?.();
      }, delayMs);
      return;
    }

    this.stopMenuAudioSource();
    this.menuAudioPlaybackState = 'idle';
    onComplete?.();
  }

  stopMusicForGameplay(durationSec = 0.12) {
    this.keepMusicForCampaign = false;
    this.fadeOutMenuMusic(durationSec, () => {});
  }

  handleShutdown() {
    this.input.keyboard?.off('keydown-UP', this.moveSelectionUp, this);
    this.input.keyboard?.off('keydown-W', this.moveSelectionUp, this);
    this.input.keyboard?.off('keydown-DOWN', this.moveSelectionDown, this);
    this.input.keyboard?.off('keydown-S', this.moveSelectionDown, this);
    this.input.keyboard?.off('keydown-ENTER', this.confirmSelection, this);
    this.input.keyboard?.off('keydown-SPACE', this.confirmSelection, this);
    this.input.keyboard?.off('keydown', this.handleDebugShortcut, this);

    this.input.off('pointerdown', this.unlockMenuAudioContext, this);
    this.input.keyboard?.off('keydown', this.unlockMenuAudioContext, this);
    this.input.gamepad?.off('down', this.unlockMenuAudioContext, this);
    this.sound?.off(Phaser.Sound.Events.UNLOCKED, this.handleSoundUnlocked, this);
    this.removeGlobalUnlockListeners();
    this.stopAutoplayHammer();

    if (!this.keepMusicForCampaign) {
      this.stopMenuAudioSource();
      this.menuAudioPlaybackState = 'idle';
      this.menuAudioSessionToken += 1;

      if (this.menuAudioGain) {
        this.menuAudioGain.disconnect();
        this.menuAudioGain = null;
      }
    }

    this.optionEntries = [];
    this.isTransitioning = false;
  }
}
