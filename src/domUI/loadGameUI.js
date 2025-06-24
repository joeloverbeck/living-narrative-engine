// src/domUI/loadGameUI.js

import { SlotModalBase } from './slotModalBase.js';
import { DomUtils } from '../utils/domUtils.js';
import { formatSaveFileMetadata } from './helpers/slotDataFormatter.js';
import { fetchAndFormatLoadSlots } from '../utils/loadSlotUtils.js';
import {
  renderGenericSlotItem,
  renderSlotItem,
} from './helpers/renderSlotItem.js';
import { buildModalElementsConfig } from './helpers/buildModalElementsConfig.js';
import createEmptySlotMessage from './helpers/createEmptySlotMessage.js';
import { DATASET_SLOT_IDENTIFIER } from '../constants/datasetKeys.js';

/**
 * Dataset key storing the unique string identifier on load slot elements.
 *
 * @constant {string}
 */

/**
 * @typedef {import('../engine/gameEngine.js').default} GameEngine
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../domUI/domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata
 * @typedef {import('../persistence/gamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */

/**
 * Extends SaveFileMetadata for display purposes, including corruption status.
 *
 * @typedef {SaveFileMetadata & { isCorrupted?: boolean }} LoadSlotDisplayData
 */

/**
 * @class LoadGameUI
 * @augments BaseModalRenderer
 * @description Manages the modal dialog for loading saved games.
 */
class LoadGameUI extends SlotModalBase {
  saveLoadService;
  gameEngine = null;

  // isOperationInProgress is managed by BaseModalRenderer's _setOperationInProgress

  /**
   * Creates the LoadGameUI instance.
   *
   * @param {object} deps - Dependencies.
   * @param {ILogger} deps.logger - Logger for debug output.
   * @param {IDocumentContext} deps.documentContext - DOM abstraction layer.
   * @param {DomElementFactory} deps.domElementFactory - Factory for DOM elements.
   * @param {ISaveLoadService} deps.saveLoadService - Service for loading/saving.
   * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher instance.
   * @param {IUserPrompt} deps.userPrompt - Utility for user confirmations.
   */
  constructor({
    logger,
    documentContext,
    domElementFactory,
    saveLoadService,
    validatedEventDispatcher,
    userPrompt,
  }) {
    const elementsConfig = buildModalElementsConfig({
      modalElement: '#load-game-screen',
      closeButton: '#cancel-load-button',
      listContainerElement: '#load-slots-container',
      confirmLoadButtonEl: ['#confirm-load-button', HTMLButtonElement],
      deleteSaveButtonEl: ['#delete-save-button', HTMLButtonElement],
      statusMessageElement: '#load-game-status-message',
    });
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory,
      datasetKey: DATASET_SLOT_IDENTIFIER,
      confirmButtonKey: 'confirmLoadButtonEl',
      deleteButtonKey: 'deleteSaveButtonEl',
    });
    if (
      !saveLoadService ||
      typeof saveLoadService.listManualSaveSlots !== 'function' ||
      typeof saveLoadService.deleteManualSave !== 'function'
    ) {
      throw new Error(
        `${this._logPrefix} ISaveLoadService dependency is missing or invalid (missing listManualSaveSlots or deleteManualSave).`
      );
    }

    this.saveLoadService = saveLoadService;

    if (!userPrompt || typeof userPrompt.confirm !== 'function') {
      throw new Error(
        `${this._logPrefix} IUserPrompt dependency is missing or invalid.`
      );
    }
    this.userPrompt = userPrompt;

    // _bindUiElements is handled by BoundDomRendererBase (via BaseModalRenderer)

    this.logger.debug(
      `${this._logPrefix} Instance created and extends SlotModalBase.`
    );
  }

  /**
   * Initializes the LoadGameUI with the GameEngine instance and sets up event listeners.
   *
   * @param {GameEngine} gameEngineInstance - The main game engine instance.
   */
  init(gameEngineInstance) {
    if (
      !gameEngineInstance ||
      typeof gameEngineInstance.loadGame !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} Invalid GameEngine instance provided during init. Load functionality will be broken.`
      );
      return;
    }
    this.gameEngine = gameEngineInstance;

    // Core modal elements are checked by BaseModalRenderer constructor.
    // We only need to ensure this.elements exists before adding listeners.
    if (!this.elements.modalElement) {
      // Example check
      this.logger.error(
        `${this._logPrefix} Cannot init: Core Load Game UI elements not bound by BaseModalRenderer.`
      );
      return;
    }
    this._initEventListeners();
    this.logger.debug(
      `${this._logPrefix} Initialized and event listeners attached via _addDomListener.`
    );
  }

  /**
   * Sets up all DOM event listeners used by the Load Game UI.
   *
   * @private
   */
  _initEventListeners() {
    // Close button listener is automatically added by BaseModalRenderer if 'closeButton' is in elementsConfig.
    if (this.elements.confirmLoadButtonEl) {
      this._addDomListener(
        this.elements.confirmLoadButtonEl,
        'click',
        this._handleLoad.bind(this)
      );
    }
    if (this.elements.deleteSaveButtonEl) {
      this._addDomListener(
        this.elements.deleteSaveButtonEl,
        'click',
        this._handleDelete.bind(this)
      );
    }
    if (this.elements.modalElement) {
      this._addDomListener(this.elements.modalElement, 'submit', (event) =>
        event.preventDefault()
      );
    }
    // Keyboard navigation is now handled by SlotModalBase
  }

  /**
   * @protected
   * @override
   */
  async _onShow() {
    this.logger.debug(`${this._logPrefix} _onShow hook called.`);
    this.selectedSlotData = null;

    if (this.elements.confirmLoadButtonEl) {
      this.elements.confirmLoadButtonEl.disabled = true;
    }
    if (this.elements.deleteSaveButtonEl) {
      this.elements.deleteSaveButtonEl.disabled = true;
    }
    // _clearStatusMessage() is called by BaseModalRenderer.show() before _onShow
    await this._populateLoadSlotsList();
  }

  /**
   * @protected
   * @override
   */
  _onHide() {
    this.logger.debug(
      `${this._logPrefix} _onHide hook called. Clearing load slots list.`
    );
    if (this.elements.listContainerElement) {
      DomUtils.clearElement(this.elements.listContainerElement);
    }
    this.currentSlotsDisplayData = [];
    this.selectedSlotData = null;
    // Status message is cleared by BaseModalRenderer.show() -> _clearStatusMessage() on next show.
  }

  /**
   * Determines which element should receive focus when the modal is shown.
   *
   * @protected
   * @override
   * @returns {HTMLElement | null} Element to focus or null if none.
   */
  _getInitialFocusElement() {
    // Try to focus the first non-corrupted slot, then the close button.
    if (this.elements.listContainerElement) {
      const firstGoodSlot = this.elements.listContainerElement.querySelector(
        '.save-slot:not(.corrupted)'
      );
      if (firstGoodSlot) return /** @type {HTMLElement} */ (firstGoodSlot);
    }
    // Fallback to closeButton (defined in elementsConfig for BaseModalRenderer)
    // or the modalElement itself if closeButton isn't available/focusable.
    return /** @type {HTMLElement | null} */ (
      this.elements.closeButton || this.elements.modalElement
    );
  }

  /**
   * Fetches and processes save slot data from the service.
   *
   * @private
   * @async
   * @returns {Promise<LoadSlotDisplayData[]>} Resolved slot data for rendering.
   */
  async _getLoadSlotsData() {
    this.logger.debug(`${this._logPrefix} Fetching load slots data...`);
    let displaySlots = [];
    try {
      displaySlots = await fetchAndFormatLoadSlots(this.saveLoadService);
      this.logger.debug(
        `${this._logPrefix} Fetched ${displaySlots.length} manual save slots.`
      );
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error fetching or processing save slots data:`,
        error
      );
      this._displayStatusMessage('Error loading list of saved games.', 'error');
      return []; // Return empty on error
    }
    this.currentSlotsDisplayData = displaySlots;
    return this.currentSlotsDisplayData;
  }

  /**
   * Renders a single save slot item.
   *
   * @private
   * @param {LoadSlotDisplayData} slotData - The data for the slot.
   * @param {number} itemIndex - The index of the item.
   * @returns {HTMLElement | null} The rendered list item element.
   */
  _renderLoadSlotItem(slotData, itemIndex) {
    if (!this.domElementFactory) {
      this.logger.error(
        `${this._logPrefix} DomElementFactory not available in _renderLoadSlotItem.`
      );
      return null;
    }

    const metadata = slotData.slotItemMeta || formatSaveFileMetadata(slotData);

    return renderGenericSlotItem(
      this.domElementFactory,
      DATASET_SLOT_IDENTIFIER,
      slotData.identifier,
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
   * Gets the message to display when the load slots list is empty.
   *
   * @private
   * @returns {string | HTMLElement} Element or text explaining no saves found.
   */
  _getEmptyLoadSlotsMessage() {
    return createEmptySlotMessage(
      this.domElementFactory,
      'No saved games found.'
    );
  }

  /**
   * Populates the load slots list in the UI.
   * Orchestrates fetching data, clearing container, rendering items or empty message.
   *
   * @private
   * @async
   */
  async _populateLoadSlotsList() {
    this.logger.debug(`${this._logPrefix} Populating load slots list...`);
    await this.populateSlotsList(
      () => this._getLoadSlotsData(),
      (slotData, index) => this._renderLoadSlotItem(slotData, index),
      () => this._getEmptyLoadSlotsMessage(),
      'Loading saved games...'
    );

    this._onItemSelected(null, null); // Update button states
    this.logger.debug(`${this._logPrefix} Load slots list populated.`);
  }

  /**
   * Handles UI updates when a save slot is selected or deselected.
   *
   * @param {HTMLElement | null} selectedSlotElement - The clicked slot element.
   * @param {LoadSlotDisplayData | null} slotData - Associated slot information.
   * @private
   */
  /**
   * @protected
   * @override
   */
  _onItemSelected(selectedSlotElement, slotData) {
    super._onItemSelected(selectedSlotElement, slotData);

    const canLoad = !!(slotData && !slotData.isCorrupted);
    const canDelete = !!slotData;

    if (this.elements.confirmLoadButtonEl)
      this.elements.confirmLoadButtonEl.disabled = !canLoad;
    if (this.elements.deleteSaveButtonEl)
      this.elements.deleteSaveButtonEl.disabled = !canDelete;

    if (slotData) {
      this.logger.debug(
        `${this._logPrefix} Slot selected: ID ${slotData.identifier}`,
        slotData
      );
    } else {
      this.logger.debug(`${this._logPrefix} Slot selection cleared.`);
    }
  }

  /**
   * Handles the "Load" button click.
   *
   * @private
   * @async
   */
  async _handleLoad() {
    const validationError = this._validateLoadPreconditions();
    if (validationError) {
      this._displayStatusMessage(validationError, 'error');
      return;
    }

    const slotToLoad = this.selectedSlotData;
    this.logger.debug(
      `${this._logPrefix} User initiated load for: ${slotToLoad.identifier} ("${slotToLoad.saveName}")`
    );
    this._setOperationInProgress(true);
    this._displayStatusMessage(
      `Loading game "${slotToLoad.saveName}"...`,
      'info'
    );

    const { success, message } = await this._performLoad(slotToLoad);
    this._finalizeLoad(success, message, slotToLoad);
    // Note: _setOperationInProgress(false) is called in _finalizeLoad on failure, success path leads to hide().
  }

  /**
   * Validates that a slot is selected and the game engine is ready.
   *
   * @private
   * @returns {string | null} Error message if validation fails.
   */
  _validateLoadPreconditions() {
    if (!this.selectedSlotData || this.selectedSlotData.isCorrupted) {
      this.logger.warn(
        `${this._logPrefix} Load attempt ignored: no slot selected, or slot corrupted.`
      );
      if (this.selectedSlotData?.isCorrupted) {
        return 'Cannot load a corrupted save file. Please delete it or choose another.';
      }
      return 'Please select a save slot to load.';
    }
    if (!this.gameEngine) {
      this.logger.error(
        `${this._logPrefix} GameEngine not available. Cannot load game.`
      );
      return 'Cannot load: Game engine is not ready.';
    }
    return null;
  }

  /**
   * Executes the load operation via the GameEngine.
   *
   * @private
   * @async
   * @param {LoadSlotDisplayData} slotToLoad - Slot data to load.
   * @returns {Promise<{success: boolean, message: string}>} Result info.
   */
  async _performLoad(slotToLoad) {
    try {
      const result = await this.gameEngine.loadGame(slotToLoad.identifier);
      if (result && result.success) {
        this.logger.debug(
          `${this._logPrefix} Game loaded successfully from ${slotToLoad.identifier}`
        );
        return { success: true, message: '' };
      }
      const errorMsg =
        result?.error || 'An unknown error occurred while loading the game.';
      this.logger.error(
        `${this._logPrefix} Failed to load game from ${slotToLoad.identifier}: ${errorMsg}`
      );
      return { success: false, message: errorMsg };
    } catch (error) {
      const exceptionMsg =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `${this._logPrefix} Exception during load operation for ${slotToLoad.identifier}:`,
        error
      );
      return { success: false, message: exceptionMsg };
    }
  }

  /**
   * Finalizes UI updates after a load attempt.
   *
   * @private
   * @param {boolean} success - Whether the load succeeded.
   * @param {string} message - Error message if any.
   * @param {LoadSlotDisplayData} slotToLoad - Slot that was attempted to load.
   * @returns {void}
   */
  _finalizeLoad(success, message, slotToLoad) {
    if (success) {
      this._displayStatusMessage(
        `Game "${slotToLoad.saveName}" loaded successfully. Resuming...`,
        'success'
      );
      setTimeout(() => this.hide(), 1500);
    } else {
      this._displayStatusMessage(`Load failed: ${message}`, 'error');
      this._setOperationInProgress(false);
    }
  }

  /**
   * Handles the "Delete" button click.
   *
   * @private
   * @async
   */
  async _handleDelete() {
    if (!this.selectedSlotData) {
      this.logger.warn(
        `${this._logPrefix} Delete attempt ignored: no slot selected.`
      );
      this._displayStatusMessage(
        'Please select a save slot to delete.',
        'error'
      );
      return;
    }

    const slotToDelete = this.selectedSlotData;
    if (!(await this._confirmDeletion(slotToDelete))) {
      return;
    }

    this.logger.debug(
      `${this._logPrefix} User initiated delete for: ${slotToDelete.identifier}("${slotToDelete.saveName}")`
    );
    this._setOperationInProgress(true);
    this._displayStatusMessage(
      `Deleting save "${slotToDelete.saveName}"...`,
      'info'
    );

    const result = await this._performDelete(slotToDelete);
    await this._refreshAfterDelete(result, slotToDelete);
  }

  /**
   * Asks the user to confirm a deletion action.
   *
   * @private
   * @param {LoadSlotDisplayData} slotToDelete - Slot data targeted for deletion.
   * @returns {Promise<boolean>} `true` if the user confirms.
   */
  async _confirmDeletion(slotToDelete) {
    const confirmMsg = `Are you sure you want to delete the save "${slotToDelete.saveName}"? This action cannot be undone.`;
    const confirmed = this.userPrompt.confirm(confirmMsg);
    if (!confirmed) {
      this.logger.debug(
        `${this._logPrefix} Delete operation cancelled by user for: ${slotToDelete.identifier}`
      );
    }
    return confirmed;
  }

  /**
   * Performs the delete operation via the save/load service.
   *
   * @private
   * @async
   * @param {LoadSlotDisplayData} slotToDelete - Slot data targeted for deletion.
   * @returns {Promise<{success: boolean, message: string}>} Result info.
   */
  async _performDelete(slotToDelete) {
    try {
      const result = await this.saveLoadService.deleteManualSave(
        slotToDelete.identifier
      );
      if (result && result.success) {
        this.logger.debug(
          `${this._logPrefix} Save deleted successfully: ${slotToDelete.identifier}`
        );
        return { success: true, message: '' };
      }
      const errorMsg =
        result?.error || 'An unknown error occurred while deleting the save.';
      this.logger.error(
        `${this._logPrefix} Failed to delete save ${slotToDelete.identifier}: ${errorMsg}`
      );
      return { success: false, message: errorMsg };
    } catch (error) {
      const exceptionMsg =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `${this._logPrefix} Exception during delete operation for ${slotToDelete.identifier}:`,
        error
      );
      return { success: false, message: exceptionMsg };
    }
  }

  /**
   * Refreshes the UI after a delete attempt and updates focus.
   *
   * @private
   * @async
   * @param {{success: boolean, message: string}} result - Outcome of deletion.
   * @param {LoadSlotDisplayData} slotToDelete - Slot that was attempted to delete.
   * @returns {Promise<void>} Resolves when refresh actions complete.
   */
  async _refreshAfterDelete(result, slotToDelete) {
    if (result.success) {
      this._displayStatusMessage(
        `Save "${slotToDelete.saveName}" deleted successfully.`,
        'success'
      );
      this.selectedSlotData = null;
      await this._populateLoadSlotsList();

      this._setOperationInProgress(false);
      const firstSlot =
        this.elements.listContainerElement?.querySelector('.save-slot');
      if (firstSlot) {
        /** @type {HTMLElement} */ (firstSlot).focus();
        const firstSlotIdentifier = /** @type {HTMLElement} */ (firstSlot)
          .dataset[DATASET_SLOT_IDENTIFIER];
        const firstSlotData = this.currentSlotsDisplayData.find(
          (s) => s.identifier === firstSlotIdentifier
        );
        if (firstSlotData) {
          this._onItemSelected(
            /** @type {HTMLElement} */ (firstSlot),
            firstSlotData
          );
        } else {
          this._onItemSelected(null, null);
        }
      } else {
        this._onItemSelected(null, null);
      }
    } else {
      this._displayStatusMessage(`Delete failed: ${result.message}`, 'error');
      this._setOperationInProgress(false);
    }
  }

  /**
   * @override
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing LoadGameUI.`);
    super.dispose(); // Handles VED subscriptions, DOM listeners, and BoundDOMRenderer elements.
    this.gameEngine = null;
    this.selectedSlotData = null;
    this.currentSlotsDisplayData = [];
    this.logger.debug(`${this._logPrefix} LoadGameUI disposed.`);
  }
}

export default LoadGameUI;
