/**
 * @file Utility for formatting save file metadata for UI slot rendering.
 */

import { formatPlaytime, formatTimestamp } from '../../utils/textUtils.js';

/** @typedef {import('../../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */

/**
 * @typedef {object} SlotItemMetadata
 * @property {string} name - Display name for the slot.
 * @property {string} timestamp - Timestamp label for the slot.
 * @property {string} playtime - Playtime label for the slot.
 * @property {boolean} isEmpty - Whether the slot is empty.
 * @property {boolean} isCorrupted - Whether the slot is corrupted.
 */

/**
 * Converts a {@link SaveFileMetadata} record into the metadata object expected
 * by the `renderSlotItem` helper.
 *
 * @param {SaveFileMetadata} metadata - Save file metadata to convert.
 * @returns {SlotItemMetadata} Formatted slot item metadata.
 */
export function formatSaveFileMetadata(metadata) {
  const name = metadata.saveName || metadata.identifier;

  if (metadata.isCorrupted) {
    return {
      name,
      timestamp: 'Timestamp: N/A',
      playtime: '',
      isEmpty: false,
      isCorrupted: true,
    };
  }

  const timestamp =
    metadata.timestamp && metadata.timestamp !== 'N/A'
      ? `Saved: ${formatTimestamp(metadata.timestamp)}`
      : '';

  return {
    name,
    timestamp,
    playtime: `Playtime: ${formatPlaytime(metadata.playtimeSeconds)}`,
    isEmpty: false,
    isCorrupted: false,
  };
}

/**
 * Creates metadata representing an empty slot.
 *
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
