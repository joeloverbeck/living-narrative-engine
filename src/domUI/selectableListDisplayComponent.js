// src/domUI/selectableListDisplayComponent.js

import { BaseListDisplayComponent } from './baseListDisplayComponent.js';
import { setupRadioListNavigation } from '../utils/listNavigationUtils.js';

/**
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 */

/**
 * @class SelectableListDisplayComponent
 * @augments BaseListDisplayComponent
 * @description Generic list renderer supporting item selection.
 * It extends {@link BaseListDisplayComponent} to handle list rendering and
 * adds logic for selecting items via click or keyboard navigation.
 */
export class SelectableListDisplayComponent extends BaseListDisplayComponent {
  /**
   * Currently selected item data.
   *
   * @type {any|null}
   * @protected
   */
  selectedItemData = null;

  /**
   * Cache of all list data currently rendered.
   *
   * @type {Array<any>}
   * @protected
   */
  currentListData = [];

  /**
   * Dataset key used on each item element.
   *
   * @type {string}
   * @protected
   */
  _datasetKey;

  /**
   * Stores the handler for arrow key navigation created by the utility.
   *
   * @private
   * @type {((event: KeyboardEvent) => void) | null}
   */
  _arrowKeyHandler = null;

  /**
   * Stores the bound keydown handler to ensure it's only attached once.
   *
   * @private
   * @type {((event: KeyboardEvent) => void) | null}
   */
  _boundKeyDownHandler = null;

  /**
   * Creates a SelectableListDisplayComponent instance.
   *
   * @param {object} params - Constructor parameters.
   * @param {string} params.datasetKey - Dataset attribute storing the item identifier.
   * @param {ILogger} params.logger - Logger instance.
   * @param {IDocumentContext} params.documentContext - Document context abstraction.
   * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - Event dispatcher.
   * @param {DomElementFactory} [params.domElementFactory] - DOM element factory.
   * @param {...any} params.otherDeps - Additional dependencies forwarded to the base class.
   */
  constructor(params) {
    const {
      datasetKey,
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory,
      autoRefresh,
      ...otherDeps
    } = params;

    if (!datasetKey || typeof datasetKey !== 'string') {
      throw new Error(
        `[SelectableListDisplayComponent] 'datasetKey' is required and must be a string.`
      );
    }

    // Explicitly forward all expected dependencies to the base class constructor.
    // This is the most robust way to handle dependency injection through inheritance.
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory,
      autoRefresh,
      ...otherDeps,
    });

    this._datasetKey = datasetKey;
  }

  /**
   * Handles item selection logic and updates DOM state.
   *
   * @protected
   * @param {HTMLElement|null} selectedElement - Element representing the selected item.
   * @param {any|null} itemData - Associated item data.
   * @returns {void}
   */
  _handleItemSelection(selectedElement, itemData) {
    this.selectedItemData = itemData;
    const container = this.elements.listContainerElement;
    if (!container) return;
    container.querySelectorAll('[role="radio"]').forEach((el) => {
      const isSelected = el === selectedElement;
      el.classList.toggle('selected', isSelected);
      el.setAttribute('aria-checked', String(isSelected));
      el.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
    if (selectedElement) selectedElement.focus();
  }

  /**
   * Programmatically selects an item.
   *
   * @protected
   * @param {HTMLElement|null} selectedElement - The element representing the item to select.
   * @param {any|null} itemData - The data associated with the item.
   * @returns {void}
   */
  _selectItem(selectedElement, itemData) {
    this._handleItemSelection(selectedElement, itemData);
  }

  /**
   * The single handler for all keydown events on the list container.
   * It delegates to the arrow key handler and also checks for selection keys.
   *
   * @param {KeyboardEvent} event The keyboard event.
   * @private
   */
  _handleKeyDown(event) {
    // Delegate arrow, home, end key navigation to the specialized handler.
    if (this._arrowKeyHandler) {
      this._arrowKeyHandler(event);
    }

    // Handle selection confirmation keys (Enter, Space).
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = /** @type {HTMLElement} */ (event.target);

      // Ensure the event target is a list item.
      if (target?.matches('[role="radio"]')) {
        const value = target.dataset[this._datasetKey];
        const data = this.currentListData.find(
          (d) => String(d[this._datasetKey]) === String(value)
        );
        if (data) this._selectItem(target, data);
      }
    }
  }

  /**
   * Called after the list has been rendered to wire up selection handlers.
   *
   * @protected
   * @override
   * @param {Array<any>|null} listData - Data that was rendered.
   * @param {HTMLElement} container - List container element.
   * @returns {void}
   */
  _onListRendered(listData, container) {
    this.currentListData = Array.isArray(listData) ? listData : [];

    // Create the handler for arrow key navigation. This is what the test expects on render.
    this._arrowKeyHandler = setupRadioListNavigation(
      container,
      '[role="radio"]',
      this._datasetKey,
      (el, value) => {
        const data = this.currentListData.find(
          (d) => String(d[this._datasetKey]) === String(value)
        );
        if (data) this._selectItem(el, data);
      }
    );

    // Set up click listeners for each rendered item.
    container.querySelectorAll('[role="radio"]').forEach((el) => {
      this._addDomListener(el, 'click', () => {
        const value = el.dataset[this._datasetKey];
        const data = this.currentListData.find(
          (d) => String(d[this._datasetKey]) === String(value)
        );
        if (data) this._selectItem(el, data);
      });
    });

    // Add the keydown listener only ONCE.
    if (!this._boundKeyDownHandler) {
      this._boundKeyDownHandler = this._handleKeyDown.bind(this);
      this._addDomListener(container, 'keydown', this._boundKeyDownHandler);
    }
  }

  /**
   * Disposes of resources and DOM listeners.
   *
   * @override
   */
  dispose() {
    super.dispose();
    this.selectedItemData = null;
    this.currentListData = [];
    this._arrowKeyHandler = null;
    this._boundKeyDownHandler = null;
  }
}
