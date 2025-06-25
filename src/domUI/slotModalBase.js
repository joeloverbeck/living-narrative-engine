// src/domUI/slotModalBase.js

/**
 * @file Defines SlotModalBase, a base class for save/load slot modals.
 */

import { BaseModalRenderer } from './baseModalRenderer.js';
import { DomUtils } from '../utils/domUtils.js';
import { setupRadioListNavigation } from '../utils/listNavigationUtils.js';
import createMessageElement from './helpers/createMessageElement.js';
import renderListCommon from './helpers/renderListCommon.js';
import { DATASET_SLOT_ID } from '../constants/datasetKeys.js';

/**
 * Dataset key used to store the slot's numeric ID on DOM elements.
 *
 * @constant {string}
 */

/**
 * Configuration object specifying the element keys for confirm and delete buttons.
 * Both properties are optional.
 *
 * @typedef {object} SlotActionButtonKeys
 * @property {string} [confirmKey] - Key of the confirm button element.
 * @property {string} [deleteKey] - Key of the delete button element.
 */

/**
 * @class SlotModalBase
 * @augments BaseModalRenderer
 * @abstract
 * @description Provides shared slot selection and navigation logic for save/load modals.
 */
export class SlotModalBase extends BaseModalRenderer {
  /**
   * Stores the currently selected slot data.
   *
   * @type {object | null}
   * @protected
   */
  selectedSlotData = null;

  /**
   * Cache of slots currently rendered in the list.
   *
   * @type {object[]}
   * @protected
   */
  currentSlotsDisplayData = [];

  /**
   * Dataset key used on slot elements.
   *
   * @type {string}
   * @protected
   */
  _datasetKey;

  /**
   * Key of the confirm button element in {@link BaseModalRenderer#elements}.
   *
   * @type {string | undefined}
   * @protected
   */
  _confirmButtonKey;

  /**
   * Key of the delete button element in {@link BaseModalRenderer#elements}.
   *
   * @type {string | undefined}
   * @protected
   */
  _deleteButtonKey;

  /**
   * Creates the SlotModalBase instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {string} deps.datasetKey - Dataset key storing slot identifiers.
   * @param {SlotActionButtonKeys} [deps.buttonKeys] - Optional configuration for action button element keys.
   * @param {...any} deps.rest - Remaining dependencies forwarded to BaseModalRenderer.
   */
  constructor({ datasetKey, buttonKeys = {}, ...rest }) {
    super(rest);
    this._datasetKey = datasetKey;
    if (typeof buttonKeys !== 'object' || buttonKeys === null) {
      throw new Error(
        `${this._logPrefix} 'buttonKeys' must be an object when provided.`
      );
    }
    const { confirmKey, deleteKey } = buttonKeys;
    this._confirmButtonKey = confirmKey;
    this._deleteButtonKey = deleteKey;
  }

  /**
   * Retrieves the confirm button element, if configured.
   *
   * @returns {HTMLButtonElement | null}
   * @protected
   */
  get _confirmButtonEl() {
    return /** @type {HTMLButtonElement | null} */ (
      this._confirmButtonKey ? this.elements[this._confirmButtonKey] : null
    );
  }

  /**
   * Retrieves the delete button element, if configured.
   *
   * @returns {HTMLButtonElement | null}
   * @protected
   */
  get _deleteButtonEl() {
    return /** @type {HTMLButtonElement | null} */ (
      this._deleteButtonKey ? this.elements[this._deleteButtonKey] : null
    );
  }

  /**
   * Updates confirm/delete button states based on the selected slot.
   * Subclasses may override to add additional checks.
   *
   * @param {object | null} selected - Selected slot data.
   * @protected
   */
  _updateButtonStates(selected) {
    if (this._confirmButtonEl) this._confirmButtonEl.disabled = !selected;
    if (this._deleteButtonEl) this._deleteButtonEl.disabled = !selected;
  }

  /**
   * Handles slot selection via click or keyboard.
   *
   * @param {HTMLElement | null} selectedSlotElement - Element representing the selected slot.
   * @param {object | null} slotData - Data associated with the slot.
   * @protected
   */
  _onItemSelected(selectedSlotElement, slotData) {
    this.selectedSlotData = slotData;

    this.elements.listContainerElement
      ?.querySelectorAll('.save-slot')
      .forEach((slotEl) => {
        const isSelected = slotEl === selectedSlotElement;
        slotEl.classList.toggle('selected', isSelected);
        slotEl.setAttribute('aria-checked', String(isSelected));
        slotEl.setAttribute('tabindex', isSelected ? '0' : '-1');
      });

    if (
      selectedSlotElement &&
      this.documentContext.document?.activeElement !== selectedSlotElement
    ) {
      selectedSlotElement.focus();
    } else if (!selectedSlotElement && this.elements.listContainerElement) {
      const firstSlot =
        this.elements.listContainerElement.querySelector('.save-slot');
      if (firstSlot) firstSlot.setAttribute('tabindex', '0');
    }

    this._updateButtonStates(slotData);
  }

  /**
   * Handles keyboard navigation within the slot list.
   * Uses arrow keys for navigation and Enter/Space for selection.
   *
   * @protected
   * @param {KeyboardEvent} event - Key event to process.
   * @returns {void}
   */
  _handleSlotNavigation(event) {
    if (!this.elements.listContainerElement) return;

    const arrowHandler = setupRadioListNavigation(
      this.elements.listContainerElement,
      '[role="radio"]',
      this._datasetKey,
      (el, value) => {
        let slotData;
        if (this._datasetKey === DATASET_SLOT_ID) {
          const slotId = parseInt(value || '-1', 10);
          slotData = this.currentSlotsDisplayData.find(
            (s) => s.slotId === slotId
          );
        } else {
          slotData = this.currentSlotsDisplayData.find(
            (s) => String(s[this._datasetKey]) === String(value)
          );
        }
        if (slotData) this._onItemSelected(el, slotData);
      }
    );

    arrowHandler(event);

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = /** @type {HTMLElement} */ (event.target);
      const value = target.dataset[this._datasetKey];
      let slotData;
      if (this._datasetKey === DATASET_SLOT_ID) {
        const slotId = parseInt(value || '-1', 10);
        slotData = this.currentSlotsDisplayData.find(
          (s) => s.slotId === slotId
        );
      } else {
        slotData = this.currentSlotsDisplayData.find(
          (s) => String(s[this._datasetKey]) === String(value)
        );
      }
      if (slotData) this._onItemSelected(target, slotData);
    }
  }

  /**
   * Sets up common modal listeners for confirm actions and form submission.
   *
   * @protected
   * @param {Function} confirmHandler - Handler for the confirm button click.
   * @returns {void}
   */
  _initCommonListeners(confirmHandler) {
    if (this._confirmButtonEl && typeof confirmHandler === 'function') {
      this._addDomListener(this._confirmButtonEl, 'click', confirmHandler);
    }

    if (this.elements.modalElement) {
      this._addDomListener(this.elements.modalElement, 'submit', (event) => {
        event.preventDefault();
      });
    }
  }

  /**
   * Validates that a slot has been selected.
   *
   * @protected
   * @param {boolean} [requireUncorrupted] - Reject corrupted slots when true.
   * @param {object} [messages] - Custom error messages.
   * @param {string} [messages.noSelection] - Message when no slot is selected.
   * @param {string} [messages.corrupted] - Message when slot is corrupted.
   * @returns {string | null} Error message if invalid, otherwise null.
   */
  _validateSlotSelection(requireUncorrupted = false, messages = {}) {
    const {
      noSelection = 'Please select a save slot first.',
      corrupted = 'Cannot use a corrupted save file.',
    } = messages;

    if (!this.selectedSlotData) {
      this.logger.warn(
        `${this._logPrefix} Action attempted without selecting a slot.`
      );
      return noSelection;
    }

    if (
      requireUncorrupted &&
      Object.prototype.hasOwnProperty.call(
        this.selectedSlotData,
        'isCorrupted'
      ) &&
      this.selectedSlotData.isCorrupted
    ) {
      this.logger.warn(`${this._logPrefix} Selected slot is corrupted.`);
      return corrupted;
    }

    return null;
  }

  /**
   * Core logic to populate the slots list.
   *
   * @protected
   * @async
   * @param {Function} dataFetcher - Async function returning slot data array.
   * @param {Function} renderer - Function to render a slot item element.
   * @param {Function} emptyMessageProvider - Function returning message for empty list.
   * @param {string} loadingMessage - Message shown while loading.
   * @returns {Promise<void>} Resolves when list population is complete.
   */
  async _populateSlots(
    dataFetcher,
    renderer,
    emptyMessageProvider,
    loadingMessage
  ) {
    if (!this.elements.listContainerElement) {
      this.logger.error(`${this._logPrefix} List container element not found.`);
      this._displayStatusMessage(
        'Error: UI component for slots missing.',
        'error'
      );
      return;
    }
    this._setOperationInProgress(true);
    this._displayStatusMessage(loadingMessage, 'info');

    const data = await renderListCommon(
      dataFetcher,
      (item, index, list) => renderer(item, index, list),
      emptyMessageProvider,
      this.elements.listContainerElement,
      this.logger,
      this.domElementFactory
    );
    this.currentSlotsDisplayData = Array.isArray(data) ? data : [];

    this._clearStatusMessage();
    this._setOperationInProgress(false);
  }

  /**
   * Generic helper to populate the slots list.
   *
   * @protected
   * @async
   * @param {Function} fetchDataFn - Async function returning slot data array.
   * @param {Function} renderItemFn - Function to render a slot item element.
   * @param {Function} getEmptyMessageFn - Function returning message for empty list.
   * @param {string} loadingMessage - Message shown while loading.
   * @returns {Promise<void>} Resolves when list population is complete.
   */
  async populateSlotsList(
    fetchDataFn,
    renderItemFn,
    getEmptyMessageFn,
    loadingMessage
  ) {
    await this._populateSlots(
      fetchDataFn,
      renderItemFn,
      getEmptyMessageFn,
      loadingMessage
    );
  }
}

export default SlotModalBase;
