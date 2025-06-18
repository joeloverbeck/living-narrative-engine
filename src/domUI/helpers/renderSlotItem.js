/**
 * @file Helper function to build a save/load slot DOM element.
 */

import { createSelectableItem } from './createSelectableItem.js';

/** @typedef {import('../domElementFactory.js').default} DomElementFactory */

/**
 * @typedef {object} SlotItemMetadata
 * @property {string} [name] - Display name for the slot.
 * @property {string} [timestamp] - Timestamp label for the slot.
 * @property {string} [playtime] - Playtime label for the slot.
 * @property {boolean} [isEmpty] - Flag indicating an empty slot.
 * @property {boolean} [isCorrupted] - Flag indicating a corrupted slot.
 */

/**
 * Creates a DOM element representing a save/load slot.
 *
 * @param {DomElementFactory} domFactory - Factory used to create elements.
 * @param {string} datasetKey - Name of the dataset property for identification.
 * @param {string|number} datasetValue - Value for the dataset property.
 * @param {SlotItemMetadata} metadata - Display metadata for the slot.
 * @param {(Event) => void} [onClick] - Optional click handler for the slot.
 * @returns {HTMLElement | null} The constructed slot element or null on failure.
 */
export function renderSlotItem(
  domFactory,
  datasetKey,
  datasetValue,
  metadata,
  onClick
) {
  if (!domFactory) return null;

  const {
    name = '',
    timestamp = '',
    playtime = '',
    isEmpty = false,
    isCorrupted = false,
  } = metadata || {};

  const slotDiv = createSelectableItem(
    domFactory,
    'div',
    datasetKey,
    datasetValue,
    '',
    isEmpty,
    isCorrupted,
    undefined,
    onClick
  );
  if (!slotDiv) return null;

  const infoDiv = domFactory.div('slot-info');
  if (infoDiv) {
    const nameEl = domFactory.span('slot-name', name);
    if (nameEl) infoDiv.appendChild(nameEl);
    const tsEl = domFactory.span('slot-timestamp', timestamp);
    if (tsEl) infoDiv.appendChild(tsEl);
    slotDiv.appendChild(infoDiv);
  }

  if (playtime) {
    const ptEl = domFactory.span('slot-playtime', playtime);
    if (ptEl) slotDiv.appendChild(ptEl);
  }

  return slotDiv;
}
