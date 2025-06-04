// src/domUI/baseListDisplayComponent.js

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { DomUtils } from './domUtils.js';

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
   * @protected
   * @type {DomElementFactory | null} - Optionally, subclasses can request DomElementFactory.
   */
  domElementFactory = null;

  /**
   * Constructs a BaseListDisplayComponent instance.
   *
   * @param {object} params - The parameters object.
   * @param {ILogger} params.logger - The logger instance.
   * @param {IDocumentContext} params.documentContext - The document context abstraction.
   * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - The validated event dispatcher.
   * @param {ElementsConfig} params.elementsConfig - Configuration for binding DOM elements.
   * Must include a `listContainerElement` key mapping to a selector for the list container.
   * @param {DomElementFactory} [params.domElementFactory] - Optional. Instance of DomElementFactory for creating elements.
   * @param {...any} params.otherDeps - Other dependencies passed to BoundDomRendererBase or stored by the subclass.
   * @throws {Error} If `elementsConfig` does not lead to a resolved `listContainerElement`.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    elementsConfig,
    domElementFactory,
    ...otherDeps
  }) {
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      ...otherDeps,
    });

    if (domElementFactory) {
      this.domElementFactory = domElementFactory;
    }

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
   * @param {any} itemData - The data for the current item to render.
   * @param {number} itemIndex - The index of the current item in the `listData` array.
   * @param {Array<any>} listData - The complete array of data items being rendered.
   * @returns {HTMLElement | null} The DOM element for the list item, or `null` to skip.
   */
  _renderListItem(itemData, itemIndex, listData) {
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
   * @param {Array<any> | null} listData - The array of data items that were rendered, or `null` if the list was empty or data fetching failed.
   * @param {HTMLElement} container - The `listContainerElement` that was populated.
   * @returns {void}
   */
  _onListRendered(listData, container) {
    // Default implementation is empty. Subclasses can override.
    this.logger.debug(
      `${this._logPrefix} _onListRendered hook called. List data count: ${listData ? listData.length : 'null'}.`
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

    let itemsData = null;
    try {
      itemsData = await Promise.resolve(this._getListItemsData());
      this.logger.debug(
        `${this._logPrefix} Fetched list items data. Count: ${itemsData ? itemsData.length : 'null/undefined'}`
      );
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error fetching list items data in _getListItemsData():`,
        error
      );
      DomUtils.clearElement(this.elements.listContainerElement);
      const errorMsg =
        this.domElementFactory?.p(
          'error-message',
          'Error loading list data.'
        ) ||
        this.documentContext.document.createTextNode(
          'Error loading list data.'
        );
      this.elements.listContainerElement.appendChild(errorMsg);
      this._onListRendered(null, this.elements.listContainerElement);
      return;
    }

    DomUtils.clearElement(this.elements.listContainerElement);
    this.logger.debug(`${this._logPrefix} Cleared list container.`);

    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      this.logger.info(
        `${this._logPrefix} List data is empty or not an array. Displaying empty message.`
      );
      const emptyMessage = this._getEmptyListMessage();
      if (typeof emptyMessage === 'string') {
        if (this.domElementFactory) {
          const pEmpty = this.domElementFactory.p(
            'empty-list-message',
            emptyMessage
          );
          if (pEmpty) {
            this.elements.listContainerElement.appendChild(pEmpty);
          } else {
            // Fallback if p creation fails
            this.elements.listContainerElement.textContent = emptyMessage;
          }
        } else {
          this.elements.listContainerElement.textContent = emptyMessage;
        }
      } else if (emptyMessage instanceof HTMLElement) {
        this.elements.listContainerElement.appendChild(emptyMessage);
      } else {
        this.logger.warn(
          `${this._logPrefix} _getEmptyListMessage() returned an invalid type. Expected string or HTMLElement.`,
          { type: typeof emptyMessage }
        );
        const fallbackEmptyMsg =
          this.domElementFactory?.p('empty-list-message', 'List is empty.') ||
          this.documentContext.document.createTextNode('List is empty.');
        this.elements.listContainerElement.appendChild(fallbackEmptyMsg);
      }
      this.logger.debug(`${this._logPrefix} Empty list message displayed.`);
    } else {
      this.logger.debug(
        `${this._logPrefix} Populating list with ${itemsData.length} items.`
      );
      let renderedCount = 0;
      itemsData.forEach((itemData, index) => {
        try {
          const listItemElement = this._renderListItem(
            itemData,
            index,
            itemsData
          );
          if (listItemElement instanceof HTMLElement) {
            this.elements.listContainerElement.appendChild(listItemElement);
            renderedCount++;
          } else if (listItemElement !== null) {
            this.logger.warn(
              `${this._logPrefix} _renderListItem for item at index ${index} did not return an HTMLElement or null. Skipping.`,
              {
                itemData,
                returnedValue: listItemElement,
              }
            );
          }
        } catch (error) {
          this.logger.error(
            `${this._logPrefix} Error in _renderListItem for item at index ${index}:`,
            error,
            { itemData }
          );
          // Optionally render an error placeholder for this specific item
        }
      });
      this.logger.info(
        `${this._logPrefix} Rendered ${renderedCount} out of ${itemsData.length} items into the list.`
      );
    }

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
