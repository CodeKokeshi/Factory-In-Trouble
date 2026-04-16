import Phaser from 'phaser';

const MAX_SPRITES_PER_TYPE = 24;
const FOOD_RENDER_SIZE = 42;

const MAIN_BELT_WIDTH = 56;
const MAIN_BELT_HEIGHT = 560;
const SIDE_BELT_HEIGHT = 26;

const CLAW_OFFSET_X = 38;
const CLAW_RADIUS = 12;
const CLAW_CLEARANCE = 2;
const SIDE_BELT_INTAKE_OFFSET = CLAW_OFFSET_X + CLAW_RADIUS + CLAW_CLEARANCE;

const CLAW_ARM_LENGTH = 22;
const CLAW_JAW_LENGTH = 12;
const CLAW_JAW_SPREAD = 10;

const CHEST_PICKUP_BUFFER = 16;

const BELT_LINE_COLOR = 0x0f172a;
const BELT_LINE_ALPHA = 0.38;

function drawConveyorLines(graphics, { x, y, width, height, orientation, spacing, margin = 6, offset = 0 }) {
  const left = x - width * 0.5 + margin;
  const right = x + width * 0.5 - margin;
  const top = y - height * 0.5 + margin;
  const bottom = y + height * 0.5 - margin;

  const phase = ((Number(offset) % spacing) + spacing) % spacing;

  graphics.lineStyle(2, BELT_LINE_COLOR, BELT_LINE_ALPHA);

  if (orientation === 'vertical') {
    for (let lineY = top - spacing + phase; lineY <= bottom; lineY += spacing) {
      graphics.lineBetween(left, lineY, right, lineY);
    }
    return;
  }

  for (let lineX = left - spacing + phase; lineX <= right; lineX += spacing) {
    graphics.lineBetween(lineX, top, lineX, bottom);
  }
}

const SPRITE_URL_GLOBS = {
  condiments: import.meta.glob('../../assets/sprites/condiments/*.png', { eager: true, import: 'default' }),
  carbs: import.meta.glob('../../assets/sprites/carb/*.png', { eager: true, import: 'default' }),
  protein: import.meta.glob('../../assets/sprites/protein/*.png', { eager: true, import: 'default' }),
  greens: import.meta.glob('../../assets/sprites/greens/*.png', { eager: true, import: 'default' })
};

const CHEST_SPRITE_GLOB = import.meta.glob('../../assets/sprites/chest/*.png', { eager: true, import: 'default' });
const AUDIO_SFX_GLOB = import.meta.glob('../../assets/audio/*', { eager: true, import: 'default' });
const CHEST_CLOSED_KEY = 'chest_closed';
const CHEST_OPENED_KEY = 'chest_opened';
const GRAB_SFX_KEY = 'sfx_grab';
const CLAW_SQUEAK_SFX_KEY = 'sfx_claw_squeak';

function findFirstMatchUrl(spriteGlob, matcher) {
  const match = Object.entries(spriteGlob).find(([path]) => matcher.test(path));
  return match ? match[1] : null;
}

const CHEST_CLOSED_URL = findFirstMatchUrl(CHEST_SPRITE_GLOB, /closed\.png$/i);
const CHEST_OPENED_URL = findFirstMatchUrl(CHEST_SPRITE_GLOB, /opened\.png$/i);
const GRAB_OGG_URL = findFirstMatchUrl(AUDIO_SFX_GLOB, /grab\.ogg$/i);
const GRAB_MP3_URL = findFirstMatchUrl(AUDIO_SFX_GLOB, /grab\.mp3$/i);
const CLAW_SQUEAK_OGG_URL = findFirstMatchUrl(AUDIO_SFX_GLOB, /claw_squeak\.ogg$/i);
const CLAW_SQUEAK_MP3_URL = findFirstMatchUrl(AUDIO_SFX_GLOB, /claw_squeak\.mp3$/i);

function collectSpriteUrls(spriteGlob, maxCount = MAX_SPRITES_PER_TYPE) {
  return Object.entries(spriteGlob)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .slice(0, maxCount)
    .map(([, url]) => url);
}

const FOOD_TYPES = [
  {
    id: 'condiments',
    label: 'Condiments',
    short: 'Cm',
    color: 0xf97316,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.condiments)
  },
  {
    id: 'carbs',
    label: 'Carbs',
    short: 'Cb',
    color: 0xeab308,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.carbs)
  },
  {
    id: 'protein',
    label: 'Protein',
    short: 'Pr',
    color: 0xef4444,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.protein)
  },
  {
    id: 'greens',
    label: 'Greens',
    short: 'Gr',
    color: 0x22c55e,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.greens)
  }
];

const LANE_LAYOUT = [
  {
    id: 'mid_left',
    label: 'Carbs',
    desiredType: 'carbs',
    y: 300,
    direction: -1,
    endX: 190,
    chestX: 110,
    chestLabel: 'Carbs Chest'
  },
  {
    id: 'mid_right',
    label: 'Protein',
    desiredType: 'protein',
    y: 300,
    direction: 1,
    endX: 1090,
    chestX: 1170,
    chestLabel: 'Protein Chest'
  },
  {
    id: 'bot_left',
    label: 'Greens',
    desiredType: 'greens',
    y: 500,
    direction: -1,
    endX: 190,
    chestX: 110,
    chestLabel: 'Greens Chest'
  },
  {
    id: 'bot_right',
    label: 'Condiments',
    desiredType: 'condiments',
    y: 500,
    direction: 1,
    endX: 1090,
    chestX: 1170,
    chestLabel: 'Condiments Chest'
  }
];

const CLAW_ROWS = [
  { y: 300, leftLaneId: 'mid_left', rightLaneId: 'mid_right' },
  { y: 500, leftLaneId: 'bot_left', rightLaneId: 'bot_right' }
];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    this.mainX = 640;
    this.mainStartY = 72;
    this.mainEndY = 640;
    this.mainLength = this.mainEndY - this.mainStartY;

    this.spawnTimerMs = 0;
    this.spawnBlockedThisFrame = false;

    this.baseMainSpeed = 70;
    this.baseSideSpeed = 105;
    this.maxMainSpeed = 235;
    this.maxSideSpeed = 325;
    this.baseSpawnIntervalMs = 850;
    this.minSpawnIntervalMs = 340;

    this.scoreRampStepPoints = 5000;
    this.mainSpeedPerStep = 8;
    this.sideSpeedPerStep = 12;
    this.spawnIntervalDecreasePerStepMs = 45;

    this.mainSpeed = this.baseMainSpeed;
    this.sideSpeed = this.baseSideSpeed;
    this.spawnIntervalMs = this.baseSpawnIntervalMs;
    this.itemSpacing = FOOD_RENDER_SIZE + 4;

    this.nextItemId = 1;
    this.items = [];
    this.lanesById = {};
    this.textureKeysByFoodId = {};

    this.acceptedCount = 0;
    this.rejectedCount = 0;

    this.score = 0;
    this.multiplier = 1;
    this.maxMultiplier = 20;
    this.scoreText = null;
    this.multiplierText = null;
    this.comboMilestoneTier = 0;

    this.chestParticles = null;
    this.spawnParticles = null;
    this.jamParticles = null;
    this.transferParticles = null;

    this.isGameOver = false;
    this.clogTimerSeconds = 0;
    this.clogGraceSeconds = 1.4;
    this.gameOverOverlay = null;
    this.gameOverText = null;

    this.dragContext = null;
    this.simTimeScale = 1;
    this.dragSlowMoScale = 0.18;
    this.hitStopMs = 0;
    this.hitStopScale = 1;

    this.mainBeltLines = null;
    this.mainBeltLineConfig = null;
    this.mainBeltBody = null;
    this.ambientGlow = null;
    this.flashOverlay = null;
    this.moodVignette = null;
    this.fxTimeMs = 0;
    this.rhythmPulseMs = 0;

    this.audioEnabled = false;
    this.audioUnlocked = false;
    this.audioCtx = null;
    this.audioMasterGain = null;
    this.audioMusicGain = null;
    this.audioSfxGain = null;
    this.audioCompressor = null;
    this.audioMasterTone = null;
    this.audioNoiseBuffer = null;
    this.musicBeatTimerMs = 0;
    this.musicBeatMs = 60000 / 96;
    this.musicStepIndex = 0;
    this.lastDraftSelectSfxMs = 0;
    this.lastRumbleAtMs = 0;

    this.cardCatalog = [];
    this.cardStatusText = null;
    this.pressureText = null;
    this.effectHudGraphics = null;
    this.effectHudTitle = null;
    this.effectHudRows = [];
    this.lastPickedCardId = null;
    this.lastPickedCardName = 'None';
    this.cardPickCount = 0;

    this.currentPressure = 0;
    this.pressureSampleTimerMs = 0;
    this.pressureSampleIntervalMs = 500;
    this.highPressureHoldMs = 0;

    this.cardDraftCooldownMs = 0;
    this.cardDraftCooldownDurationMs = 18000;
    this.cardEmergencyThreshold = 0.72;
    this.cardEmergencyHoldDurationMs = 2000;
    this.cardPityThreshold = 0.45;
    this.cardPityDurationMs = 75000;
    this.timeSinceLastDraftMs = 0;
    this.cardScoreMilestonePoints = 6000;
    this.nextCardScoreMilestone = this.cardScoreMilestonePoints;
    this.pendingScoreDraft = false;

    this.isDraftActive = false;
    this.activeDraftTrigger = null;
    this.cardDraftContainer = null;
    this.cardDraftChoices = [];
    this.cardDraftEntries = [];
    this.cardDraftSelectedIndex = 0;
    this.cardDraftPointerLockMs = 0;
    this.cardDraftPointerLockDurationMs = 180;
    this.cardDraftPointerReleaseRequired = false;
    this.cardInputKeys = null;

    this.coolantFlushHoldDurationMs = 10000;
    this.coolantFlushRampDurationMs = 8000;
    this.coolantFlushHoldMs = 0;
    this.coolantFlushRampMs = 0;
    this.smartSortScoreLockDurationMs = 6000;
    this.smartSortScoreLockMs = 0;

    this.inserterCalibrationDurationMs = 14000;
    this.inserterCalibrationMs = 0;
    this.chestPriorityDurationMs = 15000;
    this.chestPriorityMs = 0;
    this.chestPriorityChargesByLaneId = LANE_LAYOUT.reduce((acc, lane) => {
      acc[lane.id] = 0;
      return acc;
    }, {});

    this.turboShiftDurationMs = 18000;
    this.turboShiftMs = 0;
    this.turboShiftScoreScale = 1.25;
    this.turboShiftSpeedScale = 1.18;
    this.comboFurnaceDurationMs = 14000;
    this.comboFurnaceMs = 0;
    this.comboFurnaceMultiplierGain = 2;
    this.comboFurnaceJamPenaltyPoints = 200;
    this.comboFurnaceJamPenaltyArmed = false;

    this.emergencyBrakeDurationMs = 7000;
    this.emergencyBrakeMs = 0;
    this.emergencyBrakeTimeScale = 0.55;
    this.emergencyBrakePenaltySpawns = 12;
    this.emergencyBrakePenaltySpawnsRemaining = 0;
    this.emergencyBrakePenaltyScoreScale = 0.8;

    this.overflowPurgeMaxItems = 5;
    this.overflowPurgeBasePenalty = 250;
    this.overflowPurgePenaltyPerItem = 30;

    this.beltRephaseDurationMs = 12000;
    this.beltRephaseMs = 0;
    this.beltRephaseMainSpeedScale = 1.08;
    this.beltRephaseSideSpacingScale = 0.82;

    this.predictivePullSpawnsPerUse = 20;
    this.predictivePullSpawnsRemaining = 0;
    this.predictivePullSpawnsCap = 0;
    this.predictivePullBiasWeight = 0.85;
    this.predictivePullSpawnTradeoffScale = 0.92;

    this.riskyThroughputDurationMs = 16000;
    this.riskyThroughputMs = 0;
    this.riskyThroughputSpawnScale = 0.75;
    this.riskyThroughputBonusPoints = 2;

    this.fragileJackpotPoints = 1200;
    this.fragileJackpotDurationMs = 10000;
    this.fragileJackpotNoSlowMoMs = 0;

    this.foodTypeById = FOOD_TYPES.reduce((acc, food) => {
      acc[food.id] = food;
      return acc;
    }, {});
  }

  preload() {
    if (CHEST_CLOSED_URL) {
      this.load.image(CHEST_CLOSED_KEY, CHEST_CLOSED_URL);
    }
    if (CHEST_OPENED_URL) {
      this.load.image(CHEST_OPENED_KEY, CHEST_OPENED_URL);
    }

    const grabAudioSources = [GRAB_OGG_URL, GRAB_MP3_URL].filter(Boolean);
    if (grabAudioSources.length > 0) {
      this.load.audio(GRAB_SFX_KEY, grabAudioSources);
    }

    const clawSqueakAudioSources = [CLAW_SQUEAK_OGG_URL, CLAW_SQUEAK_MP3_URL].filter(Boolean);
    if (clawSqueakAudioSources.length > 0) {
      this.load.audio(CLAW_SQUEAK_SFX_KEY, clawSqueakAudioSources);
    }

    FOOD_TYPES.forEach((food) => {
      this.textureKeysByFoodId[food.id] = [];

      food.spriteUrls.forEach((url, index) => {
        const textureKey = `food_${food.id}_${index}`;
        this.load.image(textureKey, url);
        this.textureKeysByFoodId[food.id].push(textureKey);
      });
    });
  }

  create() {
    this.createFactoryVisuals();
    this.createSceneJuiceLayer();
    this.initAudioSystem();
    this.createScoreUi();
    this.createCardSystem();
    this.createParticles();
    this.setupGrabControls();
  }

  createSceneJuiceLayer() {
    this.fxTimeMs = 0;

    const leftGlow = this.add.circle(236, 126, 250, 0x1d4ed8, 0.12).setDepth(-20);
    leftGlow.setBlendMode(Phaser.BlendModes.ADD);
    const rightGlow = this.add.circle(1040, 608, 280, 0x22d3ee, 0.11).setDepth(-20);
    rightGlow.setBlendMode(Phaser.BlendModes.ADD);
    const centerGlow = this.add.circle(640, 358, 330, 0xf59e0b, 0.07).setDepth(-19);
    centerGlow.setBlendMode(Phaser.BlendModes.ADD);

    this.ambientGlow = {
      left: leftGlow,
      right: rightGlow,
      center: centerGlow
    };

    this.tweens.add({
      targets: leftGlow,
      alpha: { from: 0.07, to: 0.2 },
      scaleX: { from: 0.94, to: 1.12 },
      scaleY: { from: 0.94, to: 1.12 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    this.tweens.add({
      targets: rightGlow,
      alpha: { from: 0.06, to: 0.18 },
      scaleX: { from: 0.92, to: 1.08 },
      scaleY: { from: 0.92, to: 1.08 },
      duration: 3300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    this.tweens.add({
      targets: centerGlow,
      alpha: { from: 0.04, to: 0.13 },
      scaleX: { from: 0.95, to: 1.08 },
      scaleY: { from: 0.95, to: 1.08 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    this.moodVignette = this.add.rectangle(640, 360, 1280, 720, 0x020617, 0.15).setDepth(250);

    this.flashOverlay = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 1).setDepth(340).setAlpha(0);
    this.flashOverlay.setBlendMode(Phaser.BlendModes.ADD);
  }

  initAudioSystem() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const ctx = this.sound?.context || (AudioContextCtor ? new AudioContextCtor() : null);
    if (!ctx || typeof ctx.createGain !== 'function') {
      return;
    }

    this.audioCtx = ctx;
    this.audioMasterGain = ctx.createGain();
    this.audioMusicGain = ctx.createGain();
    this.audioSfxGain = ctx.createGain();
    this.audioCompressor = typeof ctx.createDynamicsCompressor === 'function' ? ctx.createDynamicsCompressor() : null;
    this.audioMasterTone = ctx.createBiquadFilter();

    this.audioMasterTone.type = 'lowpass';
    this.audioMasterTone.frequency.value = 13000;
    this.audioMasterTone.Q.value = 0.6;

    if (this.audioCompressor) {
      this.audioCompressor.threshold.setValueAtTime(-22, ctx.currentTime);
      this.audioCompressor.knee.setValueAtTime(20, ctx.currentTime);
      this.audioCompressor.ratio.setValueAtTime(4.5, ctx.currentTime);
      this.audioCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
      this.audioCompressor.release.setValueAtTime(0.18, ctx.currentTime);
    }

    this.audioMasterGain.gain.value = 1.08;
    this.audioMusicGain.gain.value = 0.001;
    this.audioSfxGain.gain.value = 1.35;

    this.audioMusicGain.connect(this.audioMasterGain);
    this.audioSfxGain.connect(this.audioMasterGain);

    if (this.audioCompressor) {
      this.audioMasterGain.connect(this.audioCompressor);
      this.audioCompressor.connect(this.audioMasterTone);
      this.audioMasterTone.connect(ctx.destination);
    } else {
      this.audioMasterGain.connect(this.audioMasterTone);
      this.audioMasterTone.connect(ctx.destination);
    }

    this.audioNoiseBuffer = this.createNoiseBuffer();

    this.audioEnabled = true;
    this.audioUnlocked = ctx.state === 'running';

    this.input.on('pointerdown', this.unlockAudioContext, this);
    this.input.keyboard?.on('keydown', this.unlockAudioContext, this);
    this.input.gamepad?.on('down', this.unlockAudioContext, this);
  }

  createNoiseBuffer() {
    if (!this.audioCtx || typeof this.audioCtx.createBuffer !== 'function') {
      return null;
    }

    const sampleRate = this.audioCtx.sampleRate || 44100;
    const buffer = this.audioCtx.createBuffer(1, sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.85;
    }

    return buffer;
  }

  unlockAudioContext() {
    if (!this.audioCtx) {
      return;
    }

    const onUnlocked = () => {
      this.audioUnlocked = this.audioCtx?.state === 'running';
      if (!this.audioUnlocked) {
        return;
      }

      this.input.off('pointerdown', this.unlockAudioContext, this);
      this.input.keyboard?.off('keydown', this.unlockAudioContext, this);
      this.input.gamepad?.off('down', this.unlockAudioContext, this);

      // Play a short, obvious confirmation burst after unlock.
      this.playDrumHit('kick', 1.15, 'sfx');
      this.playSfx('transfer', 1.2);
      this.time.delayedCall(120, () => this.playSfx('combo-tier', 1.2));
    };

    try {
      if (this.audioCtx.state !== 'running' && typeof this.audioCtx.resume === 'function') {
        const resumeResult = this.audioCtx.resume();
        if (resumeResult && typeof resumeResult.then === 'function') {
          resumeResult.then(onUnlocked).catch(() => {});
        } else {
          onUnlocked();
        }
      } else {
        onUnlocked();
      }
    } catch {
      // Keep listeners active for the next interaction attempt.
    }
  }

  playNoiseBurst({
    duration = 0.08,
    gain = 0.07,
    highpass = 1200,
    lowpass = 12000,
    destination = 'sfx'
  } = {}) {
    if (!this.audioEnabled || !this.audioUnlocked || !this.audioCtx || !this.audioNoiseBuffer) {
      return;
    }

    const outputGain = destination === 'music' ? this.audioMusicGain : this.audioSfxGain;
    if (!outputGain) {
      return;
    }

    const now = this.audioCtx.currentTime;
    const source = this.audioCtx.createBufferSource();
    source.buffer = this.audioNoiseBuffer;

    const hp = this.audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(Math.max(40, highpass), now);

    const lp = this.audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.max(120, lowpass), now);

    const amp = this.audioCtx.createGain();
    const peak = Phaser.Math.Clamp(gain * 1.8, 0.0002, 1.2);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, duration));

    source.connect(hp);
    hp.connect(lp);
    lp.connect(amp);
    amp.connect(outputGain);

    const stopAt = now + Math.max(0.03, duration + 0.03);
    source.start(now);
    source.stop(stopAt);
    source.onended = () => {
      source.disconnect();
      hp.disconnect();
      lp.disconnect();
      amp.disconnect();
    };
  }

  playDrumHit(kind, intensity = 1, destination = 'music') {
    const amount = Phaser.Math.Clamp(intensity, 0.15, 2.3);

    if (kind === 'kick') {
      this.playSynthTone({
        freq: 132,
        targetFreq: 38,
        type: 'sine',
        attack: 0.001,
        decay: 0.25,
        gain: 0.14 * amount,
        filterFreq: 260,
        destination
      });
      this.playNoiseBurst({ duration: 0.018, gain: 0.02 * amount, highpass: 1800, lowpass: 9000, destination });
      return;
    }

    if (kind === 'snare') {
      this.playNoiseBurst({ duration: 0.12, gain: 0.12 * amount, highpass: 900, lowpass: 6200, destination });
      this.playSynthTone({
        freq: 230,
        targetFreq: 168,
        type: 'triangle',
        attack: 0.001,
        decay: 0.1,
        gain: 0.05 * amount,
        filterFreq: 1800,
        destination
      });
      return;
    }

    if (kind === 'hat') {
      this.playNoiseBurst({ duration: 0.045, gain: 0.06 * amount, highpass: 5000, lowpass: 13000, destination });
    }
  }

  playSynthTone({
    freq = 220,
    targetFreq = null,
    type = 'triangle',
    attack = 0.004,
    decay = 0.09,
    gain = 0.07,
    filterFreq = 1600,
    filterType = 'lowpass',
    q = 0.6,
    destination = 'sfx'
  } = {}) {
    if (!this.audioEnabled || !this.audioUnlocked || !this.audioCtx) {
      return;
    }

    const outputGain = destination === 'music' ? this.audioMusicGain : this.audioSfxGain;
    if (!outputGain) {
      return;
    }

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const amp = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freq), now);
    if (targetFreq && targetFreq > 0 && targetFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, targetFreq), now + Math.max(0.02, attack + decay));
    }

    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(80, filterFreq), now);
    filter.Q.setValueAtTime(Math.max(0, q), now);

    const peak = Phaser.Math.Clamp(Math.max(0.0002, gain * 4.8), 0.0002, 1.35);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(peak, now + Math.max(0.002, attack));
    amp.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, attack + decay));

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(outputGain);

    const stopAt = now + Math.max(0.03, attack + decay + 0.02);
    osc.start(now);
    osc.stop(stopAt);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      amp.disconnect();
    };
  }

  playLoadedSfxWithVariation(
    key,
    {
      intensity = 1,
      baseVolume = 0.3,
      volumeJitter = 0.03,
      baseDetune = 0,
      detuneRange = 35,
      baseRate = 1,
      rateJitter = 0.025
    } = {}
  ) {
    if (!this.sound || !this.cache?.audio?.exists(key)) {
      return;
    }

    const amount = Phaser.Math.Clamp(intensity, 0.2, 2.2);
    const volume = Phaser.Math.Clamp(
      baseVolume * amount + Phaser.Math.FloatBetween(-volumeJitter, volumeJitter),
      0.01,
      1
    );
    const detune = Phaser.Math.Clamp(
      baseDetune + Phaser.Math.FloatBetween(-detuneRange, detuneRange),
      -1200,
      1200
    );
    const rate = Phaser.Math.Clamp(baseRate + Phaser.Math.FloatBetween(-rateJitter, rateJitter), 0.8, 1.25);

    this.sound.play(key, {
      volume,
      detune,
      rate
    });
  }

  playGrabSfx(intensity = 1) {
    this.playLoadedSfxWithVariation(GRAB_SFX_KEY, {
      intensity,
      baseVolume: 0.34,
      volumeJitter: 0.035,
      detuneRange: 50,
      rateJitter: 0.03
    });
  }

  playClawSqueakSfx(stage = 'move', intensity = 1) {
    let baseDetune = 0;
    let baseRate = 1;

    if (stage === 'pickup') {
      baseDetune = -16;
      baseRate = 0.985;
    } else if (stage === 'drop') {
      baseDetune = 16;
      baseRate = 1.02;
    }

    this.playLoadedSfxWithVariation(CLAW_SQUEAK_SFX_KEY, {
      intensity,
      baseVolume: 0.24,
      volumeJitter: 0.03,
      baseDetune,
      detuneRange: 32,
      baseRate,
      rateJitter: 0.022
    });
  }

  playSfx(eventId, intensity = 1) {
    const amount = Phaser.Math.Clamp(intensity, 0.2, 2.2);

    // Keep SFX focused on core game actions only.
    if (
      eventId !== 'transfer'
      && eventId !== 'jam'
      && eventId !== 'chest-accept'
      && eventId !== 'combo-tier'
      && eventId !== 'combo-break'
      && eventId !== 'game-over'
    ) {
      return;
    }

    if (eventId === 'spawn') {
      this.playDrumHit('kick', 0.45 * amount, 'sfx');
      this.playSynthTone({ freq: 300 + Math.random() * 50, targetFreq: 170, type: 'square', attack: 0.001, decay: 0.095, gain: 0.05 * amount, filterFreq: 1300 });
      this.playNoiseBurst({ duration: 0.03, gain: 0.018 * amount, highpass: 2800, lowpass: 10500, destination: 'sfx' });
      return;
    }

    if (eventId === 'transfer') {
      this.playSynthTone({ freq: 240 + Math.random() * 40, targetFreq: 330, type: 'square', attack: 0.001, decay: 0.055, gain: 0.055 * amount, filterFreq: 2100 });
      this.playDrumHit('hat', 0.55 * amount, 'sfx');
      return;
    }

    if (eventId === 'drag-start') {
      this.playSynthTone({ freq: 180, targetFreq: 88, type: 'sawtooth', attack: 0.0015, decay: 0.14, gain: 0.07 * amount, filterFreq: 940, q: 1 });
      this.playNoiseBurst({ duration: 0.045, gain: 0.024 * amount, highpass: 700, lowpass: 4500, destination: 'sfx' });
      return;
    }

    if (eventId === 'swap') {
      this.playSynthTone({ freq: 240, targetFreq: 390, type: 'triangle', attack: 0.001, decay: 0.09, gain: 0.07 * amount, filterFreq: 1800 });
      this.playSynthTone({ freq: 390, targetFreq: 520, type: 'sine', attack: 0.001, decay: 0.06, gain: 0.05 * amount, filterFreq: 2600 });
      this.playDrumHit('hat', 0.65 * amount, 'sfx');
      return;
    }

    if (eventId === 'chest-accept') {
      this.playSynthTone({ freq: 360, targetFreq: 620, type: 'triangle', attack: 0.001, decay: 0.11, gain: 0.07 * amount, filterFreq: 2500 });
      this.playSynthTone({ freq: 620, targetFreq: 830, type: 'sine', attack: 0.001, decay: 0.09, gain: 0.05 * amount, filterFreq: 2900 });
      this.playDrumHit('kick', 0.3 * amount, 'sfx');
      return;
    }

    if (eventId === 'combo-tier') {
      this.playDrumHit('kick', 0.72 * amount, 'sfx');
      this.playDrumHit('snare', 0.6 * amount, 'sfx');
      this.playSynthTone({ freq: 280, targetFreq: 520, type: 'sawtooth', attack: 0.001, decay: 0.14, gain: 0.075 * amount, filterFreq: 2100 });
      this.playSynthTone({ freq: 520, targetFreq: 770, type: 'triangle', attack: 0.001, decay: 0.13, gain: 0.06 * amount, filterFreq: 2800 });
      return;
    }

    if (eventId === 'combo-break') {
      this.playSynthTone({ freq: 230, targetFreq: 82, type: 'square', attack: 0.001, decay: 0.2, gain: 0.08 * amount, filterFreq: 920 });
      this.playDrumHit('snare', 0.55 * amount, 'sfx');
      return;
    }

    if (eventId === 'jam') {
      this.playDrumHit('kick', 1.1 * amount, 'sfx');
      this.playDrumHit('snare', 0.95 * amount, 'sfx');
      this.playSynthTone({ freq: 190, targetFreq: 62, type: 'square', attack: 0.001, decay: 0.24, gain: 0.12 * amount, filterFreq: 820, q: 1.2 });
      this.playNoiseBurst({ duration: 0.14, gain: 0.1 * amount, highpass: 900, lowpass: 8200, destination: 'sfx' });
      return;
    }

    if (eventId === 'draft-open') {
      this.playSynthTone({ freq: 180, targetFreq: 540, type: 'sawtooth', attack: 0.004, decay: 0.24, gain: 0.08 * amount, filterFreq: 2000 });
      this.playNoiseBurst({ duration: 0.1, gain: 0.05 * amount, highpass: 2400, lowpass: 12000, destination: 'sfx' });
      return;
    }

    if (eventId === 'draft-select') {
      this.playSynthTone({ freq: 420, targetFreq: 590, type: 'square', attack: 0.001, decay: 0.05, gain: 0.05 * amount, filterFreq: 2900 });
      return;
    }

    if (eventId === 'draft-pick') {
      this.playDrumHit('kick', 0.8 * amount, 'sfx');
      this.playSynthTone({ freq: 260, targetFreq: 620, type: 'triangle', attack: 0.001, decay: 0.2, gain: 0.09 * amount, filterFreq: 2300 });
      this.playSynthTone({ freq: 420, targetFreq: 830, type: 'sine', attack: 0.001, decay: 0.16, gain: 0.07 * amount, filterFreq: 2800 });
      return;
    }

    if (eventId === 'game-over') {
      this.playDrumHit('kick', 1.25 * amount, 'sfx');
      this.playSynthTone({ freq: 210, targetFreq: 56, type: 'square', attack: 0.001, decay: 0.44, gain: 0.12 * amount, filterFreq: 760 });
      this.playNoiseBurst({ duration: 0.22, gain: 0.1 * amount, highpass: 420, lowpass: 5600, destination: 'sfx' });
    }
  }

  triggerMusicBeat(pressure, jamLoad) {
    const step = this.musicStepIndex;
    this.musicStepIndex += 1;

    const barStep = step % 16;
    const barIndex = Math.floor(step / 16) % 4;
    const rootPattern = [55, 65.41, 49, 73.42];
    const root = rootPattern[barIndex];
    const pressureMix = Phaser.Math.Clamp(pressure * 0.75 + jamLoad * 0.35, 0, 1);

    if (barStep % 4 === 0 || (pressure > 0.62 && barStep % 8 === 6)) {
      this.playDrumHit('kick', 0.8 + pressure * 0.4, 'music');
    }
    if (barStep % 8 === 4) {
      this.playDrumHit('snare', 0.78 + jamLoad * 0.55, 'music');
    }
    if (barStep % 2 === 1) {
      this.playDrumHit('hat', 0.32 + pressure * 0.35, 'music');
    }

    if (barStep % 2 === 0) {
      const bassFreq = root * (barStep % 8 < 4 ? 1 : 1.12);
      this.playSynthTone({
        freq: bassFreq,
        targetFreq: bassFreq * 0.92,
        type: 'sawtooth',
        attack: 0.002,
        decay: 0.22,
        gain: 0.05 + pressure * 0.03,
        filterFreq: 340 + pressure * 330,
        destination: 'music'
      });
    }

    if (barStep % 8 === 0) {
      const chordRoot = root * 2;
      this.playSynthTone({
        freq: chordRoot,
        targetFreq: chordRoot * 0.98,
        type: 'triangle',
        attack: 0.002,
        decay: 0.18,
        gain: 0.045 + pressure * 0.02,
        filterFreq: 1500 + pressure * 700,
        destination: 'music'
      });
      this.playSynthTone({
        freq: chordRoot * 1.1892,
        targetFreq: chordRoot * 1.1892 * 0.99,
        type: 'triangle',
        attack: 0.002,
        decay: 0.18,
        gain: 0.034 + pressure * 0.016,
        filterFreq: 1700 + pressure * 700,
        destination: 'music'
      });
      this.playSynthTone({
        freq: chordRoot * 1.4983,
        targetFreq: chordRoot * 1.4983 * 0.99,
        type: 'triangle',
        attack: 0.002,
        decay: 0.16,
        gain: 0.028 + pressure * 0.013,
        filterFreq: 1900 + pressure * 700,
        destination: 'music'
      });
    }

    if (pressureMix > 0.52 && barStep % 4 === 2) {
      this.playSynthTone({
        freq: 680 + pressureMix * 180,
        targetFreq: 430,
        type: 'square',
        attack: 0.001,
        decay: 0.07,
        gain: 0.028 + pressureMix * 0.03,
        filterFreq: 2200,
        destination: 'music'
      });
    }

    if (jamLoad > 0.25 && barStep % 4 === 3) {
      this.playNoiseBurst({ duration: 0.07, gain: 0.03 + jamLoad * 0.03, highpass: 2500, lowpass: 9000, destination: 'music' });
    }

    this.rhythmPulseMs = Math.max(this.rhythmPulseMs, 110);
  }

  updateAudio(deltaMs) {
    if (deltaMs <= 0) {
      return;
    }

    this.rhythmPulseMs = Math.max(0, this.rhythmPulseMs - deltaMs);

    if (!this.audioEnabled || !this.audioCtx || !this.audioMasterGain || !this.audioMusicGain) {
      return;
    }

    if (!this.audioUnlocked && this.audioCtx.state === 'running') {
      this.audioUnlocked = true;
    }

    const pressure = Phaser.Math.Clamp(this.currentPressure || 0, 0, 1);
    const jammedCount = this.items.reduce((count, item) => count + (item.state === 'jammed' ? 1 : 0), 0);
    const jamLoad = Phaser.Math.Clamp(jammedCount / Math.max(1, LANE_LAYOUT.length * 2), 0, 1);
    const now = this.audioCtx.currentTime;

    const targetMaster = this.isGameOver ? 0.65 : 1.05;
    this.audioMasterGain.gain.cancelScheduledValues(now);
    this.audioMasterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.12);

    const targetSfxGain = this.audioUnlocked && !this.isGameOver
      ? 1.22 + pressure * 0.24
      : 1.1;
    this.audioSfxGain.gain.cancelScheduledValues(now);
    this.audioSfxGain.gain.linearRampToValueAtTime(targetSfxGain, now + 0.12);

    const targetMusicGain = this.audioUnlocked && !this.isGameOver
      ? (this.isDraftActive ? 0.09 : 0.13 + pressure * 0.18 + jamLoad * 0.08)
      : 0.001;
    this.audioMusicGain.gain.cancelScheduledValues(now);
    this.audioMusicGain.gain.linearRampToValueAtTime(targetMusicGain, now + 0.12);

    if (!this.audioUnlocked || this.isGameOver) {
      return;
    }

    const bpm = Phaser.Math.Linear(100, 164, Phaser.Math.Clamp(pressure * 0.85 + jamLoad * 0.45, 0, 1));
    this.musicBeatMs = 60000 / bpm;
    this.musicBeatTimerMs += deltaMs;

    let beatSafety = 0;
    while (this.musicBeatTimerMs >= this.musicBeatMs && beatSafety < 10) {
      beatSafety += 1;
      this.musicBeatTimerMs -= this.musicBeatMs;
      this.triggerMusicBeat(pressure, jamLoad);
    }
  }

  triggerHitStop(durationMs = 44, scale = 0.1) {
    this.hitStopMs = Math.max(this.hitStopMs, durationMs);
    this.hitStopScale = Math.min(this.hitStopScale, Phaser.Math.Clamp(scale, 0.04, 1));
  }

  updateHitStop(deltaMs) {
    if (this.hitStopMs <= 0) {
      this.hitStopScale = 1;
      return;
    }

    this.hitStopMs = Math.max(0, this.hitStopMs - deltaMs);
    if (this.hitStopMs <= 0) {
      this.hitStopScale = 1;
    }
  }

  rumble(strongMagnitude = 0.35, weakMagnitude = 0.2, durationMs = 70) {
    const pads = this.input?.gamepad?.gamepads;
    if (!pads || pads.length === 0) {
      return;
    }

    const nowMs = this.time?.now ?? 0;
    if (nowMs - this.lastRumbleAtMs < 22) {
      return;
    }
    this.lastRumbleAtMs = nowMs;

    for (const wrapper of pads) {
      const rawPad = wrapper?.pad;
      if (!rawPad) {
        continue;
      }

      const dualActuator = rawPad.vibrationActuator;
      if (dualActuator && typeof dualActuator.playEffect === 'function') {
        dualActuator
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            strongMagnitude: Phaser.Math.Clamp(strongMagnitude, 0, 1),
            weakMagnitude: Phaser.Math.Clamp(weakMagnitude, 0, 1)
          })
          .catch(() => {});
        continue;
      }

      const haptic = rawPad.hapticActuators?.[0];
      if (haptic && typeof haptic.pulse === 'function') {
        haptic.pulse(Phaser.Math.Clamp(Math.max(strongMagnitude, weakMagnitude), 0, 1), durationMs).catch?.(() => {});
      }
    }
  }

  createCardSystem() {
    this.cardCatalog = this.buildCardCatalog();

    this.pressureText = this.add
      .text(18, 70, '', {
        fontFamily: 'Consolas',
        fontSize: '16px',
        color: '#fcd34d'
      })
      .setDepth(300)
      .setShadow(0, 2, '#000000', 8);

    this.createEffectHud();

    if (this.input.keyboard) {
      this.cardInputKeys = this.input.keyboard.addKeys({
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        d: Phaser.Input.Keyboard.KeyCodes.D,
        enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE
      });
    }

    this.refreshCardHud();
    this.updateEffectHud();
  }

  createEffectHud() {
    this.effectHudGraphics = this.add.graphics().setDepth(304);
    this.effectHudTitle = this.add
      .text(0, 0, 'ACTIVE EFFECTS', {
        fontFamily: 'Consolas',
        fontSize: '14px',
        color: '#cbd5e1'
      })
      .setDepth(305)
      .setOrigin(1, 0);
    this.effectHudRows = [];
  }

  buildCardCatalog() {
    return [
      {
        id: 'coolant_flush',
        name: 'Coolant Flush',
        archetype: 'rescue',
        rarity: 'common',
        description: 'Reset speeds to base, then ramp back up.',
        note: 'Speed reset and smooth recovery.'
      },
      {
        id: 'smart_sort_protocol',
        name: 'Smart Sort Protocol',
        archetype: 'rescue',
        rarity: 'rare',
        description: 'Auto-sort active items and clear the main belt.',
        note: 'Emergency reshuffle and breathing room.'
      },
      {
        id: 'emergency_brake',
        name: 'Emergency Brake',
        archetype: 'rescue',
        rarity: 'common',
        description: 'Apply factory-wide slow motion for 7 seconds.',
        note: '45% slow, next 12 spawns score -20%.'
      },
      {
        id: 'overflow_purge',
        name: 'Overflow Purge',
        archetype: 'rescue',
        rarity: 'rare',
        description: 'Delete up to 5 oldest jammed items immediately.',
        note: 'Pay 250 + 30 per purged item.'
      },
      {
        id: 'inserter_calibration',
        name: 'Inserter Calibration',
        archetype: 'control',
        rarity: 'common',
        description: 'Prioritize type-correct sidebelt routing temporarily.',
        note: 'Routes matching type first, then equalization fallback.'
      },
      {
        id: 'chest_priority_mode',
        name: 'Chest Priority Mode',
        archetype: 'control',
        rarity: 'common',
        description: 'Temporarily enable full chest forgiveness.',
        note: 'Auto-clears jammed lane ends and accepts wrong items for 15s.'
      },
      {
        id: 'belt_rephase',
        name: 'Belt Rephase',
        archetype: 'control',
        rarity: 'common',
        description: 'Increase side-belt spacing tolerance for 12 seconds.',
        note: 'Safer side flow, main belt +8% speed.'
      },
      {
        id: 'predictive_pull',
        name: 'Predictive Pull',
        archetype: 'control',
        rarity: 'rare',
        description: 'Improve routing bias for the next 20 spawned items.',
        note: 'Spawn interval is 8% faster while active.'
      },
      {
        id: 'turbo_shift',
        name: 'Turbo Shift',
        archetype: 'greed',
        rarity: 'rare',
        description: 'Higher score gain at higher speed pressure.',
        note: '+25% score, +18% belt speed for 18 seconds.'
      },
      {
        id: 'combo_furnace',
        name: 'Combo Furnace',
        archetype: 'greed',
        rarity: 'rare',
        description: 'Boost combo growth with bigger downside risk.',
        note: '+2 multiplier gain, one jam costs 200.'
      },
      {
        id: 'risky_throughput',
        name: 'Risky Throughput',
        archetype: 'greed',
        rarity: 'common',
        description: 'Push spawn rate up for 16 seconds.',
        note: '+25% spawn rate, +2 bonus per correct consume.'
      },
      {
        id: 'fragile_jackpot',
        name: 'Fragile Jackpot',
        archetype: 'greed',
        rarity: 'epic',
        description: 'Gain instant points at the cost of drag stability.',
        note: '+1200 score, no drag slow-mo for 10 seconds.'
      }
    ];
  }

  refreshCardHud() {
    if (this.pressureText) {
      this.pressureText.setText(`PRESSURE ${Math.round(this.currentPressure * 100)}%`);
    }
  }

  formatEffectTime(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 100) / 10);
    return `${seconds.toFixed(1)}s`;
  }

  getActiveEffectHudEntries() {
    const entries = [];

    const pushTimed = (remainingMs, totalMs, label, color, suffix = '') => {
      if (remainingMs <= 0) {
        return;
      }

      const progress = Phaser.Math.Clamp(remainingMs / Math.max(1, totalMs), 0, 1);
      const suffixText = suffix ? ` ${suffix}` : '';
      entries.push({
        label,
        value: `${this.formatEffectTime(remainingMs)}${suffixText}`,
        progress,
        color
      });
    };

    if (this.coolantFlushHoldMs > 0) {
      pushTimed(this.coolantFlushHoldMs, this.coolantFlushHoldDurationMs, 'Coolant Hold', 0x22d3ee);
    } else if (this.coolantFlushRampMs > 0) {
      pushTimed(this.coolantFlushRampMs, this.coolantFlushRampDurationMs, 'Coolant Ramp', 0x38bdf8);
    }

    pushTimed(this.smartSortScoreLockMs, this.smartSortScoreLockDurationMs, 'No Score', 0x06b6d4);
    pushTimed(this.inserterCalibrationMs, this.inserterCalibrationDurationMs, 'Inserter Calib', 0xf59e0b);

    if (this.chestPriorityMs > 0) {
      pushTimed(
        this.chestPriorityMs,
        this.chestPriorityDurationMs,
        'Chest Tolerance',
        0xfb923c,
        '| AUTO'
      );
    }

    pushTimed(this.turboShiftMs, this.turboShiftDurationMs, 'Turbo Shift', 0xef4444);
    if (this.comboFurnaceMs > 0) {
      const penaltyState = this.comboFurnaceJamPenaltyArmed ? 'armed' : 'spent';
      pushTimed(
        this.comboFurnaceMs,
        this.comboFurnaceDurationMs,
        'Combo Furnace',
        0xf43f5e,
        `| ${penaltyState}`
      );
    }

    pushTimed(this.emergencyBrakeMs, this.emergencyBrakeDurationMs, 'Emergency Brake', 0x22d3ee);
    if (this.emergencyBrakePenaltySpawnsRemaining > 0) {
      const maxPenaltySpawns = Math.max(1, this.emergencyBrakePenaltySpawns);
      entries.push({
        label: 'Brake Penalty',
        value: `${this.emergencyBrakePenaltySpawnsRemaining}/${maxPenaltySpawns} spawns`,
        progress: Phaser.Math.Clamp(this.emergencyBrakePenaltySpawnsRemaining / maxPenaltySpawns, 0, 1),
        color: 0x38bdf8
      });
    }

    pushTimed(this.beltRephaseMs, this.beltRephaseDurationMs, 'Belt Rephase', 0xf59e0b);

    if (this.predictivePullSpawnsRemaining > 0) {
      const maxPredictiveSpawns = Math.max(1, this.predictivePullSpawnsCap || this.predictivePullSpawnsPerUse);
      entries.push({
        label: 'Predictive Pull',
        value: `${this.predictivePullSpawnsRemaining}/${maxPredictiveSpawns} spawns`,
        progress: Phaser.Math.Clamp(this.predictivePullSpawnsRemaining / maxPredictiveSpawns, 0, 1),
        color: 0xf59e0b
      });
    }

    pushTimed(this.riskyThroughputMs, this.riskyThroughputDurationMs, 'Risky Throughput', 0xef4444);
    pushTimed(this.fragileJackpotNoSlowMoMs, this.fragileJackpotDurationMs, 'No Slow-Mo', 0xdc2626);

    return entries;
  }

  ensureEffectHudRows(count) {
    while (this.effectHudRows.length < count) {
      const labelText = this.add
        .text(0, 0, '', {
          fontFamily: 'Consolas',
          fontSize: '13px',
          color: '#e2e8f0'
        })
        .setDepth(305);

      const valueText = this.add
        .text(0, 0, '', {
          fontFamily: 'Consolas',
          fontSize: '12px',
          color: '#94a3b8'
        })
        .setDepth(305)
        .setOrigin(1, 0);

      this.effectHudRows.push({ labelText, valueText });
    }

    for (let index = count; index < this.effectHudRows.length; index += 1) {
      this.effectHudRows[index].labelText.setVisible(false);
      this.effectHudRows[index].valueText.setVisible(false);
    }
  }

  updateEffectHud() {
    if (!this.effectHudGraphics || !this.effectHudTitle) {
      return;
    }

    const entries = this.getActiveEffectHudEntries();
    this.effectHudGraphics.clear();

    if (entries.length === 0) {
      this.effectHudTitle.setVisible(false);
      this.ensureEffectHudRows(0);
      return;
    }

    const panelRight = 1262;
    const panelTop = 12;
    const panelWidth = 350;
    const panelLeft = panelRight - panelWidth;
    const padding = 10;
    const titleHeight = 18;
    const rowHeight = 32;
    const barHeight = 6;
    const panelHeight = padding + titleHeight + 8 + entries.length * rowHeight + 8;

    this.effectHudGraphics.fillStyle(0x0b1220, 0.88);
    this.effectHudGraphics.fillRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 8);
    this.effectHudGraphics.lineStyle(1, 0x334155, 0.95);
    this.effectHudGraphics.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 8);

    this.effectHudTitle.setVisible(true);
    this.effectHudTitle.setPosition(panelRight - padding, panelTop + padding);

    this.ensureEffectHudRows(entries.length);

    const barX = panelLeft + padding;
    const barWidth = panelWidth - padding * 2;

    entries.forEach((entry, index) => {
      const rowTop = panelTop + padding + titleHeight + 6 + index * rowHeight;
      const barY = rowTop + 20;

      const row = this.effectHudRows[index];
      row.labelText.setVisible(true);
      row.valueText.setVisible(true);
      row.labelText.setPosition(barX, rowTop);
      row.valueText.setPosition(panelRight - padding, rowTop);
      row.labelText.setText(entry.label);
      row.valueText.setText(entry.value);

      this.effectHudGraphics.fillStyle(0x1f2937, 0.96);
      this.effectHudGraphics.fillRect(barX, barY, barWidth, barHeight);

      const clampedProgress = Phaser.Math.Clamp(entry.progress ?? 0, 0, 1);
      let fillWidth = Math.floor(barWidth * clampedProgress);
      if (clampedProgress > 0 && fillWidth < 2) {
        fillWidth = 2;
      }

      if (fillWidth > 0) {
        this.effectHudGraphics.fillStyle(entry.color ?? 0x38bdf8, 1);
        this.effectHudGraphics.fillRect(barX, barY, fillWidth, barHeight);
      }
    });
  }

  updateCardEffects(deltaMs) {
    if (deltaMs <= 0) {
      return;
    }

    if (this.coolantFlushHoldMs > 0) {
      this.coolantFlushHoldMs = Math.max(0, this.coolantFlushHoldMs - deltaMs);
    } else if (this.coolantFlushRampMs > 0) {
      this.coolantFlushRampMs = Math.max(0, this.coolantFlushRampMs - deltaMs);
    }

    if (this.smartSortScoreLockMs > 0) {
      this.smartSortScoreLockMs = Math.max(0, this.smartSortScoreLockMs - deltaMs);
    }

    if (this.inserterCalibrationMs > 0) {
      this.inserterCalibrationMs = Math.max(0, this.inserterCalibrationMs - deltaMs);
    }

    if (this.chestPriorityMs > 0) {
      const previous = this.chestPriorityMs;
      this.chestPriorityMs = Math.max(0, this.chestPriorityMs - deltaMs);
      if (previous > 0 && this.chestPriorityMs <= 0) {
        this.resetChestPriorityCharges();
      }
    }

    if (this.turboShiftMs > 0) {
      this.turboShiftMs = Math.max(0, this.turboShiftMs - deltaMs);
    }

    if (this.comboFurnaceMs > 0) {
      this.comboFurnaceMs = Math.max(0, this.comboFurnaceMs - deltaMs);
      if (this.comboFurnaceMs <= 0) {
        this.comboFurnaceJamPenaltyArmed = false;
      }
    }

    if (this.emergencyBrakeMs > 0) {
      this.emergencyBrakeMs = Math.max(0, this.emergencyBrakeMs - deltaMs);
    }

    if (this.beltRephaseMs > 0) {
      this.beltRephaseMs = Math.max(0, this.beltRephaseMs - deltaMs);
    }

    if (this.riskyThroughputMs > 0) {
      this.riskyThroughputMs = Math.max(0, this.riskyThroughputMs - deltaMs);
    }

    if (this.fragileJackpotNoSlowMoMs > 0) {
      this.fragileJackpotNoSlowMoMs = Math.max(0, this.fragileJackpotNoSlowMoMs - deltaMs);
    }
  }

  applyCardEffect(card) {
    if (!card?.id) {
      return;
    }

    if (card.id === 'coolant_flush') {
      this.activateCoolantFlush();
      return;
    }

    if (card.id === 'smart_sort_protocol') {
      this.activateSmartSortProtocol();
      return;
    }

    if (card.id === 'inserter_calibration') {
      this.activateInserterCalibration();
      return;
    }

    if (card.id === 'chest_priority_mode') {
      this.activateChestPriorityMode();
      return;
    }

    if (card.id === 'turbo_shift') {
      this.activateTurboShift();
      return;
    }

    if (card.id === 'combo_furnace') {
      this.activateComboFurnace();
      return;
    }

    if (card.id === 'emergency_brake') {
      this.activateEmergencyBrake();
      return;
    }

    if (card.id === 'overflow_purge') {
      this.activateOverflowPurge();
      return;
    }

    if (card.id === 'belt_rephase') {
      this.activateBeltRephase();
      return;
    }

    if (card.id === 'predictive_pull') {
      this.activatePredictivePull();
      return;
    }

    if (card.id === 'risky_throughput') {
      this.activateRiskyThroughput();
      return;
    }

    if (card.id === 'fragile_jackpot') {
      this.activateFragileJackpot();
    }
  }

  activateCoolantFlush() {
    this.breakCombo();
    this.multiplier = 1;
    this.refreshScoreUi();

    this.coolantFlushHoldMs = this.coolantFlushHoldDurationMs;
    this.coolantFlushRampMs = this.coolantFlushRampDurationMs;
  }

  activateSmartSortProtocol() {
    this.abortActiveDrag();
    this.smartSortScoreLockMs = this.smartSortScoreLockDurationMs;

    for (const lane of Object.values(this.lanesById)) {
      if (lane?.clawContainer?.active) {
        this.tweens.killTweensOf(lane.clawContainer);
        lane.clawContainer.setAngle(lane.clawBaseAngle ?? 0);
      }
      if (lane?.chestClawContainer?.active) {
        this.tweens.killTweensOf(lane.chestClawContainer);
        lane.chestClawContainer.setAngle(lane.chestClawBaseAngle ?? 0);
      }
    }

    const laneIdByFoodType = LANE_LAYOUT.reduce((acc, lane) => {
      acc[lane.desiredType] = lane.id;
      return acc;
    }, {});

    const laneBuckets = LANE_LAYOUT.reduce((acc, lane) => {
      acc[lane.id] = [];
      return acc;
    }, {});

    for (const item of this.items) {
      if (!item || item.state === 'consuming') {
        continue;
      }

      const destinationLaneId = laneIdByFoodType[item.type];
      const lane = this.lanesById[destinationLaneId];
      if (!destinationLaneId || !lane) {
        continue;
      }

      this.tweens.killTweensOf(item.container);
      item.motionLock = false;
      item.state = 'side';
      item.laneId = destinationLaneId;
      item.mainPos = 0;
      item.holdMainPos = null;

      if (item.container?.active) {
        item.container.setAlpha(1);
        item.container.setScale(1);
        item.container.setAngle(0);
        item.container.setDepth(10);
      }

      if (item.grabHandle?.active) {
        if (!item.grabHandle.input?.enabled) {
          item.grabHandle.setInteractive({ useHandCursor: true });
          this.input.setDraggable(item.grabHandle);
        }
        item.grabHandle.setDepth(11);
        if (item.grabHandle.input) {
          item.grabHandle.input.cursor = 'grab';
        }
      }

      this.clearItemTint(item);
      laneBuckets[destinationLaneId].push(item);
    }

    for (const laneConfig of LANE_LAYOUT) {
      const lane = this.lanesById[laneConfig.id];
      const bucket = laneBuckets[laneConfig.id];
      if (!lane || !bucket || bucket.length === 0) {
        continue;
      }

      bucket.sort((a, b) => a.id - b.id);

      const usableLength = Math.max(1, lane.length);
      const spacing = bucket.length <= 1 ? 0 : usableLength / (bucket.length - 1);

      bucket.forEach((item, index) => {
        const lanePos = Phaser.Math.Clamp(spacing * index, 0, lane.length);
        item.lanePos = lanePos;
        item.x = lane.intakeX + lane.direction * lanePos;
        item.y = lane.y;

        if (item.container?.active) {
          item.container.setPosition(item.x, item.y);
        }
        if (item.grabHandle?.active) {
          item.grabHandle.setPosition(item.x, item.y);
        }
      });
    }

    this.syncItemPositions();
  }

  activateInserterCalibration() {
    this.inserterCalibrationMs = this.inserterCalibrationDurationMs;
  }

  activateChestPriorityMode() {
    this.chestPriorityMs = this.chestPriorityDurationMs;
    this.resetChestPriorityCharges();
  }

  activateTurboShift() {
    this.turboShiftMs = this.turboShiftDurationMs;
  }

  activateComboFurnace() {
    this.comboFurnaceMs = this.comboFurnaceDurationMs;
    this.comboFurnaceJamPenaltyArmed = true;
  }

  activateEmergencyBrake() {
    this.emergencyBrakeMs = this.emergencyBrakeDurationMs;
    this.emergencyBrakePenaltySpawnsRemaining = this.emergencyBrakePenaltySpawns;
  }

  activateOverflowPurge() {
    const jammed = this.items
      .filter((item) => item.state === 'jammed')
      .sort((a, b) => a.id - b.id)
      .slice(0, this.overflowPurgeMaxItems);

    const removedCount = jammed.length;
    for (const item of jammed) {
      this.removeItemById(item.id);
    }

    const penalty = this.overflowPurgeBasePenalty + removedCount * this.overflowPurgePenaltyPerItem;
    this.score = Math.max(0, this.score - penalty);
    this.breakCombo();
    this.refreshScoreUi();
    this.bumpUiText(this.scoreText, 1.1, 95);
  }

  activateBeltRephase() {
    this.beltRephaseMs = this.beltRephaseDurationMs;
  }

  activatePredictivePull() {
    this.predictivePullSpawnsRemaining += this.predictivePullSpawnsPerUse;
    this.predictivePullSpawnsCap = Math.max(this.predictivePullSpawnsCap, this.predictivePullSpawnsRemaining);
  }

  activateRiskyThroughput() {
    this.riskyThroughputMs = this.riskyThroughputDurationMs;
  }

  activateFragileJackpot() {
    this.score += this.fragileJackpotPoints;
    this.refreshScoreUi();
    this.bumpUiText(this.scoreText, 1.14, 95);
    this.fragileJackpotNoSlowMoMs = this.fragileJackpotDurationMs;
  }

  getActiveSideSpacing() {
    if (this.beltRephaseMs > 0) {
      return this.itemSpacing * this.beltRephaseSideSpacingScale;
    }

    return this.itemSpacing;
  }

  resetChestPriorityCharges() {
    this.chestPriorityChargesByLaneId = LANE_LAYOUT.reduce((acc, lane) => {
      acc[lane.id] = 0;
      return acc;
    }, {});
  }

  hasChestPriorityCharge(laneId) {
    return this.chestPriorityMs > 0;
  }

  consumeChestPriorityCharge(laneId) {
    return this.hasChestPriorityCharge(laneId);
  }

  getTotalChestPriorityCharges() {
    if (this.chestPriorityMs <= 0) {
      return 0;
    }

    return LANE_LAYOUT.length;
  }

  calculatePressureSnapshot() {
    const laneCount = Math.max(1, LANE_LAYOUT.length);

    const mainItemCount = this.items.filter((item) => item.state === 'main' || item.state === 'stopped-main').length;
    const mainCapacity = Math.max(1, Math.floor(this.mainLength / Math.max(1, this.itemSpacing)));
    const mainFill = Phaser.Math.Clamp(mainItemCount / mainCapacity, 0, 1);

    const blockedIntakes = LANE_LAYOUT.reduce((count, lane) => count + (this.canEnterLane(lane.id) ? 0 : 1), 0);
    const intakeBlock = Phaser.Math.Clamp(blockedIntakes / laneCount, 0, 1);

    const jammedCount = this.items.filter((item) => item.state === 'jammed').length;
    const jamCapacity = laneCount * 3;
    const jamLoad = Phaser.Math.Clamp(jammedCount / Math.max(1, jamCapacity), 0, 1);

    const mainSpeedStressRange = Math.max(1, this.maxMainSpeed - this.baseMainSpeed);
    const sideSpeedStressRange = Math.max(1, this.maxSideSpeed - this.baseSideSpeed);
    const spawnStressRange = Math.max(1, this.baseSpawnIntervalMs - this.minSpawnIntervalMs);

    const mainSpeedStress = Phaser.Math.Clamp((this.mainSpeed - this.baseMainSpeed) / mainSpeedStressRange, 0, 1);
    const sideSpeedStress = Phaser.Math.Clamp((this.sideSpeed - this.baseSideSpeed) / sideSpeedStressRange, 0, 1);
    const spawnStress = Phaser.Math.Clamp((this.baseSpawnIntervalMs - this.spawnIntervalMs) / spawnStressRange, 0, 1);
    const speedStress = Phaser.Math.Clamp((mainSpeedStress + sideSpeedStress + spawnStress) / 3, 0, 1);

    const pressure = Phaser.Math.Clamp(mainFill * 0.35 + intakeBlock * 0.25 + jamLoad * 0.2 + speedStress * 0.2, 0, 1);

    return {
      pressure,
      mainFill,
      intakeBlock,
      jamLoad,
      speedStress
    };
  }

  updateCardDraftSystem(deltaMs) {
    if (deltaMs <= 0 || this.isGameOver) {
      return;
    }

    this.cardDraftCooldownMs = Math.max(0, this.cardDraftCooldownMs - deltaMs);

    if (!this.isDraftActive) {
      this.timeSinceLastDraftMs += deltaMs;
    }

    if (this.cardScoreMilestonePoints > 0) {
      while (this.score >= this.nextCardScoreMilestone) {
        this.pendingScoreDraft = true;
        this.nextCardScoreMilestone += this.cardScoreMilestonePoints;
      }
    }

    this.pressureSampleTimerMs += deltaMs;
    while (this.pressureSampleTimerMs >= this.pressureSampleIntervalMs) {
      this.pressureSampleTimerMs -= this.pressureSampleIntervalMs;

      const pressureSnapshot = this.calculatePressureSnapshot();
      this.currentPressure = pressureSnapshot.pressure;

      if (this.currentPressure >= this.cardEmergencyThreshold) {
        this.highPressureHoldMs += this.pressureSampleIntervalMs;
      } else {
        this.highPressureHoldMs = Math.max(0, this.highPressureHoldMs - this.pressureSampleIntervalMs * 0.5);
      }
    }

    this.refreshCardHud();

    if (this.isDraftActive || this.dragContext || this.cardDraftCooldownMs > 0 || this.isPrimaryPointerDown()) {
      return;
    }

    let triggerType = null;

    if (this.highPressureHoldMs >= this.cardEmergencyHoldDurationMs && this.currentPressure >= this.cardEmergencyThreshold) {
      triggerType = 'emergency';
    } else if (this.pendingScoreDraft) {
      triggerType = 'score';
    } else if (this.timeSinceLastDraftMs >= this.cardPityDurationMs && this.currentPressure >= this.cardPityThreshold) {
      triggerType = 'pity';
    }

    if (!triggerType) {
      return;
    }

    const opened = this.openCardDraft(triggerType);
    if (opened && triggerType === 'score') {
      this.pendingScoreDraft = false;
    }
  }

  openCardDraft(triggerType) {
    if (this.isGameOver || this.isDraftActive) {
      return false;
    }

    const choices = this.buildDraftChoices(triggerType);
    if (choices.length < 3) {
      return false;
    }

    this.abortActiveDrag();

    this.isDraftActive = true;
    this.activeDraftTrigger = triggerType;
    this.cardDraftChoices = choices;
    this.cardDraftEntries = [];
    this.cardDraftSelectedIndex = 0;
    this.cardDraftPointerLockMs = this.cardDraftPointerLockDurationMs;
    this.cardDraftPointerReleaseRequired = this.isPrimaryPointerDown();
    this.cardDraftCooldownMs = this.cardDraftCooldownDurationMs;
    this.timeSinceLastDraftMs = 0;
    this.highPressureHoldMs = 0;

    const container = this.add.container(0, 0).setDepth(360);
    const scrim = this.add.rectangle(640, 360, 1280, 720, 0x020617, 0.78).setInteractive();
    scrim.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
    });

    const panel = this.add.rectangle(640, 360, 1160, 520, 0x0b1220, 0.96).setStrokeStyle(2, 0x334155, 1);
    const title = this.add
      .text(640, 148, 'SYSTEM CARD DRAFT', {
        fontFamily: 'Consolas',
        fontSize: '34px',
        color: '#e2e8f0'
      })
      .setOrigin(0.5);

    const reasonLabel = this.add
      .text(640, 188, `Trigger: ${this.formatDraftTrigger(triggerType)} | Pressure ${Math.round(this.currentPressure * 100)}%`, {
        fontFamily: 'Consolas',
        fontSize: '18px',
        color: '#93c5fd'
      })
      .setOrigin(0.5);

    const helper = this.add
      .text(640, 585, 'Choose one card  |  Mouse click or Left/Right + Enter', {
        fontFamily: 'Consolas',
        fontSize: '16px',
        color: '#94a3b8'
      })
      .setOrigin(0.5);

    panel.setAlpha(0);
    panel.setScale(0.96);
    title.setAlpha(0);
    reasonLabel.setAlpha(0);
    helper.setAlpha(0);

    container.add([scrim, panel, title, reasonLabel, helper]);

    const cardWidth = 320;
    const cardHeight = 300;
    const gap = 32;
    const firstX = 640 - cardWidth - gap;
    const cardY = 360;

    choices.forEach((card, index) => {
      const cardX = firstX + index * (cardWidth + gap);
      this.createDraftCardVisual(container, card, cardX, cardY, cardWidth, cardHeight, index);
    });

    this.cardDraftContainer = container;
    this.setDraftSelection(0);

    this.tweens.add({
      targets: [panel, title, reasonLabel, helper],
      alpha: 1,
      duration: 220,
      ease: 'Quad.Out'
    });
    this.tweens.add({
      targets: panel,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: 'Back.Out'
    });
    this.playImpactFx(0.42, 0x93c5fd);
    this.playSfx('draft-open', 1);
    this.emitShockRing(640, 360, 0x93c5fd, 2.2, 220);
    this.rumble(0.18, 0.12, 78);

    return true;
  }

  buildDraftChoices(triggerType) {
    const available = this.cardCatalog.slice();
    if (available.length < 3) {
      return [];
    }

    const stage = this.score < 12000 ? 'early' : this.score < 24000 ? 'mid' : 'late';
    const rarityWeightById = {
      common: 1,
      rare: 0.62,
      epic: 0.28
    };

    const archetypeStageWeightById = {
      early: { rescue: 1.05, control: 1.25, greed: 0.9 },
      mid: { rescue: 1, control: 1, greed: 1 },
      late: { rescue: 1.25, control: 0.92, greed: 1.2 }
    };

    const selected = [];
    const selectedIds = new Set();

    const pickFrom = (archetypes, options = {}) => {
      const { requireRescue = false } = options;
      const pool = available.filter((card) => archetypes.includes(card.archetype) && !selectedIds.has(card.id));
      if (pool.length === 0) {
        return null;
      }

      const weightedPool = [];
      for (const card of pool) {
        if (requireRescue && card.archetype !== 'rescue') {
          continue;
        }

        const rarityWeight = rarityWeightById[card.rarity] ?? 1;
        const stageWeight = archetypeStageWeightById[stage]?.[card.archetype] ?? 1;

        let weight = rarityWeight * stageWeight;
        if (triggerType === 'emergency' && card.archetype === 'rescue') {
          weight *= 1.65;
        }
        if (triggerType === 'score' && card.archetype === 'greed') {
          weight *= 1.2;
        }
        if (card.id === this.lastPickedCardId) {
          weight *= 0.18;
        }

        weightedPool.push({ card, weight: Math.max(0.01, weight) });
      }

      if (weightedPool.length === 0) {
        return null;
      }

      const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
      let random = Math.random() * totalWeight;

      for (const entry of weightedPool) {
        random -= entry.weight;
        if (random <= 0) {
          return entry.card;
        }
      }

      return weightedPool[weightedPool.length - 1].card;
    };

    const addCard = (card) => {
      if (!card || selectedIds.has(card.id)) {
        return;
      }
      selected.push(card);
      selectedIds.add(card.id);
    };

    addCard(pickFrom(['rescue', 'control']));
    addCard(pickFrom(['control', 'greed']));

    const highPressureDraft = triggerType === 'emergency' || this.currentPressure >= 0.75;
    if (highPressureDraft && !selected.some((card) => card.archetype === 'rescue')) {
      addCard(pickFrom(['rescue'], { requireRescue: true }));
    }

    while (selected.length < 3) {
      addCard(pickFrom(['rescue', 'control', 'greed']));
      if (selected.length >= available.length) {
        break;
      }
    }

    return selected.slice(0, 3);
  }

  createDraftCardVisual(container, card, x, y, width, height, index) {
    const archetypeColorById = {
      rescue: 0x22d3ee,
      control: 0xf59e0b,
      greed: 0xef4444
    };

    const archetypeColor = archetypeColorById[card.archetype] ?? 0x94a3b8;

    const cardBg = this.add
      .rectangle(x, y, width, height, 0x111827, 0.95)
      .setStrokeStyle(2, archetypeColor, 1)
      .setInteractive({ useHandCursor: true });
    cardBg.setAlpha(0);
    cardBg.setScale(0.9);

    const archetype = this.add
      .text(x, y - 112, card.archetype.toUpperCase(), {
        fontFamily: 'Consolas',
        fontSize: '15px',
        color: '#cbd5e1'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const name = this.add
      .text(x, y - 74, card.name, {
        fontFamily: 'Consolas',
        fontSize: '24px',
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: width - 36 }
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const description = this.add
      .text(x, y - 6, card.description, {
        fontFamily: 'Consolas',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
        wordWrap: { width: width - 34 }
      })
      .setOrigin(0.5)
      .setAlpha(0);

    cardBg.on('pointerover', () => {
      this.setDraftSelection(index);
    });

    cardBg.on('pointerdown', () => {
      if (!this.isDraftPointerPickReady()) {
        return;
      }
      this.pickDraftCard(index);
    });

    container.add([cardBg, archetype, name, description]);
    this.cardDraftEntries.push({ cardBg, archetypeColor, selectionTween: null });

    const enterDelay = 80 + index * 70;
    this.tweens.add({
      targets: [cardBg, archetype, name, description],
      alpha: 1,
      duration: 190,
      delay: enterDelay,
      ease: 'Quad.Out'
    });
    this.tweens.add({
      targets: cardBg,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      delay: enterDelay,
      ease: 'Back.Out'
    });
  }

  setDraftSelection(index) {
    if (!this.isDraftActive || this.cardDraftEntries.length === 0) {
      return;
    }

    const previousIndex = this.cardDraftSelectedIndex;
    const entryCount = this.cardDraftEntries.length;
    this.cardDraftSelectedIndex = Phaser.Math.Wrap(index, 0, entryCount);
    this.refreshDraftSelection();

    if (this.cardDraftSelectedIndex !== previousIndex) {
      const nowMs = this.time?.now ?? 0;
      if (nowMs - this.lastDraftSelectSfxMs >= 70) {
        this.lastDraftSelectSfxMs = nowMs;
        this.playSfx('draft-select', 0.9);
      }
    }
  }

  refreshDraftSelection() {
    this.cardDraftEntries.forEach((entry, index) => {
      const selected = index === this.cardDraftSelectedIndex;
      const strokeColor = selected ? 0xf8fafc : entry.archetypeColor;
      const fillColor = selected ? 0x1e293b : 0x111827;

      entry.cardBg.setFillStyle(fillColor, 0.95);
      entry.cardBg.setStrokeStyle(selected ? 4 : 2, strokeColor, 1);

      if (entry.selectionTween) {
        entry.selectionTween.remove();
        entry.selectionTween = null;
      }

      entry.selectionTween = this.tweens.add({
        targets: entry.cardBg,
        scaleX: selected ? 1.04 : 1,
        scaleY: selected ? 1.04 : 1,
        duration: 110,
        ease: 'Quad.Out'
      });
    });
  }

  isPrimaryPointerDown() {
    return this.input?.activePointer?.isDown === true;
  }

  isDraftPointerPickReady() {
    if (!this.isDraftActive || this.cardDraftPointerLockMs > 0) {
      return false;
    }

    if (this.cardDraftPointerReleaseRequired) {
      if (this.isPrimaryPointerDown()) {
        return false;
      }
      this.cardDraftPointerReleaseRequired = false;
    }

    return true;
  }

  updateDraftInput(deltaMs = 0) {
    if (!this.isDraftActive || !this.cardInputKeys) {
      return;
    }

    if (this.cardDraftPointerLockMs > 0) {
      this.cardDraftPointerLockMs = Math.max(0, this.cardDraftPointerLockMs - deltaMs);
    }

    if (this.cardDraftPointerReleaseRequired && !this.isPrimaryPointerDown()) {
      this.cardDraftPointerReleaseRequired = false;
    }

    const leftPressed =
      Phaser.Input.Keyboard.JustDown(this.cardInputKeys.left) ||
      Phaser.Input.Keyboard.JustDown(this.cardInputKeys.a);
    if (leftPressed) {
      this.setDraftSelection(this.cardDraftSelectedIndex - 1);
      return;
    }

    const rightPressed =
      Phaser.Input.Keyboard.JustDown(this.cardInputKeys.right) ||
      Phaser.Input.Keyboard.JustDown(this.cardInputKeys.d);
    if (rightPressed) {
      this.setDraftSelection(this.cardDraftSelectedIndex + 1);
      return;
    }

    const confirmPressed =
      Phaser.Input.Keyboard.JustDown(this.cardInputKeys.enter) ||
      Phaser.Input.Keyboard.JustDown(this.cardInputKeys.space);
    if (confirmPressed) {
      this.pickDraftCard(this.cardDraftSelectedIndex);
    }
  }

  pickDraftCard(index) {
    if (!this.isDraftActive) {
      return;
    }

    const chosenCard = this.cardDraftChoices[index];
    if (!chosenCard) {
      return;
    }

    const chosenEntry = this.cardDraftEntries[index];
    if (chosenEntry?.cardBg?.active) {
      this.tweens.add({
        targets: chosenEntry.cardBg,
        scaleX: 1.14,
        scaleY: 1.14,
        duration: 120,
        yoyo: true,
        ease: 'Quad.Out'
      });
    }

    this.applyCardEffect(chosenCard);
    this.playImpactFx(0.62, 0x22d3ee);
    this.playSfx('draft-pick', 1.1);
    this.emitShockRing(640, 360, 0x67e8f9, 2.7, 250);
    this.rumble(0.34, 0.26, 110);

    this.lastPickedCardId = chosenCard.id;
    this.lastPickedCardName = chosenCard.name;
    this.cardPickCount += 1;

    const pickToast = this.add
      .text(640, 132, `${chosenCard.name} selected`, {
        fontFamily: 'Consolas',
        fontSize: '26px',
        color: '#e2e8f0'
      })
      .setDepth(320)
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 8);
    pickToast.setScale(0.88);

    this.tweens.add({
      targets: pickToast,
      y: 100,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 900,
      ease: 'Quad.Out',
      onComplete: () => {
        pickToast.destroy();
      }
    });

    this.closeCardDraft();
    this.refreshCardHud();
  }

  closeCardDraft() {
    if (this.cardDraftContainer?.active) {
      this.cardDraftContainer.destroy(true);
    }

    this.cardDraftContainer = null;
    this.cardDraftChoices = [];
    this.cardDraftEntries = [];
    this.cardDraftSelectedIndex = 0;
    this.cardDraftPointerLockMs = 0;
    this.cardDraftPointerReleaseRequired = false;
    this.activeDraftTrigger = null;
    this.isDraftActive = false;
  }

  formatDraftTrigger(triggerType) {
    if (triggerType === 'emergency') {
      return 'Emergency';
    }
    if (triggerType === 'score') {
      return 'Score Milestone';
    }
    if (triggerType === 'pity') {
      return 'Pity Timer';
    }

    return 'Unknown';
  }

  abortActiveDrag() {
    if (!this.dragContext) {
      return;
    }

    const draggedItem = this.getItemById(this.dragContext.itemId);
    if (draggedItem) {
      draggedItem.motionLock = false;
      this.applyItemSlot(draggedItem, this.dragContext.fromSlot);
      const destination = this.getWorldPositionForSlot(this.dragContext.fromSlot);
      draggedItem.x = destination.x;
      draggedItem.y = destination.y;
      draggedItem.container.setPosition(destination.x, destination.y);
      draggedItem.container.setScale(1);
      draggedItem.container.setAngle(0);
      draggedItem.container.setDepth(10);
      draggedItem.grabHandle.setPosition(destination.x, destination.y);
      draggedItem.grabHandle.setDepth(11);
      if (draggedItem.grabHandle?.input) {
        draggedItem.grabHandle.input.cursor = 'grab';
      }
    }

    this.dragContext = null;
    this.setSlowMotion(false);
  }

  createParticles() {
    const particleTextureKey = 'fx_dot';
    if (!this.textures.exists(particleTextureKey)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture(particleTextureKey, 8, 8);
      g.destroy();
    }

    this.chestParticles = this.add
      .particles(0, 0, particleTextureKey, {
        frequency: -1,
        quantity: 0,
        lifespan: { min: 240, max: 420 },
        speed: { min: 80, max: 240 },
        angle: { min: 0, max: 360 },
        gravityY: 320,
        scale: { start: 0.85, end: 0 },
        alpha: { start: 0.95, end: 0 },
        blendMode: 'ADD'
      })
      .setDepth(60);

    this.spawnParticles = this.add
      .particles(0, 0, particleTextureKey, {
        frequency: -1,
        quantity: 0,
        lifespan: { min: 140, max: 260 },
        speed: { min: 40, max: 170 },
        angle: { min: 205, max: 335 },
        gravityY: 160,
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.85, end: 0 },
        blendMode: 'ADD'
      })
      .setDepth(58);

    this.jamParticles = this.add
      .particles(0, 0, particleTextureKey, {
        frequency: -1,
        quantity: 0,
        lifespan: { min: 220, max: 360 },
        speed: { min: 80, max: 220 },
        angle: { min: 0, max: 360 },
        gravityY: 250,
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.95, end: 0 },
        blendMode: 'ADD'
      })
      .setDepth(61);

    this.transferParticles = this.add
      .particles(0, 0, particleTextureKey, {
        frequency: -1,
        quantity: 0,
        lifespan: { min: 120, max: 220 },
        speed: { min: 30, max: 180 },
        angle: { min: 0, max: 360 },
        gravityY: 120,
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.78, end: 0 },
        blendMode: 'ADD'
      })
      .setDepth(59);
  }

  emitChestConsumeParticles(item, lane) {
    if (!this.chestParticles) {
      return;
    }

    this.chestParticles.setParticleTint(item.baseColor ?? 0xffffff);
    this.chestParticles.explode(16, lane.chestX, lane.y);
  }

  emitSpawnParticles(item) {
    if (!this.spawnParticles || !item) {
      return;
    }

    this.spawnParticles.setParticleTint(item.baseColor ?? 0xffffff);
    this.spawnParticles.explode(10, item.x, item.y + 6);
  }

  emitJamParticles(item) {
    if (!this.jamParticles || !item) {
      return;
    }

    this.jamParticles.setParticleTint(0xef4444, 0x94a3b8, item.baseColor ?? 0xffffff);
    this.jamParticles.explode(20, item.x, item.y);
  }

  emitTransferParticles(x, y, color, quantity = 10) {
    if (!this.transferParticles) {
      return;
    }

    this.transferParticles.setParticleTint(color ?? 0xffffff);
    this.transferParticles.explode(Math.max(1, quantity), x, y);
  }

  emitFloatingText(x, y, label, color = '#e2e8f0', fontSize = 18) {
    if (!label) {
      return;
    }

    const floater = this.add
      .text(x, y, label, {
        fontFamily: 'Consolas',
        fontSize: `${fontSize}px`,
        color,
        stroke: '#020617',
        strokeThickness: 3
      })
      .setDepth(330)
      .setOrigin(0.5);

    this.tweens.add({
      targets: floater,
      y: y - 34,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 560,
      ease: 'Cubic.Out',
      onComplete: () => {
        floater.destroy();
      }
    });
  }

  emitShockRing(x, y, color = 0x93c5fd, maxScale = 2.4, duration = 220) {
    const ring = this.add.circle(x, y, 20, color, 0).setDepth(334);
    ring.setStrokeStyle(3, color, 0.92);
    ring.setScale(0.18);

    this.tweens.add({
      targets: ring,
      scaleX: maxScale,
      scaleY: maxScale,
      alpha: 0,
      duration,
      ease: 'Quad.Out',
      onComplete: () => {
        ring.destroy();
      }
    });
  }

  pulseLaneVisual(laneId, intensity = 1, danger = false) {
    const lane = this.lanesById[laneId];
    if (!lane) {
      return;
    }

    const laneColor = danger ? 0xef4444 : this.foodTypeById[lane.desiredType]?.color ?? 0x38bdf8;
    const clampedIntensity = Phaser.Math.Clamp(intensity, 0.2, 2.2);

    if (lane.chestAura?.active) {
      this.tweens.killTweensOf(lane.chestAura);
      lane.chestAura.setFillStyle(laneColor, 0.24);
      lane.chestAura.setScale(0.82);
      lane.chestAura.setAlpha(0.16 + clampedIntensity * 0.18);
      this.tweens.add({
        targets: lane.chestAura,
        alpha: 0.02,
        scaleX: 1.36,
        scaleY: 1.36,
        duration: 280,
        ease: 'Quad.Out'
      });
    }
  }

  playImpactFx(intensity = 1, color = 0xffffff) {
    const amount = Phaser.Math.Clamp(intensity, 0, 2.5);
    if (amount > 0.16) {
      this.cameras.main.shake(70 + amount * 40, 0.0012 + amount * 0.00135, true);
    }

    if (amount > 0.44) {
      const hitStopDuration = Phaser.Math.Clamp(20 + amount * 28, 20, 72);
      const hitStopScale = Phaser.Math.Clamp(0.16 - amount * 0.035, 0.06, 0.16);
      this.triggerHitStop(hitStopDuration, hitStopScale);
      this.rumble(0.22 + amount * 0.18, 0.12 + amount * 0.14, 35 + amount * 45);
    }

    if (!this.flashOverlay?.active) {
      return;
    }

    this.tweens.killTweensOf(this.flashOverlay);
    this.flashOverlay.setFillStyle(color, 1);
    this.flashOverlay.setAlpha(Phaser.Math.Clamp(0.03 + amount * 0.06, 0.03, 0.2));
    this.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: 130 + amount * 70,
      ease: 'Quad.Out'
    });
  }

  updateSceneJuice(deltaMs) {
    if (deltaMs <= 0) {
      return;
    }

    this.fxTimeMs += deltaMs;
    const pressure = Phaser.Math.Clamp(this.currentPressure || 0, 0, 1);
    const pulse = Math.sin(this.fxTimeMs * 0.0042);
    const pulseNormalized = 0.5 + 0.5 * pulse;
    const rhythmPulse = Phaser.Math.Clamp(this.rhythmPulseMs / 130, 0, 1);

    if (this.ambientGlow) {
      this.ambientGlow.left?.setAlpha(0.07 + pressure * 0.06 + pulseNormalized * 0.03 + rhythmPulse * 0.04);
      this.ambientGlow.right?.setAlpha(0.06 + pressure * 0.06 + (1 - pulseNormalized) * 0.03 + rhythmPulse * 0.04);
      this.ambientGlow.center?.setAlpha(0.045 + pressure * 0.05 + pulseNormalized * 0.02 + rhythmPulse * 0.03);
    }

    if (this.moodVignette?.active) {
      this.moodVignette.setAlpha(0.11 + pressure * 0.19);
    }

    const comboEnergy = Phaser.Math.Clamp(this.multiplier / this.maxMultiplier, 0, 1);
    const targetZoom = 1 + pressure * 0.017 + comboEnergy * 0.01 + rhythmPulse * 0.006 + (this.dragContext ? 0.012 : 0);
    this.cameras.main.zoom = Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, 0.08);

    if (this.pressureText?.active) {
      const lowColor = Phaser.Display.Color.ValueToColor(0xfde68a);
      const highColor = Phaser.Display.Color.ValueToColor(0xfb7185);
      const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(lowColor, highColor, 100, Math.round(pressure * 100));
      this.pressureText.setColor(Phaser.Display.Color.RGBToString(mixed.r, mixed.g, mixed.b, 0, '#'));
      this.pressureText.setScale(1 + pressure * 0.03 + Math.max(0, pulse) * 0.012);
    }
  }

  createScoreUi() {
    const baseX = 18;
    const baseY = 16;
    const shadow = { offsetX: 0, offsetY: 2, color: '#000000', blur: 8 };

    this.scoreText = this.add
      .text(baseX, baseY, '', {
        fontFamily: 'Consolas',
        fontSize: '20px',
        color: '#e2e8f0'
      })
      .setDepth(300)
      .setShadow(shadow.offsetX, shadow.offsetY, shadow.color, shadow.blur);

    this.multiplierText = this.add
      .text(baseX, baseY + 28, '', {
        fontFamily: 'Consolas',
        fontSize: '18px',
        color: '#67e8f9'
      })
      .setDepth(300)
      .setShadow(shadow.offsetX, shadow.offsetY, shadow.color, shadow.blur);

    this.refreshScoreUi();
  }

  refreshScoreUi() {
    if (this.scoreText) {
      this.scoreText.setText(`SCORE ${this.score}`);
    }
    if (this.multiplierText) {
      this.multiplierText.setText(`MULT x${this.multiplier}`);
    }
  }

  bumpUiText(textObject, scale = 1.22, duration = 105) {
    if (!textObject) {
      return;
    }

    this.tweens.killTweensOf(textObject);
    textObject.setScale(1);
    this.tweens.add({
      targets: textObject,
      scaleX: scale,
      scaleY: scale,
      duration,
      yoyo: true,
      ease: 'Quad.Out'
    });
  }

  handleComboConsume(consumedItem = null) {
    if (this.smartSortScoreLockMs > 0) {
      this.bumpUiText(this.scoreText, 1.04, 70);
      return;
    }

    const basePoints = 100;
    const scoreScale = this.turboShiftMs > 0 ? this.turboShiftScoreScale : 1;
    const incomingScale = Math.max(0.4, consumedItem?.scoreScale ?? 1);
    this.score += Math.round(basePoints * this.multiplier * scoreScale * incomingScale);

    if (this.riskyThroughputMs > 0) {
      this.score += this.riskyThroughputBonusPoints;
    }

    const multiplierGain = this.comboFurnaceMs > 0 ? this.comboFurnaceMultiplierGain : 1;
    this.multiplier = Math.min(this.multiplier + multiplierGain, this.maxMultiplier);

    this.refreshScoreUi();
    this.bumpUiText(this.scoreText, 1.06, 85);
    this.bumpUiText(this.multiplierText, 1.22, 105);

    const milestoneTier = Math.floor(this.multiplier / 5);
    if (milestoneTier > this.comboMilestoneTier) {
      this.comboMilestoneTier = milestoneTier;
      this.emitFloatingText(640, 236, `COMBO x${this.multiplier}!`, '#67e8f9', 30);
      this.playImpactFx(0.85, 0x22d3ee);
      this.emitShockRing(640, 360, 0x22d3ee, 3.3, 280);
      this.playSfx('combo-tier', 1 + milestoneTier * 0.1);
      this.rumble(0.3, 0.2, 90 + milestoneTier * 14);
    }
  }

  breakCombo(reason = 'generic') {
    if (reason === 'jam' && this.comboFurnaceMs > 0 && this.comboFurnaceJamPenaltyArmed) {
      this.comboFurnaceJamPenaltyArmed = false;
      this.score = Math.max(0, this.score - this.comboFurnaceJamPenaltyPoints);
      this.refreshScoreUi();
      this.bumpUiText(this.scoreText, 1.12, 95);
    }

    if (this.multiplier <= 1) {
      this.comboMilestoneTier = 0;
      return;
    }

    this.multiplier = 1;
    this.comboMilestoneTier = 0;
    this.refreshScoreUi();
    this.emitFloatingText(182, 58, 'COMBO BREAK', '#fca5a5', 16);
    this.playImpactFx(0.42, 0xfb7185);
    this.playSfx('combo-break', 1);
    this.rumble(0.2, 0.14, 75);

    if (this.multiplierText) {
      this.multiplierText.setColor('#fca5a5');
      this.bumpUiText(this.multiplierText, 1.32, 95);
      this.time.delayedCall(260, () => {
        if (this.multiplierText?.active) {
          this.multiplierText.setColor('#67e8f9');
        }
      });
    }
  }

  update(_time, delta) {
    this.updateHitStop(delta);
    this.updateAudio(delta);

    if (this.isGameOver) {
      this.updateEffectHud();
      this.updateSceneJuice(delta);
      return;
    }

    if (this.isDraftActive) {
      this.updateDraftInput(delta);
      this.updateEffectHud();
      this.updateSceneJuice(delta);
      return;
    }

    const manualScaledDeltaMs = delta * this.simTimeScale;
    const effectiveSimTimeScale = this.getEffectiveSimulationTimeScale();
    const scaledDeltaMs = delta * effectiveSimTimeScale;
    const dt = scaledDeltaMs / 1000;

    this.updateCardEffects(manualScaledDeltaMs);
    this.updateDifficulty();
    this.recoverStaleMotionLocks();

    this.spawnBlockedThisFrame = false;

    this.spawnTimerMs += scaledDeltaMs;
    let spawnSafety = 0;
    while (this.spawnTimerMs >= this.spawnIntervalMs && spawnSafety < 6) {
      spawnSafety += 1;
      const spawned = this.spawnFoodIfSpace();
      if (spawned) {
        this.spawnTimerMs -= this.spawnIntervalMs;
        continue;
      }

      this.spawnBlockedThisFrame = true;
      this.spawnTimerMs = this.spawnIntervalMs;
      break;
    }

    this.updateMainBelt(dt);
    this.runClawTransfers();
    this.updateSideBelts(dt);
    this.updateConveyorVisuals(dt);
    this.syncItemPositions();

    this.checkForGameOver(dt);
    this.updateCardDraftSystem(delta);
    this.updateSceneJuice(delta);
    this.updateEffectHud();
  }

  checkForGameOver(dt) {
    if (dt <= 0 || this.isGameOver) {
      return;
    }

    if (this.isSystemFullyClogged()) {
      this.clogTimerSeconds += dt;
      if (this.clogTimerSeconds >= this.clogGraceSeconds) {
        this.triggerGameOver();
      }
      return;
    }

    this.clogTimerSeconds = 0;
  }

  isSystemFullyClogged() {
    if (!this.spawnBlockedThisFrame) {
      return false;
    }

    const allLaneIntakesBlocked = LANE_LAYOUT.every((laneConfig) => !this.canEnterLane(laneConfig.id));
    if (!allLaneIntakesBlocked) {
      return false;
    }

    const mainIsStuck = this.items.some((item) => item.state === 'stopped-main');

    return mainIsStuck;
  }

  triggerGameOver() {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.closeCardDraft();
    this.setSlowMotion(false);
    this.abortActiveDrag();
    this.playImpactFx(1.35, 0xef4444);
    this.playSfx('game-over', 1.2);
    this.emitShockRing(640, 360, 0xef4444, 3.8, 350);
    this.rumble(0.7, 0.5, 260);

    this.input.enabled = false;

    this.gameOverOverlay = this.add.rectangle(640, 360, 1280, 720, 0x020617, 0.72).setDepth(380);
    this.gameOverText = this.add
      .text(640, 330, `SYSTEM CLOGGED\nSCORE ${this.score}`, {
        fontFamily: 'Segoe UI',
        fontSize: '54px',
        align: 'center',
        color: '#e2e8f0'
      })
      .setOrigin(0.5)
      .setDepth(390)
      .setShadow(0, 4, '#000000', 12);

    this.gameOverText.setAlpha(0);
    this.tweens.add({
      targets: this.gameOverText,
      alpha: 1,
      duration: 240,
      ease: 'Quad.Out'
    });
  }

  createFactoryVisuals() {
    this.mainBeltBody = this.add
      .rectangle(this.mainX, 360, MAIN_BELT_WIDTH, MAIN_BELT_HEIGHT, 0x1e293b, 1)
      .setStrokeStyle(2, 0x475569, 1)
      .setDepth(1);
    this.mainBeltLines = this.add.graphics().setDepth(2);
    this.mainBeltLineConfig = {
      x: this.mainX,
      y: 360,
      width: MAIN_BELT_WIDTH,
      height: MAIN_BELT_HEIGHT,
      orientation: 'vertical',
      spacing: 20,
      margin: 8,
      offset: 0
    };
    drawConveyorLines(this.mainBeltLines, this.mainBeltLineConfig);

    const hasChestSprites = this.textures.exists(CHEST_CLOSED_KEY) && this.textures.exists(CHEST_OPENED_KEY);

    LANE_LAYOUT.forEach((laneConfig) => {
      const laneColor = this.foodTypeById[laneConfig.desiredType].color;
      const intakeX = this.mainX + laneConfig.direction * SIDE_BELT_INTAKE_OFFSET;
      const laneWidth = Math.abs(intakeX - laneConfig.endX);
      const laneCenterX = (intakeX + laneConfig.endX) * 0.5;

      const beltBody = this.add
        .rectangle(laneCenterX, laneConfig.y, laneWidth, SIDE_BELT_HEIGHT, 0x1e293b, 1)
        .setDepth(1)
        .setStrokeStyle(2, 0x475569, 1);
      const beltLines = this.add.graphics().setDepth(2);
      const beltLineConfig = {
        x: laneCenterX,
        y: laneConfig.y,
        width: laneWidth,
        height: SIDE_BELT_HEIGHT,
        orientation: 'horizontal',
        spacing: 22,
        margin: 7,
        offset: 0
      };
      drawConveyorLines(beltLines, beltLineConfig);

      const chestAura = this.add.circle(laneConfig.chestX, laneConfig.y, 54, laneColor, 0.12).setDepth(5).setAlpha(0.04);
      chestAura.setBlendMode(Phaser.BlendModes.ADD);

      let chestSprite = null;
      let chestBaseScale = 1;
      if (hasChestSprites) {
        chestSprite = this.add.image(laneConfig.chestX, laneConfig.y, CHEST_CLOSED_KEY).setDepth(6);
        const chestMaxSize = Math.max(chestSprite.width, chestSprite.height);
        chestBaseScale = chestMaxSize > 0 ? 88 / chestMaxSize : 1;
        chestSprite.setScale(chestBaseScale);
      } else {
        this.add.rectangle(laneConfig.chestX, laneConfig.y, 114, 56, 0x334155, 1).setStrokeStyle(3, laneColor, 1);
      }

      // Add chest inserter claw
      const chestClawX = laneConfig.endX + laneConfig.direction * 18;
      const chestClawContainer = this.add.container(chestClawX, laneConfig.y).setDepth(10);
      // Chest inserter should face the belt (toward the center) at rest.
      const chestClawBaseAngle = laneConfig.direction > 0 ? 0 : 180;
      chestClawContainer.setAngle(chestClawBaseAngle);
      const chestClawBase = this.add.circle(0, 0, CLAW_RADIUS - 4, 0x0f172a, 1).setStrokeStyle(2, laneColor, 1);
      const chestClawGraphics = this.add.graphics();
      chestClawGraphics.lineStyle(4, 0x94a3b8, 1);
      chestClawGraphics.lineBetween(0, 0, -CLAW_ARM_LENGTH, 0);
      chestClawGraphics.lineStyle(4, laneColor, 1);
      chestClawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, -CLAW_JAW_SPREAD);
      chestClawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, CLAW_JAW_SPREAD);
      chestClawContainer.add([chestClawGraphics, chestClawBase]);

      this.add
        .text(laneConfig.chestX, laneConfig.y + 56, laneConfig.label, {
          fontFamily: 'Consolas',
          fontSize: '14px',
          color: '#e2e8f0'
        })
        .setOrigin(0.5)
        .setDepth(8)
        .setShadow(0, 2, '#000000', 8);

      const clawX = this.mainX + laneConfig.direction * CLAW_OFFSET_X;

      const clawBaseAngle = laneConfig.direction > 0 ? 0 : 180;
      const clawContainer = this.add.container(clawX, laneConfig.y).setDepth(9);
      clawContainer.setAngle(clawBaseAngle);

      const clawBase = this.add.circle(0, 0, CLAW_RADIUS - 4, 0x0f172a, 1).setStrokeStyle(2, laneColor, 1);
      const clawGraphics = this.add.graphics();
      clawGraphics.lineStyle(4, 0x94a3b8, 1);
      clawGraphics.lineBetween(0, 0, -CLAW_ARM_LENGTH, 0);
      clawGraphics.lineStyle(4, laneColor, 1);
      clawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, -CLAW_JAW_SPREAD);
      clawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, CLAW_JAW_SPREAD);

      clawContainer.add([clawGraphics, clawBase]);

      this.lanesById[laneConfig.id] = {
        ...laneConfig,
        intakeX,
        length: Math.max(0, laneWidth - CHEST_PICKUP_BUFFER),
        beltBody,
        beltLines,
        beltLineConfig,
        chestAura,
        clawContainer,
        clawBaseAngle,
        clawArmLength: CLAW_ARM_LENGTH,
        chestClawContainer,
        chestClawBaseAngle,
        chestSprite,
        chestBaseScale,
        chestAnimToken: 0
      };
    });
  }

  updateConveyorVisuals(dt) {
    if (dt <= 0) {
      return;
    }

    const jammedByLaneId = LANE_LAYOUT.reduce((acc, lane) => {
      acc[lane.id] = false;
      return acc;
    }, {});
    for (const item of this.items) {
      if (item?.state === 'jammed' && item.laneId && jammedByLaneId[item.laneId] !== undefined) {
        jammedByLaneId[item.laneId] = true;
      }
    }

    if (this.mainBeltLines && this.mainBeltLineConfig) {
      const spacing = this.mainBeltLineConfig.spacing;
      this.mainBeltLineConfig.offset = (this.mainBeltLineConfig.offset + this.mainSpeed * dt) % spacing;
      this.mainBeltLines.clear();
      drawConveyorLines(this.mainBeltLines, this.mainBeltLineConfig);
      this.mainBeltLines.setAlpha(0.74);
    }

    for (const lane of Object.values(this.lanesById)) {
      if (!lane?.beltLines || !lane.beltLineConfig) {
        continue;
      }

      const laneJammed = jammedByLaneId[lane.id] === true;
      const spacing = lane.beltLineConfig.spacing;
      if (!laneJammed) {
        lane.beltLineConfig.offset = (lane.beltLineConfig.offset + this.sideSpeed * dt * lane.direction) % spacing;
      }

      lane.beltLines.clear();
      drawConveyorLines(lane.beltLines, lane.beltLineConfig);
      lane.beltLines.setAlpha(laneJammed ? 0.42 : 0.74);
    }
  }

  updateDifficulty() {
    const steps = this.scoreRampStepPoints > 0 ? Math.floor(this.score / this.scoreRampStepPoints) : 0;

    const targetMainSpeed = this.baseMainSpeed + steps * this.mainSpeedPerStep;
    const targetSideSpeed = this.baseSideSpeed + steps * this.sideSpeedPerStep;
    const targetSpawnIntervalMs = this.baseSpawnIntervalMs - steps * this.spawnIntervalDecreasePerStepMs;

    const clampedMainTarget = Phaser.Math.Clamp(targetMainSpeed, this.baseMainSpeed, this.maxMainSpeed);
    const clampedSideTarget = Phaser.Math.Clamp(targetSideSpeed, this.baseSideSpeed, this.maxSideSpeed);
    const clampedSpawnTarget = Phaser.Math.Clamp(targetSpawnIntervalMs, this.minSpawnIntervalMs, this.baseSpawnIntervalMs);

    if (this.coolantFlushHoldMs > 0) {
      this.mainSpeed = this.baseMainSpeed;
      this.sideSpeed = this.baseSideSpeed;
      this.spawnIntervalMs = this.baseSpawnIntervalMs;

      if (this.riskyThroughputMs > 0) {
        this.spawnIntervalMs = Math.max(120, this.spawnIntervalMs * this.riskyThroughputSpawnScale);
      }
      if (this.predictivePullSpawnsRemaining > 0) {
        this.spawnIntervalMs = Math.max(120, this.spawnIntervalMs * this.predictivePullSpawnTradeoffScale);
      }
      return;
    }

    if (this.coolantFlushRampMs > 0) {
      const rampProgress = Phaser.Math.Clamp(
        1 - this.coolantFlushRampMs / Math.max(1, this.coolantFlushRampDurationMs),
        0,
        1
      );
      this.mainSpeed = Phaser.Math.Linear(this.baseMainSpeed, clampedMainTarget, rampProgress);
      this.sideSpeed = Phaser.Math.Linear(this.baseSideSpeed, clampedSideTarget, rampProgress);
      this.spawnIntervalMs = Phaser.Math.Linear(this.baseSpawnIntervalMs, clampedSpawnTarget, rampProgress);

      if (this.turboShiftMs > 0) {
        this.mainSpeed = Math.min(this.mainSpeed * this.turboShiftSpeedScale, this.maxMainSpeed * 1.35);
        this.sideSpeed = Math.min(this.sideSpeed * this.turboShiftSpeedScale, this.maxSideSpeed * 1.35);
      }
      if (this.beltRephaseMs > 0) {
        this.mainSpeed = Math.min(this.mainSpeed * this.beltRephaseMainSpeedScale, this.maxMainSpeed * 1.45);
      }
      if (this.riskyThroughputMs > 0) {
        this.spawnIntervalMs = Math.max(120, this.spawnIntervalMs * this.riskyThroughputSpawnScale);
      }
      if (this.predictivePullSpawnsRemaining > 0) {
        this.spawnIntervalMs = Math.max(120, this.spawnIntervalMs * this.predictivePullSpawnTradeoffScale);
      }
      return;
    }

    this.mainSpeed = clampedMainTarget;
    this.sideSpeed = clampedSideTarget;
    this.spawnIntervalMs = clampedSpawnTarget;

    if (this.turboShiftMs > 0) {
      this.mainSpeed = Math.min(this.mainSpeed * this.turboShiftSpeedScale, this.maxMainSpeed * 1.35);
      this.sideSpeed = Math.min(this.sideSpeed * this.turboShiftSpeedScale, this.maxSideSpeed * 1.35);
    }
    if (this.beltRephaseMs > 0) {
      this.mainSpeed = Math.min(this.mainSpeed * this.beltRephaseMainSpeedScale, this.maxMainSpeed * 1.45);
    }
    if (this.riskyThroughputMs > 0) {
      this.spawnIntervalMs = Math.max(120, this.spawnIntervalMs * this.riskyThroughputSpawnScale);
    }
    if (this.predictivePullSpawnsRemaining > 0) {
      this.spawnIntervalMs = Math.max(120, this.spawnIntervalMs * this.predictivePullSpawnTradeoffScale);
    }
  }

  spawnFoodIfSpace() {
    const closestToEntry = this.getClosestMainPosToEntry();
    if (closestToEntry !== null && closestToEntry < this.itemSpacing) {
      return false;
    }

    this.spawnFood();
    return true;
  }

  spawnFood() {
    const food = Phaser.Utils.Array.GetRandom(FOOD_TYPES);
    const itemId = this.nextItemId;

    const textureKeys = this.textureKeysByFoodId[food.id] || [];
    let itemVisual;

    if (textureKeys.length > 0) {
      const textureKey = Phaser.Utils.Array.GetRandom(textureKeys);
      itemVisual = this.add.image(0, 0, textureKey);

      const maxDim = Math.max(itemVisual.width, itemVisual.height);
      if (maxDim > 0) {
        itemVisual.setScale(FOOD_RENDER_SIZE / maxDim);
      }
    } else {
      itemVisual = this.add.rectangle(0, 0, FOOD_RENDER_SIZE, FOOD_RENDER_SIZE, food.color, 1).setStrokeStyle(1, 0x0f172a, 1);
    }

    const container = this.add.container(this.mainX, this.mainStartY, [itemVisual]).setDepth(10);
    container.setAlpha(0);
    container.setScale(0.18);
    container.setAngle(Phaser.Math.Between(-12, 12));
    this.tweens.add({
      targets: container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      duration: 195,
      ease: 'Back.Out'
    });
    const grabSize = FOOD_RENDER_SIZE * 1.15;
    const grabHandle = this.add.zone(this.mainX, this.mainStartY, grabSize, grabSize).setDepth(11);
    grabHandle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(grabHandle);
    grabHandle.setData('itemId', itemId);
    grabHandle.input.cursor = 'grab';

    let itemScoreScale = 1;
    if (this.emergencyBrakePenaltySpawnsRemaining > 0) {
      this.emergencyBrakePenaltySpawnsRemaining = Math.max(0, this.emergencyBrakePenaltySpawnsRemaining - 1);
      itemScoreScale = this.emergencyBrakePenaltyScoreScale;
    }

    let predictivePullBoosted = false;
    if (this.predictivePullSpawnsRemaining > 0) {
      this.predictivePullSpawnsRemaining = Math.max(0, this.predictivePullSpawnsRemaining - 1);
      predictivePullBoosted = true;
      if (this.predictivePullSpawnsRemaining <= 0) {
        this.predictivePullSpawnsCap = 0;
      }
    }

    const item = {
      id: itemId,
      type: food.id,
      x: this.mainX,
      y: this.mainStartY,
      mainPos: 0,
      lanePos: 0,
      state: 'main',
      laneId: null,
      motionLock: false,
      scoreScale: itemScoreScale,
      predictivePullBoosted,
      container,
      grabHandle,
      itemVisual,
      baseColor: food.color
    };

    this.items.push(item);
    this.emitSpawnParticles(item);
    this.emitTransferParticles(this.mainX, this.mainStartY, food.color, 6);

    this.nextItemId += 1;
  }

  setupGrabControls() {
    this.input.off('dragstart', this.handleDragStart, this);
    this.input.off('drag', this.handleDrag, this);
    this.input.off('dragend', this.handleDragEnd, this);

    this.input.on('dragstart', this.handleDragStart, this);
    this.input.on('drag', this.handleDrag, this);
    this.input.on('dragend', this.handleDragEnd, this);
  }

  getItemById(itemId) {
    return this.items.find((item) => item.id === itemId) || null;
  }

  isItemMotionTweenActive(item) {
    if (!item) {
      return false;
    }

    if (item.container?.active && this.tweens.isTweening(item.container)) {
      return true;
    }

    if ((item.state === 'side' || item.state === 'jammed') && item.laneId) {
      const lane = this.lanesById[item.laneId];
      if (lane?.clawContainer?.active && this.tweens.isTweening(lane.clawContainer)) {
        return true;
      }
      if (lane?.chestClawContainer?.active && this.tweens.isTweening(lane.chestClawContainer)) {
        return true;
      }
    }

    return false;
  }

  ensureGrabHandleReady(item) {
    if (!item?.grabHandle?.active) {
      return;
    }

    if (!item.grabHandle.input?.enabled) {
      item.grabHandle.setInteractive({ useHandCursor: true });
      this.input.setDraggable(item.grabHandle);
    }

    if (item.grabHandle.input) {
      item.grabHandle.input.cursor = 'grab';
    }
  }

  recoverStaleMotionLocks() {
    const draggedItemId = this.dragContext?.itemId ?? null;

    for (const item of this.items) {
      if (!item?.motionLock) {
        continue;
      }

      if (item.id === draggedItemId || item.state === 'dragging' || item.state === 'consuming') {
        continue;
      }

      if (this.isItemMotionTweenActive(item)) {
        continue;
      }

      item.motionLock = false;
      this.ensureGrabHandleReady(item);
    }
  }

  captureItemSlot(item) {
    return {
      state: item.state,
      laneId: item.laneId,
      mainPos: item.mainPos,
      lanePos: item.lanePos
    };
  }

  applyItemSlot(item, slot) {
    item.state = slot.state;
    item.laneId = slot.laneId ?? null;
    item.mainPos = slot.mainPos ?? 0;
    item.lanePos = slot.lanePos ?? 0;
    item.holdMainPos = null;

    // Manual placement into a jam slot should be re-evaluated by lane logic,
    // otherwise correct foods stay dimmed and never enter the chest.
    if (item.state === 'jammed' && item.laneId) {
      item.state = 'side';
      const lane = this.lanesById[item.laneId];
      if (lane) {
        item.lanePos = Math.min(item.lanePos, lane.length);
      }
    }

    this.refreshItemStateVisual(item);
  }

  getWorldPositionForSlot(slot) {
    if (slot.state === 'main' || slot.state === 'stopped-main') {
      return {
        x: this.mainX,
        y: this.mainStartY + slot.mainPos
      };
    }

    const lane = this.lanesById[slot.laneId];
    if (!lane) {
      return { x: this.mainX, y: this.mainStartY };
    }

    return {
      x: lane.intakeX + lane.direction * slot.lanePos,
      y: lane.y
    };
  }

  findSwapTargetAt(draggedItem, worldX, worldY) {
    const threshold = FOOD_RENDER_SIZE * 0.95;
    let nearest = null;
    let nearestDist = Number.POSITIVE_INFINITY;

    for (const item of this.items) {
      if (item.id === draggedItem.id || item.state === 'consuming') {
        continue;
      }

      const dist = Phaser.Math.Distance.Between(worldX, worldY, item.x, item.y);
      if (dist <= threshold && dist < nearestDist) {
        nearest = item;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  buildLaneDropSlot(item, worldX, worldY) {
    const yTolerance = FOOD_RENDER_SIZE * 0.9;
    const sideSelectTolerance = 10;
    const edgeSlack = FOOD_RENDER_SIZE * 0.45;

    let selectedLane = null;
    let selectedScore = Number.POSITIVE_INFINITY;

    for (const laneConfig of LANE_LAYOUT) {
      const lane = this.lanesById[laneConfig.id];
      const yDist = Math.abs(worldY - lane.y);
      if (yDist > yTolerance) {
        continue;
      }

      if (lane.direction < 0 && worldX > this.mainX + sideSelectTolerance) {
        continue;
      }
      if (lane.direction > 0 && worldX < this.mainX - sideSelectTolerance) {
        continue;
      }

      const projectedPos = lane.direction < 0 ? lane.intakeX - worldX : worldX - lane.intakeX;
      if (projectedPos < -edgeSlack || projectedPos > lane.length + edgeSlack) {
        continue;
      }

      const score = yDist + Math.abs(projectedPos - lane.length * 0.5) * 0.01;
      if (score < selectedScore) {
        selectedScore = score;
        selectedLane = lane;
      }
    }

    if (!selectedLane) {
      return null;
    }

    const desiredPosRaw = selectedLane.direction < 0 ? selectedLane.intakeX - worldX : worldX - selectedLane.intakeX;
    const desiredPos = Phaser.Math.Clamp(desiredPosRaw, 0, selectedLane.length);
    const resolvedPos = this.findNearestAvailableLanePos(selectedLane.id, desiredPos, item.id);

    if (resolvedPos === null) {
      return null;
    }

    return {
      state: 'side',
      laneId: selectedLane.id,
      mainPos: item.mainPos,
      lanePos: resolvedPos
    };
  }

  findNearestAvailableLanePos(laneId, desiredPos, excludedItemId) {
    const lane = this.lanesById[laneId];
    if (!lane) {
      return null;
    }

    const clampedPos = Phaser.Math.Clamp(desiredPos, 0, lane.length);
    if (this.isLanePosFree(laneId, clampedPos, excludedItemId)) {
      return clampedPos;
    }

    const maxOffset = Math.ceil(lane.length);
    for (let offset = 1; offset <= maxOffset; offset += 1) {
      const left = clampedPos - offset;
      if (left >= 0 && this.isLanePosFree(laneId, left, excludedItemId)) {
        return left;
      }

      const right = clampedPos + offset;
      if (right <= lane.length && this.isLanePosFree(laneId, right, excludedItemId)) {
        return right;
      }
    }

    return null;
  }

  isLanePosFree(laneId, lanePos, excludedItemId) {
    const spacing = this.getActiveSideSpacing();

    for (const item of this.items) {
      if (item.id === excludedItemId) {
        continue;
      }

      if (item.state === 'consuming') {
        continue;
      }

      if (item.laneId !== laneId) {
        continue;
      }

      if (item.state !== 'side' && item.state !== 'jammed') {
        continue;
      }

      if (Math.abs(item.lanePos - lanePos) < spacing) {
        return false;
      }
    }

    return true;
  }

  handleDragStart(_pointer, gameObject) {
    if (this.isDraftActive) {
      return;
    }

    if (this.dragContext) {
      return;
    }

    const itemId = gameObject.getData('itemId');
    const item = this.getItemById(itemId);
    if (!item || item.state === 'consuming') {
      return;
    }

    if (item.motionLock && !this.isItemMotionTweenActive(item)) {
      item.motionLock = false;
      this.ensureGrabHandleReady(item);
    }

    if (item.motionLock) {
      return;
    }

    this.dragContext = {
      itemId,
      fromSlot: this.captureItemSlot(item)
    };

    item.state = 'dragging';
    item.motionLock = true;
    this.setSlowMotion(true);
    this.emitTransferParticles(item.x, item.y, item.baseColor, 8);
    this.playGrabSfx(0.9);
    this.rumble(0.16, 0.1, 48);

    gameObject.input.cursor = 'grabbing';
    item.container.setDepth(220);
    item.grabHandle.setDepth(221);
    this.tweens.killTweensOf(item.container);
    item.container.setAngle(0);
    this.tweens.add({
      targets: item.container,
      scaleX: 1.22,
      scaleY: 1.22,
      duration: 110,
      ease: 'Cubic.Out'
    });

    const wiggleAmount = Phaser.Math.Between(7, 11);
    this.tweens.add({
      targets: item.container,
      angle: { from: -wiggleAmount, to: wiggleAmount },
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  handleDrag(_pointer, gameObject, dragX, dragY) {
    if (!this.dragContext || this.dragContext.itemId !== gameObject.getData('itemId')) {
      return;
    }

    const item = this.getItemById(this.dragContext.itemId);
    if (!item) {
      return;
    }

    item.x = dragX;
    item.y = dragY;
    item.container.setPosition(dragX, dragY);
    item.grabHandle.setPosition(dragX, dragY);
  }

  handleDragEnd(pointer, gameObject) {
    if (!this.dragContext || this.dragContext.itemId !== gameObject.getData('itemId')) {
      return;
    }

    const draggedItem = this.getItemById(this.dragContext.itemId);
    if (!draggedItem) {
      this.finishDragResolution();
      return;
    }

    const dropX = pointer.worldX ?? pointer.x;
    const dropY = pointer.worldY ?? pointer.y;
    const swapTarget = this.findSwapTargetAt(draggedItem, dropX, dropY);

    if (swapTarget) {
      this.animateSwapWithTarget(draggedItem, swapTarget, this.dragContext.fromSlot);
      return;
    }

    const laneDropSlot = this.buildLaneDropSlot(draggedItem, dropX, dropY);
    if (laneDropSlot) {
      this.animateReturnToSlot(draggedItem, laneDropSlot);
      return;
    }

    this.animateReturnToSlot(draggedItem, this.dragContext.fromSlot);
  }

  animateReturnToSlot(item, slot) {
    item.motionLock = true;
    this.applyItemSlot(item, slot);
    const destination = this.getWorldPositionForSlot(slot);

    this.tweens.killTweensOf(item.container);
    this.tweens.add({
      targets: item.container,
      x: destination.x,
      y: destination.y,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 185,
      ease: 'Back.Out',
      onUpdate: () => {
        item.x = item.container.x;
        item.y = item.container.y;
        item.grabHandle.setPosition(item.x, item.y);
      },
      onComplete: () => {
        item.motionLock = false;
        item.x = destination.x;
        item.y = destination.y;
        item.container.setPosition(destination.x, destination.y);
        item.container.setAngle(0);
        item.grabHandle.setPosition(destination.x, destination.y);
        item.container.setDepth(10);
        item.grabHandle.setDepth(11);
        this.finishDragResolution();
      }
    });
  }

  animateSwapWithTarget(draggedItem, targetItem, draggedOriginSlot) {
    const targetSlot = this.captureItemSlot(targetItem);

    draggedItem.motionLock = true;
    targetItem.motionLock = true;

    this.applyItemSlot(draggedItem, targetSlot);
    this.applyItemSlot(targetItem, draggedOriginSlot);

    const draggedDestination = this.getWorldPositionForSlot(targetSlot);
    const targetDestination = this.getWorldPositionForSlot(draggedOriginSlot);

    targetItem.container.setDepth(180);
    targetItem.grabHandle.setDepth(181);

    let completedTweens = 0;
    const onTweenComplete = () => {
      completedTweens += 1;
      if (completedTweens < 2) {
        return;
      }

      draggedItem.motionLock = false;
      targetItem.motionLock = false;
      draggedItem.container.setDepth(10);
      draggedItem.grabHandle.setDepth(11);
      targetItem.container.setDepth(10);
      targetItem.grabHandle.setDepth(11);
      this.emitTransferParticles(draggedDestination.x, draggedDestination.y, draggedItem.baseColor, 10);
      this.emitTransferParticles(targetDestination.x, targetDestination.y, targetItem.baseColor, 10);
      this.playImpactFx(0.34, 0x93c5fd);
      this.playSfx('swap', 1);
      this.rumble(0.18, 0.14, 62);
      this.finishDragResolution();
    };

    this.tweens.killTweensOf(draggedItem.container);
    this.tweens.add({
      targets: draggedItem.container,
      x: draggedDestination.x,
      y: draggedDestination.y,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 190,
      ease: 'Cubic.Out',
      onUpdate: () => {
        draggedItem.x = draggedItem.container.x;
        draggedItem.y = draggedItem.container.y;
        draggedItem.grabHandle.setPosition(draggedItem.x, draggedItem.y);
      },
      onComplete: () => {
        draggedItem.x = draggedDestination.x;
        draggedItem.y = draggedDestination.y;
        draggedItem.grabHandle.setPosition(draggedDestination.x, draggedDestination.y);
        onTweenComplete();
      }
    });

    this.tweens.killTweensOf(targetItem.container);
    this.tweens.add({
      targets: targetItem.container,
      x: targetDestination.x,
      y: targetDestination.y,
      angle: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 95,
      yoyo: true,
      ease: 'Sine.Out',
      onUpdate: () => {
        targetItem.x = targetItem.container.x;
        targetItem.y = targetItem.container.y;
        targetItem.grabHandle.setPosition(targetItem.x, targetItem.y);
      },
      onComplete: () => {
        targetItem.x = targetDestination.x;
        targetItem.y = targetDestination.y;
        targetItem.grabHandle.setPosition(targetDestination.x, targetDestination.y);
        onTweenComplete();
      }
    });
  }

  finishDragResolution() {
    if (!this.dragContext) {
      this.setSlowMotion(false);
      return;
    }

    const draggedItem = this.getItemById(this.dragContext.itemId);
    if (draggedItem?.grabHandle?.input) {
      draggedItem.grabHandle.input.cursor = 'grab';
      draggedItem.container.setScale(1);
      draggedItem.container.setAngle(0);
      draggedItem.container.setDepth(10);
      draggedItem.grabHandle.setDepth(11);
    }

    if (draggedItem) {
      draggedItem.motionLock = false;
    }

    this.dragContext = null;
    this.setSlowMotion(false);
  }

  setSlowMotion(shouldSlow) {
    if (shouldSlow && this.fragileJackpotNoSlowMoMs > 0) {
      this.simTimeScale = 1;
      return;
    }

    this.simTimeScale = shouldSlow ? this.dragSlowMoScale : 1;
  }

  getEffectiveSimulationTimeScale() {
    const brakeScale = this.emergencyBrakeMs > 0 ? this.emergencyBrakeTimeScale : 1;
    const hitStopScale = this.hitStopMs > 0 ? this.hitStopScale : 1;
    return this.simTimeScale * brakeScale * hitStopScale;
  }

  refreshItemStateVisual(item) {
    if (item.state === 'jammed') {
      this.applyItemStateTint(item, 0x64748b);
      return;
    }

    if (item.state === 'stopped-main') {
      this.applyItemStateTint(item, 0x94a3b8);
      return;
    }

    this.clearItemTint(item);
  }

  getClosestMainPosToEntry() {
    const mainItems = this.items.filter((item) => item.state === 'main' || item.state === 'stopped-main');

    if (mainItems.length === 0) {
      return null;
    }

    return Math.min(...mainItems.map((item) => item.mainPos));
  }

  updateMainBelt(dt) {
    const mainItems = this.items
      .filter((item) => item.state === 'main' || item.state === 'stopped-main')
      .sort((a, b) => b.mainPos - a.mainPos);

    let frontPos = null;
    for (const item of mainItems) {
      const maxAllowedPos = frontPos === null ? this.mainLength : Math.max(0, frontPos - this.itemSpacing);

      if (item.state === 'main') {
        if (item.motionLock) {
          item.mainPos = Math.min(item.mainPos, maxAllowedPos);
        } else {
          item.mainPos = Math.min(item.mainPos + this.mainSpeed * dt, maxAllowedPos);
        }
      } else {
        item.mainPos = Math.min(item.mainPos, maxAllowedPos);
      }

      if (item.mainPos >= this.mainLength) {
        item.mainPos = this.mainLength;
        if (item.state !== 'stopped-main') {
          item.state = 'stopped-main';
          this.applyItemStateTint(item, 0x94a3b8);
        }
      }

      frontPos = item.mainPos;
    }
  }

  runClawTransfers() {
    const movingMainItems = this.items.filter((item) => item.state === 'main' && !item.motionLock);
    if (movingMainItems.length === 0) {
      return;
    }

    const laneIds = LANE_LAYOUT.map((laneConfig) => laneConfig.id);
    const laneFillCount = laneIds.reduce((acc, laneId) => {
      acc[laneId] = 0;
      return acc;
    }, {});

    for (const item of this.items) {
      if (!item.laneId || laneFillCount[item.laneId] === undefined) {
        continue;
      }
      if (item.state !== 'side' && item.state !== 'jammed') {
        continue;
      }

      laneFillCount[item.laneId] += 1;
    }

    const pickBalancedLane = (candidateLaneIds, preferredType = null, preferredBiasWeight = 0, forcePreferred = false) => {
      const chooseByFill = (laneIds) => {
        let minScore = Number.POSITIVE_INFINITY;
        const best = [];

        for (const laneId of laneIds) {
          if (!this.canEnterLane(laneId)) {
            continue;
          }

          const fill = laneFillCount[laneId] ?? 0;
          const preferredPenalty = preferredType && this.lanesById[laneId]?.desiredType === preferredType ? preferredBiasWeight : 0;
          const weightedScore = fill - preferredPenalty;

          if (weightedScore < minScore) {
            minScore = weightedScore;
            best.length = 0;
            best.push(laneId);
            continue;
          }

          if (weightedScore === minScore) {
            best.push(laneId);
          }
        }

        if (best.length === 0) {
          return null;
        }

        return Phaser.Utils.Array.GetRandom(best);
      };

      const calibrationActive = this.inserterCalibrationMs > 0;
      if ((calibrationActive || forcePreferred) && preferredType) {
        const preferredLanes = candidateLaneIds.filter((laneId) => this.lanesById[laneId]?.desiredType === preferredType);
        const preferredPick = chooseByFill(preferredLanes);
        if (preferredPick) {
          return preferredPick;
        }
      }

      return chooseByFill(candidateLaneIds);
    };

    const reachEpsilon = 0.001;
    const rowWindow = this.itemSpacing * 2.5;

    const findCandidateNearRow = (rowPos, nextRowPos = null) => {
      const maxPos = rowPos + rowWindow;
      let candidate = null;
      let bestMainPos = Number.POSITIVE_INFINITY;

      for (const item of movingMainItems) {
        if (item.mainPos + reachEpsilon < rowPos) {
          continue;
        }
        if (item.mainPos > maxPos) {
          continue;
        }
        if (typeof nextRowPos === 'number' && item.mainPos >= nextRowPos) {
          continue;
        }
        if (item.mainPos < bestMainPos) {
          candidate = item;
          bestMainPos = item.mainPos;
        }
      }

      return candidate;
    };

    // Row 0: pick the emptiest *enterable* side belt across ALL 4 lanes.
    // If the emptiest is a bottom lane, the item continues straight to row 1.
    if (CLAW_ROWS.length >= 1) {
      const row = CLAW_ROWS[0];
      const rowPos = row.y - this.mainStartY;
      const nextRowPos = CLAW_ROWS.length >= 2 ? CLAW_ROWS[1].y - this.mainStartY : this.mainLength;

      const candidate = findCandidateNearRow(rowPos, nextRowPos);

      if (candidate) {
        const routeAssistActive = this.inserterCalibrationMs > 0 || candidate.predictivePullBoosted;
        const predictiveBias = candidate.predictivePullBoosted ? this.predictivePullBiasWeight : 0;
        const bestOverall = pickBalancedLane(laneIds, candidate.type, predictiveBias, routeAssistActive);
        if (bestOverall === row.leftLaneId || bestOverall === row.rightLaneId) {
          candidate.mainPos = Math.min(candidate.mainPos, rowPos);
          this.transferToLane(candidate, bestOverall);
        }
      }
    }

    // Row 1: pick the emptiest *enterable* bottom belt.
    if (CLAW_ROWS.length >= 2) {
      const row = CLAW_ROWS[1];
      const rowPos = row.y - this.mainStartY;

      const candidate = findCandidateNearRow(rowPos);

      if (candidate) {
        const routeAssistActive = this.inserterCalibrationMs > 0 || candidate.predictivePullBoosted;
        const predictiveBias = candidate.predictivePullBoosted ? this.predictivePullBiasWeight : 0;
        const bestBottom = pickBalancedLane([row.leftLaneId, row.rightLaneId], candidate.type, predictiveBias, routeAssistActive);
        if (bestBottom) {
          candidate.mainPos = Math.min(candidate.mainPos, rowPos);
          this.transferToLane(candidate, bestBottom);
        }
      }
    }
  }

  canEnterLane(laneId) {
    const laneItems = this.items.filter(
      (item) => item.laneId === laneId && (item.state === 'side' || item.state === 'jammed')
    );

    if (laneItems.length === 0) {
      return true;
    }

    const closestToIntake = Math.min(...laneItems.map((item) => item.lanePos));
    return closestToIntake >= this.getActiveSideSpacing();
  }

  transferToLane(item, laneId) {
    const lane = this.lanesById[laneId];

    const startX = this.mainX;
    const startY = this.mainStartY + item.mainPos;
    const destinationX = lane.intakeX;
    const destinationY = lane.y;

    item.state = 'side';
    item.laneId = laneId;
    item.lanePos = 0;
    this.clearItemTint(item);

    item.motionLock = true;
    item.x = startX;
    item.y = startY;
    item.container.setPosition(startX, startY);
    item.grabHandle.setPosition(startX, startY);

    this.tweens.killTweensOf(item.container);
    this.pulseLaneVisual(laneId, 0.45);
    this.emitTransferParticles(startX, startY, item.baseColor, 7);

    const claw = lane.clawContainer;
    if (!claw) {
      const fallbackTween = this.tweens.add({
        targets: item.container,
        x: destinationX,
        y: destinationY,
        angle: lane.direction * 10,
        duration: 140,
        ease: 'Sine.Out',
        onUpdate: () => {
          item.x = item.container.x;
          item.y = item.container.y;
          item.grabHandle.setPosition(item.x, item.y);
        },
        onComplete: () => {
          item.motionLock = false;
          item.container.setAngle(0);
          item.container.setScale(1);
          item.x = destinationX;
          item.y = destinationY;
          item.container.setPosition(destinationX, destinationY);
          item.grabHandle.setPosition(destinationX, destinationY);
          this.pulseLaneVisual(laneId, 0.6);
          this.emitTransferParticles(destinationX, destinationY, item.baseColor, 12);
        }
      });
      fallbackTween.timeScale = this.getEffectiveSimulationTimeScale();
      return;
    }

    const baseAngle = typeof lane.clawBaseAngle === 'number' ? lane.clawBaseAngle : lane.direction > 0 ? 0 : 180;
    const targetAngle = baseAngle + lane.direction * 180;
    const armLength = typeof lane.clawArmLength === 'number' ? lane.clawArmLength : CLAW_ARM_LENGTH;

    const speedFactorRaw = this.baseMainSpeed > 0 ? this.mainSpeed / this.baseMainSpeed : 1;
    const speedFactor = Phaser.Math.Clamp(speedFactorRaw, 0.75, 3.25);

    const pickDuration = Phaser.Math.Clamp(70 / speedFactor, 28, 70);
    const rotateDuration = Phaser.Math.Clamp(210 / speedFactor, 80, 210);
    const dropDuration = Phaser.Math.Clamp(80 / speedFactor, 28, 80);
    const returnDuration = Phaser.Math.Clamp(180 / speedFactor, 70, 180);
    const anticipationDuration = Phaser.Math.Clamp(64 / speedFactor, 24, 64);
    const anticipationAngle = baseAngle - lane.direction * 12;

    const holdLength = armLength + CLAW_JAW_LENGTH * 0.75;

    const getHandWorldAtAngle = (angleDeg) => {
      const theta = Phaser.Math.DegToRad(angleDeg);
      return {
        x: claw.x + Math.cos(theta) * -holdLength,
        y: claw.y + Math.sin(theta) * -holdLength
      };
    };

    const syncToContainer = () => {
      item.x = item.container.x;
      item.y = item.container.y;
      item.grabHandle.setPosition(item.x, item.y);
    };

    const placeAtHand = () => {
      const hand = getHandWorldAtAngle(claw.angle);
      item.x = hand.x;
      item.y = hand.y;
      item.container.setPosition(hand.x, hand.y);
      item.grabHandle.setPosition(hand.x, hand.y);
    };

    this.tweens.killTweensOf(claw);
    claw.setAngle(baseAngle);

    const startPickup = () => {
      this.playClawSqueakSfx('pickup', 0.9);
      const handStart = getHandWorldAtAngle(baseAngle);

      const pickTween = this.tweens.add({
        targets: item.container,
        x: handStart.x,
        y: handStart.y,
        duration: pickDuration,
        ease: 'Sine.Out',
        onUpdate: syncToContainer,
        onComplete: () => {
          this.playClawSqueakSfx('move', 0.98);
          const rotateTween = this.tweens.add({
            targets: claw,
            angle: targetAngle,
            duration: rotateDuration,
            ease: 'Sine.InOut',
            onUpdate: placeAtHand,
            onComplete: () => {
              this.playClawSqueakSfx('drop', 0.92);
              const dropTween = this.tweens.add({
                targets: item.container,
                x: destinationX,
                y: destinationY,
                angle: lane.direction * 8,
                duration: dropDuration,
                ease: 'Sine.Out',
                onUpdate: syncToContainer,
                onComplete: () => {
                  item.motionLock = false;
                  item.container.setAngle(0);
                  item.container.setScale(1);
                  item.x = destinationX;
                  item.y = destinationY;
                  item.container.setPosition(destinationX, destinationY);
                  item.grabHandle.setPosition(destinationX, destinationY);
                  this.pulseLaneVisual(laneId, 0.6);
                  this.emitTransferParticles(destinationX, destinationY, item.baseColor, 12);

                  const resetTween = this.tweens.add({
                    targets: claw,
                    angle: baseAngle,
                    duration: returnDuration,
                    ease: 'Sine.InOut'
                  });
                  resetTween.timeScale = this.getEffectiveSimulationTimeScale();
                }
              });
              dropTween.timeScale = this.getEffectiveSimulationTimeScale();
            }
          });
          rotateTween.timeScale = this.getEffectiveSimulationTimeScale();
        }
      });
      pickTween.timeScale = this.getEffectiveSimulationTimeScale();
    };

    const anticipationTween = this.tweens.add({
      targets: claw,
      angle: anticipationAngle,
      duration: anticipationDuration,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: startPickup
    });
    anticipationTween.timeScale = this.getEffectiveSimulationTimeScale();

    const squeezeTween = this.tweens.add({
      targets: item.container,
      scaleX: 0.92,
      scaleY: 0.92,
      duration: anticipationDuration,
      yoyo: true,
      ease: 'Sine.InOut'
    });
    squeezeTween.timeScale = this.getEffectiveSimulationTimeScale();
  }

  animateLaneItemIntoChest(item, lane, awardScore = true) {
    if (!item || !lane || item.motionLock || item.state === 'consuming') {
      return false;
    }

    const finalizeAccept = () => {
      this.acceptedCount += 1;
      if (awardScore) {
        this.handleComboConsume(item);
      }

      this.playSfx('chest-accept', awardScore ? 1 : 0.8);
      this.rumble(awardScore ? 0.22 : 0.16, awardScore ? 0.18 : 0.12, awardScore ? 70 : 48);

      this.pulseLaneVisual(lane.id, awardScore ? 0.95 : 0.7, !awardScore);
      if (awardScore && this.multiplier >= 3) {
        this.emitFloatingText(lane.chestX, lane.y - 34, `CHAIN x${this.multiplier}`, '#34d399', 16);
        this.emitShockRing(lane.chestX, lane.y, 0x34d399, 1.9, 190);
      }
      if (!awardScore) {
        this.emitFloatingText(lane.chestX, lane.y - 34, 'SAVED', '#fbbf24', 16);
      }

      this.startChestIntake(item, lane);
    };

    if (!lane.chestClawContainer) {
      item.motionLock = true;
      finalizeAccept();
      return true;
    }

    item.motionLock = true;
    const claw = lane.chestClawContainer;
    const baseAngle = typeof lane.chestClawBaseAngle === 'number' ? lane.chestClawBaseAngle : lane.direction > 0 ? 0 : 180;
    const targetAngle = baseAngle + lane.direction * 180;
    const armLength = typeof lane.clawArmLength === 'number' ? lane.clawArmLength : CLAW_ARM_LENGTH;

    const speedFactorRaw = this.baseSideSpeed > 0 ? this.sideSpeed / this.baseSideSpeed : 1;
    const speedFactor = Phaser.Math.Clamp(speedFactorRaw, 0.75, 3.25);
    const pickDuration = Phaser.Math.Clamp(70 / speedFactor, 28, 70);
    const rotateDuration = Phaser.Math.Clamp(210 / speedFactor, 80, 210);
    const returnDuration = Phaser.Math.Clamp(180 / speedFactor, 70, 180);
    const anticipationDuration = Phaser.Math.Clamp(58 / speedFactor, 22, 58);
    const anticipationAngle = baseAngle - lane.direction * 11;

    const holdLength = armLength + CLAW_JAW_LENGTH * 0.75;

    const getHandWorldAtAngle = (angleDeg) => {
      const theta = Phaser.Math.DegToRad(angleDeg);
      return {
        x: claw.x + Math.cos(theta) * -holdLength,
        y: claw.y + Math.sin(theta) * -holdLength
      };
    };

    const syncToContainer = () => {
      item.x = item.container.x;
      item.y = item.container.y;
      item.grabHandle.setPosition(item.x, item.y);
    };

    const placeAtHand = () => {
      const hand = getHandWorldAtAngle(claw.angle);
      item.x = hand.x;
      item.y = hand.y;
      item.container.setPosition(hand.x, hand.y);
      item.grabHandle.setPosition(hand.x, hand.y);
    };

    this.tweens.killTweensOf(claw);
    claw.setAngle(baseAngle);

    const startPickup = () => {
      this.playClawSqueakSfx('pickup', 0.78);
      const handStart = getHandWorldAtAngle(baseAngle);

      const pickTween = this.tweens.add({
        targets: item.container,
        x: handStart.x,
        y: handStart.y,
        duration: pickDuration,
        ease: 'Sine.Out',
        onUpdate: syncToContainer,
        onComplete: () => {
          this.playClawSqueakSfx('move', 0.84);
          const rotateTween = this.tweens.add({
            targets: claw,
            angle: targetAngle,
            duration: rotateDuration,
            ease: 'Sine.InOut',
            onUpdate: placeAtHand,
            onComplete: () => {
              this.playClawSqueakSfx('drop', 0.8);
              finalizeAccept();
              const resetTween = this.tweens.add({
                targets: claw,
                angle: baseAngle,
                duration: returnDuration,
                ease: 'Sine.InOut'
              });
              resetTween.timeScale = this.getEffectiveSimulationTimeScale();
            }
          });
          rotateTween.timeScale = this.getEffectiveSimulationTimeScale();
        }
      });
      pickTween.timeScale = this.getEffectiveSimulationTimeScale();
    };

    const anticipationTween = this.tweens.add({
      targets: claw,
      angle: anticipationAngle,
      duration: anticipationDuration,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: startPickup
    });
    anticipationTween.timeScale = this.getEffectiveSimulationTimeScale();

    const squeezeTween = this.tweens.add({
      targets: item.container,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: anticipationDuration,
      yoyo: true,
      ease: 'Sine.InOut'
    });
    squeezeTween.timeScale = this.getEffectiveSimulationTimeScale();

    return true;
  }

  updateSideBelts(dt) {
    const sideSpacing = this.getActiveSideSpacing();
    const chestPriorityActive = this.chestPriorityMs > 0;

    for (const laneConfig of LANE_LAYOUT) {
      const lane = this.lanesById[laneConfig.id];
      const laneItems = this.items
        .filter((item) => item.laneId === lane.id && (item.state === 'side' || item.state === 'jammed'))
        .sort((a, b) => b.lanePos - a.lanePos);

      let frontPos = null;
      for (const item of laneItems) {
        const maxAllowedPos = frontPos === null ? lane.length : Math.max(0, frontPos - sideSpacing);

        if (item.state === 'jammed') {
          item.lanePos = Math.min(item.lanePos, maxAllowedPos);

          if (chestPriorityActive && !item.motionLock) {
            item.lanePos = lane.length;
            this.animateLaneItemIntoChest(item, lane, false);
          }

          frontPos = item.lanePos;
          continue;
        }

        if (item.state === 'side') {
          if (item.motionLock) {
            item.lanePos = Math.min(item.lanePos, maxAllowedPos);
            frontPos = item.lanePos;
            continue;
          }

          item.lanePos = Math.min(item.lanePos + this.sideSpeed * dt, maxAllowedPos);

          if (item.lanePos >= lane.length) {
            item.lanePos = lane.length;

            const isCorrectLane = item.type === lane.desiredType;
            const shouldGraceAccept = !isCorrectLane && chestPriorityActive;

            if (isCorrectLane || shouldGraceAccept) {
              if (shouldGraceAccept) {
                this.consumeChestPriorityCharge(lane.id);
              }

              this.animateLaneItemIntoChest(item, lane, isCorrectLane);
            } else {
              item.state = 'jammed';
              this.rejectedCount += 1;
              this.breakCombo('jam');
              this.applyItemStateTint(item, 0x64748b);
              this.emitJamParticles(item);
              this.pulseLaneVisual(lane.id, 1.05, true);
              this.playImpactFx(0.82, 0xef4444);
              this.emitFloatingText(item.x, item.y - 24, 'JAM!', '#fb7185', 20);
              this.emitShockRing(item.x, item.y, 0xef4444, 2.8, 280);
              this.playSfx('jam', 1.2);
              this.rumble(0.42, 0.28, 130);

              this.tweens.killTweensOf(item.container);
              item.container.setAngle(0);
              this.tweens.add({
                targets: item.container,
                angle: { from: -12, to: 12 },
                duration: 70,
                yoyo: true,
                repeat: 4,
                ease: 'Sine.InOut',
                onComplete: () => {
                  if (item.container?.active) {
                    item.container.setAngle(0);
                  }
                }
              });
            }
          }
        } else {
          item.lanePos = Math.min(item.lanePos, maxAllowedPos);
        }

        frontPos = item.lanePos;
      }
    }
  }

  startChestIntake(item, lane) {
    item.state = 'consuming';
    this.clearItemTint(item);
    item.container.setAlpha(1);
    item.container.setScale(1);
    if (item.grabHandle?.input) {
      item.grabHandle.disableInteractive();
    }

    this.playChestReceiveAnimation(lane);
    this.emitChestConsumeParticles(item, lane);
    this.emitTransferParticles(lane.chestX, lane.y, item.baseColor, 14);

    this.tweens.add({
      targets: item.container,
      x: lane.chestX,
      y: lane.y,
      alpha: 0.08,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 180,
      ease: 'Sine.In',
      onComplete: () => {
        this.removeItemById(item.id);
      }
    });
  }

  playChestReceiveAnimation(lane) {
    this.pulseLaneVisual(lane.id, 0.82);

    if (!lane.chestSprite || !this.textures.exists(CHEST_CLOSED_KEY) || !this.textures.exists(CHEST_OPENED_KEY)) {
      return;
    }

    lane.chestAnimToken += 1;
    const activeToken = lane.chestAnimToken;

    this.tweens.killTweensOf(lane.chestSprite);
    lane.chestSprite.setTexture(CHEST_OPENED_KEY);
    lane.chestSprite.setScale(lane.chestBaseScale * 0.94);

    this.tweens.add({
      targets: lane.chestSprite,
      scaleX: lane.chestBaseScale * 1.08,
      scaleY: lane.chestBaseScale * 1.08,
      duration: 90,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        if (lane.chestAnimToken !== activeToken) {
          return;
        }

        lane.chestSprite.setTexture(CHEST_CLOSED_KEY);
        lane.chestSprite.setScale(lane.chestBaseScale);
      }
    });
  }

  removeItemById(itemId) {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return;
    }

    const [item] = this.items.splice(index, 1);
    if (item.container && item.container.active) {
      item.container.destroy();
    }
    if (item.grabHandle && item.grabHandle.active) {
      item.grabHandle.destroy();
    }
  }

  syncItemPositions() {
    for (const item of this.items) {
      if (item.state === 'dragging' || item.state === 'consuming' || item.motionLock) {
        continue;
      }

      if (item.state === 'main' || item.state === 'stopped-main') {
        item.x = this.mainX;
        item.y = this.mainStartY + item.mainPos;
      } else {
        const lane = this.lanesById[item.laneId];
        item.x = lane.intakeX + lane.direction * item.lanePos;
        item.y = lane.y;
      }

      if (item.container.active) {
        item.container.setPosition(item.x, item.y);
      }
      if (item.grabHandle?.active) {
        item.grabHandle.setPosition(item.x, item.y);
      }
    }
  }

  clearItemTint(item) {
    if (!item.itemVisual) {
      return;
    }

    if (typeof item.itemVisual.clearTint === 'function') {
      item.itemVisual.clearTint();
      return;
    }

    if (typeof item.itemVisual.setTint === 'function') {
      item.itemVisual.setTint(0xffffff);
      return;
    }

    if (typeof item.itemVisual.setFillStyle === 'function') {
      item.itemVisual.setFillStyle(item.baseColor, 1);
    }
  }

  applyItemStateTint(item, tint) {
    if (!item.itemVisual) {
      return;
    }

    if (typeof item.itemVisual.setTint === 'function') {
      item.itemVisual.setTint(tint);
      return;
    }

    if (typeof item.itemVisual.setFillStyle === 'function') {
      item.itemVisual.setFillStyle(tint, 1);
    }
  }

  
}
