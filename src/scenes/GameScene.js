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
const CHEST_CLOSED_KEY = 'chest_closed';
const CHEST_OPENED_KEY = 'chest_opened';

function findFirstMatchUrl(spriteGlob, matcher) {
  const match = Object.entries(spriteGlob).find(([path]) => matcher.test(path));
  return match ? match[1] : null;
}

const CHEST_CLOSED_URL = findFirstMatchUrl(CHEST_SPRITE_GLOB, /closed\.png$/i);
const CHEST_OPENED_URL = findFirstMatchUrl(CHEST_SPRITE_GLOB, /opened\.png$/i);

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
    chestX: 130,
    chestLabel: 'Carbs Chest'
  },
  {
    id: 'mid_right',
    label: 'Protein',
    desiredType: 'protein',
    y: 300,
    direction: 1,
    endX: 1090,
    chestX: 1150,
    chestLabel: 'Protein Chest'
  },
  {
    id: 'bot_left',
    label: 'Greens',
    desiredType: 'greens',
    y: 500,
    direction: -1,
    endX: 190,
    chestX: 130,
    chestLabel: 'Greens Chest'
  },
  {
    id: 'bot_right',
    label: 'Condiments',
    desiredType: 'condiments',
    y: 500,
    direction: 1,
    endX: 1090,
    chestX: 1150,
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

    this.chestParticles = null;

    this.isGameOver = false;
    this.clogTimerSeconds = 0;
    this.clogGraceSeconds = 1.4;
    this.gameOverOverlay = null;
    this.gameOverText = null;

    this.dragContext = null;
    this.simTimeScale = 1;
    this.dragSlowMoScale = 0.18;

    this.mainBeltLines = null;
    this.mainBeltLineConfig = null;

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
    this.createScoreUi();
    this.createParticles();
    this.setupGrabControls();
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
  }

  emitChestConsumeParticles(item, lane) {
    if (!this.chestParticles) {
      return;
    }

    this.chestParticles.setParticleTint(item.baseColor ?? 0xffffff);
    this.chestParticles.explode(16, lane.chestX, lane.y);
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

  handleComboConsume() {
    const basePoints = 100;
    this.score += basePoints * this.multiplier;
    this.multiplier = Math.min(this.multiplier + 1, this.maxMultiplier);
    this.refreshScoreUi();
    this.bumpUiText(this.scoreText, 1.06, 85);
    this.bumpUiText(this.multiplierText, 1.22, 105);
  }

  breakCombo() {
    if (this.multiplier <= 1) {
      return;
    }

    this.multiplier = 1;
    this.refreshScoreUi();

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
    if (this.isGameOver) {
      return;
    }

    const scaledDeltaMs = delta * this.simTimeScale;
    const dt = scaledDeltaMs / 1000;

    this.updateDifficulty();

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
    this.setSlowMotion(false);

    if (this.dragContext) {
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
        draggedItem.grabHandle.setPosition(destination.x, destination.y);
      }

      this.dragContext = null;
    }

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
    this.add.rectangle(this.mainX, 360, MAIN_BELT_WIDTH, MAIN_BELT_HEIGHT, 0x1e293b, 1).setStrokeStyle(2, 0x475569, 1);
    this.mainBeltLines = this.add.graphics();
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

      this.add
        .rectangle(laneCenterX, laneConfig.y, laneWidth, SIDE_BELT_HEIGHT, 0x1e293b, 1)
        .setStrokeStyle(2, 0x475569, 1);
      const beltLines = this.add.graphics();
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
      const clawMarker = this.add.circle(clawX, laneConfig.y, CLAW_RADIUS, 0x94a3b8, 1).setStrokeStyle(2, laneColor, 1);

      this.lanesById[laneConfig.id] = {
        ...laneConfig,
        intakeX,
        length: laneWidth,
        beltLines,
        beltLineConfig,
        clawMarker,
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

    if (this.mainBeltLines && this.mainBeltLineConfig) {
      const spacing = this.mainBeltLineConfig.spacing;
      this.mainBeltLineConfig.offset = (this.mainBeltLineConfig.offset + this.mainSpeed * dt) % spacing;
      this.mainBeltLines.clear();
      drawConveyorLines(this.mainBeltLines, this.mainBeltLineConfig);
    }

    for (const lane of Object.values(this.lanesById)) {
      if (!lane?.beltLines || !lane.beltLineConfig) {
        continue;
      }

      const spacing = lane.beltLineConfig.spacing;
      lane.beltLineConfig.offset = (lane.beltLineConfig.offset + this.sideSpeed * dt * lane.direction) % spacing;
      lane.beltLines.clear();
      drawConveyorLines(lane.beltLines, lane.beltLineConfig);
    }
  }

  updateDifficulty() {
    const steps = this.scoreRampStepPoints > 0 ? Math.floor(this.score / this.scoreRampStepPoints) : 0;

    const targetMainSpeed = this.baseMainSpeed + steps * this.mainSpeedPerStep;
    const targetSideSpeed = this.baseSideSpeed + steps * this.sideSpeedPerStep;
    const targetSpawnIntervalMs = this.baseSpawnIntervalMs - steps * this.spawnIntervalDecreasePerStepMs;

    this.mainSpeed = Phaser.Math.Clamp(targetMainSpeed, this.baseMainSpeed, this.maxMainSpeed);
    this.sideSpeed = Phaser.Math.Clamp(targetSideSpeed, this.baseSideSpeed, this.maxSideSpeed);
    this.spawnIntervalMs = Phaser.Math.Clamp(targetSpawnIntervalMs, this.minSpawnIntervalMs, this.baseSpawnIntervalMs);
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
    container.setScale(0.25);
    this.tweens.add({
      targets: container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 170,
      ease: 'Back.Out'
    });
    const grabSize = FOOD_RENDER_SIZE * 1.15;
    const grabHandle = this.add.zone(this.mainX, this.mainStartY, grabSize, grabSize).setDepth(11);
    grabHandle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(grabHandle);
    grabHandle.setData('itemId', itemId);
    grabHandle.input.cursor = 'grab';

    this.items.push({
      id: itemId,
      type: food.id,
      x: this.mainX,
      y: this.mainStartY,
      mainPos: 0,
      lanePos: 0,
      state: 'main',
      laneId: null,
      motionLock: false,
      container,
      grabHandle,
      itemVisual,
      baseColor: food.color
    });

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

      if (Math.abs(item.lanePos - lanePos) < this.itemSpacing) {
        return false;
      }
    }

    return true;
  }

  handleDragStart(_pointer, gameObject) {
    if (this.dragContext) {
      return;
    }

    const itemId = gameObject.getData('itemId');
    const item = this.getItemById(itemId);
    if (!item || item.state === 'consuming') {
      return;
    }

    this.dragContext = {
      itemId,
      fromSlot: this.captureItemSlot(item)
    };

    item.state = 'dragging';
    item.motionLock = true;
    this.setSlowMotion(true);

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
    this.simTimeScale = shouldSlow ? this.dragSlowMoScale : 1;
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

    const pickBalancedLane = (candidateLaneIds) => {
      let minFill = Number.POSITIVE_INFINITY;
      const best = [];

      for (const laneId of candidateLaneIds) {
        if (!this.canEnterLane(laneId)) {
          continue;
        }

        const fill = laneFillCount[laneId] ?? 0;
        if (fill < minFill) {
          minFill = fill;
          best.length = 0;
          best.push(laneId);
          continue;
        }

        if (fill === minFill) {
          best.push(laneId);
        }
      }

      if (best.length === 0) {
        return null;
      }

      return Phaser.Utils.Array.GetRandom(best);
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
        const bestOverall = pickBalancedLane(laneIds);
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
        const bestBottom = pickBalancedLane([row.leftLaneId, row.rightLaneId]);
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
    return closestToIntake >= this.itemSpacing;
  }

  transferToLane(item, laneId) {
    const lane = this.lanesById[laneId];

    const startX = this.mainX;
    const startY = this.mainStartY + item.mainPos;
    const destinationX = lane.intakeX;
    const destinationY = lane.y;

    item.holdMainPos = null;
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
    this.tweens.add({
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
      }
    });

    lane.clawMarker.setScale(1.28);
    this.tweens.add({
      targets: lane.clawMarker,
      scale: 1,
      duration: 120,
      ease: 'Quad.Out'
    });
  }

  updateSideBelts(dt) {
    for (const laneConfig of LANE_LAYOUT) {
      const lane = this.lanesById[laneConfig.id];
      const laneItems = this.items
        .filter((item) => item.laneId === lane.id && (item.state === 'side' || item.state === 'jammed'))
        .sort((a, b) => b.lanePos - a.lanePos);

      let frontPos = null;
      for (const item of laneItems) {
        const maxAllowedPos = frontPos === null ? lane.length : Math.max(0, frontPos - this.itemSpacing);

        if (item.state === 'side') {
          if (item.motionLock) {
            item.lanePos = Math.min(item.lanePos, maxAllowedPos);
            frontPos = item.lanePos;
            continue;
          }

          item.lanePos = Math.min(item.lanePos + this.sideSpeed * dt, maxAllowedPos);

          if (item.lanePos >= lane.length) {
            item.lanePos = lane.length;

            if (item.type === lane.desiredType) {
              this.acceptedCount += 1;
              this.handleComboConsume();
              this.startChestIntake(item, lane);
            } else {
              item.state = 'jammed';
              this.rejectedCount += 1;
              this.breakCombo();
              this.applyItemStateTint(item, 0x64748b);

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
