const CAMPAIGN_COMPLETED_STORAGE_KEY = 'machines_phaser_campaign_completed_v2';
const CAMPAIGN_CHEAT_BACKUP_STORAGE_KEY = 'machines_phaser_campaign_cheat_backup_v1';
const CAMPAIGN_CHEAT_PHASE_STORAGE_KEY = 'machines_phaser_campaign_cheat_phase_v1';

function getCampaignStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function normalizeLevelId(levelId) {
  if (typeof levelId !== 'string') {
    return null;
  }

  const trimmed = levelId.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeLevelIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  value.forEach((entry) => {
    const normalized = normalizeLevelId(entry);
    if (!normalized) {
      return;
    }

    unique.add(normalized);
  });

  return [...unique];
}

function writeCompletedCampaignLevelIds(completedIds) {
  const storage = getCampaignStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(CAMPAIGN_COMPLETED_STORAGE_KEY, JSON.stringify([...completedIds]));
  } catch {
    // Ignore storage failures and keep gameplay flow uninterrupted.
  }
}

export function getCompletedCampaignLevelIds() {
  const storage = getCampaignStorage();
  if (!storage) {
    return new Set();
  }

  try {
    const raw = storage.getItem(CAMPAIGN_COMPLETED_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw);
    return new Set(sanitizeLevelIds(parsed));
  } catch {
    return new Set();
  }
}

export function markCampaignLevelCompleted(levelId) {
  const normalizedLevelId = normalizeLevelId(levelId);
  if (!normalizedLevelId) {
    return;
  }

  const completedIds = getCompletedCampaignLevelIds();
  if (completedIds.has(normalizedLevelId)) {
    return;
  }

  completedIds.add(normalizedLevelId);
  writeCompletedCampaignLevelIds(completedIds);
}

function readCheatPhase() {
  const storage = getCampaignStorage();
  if (!storage) {
    return 'normal';
  }

  try {
    const raw = storage.getItem(CAMPAIGN_CHEAT_PHASE_STORAGE_KEY);
    if (raw === 'all_unlocked' || raw === 'only_first') {
      return raw;
    }
  } catch {
    // ignore
  }

  return 'normal';
}

function writeCheatPhase(phase) {
  const storage = getCampaignStorage();
  if (!storage) {
    return;
  }

  try {
    if (phase === 'normal') {
      storage.removeItem(CAMPAIGN_CHEAT_PHASE_STORAGE_KEY);
    } else {
      storage.setItem(CAMPAIGN_CHEAT_PHASE_STORAGE_KEY, phase);
    }
  } catch {
    // ignore
  }
}

function readCheatBackupIds() {
  const storage = getCampaignStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(CAMPAIGN_CHEAT_BACKUP_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return sanitizeLevelIds(parsed);
  } catch {
    return [];
  }
}

function writeCheatBackupIds(ids) {
  const storage = getCampaignStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(CAMPAIGN_CHEAT_BACKUP_STORAGE_KEY, JSON.stringify(sanitizeLevelIds(ids)));
  } catch {
    // ignore
  }
}

function clearCheatBackup() {
  const storage = getCampaignStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(CAMPAIGN_CHEAT_BACKUP_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isCampaignBracketProgressHotkeyEvent(event) {
  return Boolean(event && !event.repeat && (event.code === 'BracketLeft' || event.key === '['));
}

/**
 * Debug cycle on `[` (BracketLeft): unlock all → only level 1 → restore progress saved before first step.
 * @param {string[]} allCampaignLevelIds Level ids in campaign order (from getCampaignLevels).
 * @returns {{ ok: boolean, message: string }}
 */
export function cycleCampaignProgressBracketHotkey(allCampaignLevelIds) {
  const ids = sanitizeLevelIds(allCampaignLevelIds);
  const phase = readCheatPhase();

  if (phase === 'normal') {
    const snapshot = [...getCompletedCampaignLevelIds()];
    writeCheatBackupIds(snapshot);
    writeCompletedCampaignLevelIds(new Set(ids));
    writeCheatPhase('all_unlocked');
    return { ok: true, message: 'CHEAT: ALL LEVELS UNLOCKED' };
  }

  if (phase === 'all_unlocked') {
    writeCompletedCampaignLevelIds(new Set());
    writeCheatPhase('only_first');
    return { ok: true, message: 'CHEAT: ONLY LEVEL 1 UNLOCKED' };
  }

  const restored = readCheatBackupIds();
  writeCompletedCampaignLevelIds(new Set(restored));
  clearCheatBackup();
  writeCheatPhase('normal');
  return { ok: true, message: 'CHEAT: PROGRESS RESTORED' };
}
