// src/domUI/location/presenceMessageBuilder.js
/**
 * @file Helper to generate three-tier presence sensing messages for darkness.
 * @module domUI/location/presenceMessageBuilder
 */

/**
 * Three-tier presence sensing messages for darkness.
 * @constant {Object<string, string>}
 */
const PRESENCE_MESSAGES = {
  NONE: "You can't see anything in the dark, but you sense no other presence here.",
  ONE: "You can't see anything in the dark, but you sense a presence here.",
  FEW: "You can't see anything in the dark, but you sense a few presences here.",
  SEVERAL:
    "You can't see anything in the dark, but you sense several presences here.",
};

/**
 * Returns an appropriate presence message based on count.
 * Uses three-tier approximation: none (0), one (1), few (2-3), several (4+).
 *
 * @param {number} count - Number of other actors sensed.
 * @returns {string} Human-readable presence message.
 */
export function getPresenceMessage(count) {
  if (count === 0) return PRESENCE_MESSAGES.NONE;
  if (count === 1) return PRESENCE_MESSAGES.ONE;
  if (count <= 3) return PRESENCE_MESSAGES.FEW;
  return PRESENCE_MESSAGES.SEVERAL;
}

export { PRESENCE_MESSAGES };
