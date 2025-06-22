// src/utils/loadSlotUtils.js

/**
 * @file Utility helpers for fetching and formatting load slot data.
 */

import { formatSaveFileMetadata } from '../domUI/helpers/slotDataFormatter.js';

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
  const manualSaves = await saveLoadService.listManualSaveSlots();

  manualSaves.sort((a, b) => {
    if (a.isCorrupted && !b.isCorrupted) return 1;
    if (!a.isCorrupted && b.isCorrupted) return -1;
    if (a.isCorrupted && b.isCorrupted) {
      return (a.saveName || a.identifier).localeCompare(
        b.saveName || b.identifier
      );
    }
    try {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } catch {
      return 0;
    }
  });

  return manualSaves.map((slot) => ({
    ...slot,
    slotItemMeta: formatSaveFileMetadata(slot),
  }));
}
