import Phaser from 'phaser';
import { DEBUG_LEVEL_ID, DEFAULT_LEVEL_ID, getLevelById, getNextCampaignLevelId } from '../data/levels';
import { markCampaignLevelCompleted } from '../data/campaignProgress';
import assemblyLineShuffleUrl from '../../assets/audio/music/The_Assembly_Line_Shuffle.mp3';
import bannersOverPeakUrl from '../../assets/audio/music/Banners_Over_the_Peak.mp3';
import ratioedInTheLobbyUrl from '../../assets/audio/music/Ratioed_In_The_Lobby.mp3';

const MAX_GAMEPLAY_SPRITES_PER_TYPE = 24;
const FOOD_RENDER_SIZE = 54;
const FOOD_SPACING_PADDING = 12;
const JAM_BEETLE_RENDER_SIZE = 58;
const JAM_BEETLE_TYPE_ID = 'jam_beetle';
const JAM_BEETLE_COLOR = 0xfb7185;
const JAM_BEETLE_ANIM_KEY = 'jam_beetle_walk';
const JAM_BEETLE_TAPS_TO_SPLAT = 3;
const JAM_BEETLE_SPAWN_SCALE = 0.62;
const JAM_BEETLE_TAP_MAX_MOVEMENT = 12;
const JAM_BEETLE_GRAB_MIN_MOVEMENT = 20;
const JAM_BEETLE_FLICK_MIN_DISTANCE = 26;
const JAM_BEETLE_FLICK_MIN_SPEED = 540;
const JAM_BEETLE_TOSS_MIN_SPEED = 180;
const JAM_BEETLE_TOSS_MAX_SPEED = 420;
const JAM_BEETLE_TOSS_TOTAL_DURATION_MS = 750;

const DRONE_SABOTAGE_MIN_COOLDOWN_MS = 9500;
const DRONE_SABOTAGE_MAX_COOLDOWN_MS = 15500;
const DRONE_SABOTAGE_RETRY_MIN_MS = 1400;
const DRONE_SABOTAGE_RETRY_MAX_MS = 3000;
const DRONE_WARNING_DURATION_MS = 1000;
const DRONE_FLIGHT_SPEED_PX_PER_SEC = 460;
const DRONE_FLIGHT_MIN_DURATION_MS = 420;
const DRONE_FLIGHT_MAX_DURATION_MS = 1960;
const DRONE_PICKUP_HOLD_MS = 120;
const DRONE_DROP_HOLD_MS = 95;
const DRONE_CARRY_OFFSET_Y = 20;

const MAIN_BELT_WIDTH = 74;
const MAIN_BELT_HEIGHT = 560;
const SIDE_BELT_HEIGHT = 34;

const CLAW_OFFSET_X = 44;
const CLAW_RADIUS = 14;
const CLAW_CLEARANCE = 3;
const SIDE_BELT_INTAKE_OFFSET = CLAW_OFFSET_X + CLAW_RADIUS + CLAW_CLEARANCE;

const CLAW_ARM_LENGTH = 26;
const CLAW_JAW_LENGTH = 14;
const CLAW_JAW_SPREAD = 12;

const CHEST_PICKUP_BUFFER = 22;
const STANDARD_CHEST_OFFSET_X = 80;
const CHEST_BUBBLE_SWAP_INTERVAL_MS = 900;
const CHEST_BUBBLE_ICON_SIZE = 32;
const SPACING_RULE_LEVEL_START = 6;
const SPACING_RULE_LEVEL_END = 12;

const GLOBAL_FLOW_SPEED_SCALE = 0.78;
const GLOBAL_SPAWN_INTERVAL_SCALE = 1.38;
const GLOBAL_SCORE_RAMP_STEP_SCALE = 1.28;
const GLOBAL_SPEED_RAMP_SCALE = 0.78;
const GLOBAL_SPAWN_RAMP_SCALE = 0.8;
const CLAW_TIMING_SCALE = 1.2;

const BELT_LINE_COLOR = 0x0f172a;
const BELT_LINE_ALPHA = 0.38;

const GAME_DISPLAY_FONT = "'Lilita One', 'Bebas Neue', 'Segoe UI', sans-serif";
const GAME_UI_FONT = "'Nunito', 'Rajdhani', 'Segoe UI', sans-serif";

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

const JAM_BEETLE_SPRITE_GLOB = import.meta.glob('../../assets/sprites/Beetle_*.png', { eager: true, import: 'default' });

const CHEST_SPRITE_GLOB = import.meta.glob('../../assets/sprites/chest/*.png', { eager: true, import: 'default' });
const CHEST_CLOSED_KEY = 'chest_closed';
const CHEST_OPENED_KEY = 'chest_opened';

function findFirstMatchUrl(spriteGlob, matcher) {
  const match = Object.entries(spriteGlob).find(([path]) => matcher.test(path));
  return match ? match[1] : null;
}

const CHEST_CLOSED_URL = findFirstMatchUrl(CHEST_SPRITE_GLOB, /closed\.png$/i);
const CHEST_OPENED_URL = findFirstMatchUrl(CHEST_SPRITE_GLOB, /opened\.png$/i);
const JAM_BEETLE_SPRITE_URLS = collectSpriteUrls(JAM_BEETLE_SPRITE_GLOB, Number.POSITIVE_INFINITY);

function collectSpriteUrls(spriteGlob, maxCount = MAX_GAMEPLAY_SPRITES_PER_TYPE) {
  return Object.entries(spriteGlob)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .slice(0, maxCount)
    .map(([, url]) => url);
}

const CHEST_BUBBLE_SPRITE_URLS_BY_FOOD_ID = Object.entries(SPRITE_URL_GLOBS).reduce((acc, [foodId, spriteGlob]) => {
  acc[foodId] = collectSpriteUrls(spriteGlob, Number.POSITIVE_INFINITY);
  return acc;
}, {});

const FOOD_TYPES = [
  {
    id: 'condiments',
    label: 'Condiments',
    short: 'Cm',
    color: 0xf97316,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.condiments, MAX_GAMEPLAY_SPRITES_PER_TYPE)
  },
  {
    id: 'carbs',
    label: 'Carbs',
    short: 'Cb',
    color: 0xeab308,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.carbs, MAX_GAMEPLAY_SPRITES_PER_TYPE)
  },
  {
    id: 'protein',
    label: 'Protein',
    short: 'Pr',
    color: 0xef4444,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.protein, MAX_GAMEPLAY_SPRITES_PER_TYPE)
  },
  {
    id: 'greens',
    label: 'Greens',
    short: 'Gr',
    color: 0x22c55e,
    spriteUrls: collectSpriteUrls(SPRITE_URL_GLOBS.greens, MAX_GAMEPLAY_SPRITES_PER_TYPE)
  }
];

const BASE_LANE_LAYOUT = [
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

const DEFAULT_MAIN_X = 640;
const DEFAULT_MAIN_START_Y = 72;
const DEFAULT_MAIN_END_Y = 640;
const SIDE_BELT_MIN_LENGTH = Math.abs((DEFAULT_MAIN_X - SIDE_BELT_INTAKE_OFFSET) - BASE_LANE_LAYOUT[0].endX);
const SIDE_BELT_MAX_LENGTH = MAIN_BELT_HEIGHT;

function cloneBaseLaneLayout() {
  return BASE_LANE_LAYOUT.map((lane) => ({ ...lane }));
}

function toFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    this.mainX = DEFAULT_MAIN_X;
    this.mainStartY = DEFAULT_MAIN_START_Y;
    this.mainEndY = DEFAULT_MAIN_END_Y;
    this.mainFlowSign = 1;
    this.mainLength = Math.abs(this.mainEndY - this.mainStartY);

    this.levelId = DEFAULT_LEVEL_ID;
    this.levelConfig = null;
    this.levelMode = 'endless';
    this.levelName = 'Endless';
    this.levelLayoutFamily = 'rotated_h';
    this.layoutUsesMainBelt = true;
    this.directLaneSpawn = false;
    this.showTransferClaws = true;
    this.loadingToken = null;
    this.isFiniteLevel = false;
    this.levelQuota = null;
    this.levelComplete = false;
    this.levelResultOverlay = null;
    this.levelResultText = null;
    this.levelInfoText = null;
    this.quotaText = null;

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
    this.itemSpacing = FOOD_RENDER_SIZE + FOOD_SPACING_PADDING;

    this.defaultTuning = {
      baseMainSpeed: this.baseMainSpeed,
      baseSideSpeed: this.baseSideSpeed,
      maxMainSpeed: this.maxMainSpeed,
      maxSideSpeed: this.maxSideSpeed,
      baseSpawnIntervalMs: this.baseSpawnIntervalMs,
      minSpawnIntervalMs: this.minSpawnIntervalMs,
      scoreRampStepPoints: this.scoreRampStepPoints,
      mainSpeedPerStep: this.mainSpeedPerStep,
      sideSpeedPerStep: this.sideSpeedPerStep,
      spawnIntervalDecreasePerStepMs: this.spawnIntervalDecreasePerStepMs
    };

    this.nextItemId = 1;
    this.items = [];
    this.lanesById = {};
    this.laneLayout = cloneBaseLaneLayout();
    this.clawRows = [];
    this.activeFoodTypes = [...FOOD_TYPES];
    this.textureKeysByFoodId = {};
    this.chestBubbleTextureKeysByFoodId = {};
    this.jamBeetleTextureKeys = [];

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
    this.bloodParticles = null;

    this.droneActive = false;
    this.droneContainer = null;
    this.droneRotorTweens = [];
    this.droneCarryItemId = null;
    this.droneSabotageTimerMs = 0;
    this.droneRunToken = 0;

    this.isGameOver = false;
    this.isPaused = false;
    this.sceneTransitioning = false;
    this.pauseTransitionLock = false;
    this.pauseButtonContainer = null;
    this.pauseButtonBody = null;
    this.pauseButtonBars = [];
    this.pauseMenuContainer = null;
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
    this.layoutDecorationGraphics = null;
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
    this.musicReactiveLayerEnabled = false;
    this.musicBeatTimerMs = 0;
    this.musicBeatMs = 60000 / 96;
    this.musicStepIndex = 0;
    this.musicComboRisePulseMs = 0;
    this.musicComboDropPulseMs = 0;
    this.bgmUrl = assemblyLineShuffleUrl;
    this.bgmBuffer = null;
    this.bgmLoadPromise = null;
    this.bgmSourceNode = null;
    this.bgmGainNode = null;
    this.bgmPlaybackState = 'idle';
    this.bgmSessionToken = 0;
    this.levelClearMusicActive = false;
    this.victoryMusicUrl = bannersOverPeakUrl;
    this.victoryMusicBuffer = null;
    this.victoryMusicLoadPromise = null;
    this.victoryMusicSourceNode = null;
    this.victoryMusicGainNode = null;
    this.victoryMusicPlaybackState = 'idle';
    this.gameOverMusicUrl = ratioedInTheLobbyUrl;
    this.gameOverMusicBuffer = null;
    this.gameOverMusicLoadPromise = null;
    this.gameOverMusicSourceNode = null;
    this.gameOverMusicGainNode = null;
    this.gameOverMusicPlaybackState = 'idle';
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
    this.chestPriorityChargesByLaneId = this.laneLayout.reduce((acc, lane) => {
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

  init(data) {
    this.loadingToken = typeof data?.loadingToken === 'string' ? data.loadingToken : null;

    const levelId = typeof data?.levelId === 'string' ? data.levelId : DEFAULT_LEVEL_ID;
    const levelConfig = getLevelById(levelId);

    this.levelConfig = levelConfig;
    this.levelId = levelConfig.id;
    this.applyLevelConfig(levelConfig);
    this.resetRunState();
  }

  applyLevelConfig(levelConfig) {
    const flowDirection = levelConfig?.mainFlowDirection === 'up' ? 'up' : 'down';
    this.mainFlowSign = flowDirection === 'up' ? -1 : 1;
    this.mainStartY = flowDirection === 'up' ? DEFAULT_MAIN_END_Y : DEFAULT_MAIN_START_Y;
    this.mainEndY = flowDirection === 'up' ? DEFAULT_MAIN_START_Y : DEFAULT_MAIN_END_Y;
    this.mainLength = Math.abs(this.mainEndY - this.mainStartY);

    this.levelMode = levelConfig?.mode || 'endless';
    this.levelName = levelConfig?.title || levelConfig?.id || 'Untitled Level';
    this.levelLayoutFamily = levelConfig?.layoutFamily || 'rotated_h';
    this.applyLayoutFamilyBehavior(this.levelLayoutFamily);
    this.isFiniteLevel = this.levelMode !== 'endless' && Number.isFinite(levelConfig?.quota);
    this.levelQuota = this.isFiniteLevel ? Math.max(1, Math.floor(levelConfig.quota)) : null;

    const activeLaneIds = Array.isArray(levelConfig?.activeLaneIds) && levelConfig.activeLaneIds.length > 0
      ? levelConfig.activeLaneIds
      : BASE_LANE_LAYOUT.map((lane) => lane.id);

    const chestMapping = levelConfig?.chestMapping || {};
    const laneOverrides = levelConfig?.laneOverrides || {};

    let laneLayout = cloneBaseLaneLayout().filter((lane) => activeLaneIds.includes(lane.id));
    laneLayout = this.applyLayoutFamilyPreset(laneLayout, this.levelLayoutFamily);

    this.laneLayout = laneLayout.map((lane) => {
      const override = laneOverrides[lane.id] || {};
      const desiredType = chestMapping[lane.id] || lane.desiredType;
      const foodType = this.foodTypeById[desiredType] || this.foodTypeById[lane.desiredType] || FOOD_TYPES[0];

      return {
        ...lane,
        ...override,
        desiredType: foodType.id,
        label: foodType.label,
        chestLabel: `${foodType.label} Chest`
      };
    });

    if (this.shouldEnforceCampaignSpacing(levelConfig)) {
      this.laneLayout = this.enforceCampaignSpacing(this.laneLayout);
    }

    this.laneLayout = this.enforceSideBeltLengthBounds(this.laneLayout);

    this.clawRows = this.buildClawRowsFromLaneLayout(this.laneLayout);

    const activeFoodIds = Array.isArray(levelConfig?.foods) && levelConfig.foods.length > 0
      ? levelConfig.foods
      : [...new Set(this.laneLayout.map((lane) => lane.desiredType))];
    this.activeFoodTypes = FOOD_TYPES.filter((food) => activeFoodIds.includes(food.id));
    if (this.activeFoodTypes.length === 0) {
      this.activeFoodTypes = [...FOOD_TYPES];
    }

    const spawnProfile = levelConfig?.spawn || {};
    this.baseMainSpeed = toFiniteNumber(spawnProfile.baseMainSpeed, this.defaultTuning.baseMainSpeed);
    this.baseSideSpeed = toFiniteNumber(spawnProfile.baseSideSpeed, this.defaultTuning.baseSideSpeed);
    this.maxMainSpeed = toFiniteNumber(spawnProfile.maxMainSpeed, this.defaultTuning.maxMainSpeed);
    this.maxSideSpeed = toFiniteNumber(spawnProfile.maxSideSpeed, this.defaultTuning.maxSideSpeed);

    this.baseSpawnIntervalMs = toFiniteNumber(spawnProfile.baseIntervalMs, this.defaultTuning.baseSpawnIntervalMs);
    this.minSpawnIntervalMs = toFiniteNumber(spawnProfile.minIntervalMs, this.defaultTuning.minSpawnIntervalMs);
    this.scoreRampStepPoints = toFiniteNumber(spawnProfile.scoreRampStepPoints, this.defaultTuning.scoreRampStepPoints);
    this.mainSpeedPerStep = toFiniteNumber(spawnProfile.mainSpeedPerStep, this.defaultTuning.mainSpeedPerStep);
    this.sideSpeedPerStep = toFiniteNumber(spawnProfile.sideSpeedPerStep, this.defaultTuning.sideSpeedPerStep);
    this.spawnIntervalDecreasePerStepMs = toFiniteNumber(
      spawnProfile.spawnIntervalDecreasePerStepMs,
      this.defaultTuning.spawnIntervalDecreasePerStepMs
    );

    this.baseMainSpeed = Math.max(12, this.baseMainSpeed * GLOBAL_FLOW_SPEED_SCALE);
    this.baseSideSpeed = Math.max(12, this.baseSideSpeed * GLOBAL_FLOW_SPEED_SCALE);
    this.maxMainSpeed = Math.max(this.baseMainSpeed + 20, this.maxMainSpeed * GLOBAL_FLOW_SPEED_SCALE);
    this.maxSideSpeed = Math.max(this.baseSideSpeed + 20, this.maxSideSpeed * GLOBAL_FLOW_SPEED_SCALE);

    this.baseSpawnIntervalMs = Math.max(100, this.baseSpawnIntervalMs * GLOBAL_SPAWN_INTERVAL_SCALE);
    this.minSpawnIntervalMs = Math.max(60, this.minSpawnIntervalMs * GLOBAL_SPAWN_INTERVAL_SCALE);
    this.scoreRampStepPoints = Math.max(1, this.scoreRampStepPoints * GLOBAL_SCORE_RAMP_STEP_SCALE);
    this.mainSpeedPerStep = Math.max(0, this.mainSpeedPerStep * GLOBAL_SPEED_RAMP_SCALE);
    this.sideSpeedPerStep = Math.max(0, this.sideSpeedPerStep * GLOBAL_SPEED_RAMP_SCALE);
    this.spawnIntervalDecreasePerStepMs = Math.max(0, this.spawnIntervalDecreasePerStepMs * GLOBAL_SPAWN_RAMP_SCALE);

    this.baseSpawnIntervalMs = Math.max(100, this.baseSpawnIntervalMs);
    this.minSpawnIntervalMs = Phaser.Math.Clamp(this.minSpawnIntervalMs, 60, this.baseSpawnIntervalMs);
  }

  applyLayoutFamilyBehavior(layoutFamily) {
    const noMainBeltFamilies = new Set(['v_swap', 'triangle_mesh', 'dual_spine']);
    this.directLaneSpawn = noMainBeltFamilies.has(layoutFamily);
    this.layoutUsesMainBelt = !this.directLaneSpawn;
    this.showTransferClaws = this.layoutUsesMainBelt;
  }

  shouldEnforceCampaignSpacing(levelConfig) {
    const levelIndex = Number(levelConfig?.index);
    return this.layoutUsesMainBelt
      && Number.isFinite(levelIndex)
      && levelIndex >= SPACING_RULE_LEVEL_START
      && levelIndex <= SPACING_RULE_LEVEL_END;
  }

  enforceCampaignSpacing(laneLayout) {
    if (!Array.isArray(laneLayout)) {
      return [];
    }

    // Lock lane intake/chest distances to level-1 spacing for campaign levels 6-12.
    return laneLayout.map((lane) => ({
      ...lane,
      intakeX: this.mainX + lane.direction * SIDE_BELT_INTAKE_OFFSET,
      chestX: lane.endX + lane.direction * STANDARD_CHEST_OFFSET_X
    }));
  }

  enforceSideBeltLengthBounds(laneLayout) {
    if (!Array.isArray(laneLayout)) {
      return [];
    }

    return laneLayout.map((lane) => {
      const direction = lane.direction >= 0 ? 1 : -1;
      const fallbackIntakeX = this.mainX + direction * SIDE_BELT_INTAKE_OFFSET;
      const intakeX = Number.isFinite(lane.intakeX) ? lane.intakeX : fallbackIntakeX;
      const endX = Number.isFinite(lane.endX) ? lane.endX : intakeX + direction * SIDE_BELT_MIN_LENGTH;
      const beltLength = Math.abs(intakeX - endX);
      const boundedLength = Phaser.Math.Clamp(beltLength, SIDE_BELT_MIN_LENGTH, SIDE_BELT_MAX_LENGTH);

      if (Math.abs(boundedLength - beltLength) < 0.001) {
        return lane;
      }

      if (this.layoutUsesMainBelt) {
        const chestOffset = Number.isFinite(lane.chestX)
          ? lane.chestX - endX
          : direction * STANDARD_CHEST_OFFSET_X;
        const nextEndX = intakeX + direction * boundedLength;

        return {
          ...lane,
          endX: nextEndX,
          chestX: nextEndX + chestOffset
        };
      }

      return {
        ...lane,
        intakeX: endX - direction * boundedLength
      };
    });
  }

  applyLayoutFamilyPreset(laneLayout, layoutFamily) {
    if (!Array.isArray(laneLayout) || laneLayout.length === 0) {
      return [];
    }

    const byId = laneLayout.reduce((acc, lane) => {
      acc[lane.id] = lane;
      return acc;
    }, {});

    const patchLane = (laneId, patch) => {
      if (!byId[laneId]) {
        return;
      }

      Object.assign(byId[laneId], patch);
    };

    if (layoutFamily === 'e_shape') {
      const sorted = [...laneLayout].sort((a, b) => a.y - b.y);
      return sorted.map((lane, index) => ({
        ...lane,
        direction: 1,
        y: 240 + index * 140,
        endX: 1070,
        chestX: 1170
      }));
    }

    if (layoutFamily === 'reverse_e_shape') {
      const sorted = [...laneLayout].sort((a, b) => a.y - b.y);
      return sorted.map((lane, index) => ({
        ...lane,
        direction: -1,
        y: 240 + index * 140,
        endX: 210,
        chestX: 110
      }));
    }

    if (layoutFamily === 'v_shape') {
      const sorted = [...laneLayout].sort((a, b) => a.y - b.y);
      return sorted.map((lane, index) => ({
        ...lane,
        y: 250 + index * 160,
        direction: index % 2 === 0 ? -1 : 1,
        endX: index % 2 === 0 ? 190 : 1090,
        chestX: index % 2 === 0 ? 110 : 1170
      }));
    }

    if (layoutFamily === 'y_shape') {
      patchLane('mid_left', {
        y: 270,
        direction: -1,
        intakeX: this.mainX - SIDE_BELT_INTAKE_OFFSET,
        endX: 220,
        chestX: 110
      });
      patchLane('mid_right', {
        y: 270,
        direction: 1,
        intakeX: this.mainX + SIDE_BELT_INTAKE_OFFSET,
        endX: 1060,
        chestX: 1170
      });
      patchLane('bot_left', {
        y: 500,
        direction: -1,
        intakeX: this.mainX - SIDE_BELT_INTAKE_OFFSET,
        endX: 240,
        chestX: 110
      });
      patchLane('bot_right', {
        y: 500,
        direction: 1,
        intakeX: this.mainX + SIDE_BELT_INTAKE_OFFSET,
        endX: 1040,
        chestX: 1170
      });
      return laneLayout;
    }

    if (layoutFamily === 'm_shape') {
      patchLane('mid_left', {
        y: 230,
        direction: -1,
        intakeX: this.mainX - SIDE_BELT_INTAKE_OFFSET,
        endX: 250,
        chestX: 110
      });
      patchLane('mid_right', {
        y: 230,
        direction: 1,
        intakeX: this.mainX + SIDE_BELT_INTAKE_OFFSET,
        endX: 1030,
        chestX: 1170
      });
      patchLane('bot_left', { y: 500, direction: -1, intakeX: 560, endX: 210, chestX: 110 });
      patchLane('bot_right', { y: 500, direction: 1, intakeX: 720, endX: 1070, chestX: 1170 });
      return laneLayout;
    }

    if (layoutFamily === 'n_shape') {
      patchLane('mid_left', { y: 220, direction: -1, intakeX: 560, endX: 220, chestX: 110 });
      patchLane('mid_right', { y: 340, direction: 1, intakeX: 700, endX: 1060, chestX: 1170 });
      patchLane('bot_left', { y: 460, direction: -1, intakeX: 600, endX: 210, chestX: 110 });
      patchLane('bot_right', { y: 580, direction: 1, intakeX: 760, endX: 1080, chestX: 1170 });
      return laneLayout;
    }

    if (layoutFamily === 'k_shape') {
      patchLane('mid_left', {
        y: 250,
        direction: -1,
        intakeX: this.mainX - SIDE_BELT_INTAKE_OFFSET,
        endX: 220,
        chestX: 110
      });
      patchLane('mid_right', { y: 250, direction: 1, intakeX: 700, endX: 1040, chestX: 1170 });
      patchLane('bot_left', { y: 430, direction: -1, intakeX: 560, endX: 210, chestX: 110 });
      patchLane('bot_right', { y: 530, direction: 1, intakeX: 760, endX: 1090, chestX: 1170 });
      return laneLayout;
    }

    if (layoutFamily === 'triangle_mesh') {
      patchLane('mid_left', {
        y: 210,
        direction: -1,
        intakeX: this.mainX - 8,
        endX: 220,
        chestX: 110
      });
      patchLane('mid_right', {
        y: 210,
        direction: 1,
        intakeX: this.mainX + 8,
        endX: 1060,
        chestX: 1170
      });
      patchLane('bot_left', {
        y: 390,
        direction: -1,
        intakeX: 560,
        endX: 210,
        chestX: 110
      });
      patchLane('bot_right', {
        y: 560,
        direction: 1,
        intakeX: 720,
        endX: 1070,
        chestX: 1170
      });
      return laneLayout;
    }

    if (layoutFamily === 'dual_spine') {
      patchLane('mid_left', {
        y: 220,
        direction: -1,
        intakeX: 460,
        endX: 190,
        chestX: 110
      });
      patchLane('bot_left', {
        y: 500,
        direction: -1,
        intakeX: 480,
        endX: 210,
        chestX: 110
      });
      patchLane('mid_right', {
        y: 300,
        direction: 1,
        intakeX: 820,
        endX: 1070,
        chestX: 1170
      });
      patchLane('bot_right', {
        y: 580,
        direction: 1,
        intakeX: 800,
        endX: 1050,
        chestX: 1170
      });
      return laneLayout;
    }

    if (layoutFamily === 'p_shape') {
      patchLane('mid_left', {
        y: 220,
        direction: 1,
        intakeX: this.mainX + SIDE_BELT_INTAKE_OFFSET,
        endX: 980,
        chestX: 1090
      });
      patchLane('mid_right', {
        y: 330,
        direction: 1,
        intakeX: this.mainX + SIDE_BELT_INTAKE_OFFSET,
        endX: 1080,
        chestX: 1170
      });
      patchLane('bot_right', {
        y: 450,
        direction: 1,
        intakeX: this.mainX + SIDE_BELT_INTAKE_OFFSET,
        endX: 1020,
        chestX: 1130
      });
      patchLane('bot_left', {
        y: 560,
        direction: -1,
        intakeX: this.mainX - SIDE_BELT_INTAKE_OFFSET,
        endX: 210,
        chestX: 110
      });
      return laneLayout;
    }

    if (layoutFamily === 'v_swap') {
      patchLane('mid_left', { y: 290, direction: -1, intakeX: this.mainX, endX: 210, chestX: 110 });
      patchLane('mid_right', { y: 460, direction: 1, intakeX: this.mainX, endX: 1070, chestX: 1170 });
      patchLane('bot_left', { y: 290, direction: -1, intakeX: this.mainX, endX: 210, chestX: 110 });
      patchLane('bot_right', { y: 460, direction: 1, intakeX: this.mainX, endX: 1070, chestX: 1170 });
      return laneLayout;
    }

    return laneLayout;
  }

  buildClawRowsFromLaneLayout(laneLayout) {
    const rowsByY = laneLayout.reduce((acc, lane) => {
      const key = Number(lane.y);
      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(lane.id);
      return acc;
    }, {});

    return Object.entries(rowsByY)
      .map(([y, laneIds]) => {
        const rowY = Number(y);
        const mainPos = Phaser.Math.Clamp(this.getMainPosForWorldY(rowY), 0, this.mainLength);
        return {
          y: rowY,
          mainPos,
          laneIds: laneIds
        };
      })
      .sort((a, b) => a.mainPos - b.mainPos);
  }

  resetRunState() {
    this.cleanupDroneSabotage(true);

    this.spawnTimerMs = 0;
    this.spawnBlockedThisFrame = false;

    this.mainSpeed = this.baseMainSpeed;
    this.sideSpeed = this.baseSideSpeed;
    this.spawnIntervalMs = this.baseSpawnIntervalMs;

    this.nextItemId = 1;
    this.items = [];
    this.lanesById = {};

    this.acceptedCount = 0;
    this.rejectedCount = 0;
    this.score = 0;
    this.multiplier = 1;
    this.comboMilestoneTier = 0;

    this.isGameOver = false;
    this.isPaused = false;
    this.sceneTransitioning = false;
    this.pauseTransitionLock = false;
    this.pauseButtonContainer = null;
    this.pauseButtonBody = null;
    this.pauseButtonBars = [];
    this.pauseMenuContainer = null;
    this.levelComplete = false;
    this.clogTimerSeconds = 0;
    this.gameOverOverlay = null;
    this.gameOverText = null;
    this.levelResultOverlay = null;
    this.levelResultText = null;

    this.dragContext = null;
    this.simTimeScale = 1;
    this.hitStopMs = 0;
    this.hitStopScale = 1;

    this.coolantFlushHoldMs = 0;
    this.coolantFlushRampMs = 0;
    this.smartSortScoreLockMs = 0;
    this.inserterCalibrationMs = 0;
    this.chestPriorityMs = 0;
    this.turboShiftMs = 0;
    this.comboFurnaceMs = 0;
    this.comboFurnaceJamPenaltyArmed = false;
    this.emergencyBrakeMs = 0;
    this.emergencyBrakePenaltySpawnsRemaining = 0;
    this.beltRephaseMs = 0;
    this.predictivePullSpawnsRemaining = 0;
    this.predictivePullSpawnsCap = 0;
    this.riskyThroughputMs = 0;
    this.fragileJackpotNoSlowMoMs = 0;

    this.currentPressure = 0;
    this.pressureSampleTimerMs = 0;
    this.highPressureHoldMs = 0;
    this.cardDraftCooldownMs = 0;
    this.timeSinceLastDraftMs = 0;
    this.pendingScoreDraft = false;
    this.nextCardScoreMilestone = this.cardScoreMilestonePoints;

    this.isDraftActive = false;
    this.activeDraftTrigger = null;
    this.cardDraftChoices = [];
    this.cardDraftEntries = [];
    this.cardDraftSelectedIndex = 0;
    this.cardDraftPointerLockMs = 0;
    this.cardDraftPointerReleaseRequired = false;

    this.musicComboRisePulseMs = 0;
    this.musicComboDropPulseMs = 0;
    this.musicBeatTimerMs = 0;
    this.stopBgmSource();
    this.bgmPlaybackState = 'idle';
    this.stopVictoryMusicSource();
    this.victoryMusicPlaybackState = 'idle';
    this.stopGameOverMusicSource();
    this.gameOverMusicPlaybackState = 'idle';
    this.levelClearMusicActive = false;
    this.bgmSessionToken += 1;

    if (this.isDroneSabotageLevelEnabled()) {
      this.resetDroneSabotageTimer();
    } else {
      this.droneSabotageTimerMs = Number.POSITIVE_INFINITY;
    }

    this.resetChestPriorityCharges();
  }

  getMainWorldY(mainPos) {
    return this.mainStartY + this.mainFlowSign * mainPos;
  }

  getMainPosForWorldY(worldY) {
    return (worldY - this.mainStartY) * this.mainFlowSign;
  }

  preload() {
    if (CHEST_CLOSED_URL) {
      if (!this.textures.exists(CHEST_CLOSED_KEY)) {
        this.load.image(CHEST_CLOSED_KEY, CHEST_CLOSED_URL);
      }
    }
    if (CHEST_OPENED_URL) {
      if (!this.textures.exists(CHEST_OPENED_KEY)) {
        this.load.image(CHEST_OPENED_KEY, CHEST_OPENED_URL);
      }
    }

    const textureKeyByUrl = new Map();

    FOOD_TYPES.forEach((food) => {
      this.textureKeysByFoodId[food.id] = [];

      food.spriteUrls.forEach((url, index) => {
        const textureKey = `food_${food.id}_${index}`;
        if (!this.textures.exists(textureKey)) {
          this.load.image(textureKey, url);
        }
        this.textureKeysByFoodId[food.id].push(textureKey);
        textureKeyByUrl.set(url, textureKey);
      });
    });

    Object.entries(CHEST_BUBBLE_SPRITE_URLS_BY_FOOD_ID).forEach(([foodId, spriteUrls]) => {
      this.chestBubbleTextureKeysByFoodId[foodId] = [];

      spriteUrls.forEach((url, index) => {
        const existingKey = textureKeyByUrl.get(url);
        if (existingKey) {
          this.chestBubbleTextureKeysByFoodId[foodId].push(existingKey);
          return;
        }

        const textureKey = `food_chest_bubble_${foodId}_${index}`;
        if (!this.textures.exists(textureKey)) {
          this.load.image(textureKey, url);
        }
        this.chestBubbleTextureKeysByFoodId[foodId].push(textureKey);
        textureKeyByUrl.set(url, textureKey);
      });
    });

    this.jamBeetleTextureKeys = [];
    JAM_BEETLE_SPRITE_URLS.forEach((url, index) => {
      const textureKey = `jam_beetle_${index}`;
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, url);
      }
      this.jamBeetleTextureKeys.push(textureKey);
      textureKeyByUrl.set(url, textureKey);
    });
  }

  create() {
    this.createFactoryVisuals();
    this.createSceneJuiceLayer();
    this.initAudioSystem();
    this.createScoreUi();
    this.createPauseUi();
    this.createCardSystem();
    this.createParticles();
    this.ensureJamBeetleAnimation();
    this.setupGrabControls();
    this.game.events.emit('scene-ready:GameScene', {
      loadingToken: this.loadingToken,
      levelId: this.levelId
    });
    this.loadingToken = null;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleSceneShutdown, this);
  }

  createSceneJuiceLayer() {
    this.fxTimeMs = 0;

    const leftGlow = this.add.circle(236, 126, 250, 0xf59e0b, 0.14).setDepth(-20);
    leftGlow.setBlendMode(Phaser.BlendModes.ADD);
    const rightGlow = this.add.circle(1040, 608, 280, 0xfb7185, 0.12).setDepth(-20);
    rightGlow.setBlendMode(Phaser.BlendModes.ADD);
    const centerGlow = this.add.circle(640, 358, 330, 0x34d399, 0.08).setDepth(-19);
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

    this.moodVignette = this.add.rectangle(640, 360, 1280, 720, 0x1a0b06, 0.16).setDepth(250);

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
    this.audioMusicGain.gain.value = 0.95;
    this.audioSfxGain.gain.value = 0.9;

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

    this.stopBgmSource();
    if (this.bgmGainNode) {
      this.bgmGainNode.disconnect();
    }
    this.bgmGainNode = ctx.createGain();
    this.bgmGainNode.gain.value = 0.0001;
    this.bgmGainNode.connect(this.audioMusicGain);

    this.stopVictoryMusicSource();
    if (this.victoryMusicGainNode) {
      this.victoryMusicGainNode.disconnect();
    }
    this.victoryMusicGainNode = ctx.createGain();
    this.victoryMusicGainNode.gain.value = 0.0001;
    this.victoryMusicGainNode.connect(this.audioMusicGain);

    this.stopGameOverMusicSource();
    if (this.gameOverMusicGainNode) {
      this.gameOverMusicGainNode.disconnect();
    }
    this.gameOverMusicGainNode = ctx.createGain();
    this.gameOverMusicGainNode.gain.value = 0.0001;
    this.gameOverMusicGainNode.connect(this.audioMusicGain);

    this.bgmPlaybackState = 'idle';
    this.victoryMusicPlaybackState = 'idle';
    this.gameOverMusicPlaybackState = 'idle';
    this.levelClearMusicActive = false;
    this.bgmSessionToken += 1;
    this.loadBgmBuffer();
    this.loadVictoryMusicBuffer();
    this.loadGameOverMusicBuffer();

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
      this.ensureBgmPlayback();

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

  handleSceneShutdown() {
    this.isPaused = false;
    this.sceneTransitioning = false;
    this.pauseTransitionLock = false;
    this.pauseButtonContainer = null;
    this.pauseButtonBody = null;
    this.pauseButtonBars = [];
    this.pauseMenuContainer = null;
    this.cleanupDroneSabotage(true);

    this.stopBgmSource();
    this.bgmPlaybackState = 'idle';
    this.stopVictoryMusicSource();
    this.victoryMusicPlaybackState = 'idle';
    this.stopGameOverMusicSource();
    this.gameOverMusicPlaybackState = 'idle';
    this.levelClearMusicActive = false;
    this.bgmSessionToken += 1;

    if (this.bgmGainNode) {
      this.bgmGainNode.disconnect();
      this.bgmGainNode = null;
    }

    if (this.victoryMusicGainNode) {
      this.victoryMusicGainNode.disconnect();
      this.victoryMusicGainNode = null;
    }

    if (this.gameOverMusicGainNode) {
      this.gameOverMusicGainNode.disconnect();
      this.gameOverMusicGainNode = null;
    }

    this.input.off('pointerdown', this.unlockAudioContext, this);
    this.input.keyboard?.off('keydown', this.unlockAudioContext, this);
    this.input.gamepad?.off('down', this.unlockAudioContext, this);
  }

  loadBgmBuffer() {
    if (!this.audioCtx || !this.bgmUrl) {
      return Promise.resolve(null);
    }

    if (this.bgmBuffer) {
      return Promise.resolve(this.bgmBuffer);
    }

    if (this.bgmLoadPromise) {
      return this.bgmLoadPromise;
    }

    this.bgmLoadPromise = fetch(this.bgmUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`BGM fetch failed with status ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (!this.audioCtx) {
          return null;
        }

        if (this.audioCtx.decodeAudioData.length <= 1) {
          return this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
        }

        return new Promise((resolve, reject) => {
          this.audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        });
      })
      .then((buffer) => {
        if (!buffer) {
          return null;
        }

        this.bgmBuffer = buffer;
        return buffer;
      })
      .catch(() => null)
      .finally(() => {
        this.bgmLoadPromise = null;
      });

    return this.bgmLoadPromise;
  }

  loadVictoryMusicBuffer() {
    if (!this.audioCtx || !this.victoryMusicUrl) {
      return Promise.resolve(null);
    }

    if (this.victoryMusicBuffer) {
      return Promise.resolve(this.victoryMusicBuffer);
    }

    if (this.victoryMusicLoadPromise) {
      return this.victoryMusicLoadPromise;
    }

    this.victoryMusicLoadPromise = fetch(this.victoryMusicUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Victory music fetch failed with status ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (!this.audioCtx) {
          return null;
        }

        if (this.audioCtx.decodeAudioData.length <= 1) {
          return this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
        }

        return new Promise((resolve, reject) => {
          this.audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        });
      })
      .then((buffer) => {
        if (!buffer) {
          return null;
        }

        this.victoryMusicBuffer = buffer;
        return buffer;
      })
      .catch(() => null)
      .finally(() => {
        this.victoryMusicLoadPromise = null;
      });

    return this.victoryMusicLoadPromise;
  }

  loadGameOverMusicBuffer() {
    if (!this.audioCtx || !this.gameOverMusicUrl) {
      return Promise.resolve(null);
    }

    if (this.gameOverMusicBuffer) {
      return Promise.resolve(this.gameOverMusicBuffer);
    }

    if (this.gameOverMusicLoadPromise) {
      return this.gameOverMusicLoadPromise;
    }

    this.gameOverMusicLoadPromise = fetch(this.gameOverMusicUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Game-over music fetch failed with status ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (!this.audioCtx) {
          return null;
        }

        if (this.audioCtx.decodeAudioData.length <= 1) {
          return this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
        }

        return new Promise((resolve, reject) => {
          this.audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        });
      })
      .then((buffer) => {
        if (!buffer) {
          return null;
        }

        this.gameOverMusicBuffer = buffer;
        return buffer;
      })
      .catch(() => null)
      .finally(() => {
        this.gameOverMusicLoadPromise = null;
      });

    return this.gameOverMusicLoadPromise;
  }

  ensureBgmPlayback() {
    if (!this.audioEnabled || !this.audioUnlocked || !this.audioCtx || !this.bgmGainNode || this.isGameOver || this.levelClearMusicActive) {
      return;
    }

    if (this.bgmPlaybackState !== 'idle') {
      return;
    }

    this.bgmPlaybackState = 'loading';
    const sessionToken = this.bgmSessionToken;

    this.loadBgmBuffer()
      .then((buffer) => {
        if (!buffer || sessionToken !== this.bgmSessionToken || !this.audioUnlocked || !this.bgmGainNode) {
          if (this.bgmPlaybackState === 'loading') {
            this.bgmPlaybackState = 'idle';
          }
          return;
        }

        this.startBgmPlayback(sessionToken);
      })
      .catch(() => {
        if (this.bgmPlaybackState === 'loading') {
          this.bgmPlaybackState = 'idle';
        }
      });
  }

  startBgmPlayback(sessionToken) {
    if (!this.audioCtx || !this.bgmBuffer || !this.bgmGainNode || sessionToken !== this.bgmSessionToken) {
      this.bgmPlaybackState = 'idle';
      return;
    }

    this.stopBgmSource();

    const source = this.audioCtx.createBufferSource();
    source.buffer = this.bgmBuffer;
    source.loop = false;
    source.connect(this.bgmGainNode);

    this.bgmSourceNode = source;
    this.bgmPlaybackState = 'playing';

    source.onended = () => {
      if (this.bgmSourceNode === source) {
        this.bgmSourceNode = null;
      }
      source.disconnect();

      const canRestart = (
        sessionToken === this.bgmSessionToken
        && this.audioCtx
        && this.bgmBuffer
        && this.bgmGainNode
        && this.audioUnlocked
        && !this.levelClearMusicActive
        && !this.isGameOver
      );

      if (!canRestart) {
        if (this.bgmPlaybackState === 'playing') {
          this.bgmPlaybackState = 'idle';
        }
        return;
      }

      // Restart from the very beginning each time the track ends.
      this.startBgmPlayback(sessionToken);
    };

    try {
      source.start(this.audioCtx.currentTime + 0.01, 0);
    } catch {
      this.bgmPlaybackState = 'idle';
      source.onended = null;
      source.disconnect();
      if (this.bgmSourceNode === source) {
        this.bgmSourceNode = null;
      }
    }
  }

  stopBgmSource() {
    if (!this.bgmSourceNode) {
      return;
    }

    const activeSource = this.bgmSourceNode;
    this.bgmSourceNode = null;
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

  stopVictoryMusicSource() {
    if (!this.victoryMusicSourceNode) {
      return;
    }

    const activeSource = this.victoryMusicSourceNode;
    this.victoryMusicSourceNode = null;
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

  stopGameOverMusicSource() {
    if (!this.gameOverMusicSourceNode) {
      return;
    }

    const activeSource = this.gameOverMusicSourceNode;
    this.gameOverMusicSourceNode = null;
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

  fadeOutAssemblyMusicFast(durationSec = 0.22) {
    if (!this.audioCtx || !this.bgmGainNode) {
      this.stopBgmSource();
      this.bgmPlaybackState = 'idle';
      return;
    }

    const fadeDuration = Phaser.Math.Clamp(durationSec, 0.05, 1.2);
    const now = this.audioCtx.currentTime;
    const currentGain = Math.max(0.0001, this.bgmGainNode.gain.value);
    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.setValueAtTime(currentGain, now);
    this.bgmGainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);

    this.time.delayedCall(Math.round(fadeDuration * 1000) + 24, () => {
      this.stopBgmSource();
      this.bgmPlaybackState = 'idle';
    });
  }

  fadeOutVictoryMusicFast(durationSec = 0.18, stopAfterFade = true) {
    if (!this.audioCtx || !this.victoryMusicGainNode) {
      if (stopAfterFade) {
        this.stopVictoryMusicSource();
        this.victoryMusicPlaybackState = 'idle';
      }
      return;
    }

    const fadeDuration = Phaser.Math.Clamp(durationSec, 0.05, 1.2);
    const now = this.audioCtx.currentTime;
    const currentGain = Math.max(0.0001, this.victoryMusicGainNode.gain.value);
    this.victoryMusicGainNode.gain.cancelScheduledValues(now);
    this.victoryMusicGainNode.gain.setValueAtTime(currentGain, now);
    this.victoryMusicGainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);

    if (stopAfterFade) {
      this.time.delayedCall(Math.round(fadeDuration * 1000) + 24, () => {
        this.stopVictoryMusicSource();
        this.victoryMusicPlaybackState = 'idle';
      });
    }
  }

  fadeOutGameOverMusicFast(durationSec = 0.18, stopAfterFade = true) {
    if (!this.audioCtx || !this.gameOverMusicGainNode) {
      if (stopAfterFade) {
        this.stopGameOverMusicSource();
        this.gameOverMusicPlaybackState = 'idle';
      }
      return;
    }

    const fadeDuration = Phaser.Math.Clamp(durationSec, 0.05, 1.2);
    const now = this.audioCtx.currentTime;
    const currentGain = Math.max(0.0001, this.gameOverMusicGainNode.gain.value);
    this.gameOverMusicGainNode.gain.cancelScheduledValues(now);
    this.gameOverMusicGainNode.gain.setValueAtTime(currentGain, now);
    this.gameOverMusicGainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);

    if (stopAfterFade) {
      this.time.delayedCall(Math.round(fadeDuration * 1000) + 24, () => {
        this.stopGameOverMusicSource();
        this.gameOverMusicPlaybackState = 'idle';
      });
    }
  }

  playVictoryMusicDuringLevelClear() {
    if (!this.audioEnabled || !this.audioUnlocked || !this.audioCtx || !this.victoryMusicGainNode) {
      return;
    }

    if (this.victoryMusicPlaybackState !== 'idle') {
      return;
    }

    this.victoryMusicPlaybackState = 'loading';
    const sessionToken = this.bgmSessionToken;

    this.loadVictoryMusicBuffer()
      .then((buffer) => {
        if (
          !buffer
          || sessionToken !== this.bgmSessionToken
          || !this.levelClearMusicActive
          || !this.audioUnlocked
          || !this.victoryMusicGainNode
        ) {
          if (this.victoryMusicPlaybackState === 'loading') {
            this.victoryMusicPlaybackState = 'idle';
          }
          return;
        }

        this.stopVictoryMusicSource();

        const now = this.audioCtx.currentTime;
        this.victoryMusicGainNode.gain.cancelScheduledValues(now);
        this.victoryMusicGainNode.gain.setValueAtTime(0.0001, now);
        this.victoryMusicGainNode.gain.exponentialRampToValueAtTime(0.95, now + 0.14);

        this.startVictoryMusicPlayback(sessionToken, buffer);
      })
      .catch(() => {
        if (this.victoryMusicPlaybackState === 'loading') {
          this.victoryMusicPlaybackState = 'idle';
        }
      });
  }

  startVictoryMusicPlayback(sessionToken, buffer) {
    if (
      !this.audioCtx
      || !this.victoryMusicGainNode
      || !buffer
      || sessionToken !== this.bgmSessionToken
      || !this.levelClearMusicActive
      || this.isGameOver
      || !this.audioUnlocked
    ) {
      this.victoryMusicPlaybackState = 'idle';
      return;
    }

    this.stopVictoryMusicSource();

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.connect(this.victoryMusicGainNode);

    this.victoryMusicSourceNode = source;
    this.victoryMusicPlaybackState = 'playing';

    source.onended = () => {
      if (this.victoryMusicSourceNode === source) {
        this.victoryMusicSourceNode = null;
      }
      source.disconnect();

      const canRestart = (
        sessionToken === this.bgmSessionToken
        && this.audioCtx
        && this.victoryMusicGainNode
        && this.audioUnlocked
        && this.levelClearMusicActive
        && !this.isGameOver
      );

      if (!canRestart) {
        if (this.victoryMusicPlaybackState === 'playing') {
          this.victoryMusicPlaybackState = 'idle';
        }
        return;
      }

      // Keep replaying the full track from the beginning while victory state is active.
      this.startVictoryMusicPlayback(sessionToken, buffer);
    };

    try {
      source.start(this.audioCtx.currentTime + 0.01, 0);
    } catch {
      this.victoryMusicPlaybackState = 'idle';
      source.onended = null;
      source.disconnect();
      if (this.victoryMusicSourceNode === source) {
        this.victoryMusicSourceNode = null;
      }
    }
  }

  startGameOverMusicTransition() {
    this.levelClearMusicActive = false;
    this.fadeOutAssemblyMusicFast(0.12);
    this.fadeOutVictoryMusicFast(0.1, true);
    this.playGameOverMusicDuringDefeat();
  }

  playGameOverMusicDuringDefeat() {
    if (!this.audioEnabled || !this.audioUnlocked || !this.audioCtx || !this.gameOverMusicGainNode) {
      return;
    }

    if (this.gameOverMusicPlaybackState !== 'idle') {
      return;
    }

    this.gameOverMusicPlaybackState = 'loading';
    const sessionToken = this.bgmSessionToken;

    this.loadGameOverMusicBuffer()
      .then((buffer) => {
        if (
          !buffer
          || sessionToken !== this.bgmSessionToken
          || !this.isGameOver
          || this.sceneTransitioning
          || !this.audioUnlocked
          || !this.gameOverMusicGainNode
        ) {
          if (this.gameOverMusicPlaybackState === 'loading') {
            this.gameOverMusicPlaybackState = 'idle';
          }
          return;
        }

        const now = this.audioCtx.currentTime;
        this.gameOverMusicGainNode.gain.cancelScheduledValues(now);
        this.gameOverMusicGainNode.gain.setValueAtTime(0.0001, now);
        this.gameOverMusicGainNode.gain.exponentialRampToValueAtTime(0.95, now + 0.12);

        this.startGameOverMusicPlayback(sessionToken, buffer);
      })
      .catch(() => {
        if (this.gameOverMusicPlaybackState === 'loading') {
          this.gameOverMusicPlaybackState = 'idle';
        }
      });
  }

  startGameOverMusicPlayback(sessionToken, buffer) {
    if (
      !this.audioCtx
      || !this.gameOverMusicGainNode
      || !buffer
      || sessionToken !== this.bgmSessionToken
      || !this.isGameOver
      || this.sceneTransitioning
      || !this.audioUnlocked
    ) {
      this.gameOverMusicPlaybackState = 'idle';
      return;
    }

    this.stopGameOverMusicSource();

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.connect(this.gameOverMusicGainNode);

    this.gameOverMusicSourceNode = source;
    this.gameOverMusicPlaybackState = 'playing';

    source.onended = () => {
      if (this.gameOverMusicSourceNode === source) {
        this.gameOverMusicSourceNode = null;
      }
      source.disconnect();

      const canRestart = (
        sessionToken === this.bgmSessionToken
        && this.audioCtx
        && this.gameOverMusicGainNode
        && this.audioUnlocked
        && this.isGameOver
        && !this.sceneTransitioning
      );

      if (!canRestart) {
        if (this.gameOverMusicPlaybackState === 'playing') {
          this.gameOverMusicPlaybackState = 'idle';
        }
        return;
      }

      this.startGameOverMusicPlayback(sessionToken, buffer);
    };

    try {
      source.start(this.audioCtx.currentTime + 0.01, 0);
    } catch {
      this.gameOverMusicPlaybackState = 'idle';
      source.onended = null;
      source.disconnect();
      if (this.gameOverMusicSourceNode === source) {
        this.gameOverMusicSourceNode = null;
      }
    }
  }

  startLevelClearMusicTransition() {
    this.levelClearMusicActive = true;
    this.fadeOutAssemblyMusicFast(0.22);

    this.time.delayedCall(240, () => {
      if (!this.levelClearMusicActive || this.isGameOver) {
        return;
      }

      this.playVictoryMusicDuringLevelClear();
    });
  }

  updateAdaptiveBgm({ now, pressure, jamLoad, comboEnergy, comboRise, comboDrop }) {
    if (!this.bgmGainNode || !this.audioCtx) {
      return;
    }

    if (this.levelClearMusicActive) {
      const currentGain = Math.max(0.0001, this.bgmGainNode.gain.value);
      this.bgmGainNode.gain.cancelScheduledValues(now);
      this.bgmGainNode.gain.setValueAtTime(currentGain, now);
      this.bgmGainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      return;
    }

    const speedRange = Math.max(1, this.maxMainSpeed - this.baseMainSpeed);
    const speedPressure = Phaser.Math.Clamp((this.mainSpeed - this.baseMainSpeed) / speedRange, 0, 1);
    const intensity = Phaser.Math.Clamp(
      pressure * 0.44
      + jamLoad * 0.22
      + comboEnergy * 0.24
      + speedPressure * 0.24
      + comboRise * 0.14
      - comboDrop * 0.1,
      0,
      1
    );

    const targetBgmGain = this.audioUnlocked && !this.isGameOver
      ? (this.isDraftActive ? 0.62 : Phaser.Math.Linear(0.95, 1.35, intensity))
      : 0.001;

    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.linearRampToValueAtTime(targetBgmGain, now + 0.16);

    if (this.bgmSourceNode?.playbackRate) {
      const targetRate = this.audioUnlocked && !this.isGameOver
        ? (this.isDraftActive ? 0.98 : Phaser.Math.Linear(0.985, 1.085, intensity))
        : 0.95;

      this.bgmSourceNode.playbackRate.cancelScheduledValues(now);
      this.bgmSourceNode.playbackRate.linearRampToValueAtTime(targetRate, now + 0.18);
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
    const destinationBoost = destination === 'music' ? 1.6 : 1;
    const peakLimit = destination === 'music' ? 1.75 : 1.45;
    const peak = Phaser.Math.Clamp(gain * 2.7 * destinationBoost, 0.0002, peakLimit);

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

    const destinationBoost = destination === 'music' ? 1.45 : 1;
    const peakLimit = destination === 'music' ? 1.95 : 1.7;
    const peak = Phaser.Math.Clamp(Math.max(0.0002, gain * 6 * destinationBoost), 0.0002, peakLimit);
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

  playGrabSfx(intensity = 1) {
    this.playSfx('claw-grab', intensity);
  }

  playClawSqueakSfx(stage = 'move', intensity = 1) {
    if (stage === 'pickup') {
      this.playSfx('claw-pickup', intensity);
      return;
    }

    if (stage === 'drop') {
      this.playSfx('claw-drop', intensity);
      return;
    }

    this.playSfx('claw-move', intensity);
  }

  playSfx(eventId, intensity = 1) {
    const amount = Phaser.Math.Clamp(intensity, 0.2, 2.2);

    // Keep SFX focused on core actions and card interaction feedback.
    if (
      eventId !== 'transfer'
      && eventId !== 'jam'
      && eventId !== 'chest-accept'
      && eventId !== 'combo-tier'
      && eventId !== 'combo-break'
      && eventId !== 'game-over'
      && eventId !== 'swap'
      && eventId !== 'draft-open'
      && eventId !== 'draft-select'
      && eventId !== 'draft-pick'
      && eventId !== 'claw-grab'
      && eventId !== 'claw-pickup'
      && eventId !== 'claw-move'
      && eventId !== 'claw-drop'
    ) {
      return;
    }

    if (eventId === 'claw-grab') {
      this.playSynthTone({
        freq: 420 + Math.random() * 34,
        targetFreq: 168 + Math.random() * 12,
        type: 'square',
        attack: 0.001,
        decay: 0.09,
        gain: 0.095 * amount,
        filterFreq: 1550,
        q: 1.35
      });
      this.playSynthTone({
        freq: 980,
        targetFreq: 740,
        type: 'triangle',
        attack: 0.001,
        decay: 0.046,
        gain: 0.046 * amount,
        filterFreq: 3100,
        q: 0.8
      });
      this.playNoiseBurst({ duration: 0.032, gain: 0.034 * amount, highpass: 1600, lowpass: 8200, destination: 'sfx' });
      return;
    }

    if (eventId === 'claw-pickup') {
      this.playSynthTone({
        freq: 345 + Math.random() * 24,
        targetFreq: 222,
        type: 'triangle',
        attack: 0.001,
        decay: 0.098,
        gain: 0.082 * amount,
        filterFreq: 1750,
        q: 1.25
      });
      this.playNoiseBurst({ duration: 0.038, gain: 0.026 * amount, highpass: 1200, lowpass: 7100, destination: 'sfx' });
      return;
    }

    if (eventId === 'claw-move') {
      const base = 246 + Math.random() * 24;
      this.playSynthTone({
        freq: base,
        targetFreq: base * 1.34,
        type: 'triangle',
        attack: 0.001,
        decay: 0.073,
        gain: 0.072 * amount,
        filterFreq: 2200,
        q: 1.2
      });
      this.playSynthTone({
        freq: base * 1.92,
        targetFreq: base * 1.68,
        type: 'sine',
        attack: 0.001,
        decay: 0.052,
        gain: 0.028 * amount,
        filterFreq: 3200,
        q: 0.7
      });
      this.playNoiseBurst({ duration: 0.02, gain: 0.016 * amount, highpass: 2400, lowpass: 9600, destination: 'sfx' });
      return;
    }

    if (eventId === 'claw-drop') {
      this.playSynthTone({
        freq: 284 + Math.random() * 18,
        targetFreq: 146,
        type: 'square',
        attack: 0.001,
        decay: 0.11,
        gain: 0.086 * amount,
        filterFreq: 1320,
        q: 1.4
      });
      this.playNoiseBurst({ duration: 0.048, gain: 0.03 * amount, highpass: 860, lowpass: 5600, destination: 'sfx' });
      return;
    }

    if (eventId === 'transfer') {
      this.playSynthTone({ freq: 252 + Math.random() * 28, targetFreq: 368, type: 'square', attack: 0.001, decay: 0.07, gain: 0.083 * amount, filterFreq: 2300 });
      this.playDrumHit('hat', 0.78 * amount, 'sfx');
      return;
    }

    if (eventId === 'swap') {
      this.playSynthTone({ freq: 248, targetFreq: 412, type: 'triangle', attack: 0.001, decay: 0.1, gain: 0.083 * amount, filterFreq: 2000 });
      this.playSynthTone({ freq: 412, targetFreq: 580, type: 'sine', attack: 0.001, decay: 0.074, gain: 0.062 * amount, filterFreq: 2850 });
      this.playDrumHit('hat', 0.84 * amount, 'sfx');
      return;
    }

    if (eventId === 'chest-accept') {
      this.playSynthTone({ freq: 360, targetFreq: 640, type: 'triangle', attack: 0.001, decay: 0.125, gain: 0.092 * amount, filterFreq: 2600 });
      this.playSynthTone({ freq: 640, targetFreq: 870, type: 'sine', attack: 0.001, decay: 0.105, gain: 0.073 * amount, filterFreq: 3100 });
      this.playDrumHit('kick', 0.46 * amount, 'sfx');
      return;
    }

    if (eventId === 'combo-tier') {
      this.playDrumHit('kick', 0.88 * amount, 'sfx');
      this.playDrumHit('snare', 0.72 * amount, 'sfx');
      this.playSynthTone({ freq: 280, targetFreq: 560, type: 'sawtooth', attack: 0.001, decay: 0.16, gain: 0.095 * amount, filterFreq: 2300 });
      this.playSynthTone({ freq: 560, targetFreq: 830, type: 'triangle', attack: 0.001, decay: 0.15, gain: 0.08 * amount, filterFreq: 3000 });
      return;
    }

    if (eventId === 'combo-break') {
      this.playSynthTone({ freq: 230, targetFreq: 78, type: 'square', attack: 0.001, decay: 0.24, gain: 0.1 * amount, filterFreq: 900 });
      this.playDrumHit('snare', 0.7 * amount, 'sfx');
      return;
    }

    if (eventId === 'jam') {
      this.playDrumHit('kick', 1.24 * amount, 'sfx');
      this.playDrumHit('snare', 1.06 * amount, 'sfx');
      this.playSynthTone({ freq: 192, targetFreq: 58, type: 'square', attack: 0.001, decay: 0.29, gain: 0.14 * amount, filterFreq: 780, q: 1.25 });
      this.playNoiseBurst({ duration: 0.17, gain: 0.12 * amount, highpass: 860, lowpass: 7800, destination: 'sfx' });
      return;
    }

    if (eventId === 'draft-open') {
      this.playSynthTone({ freq: 180, targetFreq: 560, type: 'sawtooth', attack: 0.004, decay: 0.26, gain: 0.102 * amount, filterFreq: 2050 });
      this.playNoiseBurst({ duration: 0.11, gain: 0.066 * amount, highpass: 2300, lowpass: 12000, destination: 'sfx' });
      return;
    }

    if (eventId === 'draft-select') {
      this.playSynthTone({ freq: 420, targetFreq: 610, type: 'square', attack: 0.001, decay: 0.06, gain: 0.068 * amount, filterFreq: 3000 });
      return;
    }

    if (eventId === 'draft-pick') {
      this.playDrumHit('kick', 0.95 * amount, 'sfx');
      this.playSynthTone({ freq: 260, targetFreq: 640, type: 'triangle', attack: 0.001, decay: 0.21, gain: 0.105 * amount, filterFreq: 2350 });
      this.playSynthTone({ freq: 420, targetFreq: 860, type: 'sine', attack: 0.001, decay: 0.18, gain: 0.083 * amount, filterFreq: 2900 });
      return;
    }

    if (eventId === 'game-over') {
      this.playDrumHit('kick', 1.34 * amount, 'sfx');
      this.playSynthTone({ freq: 210, targetFreq: 54, type: 'square', attack: 0.001, decay: 0.46, gain: 0.14 * amount, filterFreq: 740 });
      this.playNoiseBurst({ duration: 0.24, gain: 0.125 * amount, highpass: 420, lowpass: 5600, destination: 'sfx' });
    }
  }

  triggerMusicBeat({
    pressure,
    jamLoad,
    comboEnergy = 0,
    comboTier = 0,
    comboRise = 0,
    comboDrop = 0
  }) {
    const step = this.musicStepIndex;
    this.musicStepIndex += 1;

    const barStep = step % 16;
    const barIndex = Math.floor(step / 16) % 4;
    const darkRootPattern = [55, 65.41, 49, 73.42];
    const brightRootPattern = [61.74, 73.42, 55, 82.41];

    const dangerMix = Phaser.Math.Clamp(pressure * 0.55 + jamLoad * 0.75 - comboEnergy * 0.24, 0, 1);
    const flowMix = Phaser.Math.Clamp(pressure * 0.35 + comboEnergy * 0.78 + comboRise * 0.34 - jamLoad * 0.2, 0, 1);
    const paletteMix = Phaser.Math.Clamp(flowMix * 0.78 + (1 - dangerMix) * 0.22, 0, 1);
    const semitoneBoost = Phaser.Math.Clamp(comboTier * 1.4 + comboEnergy * 2.2 - comboDrop * 2.6, -2, 7);

    const baseRoot = Phaser.Math.Linear(darkRootPattern[barIndex], brightRootPattern[barIndex], paletteMix);
    const root = baseRoot * Math.pow(2, semitoneBoost / 12);

    const drumDrive = Phaser.Math.Clamp(0.62 + dangerMix * 0.38 + comboEnergy * 0.16 + comboRise * 0.24, 0.45, 1.55);

    if (barStep % 4 === 0 || (pressure > 0.62 && barStep % 8 === 6)) {
      this.playDrumHit('kick', drumDrive, 'music');
    }
    if (barStep % 8 === 4) {
      this.playDrumHit('snare', 0.66 + jamLoad * 0.64 + comboDrop * 0.28, 'music');
    }
    if (barStep % 2 === 1) {
      this.playDrumHit('hat', 0.3 + pressure * 0.34 + comboEnergy * 0.22 + comboRise * 0.2, 'music');
    }
    if (comboEnergy > 0.45 && barStep % 4 === 1) {
      this.playDrumHit('hat', 0.36 + comboEnergy * 0.3, 'music');
    }

    if (barStep % 2 === 0) {
      const bassFreq = root * (barStep % 8 < 4 ? 1 : Phaser.Math.Linear(1.08, 1.16, flowMix));
      this.playSynthTone({
        freq: bassFreq,
        targetFreq: bassFreq * Phaser.Math.Linear(0.88, 0.96, flowMix),
        type: 'sawtooth',
        attack: 0.002,
        decay: 0.24,
        gain: 0.052 + dangerMix * 0.036 + comboEnergy * 0.02,
        filterFreq: 320 + pressure * 280 + comboEnergy * 220,
        destination: 'music'
      });
    }

    if (barStep % 8 === 0) {
      const chordRoot = root * 2;
      const chordIntervals = comboEnergy > 0.42
        ? [1, 1.2599, 1.4983]
        : [1, 1.1892, 1.4983];

      this.playSynthTone({
        freq: chordRoot,
        targetFreq: chordRoot * 0.98,
        type: 'triangle',
        attack: 0.002,
        decay: 0.18,
        gain: 0.04 + flowMix * 0.025,
        filterFreq: 1450 + flowMix * 900,
        destination: 'music'
      });
      this.playSynthTone({
        freq: chordRoot * chordIntervals[1],
        targetFreq: chordRoot * chordIntervals[1] * 0.99,
        type: 'triangle',
        attack: 0.002,
        decay: 0.18,
        gain: 0.03 + flowMix * 0.022,
        filterFreq: 1650 + flowMix * 900,
        destination: 'music'
      });
      this.playSynthTone({
        freq: chordRoot * chordIntervals[2],
        targetFreq: chordRoot * chordIntervals[2] * 0.99,
        type: 'triangle',
        attack: 0.002,
        decay: 0.16,
        gain: 0.026 + flowMix * 0.019,
        filterFreq: 1850 + flowMix * 900,
        destination: 'music'
      });
    }

    if (flowMix > 0.3 && barStep % 4 === 2) {
      this.playSynthTone({
        freq: root * Phaser.Math.Linear(3.2, 4.2, flowMix),
        targetFreq: root * Phaser.Math.Linear(2.1, 2.5, flowMix),
        type: 'square',
        attack: 0.001,
        decay: 0.07,
        gain: 0.022 + flowMix * 0.038 + comboRise * 0.02,
        filterFreq: 2000 + flowMix * 800,
        destination: 'music'
      });
    }

    if (comboDrop > 0.08 && barStep % 8 === 1) {
      this.playSynthTone({
        freq: root * 2.15,
        targetFreq: root * 1.2,
        type: 'square',
        attack: 0.001,
        decay: 0.11,
        gain: 0.035 + comboDrop * 0.045,
        filterFreq: 1300,
        q: 1.1,
        destination: 'music'
      });
    }

    if (jamLoad > 0.25 && barStep % 4 === 3) {
      this.playNoiseBurst({
        duration: 0.07 + jamLoad * 0.03,
        gain: 0.025 + jamLoad * 0.04,
        highpass: 2200,
        lowpass: 9000 - comboEnergy * 1600,
        destination: 'music'
      });
    }

    this.rhythmPulseMs = Math.max(this.rhythmPulseMs, 110 + comboEnergy * 44 + comboRise * 40);
  }

  updateAudio(deltaMs) {
    if (deltaMs <= 0) {
      return;
    }

    this.rhythmPulseMs = Math.max(0, this.rhythmPulseMs - deltaMs);
    this.musicComboRisePulseMs = Math.max(0, this.musicComboRisePulseMs - deltaMs);
    this.musicComboDropPulseMs = Math.max(0, this.musicComboDropPulseMs - deltaMs);

    if (!this.audioEnabled || !this.audioCtx || !this.audioMasterGain || !this.audioMusicGain) {
      return;
    }

    if (!this.audioUnlocked && this.audioCtx.state === 'running') {
      this.audioUnlocked = true;
    }

    const pressure = Phaser.Math.Clamp(this.currentPressure || 0, 0, 1);
    const jammedCount = this.items.reduce((count, item) => count + (item.state === 'jammed' ? 1 : 0), 0);
    const jamLoad = Phaser.Math.Clamp(jammedCount / Math.max(1, this.laneLayout.length * 2), 0, 1);
    const comboEnergy = Phaser.Math.Clamp((this.multiplier - 1) / Math.max(1, this.maxMultiplier - 1), 0, 1);
    const comboTier = Phaser.Math.Clamp(this.comboMilestoneTier || Math.floor(this.multiplier / 5), 0, 6);
    const comboRise = Phaser.Math.Clamp(this.musicComboRisePulseMs / 420, 0, 1);
    const comboDrop = Phaser.Math.Clamp(this.musicComboDropPulseMs / 420, 0, 1);
    const now = this.audioCtx.currentTime;

    const targetMaster = this.isGameOver ? 0.74 : 1.08;
    this.audioMasterGain.gain.cancelScheduledValues(now);
    this.audioMasterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.12);

    if (this.audioMasterTone?.frequency) {
      const toneTarget = this.isGameOver
        ? 5200
        : Phaser.Math.Linear(7600, 13800, Phaser.Math.Clamp(comboEnergy * 0.62 + (1 - jamLoad) * 0.22 + (1 - pressure) * 0.16, 0, 1));
      this.audioMasterTone.frequency.cancelScheduledValues(now);
      this.audioMasterTone.frequency.linearRampToValueAtTime(toneTarget, now + 0.16);
    }

    const targetSfxGain = this.audioUnlocked && !this.isGameOver
      ? 0.78 + pressure * 0.24
      : 0.72;
    this.audioSfxGain.gain.cancelScheduledValues(now);
    this.audioSfxGain.gain.linearRampToValueAtTime(targetSfxGain, now + 0.12);

    const hasGameOverMusic = this.isGameOver && this.gameOverMusicPlaybackState !== 'idle';
    const targetMusicGain = this.audioUnlocked && (!this.isGameOver || hasGameOverMusic)
      ? (
        hasGameOverMusic
          ? 0.98
          : (this.isDraftActive
            ? 0.72
            : Phaser.Math.Clamp(0.96 + pressure * 0.24 + jamLoad * 0.16 + comboEnergy * 0.2 + comboRise * 0.08 - comboDrop * 0.06, 0.82, 1.45))
      )
      : 0.001;
    this.audioMusicGain.gain.cancelScheduledValues(now);
    this.audioMusicGain.gain.linearRampToValueAtTime(targetMusicGain, now + 0.12);

    this.ensureBgmPlayback();
    this.updateAdaptiveBgm({ now, pressure, jamLoad, comboEnergy, comboRise, comboDrop });

    if (!this.audioUnlocked || this.isGameOver || !this.musicReactiveLayerEnabled) {
      return;
    }

    const grooveIntensity = Phaser.Math.Clamp(
      pressure * 0.52 + jamLoad * 0.48 + comboEnergy * 0.5 + comboRise * 0.3 - comboDrop * 0.2,
      0,
      1
    );
    const bpm = Phaser.Math.Linear(94, 176, grooveIntensity);
    this.musicBeatMs = 60000 / bpm;
    this.musicBeatTimerMs += deltaMs;

    let beatSafety = 0;
    while (this.musicBeatTimerMs >= this.musicBeatMs && beatSafety < 10) {
      beatSafety += 1;
      this.musicBeatTimerMs -= this.musicBeatMs;
      this.triggerMusicBeat({ pressure, jamLoad, comboEnergy, comboTier, comboRise, comboDrop });
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

    this.add
      .rectangle(182, 130, 334, 36, 0x4a2012, 0.9)
      .setStrokeStyle(1, 0xf0bd85, 0.95)
      .setDepth(299);
    this.add.rectangle(24, 130, 10, 36, 0x34d399, 0.84).setDepth(300);

    this.pressureText = this.add
      .text(34, 113, '', {
        fontFamily: GAME_UI_FONT,
        fontSize: '24px',
        color: '#ffe9c7'
      })
      .setDepth(300)
      .setLetterSpacing(0.8)
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
      .text(0, 0, 'EFFECTS', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '30px',
        color: '#ffeed6'
      })
      .setDepth(305)
      .setOrigin(1, 0)
      .setLetterSpacing(1.4);
    this.effectHudRows = [];
  }

  buildCardCatalog() {
    return [
      {
        id: 'coolant_flush',
        name: 'Coolant Flush',
        archetype: 'rescue',
        rarity: 'common',
        description: 'Reset speed, smooth ramp.',
        note: 'Reset then recover.'
      },
      {
        id: 'smart_sort_protocol',
        name: 'Smart Sort Protocol',
        archetype: 'rescue',
        rarity: 'rare',
        description: 'Auto-sort and clear line.',
        note: 'Fast reset.'
      },
      {
        id: 'emergency_brake',
        name: 'Emergency Brake',
        archetype: 'rescue',
        rarity: 'common',
        description: 'Slow time for 7s.',
        note: 'Score penalty after.'
      },
      {
        id: 'overflow_purge',
        name: 'Overflow Purge',
        archetype: 'rescue',
        rarity: 'rare',
        description: 'Purge up to 5 jams.',
        note: 'Costs score.'
      },
      {
        id: 'inserter_calibration',
        name: 'Inserter Calibration',
        archetype: 'control',
        rarity: 'common',
        description: 'Prioritize correct routing.',
        note: 'Safer side flow.'
      },
      {
        id: 'chest_priority_mode',
        name: 'Chest Priority Mode',
        archetype: 'control',
        rarity: 'common',
        description: 'Chest forgiveness on.',
        note: 'Auto clear + accept for 15s.'
      },
      {
        id: 'belt_rephase',
        name: 'Belt Rephase',
        archetype: 'control',
        rarity: 'common',
        description: 'Wider side spacing for 12s.',
        note: 'Main belt gets faster.'
      },
      {
        id: 'predictive_pull',
        name: 'Predictive Pull',
        archetype: 'control',
        rarity: 'rare',
        description: 'Bias next 20 spawns.',
        note: '8% faster spawns.'
      },
      {
        id: 'turbo_shift',
        name: 'Turbo Shift',
        archetype: 'greed',
        rarity: 'rare',
        description: 'More score, more speed.',
        note: '+25% score for 18s.'
      },
      {
        id: 'combo_furnace',
        name: 'Combo Furnace',
        archetype: 'greed',
        rarity: 'rare',
        description: 'Combo grows faster.',
        note: 'One jam hurts more.'
      },
      {
        id: 'risky_throughput',
        name: 'Risky Throughput',
        archetype: 'greed',
        rarity: 'common',
        description: 'Spawn rate up for 16s.',
        note: 'Extra score per hit.'
      },
      {
        id: 'fragile_jackpot',
        name: 'Fragile Jackpot',
        archetype: 'greed',
        rarity: 'epic',
        description: 'Instant points, fragile control.',
        note: 'No drag slow-mo for 10s.'
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
          fontFamily: GAME_UI_FONT,
          fontSize: '20px',
          color: '#ffeedd'
        })
        .setLetterSpacing(0.5)
        .setDepth(305);

      const valueText = this.add
        .text(0, 0, '', {
          fontFamily: GAME_UI_FONT,
          fontSize: '18px',
          color: '#ffd8ad'
        })
        .setDepth(305)
        .setLetterSpacing(0.5)
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
    const panelWidth = 378;
    const panelLeft = panelRight - panelWidth;
    const padding = 12;
    const titleHeight = 28;
    const rowHeight = 38;
    const barHeight = 8;
    const panelHeight = padding + titleHeight + 10 + entries.length * rowHeight + 10;

    this.effectHudGraphics.fillStyle(0x4a2012, 0.88);
    this.effectHudGraphics.fillRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 12);
    this.effectHudGraphics.lineStyle(2, 0xf0bd85, 0.92);
    this.effectHudGraphics.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 12);
    this.effectHudGraphics.fillStyle(0x34d399, 0.82);
    this.effectHudGraphics.fillRoundedRect(panelLeft + 8, panelTop + 8, 8, panelHeight - 16, 4);
    this.effectHudGraphics.fillStyle(0xffffff, 0.1);
    this.effectHudGraphics.fillRoundedRect(panelLeft + 20, panelTop + 8, panelWidth - 28, 30, 6);

    this.effectHudTitle.setVisible(true);
    this.effectHudTitle.setPosition(panelRight - padding, panelTop + 8);

    this.ensureEffectHudRows(entries.length);

    const barX = panelLeft + padding + 8;
    const barWidth = panelWidth - (padding + 8) * 2;

    entries.forEach((entry, index) => {
      const rowTop = panelTop + padding + titleHeight + 10 + index * rowHeight;
      const barY = rowTop + 24;

      const row = this.effectHudRows[index];
      row.labelText.setVisible(true);
      row.valueText.setVisible(true);
      row.labelText.setPosition(barX, rowTop);
      row.valueText.setPosition(panelRight - padding, rowTop);
      row.labelText.setText(entry.label);
      row.valueText.setText(entry.value);

      this.effectHudGraphics.fillStyle(0x6b3418, 0.96);
      this.effectHudGraphics.fillRoundedRect(barX, barY, barWidth, barHeight, 4);

      const clampedProgress = Phaser.Math.Clamp(entry.progress ?? 0, 0, 1);
      let fillWidth = Math.floor(barWidth * clampedProgress);
      if (clampedProgress > 0 && fillWidth < 2) {
        fillWidth = 2;
      }

      if (fillWidth > 0) {
        this.effectHudGraphics.fillStyle(entry.color ?? 0x38bdf8, 1);
        this.effectHudGraphics.fillRoundedRect(barX, barY, fillWidth, barHeight, 4);
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

    const laneIdByFoodType = this.laneLayout.reduce((acc, lane) => {
      acc[lane.desiredType] = lane.id;
      return acc;
    }, {});

    const laneBuckets = this.laneLayout.reduce((acc, lane) => {
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

    for (const laneConfig of this.laneLayout) {
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
    this.chestPriorityChargesByLaneId = this.laneLayout.reduce((acc, lane) => {
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

    return this.laneLayout.length;
  }

  calculatePressureSnapshot() {
    const laneCount = Math.max(1, this.laneLayout.length);

    const mainItemCount = this.items.filter((item) => item.state === 'main' || item.state === 'stopped-main').length;
    const mainCapacity = Math.max(1, Math.floor(this.mainLength / Math.max(1, this.itemSpacing)));
    const mainFill = Phaser.Math.Clamp(mainItemCount / mainCapacity, 0, 1);

    const blockedIntakes = this.laneLayout.reduce((count, lane) => count + (this.canEnterLane(lane.id) ? 0 : 1), 0);
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
    const scrim = this.add.rectangle(640, 360, 1280, 720, 0x1b0905, 0.76).setInteractive();
    scrim.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
    });

    const leftGlow = this.add.circle(298, 184, 250, 0xf59e0b, 0.14).setBlendMode(Phaser.BlendModes.ADD);
    const rightGlow = this.add.circle(994, 560, 270, 0x34d399, 0.1).setBlendMode(Phaser.BlendModes.ADD);
    const panelShadow = this.add.rectangle(640, 368, 1168, 530, 0x1b0905, 0.56);
    const panel = this.add.rectangle(640, 360, 1168, 530, 0x4a2012, 0.96).setStrokeStyle(2, 0xf0bd85, 1);
    const topStrip = this.add.rectangle(640, 136, 1124, 34, 0xffffff, 0.14);

    const title = this.add
      .text(640, 146, 'PICK A BOOST', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '62px',
        color: '#fff0d9'
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.6);

    const reasonLabel = this.add
      .text(640, 196, `${this.formatDraftTrigger(triggerType)} · ${Math.round(this.currentPressure * 100)}%`, {
        fontFamily: GAME_UI_FONT,
        fontSize: '30px',
        color: '#ffd7ab'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.8);

    const helper = this.add
      .text(640, 602, 'Pick 1', {
        fontFamily: GAME_UI_FONT,
        fontSize: '24px',
        color: '#ffe0be'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.8);

    leftGlow.setAlpha(0);
    rightGlow.setAlpha(0);
    panelShadow.setAlpha(0);
    panel.setAlpha(0);
    panel.setScale(0.96);
    topStrip.setAlpha(0);
    title.setAlpha(0);
    reasonLabel.setAlpha(0);
    helper.setAlpha(0);

    container.add([scrim, leftGlow, rightGlow, panelShadow, panel, topStrip, title, reasonLabel, helper]);

    const cardWidth = 332;
    const cardHeight = 286;
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
      targets: [leftGlow, rightGlow, panelShadow, panel, topStrip, title, reasonLabel, helper],
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
      rescue: 0x34d399,
      control: 0xf59e0b,
      greed: 0xfb7185
    };

    const rarityColorById = {
      common: 0xe7a25e,
      rare: 0xf59e0b,
      epic: 0xfb7185
    };

    const archetypeColor = archetypeColorById[card.archetype] ?? 0x94a3b8;
    const rarityColor = rarityColorById[card.rarity] ?? 0x93c5fd;

    const cardShadow = this.add.rectangle(x, y + 8, width, height, 0x1b0905, 0.56);

    const cardBg = this.add
      .rectangle(x, y, width, height, 0x7a4327, 0.95)
      .setStrokeStyle(2, archetypeColor, 1)
      .setInteractive({ useHandCursor: true });
    const topStrip = this.add.rectangle(x, y - height * 0.5 + 20, width - 20, 26, archetypeColor, 0.2);
    const rarityChip = this.add
      .rectangle(x + width * 0.5 - 56, y - height * 0.5 + 20, 92, 22, 0xffedd2, 0.95)
      .setStrokeStyle(1, rarityColor, 0.9);

    const rarityLabel = this.add
      .text(rarityChip.x, rarityChip.y, card.rarity.toUpperCase(), {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '18px',
        color: '#7a3f24'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.8);

    cardBg.setAlpha(0);
    cardBg.setScale(0.9);
    cardShadow.setAlpha(0);
    topStrip.setAlpha(0);
    rarityChip.setAlpha(0);
    rarityLabel.setAlpha(0);

    const archetype = this.add
      .text(x - width * 0.5 + 18, y - 106, card.archetype.toUpperCase(), {
        fontFamily: GAME_UI_FONT,
        fontSize: '22px',
        color: '#ffe5c5'
      })
      .setOrigin(0, 0.5)
      .setLetterSpacing(0.7)
      .setAlpha(0);

    const nameWrapWidth = width - 42;
    const baseNameFontSize = 36;
    const minNameFontSize = 30;

    const name = this.add
      .text(x, y - 46, card.name, {
        fontFamily: GAME_UI_FONT,
        fontSize: `${baseNameFontSize}px`,
        color: '#fff8ec',
        align: 'center',
        wordWrap: { width: nameWrapWidth }
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);

    let fittedNameFontSize = baseNameFontSize;
    let wrappedNameLines = name.getWrappedText(card.name);
    while (wrappedNameLines.length > 1 && fittedNameFontSize > minNameFontSize) {
      fittedNameFontSize -= 1;
      name.setFontSize(`${fittedNameFontSize}px`);
      wrappedNameLines = name.getWrappedText(card.name);
    }

    const description = this.add
      .text(x, y + 18, card.description, {
        fontFamily: GAME_UI_FONT,
        fontSize: '20px',
        color: '#ffe2c5',
        align: 'center',
        wordWrap: { width: width - 42 }
      })
      .setOrigin(0.5, 0.5)
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

    container.add([cardShadow, cardBg, topStrip, rarityChip, rarityLabel, archetype, name, description]);
    this.cardDraftEntries.push({ cardBg, cardShadow, topStrip, rarityChip, rarityLabel, archetypeColor, selectionTween: null });

    const enterDelay = 80 + index * 70;
    this.tweens.add({
      targets: [cardShadow, cardBg, topStrip, rarityChip, rarityLabel, archetype, name, description],
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
      const strokeColor = selected ? 0xffeed4 : entry.archetypeColor;
      const fillColor = selected ? 0x9a5831 : 0x7a4327;

      entry.cardBg.setFillStyle(fillColor, 0.96);
      entry.cardBg.setStrokeStyle(selected ? 4 : 2, strokeColor, 1);
      entry.topStrip.setFillStyle(entry.archetypeColor, selected ? 0.42 : 0.2);
      entry.rarityChip.setAlpha(selected ? 1 : 0.86);
      entry.rarityLabel.setAlpha(selected ? 1 : 0.86);

      if (entry.selectionTween) {
        entry.selectionTween.remove();
        entry.selectionTween = null;
      }

      entry.selectionTween = this.tweens.add({
        targets: [entry.cardBg, entry.cardShadow, entry.topStrip, entry.rarityChip, entry.rarityLabel],
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
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '44px',
        color: '#f1f8ff'
      })
      .setDepth(320)
      .setOrigin(0.5)
      .setLetterSpacing(1.5)
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
      return 'Rush';
    }
    if (triggerType === 'score') {
      return 'Milestone';
    }
    if (triggerType === 'pity') {
      return 'Mercy';
    }

    return 'Boost';
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

    this.bloodParticles = this.add
      .particles(0, 0, particleTextureKey, {
        frequency: -1,
        quantity: 0,
        lifespan: { min: 280, max: 540 },
        speed: { min: 120, max: 360 },
        angle: { min: 0, max: 360 },
        gravityY: 640,
        scale: { start: 0.72, end: 0.08 },
        alpha: { start: 0.95, end: 0 },
        blendMode: 'NORMAL'
      })
      .setDepth(62);
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

  emitBloodParticles(x, y, intensity = 1) {
    if (!this.bloodParticles) {
      return;
    }

    const clampedIntensity = Phaser.Math.Clamp(intensity, 0.6, 2.4);
    const quantity = Math.round(18 * clampedIntensity);
    this.bloodParticles.setParticleTint(0x7f1d1d, 0x991b1b, 0xb91c1c, 0xef4444);
    this.bloodParticles.explode(quantity, x, y);
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
        fontFamily: GAME_UI_FONT,
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
    const baseX = 24;
    const baseY = 18;
    const shadow = { offsetX: 0, offsetY: 2, color: '#000000', blur: 8 };

    this.add
      .rectangle(192, 58, 352, 92, 0x4a2012, 0.9)
      .setDepth(298)
      .setStrokeStyle(1, 0xf0bd85, 0.95);
    this.add.rectangle(22, 58, 8, 92, 0x34d399, 0.85).setDepth(299);
    this.add
      .rectangle(640, 694, 516, 44, 0x4a2012, 0.88)
      .setDepth(298)
      .setStrokeStyle(1, 0xf0bd85, 0.9);

    this.levelInfoText = this.add
      .text(640, 694, '', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '34px',
        color: '#ffe6c5',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setLetterSpacing(2)
      .setShadow(shadow.offsetX, shadow.offsetY, shadow.color, shadow.blur);

    this.quotaText = this.add
      .text(baseX, baseY, '', {
        fontFamily: GAME_UI_FONT,
        fontSize: '22px',
        color: '#d4f7e6'
      })
      .setDepth(300)
      .setLetterSpacing(0.8)
      .setShadow(shadow.offsetX, shadow.offsetY, shadow.color, shadow.blur);

    this.scoreText = this.add
      .text(baseX, baseY + 28, '', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '34px',
        color: '#fff9ef'
      })
      .setDepth(300)
      .setLetterSpacing(1.5)
      .setShadow(shadow.offsetX, shadow.offsetY, shadow.color, shadow.blur);

    this.multiplierText = this.add
      .text(baseX + 216, baseY + 3, '', {
        fontFamily: GAME_UI_FONT,
        fontSize: '22px',
        color: '#ffd8ad'
      })
      .setOrigin(0, 0)
      .setDepth(300)
      .setLetterSpacing(0.8)
      .setShadow(shadow.offsetX, shadow.offsetY, shadow.color, shadow.blur);

    this.refreshScoreUi();
  }

  createPauseUi() {
    const container = this.add.container(640, 46).setDepth(305);
    const shadow = this.add.circle(0, 3, 25, 0x1b0905, 0.42);
    const body = this.add
      .circle(0, 0, 24, 0x4a2012, 0.98)
      .setStrokeStyle(2, 0xf0bd85, 1)
      .setInteractive({ useHandCursor: true });
    const gloss = this.add.ellipse(0, -8, 30, 11, 0xffffff, 0.2);
    const leftBar = this.add.rectangle(-5.5, 0, 4, 14, 0xfff0dc, 1);
    const rightBar = this.add.rectangle(5.5, 0, 4, 14, 0xfff0dc, 1);

    container.add([shadow, body, gloss, leftBar, rightBar]);

    body.on('pointerover', () => {
      if (this.isPaused || this.pauseTransitionLock || this.isGameOver || this.levelComplete || this.isDraftActive) {
        return;
      }

      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 90,
        ease: 'Quad.Out'
      });
    });

    body.on('pointerout', () => {
      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 110,
        ease: 'Quad.Out'
      });
    });

    body.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
      this.handlePauseButtonPressed();
    });

    this.pauseButtonContainer = container;
    this.pauseButtonBody = body;
    this.pauseButtonBars = [leftBar, rightBar];
  }

  handlePauseButtonPressed() {
    if (
      this.isPaused
      || this.pauseTransitionLock
      || this.isGameOver
      || this.levelComplete
      || this.isDraftActive
    ) {
      return;
    }

    this.pauseTransitionLock = true;
    this.isPaused = true;
    this.abortActiveDrag();

    if (!this.pauseButtonContainer?.active) {
      this.pauseTransitionLock = false;
      this.openPauseMenu();
      return;
    }

    this.tweens.killTweensOf(this.pauseButtonContainer);
    this.pauseButtonBars.forEach((bar) => this.tweens.killTweensOf(bar));

    this.tweens.add({
      targets: this.pauseButtonContainer,
      scaleX: 0.86,
      scaleY: 0.86,
      duration: 85,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        this.openPauseMenu();
        this.pauseTransitionLock = false;
      }
    });

    this.tweens.add({
      targets: this.pauseButtonBars,
      scaleY: 0.72,
      duration: 85,
      yoyo: true,
      ease: 'Quad.Out'
    });
  }

  openPauseMenu() {
    if (!this.isPaused || this.pauseMenuContainer?.active) {
      return;
    }

    const container = this.add.container(0, 0).setDepth(370);
    const scrim = this.add.rectangle(640, 360, 1280, 720, 0x1b0905, 0.72).setInteractive();
    scrim.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
    });

    const glowTop = this.add.circle(640, 130, 240, 0xf59e0b, 0.14).setBlendMode(Phaser.BlendModes.ADD);
    const glowBottom = this.add.circle(640, 575, 280, 0x34d399, 0.1).setBlendMode(Phaser.BlendModes.ADD);

    const panelShadow = this.add.rectangle(640, 364, 472, 412, 0x1b0905, 0.52);
    const panel = this.add.rectangle(640, 356, 472, 412, 0x4a2012, 0.97).setStrokeStyle(2, 0xf0bd85, 1);
    const topStrip = this.add.rectangle(640, 205, 430, 36, 0xffffff, 0.14);

    const pausedLabel = this.add
      .text(640, 208, 'Paused', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '56px',
        color: '#fff0d9',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.6)
      .setShadow(0, 3, '#000000', 10);

    container.add([scrim, glowTop, glowBottom, panelShadow, panel, topStrip, pausedLabel]);

    this.createPauseMenuEntry(container, 'Resume', 290, 0x34d399, () => this.resumeFromPause());
    this.createPauseMenuEntry(container, 'Restart', 372, 0xf59e0b, () => this.restartFromPause());
    this.createPauseMenuEntry(container, 'Exit', 454, 0xfb7185, () => this.exitFromPause());

    container.setAlpha(0);
    panel.setScale(0.95);

    this.tweens.add({
      targets: [container, panel],
      alpha: 1,
      duration: 160,
      ease: 'Quad.Out'
    });
    this.tweens.add({
      targets: panel,
      scaleX: 1,
      scaleY: 1,
      duration: 190,
      ease: 'Back.Out'
    });

    this.pauseMenuContainer = container;
  }

  createPauseMenuEntry(container, label, y, accentColor, onSelect, entryStyle = {}) {
    const bodyColor = Number.isFinite(entryStyle.bodyColor) ? entryStyle.bodyColor : 0x7a4327;
    const bodyHoverColor = Number.isFinite(entryStyle.bodyHoverColor) ? entryStyle.bodyHoverColor : 0x915131;
    const glossAlpha = Number.isFinite(entryStyle.glossAlpha)
      ? Phaser.Math.Clamp(entryStyle.glossAlpha, 0, 1)
      : 0.14;
    const textColor = typeof entryStyle.textColor === 'string' ? entryStyle.textColor : '#fff4e8';
    const textShadowColor = typeof entryStyle.textShadowColor === 'string' ? entryStyle.textShadowColor : '#6b3418';

    const entry = this.add.container(640, y);

    const shadowMid = this.add.rectangle(0, 7, 340, 68, 0x1b0905, 0.42);
    const shadowLeft = this.add.circle(-170, 7, 34, 0x1b0905, 0.42);
    const shadowRight = this.add.circle(170, 7, 34, 0x1b0905, 0.42);

    const bodyMid = this.add.rectangle(0, 0, 340, 68, bodyColor, 1);
    const bodyLeft = this.add.circle(-170, 0, 34, bodyColor, 1);
    const bodyRight = this.add.circle(170, 0, 34, bodyColor, 1);
    const glossMid = this.add.rectangle(0, -14, 312, 20, 0xffffff, glossAlpha);
    const glossLeft = this.add.circle(-156, -14, 10, 0xffffff, glossAlpha);
    const glossRight = this.add.circle(156, -14, 10, 0xffffff, glossAlpha);
    const accentDot = this.add.circle(-142, 0, 8, accentColor, 1);

    const text = this.add
      .text(0, 0, label, {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '42px',
          color: textColor,
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.2)
      .setShadow(0, 2, textShadowColor, 4);

    const hitArea = this.add.zone(0, 0, 390, 84).setInteractive({ useHandCursor: true });

    const setHighlighted = (highlighted) => {
      const fill = highlighted ? bodyHoverColor : bodyColor;
      bodyMid.setFillStyle(fill, 1);
      bodyLeft.setFillStyle(fill, 1);
      bodyRight.setFillStyle(fill, 1);
      accentDot.setScale(highlighted ? 1.24 : 1);
      text.setScale(highlighted ? 1.03 : 1);
    };

    hitArea.on('pointerover', () => {
      if (this.pauseTransitionLock) {
        return;
      }
      setHighlighted(true);
    });

    hitArea.on('pointerout', () => {
      setHighlighted(false);
    });

    hitArea.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
      if (this.pauseTransitionLock) {
        return;
      }

      this.pauseTransitionLock = true;
      this.tweens.killTweensOf(entry);
      this.tweens.add({
        targets: entry,
        scaleX: 0.94,
        scaleY: 0.94,
        duration: 80,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => {
          onSelect();
        }
      });
    });

    entry.add([
      shadowMid,
      shadowLeft,
      shadowRight,
      bodyMid,
      bodyLeft,
      bodyRight,
      glossMid,
      glossLeft,
      glossRight,
      accentDot,
      text,
      hitArea
    ]);
    container.add(entry);

    entry.setAlpha(0);
    entry.y += 10;
    this.tweens.add({
      targets: entry,
      alpha: 1,
      y: y,
      duration: 160,
      ease: 'Quad.Out'
    });

    return entry;
  }

  closePauseMenu(animate = true, onComplete = null) {
    const complete = () => {
      this.pauseMenuContainer = null;
      if (typeof onComplete === 'function') {
        onComplete();
      }
    };

    const menu = this.pauseMenuContainer;
    if (!menu?.active) {
      complete();
      return;
    }

    if (!animate) {
      menu.destroy(true);
      complete();
      return;
    }

    this.tweens.add({
      targets: menu,
      alpha: 0,
      duration: 140,
      ease: 'Quad.In',
      onComplete: () => {
        menu.destroy(true);
        complete();
      }
    });
  }

  resumeFromPause() {
    if (!this.isPaused) {
      this.pauseTransitionLock = false;
      return;
    }

    this.closePauseMenu(true, () => {
      this.isPaused = false;
      this.pauseTransitionLock = false;
    });
  }

  restartFromPause() {
    if (this.sceneTransitioning) {
      return;
    }

    this.isPaused = false;
    this.sceneTransitioning = true;
    this.closePauseMenu(false, () => {
      this.playSceneWipeTransition(() => {
        this.pauseTransitionLock = false;
        this.startLoadingGameplay(this.levelId, 'Restarting Shift');
      });
    });
  }

  exitFromPause() {
    if (this.sceneTransitioning) {
      return;
    }

    this.isPaused = false;
    this.closePauseMenu(false, () => {
      this.pauseTransitionLock = false;

      if (this.levelMode === 'endless') {
        this.scene.start('MainMenuScene');
        return;
      }

      this.scene.start('LevelSelectScene', { selectedLevelId: this.levelId });
    });
  }

  playSceneWipeTransition(onComplete = null, options = {}) {
    const wipeColor = Number.isFinite(options.color) ? options.color : 0x1b0905;
    const accentColor = Number.isFinite(options.accentColor) ? options.accentColor : 0xf59e0b;
    const durationMs = Phaser.Math.Clamp(Number(options.durationMs) || 250, 120, 700);

    const wipe = this.add.rectangle(0, 360, 0, 720, wipeColor, 1).setOrigin(0, 0.5).setDepth(460);
    const accent = this.add.rectangle(0, 360, 0, 720, accentColor, 0.14).setOrigin(0, 0.5).setDepth(461);

    this.tweens.add({
      targets: [wipe, accent],
      displayWidth: 1280,
      duration: durationMs,
      ease: 'Cubic.In',
      onComplete: () => {
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    });
  }

  startLoadingGameplay(levelId, loadingLabel = 'Prepping Shift') {
    this.scene.start('LoadingScene', {
      targetSceneKey: 'GameScene',
      targetData: { levelId },
      loadingLabel,
      readyLabel: 'Shift Ready'
    });
  }

  refreshScoreUi() {
    if (this.levelInfoText) {
      this.levelInfoText.setText(this.levelName);
    }

    if (this.quotaText) {
      if (this.isFiniteLevel) {
        this.quotaText.setText(`BOX ${this.acceptedCount}/${this.levelQuota}`);
      } else {
        this.quotaText.setText(`BOX ${this.acceptedCount}`);
      }
    }

    if (this.scoreText) {
      this.scoreText.setText(`SCORE ${this.score}`);
    }
    if (this.multiplierText) {
      this.multiplierText.setText(`x${this.multiplier}`);
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
    this.musicComboRisePulseMs = Math.min(520, this.musicComboRisePulseMs + 90 + multiplierGain * 18);

    this.refreshScoreUi();
    this.bumpUiText(this.scoreText, 1.06, 85);
    this.bumpUiText(this.multiplierText, 1.22, 105);

    const milestoneTier = Math.floor(this.multiplier / 5);
    if (milestoneTier > this.comboMilestoneTier) {
      this.comboMilestoneTier = milestoneTier;
      this.musicComboRisePulseMs = 520;
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
    this.musicComboRisePulseMs = 0;
    this.musicComboDropPulseMs = 420;
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
    this.updateChestBubbleSlideshows(delta);

    if (this.isPaused) {
      return;
    }

    if (this.isGameOver || this.levelComplete) {
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

    if (this.layoutUsesMainBelt) {
      this.updateMainBelt(dt);
      this.runClawTransfers();
    }
    this.updateSideBelts(dt);
    this.updateConveyorVisuals(dt);
    this.syncItemPositions();
    this.updateDroneSabotage(scaledDeltaMs);

    this.checkForLevelComplete();
    if (this.levelComplete) {
      this.updateCardDraftSystem(delta);
      this.updateSceneJuice(delta);
      this.updateEffectHud();
      return;
    }

    this.checkForGameOver(dt);
    this.updateCardDraftSystem(delta);
    this.updateSceneJuice(delta);
    this.updateEffectHud();
  }

  checkForLevelComplete() {
    if (!this.isFiniteLevel || this.levelComplete || this.isGameOver) {
      return;
    }

    if (!Number.isFinite(this.levelQuota)) {
      return;
    }

    if (this.acceptedCount < this.levelQuota) {
      return;
    }

    this.triggerLevelComplete();
  }

  triggerLevelComplete() {
    if (this.levelComplete) {
      return;
    }

    this.levelComplete = true;
    if (this.levelMode === 'campaign') {
      markCampaignLevelCompleted(this.levelId);
    }
    this.closeCardDraft();
    this.setSlowMotion(false);
    this.abortActiveDrag();
    this.cleanupDroneSabotage(true);
    this.playImpactFx(1.05, 0x22c55e);
    this.playSfx('combo-tier', 1.2);
    this.emitShockRing(640, 360, 0x22c55e, 3.4, 280);
    this.rumble(0.36, 0.22, 180);
    this.startLevelClearMusicTransition();

    const nextLevelId = getNextCampaignLevelId(this.levelId);
    this.levelResultOverlay = this.add.rectangle(640, 360, 1280, 720, 0x1b0905, 0.74).setDepth(380).setInteractive();
    this.levelResultOverlay.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
    });

    const panelContainer = this.add.container(0, 0).setDepth(390).setAlpha(0);

    const panelWidth = 646;
    const panelHeight = nextLevelId ? 500 : 444;
    const panelRadius = 28;
    const panelX = 640;
    const panelY = 360;
    const panelTop = panelY - panelHeight * 0.5;
    const panelLeft = panelX - panelWidth * 0.5;

    const panelShadow = this.add.graphics();
    panelShadow.fillStyle(0x1b0905, 0.52);
    panelShadow.fillRoundedRect(panelLeft, panelTop + 10, panelWidth, panelHeight, panelRadius);

    const panel = this.add.graphics();
    panel.fillStyle(0x4a2012, 0.97);
    panel.fillRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, panelRadius);
    panel.lineStyle(2, 0xf0bd85, 1);
    panel.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, panelRadius);

    const topStrip = this.add.graphics();
    topStrip.fillStyle(0xffffff, 0.14);
    topStrip.fillRoundedRect(panelX - 272, panelTop + 36, 544, 40, 14);

    const divider = this.add.rectangle(panelX, panelTop + 236, panelWidth - 120, 2, 0xf0bd85, 0.32);

    const titleText = this.add
      .text(panelX, panelTop + 72, 'SHIFT CLEAR', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '66px',
        color: '#fff0d9',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.4)
      .setShadow(0, 3, '#000000', 10);

    this.levelResultText = this.add
      .text(panelX, panelTop + 148, this.levelName, {
        fontFamily: GAME_UI_FONT,
        fontSize: '34px',
        color: '#ffd9b3',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.9);

    const summaryText = this.add
      .text(panelX, panelTop + 204, `BOX ${this.acceptedCount}/${this.levelQuota}   SCORE ${this.score}`, {
        fontFamily: GAME_UI_FONT,
        fontSize: '28px',
        color: '#ffe7cc',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.8);

    panelContainer.add([panelShadow, panel, topStrip, divider, titleText, this.levelResultText, summaryText]);

    let resultLocked = false;
    const createResultButton = (label, y, accentColor, onSelect) => {
      const entry = this.add.container(640, y);

      const shadowMid = this.add.rectangle(0, 7, 360, 72, 0x1b0905, 0.44);
      const shadowLeft = this.add.circle(-180, 7, 36, 0x1b0905, 0.44);
      const shadowRight = this.add.circle(180, 7, 36, 0x1b0905, 0.44);

      const bodyMid = this.add.rectangle(0, 0, 360, 72, 0x7a4327, 1);
      const bodyLeft = this.add.circle(-180, 0, 36, 0x7a4327, 1);
      const bodyRight = this.add.circle(180, 0, 36, 0x7a4327, 1);
      const glossMid = this.add.rectangle(0, -15, 328, 20, 0xffffff, 0.14);
      const glossLeft = this.add.circle(-164, -15, 10, 0xffffff, 0.14);
      const glossRight = this.add.circle(164, -15, 10, 0xffffff, 0.14);
      const accentDot = this.add.circle(-150, 0, 8, accentColor, 1);

      const labelText = this.add
        .text(0, 0, label, {
          fontFamily: GAME_DISPLAY_FONT,
          fontSize: '42px',
          color: '#fff5ea',
          align: 'center'
        })
        .setOrigin(0.5)
        .setLetterSpacing(1.2)
        .setShadow(0, 2, '#6b3418', 4);

      const hitArea = this.add.zone(0, 0, 420, 88).setInteractive({ useHandCursor: true });

      const setHighlighted = (highlighted) => {
        const fill = highlighted ? 0x915131 : 0x7a4327;
        bodyMid.setFillStyle(fill, 1);
        bodyLeft.setFillStyle(fill, 1);
        bodyRight.setFillStyle(fill, 1);
        accentDot.setScale(highlighted ? 1.24 : 1);
        labelText.setScale(highlighted ? 1.03 : 1);
      };

      hitArea.on('pointerover', () => {
        if (resultLocked) {
          return;
        }
        setHighlighted(true);
      });

      hitArea.on('pointerout', () => {
        setHighlighted(false);
      });

      hitArea.on('pointerdown', (_pointer, _x, _y, event) => {
        event?.stopPropagation();
        if (resultLocked) {
          return;
        }

        resultLocked = true;
        this.tweens.killTweensOf(entry);
        this.tweens.add({
          targets: entry,
          scaleX: 0.94,
          scaleY: 0.94,
          duration: 85,
          yoyo: true,
          ease: 'Quad.Out',
          onComplete: () => {
            onSelect();
          }
        });
      });

      entry.add([
        shadowMid,
        shadowLeft,
        shadowRight,
        bodyMid,
        bodyLeft,
        bodyRight,
        glossMid,
        glossLeft,
        glossRight,
        accentDot,
        labelText,
        hitArea
      ]);

      panelContainer.add(entry);
      return entry;
    };

    const transitionToSelection = () => {
      if (this.sceneTransitioning) {
        return;
      }

      this.sceneTransitioning = true;
      this.fadeOutVictoryMusicFast(0.22, false);
      this.playSceneWipeTransition(() => {
        this.stopVictoryMusicSource();
        this.victoryMusicPlaybackState = 'idle';
        this.scene.start('LevelSelectScene', { selectedLevelId: this.levelId });
      });
    };

    const transitionToNextLevel = () => {
      if (!nextLevelId || this.sceneTransitioning) {
        return;
      }

      this.sceneTransitioning = true;
      this.fadeOutVictoryMusicFast(0.22, false);
      this.playSceneWipeTransition(() => {
        this.stopVictoryMusicSource();
        this.victoryMusicPlaybackState = 'idle';
        this.startLoadingGameplay(nextLevelId, `Loading ${nextLevelId}`);
      });
    };

    if (nextLevelId) {
      createResultButton('Next Shift', panelTop + 306, 0x34d399, transitionToNextLevel);
      createResultButton('Level Select', panelTop + 388, 0xf59e0b, transitionToSelection);
    } else {
      createResultButton('Level Select', panelTop + 344, 0x34d399, transitionToSelection);
    }

    panelContainer.setScale(0.975);
    this.tweens.add({
      targets: panelContainer,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 240,
      ease: 'Back.Out'
    });
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

    const allLaneIntakesBlocked = this.laneLayout.every((laneConfig) => !this.canEnterLane(laneConfig.id));
    if (!allLaneIntakesBlocked) {
      return false;
    }

    if (this.directLaneSpawn) {
      return true;
    }

    const mainIsStuck = this.items.some((item) => item.state === 'stopped-main');

    return mainIsStuck;
  }

  runGameOverExplosionSequence() {
    const burstColors = [0xef4444, 0xf97316, 0xfb7185, 0xf59e0b];
    const burstCount = 14;

    for (let i = 0; i < burstCount; i += 1) {
      const delayMs = 40 + i * 55 + Phaser.Math.Between(0, 70);
      this.time.delayedCall(delayMs, () => {
        if (!this.isGameOver || this.sceneTransitioning) {
          return;
        }

        const x = Phaser.Math.Between(170, 1110);
        const y = Phaser.Math.Between(116, 616);
        const color = burstColors[Phaser.Math.Between(0, burstColors.length - 1)];
        const intensity = Phaser.Math.FloatBetween(0.34, 0.72);

        this.emitShockRing(x, y, color, Phaser.Math.FloatBetween(1.35, 2.7), Phaser.Math.Between(160, 300));
        this.emitTransferParticles(x, y, color, Phaser.Math.Between(9, 18));
        this.playImpactFx(intensity, color);

        if (Math.random() < 0.58) {
          this.playSfx('jam', Phaser.Math.FloatBetween(0.78, 1.18));
        }
      });
    }
  }

  triggerGameOver() {
    if (this.isGameOver || this.sceneTransitioning || this.levelComplete) {
      return;
    }

    this.isGameOver = true;
    this.levelClearMusicActive = false;
    this.pauseTransitionLock = false;
    this.closeCardDraft();
    this.setSlowMotion(false);
    this.abortActiveDrag();
    this.cleanupDroneSabotage(true);
    this.startGameOverMusicTransition();
    this.playImpactFx(1.35, 0xef4444);
    this.playSfx('game-over', 1.2);
    this.emitShockRing(640, 360, 0xef4444, 3.8, 350);
    this.rumble(0.7, 0.5, 260);

    if (this.pauseButtonBody?.input?.enabled) {
      this.pauseButtonBody.disableInteractive();
    }
    if (this.pauseButtonContainer?.active) {
      this.tweens.killTweensOf(this.pauseButtonContainer);
      this.tweens.add({
        targets: this.pauseButtonContainer,
        alpha: 0,
        duration: 120,
        ease: 'Quad.Out'
      });
    }

    this.cameras.main.shake(420, 0.0065, true);
    this.runGameOverExplosionSequence();

    const container = this.add.container(0, 0).setDepth(390);
    const scrim = this.add.rectangle(640, 360, 1280, 720, 0x1b0905, 0.76).setInteractive();
    scrim.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
    });

    const glowTop = this.add.circle(640, 130, 260, 0xef4444, 0.16).setBlendMode(Phaser.BlendModes.ADD);
    const glowBottom = this.add.circle(640, 575, 300, 0xb91c1c, 0.11).setBlendMode(Phaser.BlendModes.ADD);

    const panelShadow = this.add.rectangle(640, 364, 472, 412, 0x140307, 0.58);
    const panel = this.add.rectangle(640, 356, 472, 412, 0x4e1a1f, 0.97).setStrokeStyle(2, 0xf5a3ab, 0.95);
    const topStrip = this.add.rectangle(640, 205, 430, 36, 0xffd1d1, 0.14);

    const jammedLabel = this.add
      .text(640, 208, 'LINE JAMMED', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '56px',
        color: '#fff1f3',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.6)
      .setShadow(0, 3, '#000000', 10);

    const scoreLabel = this.add
      .text(640, 286, `SCORE ${this.score}`, {
        fontFamily: GAME_UI_FONT,
        fontSize: '34px',
        align: 'center',
        color: '#ffd7dc'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.8);

    container.add([scrim, glowTop, glowBottom, panelShadow, panel, topStrip, jammedLabel, scoreLabel]);

    const returnToMenu = this.levelMode === 'endless';

    const restartAction = () => {
      if (this.sceneTransitioning) {
        return;
      }

      this.sceneTransitioning = true;
      this.fadeOutGameOverMusicFast(0.16, false);
      this.playSceneWipeTransition(() => {
        this.stopGameOverMusicSource();
        this.gameOverMusicPlaybackState = 'idle';
        this.startLoadingGameplay(this.levelId, 'Restarting Shift');
      });
    };

    const exitAction = () => {
      if (this.sceneTransitioning) {
        return;
      }

      this.sceneTransitioning = true;
      this.fadeOutGameOverMusicFast(0.16, false);
      this.playSceneWipeTransition(() => {
        this.stopGameOverMusicSource();
        this.gameOverMusicPlaybackState = 'idle';

        if (returnToMenu) {
          this.scene.start('MainMenuScene');
          return;
        }

        this.scene.start('LevelSelectScene', { selectedLevelId: this.levelId });
      });
    };

    const gameOverEntryStyle = {
      bodyColor: 0x6b2a31,
      bodyHoverColor: 0x82404a,
      glossAlpha: 0.11,
      textColor: '#fff2f4',
      textShadowColor: '#3a1013'
    };

    this.createPauseMenuEntry(container, 'Restart', 374, 0xf97316, restartAction, gameOverEntryStyle);
    this.createPauseMenuEntry(container, 'Exit', 456, 0xfb7185, exitAction, gameOverEntryStyle);

    container.setAlpha(0);
    panel.setScale(0.95);

    this.time.delayedCall(360, () => {
      if (!container.active) {
        return;
      }

      this.tweens.add({
        targets: [container, panel],
        alpha: 1,
        duration: 160,
        ease: 'Quad.Out'
      });
      this.tweens.add({
        targets: panel,
        scaleX: 1,
        scaleY: 1,
        duration: 190,
        ease: 'Back.Out'
      });
    });

    this.gameOverOverlay = scrim;
    this.gameOverText = jammedLabel;
  }

  createFactoryVisuals() {
    if (this.layoutDecorationGraphics?.active) {
      this.layoutDecorationGraphics.destroy();
    }

    if (this.layoutUsesMainBelt) {
      this.mainBeltBody = this.add
        .rectangle(this.mainX, 360, MAIN_BELT_WIDTH, MAIN_BELT_HEIGHT, 0x5b2d1a, 1)
        .setStrokeStyle(2, 0xd39a67, 1)
        .setDepth(1);
      this.mainBeltLines = this.add.graphics().setDepth(2);
      this.mainBeltLineConfig = {
        x: this.mainX,
        y: 360,
        width: MAIN_BELT_WIDTH,
        height: MAIN_BELT_HEIGHT,
        orientation: 'vertical',
        spacing: 24,
        margin: 10,
        offset: 0
      };
      drawConveyorLines(this.mainBeltLines, this.mainBeltLineConfig);
    } else {
      this.mainBeltBody = null;
      this.mainBeltLines = null;
      this.mainBeltLineConfig = null;

      if (this.levelLayoutFamily === 'v_swap') {
        this.layoutDecorationGraphics = this.add.graphics().setDepth(0);
        this.layoutDecorationGraphics.lineStyle(16, 0x5b2d1a, 0.88);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 156, 402, 290);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 156, 878, 460);
        this.layoutDecorationGraphics.lineStyle(2, 0xd39a67, 1);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 156, 402, 290);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 156, 878, 460);
      } else if (this.levelLayoutFamily === 'triangle_mesh') {
        this.layoutDecorationGraphics = this.add.graphics().setDepth(0);
        this.layoutDecorationGraphics.lineStyle(14, 0x5b2d1a, 0.88);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 170, 520, 400);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 170, 760, 560);
        this.layoutDecorationGraphics.lineBetween(520, 400, 760, 560);
        this.layoutDecorationGraphics.lineStyle(2, 0xd39a67, 1);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 170, 520, 400);
        this.layoutDecorationGraphics.lineBetween(this.mainX, 170, 760, 560);
        this.layoutDecorationGraphics.lineBetween(520, 400, 760, 560);
      } else if (this.levelLayoutFamily === 'dual_spine') {
        this.layoutDecorationGraphics = this.add.graphics().setDepth(0);
        this.layoutDecorationGraphics.lineStyle(18, 0x5b2d1a, 0.9);
        this.layoutDecorationGraphics.lineBetween(460, 110, 460, 610);
        this.layoutDecorationGraphics.lineBetween(820, 110, 820, 610);
        this.layoutDecorationGraphics.lineStyle(2, 0xd39a67, 1);
        this.layoutDecorationGraphics.lineBetween(460, 110, 460, 610);
        this.layoutDecorationGraphics.lineBetween(820, 110, 820, 610);
      }
    }

    const hasChestSprites = this.textures.exists(CHEST_CLOSED_KEY) && this.textures.exists(CHEST_OPENED_KEY);

    this.laneLayout.forEach((laneConfig) => {
      const laneColor = this.foodTypeById[laneConfig.desiredType].color;
      const hasCustomIntake = Number.isFinite(laneConfig.intakeX);
      const intakeX = hasCustomIntake
        ? laneConfig.intakeX
        : this.mainX + laneConfig.direction * SIDE_BELT_INTAKE_OFFSET;
      const laneWidth = Math.abs(intakeX - laneConfig.endX);
      const laneCenterX = (intakeX + laneConfig.endX) * 0.5;

      const beltBody = this.add
        .rectangle(laneCenterX, laneConfig.y, laneWidth, SIDE_BELT_HEIGHT, 0x5b2d1a, 1)
        .setDepth(1)
        .setStrokeStyle(2, 0xd39a67, 1);
      const beltLines = this.add.graphics().setDepth(2);
      const beltLineConfig = {
        x: laneCenterX,
        y: laneConfig.y,
        width: laneWidth,
        height: SIDE_BELT_HEIGHT,
        orientation: 'horizontal',
        spacing: 26,
        margin: 9,
        offset: 0
      };
      drawConveyorLines(beltLines, beltLineConfig);

      const chestAura = this.add.circle(laneConfig.chestX, laneConfig.y, 62, laneColor, 0.12).setDepth(5).setAlpha(0.04);
      chestAura.setBlendMode(Phaser.BlendModes.ADD);

      let chestSprite = null;
      let chestBaseScale = 1;
      if (hasChestSprites) {
        chestSprite = this.add.image(laneConfig.chestX, laneConfig.y, CHEST_CLOSED_KEY).setDepth(6);
        const chestMaxSize = Math.max(chestSprite.width, chestSprite.height);
        chestBaseScale = chestMaxSize > 0 ? 102 / chestMaxSize : 1;
        chestSprite.setScale(chestBaseScale);
      } else {
        this.add.rectangle(laneConfig.chestX, laneConfig.y, 114, 56, 0x704124, 1).setStrokeStyle(3, laneColor, 1);
      }

      // Add chest inserter claw
      const chestClawX = laneConfig.endX + laneConfig.direction * 18;
      const chestClawContainer = this.add.container(chestClawX, laneConfig.y).setDepth(10);
      // Chest inserter should face the belt (toward the center) at rest.
      const chestClawBaseAngle = laneConfig.direction > 0 ? 0 : 180;
      chestClawContainer.setAngle(chestClawBaseAngle);
      const chestClawBase = this.add.circle(0, 0, CLAW_RADIUS - 4, 0x6b3418, 1).setStrokeStyle(2, laneColor, 1);
      const chestClawGraphics = this.add.graphics();
      chestClawGraphics.lineStyle(4, 0xffd7ab, 1);
      chestClawGraphics.lineBetween(0, 0, -CLAW_ARM_LENGTH, 0);
      chestClawGraphics.lineStyle(4, laneColor, 1);
      chestClawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, -CLAW_JAW_SPREAD);
      chestClawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, CLAW_JAW_SPREAD);
      chestClawContainer.add([chestClawGraphics, chestClawBase]);

      const laneTextureKeys = (
        this.chestBubbleTextureKeysByFoodId[laneConfig.desiredType]
        || this.textureKeysByFoodId[laneConfig.desiredType]
        || []
      )
        .filter((textureKey) => this.textures.exists(textureKey));
      let chestBubblePlate = null;
      let chestBubbleIcon = null;
      if (laneTextureKeys.length > 0) {
        const laneIconKey = laneTextureKeys[0];
        chestBubblePlate = this.add.circle(laneConfig.chestX, laneConfig.y + 56, 18, 0xffedd2, 0.95).setDepth(8);
        chestBubbleIcon = this.add.image(laneConfig.chestX, laneConfig.y + 56, laneIconKey).setDepth(9);
        const laneSource = this.textures.get(laneIconKey)?.getSourceImage();
        const laneDim = Math.max(chestBubbleIcon.width, chestBubbleIcon.height, laneSource?.width || 0, laneSource?.height || 0);
        if (laneDim > 0) {
          chestBubbleIcon.setScale(CHEST_BUBBLE_ICON_SIZE / laneDim);
        }
        this.tweens.add({
          targets: [chestBubblePlate, chestBubbleIcon],
          y: { from: laneConfig.y + 53, to: laneConfig.y + 59 },
          duration: 1700 + Math.random() * 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        });
      }

      const clawBaseAngle = laneConfig.direction > 0 ? 0 : 180;
      let clawContainer = null;
      if (this.showTransferClaws) {
        // Keep transfer claws anchored to the main splitter so all layout families stay aligned.
        const clawX = this.mainX + laneConfig.direction * CLAW_OFFSET_X;
        clawContainer = this.add.container(clawX, laneConfig.y).setDepth(9);
        clawContainer.setAngle(clawBaseAngle);

        const clawBase = this.add.circle(0, 0, CLAW_RADIUS - 4, 0x6b3418, 1).setStrokeStyle(2, laneColor, 1);
        const clawGraphics = this.add.graphics();
        clawGraphics.lineStyle(4, 0xffd7ab, 1);
        clawGraphics.lineBetween(0, 0, -CLAW_ARM_LENGTH, 0);
        clawGraphics.lineStyle(4, laneColor, 1);
        clawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, -CLAW_JAW_SPREAD);
        clawGraphics.lineBetween(-CLAW_ARM_LENGTH, 0, -CLAW_ARM_LENGTH - CLAW_JAW_LENGTH, CLAW_JAW_SPREAD);

        clawContainer.add([clawGraphics, clawBase]);
      }

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
        chestAnimToken: 0,
        chestBubblePlate,
        chestBubbleIcon,
        chestBubbleTextureKeys: laneTextureKeys,
        chestBubbleTextureIndex: 0,
        chestBubbleSwapMs: 0,
        chestBubbleSwapIntervalMs: CHEST_BUBBLE_SWAP_INTERVAL_MS
      };
    });
  }

  updateChestBubbleSlideshows(deltaMs) {
    if (deltaMs <= 0) {
      return;
    }

    for (const lane of Object.values(this.lanesById)) {
      if (!lane?.chestBubbleIcon?.active) {
        continue;
      }

      const textureKeys = lane.chestBubbleTextureKeys;
      if (!Array.isArray(textureKeys) || textureKeys.length <= 1) {
        continue;
      }

      const swapIntervalMs = Math.max(150, lane.chestBubbleSwapIntervalMs || CHEST_BUBBLE_SWAP_INTERVAL_MS);
      lane.chestBubbleSwapMs += deltaMs;
      if (lane.chestBubbleSwapMs < swapIntervalMs) {
        continue;
      }

      const swapSteps = Math.floor(lane.chestBubbleSwapMs / swapIntervalMs);
      lane.chestBubbleSwapMs -= swapSteps * swapIntervalMs;
      lane.chestBubbleTextureIndex = (lane.chestBubbleTextureIndex + swapSteps) % textureKeys.length;

      const nextTextureKey = textureKeys[lane.chestBubbleTextureIndex];
      if (!nextTextureKey || !this.textures.exists(nextTextureKey)) {
        continue;
      }

      lane.chestBubbleIcon.setTexture(nextTextureKey);

      const source = this.textures.get(nextTextureKey)?.getSourceImage();
      const iconDim = Math.max(
        lane.chestBubbleIcon.width,
        lane.chestBubbleIcon.height,
        source?.width || 0,
        source?.height || 0
      );
      if (iconDim > 0) {
        lane.chestBubbleIcon.setScale(CHEST_BUBBLE_ICON_SIZE / iconDim);
      }
    }
  }

  updateConveyorVisuals(dt) {
    if (dt <= 0) {
      return;
    }

    const jammedByLaneId = this.laneLayout.reduce((acc, lane) => {
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
      this.mainBeltLineConfig.offset = (this.mainBeltLineConfig.offset + this.mainSpeed * dt * this.mainFlowSign) % spacing;
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

  ensureJamBeetleAnimation() {
    if (this.anims.exists(JAM_BEETLE_ANIM_KEY)) {
      return;
    }

    const frameKeys = this.jamBeetleTextureKeys.filter((key) => this.textures.exists(key));
    if (frameKeys.length < 2) {
      return;
    }

    this.anims.create({
      key: JAM_BEETLE_ANIM_KEY,
      frames: frameKeys.map((key) => ({ key })),
      frameRate: 4,
      repeat: -1
    });
  }

  isJamBeetleLevelEnabled() {
    if (this.levelId === DEBUG_LEVEL_ID) {
      return true;
    }

    if (this.levelMode !== 'campaign') {
      return false;
    }

    const levelIndex = Number(this.levelConfig?.index);
    return Number.isFinite(levelIndex) && levelIndex >= 2;
  }

  shouldSpawnJamBeetle() {
    if (!this.isJamBeetleLevelEnabled() || this.jamBeetleTextureKeys.length <= 0) {
      return false;
    }

    // Use full core category count (carbs/protein/greens/condiments) for stable spawn odds.
    // This keeps beetles around a 1:4 category ratio regardless of level-specific active foods.
    const totalCoreFoodCategories = Math.max(1, FOOD_TYPES.length);
    const baseSpawnChance = 1 / (totalCoreFoodCategories + 1);
    const tunedSpawnChance = Phaser.Math.Clamp(baseSpawnChance * JAM_BEETLE_SPAWN_SCALE, 0.01, 0.95);
    return Math.random() < tunedSpawnChance;
  }

  isDroneSabotageLevelEnabled() {
    if (this.levelId === DEBUG_LEVEL_ID) {
      return true;
    }

    if (this.levelMode !== 'campaign') {
      return false;
    }

    const levelIndex = Number(this.levelConfig?.index);
    return Number.isFinite(levelIndex) && levelIndex >= 3;
  }

  resetDroneSabotageTimer(minMs = DRONE_SABOTAGE_MIN_COOLDOWN_MS, maxMs = DRONE_SABOTAGE_MAX_COOLDOWN_MS) {
    this.droneSabotageTimerMs = Phaser.Math.Between(minMs, maxMs);
  }

  cleanupDroneSabotage(preserveTimer = false) {
    this.droneRunToken += 1;

    if (this.droneCarryItemId !== null) {
      const carriedItem = this.getItemById(this.droneCarryItemId);
      if (carriedItem) {
        const mainY = this.getMainWorldY(0);
        carriedItem.state = 'main';
        carriedItem.laneId = null;
        carriedItem.mainPos = 0;
        carriedItem.lanePos = 0;
        carriedItem.motionLock = false;
        carriedItem.x = this.mainX;
        carriedItem.y = mainY;
        if (carriedItem.container?.active) {
          carriedItem.container.setPosition(this.mainX, mainY);
          carriedItem.container.setScale(1);
          carriedItem.container.setAngle(0);
          carriedItem.container.setDepth(10);
        }
        if (carriedItem.grabHandle?.active) {
          carriedItem.grabHandle.setPosition(this.mainX, mainY);
          carriedItem.grabHandle.setDepth(11);
        }
        this.ensureGrabHandleReady(carriedItem);
      }
    }

    if (Array.isArray(this.droneRotorTweens)) {
      this.droneRotorTweens.forEach((tween) => {
        tween?.remove?.();
      });
    }
    this.droneRotorTweens = [];

    if (this.droneContainer?.active) {
      this.droneContainer.destroy(true);
    }

    this.droneContainer = null;
    this.droneCarryItemId = null;
    this.droneActive = false;

    if (!preserveTimer) {
      this.droneSabotageTimerMs = 0;
    }
  }

  updateDroneSabotage(deltaMs) {
    if (!this.isDroneSabotageLevelEnabled() || this.droneActive || deltaMs <= 0) {
      return;
    }

    this.droneSabotageTimerMs -= deltaMs;
    if (this.droneSabotageTimerMs > 0) {
      return;
    }

    const targetItem = this.pickDroneSabotageTargetItem();
    if (!targetItem) {
      this.resetDroneSabotageTimer(DRONE_SABOTAGE_RETRY_MIN_MS, DRONE_SABOTAGE_RETRY_MAX_MS);
      return;
    }

    const dropPlan = this.pickDroneWrongLaneDrop(targetItem);
    if (!dropPlan) {
      this.resetDroneSabotageTimer(DRONE_SABOTAGE_RETRY_MIN_MS, DRONE_SABOTAGE_RETRY_MAX_MS);
      return;
    }

    this.startDroneSabotageRun(targetItem.id, dropPlan);
  }

  pickDroneSabotageTargetItem() {
    const candidates = this.items.filter((item) => {
      if (!item || item.isJamBeetle || item.state !== 'side' || item.motionLock) {
        return false;
      }

      const lane = this.lanesById[item.laneId];
      if (!lane) {
        return false;
      }

      // Only steal foods that are currently in their correct belt.
      return lane.desiredType === item.type;
    });

    if (candidates.length <= 0) {
      return null;
    }

    return Phaser.Utils.Array.GetRandom(candidates);
  }

  findFirstFreeLanePosFromStart(laneId, excludedItemId) {
    const lane = this.lanesById[laneId];
    if (!lane) {
      return null;
    }

    const maxPos = Math.ceil(lane.length);
    for (let lanePos = 0; lanePos <= maxPos; lanePos += 1) {
      if (this.isLanePosFree(laneId, lanePos, excludedItemId)) {
        return lanePos;
      }
    }

    return null;
  }

  pickDroneWrongLaneDrop(item) {
    if (!item) {
      return null;
    }

    const wrongLanes = this.laneLayout
      .map((laneConfig) => this.lanesById[laneConfig.id])
      .filter((lane) => lane && lane.desiredType !== item.type);

    if (wrongLanes.length <= 0) {
      return null;
    }

    const shuffled = Phaser.Utils.Array.Shuffle([...wrongLanes]);
    for (const lane of shuffled) {
      const lanePos = this.findFirstFreeLanePosFromStart(lane.id, item.id);
      if (lanePos !== null) {
        return {
          laneId: lane.id,
          lanePos
        };
      }
    }

    return null;
  }

  createDroneVisual() {
    const container = this.add.container(0, 0).setDepth(247);
    const shadow = this.add.rectangle(0, 8, 94, 48, 0x020617, 0.36);
    const body = this.add.rectangle(0, 0, 94, 48, 0x334155, 1).setStrokeStyle(2, 0x94a3b8, 0.95);
    const innerBody = this.add.rectangle(0, 0, 58, 20, 0x0f172a, 1).setStrokeStyle(1, 0xcbd5e1, 0.9);
    const accent = this.add.rectangle(0, -12, 42, 4, 0x38bdf8, 0.75);

    container.add([shadow, body, innerBody, accent]);

    const rotorOffsets = [
      { x: -37, y: -20 },
      { x: 37, y: -20 },
      { x: -37, y: 20 },
      { x: 37, y: 20 }
    ];

    const rotorTweens = [];
    rotorOffsets.forEach((offset, index) => {
      const mount = this.add.circle(offset.x, offset.y, 7, 0x1e293b, 1).setStrokeStyle(1, 0x94a3b8, 0.9);
      const rotor = this.add.container(offset.x, offset.y);
      const bladeA = this.add.rectangle(0, 0, 24, 3, 0xe2e8f0, 0.95);
      const bladeB = this.add.rectangle(0, 0, 24, 3, 0xe2e8f0, 0.95).setAngle(90);
      const hub = this.add.circle(0, 0, 3, 0x0f172a, 1).setStrokeStyle(1, 0xf8fafc, 0.85);
      rotor.add([bladeA, bladeB, hub]);

      container.add([mount, rotor]);

      rotorTweens.push(this.tweens.add({
        targets: rotor,
        angle: 360,
        duration: 140 + index * 22,
        repeat: -1,
        ease: 'Linear'
      }));
    });

    return {
      container,
      rotorTweens
    };
  }

  getDroneEntryPoint() {
    const fromLeft = Math.random() < 0.5;
    return {
      fromLeft,
      x: fromLeft ? -150 : 1430,
      y: Phaser.Math.Between(120, 380)
    };
  }

  getDroneExitPoint(fromLeft) {
    const exitUp = Math.random() < 0.32;
    if (exitUp) {
      return {
        x: Phaser.Math.Between(180, 1100),
        y: -130
      };
    }

    return {
      x: fromLeft ? 1430 : -150,
      y: Phaser.Math.Between(110, 390)
    };
  }

  showDroneSabotageWarning(targetItem, plannedDrop, onComplete = () => {}) {
    if (!targetItem) {
      onComplete();
      return;
    }

    const dropLane = this.lanesById[plannedDrop?.laneId];
    const pickupX = targetItem.x;
    const pickupY = targetItem.y;
    const dropX = dropLane ? dropLane.intakeX : this.mainX;
    const dropY = dropLane ? dropLane.y : this.mainStartY;

    const camera = this.cameras.main;
    const centerX = camera?.centerX ?? 640;
    const centerY = camera?.centerY ?? 360;

    const warningText = this.add
      .text(centerX, centerY, 'DRONE INBOUND', {
        fontFamily: GAME_DISPLAY_FONT,
        fontSize: '56px',
        color: '#ffe4e6',
        stroke: '#3f0a10',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(332)
      .setAlpha(0);

    const warningTint = this.add
      .rectangle(centerX, centerY, camera?.width ?? 1280, camera?.height ?? 720, 0xef4444, 1)
      .setDepth(249)
      .setAlpha(0);

    this.playSfx('claw-move', 0.46);
    this.emitShockRing(pickupX, pickupY, 0xfca5a5, 1.32, 150);
    this.emitShockRing(dropX, dropY, 0xfdba74, 1.22, 150);
    if (dropLane) {
      this.pulseLaneVisual(dropLane.id, 0.8, true);
    }

    const fadeInMs = 180;
    const fadeOutMs = 220;
    const holdMs = Math.max(0, DRONE_WARNING_DURATION_MS - fadeInMs - fadeOutMs);

    this.tweens.add({
      targets: warningText,
      alpha: 0.86,
      duration: fadeInMs,
      ease: 'Sine.Out'
    });

    this.tweens.add({
      targets: warningTint,
      alpha: 0.055,
      duration: fadeInMs,
      ease: 'Sine.Out'
    });

    this.time.delayedCall(fadeInMs + holdMs, () => {
      this.tweens.add({
        targets: warningText,
        alpha: 0,
        duration: fadeOutMs,
        ease: 'Sine.In',
        onComplete: () => {
          warningText.destroy();
        }
      });

      this.tweens.add({
        targets: warningTint,
        alpha: 0,
        duration: fadeOutMs,
        ease: 'Sine.In',
        onComplete: () => {
          warningTint.destroy();
        }
      });
    });

    this.time.delayedCall(DRONE_WARNING_DURATION_MS, onComplete);
  }

  syncDroneCarryItemPosition() {
    if (!this.droneContainer?.active || this.droneCarryItemId === null) {
      return;
    }

    const carriedItem = this.getItemById(this.droneCarryItemId);
    if (!carriedItem) {
      return;
    }

    const targetX = this.droneContainer.x;
    const targetY = this.droneContainer.y + DRONE_CARRY_OFFSET_Y;

    carriedItem.x = targetX;
    carriedItem.y = targetY;

    if (carriedItem.container?.active) {
      carriedItem.container.setPosition(targetX, targetY);
      carriedItem.container.setDepth(246);
    }

    if (carriedItem.grabHandle?.active) {
      carriedItem.grabHandle.setPosition(targetX, targetY);
      carriedItem.grabHandle.setDepth(247);
    }
  }

  flyDroneTo(x, y, onComplete = () => {}) {
    if (!this.droneContainer?.active) {
      onComplete();
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.droneContainer.x, this.droneContainer.y, x, y);
    const duration = Phaser.Math.Clamp(
      (distance / Math.max(1, DRONE_FLIGHT_SPEED_PX_PER_SEC)) * 1000,
      DRONE_FLIGHT_MIN_DURATION_MS,
      DRONE_FLIGHT_MAX_DURATION_MS
    );

    this.tweens.add({
      targets: this.droneContainer,
      x,
      y,
      duration,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this.syncDroneCarryItemPosition();
      },
      onComplete
    });
  }

  prepareItemForDronePickup(item) {
    if (!item) {
      return;
    }

    this.tweens.killTweensOf(item.container);
    item.state = 'drone';
    item.motionLock = true;
    item.laneId = null;
    item.mainPos = 0;
    item.lanePos = 0;
    item.holdMainPos = null;

    if (item.grabHandle?.input?.enabled) {
      item.grabHandle.disableInteractive();
    }
  }

  releaseItemFromDrone(item, plannedDrop) {
    if (!item) {
      return;
    }

    let laneId = plannedDrop?.laneId;
    let lanePos = this.findFirstFreeLanePosFromStart(laneId, item.id);

    if (lanePos === null) {
      const fallbackDrop = this.pickDroneWrongLaneDrop(item);
      if (fallbackDrop) {
        laneId = fallbackDrop.laneId;
        lanePos = fallbackDrop.lanePos;
      }
    }

    const lane = this.lanesById[laneId];
    if (!lane || lanePos === null) {
      const mainY = this.getMainWorldY(0);
      item.state = 'main';
      item.laneId = null;
      item.mainPos = 0;
      item.lanePos = 0;
      item.motionLock = false;
      item.x = this.mainX;
      item.y = mainY;
    } else {
      item.state = 'side';
      item.laneId = lane.id;
      item.lanePos = lanePos;
      item.mainPos = 0;
      item.motionLock = false;
      item.x = lane.intakeX + lane.direction * lanePos;
      item.y = lane.y;
    }

    if (item.container?.active) {
      item.container.setPosition(item.x, item.y);
      item.container.setScale(1);
      item.container.setAngle(0);
      item.container.setDepth(10);
    }
    if (item.grabHandle?.active) {
      item.grabHandle.setPosition(item.x, item.y);
      item.grabHandle.setDepth(11);
    }

    this.clearItemTint(item);
    this.ensureGrabHandleReady(item);
    this.emitTransferParticles(item.x, item.y, item.baseColor, 12);
    this.emitShockRing(item.x, item.y, 0xf97316, 1.7, 170);
  }

  startDroneSabotageRun(targetItemId, plannedDrop) {
    if (this.droneActive) {
      return;
    }

    const targetItem = this.getItemById(targetItemId);
    if (!targetItem) {
      this.resetDroneSabotageTimer(DRONE_SABOTAGE_RETRY_MIN_MS, DRONE_SABOTAGE_RETRY_MAX_MS);
      return;
    }

    let activeDropPlan = plannedDrop;
    const preferredLanePos = this.findFirstFreeLanePosFromStart(activeDropPlan?.laneId, targetItem.id);
    if (activeDropPlan?.laneId && preferredLanePos !== null) {
      activeDropPlan = {
        laneId: activeDropPlan.laneId,
        lanePos: preferredLanePos
      };
    } else {
      activeDropPlan = this.pickDroneWrongLaneDrop(targetItem);
    }

    if (!activeDropPlan) {
      this.resetDroneSabotageTimer(DRONE_SABOTAGE_RETRY_MIN_MS, DRONE_SABOTAGE_RETRY_MAX_MS);
      return;
    }

    const runToken = this.droneRunToken + 1;
    this.droneRunToken = runToken;
    this.droneActive = true;

    this.showDroneSabotageWarning(targetItem, activeDropPlan, () => {
      if (runToken !== this.droneRunToken || !this.droneActive) {
        return;
      }

      if (this.isGameOver || this.levelComplete || this.sceneTransitioning) {
        this.droneActive = false;
        this.resetDroneSabotageTimer(DRONE_SABOTAGE_RETRY_MIN_MS, DRONE_SABOTAGE_RETRY_MAX_MS);
        return;
      }

      const currentItem = this.getItemById(targetItemId);
      const currentLane = this.lanesById[currentItem?.laneId];
      if (
        !currentItem
        || currentItem.isJamBeetle
        || currentItem.state !== 'side'
        || currentItem.motionLock
        || !currentLane
        || currentLane.desiredType !== currentItem.type
      ) {
        this.droneActive = false;
        this.resetDroneSabotageTimer(DRONE_SABOTAGE_RETRY_MIN_MS, DRONE_SABOTAGE_RETRY_MAX_MS);
        return;
      }

      const refreshedDrop = this.pickDroneWrongLaneDrop(currentItem);
      if (refreshedDrop) {
        activeDropPlan = refreshedDrop;
      }

      const droneVisual = this.createDroneVisual();
      this.droneContainer = droneVisual.container;
      this.droneRotorTweens = droneVisual.rotorTweens;

      const entryPoint = this.getDroneEntryPoint();
      const exitPoint = this.getDroneExitPoint(entryPoint.fromLeft);
      const pickupPoint = {
        x: currentItem.x,
        y: currentItem.y - 24
      };

      this.droneContainer.setPosition(entryPoint.x, entryPoint.y);
      this.droneContainer.setAlpha(0);
      this.tweens.add({
        targets: this.droneContainer,
        alpha: 1,
        duration: 140,
        ease: 'Quad.Out'
      });

      this.flyDroneTo(pickupPoint.x, pickupPoint.y, () => {
        if (runToken !== this.droneRunToken || !this.droneActive) {
          return;
        }

        const latestItem = this.getItemById(targetItemId);
        const latestLane = this.lanesById[latestItem?.laneId];
        if (
          !latestItem
          || latestItem.isJamBeetle
          || latestItem.state !== 'side'
          || latestItem.motionLock
          || !latestLane
          || latestLane.desiredType !== latestItem.type
        ) {
          this.finishDroneSabotageRun(exitPoint);
          return;
        }

        this.prepareItemForDronePickup(latestItem);
        this.droneCarryItemId = latestItem.id;
        this.syncDroneCarryItemPosition();
        this.playSfx('claw-grab', 0.92);
        this.emitTransferParticles(latestItem.x, latestItem.y, latestItem.baseColor, 10);

        this.time.delayedCall(DRONE_PICKUP_HOLD_MS, () => {
          if (runToken !== this.droneRunToken || !this.droneActive) {
            return;
          }

          const carried = this.getItemById(this.droneCarryItemId);
          let runtimeDropPlan = activeDropPlan;

          if (carried) {
            const startFreePos = this.findFirstFreeLanePosFromStart(runtimeDropPlan?.laneId, carried.id);
            if (runtimeDropPlan?.laneId && startFreePos !== null) {
              runtimeDropPlan = {
                laneId: runtimeDropPlan.laneId,
                lanePos: startFreePos
              };
            } else {
              const fallbackDrop = this.pickDroneWrongLaneDrop(carried);
              if (fallbackDrop) {
                runtimeDropPlan = fallbackDrop;
              }
            }
          }

          const lane = this.lanesById[runtimeDropPlan?.laneId];
          const dropPoint = lane
            ? { x: lane.intakeX + lane.direction * runtimeDropPlan.lanePos, y: lane.y - 24 }
            : { x: this.mainX, y: this.mainStartY - 24 };

          this.flyDroneTo(dropPoint.x, dropPoint.y, () => {
            if (runToken !== this.droneRunToken || !this.droneActive) {
              return;
            }

            const carriedAtDrop = this.getItemById(this.droneCarryItemId);
            if (carriedAtDrop) {
              this.releaseItemFromDrone(carriedAtDrop, runtimeDropPlan);
            }

            this.droneCarryItemId = null;
            this.playSfx('claw-drop', 0.95);

            this.time.delayedCall(DRONE_DROP_HOLD_MS, () => {
              if (runToken !== this.droneRunToken || !this.droneActive) {
                return;
              }

              this.finishDroneSabotageRun(exitPoint);
            });
          });
        });
      });
    });
  }

  finishDroneSabotageRun(exitPoint) {
    if (!this.droneContainer?.active) {
      this.cleanupDroneSabotage(true);
      this.resetDroneSabotageTimer();
      return;
    }

    this.flyDroneTo(exitPoint.x, exitPoint.y, () => {
      this.cleanupDroneSabotage(true);
      this.resetDroneSabotageTimer();
    });
  }

  spawnFoodIfSpace() {
    if (this.directLaneSpawn) {
      const enterableLaneIds = this.laneLayout
        .map((laneConfig) => laneConfig.id)
        .filter((laneId) => this.canEnterLane(laneId));

      if (enterableLaneIds.length === 0) {
        return false;
      }

      const laneId = Phaser.Utils.Array.GetRandom(enterableLaneIds);
      this.spawnFood(laneId);
      return true;
    }

    const closestToEntry = this.getClosestMainPosToEntry();
    if (closestToEntry !== null && closestToEntry < this.itemSpacing) {
      return false;
    }

    this.spawnFood();
    return true;
  }

  spawnFood(spawnLaneId = null) {
    const foodPool = this.activeFoodTypes?.length > 0 ? this.activeFoodTypes : FOOD_TYPES;
    const spawnJamBeetle = this.shouldSpawnJamBeetle();
    const food = spawnJamBeetle ? null : Phaser.Utils.Array.GetRandom(foodPool);
    const itemId = this.nextItemId;
    const spawnLane = spawnLaneId ? this.lanesById[spawnLaneId] : null;
    const spawnX = spawnLane ? spawnLane.intakeX : this.mainX;
    const spawnY = spawnLane ? spawnLane.y : this.mainStartY;

    let itemVisual;
    let itemType = food?.id || JAM_BEETLE_TYPE_ID;
    let itemColor = food?.color || JAM_BEETLE_COLOR;

    if (spawnJamBeetle) {
      const textureKey = this.jamBeetleTextureKeys[0] || null;
      if (textureKey && this.textures.exists(textureKey)) {
        itemVisual = this.add.sprite(0, 0, textureKey);

        const maxDim = Math.max(itemVisual.width || 1, itemVisual.height || 1);
        itemVisual.setScale(JAM_BEETLE_RENDER_SIZE / maxDim);

        if (this.anims.exists(JAM_BEETLE_ANIM_KEY)) {
          itemVisual.play(JAM_BEETLE_ANIM_KEY);
        }
      } else {
        itemVisual = this.add.circle(0, 0, JAM_BEETLE_RENDER_SIZE * 0.4, JAM_BEETLE_COLOR, 1).setStrokeStyle(2, 0x3a1013, 1);
      }
    } else {
      const textureKeys = this.textureKeysByFoodId[food.id] || [];

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
    }

    const container = this.add.container(spawnX, spawnY, [itemVisual]).setDepth(10);
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
    const grabHandle = this.add.zone(spawnX, spawnY, grabSize, grabSize).setDepth(11);
    grabHandle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(grabHandle);
    grabHandle.setData('itemId', itemId);
    grabHandle.input.cursor = 'grab';

    if (spawnJamBeetle) {
      grabHandle.on('pointerup', (pointer) => {
        if (this.dragContext?.itemId === itemId) {
          return;
        }

        const downX = Number(pointer?.downX);
        const downY = Number(pointer?.downY);
        const upX = Number(pointer?.x);
        const upY = Number(pointer?.y);
        const moved = Phaser.Math.Distance.Between(
          Number.isFinite(downX) ? downX : upX,
          Number.isFinite(downY) ? downY : upY,
          upX,
          upY
        );

        if (moved <= JAM_BEETLE_TAP_MAX_MOVEMENT) {
          this.handleJamBeetleTap(itemId, pointer);
        }
      });
    }

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
      type: itemType,
      x: spawnX,
      y: spawnY,
      mainPos: 0,
      lanePos: 0,
      state: spawnLane ? 'side' : 'main',
      laneId: spawnLane ? spawnLane.id : null,
      motionLock: false,
      scoreScale: itemScoreScale,
      predictivePullBoosted,
      container,
      grabHandle,
      itemVisual,
      baseColor: itemColor,
      isJamBeetle: spawnJamBeetle,
      splatTapCount: 0,
      ignoreTapUntilMs: 0
    };

    this.items.push(item);
    this.emitSpawnParticles(item);
    this.emitTransferParticles(spawnX, spawnY, itemColor, 6);

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

      if (item.id === draggedItemId || item.state === 'dragging' || item.state === 'consuming' || item.state === 'drone') {
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
        y: this.getMainWorldY(slot.mainPos)
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

    for (const laneConfig of this.laneLayout) {
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

  activateDragInteraction(item, gameObject) {
    if (!item || !gameObject) {
      return;
    }

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

  handleDragStart(_pointer, gameObject) {
    if (this.isPaused || this.isDraftActive) {
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
      fromSlot: this.captureItemSlot(item),
      dragStartX: item.x,
      dragStartY: item.y,
      dragStartTime: this.time?.now ?? Date.now(),
      prevDragX: item.x,
      prevDragY: item.y,
      prevDragTime: this.time?.now ?? Date.now(),
      lastDragX: item.x,
      lastDragY: item.y,
      lastDragTime: this.time?.now ?? Date.now(),
      pendingBeetleTap: item.isJamBeetle === true,
      hasActivatedDrag: item.isJamBeetle !== true
    };

    if (item.isJamBeetle) {
      // Tap has priority for beetles. We only upgrade to drag once movement crosses threshold.
      item.motionLock = true;
      return;
    }

    this.activateDragInteraction(item, gameObject);
  }

  handleDrag(_pointer, gameObject, dragX, dragY) {
    if (this.isPaused) {
      return;
    }

    if (!this.dragContext || this.dragContext.itemId !== gameObject.getData('itemId')) {
      return;
    }

    const item = this.getItemById(this.dragContext.itemId);
    if (!item) {
      return;
    }

    if (item.isJamBeetle && this.dragContext.pendingBeetleTap && !this.dragContext.hasActivatedDrag) {
      const movedDistance = Phaser.Math.Distance.Between(
        this.dragContext.dragStartX,
        this.dragContext.dragStartY,
        dragX,
        dragY
      );

      if (movedDistance < JAM_BEETLE_GRAB_MIN_MOVEMENT) {
        return;
      }

      this.dragContext.pendingBeetleTap = false;
      this.dragContext.hasActivatedDrag = true;
      this.activateDragInteraction(item, gameObject);
    }

    const now = this.time?.now ?? Date.now();
    this.dragContext.prevDragX = this.dragContext.lastDragX;
    this.dragContext.prevDragY = this.dragContext.lastDragY;
    this.dragContext.prevDragTime = this.dragContext.lastDragTime;
    this.dragContext.lastDragX = dragX;
    this.dragContext.lastDragY = dragY;
    this.dragContext.lastDragTime = now;

    item.x = dragX;
    item.y = dragY;
    item.container.setPosition(dragX, dragY);
    item.grabHandle.setPosition(dragX, dragY);
  }

  handleDragEnd(pointer, gameObject) {
    if (this.isPaused) {
      return;
    }

    if (!this.dragContext || this.dragContext.itemId !== gameObject.getData('itemId')) {
      return;
    }

    const draggedItem = this.getItemById(this.dragContext.itemId);
    if (!draggedItem) {
      this.finishDragResolution();
      return;
    }

    if (draggedItem.isJamBeetle && this.dragContext.pendingBeetleTap && !this.dragContext.hasActivatedDrag) {
      this.applyItemSlot(draggedItem, this.dragContext.fromSlot);
      const destination = this.getWorldPositionForSlot(this.dragContext.fromSlot);
      draggedItem.x = destination.x;
      draggedItem.y = destination.y;
      draggedItem.container.setPosition(destination.x, destination.y);
      draggedItem.grabHandle.setPosition(destination.x, destination.y);
      draggedItem.ignoreTapUntilMs = (this.time?.now ?? Date.now()) + 120;
      this.finishDragResolution();
      this.handleJamBeetleTap(draggedItem.id, pointer, true);
      return;
    }

    const dropX = pointer.worldX ?? pointer.x;
    const dropY = pointer.worldY ?? pointer.y;

    if (draggedItem.isJamBeetle) {
      // Main logic: beetle can be placed on belts like a normal item.
      const laneDropSlot = this.buildLaneDropSlot(draggedItem, dropX, dropY);
      if (laneDropSlot) {
        draggedItem.ignoreTapUntilMs = (this.time?.now ?? Date.now()) + 120;
        this.animateReturnToSlot(draggedItem, laneDropSlot);
        return;
      }

      // Second/third logic: if not dropped on a belt, flick only with force; otherwise return.
      const flickData = this.getJamBeetleFlickData(pointer);
      if (flickData.isFlick) {
        this.tossJamBeetle(draggedItem, flickData);
        return;
      }

      draggedItem.ignoreTapUntilMs = (this.time?.now ?? Date.now()) + 120;
      this.animateReturnToSlot(draggedItem, this.dragContext.fromSlot);
      return;
    }

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

  getJamBeetleFlickData(pointer) {
    const context = this.dragContext || {};
    const now = this.time?.now ?? Date.now();

    const fallbackX = Phaser.Math.Between(-1, 1) || 1;
    const fallbackY = -1;

    const startX = Number.isFinite(context.dragStartX) ? context.dragStartX : Number(pointer?.downX);
    const startY = Number.isFinite(context.dragStartY) ? context.dragStartY : Number(pointer?.downY);
    const dropX = Number.isFinite(pointer?.worldX)
      ? pointer.worldX
      : Number.isFinite(pointer?.x)
        ? pointer.x
        : Number.isFinite(context.lastDragX)
          ? context.lastDragX
          : startX;
    const dropY = Number.isFinite(pointer?.worldY)
      ? pointer.worldY
      : Number.isFinite(pointer?.y)
        ? pointer.y
        : Number.isFinite(context.lastDragY)
          ? context.lastDragY
          : startY;

    const segmentStartX = Number.isFinite(context.prevDragX) ? context.prevDragX : startX;
    const segmentStartY = Number.isFinite(context.prevDragY) ? context.prevDragY : startY;
    const segmentEndX = Number.isFinite(context.lastDragX) ? context.lastDragX : dropX;
    const segmentEndY = Number.isFinite(context.lastDragY) ? context.lastDragY : dropY;

    const totalDistance = Phaser.Math.Distance.Between(startX, startY, dropX, dropY);
    const segmentDistance = Phaser.Math.Distance.Between(segmentStartX, segmentStartY, segmentEndX, segmentEndY);

    const segmentStartTime = Number.isFinite(context.prevDragTime) ? context.prevDragTime : (Number.isFinite(context.dragStartTime) ? context.dragStartTime : now - 16);
    const segmentEndTime = Number.isFinite(context.lastDragTime) ? context.lastDragTime : now;
    const segmentDurationMs = Math.max(16, segmentEndTime - segmentStartTime);
    const dragStartTime = Number.isFinite(context.dragStartTime) ? context.dragStartTime : now - 16;
    const dragDurationMs = Math.max(16, now - dragStartTime);

    const segmentSpeed = (segmentDistance / segmentDurationMs) * 1000;
    const averageSpeed = (totalDistance / dragDurationMs) * 1000;
    const pointerVelocityX = Number(pointer?.velocity?.x);
    const pointerVelocityY = Number(pointer?.velocity?.y);
    const pointerSpeed = Number.isFinite(pointerVelocityX) && Number.isFinite(pointerVelocityY)
      ? Math.hypot(pointerVelocityX, pointerVelocityY) * 1000
      : 0;

    const releaseSpeed = Math.max(segmentSpeed, averageSpeed, pointerSpeed);
    const isFlick = totalDistance >= JAM_BEETLE_FLICK_MIN_DISTANCE && releaseSpeed >= JAM_BEETLE_FLICK_MIN_SPEED;

    let directionX = segmentEndX - segmentStartX;
    let directionY = segmentEndY - segmentStartY;
    if (Math.hypot(directionX, directionY) < 0.01) {
      directionX = dropX - startX;
      directionY = dropY - startY;
    }
    if (Math.hypot(directionX, directionY) < 0.01) {
      directionX = fallbackX;
      directionY = fallbackY;
    }

    const directionLength = Math.max(0.0001, Math.hypot(directionX, directionY));
    const normalizedX = directionX / directionLength;
    const normalizedY = directionY / directionLength;
    const launchSpeed = Phaser.Math.Clamp(releaseSpeed * 0.45, JAM_BEETLE_TOSS_MIN_SPEED, JAM_BEETLE_TOSS_MAX_SPEED);

    return {
      isFlick,
      velocityX: normalizedX * launchSpeed,
      velocityY: normalizedY * launchSpeed,
      totalDistance,
      releaseSpeed
    };
  }

  tossJamBeetle(item, flickData) {
    if (!item || !item.isJamBeetle) {
      this.finishDragResolution();
      return;
    }

    const originX = item.x;
    const originY = item.y;
    const textureKey = item.itemVisual?.texture?.key;
    const hasTextureKey = typeof textureKey === 'string' && this.textures.exists(textureKey);
    const spriteKey = hasTextureKey ? textureKey : 'fx_dot';

    const itemScaleX = Number(item.itemVisual?.scaleX) || 1;
    const itemScaleY = Number(item.itemVisual?.scaleY) || 1;
    const containerScaleX = Number(item.container?.scaleX) || 1;
    const containerScaleY = Number(item.container?.scaleY) || 1;
    const worldScaleX = itemScaleX * containerScaleX;
    const worldScaleY = itemScaleY * containerScaleY;

    this.removeItemById(item.id);
    this.finishDragResolution();

    if (!this.physics?.add) {
      return;
    }

    const tossed = this.physics.add.sprite(originX, originY, spriteKey).setDepth(260);
    tossed.setScale(worldScaleX, worldScaleY);
    tossed.setAlpha(1);
    tossed.setAngle(Number(item.container?.angle) || 0);

    if (item.isJamBeetle && this.anims.exists(JAM_BEETLE_ANIM_KEY)) {
      tossed.play(JAM_BEETLE_ANIM_KEY);
    }

    const velocityX = Number.isFinite(flickData?.velocityX)
      ? flickData.velocityX
      : (Phaser.Math.Between(-1, 1) || 1) * JAM_BEETLE_TOSS_MIN_SPEED;
    const velocityY = Number.isFinite(flickData?.velocityY)
      ? flickData.velocityY
      : -JAM_BEETLE_TOSS_MIN_SPEED;

    tossed.setCollideWorldBounds(true);
    tossed.setBounce(0.58, 0.58);
    tossed.setDamping(true);
    tossed.setDrag(320, 320);
    tossed.setVelocity(velocityX, velocityY);
    tossed.setAngularVelocity(Phaser.Math.Between(-180, 180));

    this.emitTransferParticles(originX, originY, item.baseColor, 15);
    this.emitShockRing(originX, originY, 0xfb7185, 1.7, 170);
    this.playImpactFx(0.72, 0xf97316);
    this.playSfx('swap', 1.05);
    this.rumble(0.3, 0.24, 94);

    this.tweens.add({
      targets: tossed,
      alpha: 0.35,
      scaleX: worldScaleX * 0.7,
      scaleY: worldScaleY * 0.7,
      duration: JAM_BEETLE_TOSS_TOTAL_DURATION_MS,
      ease: 'Sine.Out',
      onComplete: () => {
        if (tossed?.active) {
          this.emitBloodParticles(tossed.x, tossed.y, 1);
          this.emitJamParticles({ x: tossed.x, y: tossed.y, baseColor: item.baseColor });
          this.emitShockRing(tossed.x, tossed.y, 0xb91c1c, 1.85, 180);
          tossed.destroy();
        }
      }
    });
  }

  handleJamBeetleTap(itemId, _pointer = null, force = false) {
    if (this.isPaused || this.isDraftActive || this.isGameOver || this.sceneTransitioning) {
      return;
    }

    const item = this.getItemById(itemId);
    if (!item || !item.isJamBeetle || item.state === 'consuming' || item.state === 'dragging') {
      return;
    }

    const now = this.time?.now ?? Date.now();
    if (!force && Number.isFinite(item.ignoreTapUntilMs) && now < item.ignoreTapUntilMs) {
      return;
    }

    item.splatTapCount = (item.splatTapCount || 0) + 1;
    if (item.splatTapCount >= JAM_BEETLE_TAPS_TO_SPLAT) {
      this.splatJamBeetle(item);
      return;
    }

    this.playSfx('jam', 0.76);
    this.playImpactFx(0.36, 0xfb7185);
    this.emitShockRing(item.x, item.y, 0xfb7185, 1.35, 140);

    this.tweens.killTweensOf(item.container);
    item.container.setAngle(0);
    this.tweens.add({
      targets: item.container,
      scaleX: 1.14,
      scaleY: 1.14,
      angle: Phaser.Math.Between(-11, 11),
      duration: 74,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => {
        if (!item.container?.active) {
          return;
        }

        item.container.setScale(1);
        item.container.setAngle(0);
      }
    });
  }

  splatJamBeetle(item) {
    if (!item || !item.isJamBeetle) {
      return;
    }

    const splatX = item.x;
    const splatY = item.y;

    this.emitBloodParticles(splatX, splatY, 1.25);
    this.emitJamParticles(item);
    this.emitTransferParticles(splatX, splatY, item.baseColor, 14);
    this.emitShockRing(splatX, splatY, 0xfb7185, 2.55, 230);
    this.emitFloatingText(splatX, splatY - 26, 'SPLAT!', '#ffdce2', 24);
    this.playImpactFx(1.24, 0xfb7185);
    this.playSfx('jam', 1.28);
    this.rumble(0.48, 0.36, 136);

    this.removeItemById(item.id);
    if (this.dragContext?.itemId === item.id) {
      this.finishDragResolution();
    }
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

    const rows = this.clawRows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return;
    }

    const laneIds = this.laneLayout.map((laneConfig) => laneConfig.id);
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

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || !Array.isArray(row.laneIds) || row.laneIds.length === 0) {
        continue;
      }

      const nextRowPos = i + 1 < rows.length ? rows[i + 1].mainPos : null;
      const candidate = findCandidateNearRow(row.mainPos, nextRowPos);
      if (!candidate) {
        continue;
      }

      const routeAssistActive = this.inserterCalibrationMs > 0 || candidate.predictivePullBoosted;
      const predictiveBias = candidate.predictivePullBoosted ? this.predictivePullBiasWeight : 0;

      const candidateLaneIds = i === 0 && rows.length > 1 ? laneIds : row.laneIds;
      const bestLane = pickBalancedLane(candidateLaneIds, candidate.type, predictiveBias, routeAssistActive);
      if (!bestLane || !row.laneIds.includes(bestLane)) {
        continue;
      }

      candidate.mainPos = Math.min(candidate.mainPos, row.mainPos);
      this.transferToLane(candidate, bestLane);
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
    const startY = this.getMainWorldY(item.mainPos);
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

    const pickDuration = Phaser.Math.Clamp((70 * CLAW_TIMING_SCALE) / speedFactor, 34, 96);
    const rotateDuration = Phaser.Math.Clamp((210 * CLAW_TIMING_SCALE) / speedFactor, 96, 260);
    const dropDuration = Phaser.Math.Clamp((80 * CLAW_TIMING_SCALE) / speedFactor, 34, 98);
    const returnDuration = Phaser.Math.Clamp((180 * CLAW_TIMING_SCALE) / speedFactor, 86, 230);
    const anticipationDuration = Phaser.Math.Clamp((64 * CLAW_TIMING_SCALE) / speedFactor, 30, 82);
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
      this.refreshScoreUi();
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
    const pickDuration = Phaser.Math.Clamp((70 * CLAW_TIMING_SCALE) / speedFactor, 34, 96);
    const rotateDuration = Phaser.Math.Clamp((210 * CLAW_TIMING_SCALE) / speedFactor, 96, 260);
    const returnDuration = Phaser.Math.Clamp((180 * CLAW_TIMING_SCALE) / speedFactor, 86, 230);
    const anticipationDuration = Phaser.Math.Clamp((58 * CLAW_TIMING_SCALE) / speedFactor, 26, 74);
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

    for (const laneConfig of this.laneLayout) {
      const lane = this.lanesById[laneConfig.id];
      const laneItems = this.items
        .filter((item) => item.laneId === lane.id && (item.state === 'side' || item.state === 'jammed'))
        .sort((a, b) => b.lanePos - a.lanePos);

      let frontPos = null;
      for (const item of laneItems) {
        const maxAllowedPos = frontPos === null ? lane.length : Math.max(0, frontPos - sideSpacing);

        if (item.state === 'jammed') {
          item.lanePos = Math.min(item.lanePos, maxAllowedPos);

          if (chestPriorityActive && !item.motionLock && !item.isJamBeetle) {
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

            const isJamBeetle = item.isJamBeetle === true;
            const isCorrectLane = !isJamBeetle && item.type === lane.desiredType;
            const shouldGraceAccept = !isJamBeetle && !isCorrectLane && chestPriorityActive;

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
        item.y = this.getMainWorldY(item.mainPos);
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
