// src/utils/loadSlotUtils.js

/**
 * @file Utility helpers for fetching and formatting load slot data.
 */

import { formatSaveFileMetadata } from '../domUI/helpers/slotDataFormatter.js';

/**
 * Comparator for sorting save slots by corruption state and timestamp.
 *
 * @param {SaveFileMetadata} a
 * @param {SaveFileMetadata} b
 * @returns {number}
 */
export function compareLoadSlots(a, b) {
  if (a.isCorrupted && !b.isCorrupted) return 1;
  if (!a.isCorrupted && b.isCorrupted) return -1;
  if (a.isCorrupted && b.isCorrupted) {
    const corruptedNameA = (a.saveName || a.identifier || '').toString();
    const corruptedNameB = (b.saveName || b.identifier || '').toString();
    return corruptedNameA.localeCompare(corruptedNameB);
  }
  try {
    const timestampA =
      typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : Number.NaN;
    const timestampB =
      typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : Number.NaN;

    const aHasValidTimestamp = Number.isFinite(timestampA);
    const bHasValidTimestamp = Number.isFinite(timestampB);

    if (aHasValidTimestamp && bHasValidTimestamp) {
      return timestampB - timestampA;
    }

    if (aHasValidTimestamp) {
      return -1;
    }

    if (bHasValidTimestamp) {
      return 1;
    }

    const nameA = (a.saveName || a.identifier || '').toString();
    const nameB = (b.saveName || b.identifier || '').toString();
    return nameA.localeCompare(nameB);
  } catch {
    return 0;
  }
}

/** @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */

/**
 * Extends SaveFileMetadata with formatted slot metadata for display.
 *
 * @typedef {SaveFileMetadata & { slotItemMeta: import('../domUI/helpers/slotDataFormatter.js').SlotItemMetadata }} LoadSlotDisplayData
 */

/**
 * Fetches manual save slots via the provided service and returns them sorted by
 * newest timestamp first while corrupted saves are placed last. Each slot is
 * mapped to include a {@link module:slotDataFormatter.formatSaveFileMetadata}
 * result under `slotItemMeta`.
 *
 * @param {import('../interfaces/ISaveLoadService.js').ISaveLoadService} saveLoadService - Service used to list saves.
 * @returns {Promise<LoadSlotDisplayData[]>} Sorted and formatted slot data.
 */
export async function fetchAndFormatLoadSlots(saveLoadService) {
  const rawResult = await saveLoadService.listManualSaveSlots();

  let manualSaves;

  if (Array.isArray(rawResult)) {
    manualSaves = rawResult;
  } else if (rawResult && typeof rawResult === 'object') {
    if (rawResult.success === false) {
      const message =
        rawResult.userFriendlyError ||
        rawResult.error?.message ||
        rawResult.error ||
        'Failed to list manual save slots.';
      throw new Error(String(message));
    }

    manualSaves = Array.isArray(rawResult.data) ? rawResult.data : [];
  } else {
    manualSaves = [];
  }

  const sortedSaves = [...manualSaves];
  sortedSaves.sort(compareLoadSlots);

  return sortedSaves.map((slot) => ({
    ...slot,
    slotItemMeta: formatSaveFileMetadata(slot),
  }));
}
