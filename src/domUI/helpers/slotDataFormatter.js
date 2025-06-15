/**
 * @file Utility for formatting save file metadata for UI slot rendering.
 */

import { formatPlaytime, formatTimestamp } from '../../utils/textUtils.js';

/** @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */

/**
 * @typedef {object} SlotItemMetadata
 * @property {string} name - Display name for the slot.
 * @property {string} timestamp - Timestamp label for the slot.
 * @property {string} playtime - Playtime label for the slot.
 * @property {boolean} isEmpty - Whether the slot is empty.
 * @property {boolean} isCorrupted - Whether the slot is corrupted.
 */

/**
 * @description Converts a {@link SaveFileMetadata} record into the metadata object
 * expected by {@link renderSlotItem}.
 * @param {SaveFileMetadata} metadata - Save file metadata to convert.
 * @returns {SlotItemMetadata} Formatted slot item metadata.
 */
export function formatSaveFileMetadata(metadata) {
  const name = metadata.saveName || metadata.identifier;
  let timestamp = '';
  if (
    metadata.timestamp &&
    metadata.timestamp !== 'N/A' &&
    !metadata.isCorrupted
  ) {
    const formatted = formatTimestamp(metadata.timestamp);
    timestamp = `Saved: ${formatted}`;
  } else if (metadata.isCorrupted) {
    timestamp = 'Timestamp: N/A';
  }

  const playtime = !metadata.isCorrupted
    ? `Playtime: ${formatPlaytime(metadata.playtimeSeconds)}`
    : '';

  return {
    name,
    timestamp,
    playtime,
    isEmpty: false,
    isCorrupted: !!metadata.isCorrupted,
  };
}

/**
 * @description Creates metadata representing an empty slot.
 * @param {string} name - Name label for the empty slot.
 * @returns {SlotItemMetadata} Metadata for an empty slot.
 */
export function formatEmptySlot(name) {
  return {
    name,
    timestamp: '',
    playtime: '',
    isEmpty: true,
    isCorrupted: false,
  };
}
