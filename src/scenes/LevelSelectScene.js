import Phaser from 'phaser';
import { getLevelChooserEntries } from '../data/levels';

const FOOD_LABELS = {
  condiments: 'Condiments',
  carbs: 'Carbs',
  protein: 'Protein',
  greens: 'Greens'
};

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

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');

    this.levelEntries = [];
    this.levelTiles = [];
    this.selectedIndex = 0;
    this.gridColumns = 3;
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
    this.levelEntries = getLevelChooserEntries();
    this.levelTiles = [];

    const rememberedId = data?.selectedLevelId;
    if (rememberedId) {
      const index = this.levelEntries.findIndex((entry) => entry.id === rememberedId);
      this.selectedIndex = index >= 0 ? index : 0;
    } else {
      this.selectedIndex = 0;
    }

    this.add.rectangle(640, 360, 1280, 720, 0x020617, 1).setDepth(-10);
    this.add.circle(260, 120, 220, 0x0ea5e9, 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(-9);
    this.add.circle(1040, 620, 260, 0x14b8a6, 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(-9);

    this.add
      .text(640, 72, 'LEVEL CHOOSER', {
        fontFamily: 'Consolas',
        fontSize: '44px',
        color: '#e2e8f0',
        align: 'center'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 116, 'Pick a level card. Each card shows food visuals.', {
        fontFamily: 'Segoe UI',
        fontSize: '18px',
        color: '#94a3b8',
        align: 'center'
      })
      .setOrigin(0.5);

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
    });

    this.add
      .text(640, 688, 'Arrows/WASD to move, Enter/Space or Click to start', {
        fontFamily: 'Consolas',
        fontSize: '16px',
        color: '#7dd3fc',
        align: 'center'
      })
      .setOrigin(0.5);

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
    });
  }

  createLevelTile(x, y, width, height, entry, index) {
    const isEndless = entry.mode === 'endless';
    const compact = width <= 240;
    const quotaValue = Number.isFinite(entry.quota) ? Math.max(0, Math.floor(entry.quota)) : 0;
    const title = isEndless ? 'Aim for the Leaderboards' : `Level ${entry.index} - Pack ${quotaValue} Foods!`;

    const background = this.add
      .rectangle(x, y, width, height, 0x0b1222, 0.98)
      .setStrokeStyle(2, 0x334155, 1)
      .setInteractive({ useHandCursor: true });

    const badgeText = isEndless ? 'ENDLESS' : 'CAMPAIGN';
    const badge = this.add
      .rectangle(
        x - width * 0.5 + (compact ? 46 : 58),
        y - height * 0.5 + (compact ? 22 : 26),
        compact ? 78 : 96,
        compact ? 26 : 30,
        isEndless ? 0x0ea5e9 : 0x1d4ed8,
        0.22
      )
      .setStrokeStyle(2, isEndless ? 0x38bdf8 : 0x60a5fa, 1);

    const badgeLabel = this.add
      .text(badge.x, badge.y, badgeText, {
        fontFamily: 'Consolas',
        fontSize: compact ? '11px' : '13px',
        color: '#e2e8f0'
      })
      .setOrigin(0.5);

    const titleText = this.add
      .text(x - width * 0.5 + (compact ? 12 : 20), y - height * 0.5 + (compact ? 50 : 60), title, {
        fontFamily: 'Segoe UI',
        fontSize: isEndless ? (compact ? '16px' : '22px') : compact ? '14px' : '24px',
        color: '#e2e8f0',
        wordWrap: { width: width - (compact ? 22 : 36), useAdvancedWrap: true }
      })
      .setOrigin(0, 0.5);

    const matchupVisual = this.createMatchupVisual(entry, x, y + (compact ? 24 : 40), compact);

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
      background,
      badge,
      badgeLabel,
      titleText,
      matchupVisual,
      index
    };
  }

  createMatchupVisual(entry, x, y, compact = false) {
    const objects = [];
    const foods = Array.isArray(entry.foods) ? entry.foods : [];

    const displayFoods = foods.length > 0 ? foods.slice(0, 4) : ['carbs', 'protein'];

    if (displayFoods.length === 2) {
      const leftFood = displayFoods[0];
      const rightFood = displayFoods[1];
      const offsetX = compact ? 52 : 64;
      const iconSize = compact ? 40 : 50;
      const labelFontSize = compact ? '11px' : '13px';
      const labelOffsetY = compact ? 36 : 44;

      objects.push(...this.createFoodIcon(leftFood, x - offsetX, y, iconSize));
      objects.push(...this.createFoodIcon(rightFood, x + offsetX, y, iconSize));

      const vsText = this.add
        .text(x, y, 'VS', {
          fontFamily: 'Consolas',
          fontSize: compact ? '16px' : '18px',
          color: '#f8fafc'
        })
        .setOrigin(0.5);
      objects.push(vsText);

      const leftLabel = this.add
        .text(x - offsetX, y + labelOffsetY, FOOD_LABELS[leftFood], {
          fontFamily: 'Consolas',
          fontSize: labelFontSize,
          color: '#93c5fd'
        })
        .setOrigin(0.5);
      objects.push(leftLabel);

      const rightLabel = this.add
        .text(x + offsetX, y + labelOffsetY, FOOD_LABELS[rightFood], {
          fontFamily: 'Consolas',
          fontSize: labelFontSize,
          color: '#93c5fd'
        })
        .setOrigin(0.5);
      objects.push(rightLabel);

      return objects;
    }

    const spacing = compact ? 42 : 58;
    const iconSize = compact ? 34 : 42;
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

    const frame = this.add.circle(x, y, size * 0.55, 0x0f172a, 1).setStrokeStyle(2, 0x334155, 1);
    objects.push(frame);

    if (textureInfo?.key && this.textures.exists(textureInfo.key)) {
      const image = this.add.image(x, y, textureInfo.key);
      const maxDim = Math.max(image.width, image.height);
      if (maxDim > 0) {
        image.setScale((size * 0.9) / maxDim);
      }
      objects.push(image);
    } else {
      const fallback = this.add.circle(x, y, size * 0.36, fallbackColor, 1).setStrokeStyle(2, 0x1e293b, 1);
      objects.push(fallback);
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
      tile.background.setStrokeStyle(2, isSelected ? 0x22d3ee : 0x334155, 1);
      tile.background.setFillStyle(isSelected ? 0x12233f : 0x0b1222, isSelected ? 1 : 0.98);
      tile.titleText.setColor(isSelected ? '#f8fafc' : '#e2e8f0');

      const tileScale = isSelected ? 1.02 : 1;
      tile.background.setScale(tileScale);
    });
  }

  launchSelectedLevel() {
    const selected = this.levelEntries[this.selectedIndex];
    if (!selected) {
      return;
    }

    this.scene.start('GameScene', { levelId: selected.id });
  }
}
