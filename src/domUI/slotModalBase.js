// src/domUI/slotModalBase.js

/**
 * @file Defines SlotModalBase, a base class for save/load slot modals.
 */

import { BaseModalRenderer } from './baseModalRenderer.js';
import { setupRadioListNavigation } from '../utils/listNavigation.js';

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
   * @param {string} [deps.confirmButtonKey] - Key for confirm button element.
   * @param {string} [deps.deleteButtonKey] - Key for delete button element.
   * @param {...any} deps.rest - Remaining dependencies forwarded to BaseModalRenderer.
   */
  constructor({ datasetKey, confirmButtonKey, deleteButtonKey, ...rest }) {
    super(rest);
    this._datasetKey = datasetKey;
    this._confirmButtonKey = confirmButtonKey;
    this._deleteButtonKey = deleteButtonKey;
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
  _handleSlotSelection(selectedSlotElement, slotData) {
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
   * Keyboard navigation handler for the slot list.
   *
   * @param {KeyboardEvent} event - Key event to process.
   * @protected
   */
  _handleSlotNavigation(event) {
    if (!this.elements.listContainerElement) return;

    const arrowHandler = setupRadioListNavigation(
      this.elements.listContainerElement,
      '.save-slot[role="radio"]',
      this._datasetKey,
      (el, value) => {
        let slotData;
        if (this._datasetKey === 'slotId') {
          const slotId = parseInt(value || '-1', 10);
          slotData = this.currentSlotsDisplayData.find(
            (s) => s.slotId === slotId
          );
        } else {
          slotData = this.currentSlotsDisplayData.find(
            (s) => String(s[this._datasetKey]) === String(value)
          );
        }
        if (slotData) this._handleSlotSelection(el, slotData);
      }
    );

    arrowHandler(event);

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = /** @type {HTMLElement} */ (event.target);
      const value = target.dataset[this._datasetKey];
      let slotData;
      if (this._datasetKey === 'slotId') {
        const slotId = parseInt(value || '-1', 10);
        slotData = this.currentSlotsDisplayData.find(
          (s) => s.slotId === slotId
        );
      } else {
        slotData = this.currentSlotsDisplayData.find(
          (s) => String(s[this._datasetKey]) === String(value)
        );
      }
      if (slotData) this._handleSlotSelection(target, slotData);
    }
  }
}

export default SlotModalBase;
