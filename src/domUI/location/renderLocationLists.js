/**
 * @module domUI/location/renderLocationLists
 * @description Helper to render exits and characters lists of a location.
 */

/**
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('./buildLocationDisplayPayload.js').LocationDisplayPayload} LocationDisplayPayload
 * @typedef {import('../locationRenderer.js').LocationRenderer} LocationRenderer
 */

/**
 * Uses the renderer's internal `_renderList` method to populate exits and
 * characters list containers.
 *
 * @param {LocationRenderer} renderer - LocationRenderer instance.
 * @param {LocationDisplayPayload} locationDto - Data for the location.
 * @returns {void}
 */
export function renderLocationLists(renderer, locationDto) {
  renderer._renderList(
    locationDto.exits,
    renderer.elements.exitsDisplay,
    'Exits',
    'description',
    '(None visible)'
  );

  renderer._renderList(
    locationDto.characters,
    renderer.elements.charactersDisplay,
    'Characters',
    'name',
    '(None else here)'
  );
}

export default renderLocationLists;
