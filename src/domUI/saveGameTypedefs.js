// src/domUI/saveGameTypedefs.js
/**
 * @file Shared typedefs for Save Game UI and service modules.
 */

/** @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */

/**
 * Represents a filled save slot.
 *
 * @typedef {SaveFileMetadata & {slotId: number, isEmpty?: false}} FilledSlotData
 */

/**
 * Represents an empty save slot.
 *
 * @typedef {{slotId: number, isEmpty: true, saveName?: string, timestamp?: string, playtimeSeconds?: number, isCorrupted?: false}} EmptySlotData
 */

/**
 * Represents a corrupted save slot.
 *
 * @typedef {{slotId: number, isEmpty: false, saveName?: string, timestamp?: string, playtimeSeconds?: number, isCorrupted: true, identifier?: string}} CorruptedSlotData
 */

/**
 * Union of all slot display data types.
 *
 * @typedef {FilledSlotData | EmptySlotData | CorruptedSlotData} SlotDisplayData
 */

export const __saveGameTypedefs = true;
