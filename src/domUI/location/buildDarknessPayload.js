// src/domUI/location/buildDarknessPayload.js
/**
 * @file Helper to create a display payload for locations in darkness.
 * @module domUI/location/buildDarknessPayload
 */

/**
 * @typedef {import('./buildLocationDisplayPayload.js').LocationDisplayPayload} LocationDisplayPayload
 */

/**
 * Default description shown when a location has no custom darkness description.
 * @constant {string}
 */
const DEFAULT_DARKNESS_DESCRIPTION = "You're in pitch darkness.";

/**
 * Builds a display payload for a location that is in darkness.
 * Provides minimal information: name, darkness description, and presence count.
 * Portrait, exits, and characters are hidden.
 *
 * @param {object} params - Build parameters.
 * @param {string} params.locationName - The location's display name.
 * @param {string|null} params.darknessDescription - Custom darkness description or null for default.
 * @param {number} params.otherActorCount - Number of other actors at the location.
 * @returns {LocationDisplayPayload} Payload with darkness-specific values.
 */
export function buildDarknessPayload({
  locationName,
  darknessDescription,
  otherActorCount,
}) {
  return {
    name: locationName,
    description: darknessDescription || DEFAULT_DARKNESS_DESCRIPTION,
    portraitPath: null,
    portraitAltText: null,
    exits: [],
    characters: [],
    isDark: true,
    otherActorCount,
  };
}

export { DEFAULT_DARKNESS_DESCRIPTION };
