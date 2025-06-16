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
  constructor({ datasetKey, ...rest }) {
    if (!datasetKey || typeof datasetKey !== 'string') {
      throw new Error(
        `[SelectableListDisplayComponent] 'datasetKey' is required and must be a string.`
      );
    }
    super(rest);
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
   * Keydown handler enabling arrow navigation and activation via Enter/Space.
   *
   * @protected
   * @param {KeyboardEvent} event - The keydown event.
   * @returns {void}
   */
  _handleItemNavigation(event) {
    if (!this.elements.listContainerElement) return;
    const arrowHandler = setupRadioListNavigation(
      this.elements.listContainerElement,
      '[role="radio"]',
      this._datasetKey,
      (el, value) => {
        const data = this.currentListData.find(
          (d) => String(d[this._datasetKey]) === String(value)
        );
        if (data) this._handleItemSelection(el, data);
      }
    );
    arrowHandler(event);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = /** @type {HTMLElement} */ (event.target);
      const value = target.dataset[this._datasetKey];
      const data = this.currentListData.find(
        (d) => String(d[this._datasetKey]) === String(value)
      );
      if (data) this._handleItemSelection(target, data);
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
    container.querySelectorAll('[role="radio"]').forEach((el) => {
      el.addEventListener('click', () => {
        const value = el.dataset[this._datasetKey];
        const data = this.currentListData.find(
          (d) => String(d[this._datasetKey]) === String(value)
        );
        if (data) this._handleItemSelection(el, data);
      });
    });
    container.addEventListener('keydown', (evt) =>
      this._handleItemNavigation(evt)
    );
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
  }
}
