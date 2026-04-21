function cloneLevelConfig(level) {
  if (!level) {
    return null;
  }

  return {
    ...level,
    foods: Array.isArray(level.foods) ? [...level.foods] : [],
    activeLaneIds: Array.isArray(level.activeLaneIds) ? [...level.activeLaneIds] : [],
    chestMapping: level.chestMapping ? { ...level.chestMapping } : {},
    laneOverrides: level.laneOverrides ? { ...level.laneOverrides } : {},
    spawn: level.spawn ? { ...level.spawn } : null
  };
}

const CAMPAIGN_LEVELS = [
  {
    id: 'L1',
    index: 1,
    mode: 'campaign',
    title: 'Factory Broken',
    shortLabel: 'Factory Broken',
    subtitle: 'Rotated H / Starter',
    quota: 50,
    layoutFamily: 'rotated_h',
    mainFlowDirection: 'down',
    foods: ['greens', 'protein'],
    activeLaneIds: ['mid_left', 'mid_right'],
    chestMapping: {
      mid_left: 'greens',
      mid_right: 'protein'
    },
    spawn: {
      baseIntervalMs: 930,
      minIntervalMs: 430
    }
  },
  {
    id: 'L2',
    index: 2,
    mode: 'campaign',
    title: 'Operation A',
    shortLabel: 'Operation A',
    subtitle: 'Rotated H / Mirrored Matchup',
    quota: 100,
    layoutFamily: 'rotated_h',
    mainFlowDirection: 'down',
    foods: ['carbs', 'condiments'],
    activeLaneIds: ['mid_left', 'mid_right'],
    chestMapping: {
      mid_left: 'carbs',
      mid_right: 'condiments'
    },
    spawn: {
      baseIntervalMs: 870,
      minIntervalMs: 390
    }
  },
  {
    id: 'L3',
    index: 3,
    mode: 'campaign',
    title: 'Belt Reversal',
    shortLabel: 'Belt Reversal',
    subtitle: 'Reverse Rotated H',
    quota: 150,
    layoutFamily: 'reverse_rotated_h',
    mainFlowDirection: 'up',
    foods: ['carbs', 'greens'],
    activeLaneIds: ['bot_left', 'bot_right'],
    chestMapping: {
      bot_left: 'greens',
      bot_right: 'carbs'
    },
    spawn: {
      baseIntervalMs: 820,
      minIntervalMs: 365
    }
  },
  {
    id: 'L4',
    index: 4,
    mode: 'campaign',
    title: 'East Wing',
    shortLabel: 'East Wing',
    subtitle: 'E Shape Lite',
    quota: 200,
    layoutFamily: 'e_shape',
    mainFlowDirection: 'down',
    foods: ['carbs', 'protein'],
    activeLaneIds: ['mid_right', 'bot_right'],
    chestMapping: {
      mid_right: 'carbs',
      bot_right: 'protein'
    },
    laneOverrides: {
      mid_right: {
        y: 260,
        direction: 1,
        endX: 1070,
        chestX: 1170
      },
      bot_right: {
        y: 460,
        direction: 1,
        endX: 1070,
        chestX: 1170
      }
    },
    spawn: {
      baseIntervalMs: 790,
      minIntervalMs: 350
    }
  },
  {
    id: 'L5',
    index: 5,
    mode: 'campaign',
    title: 'Twin Feed',
    shortLabel: 'Twin Feed',
    subtitle: 'V Swap / Two Main Belts',
    quota: 200,
    layoutFamily: 'v_swap',
    mainFlowDirection: 'down',
    foods: ['condiments', 'greens'],
    activeLaneIds: ['mid_left', 'mid_right'],
    chestMapping: {
      mid_left: 'condiments',
      mid_right: 'greens'
    },
    spawn: {
      baseIntervalMs: 765,
      minIntervalMs: 335
    }
  },
  {
    id: 'L9',
    index: 6,
    mode: 'campaign',
    title: 'Food Assembly',
    shortLabel: 'Food Assembly',
    subtitle: 'Flipped Y Split / Cross Pressure',
    quota: 200,
    layoutFamily: 'y_shape',
    mainFlowDirection: 'down',
    foods: ['carbs', 'greens', 'protein'],
    activeLaneIds: ['mid_left', 'mid_right', 'bot_left'],
    chestMapping: {
      mid_left: 'protein',
      mid_right: 'greens',
      bot_left: 'carbs'
    },
    laneOverrides: {
      bot_left: {
        y: 520
      }
    },
    spawn: {
      baseIntervalMs: 670,
      minIntervalMs: 295
    }
  },
  {
    id: 'L10',
    index: 7,
    mode: 'campaign',
    title: 'Quarter Plant',
    shortLabel: 'Quarter Plant',
    subtitle: 'Y Split / Three-Way Branch',
    quota: 200,
    layoutFamily: 'y_shape',
    mainFlowDirection: 'down',
    foods: ['condiments', 'greens', 'protein'],
    activeLaneIds: ['mid_left', 'mid_right', 'bot_right'],
    chestMapping: {
      mid_left: 'condiments',
      mid_right: 'protein',
      bot_right: 'greens'
    },
    spawn: {
      baseIntervalMs: 650,
      minIntervalMs: 285
    }
  },
  {
    id: 'L13',
    index: 8,
    mode: 'campaign',
    title: 'Tricore Mesh',
    shortLabel: 'Tricore Mesh',
    subtitle: 'Triangle Mesh / No Main Belt',
    quota: 200,
    layoutFamily: 'triangle_mesh',
    mainFlowDirection: 'down',
    foods: ['condiments', 'carbs', 'protein', 'greens'],
    activeLaneIds: ['mid_left', 'mid_right', 'bot_left', 'bot_right'],
    chestMapping: {
      mid_left: 'protein',
      mid_right: 'carbs',
      bot_left: 'condiments',
      bot_right: 'greens'
    },
    laneOverrides: {
      mid_left: {
        y: 250
      },
      mid_right: {
        y: 280
      },
      bot_left: {
        y: 520
      }
    },
    spawn: {
      baseIntervalMs: 590,
      minIntervalMs: 255
    }
  },
  {
    id: 'L14',
    index: 9,
    mode: 'campaign',
    title: 'Dual Spine',
    shortLabel: 'Dual Spine',
    subtitle: 'Dual Spine / Split Feed',
    quota: 200,
    layoutFamily: 'dual_spine',
    mainFlowDirection: 'down',
    foods: ['condiments', 'carbs', 'protein', 'greens'],
    activeLaneIds: ['mid_left', 'mid_right', 'bot_left', 'bot_right'],
    chestMapping: {
      mid_left: 'greens',
      mid_right: 'protein',
      bot_left: 'carbs',
      bot_right: 'condiments'
    },
    laneOverrides: {
      mid_left: {
        y: 260
      }
    },
    spawn: {
      baseIntervalMs: 570,
      minIntervalMs: 245
    }
  }
];

const ENDLESS_LEVEL = {
  id: 'ENDLESS',
  mode: 'endless',
  title: 'Endless',
  subtitle: 'Current Baseline Factory',
  quota: null,
  layoutFamily: 'rotated_h',
  mainFlowDirection: 'down',
  foods: ['condiments', 'carbs', 'protein', 'greens'],
  activeLaneIds: ['mid_left', 'mid_right', 'bot_left', 'bot_right'],
  chestMapping: {
    mid_left: 'carbs',
    mid_right: 'protein',
    bot_left: 'greens',
    bot_right: 'condiments'
  },
  spawn: {
    baseIntervalMs: 850,
    minIntervalMs: 340
  }
};

export const DEFAULT_LEVEL_ID = 'ENDLESS';
export const DEBUG_LEVEL_ID = 'DEBUG';

const DEBUG_LEVEL = {
  ...ENDLESS_LEVEL,
  id: DEBUG_LEVEL_ID,
  title: 'Debug Endless',
  subtitle: 'Endless Clone (Debug)'
};

const LEVELS = [...CAMPAIGN_LEVELS, ENDLESS_LEVEL];
const LEVELS_BY_ID = [...LEVELS, DEBUG_LEVEL].reduce((acc, level) => {
  acc[level.id] = level;
  return acc;
}, {});

export function getAllLevels() {
  return LEVELS.map(cloneLevelConfig);
}

export function getCampaignLevels() {
  return CAMPAIGN_LEVELS.map(cloneLevelConfig);
}

export function getLevelById(levelId) {
  if (!levelId || !LEVELS_BY_ID[levelId]) {
    return cloneLevelConfig(LEVELS_BY_ID[DEFAULT_LEVEL_ID]);
  }

  return cloneLevelConfig(LEVELS_BY_ID[levelId]);
}

export function getNextCampaignLevelId(levelId) {
  const currentIndex = CAMPAIGN_LEVELS.findIndex((level) => level.id === levelId);
  if (currentIndex === -1) {
    return null;
  }

  const next = CAMPAIGN_LEVELS[currentIndex + 1];
  return next ? next.id : null;
}

export function getLevelChooserEntries() {
  return [...CAMPAIGN_LEVELS.map(cloneLevelConfig), cloneLevelConfig(ENDLESS_LEVEL)];
}
