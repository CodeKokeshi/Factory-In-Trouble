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
    title: 'Level 1 - Greens vs Protein',
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
    title: 'Level 2 - Carbs vs Condiments',
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
    title: 'Level 3 - Carbs vs Greens',
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
    title: 'Level 4 - Carbs vs Protein',
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
    title: 'Level 5 - Condiments vs Greens',
    subtitle: 'V Swap / Two Main Belts',
    quota: 250,
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
    id: 'L6',
    index: 6,
    mode: 'campaign',
    title: 'Level 6 - Condiments vs Protein',
    subtitle: 'Y Split / Two-Lane Branch',
    quota: 300,
    layoutFamily: 'y_shape',
    mainFlowDirection: 'down',
    foods: ['condiments', 'protein'],
    activeLaneIds: ['mid_left', 'mid_right'],
    chestMapping: {
      mid_left: 'condiments',
      mid_right: 'protein'
    },
    spawn: {
      baseIntervalMs: 735,
      minIntervalMs: 325
    }
  },
  {
    id: 'L7',
    index: 7,
    mode: 'campaign',
    title: 'Level 7 - Carbs vs Protein vs Condiments',
    subtitle: 'M Shape / Three-Lane Mix',
    quota: 350,
    layoutFamily: 'm_shape',
    mainFlowDirection: 'down',
    foods: ['carbs', 'protein', 'condiments'],
    activeLaneIds: ['mid_left', 'mid_right', 'bot_left'],
    chestMapping: {
      mid_left: 'carbs',
      mid_right: 'protein',
      bot_left: 'condiments'
    },
    spawn: {
      baseIntervalMs: 710,
      minIntervalMs: 315
    }
  },
  {
    id: 'L8',
    index: 8,
    mode: 'campaign',
    title: 'Level 8 - Carbs vs Greens vs Condiments',
    subtitle: 'N Shape / Three-Lane Drift',
    quota: 400,
    layoutFamily: 'n_shape',
    mainFlowDirection: 'down',
    foods: ['carbs', 'greens', 'condiments'],
    activeLaneIds: ['mid_left', 'mid_right', 'bot_right'],
    chestMapping: {
      mid_left: 'carbs',
      mid_right: 'condiments',
      bot_right: 'greens'
    },
    spawn: {
      baseIntervalMs: 690,
      minIntervalMs: 305
    }
  },
  {
    id: 'L9',
    index: 9,
    mode: 'campaign',
    title: 'Level 9 - Carbs vs Greens vs Protein',
    subtitle: 'K Shape / Cross Pressure',
    quota: 450,
    layoutFamily: 'k_shape',
    mainFlowDirection: 'down',
    foods: ['carbs', 'greens', 'protein'],
    activeLaneIds: ['mid_left', 'bot_left', 'bot_right'],
    chestMapping: {
      mid_left: 'protein',
      bot_left: 'carbs',
      bot_right: 'greens'
    },
    spawn: {
      baseIntervalMs: 670,
      minIntervalMs: 295
    }
  },
  {
    id: 'L10',
    index: 10,
    mode: 'campaign',
    title: 'Level 10 - Condiments vs Greens vs Protein',
    subtitle: 'Y Split / Three-Way Branch',
    quota: 500,
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
    id: 'L11',
    index: 11,
    mode: 'campaign',
    title: 'Level 11 - Full Factory (M Shape)',
    subtitle: 'M Shape / All Foods',
    quota: 550,
    layoutFamily: 'm_shape',
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
      baseIntervalMs: 630,
      minIntervalMs: 275
    }
  },
  {
    id: 'L12',
    index: 12,
    mode: 'campaign',
    title: 'Level 12 - Full Factory (N Reverse)',
    subtitle: 'N Shape / Reverse Flow',
    quota: 600,
    layoutFamily: 'n_shape',
    mainFlowDirection: 'up',
    foods: ['condiments', 'carbs', 'protein', 'greens'],
    activeLaneIds: ['mid_left', 'mid_right', 'bot_left', 'bot_right'],
    chestMapping: {
      mid_left: 'greens',
      mid_right: 'condiments',
      bot_left: 'protein',
      bot_right: 'carbs'
    },
    spawn: {
      baseIntervalMs: 610,
      minIntervalMs: 265
    }
  },
  {
    id: 'L13',
    index: 13,
    mode: 'campaign',
    title: 'Level 13 - Tri-Core Conveyor',
    subtitle: 'Triangle Mesh / No Main Belt',
    quota: 650,
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
    spawn: {
      baseIntervalMs: 590,
      minIntervalMs: 255
    }
  },
  {
    id: 'L14',
    index: 14,
    mode: 'campaign',
    title: 'Level 14 - Dual Spine Disorder',
    subtitle: 'Dual Spine / Split Feed',
    quota: 700,
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
    spawn: {
      baseIntervalMs: 570,
      minIntervalMs: 245
    }
  },
  {
    id: 'L15',
    index: 15,
    mode: 'campaign',
    title: 'Level 15 - P Reactor',
    subtitle: 'P Shape / One-Way Pressure',
    quota: 780,
    layoutFamily: 'p_shape',
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
      baseIntervalMs: 550,
      minIntervalMs: 235
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

const LEVELS = [...CAMPAIGN_LEVELS, ENDLESS_LEVEL];
const LEVELS_BY_ID = LEVELS.reduce((acc, level) => {
  acc[level.id] = level;
  return acc;
}, {});

export const DEFAULT_LEVEL_ID = 'ENDLESS';

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
