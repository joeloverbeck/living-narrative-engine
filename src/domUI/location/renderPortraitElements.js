/**
 * @module domUI/location/renderPortraitElements
 * @description Helper to render or hide location portrait elements.
 */

import { DomUtils } from '../../utils/domUtils.js';

/**
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('./buildLocationDisplayPayload.js').LocationDisplayPayload} LocationDisplayPayload
 * @typedef {import('../domElementFactory.js').default} DomElementFactory
 * @typedef {import('../../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 */

/**
 * Renders the portrait section for a location.
 *
 * @param {HTMLImageElement | null} imageElement - The image element to update.
 * @param {HTMLElement | null} visualsElement - Container wrapping the image.
 * @param {LocationDisplayPayload} locationDto - Data for the location.
 * @param {ILogger} logger - Logger for debug messages.
 * @param {DomElementFactory} domFactory - Factory for element creation.
 * @param {IDocumentContext} documentContext - Document utilities.
 * @param {(el: HTMLElement, ev: string, cb: (e: Event) => void) => void} [addListener] - Optional event binding helper.
 * @returns {void}
 */
export function renderPortraitElements(
  imageElement,
  visualsElement,
  locationDto,
  logger,
  domFactory,
  documentContext,
  addListener
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
    visualsElement.style.display = 'block';

    // Add tooltip if description exists
    if (locationDto.description && locationDto.description.trim()) {
      // Remove any existing tooltip
      const existingTooltip = visualsElement.querySelector('.location-tooltip');
      if (existingTooltip) {
        existingTooltip.remove();
      }

      // Create new tooltip
      const tooltip = documentContext.document.createElement('span');
      tooltip.classList.add('location-tooltip');
      tooltip.innerHTML = DomUtils.textToHtml(locationDto.description);
      visualsElement.appendChild(tooltip);

      // Add interaction handler
      const handler = () => visualsElement.classList.toggle('tooltip-open');
      if (addListener) {
        addListener(visualsElement, 'click', handler);
      } else {
        visualsElement.addEventListener('click', handler);
      }

      // Make the visuals element focusable for keyboard accessibility
      visualsElement.setAttribute('tabindex', '0');
      visualsElement.setAttribute('role', 'button');
      visualsElement.setAttribute(
        'aria-label',
        `${locationDto.name || 'Location'} portrait. Click to show description.`
      );
    }
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
