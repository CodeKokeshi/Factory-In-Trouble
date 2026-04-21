const CAMPAIGN_COMPLETED_STORAGE_KEY = 'machines_phaser_campaign_completed_v2';

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
