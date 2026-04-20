import Phaser from 'phaser';
import { DEBUG_LEVEL_ID, getCampaignLevels } from '../data/levels';
import { getCompletedCampaignLevelIds } from '../data/campaignProgress';

const FOOD_COLORS = {
  condiments: 0xf97316,
  carbs: 0xeab308,
  protein: 0xef4444,
  greens: 0x22c55e
};

const FOOD_PREVIEW_GLOBS = {
  condiments: import.meta.glob('../../assets/sprites/condiments/*.png', { eager: true, import: 'default' }),
  carbs: import.meta.glob('../../assets/sprites/carb/*.png', { eager: true, import: 'default' }),
  protein: import.meta.glob('../../assets/sprites/protein/*.png', { eager: true, import: 'default' }),
  greens: import.meta.glob('../../assets/sprites/greens/*.png', { eager: true, import: 'default' })
};

function pickPreviewUrl(spriteGlob) {
  const sorted = Object.entries(spriteGlob).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return sorted.length > 0 ? sorted[0][1] : null;
}

const FOOD_PREVIEW_TEXTURES = Object.entries(FOOD_PREVIEW_GLOBS).reduce((acc, [foodId, glob]) => {
  const key = `level_select_${foodId}`;
  acc[foodId] = {
    key,
    url: pickPreviewUrl(glob)
  };
  return acc;
}, {});

const SELECT_DISPLAY_FONT = "'Lilita One', 'Bebas Neue', 'Segoe UI', sans-serif";
const SELECT_UI_FONT = "'Nunito', 'Rajdhani', 'Segoe UI', sans-serif";

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');

    this.levelEntries = [];
    this.levelTiles = [];
    this.completedCampaignLevelIds = new Set();
    this.selectedIndex = 0;
    this.gridColumns = 3;
    this.isTransitioning = false;
  }

  preload() {
    Object.values(FOOD_PREVIEW_TEXTURES).forEach((textureInfo) => {
      if (!textureInfo?.url) {
        return;
      }

      if (!this.textures.exists(textureInfo.key)) {
        this.load.image(textureInfo.key, textureInfo.url);
      }
    });
  }

  create(data) {
    this.isTransitioning = false;
    this.levelEntries = getCampaignLevels();
    this.levelTiles = [];
    this.completedCampaignLevelIds = getCompletedCampaignLevelIds();

    const fallbackUnlockedIndex = this.getHighestUnlockedLevelIndex();

    const rememberedId = data?.selectedLevelId;
    if (rememberedId) {
      const index = this.levelEntries.findIndex((entry) => entry.id === rememberedId);
      this.selectedIndex = index >= 0 ? index : fallbackUnlockedIndex;
    } else {
      this.selectedIndex = fallbackUnlockedIndex;
    }

    if (this.isLevelLocked(this.selectedIndex)) {
      this.selectedIndex = fallbackUnlockedIndex;
    }

    this.add.rectangle(640, 360, 1280, 720, 0x2a100a, 1).setDepth(-20);

    const grid = this.add.graphics().setDepth(-19);
    grid.lineStyle(1, 0x7a4327, 0.16);
    for (let x = 40; x <= 1240; x += 86) {
      grid.lineBetween(x, 0, x, 720);
    }
    for (let y = 24; y <= 696; y += 72) {
      grid.lineBetween(0, y, 1280, y);
    }

    const topOrb = this.add.circle(220, 128, 270, 0xf59e0b, 0.16).setDepth(-18).setBlendMode(Phaser.BlendModes.ADD);
    const bottomOrb = this.add.circle(1048, 600, 320, 0xfb7185, 0.12).setDepth(-18).setBlendMode(Phaser.BlendModes.ADD);
    const backdropPlate = this.add
      .rectangle(640, 364, 1172, 610, 0x4a2012, 0.54)
      .setStrokeStyle(2, 0xf5c285, 0.7)
      .setDepth(-17);

    this.tweens.add({
      targets: [topOrb, bottomOrb],
      alpha: { from: 0.08, to: 0.2 },
      duration: 3800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
    this.tweens.add({
      targets: backdropPlate,
      alpha: { from: 0.66, to: 0.82 },
      duration: 3100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    const title = this.add
      .text(640, 78, 'CAMPAIGN', {
        fontFamily: SELECT_DISPLAY_FONT,
        fontSize: '74px',
        color: '#fff0da',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(2)
      .setShadow(0, 4, '#31140c', 12);

    const topDecorFoods = ['greens', 'protein', 'carbs', 'condiments'];
    topDecorFoods.forEach((foodId, index) => {
      const decorX = 430 + index * 140;
      const decorObjects = this.createFoodIcon(foodId, decorX, 132, 40);
      decorObjects.forEach((obj) => {
        obj.setDepth(20);
        obj.setAlpha(0.95);
      });
    });

    this.tweens.add({
      targets: title,
      scaleX: { from: 0.99, to: 1.02 },
      scaleY: { from: 0.99, to: 1.02 },
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
    const entryCount = this.levelEntries.length;
    if (entryCount > 10) {
      this.gridColumns = 5;
    } else if (entryCount > 6) {
      this.gridColumns = 4;
    } else {
      this.gridColumns = 3;
    }

    const tileWidth = this.gridColumns === 5 ? 226 : this.gridColumns === 4 ? 266 : 316;
    const tileHeight = this.gridColumns === 5 ? 156 : this.gridColumns === 4 ? 176 : 198;
    const gapX = this.gridColumns === 5 ? 16 : 20;
    const gapY = this.gridColumns === 5 ? 18 : 22;

    const rows = Math.ceil(entryCount / this.gridColumns);
    const totalWidth = this.gridColumns * tileWidth + (this.gridColumns - 1) * gapX;
    const totalHeight = rows * tileHeight + (rows - 1) * gapY;

    const gridTop = 148;
    const gridBottom = 662;
    const gridAreaHeight = gridBottom - gridTop;
    const centeredTop = gridTop + Math.max(0, (gridAreaHeight - totalHeight) * 0.5);

    const startX = (1280 - totalWidth) * 0.5 + tileWidth * 0.5;
    const startY = centeredTop + tileHeight * 0.5;

    this.levelEntries.forEach((entry, index) => {
      const col = index % this.gridColumns;
      const row = Math.floor(index / this.gridColumns);
      const x = startX + col * (tileWidth + gapX);
      const y = startY + row * (tileHeight + gapY);

      const tile = this.createLevelTile(x, y, tileWidth, tileHeight, entry, index);
      this.levelTiles.push(tile);

      const introTargets = [
        tile.shadow,
        tile.background,
        tile.accentRail,
        tile.highlight,
        tile.badge,
        tile.badgeLabel,
        tile.quotaChip,
        tile.quotaLabel,
        tile.titleText,
        tile.subtitleText,
        ...tile.matchupVisual
      ];
      introTargets.forEach((obj) => obj.setAlpha(0));
      this.tweens.add({
        targets: introTargets,
        alpha: 1,
        delay: 130 + index * 34,
        duration: 260,
        ease: 'Quad.Out'
      });
    });

    this.add
      .text(640, 688, 'Arrows/WASD + Enter/Space', {
        fontFamily: SELECT_UI_FONT,
        fontSize: '24px',
        color: '#ffd9af',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.8)
      .setAlpha(0.92);

    this.refreshSelectionVisuals();

    this.input.keyboard?.on('keydown-LEFT', this.moveSelectionLeft, this);
    this.input.keyboard?.on('keydown-A', this.moveSelectionLeft, this);
    this.input.keyboard?.on('keydown-RIGHT', this.moveSelectionRight, this);
    this.input.keyboard?.on('keydown-D', this.moveSelectionRight, this);
    this.input.keyboard?.on('keydown-UP', this.moveSelectionUp, this);
    this.input.keyboard?.on('keydown-DOWN', this.moveSelectionDown, this);
    this.input.keyboard?.on('keydown-W', this.moveSelectionUp, this);
    this.input.keyboard?.on('keydown-S', this.moveSelectionDown, this);
    this.input.keyboard?.on('keydown-ENTER', this.launchSelectedLevel, this);
    this.input.keyboard?.on('keydown-SPACE', this.launchSelectedLevel, this);
    this.input.keyboard?.on('keydown', this.handleDebugShortcut, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-LEFT', this.moveSelectionLeft, this);
      this.input.keyboard?.off('keydown-A', this.moveSelectionLeft, this);
      this.input.keyboard?.off('keydown-RIGHT', this.moveSelectionRight, this);
      this.input.keyboard?.off('keydown-D', this.moveSelectionRight, this);
      this.input.keyboard?.off('keydown-UP', this.moveSelectionUp, this);
      this.input.keyboard?.off('keydown-DOWN', this.moveSelectionDown, this);
      this.input.keyboard?.off('keydown-W', this.moveSelectionUp, this);
      this.input.keyboard?.off('keydown-S', this.moveSelectionDown, this);
      this.input.keyboard?.off('keydown-ENTER', this.launchSelectedLevel, this);
      this.input.keyboard?.off('keydown-SPACE', this.launchSelectedLevel, this);
      this.input.keyboard?.off('keydown', this.handleDebugShortcut, this);
    });
  }

  createLevelTile(x, y, width, height, entry, index) {
    const compact = width <= 240;
    const quotaValue = Number.isFinite(entry.quota) ? Math.max(0, Math.floor(entry.quota)) : 0;
    const title = `LEVEL ${entry.index}`;
    const subtitle = '';
    const shiftLabel = `L${entry.index}`;

    const shadow = this.add.rectangle(x, y + 7, width, height, 0x010611, 0.48);
    const background = this.add
      .rectangle(x, y, width, height, 0x7a4327, 0.94)
      .setStrokeStyle(2, 0xf0bd85, 0.95)
      .setInteractive({ useHandCursor: true });
    const accentRail = this.add.rectangle(x - width * 0.5 + 6, y, 10, height - 12, 0xf97316, 0.68);
    const highlight = this.add
      .rectangle(x, y - height * 0.5 + 24, width - 18, 34, 0xffffff, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);

    const badge = this.add
      .rectangle(
        x - width * 0.5 + (compact ? 58 : 74),
        y - height * 0.5 + (compact ? 22 : 26),
        compact ? 100 : 126,
        compact ? 26 : 30,
        0xbd6a38,
        0.92
      )
      .setStrokeStyle(1, 0xffe3c1, 1);

    const badgeLabel = this.add
      .text(badge.x, badge.y, shiftLabel, {
        fontFamily: SELECT_DISPLAY_FONT,
        fontSize: compact ? '18px' : '20px',
        color: '#fff3df'
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.6);

    const quotaChip = this.add
      .rectangle(
        x + width * 0.5 - (compact ? 40 : 56),
        y - height * 0.5 + (compact ? 22 : 26),
        compact ? 58 : 74,
        compact ? 26 : 30,
        0x2c8059,
        0.92
      )
      .setStrokeStyle(1, 0xcdf6df, 0.95);

    const quotaLabel = this.add
      .text(quotaChip.x, quotaChip.y, `${quotaValue}`, {
        fontFamily: SELECT_DISPLAY_FONT,
        fontSize: compact ? '20px' : '24px',
        color: '#eefdf4'
      })
      .setOrigin(0.5);

    const titleText = this.add
      .text(x - width * 0.5 + (compact ? 12 : 18), y - height * 0.5 + (compact ? 58 : 64), title, {
        fontFamily: SELECT_DISPLAY_FONT,
        fontSize: compact ? '24px' : '34px',
        color: '#fff4e4',
        wordWrap: { width: width - (compact ? 24 : 38), useAdvancedWrap: true }
      })
      .setOrigin(0, 0.5);

    const subtitleText = this.add
      .text(x - width * 0.5 + (compact ? 12 : 18), y - height * 0.5 + (compact ? 82 : 94), subtitle, {
        fontFamily: SELECT_UI_FONT,
        fontSize: compact ? '12px' : '16px',
        color: '#ffd6ab',
        wordWrap: { width: width - (compact ? 24 : 38), useAdvancedWrap: true }
      })
      .setOrigin(0, 0.5);

    subtitleText.setVisible(false);

    const matchupVisual = this.createMatchupVisual(entry, x, y + (compact ? 42 : 46), compact);
    const matchupMaskSource = this.add.graphics().setVisible(false);
    matchupMaskSource.fillStyle(0xffffff, 1);
    matchupMaskSource.fillRect(x - width * 0.5 + 8, y - height * 0.5 + 44, width - 16, height - 52);
    const matchupMask = matchupMaskSource.createGeometryMask();

    matchupVisual.forEach((obj) => {
      obj.setMask(matchupMask);
      obj.setData('uiBaseScaleX', obj.scaleX);
      obj.setData('uiBaseScaleY', obj.scaleY);
    });

    const isLocked = this.isLevelLocked(index);
    const lockDimmer = this.add.rectangle(x, y, width - 4, height - 4, 0x130804, isLocked ? 0.52 : 0);
    const lockedLabel = this.add
      .text(x, y - height * 0.5 + (compact ? 18 : 22), 'Locked', {
        fontFamily: SELECT_DISPLAY_FONT,
        fontSize: compact ? '20px' : '24px',
        color: '#fff2dc',
        stroke: '#3a1a10',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setAlpha(isLocked ? 1 : 0)
      .setDepth(lockDimmer.depth + 1)
      .setLetterSpacing(1);

    const pick = () => {
      this.selectedIndex = index;
      this.refreshSelectionVisuals();
      this.launchSelectedLevel();
    };

    background.on('pointerover', () => {
      this.selectedIndex = index;
      this.refreshSelectionVisuals();
    });
    background.on('pointerdown', pick);

    return {
      entry,
      shadow,
      background,
      accentRail,
      highlight,
      badge,
      badgeLabel,
      quotaChip,
      quotaLabel,
      titleText,
      subtitleText,
      matchupVisual,
      matchupMaskSource,
      lockDimmer,
      lockedLabel,
      isLocked,
      index,
      selectionTween: null
    };
  }

  normalizeLevelId(levelId) {
    if (typeof levelId !== 'string') {
      return '';
    }

    return levelId.trim().toUpperCase();
  }

  isLevelLocked(index) {
    if (index <= 0) {
      return false;
    }

    const previousEntry = this.levelEntries[index - 1];
    const previousLevelId = this.normalizeLevelId(previousEntry?.id);
    if (!previousLevelId) {
      return false;
    }

    return !this.completedCampaignLevelIds.has(previousLevelId);
  }

  getHighestUnlockedLevelIndex() {
    if (this.levelEntries.length <= 1) {
      return 0;
    }

    let highestUnlockedIndex = 0;
    for (let index = 1; index < this.levelEntries.length; index += 1) {
      if (this.isLevelLocked(index)) {
        break;
      }

      highestUnlockedIndex = index;
    }

    return highestUnlockedIndex;
  }

  createMatchupVisual(entry, x, y, compact = false) {
    const objects = [];
    const foods = Array.isArray(entry.foods) ? entry.foods : [];

    const displayFoods = foods.length > 0 ? foods.slice(0, 4) : ['carbs', 'protein'];

    if (displayFoods.length === 2) {
      const leftFood = displayFoods[0];
      const rightFood = displayFoods[1];
      const offsetX = compact ? 38 : 54;
      const iconSize = compact ? 30 : 44;

      objects.push(...this.createFoodIcon(leftFood, x - offsetX, y, iconSize));
      objects.push(...this.createFoodIcon(rightFood, x + offsetX, y, iconSize));

      const divider = this.add.circle(x, y, compact ? 4 : 6, 0xffefda, 0.9);
      objects.push(divider);

      return objects;
    }

    const spacing = compact ? 34 : 58;
    const iconSize = compact ? 26 : 42;
    const startX = x - ((displayFoods.length - 1) * spacing) * 0.5;
    displayFoods.forEach((foodId, index) => {
      objects.push(...this.createFoodIcon(foodId, startX + index * spacing, y, iconSize));
    });

    return objects;
  }

  createFoodIcon(foodId, x, y, size) {
    const objects = [];
    const textureInfo = FOOD_PREVIEW_TEXTURES[foodId];
    const fallbackColor = FOOD_COLORS[foodId] || 0x64748b;

    const frame = this.add.circle(x, y, size * 0.56, 0xffedd2, 0.94).setStrokeStyle(1, 0xe5aa6b, 0.95);
    objects.push(frame);

    if (textureInfo?.key && this.textures.exists(textureInfo.key)) {
      const image = this.add.image(x, y, textureInfo.key);
      const sourceImage = this.textures.get(textureInfo.key)?.getSourceImage();
      const sourceDim = Math.max(sourceImage?.width || 0, sourceImage?.height || 0);
      const maxDim = Math.max(image.width, image.height, sourceDim);
      if (maxDim > 0) {
        image.setScale((size * 0.9) / maxDim);
      }
      objects.push(image);

      this.tweens.add({
        targets: [frame, image],
        y: { from: y - 2.4, to: y + 2.4 },
        duration: 1700 + Math.random() * 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      this.tweens.add({
        targets: image,
        angle: { from: -6, to: 6 },
        duration: 2300 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    } else {
      const fallback = this.add.circle(x, y, size * 0.36, fallbackColor, 1).setStrokeStyle(1, 0x8a4e2f, 0.95);
      objects.push(fallback);

      this.tweens.add({
        targets: [frame, fallback],
        y: { from: y - 2.4, to: y + 2.4 },
        duration: 1700 + Math.random() * 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }

    return objects;
  }

  moveSelectionLeft() {
    if (this.levelEntries.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex - 1 + this.levelEntries.length) % this.levelEntries.length;
    this.refreshSelectionVisuals();
  }

  moveSelectionRight() {
    if (this.levelEntries.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex + 1) % this.levelEntries.length;
    this.refreshSelectionVisuals();
  }

  moveSelectionUp() {
    if (this.levelEntries.length === 0) {
      return;
    }

    const target = this.selectedIndex - this.gridColumns;
    if (target >= 0) {
      this.selectedIndex = target;
    }

    this.refreshSelectionVisuals();
  }

  moveSelectionDown() {
    if (this.levelEntries.length === 0) {
      return;
    }

    const target = this.selectedIndex + this.gridColumns;
    if (target < this.levelEntries.length) {
      this.selectedIndex = target;
    }

    this.refreshSelectionVisuals();
  }

  refreshSelectionVisuals() {
    this.levelTiles.forEach((tile, index) => {
      const isSelected = index === this.selectedIndex;
      tile.background.setStrokeStyle(isSelected ? 3 : 2, isSelected ? 0xffe4bf : 0xf0bd85, 0.98);
      tile.background.setFillStyle(isSelected ? 0x9a5831 : 0x7a4327, isSelected ? 0.98 : 0.94);
      tile.accentRail.setFillStyle(isSelected ? 0xffb457 : 0xf97316, isSelected ? 0.94 : 0.68);
      tile.highlight.setAlpha(isSelected ? 0.2 : 0.12);
      tile.titleText.setColor(isSelected ? '#fffaf1' : '#fff4e4');
      tile.subtitleText.setColor(isSelected ? '#ffe4c5' : '#ffd6ab');
      tile.badge.setFillStyle(isSelected ? 0xd17d48 : 0xbd6a38, 0.95);
      tile.quotaChip.setFillStyle(isSelected ? 0x39a370 : 0x2c8059, 0.95);
      tile.lockDimmer.setAlpha(tile.isLocked ? (isSelected ? 0.58 : 0.52) : 0);
      tile.lockedLabel.setAlpha(tile.isLocked ? 1 : 0);

      if (tile.selectionTween) {
        tile.selectionTween.remove();
      }

      tile.selectionTween = this.tweens.add({
        targets: [
          tile.shadow,
          tile.background,
          tile.accentRail,
          tile.highlight,
          tile.badge,
          tile.badgeLabel,
          tile.quotaChip,
          tile.quotaLabel,
          tile.titleText,
          tile.subtitleText,
          tile.lockDimmer
        ],
        scaleX: isSelected ? 1.026 : 1,
        scaleY: isSelected ? 1.026 : 1,
        duration: 120,
        ease: 'Quad.Out'
      });

      const iconScaleFactor = isSelected ? 1.06 : 1;
      tile.matchupVisual.forEach((obj) => {
        const baseScaleX = Number(obj.getData('uiBaseScaleX'));
        const baseScaleY = Number(obj.getData('uiBaseScaleY'));
        if (!Number.isFinite(baseScaleX) || !Number.isFinite(baseScaleY)) {
          return;
        }

        obj.setScale(baseScaleX * iconScaleFactor, baseScaleY * iconScaleFactor);
      });
    });
  }

  playLockedTileFeedback(tileIndex) {
    const tile = this.levelTiles[tileIndex];
    if (!tile || !tile.isLocked) {
      return;
    }

    this.tweens.killTweensOf(tile.lockedLabel);
    tile.lockedLabel.setScale(1);
    this.tweens.add({
      targets: tile.lockedLabel,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 90,
      yoyo: true,
      ease: 'Quad.Out'
    });

    this.tweens.killTweensOf(tile.lockDimmer);
    const baseAlpha = tile.index === this.selectedIndex ? 0.58 : 0.52;
    tile.lockDimmer.setAlpha(Math.min(0.72, baseAlpha + 0.14));
    this.tweens.add({
      targets: tile.lockDimmer,
      alpha: baseAlpha,
      duration: 120,
      ease: 'Sine.Out'
    });
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
    this.launchLevelById(DEBUG_LEVEL_ID, 'Loading Debug');
  }

  launchLevelById(levelId, loadingLabel = 'Loading Shift') {
    if (this.isTransitioning || typeof levelId !== 'string' || levelId.length === 0) {
      return;
    }

    const mainMenuScene = this.scene.get('MainMenuScene');
    if (mainMenuScene && typeof mainMenuScene.stopMusicForGameplay === 'function') {
      mainMenuScene.stopMusicForGameplay(0.14);
    }

    this.isTransitioning = true;
    this.scene.start('LoadingScene', {
      targetSceneKey: 'GameScene',
      targetData: { levelId },
      loadingLabel,
      readyLabel: 'Shift Ready'
    });
  }

  launchSelectedLevel() {
    if (this.isTransitioning) {
      return;
    }

    const selected = this.levelEntries[this.selectedIndex];
    if (!selected) {
      return;
    }

    if (this.isLevelLocked(this.selectedIndex)) {
      this.playLockedTileFeedback(this.selectedIndex);
      return;
    }

    this.launchLevelById(selected.id, `Loading ${selected.id}`);
  }
}
