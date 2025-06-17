// src/domUI/baseListDisplayComponent.js

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { DomUtils } from '../utils/domUtils.js';
import createMessageElement from './helpers/createMessageElement.js';
import renderListCommon from './helpers/renderListCommon.js';

/**
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('./boundDomRendererBase.js').ElementsConfig} ElementsConfig
 */

/**
 * @abstract
 * @class BaseListDisplayComponent
 * @augments BoundDomRendererBase
 * @description An abstract base class designed to standardize and simplify the rendering of dynamic lists of items.
 * It manages fetching data, clearing the list container, rendering each item using subclass-defined logic,
 * handling empty list states, and providing a post-render hook.
 *
 * Subclasses must provide an `elementsConfig` to `BoundDomRendererBase` that includes a
 * `listContainerElement` entry, which specifies the DOM element where the list items will be rendered.
 * @example
 * // Subclass elementsConfig example:
 * // {
 * //   listContainerElement: '#my-list-container', // Required: CSS selector for the list container
 * //   // ... other elements
 * // }
 */
export class BaseListDisplayComponent extends BoundDomRendererBase {
  /**
   * Constructs a BaseListDisplayComponent instance.
   *
   * @param {object} params - The parameters object.
   * @param {ILogger} params.logger - The logger instance.
   * @param {IDocumentContext} params.documentContext - The document context abstraction.
   * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - The validated event dispatcher.
   * @param {ElementsConfig} params.elementsConfig - Configuration for binding DOM elements.
   * Must include a `listContainerElement` key mapping to a selector for the list container.
   * @param {DomElementFactory} [params.domElementFactory] - Optional factory passed through to BoundDomRendererBase.
   * @param {boolean} [params.autoRefresh] - Whether to automatically call `refreshList()` during construction.
   * @param {...any} params.otherDeps - Other dependencies passed to BoundDomRendererBase or stored by the subclass.
   * @throws {Error} If `elementsConfig` does not lead to a resolved `listContainerElement`.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    elementsConfig,
    domElementFactory,
    autoRefresh = true,
    ...otherDeps
  }) {
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory,
      ...otherDeps,
    });

    if (!this.elements.listContainerElement) {
      const errorMsg = `${this._logPrefix} 'listContainerElement' is not defined or not found in the DOM. This element is required for BaseListDisplayComponent. Ensure it's specified in elementsConfig.`;
      this.logger.error(errorMsg, {
        elementsConfigReceived: elementsConfig,
        resolvedElements: this.elements,
      });
      throw new Error(errorMsg);
    }
    this.logger.debug(
      `${this._logPrefix} List container element successfully bound:`,
      this.elements.listContainerElement
    );

    if (autoRefresh) {
      Promise.resolve()
        .then(() => this.refreshList())
        .catch((error) => {
          this.logger.error(
            `${this._logPrefix} Error during initial list refresh:`,
            error
          );
        });
    }
  }

  /**
   * Abstract method to be implemented by subclasses.
   * It should return (or promise to return) an array of data items to be rendered in the list.
   * This allows for both synchronous and asynchronous data fetching.
   *
   * @abstract
   * @protected
   * @returns {Promise<Array<any>> | Array<any>} An array of items, or a Promise resolving to an array of items.
   * Return `null` or an empty array if no items are available.
   */
  _getListItemsData() {
    this.logger.error(
      `${this._logPrefix} _getListItemsData() is an abstract method and must be implemented by the subclass.`
    );
    throw new Error('Abstract method _getListItemsData() not implemented.');
  }

  /**
   * Abstract method to be implemented by subclasses.
   * It takes a single data item and returns a fully formed DOM element (e.g., HTMLLIElement, HTMLDivElement)
   * that represents this item in the list.
   * Return `null` to skip rendering this specific item without error.
   *
   * @abstract
   * @protected
   * @param {*} _itemData - The data for the current item (unused base implementation).
   * @param {number} _itemIndex - The index of the current item.
   * @param {Array<any>} _listData - The complete array of data items.
   * @returns {HTMLElement | null} The DOM element for the list item, or `null` to skip.
   */
  _renderListItem(_itemData, _itemIndex, _listData) {
    this.logger.error(
      `${this._logPrefix} _renderListItem() is an abstract method and must be implemented by the subclass.`
    );
    throw new Error('Abstract method _renderListItem() not implemented.');
  }

  /**
   * Abstract method to be implemented by subclasses.
   * It should return a string message or a pre-constructed DOM element to be displayed
   * in the `listContainerElement` when `_getListItemsData()` results in an empty list (null or empty array).
   *
   * @abstract
   * @protected
   * @returns {string | HTMLElement} The message or element to display for an empty list.
   */
  _getEmptyListMessage() {
    this.logger.error(
      `${this._logPrefix} _getEmptyListMessage() is an abstract method and must be implemented by the subclass.`
    );
    throw new Error('Abstract method _getEmptyListMessage() not implemented.');
  }

  /**
   * Protected, virtual method that can be overridden by subclasses.
   * This method is called after `renderList` has finished populating the `listContainerElement`
   * with all list items (or the empty message).
   * Subclasses can use this hook to attach event listeners to newly rendered items,
   * perform other post-render setup, or trigger further UI updates.
   *
   * @protected
   * @abstract
   * @param {Array<any> | null} _listData - The array of data items that were rendered, or `null` if the list was empty or data fetching failed.
   * @param {HTMLElement} _container - The `listContainerElement` that was populated.
   * @returns {void}
   */
  _onListRendered(_listData, _container) {
    // Default implementation is empty. Subclasses can override.
    this.logger.debug(
      `${this._logPrefix} _onListRendered hook called. List data count: ${_listData ? _listData.length : 'null'}.`
    );
  }

  /**
   * Core method to render the list.
   * It fetches data using `_getListItemsData`, clears the `listContainerElement`,
   * handles empty states by calling `_getEmptyListMessage`, or populates the list
   * by calling `_renderListItem` for each item. Finally, it calls `_onListRendered`.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when the list rendering is complete.
   */
  async renderList() {
    this.logger.debug(`${this._logPrefix} renderList() called.`);

    if (!this.elements.listContainerElement) {
      this.logger.error(
        `${this._logPrefix} Cannot render list: 'listContainerElement' is not available.`
      );
      return;
    }

    const itemsData = await renderListCommon(
      () => this._getListItemsData(),
      (item, index, list) => this._renderListItem(item, index, list),
      () => this._getEmptyListMessage(),
      this.elements.listContainerElement,
      this.logger,
      this.domElementFactory
    );

    try {
      this._onListRendered(itemsData, this.elements.listContainerElement);
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error in _onListRendered hook:`,
        error
      );
    }
  }

  /**
   * Public method to trigger a re-rendering of the list.
   * This is a convenience method that simply calls `renderList()`.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when the list rendering is complete.
   */
  async refreshList() {
    this.logger.debug(
      `${this._logPrefix} refreshList() called, invoking renderList().`
    );
    return this.renderList();
  }

  /**
   * Dispose method. Calls super.dispose() for base class cleanup.
   * Subclasses can override to add their own specific disposal logic,
   * ensuring they also call super.dispose().
   */
  dispose() {
    super.dispose(); // Handles VED/DOM listener cleanup and clearing `this.elements`
    this.logger.debug(`${this._logPrefix} Disposed.`);
  }
}
