/**
 * @module domUI/location/renderPortraitElements
 * @description Helper to render or hide location portrait elements.
 */

/**
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('./buildLocationDisplayPayload.js').LocationDisplayPayload} LocationDisplayPayload
 */

/**
 * Renders the portrait section for a location.
 *
 * @param {HTMLImageElement | null} imageElement - The image element to update.
 * @param {HTMLElement | null} visualsElement - Container wrapping the image.
 * @param {LocationDisplayPayload} locationDto - Data for the location.
 * @param {ILogger} logger - Logger for debug messages.
 * @returns {void}
 */
export function renderPortraitElements(
  imageElement,
  visualsElement,
  locationDto,
  logger
) {
  if (!imageElement || !visualsElement) {
    logger.warn('[renderPortraitElements] portrait elements missing.');
    return;
  }

  if (locationDto.portraitPath) {
    logger.debug(
      `[renderPortraitElements] Setting location portrait to ${locationDto.portraitPath}`
    );
    imageElement.src = locationDto.portraitPath;
    imageElement.alt =
      locationDto.portraitAltText ||
      `Image of ${locationDto.name || 'location'}`;
    imageElement.style.display = 'block';
    visualsElement.style.display = 'flex';
  } else {
    logger.debug(
      '[renderPortraitElements] No portrait path for location. Hiding portrait elements.'
    );
    visualsElement.style.display = 'none';
    imageElement.style.display = 'none';
    imageElement.src = '';
    imageElement.alt = '';
  }
}

export default renderPortraitElements;
