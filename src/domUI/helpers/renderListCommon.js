/**
 * @file Shared helper for rendering lists in the DOM.
 */

import { DomUtils } from '../../utils/domUtils.js';
import createMessageElement from './createMessageElement.js';

/** @typedef {import('../domElementFactory.js').default} DomElementFactory */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * Shared helper to fetch data and populate a DOM list.
 *
 * @description Fetches list data, clears the container, and renders the list
 * using the supplied callbacks. Handles empty data and errors.
 * @param {Function} fetchData - Function returning the data array (can be async).
 * @param {Function} renderItem - Renders a DOM element for an item.
 *   Signature `(itemData, index, listData) => HTMLElement | null`.
 * @param {Function} getEmptyMessage - Returns a string or HTMLElement used when
 *   the list data is empty.
 * @param {HTMLElement} container - The DOM element to populate with list items.
 * @param {ILogger} logger - Logger for diagnostic messages.
 * @param {DomElementFactory} [domElementFactory] - Optional element factory used
 *   for fallback message creation.
 * @returns {Promise<Array<any> | null>} Resolves with the fetched list data or
 *   `null` if an error occurred.
 */
export async function renderListCommon(
  fetchData,
  renderItem,
  getEmptyMessage,
  container,
  logger,
  domElementFactory
) {
  let listData = null;
  try {
    listData = await Promise.resolve(fetchData());
    logger.debug(
      `[renderListCommon] Fetched list data. Count: ${
        listData ? listData.length : 'null/undefined'
      }`
    );
  } catch (error) {
    logger.error('[renderListCommon] Error fetching list data:', error);
    DomUtils.clearElement(container);
    const errorEl = createMessageElement(
      domElementFactory,
      'error-message',
      'Error loading list data.'
    );
    container.appendChild(errorEl);
    return null;
  }

  DomUtils.clearElement(container);
  logger.debug('[renderListCommon] Cleared list container.');

  if (!listData || !Array.isArray(listData) || listData.length === 0) {
    const emptyMsg = getEmptyMessage();
    if (typeof emptyMsg === 'string') {
      if (domElementFactory) {
        container.appendChild(
          createMessageElement(
            domElementFactory,
            'empty-list-message',
            emptyMsg
          )
        );
      } else {
        container.textContent = emptyMsg;
      }
    } else if (emptyMsg instanceof HTMLElement) {
      container.appendChild(emptyMsg);
    } else {
      logger.warn('[renderListCommon] getEmptyMessage returned invalid type.', {
        type: typeof emptyMsg,
      });
      if (domElementFactory) {
        container.appendChild(
          createMessageElement(
            domElementFactory,
            'empty-list-message',
            'List is empty.'
          )
        );
      } else {
        container.textContent = 'List is empty.';
      }
    }
    logger.debug('[renderListCommon] Empty list message displayed.');
  } else {
    let rendered = 0;
    listData.forEach((item, index) => {
      try {
        const el = renderItem(item, index, listData);
        if (el && el.nodeType === 1) {
          container.appendChild(el);
          rendered++;
        } else if (el !== null) {
          logger.warn(
            '[renderListCommon] renderItem did not return an element.',
            {
              item,
              returnedValue: el,
            }
          );
        }
      } catch (err) {
        logger.error('[renderListCommon] Error in renderItem:', err, { item });
      }
    });
    logger.debug(
      `[renderListCommon] Rendered ${rendered} out of ${listData.length} items.`
    );
  }

  return listData;
}

export default renderListCommon;
