/**
 * @module domUI/location/buildLocationDisplayPayload
 * @description Helper to create a standardized payload for rendering a location.
 */

/**
 * @typedef {import('../../entities/services/locationDisplayService.js').ProcessedExit} ProcessedExit
 * @typedef {import('../../entities/entityDisplayDataProvider.js').CharacterDisplayInfo} CharacterDisplayData
 */

/**
 * @typedef {object} LocationDisplayPayload
 * @property {string} name - Display name for the location.
 * @property {string} description - Narrative description of the location.
 * @property {string|null} [portraitPath] - Image path for the location portrait.
 * @property {string|null} [portraitAltText] - Alt text for the portrait image.
 * @property {Array<ProcessedExit>} exits - Exits leading away from the location.
 * @property {Array<CharacterDisplayData>} characters - Characters present in the location.
 */

/**
 * Builds the payload used by {@link module:domUI/locationRenderer.LocationRenderer} to
 * render a location.
 *
 * @param {object} locationDetails - Base location details from the provider.
 * @param {{imagePath:string, altText?:string}|null} portraitData - Optional portrait info.
 * @param {Array<CharacterDisplayData>} characters - Characters present at the location.
 * @returns {LocationDisplayPayload} The structured display payload.
 */
export function buildLocationDisplayPayload(
  locationDetails,
  portraitData,
  characters
) {
  return {
    name: locationDetails.name,
    description: locationDetails.description,
    portraitPath: portraitData ? portraitData.imagePath : null,
    portraitAltText: portraitData
      ? portraitData.altText || `Image of ${locationDetails.name}`
      : null,
    exits: locationDetails.exits,
    characters,
  };
}

export default buildLocationDisplayPayload;
