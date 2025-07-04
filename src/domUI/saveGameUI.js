// src/domUI/saveGameUI.js

import { SlotModalBase } from './slotModalBase.js';
import { DomUtils } from '../utils/domUtils.js';
import {
  formatSaveFileMetadata,
  formatEmptySlot,
} from './helpers/slotDataFormatter.js';
import {
  renderGenericSlotItem,
  renderSlotItem,
} from './helpers/renderSlotItem.js';
import { buildModalElementsConfig } from './helpers/buildModalElementsConfig.js';
import createEmptySlotMessage from './helpers/createEmptySlotMessage.js';
import { DATASET_SLOT_ID } from '../constants/datasetKeys.js';
import SaveGameService from './saveGameService.js';
import './saveGameTypedefs.js';

/**
 * Dataset key storing the numeric slot ID on save slot elements.
 *
 * @constant {string}
 */

/**
 * @typedef {import('../interfaces/ISaveService.js').ISaveService} ISaveService
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */

const MAX_SAVE_SLOTS = 10;

/**
 * @class SaveGameUI
 * @augments BaseModalRenderer
 * @description Manages the modal dialog for saving the game.
 */
export class SaveGameUI extends SlotModalBase {
  saveLoadService;
  saveGameService;
  saveService = null;
  // isSavingInProgress is managed by BaseModalRenderer's _setOperationInProgress

  /**
   * @override
   * @protected
   * @description Specifies the actual element keys from `elementsConfig`
   * that should be affected by the `_setOperationInProgress` method.
   * `closeButton` is used here as the "cancel" action for the save modal.
   * @type {string[]}
   */
  _operationInProgressAffectedElements = ['confirmSaveButtonEl', 'closeButton'];

  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger
   * @param {IDocumentContext} deps.documentContext
   * @param {DomElementFactory} deps.domElementFactory
   * @param {ISaveLoadService} deps.saveLoadService
   * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher
   * @param {SaveGameService} deps.saveGameService
   */
  constructor({
    logger,
    documentContext,
    domElementFactory,
    saveLoadService,
    validatedEventDispatcher,
    saveGameService,
  }) {
    const elementsConfig = buildModalElementsConfig({
      modalElement: '#save-game-screen',
      closeButton: '#cancel-save-button',
      listContainerElement: '#save-slots-container',
      saveNameInputEl: ['#save-name-input', HTMLInputElement],
      confirmSaveButtonEl: ['#confirm-save-button', HTMLButtonElement],
      statusMessageElement: '#save-game-status-message',
    });
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory,
      datasetKey: DATASET_SLOT_ID,
      buttonKeys: { confirmKey: 'confirmSaveButtonEl' },
    });

    if (
      !saveLoadService ||
      typeof saveLoadService.listManualSaveSlots !== 'function'
    ) {
      throw new Error(
        `${this._logPrefix} ISaveLoadService dependency is missing or invalid.`
      );
    }
    this.saveLoadService = saveLoadService;

    if (
      !saveGameService ||
      typeof saveGameService.validatePreconditions !== 'function' ||
      typeof saveGameService.confirmOverwrite !== 'function' ||
      typeof saveGameService.performSave !== 'function'
    ) {
      throw new Error(
        `${this._logPrefix} SaveGameService dependency is missing or invalid.`
      );
    }
    this.saveGameService = saveGameService;

    // Elements are now in this.elements, e.g., this.elements.saveNameInputEl
    // _bindUiElements is handled by BoundDomRendererBase

    this._initModalEventListeners();
    this.logger.debug(
      `${this._logPrefix} Instance created and extends SlotModalBase.`
    );
  }

  /**
   * Initializes event listeners specific to SaveGameUI functionality.
   * Core modal events (close, Esc) are handled by BaseModalRenderer.
   *
   * @private
   */
  _initModalEventListeners() {
    this._initCommonListeners(this._handleSave.bind(this));
    // Keyboard navigation is handled by SlotModalBase
    if (this.elements.saveNameInputEl) {
      this._addDomListener(
        this.elements.saveNameInputEl,
        'input',
        this._handleSaveNameInput.bind(this)
      );
    }
  }

  /**
   * Initializes the SaveGameUI with the save service instance.
   *
   * @param {ISaveService} saveServiceInstance - Service for saving games.
   */
  init(saveServiceInstance) {
    if (
      !saveServiceInstance ||
      typeof saveServiceInstance.save !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} Invalid ISaveService instance provided during init. Save functionality will be broken.`
      );
      return;
    }
    this.saveService = saveServiceInstance;
    this.logger.debug(`${this._logPrefix} ISaveService instance received.`);
  }

  /**
   * @protected
   * @override
   * Called by BaseModalRenderer when the modal is shown.
   */
  async _onShow() {
    this.logger.debug(`${this._logPrefix} _onShow hook called.`);
    this.selectedSlotData = null;

    if (this.elements.saveNameInputEl) {
      this.elements.saveNameInputEl.value = '';
      this.elements.saveNameInputEl.disabled = true;
    }
    if (this.elements.confirmSaveButtonEl) {
      this.elements.confirmSaveButtonEl.disabled = true;
    }
    // _clearStatusMessage() is called by BaseModalRenderer.show()
    await this._populateSaveSlotsList();
  }

  /**
   * @protected
   * @override
   * Called by BaseModalRenderer when the modal is hidden.
   */
  _onHide() {
    this.logger.debug(
      `${this._logPrefix} _onHide hook called. Clearing save slots list.`
    );
    if (this.elements.listContainerElement) {
      DomUtils.clearElement(this.elements.listContainerElement);
    }
    this.clearSlotData();
    this.selectedSlotData = null;
  }

  /**
   * @protected
   * @override
   * @returns {HTMLElement | null}
   */
  _getInitialFocusElement() {
    // Try to focus the first non-corrupted, non-empty slot, then first empty, then input, then close.
    if (this.elements.listContainerElement) {
      const firstGoodSlot = this.elements.listContainerElement.querySelector(
        '.save-slot:not(.corrupted):not(.empty)'
      );
      if (firstGoodSlot) return /** @type {HTMLElement} */ (firstGoodSlot);
      const firstEmptySlot =
        this.elements.listContainerElement.querySelector('.save-slot.empty');
      if (firstEmptySlot) return /** @type {HTMLElement} */ (firstEmptySlot);
    }
    if (
      this.elements.saveNameInputEl &&
      !this.elements.saveNameInputEl.disabled
    ) {
      return this.elements.saveNameInputEl;
    }
    return /** @type {HTMLElement | null} */ (
      this.elements.closeButton || this.elements.modalElement
    );
  }

  /**
   * Fetches and processes save slot data from the service.
   *
   * @private
   * @async
   * @returns {Promise<SlotDisplayData[]>}
   */
  async _getSaveSlotsData() {
    this.logger.debug(`${this._logPrefix} Fetching save slots data...`);
    const displaySlots = [];
    try {
      const actualSaves = await this.saveLoadService.listManualSaveSlots();
      this.logger.debug(
        `${this._logPrefix} Fetched ${actualSaves.length} actual save slots.`
      );

      for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        // Fill with actual saves first, then empty placeholders.
        if (i < actualSaves.length) {
          const save = actualSaves[i];
          displaySlots.push({
            slotId: i,
            identifier: save.identifier,
            saveName: save.saveName,
            timestamp: save.timestamp,
            playtimeSeconds: save.playtimeSeconds,
            isCorrupted: save.isCorrupted || false,
            isEmpty: false,
            slotItemMeta: formatSaveFileMetadata(save),
          });
        } else {
          const name = `Empty Slot ${i + 1}`;
          displaySlots.push({
            slotId: i,
            isEmpty: true,
            saveName: name,
            slotItemMeta: formatEmptySlot(name),
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error fetching or processing save slots data:`,
        error
      );
      this._displayStatusMessage(
        'Error loading save slots information.',
        'error'
      );
      return []; // Return empty on error to prevent further issues
    }
    this.setSlotData(displaySlots.slice(0, MAX_SAVE_SLOTS));
    return this.currentSlotsDisplayData;
  }

  /**
   * Renders a single save slot item.
   *
   * @private
   * @param {SlotDisplayData} slotData - The data for the slot.
   * @param {number} itemIndex - The index of the item.
   * @returns {HTMLElement | null} The rendered list item element.
   */
  _renderSaveSlotItem(slotData, itemIndex) {
    if (!this.domElementFactory) return null;

    const metadata =
      slotData.slotItemMeta ||
      (slotData.isEmpty
        ? formatEmptySlot(
            slotData.saveName || `Empty Slot ${slotData.slotId + 1}`
          )
        : formatSaveFileMetadata(slotData));

    return renderGenericSlotItem(
      this.domElementFactory,
      DATASET_SLOT_ID,
      slotData.slotId,
      metadata,
      itemIndex,
      (evt) => {
        this._onItemSelected(
          /** @type {HTMLElement} */ (evt.currentTarget),
          slotData
        );
      }
    );
  }

  /**
   * Gets the message to display when the save slots list is empty.
   *
   * @private
   * @returns {string | HTMLElement}
   */
  _getEmptySaveSlotsMessage() {
    return createEmptySlotMessage(
      this.domElementFactory,
      'No save slots available to display.'
    );
  }

  /**
   * Populates the save slots list in the UI.
   * Orchestrates fetching data, clearing container, rendering items or empty message.
   *
   * @private
   * @async
   */
  async _populateSaveSlotsList() {
    this.logger.debug(`${this._logPrefix} Populating save slots list...`);
    if (!this.elements.listContainerElement) {
      this.logger.error(`${this._logPrefix} List container element not found.`);
      this._displayStatusMessage(
        'Error: UI component for slots missing.',
        'error'
      );
      return;
    }

    await this._populateSlots(
      () => this._getSaveSlotsData(),
      (slotData, index) => this._renderSaveSlotItem(slotData, index),
      () => this._getEmptySaveSlotsMessage(),
      'Loading save slots...'
    );

    // Ensure buttons are correctly disabled if no selection or no valid input
    this._handleSaveNameInput();
    this.logger.debug(`${this._logPrefix} Save slots list populated.`);
  }

  /** @private */
  _handleSaveNameInput() {
    if (!this.elements.confirmSaveButtonEl || !this.elements.saveNameInputEl)
      return;
    const nameIsValid = this.elements.saveNameInputEl.value.trim().length > 0;
    const canSaveToSlot = this.selectedSlotData
      ? !this.selectedSlotData.isCorrupted
      : false;

    this.elements.confirmSaveButtonEl.disabled = !(
      this.selectedSlotData &&
      canSaveToSlot &&
      nameIsValid
    );
  }

  /**
   * Re-selects the slot corresponding to the newly saved game.
   *
   * @param {string | null} returnedIdentifier - Identifier returned from the save operation.
   * @param {string} currentSaveName - Name used for the save.
   * @private
   */
  #reselectSavedSlot(returnedIdentifier, currentSaveName) {
    const newlySavedSlotData = this.currentSlotsDisplayData.find(
      (s) =>
        s.saveName === currentSaveName &&
        s.identifier === returnedIdentifier &&
        !s.isEmpty &&
        !s.isCorrupted
    );

    if (newlySavedSlotData && this.elements.listContainerElement) {
      const slotElement = /** @type {HTMLElement | null} */ (
        this.elements.listContainerElement.querySelector(
          `.save-slot[data-slot-id="${newlySavedSlotData.slotId}"]`
        )
      );
      if (slotElement) {
        this._onItemSelected(slotElement, newlySavedSlotData);
      } else {
        this.logger.warn(
          `${this._logPrefix} Could not find DOM element for newly saved slot ID ${newlySavedSlotData.slotId} to re-select.`
        );
      }
    } else {
      this.logger.warn(
        `${this._logPrefix} Could not find metadata for newly saved slot named "${currentSaveName}" to re-select. Searched with ID: ${String(returnedIdentifier)}.`
      );
      this.currentSlotsDisplayData.forEach((slot) => {
        this.logger.debug(
          `Available slot for re-select check - Name: ${slot.saveName}, ID: ${slot.identifier}`
        );
      });
      this.selectedSlotData = null;
      if (this.elements.saveNameInputEl)
        this.elements.saveNameInputEl.value = '';
      this._handleSaveNameInput();
    }
  }

  /**
   * Executes the save and handles result messaging.
   *
   * @param {string} currentSaveName - Name to use when saving.
   * @private
   * @async
   * @returns {Promise<{success: boolean, message: string}>} Result information.
   */
  /**
   * Finalizes the save operation by updating UI state and status messages.
   *
   * @param {boolean} success - Whether the save succeeded.
   * @param {string} message - Message to display to the user.
   * @private
   * @returns {void}
   */
  #finalizeSave(success, message) {
    this._setOperationInProgress(false);

    if (message) {
      this._displayStatusMessage(message, success ? 'success' : 'error');
    } else if (!success) {
      this._displayStatusMessage(
        'An unspecified error occurred during the save operation.',
        'error'
      );
    }
  }

  /**
   * @param selectedSlotElement
   * @param slotData
   * @private
   */
  /**
   * @protected
   * @override
   */
  _onItemSelected(selectedSlotElement, slotData) {
    this.logger.debug(
      `${this._logPrefix} Slot selected: ID ${slotData.slotId}`,
      slotData
    );
    super._onItemSelected(selectedSlotElement, slotData);

    this._clearStatusMessage();

    if (this.elements.saveNameInputEl) {
      if (slotData.isCorrupted) {
        this.elements.saveNameInputEl.value = '';
        this.elements.saveNameInputEl.disabled = true;
      } else {
        this.elements.saveNameInputEl.disabled = false;
        if (!slotData.isEmpty && slotData.saveName) {
          this.elements.saveNameInputEl.value = slotData.saveName;
        } else {
          const now = new Date();
          this.elements.saveNameInputEl.value = `Save ${now.toLocaleDateString()} ${now.toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          )}`;
        }
      }
    }
    this._handleSaveNameInput(); // Update save button state
  }

  /**
   * Handles the save game operation.
   *
   * @private
   * @async
   */
  async _handleSave() {
    const currentSaveName = this._validateAndConfirmSave();
    if (!currentSaveName) return;
    await this._executeAndFinalizeSave(currentSaveName);
  }

  /**
   * Validates preconditions and confirms overwrite if necessary.
   *
   * @private
   * @returns {string | null} Cleaned save name or null if validation fails
   * or user cancels.
   */
  _validateAndConfirmSave() {
    const currentInput = this.elements.saveNameInputEl?.value || '';
    const validationError = this.saveGameService.validatePreconditions(
      this.selectedSlotData,
      currentInput.trim()
    );
    if (validationError) {
      this._displayStatusMessage(validationError, 'error');
      return null;
    }

    const currentSaveName = currentInput.trim();

    if (
      !this.saveGameService.confirmOverwrite(
        this.selectedSlotData,
        currentSaveName
      )
    ) {
      return null;
    }

    return currentSaveName;
  }

  /**
   * Executes the save and finalizes UI updates.
   *
   * @private
   * @async
   * @param {string} currentSaveName - The validated save name.
   * @returns {Promise<void>} Resolves when the operation completes.
   */
  async _executeAndFinalizeSave(currentSaveName) {
    this._setOperationInProgress(true);
    this._displayStatusMessage(
      `Saving game as "${currentSaveName}"...`,
      'info'
    );

    const { success, message, returnedIdentifier } =
      await this.saveGameService.performSave(
        this.selectedSlotData,
        currentSaveName,
        this.saveService
      );

    if (success) {
      await this._populateSaveSlotsList();
      this.#reselectSavedSlot(returnedIdentifier, currentSaveName);
    }

    this.#finalizeSave(success, message);
  }

  /**
   * Dispose method. Calls super.dispose() for base class cleanup.
   *
   * @override
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing SaveGameUI.`);
    super.dispose(); // Handles VED subscriptions, DOM listeners, and BoundDOMRenderer elements.
    this.saveService = null;
    this.selectedSlotData = null;
    this.clearSlotData();
    this.logger.debug(`${this._logPrefix} SaveGameUI disposed.`);
  }
}

export default SaveGameUI;
