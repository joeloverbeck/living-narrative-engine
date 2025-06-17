// src/domUI/loadGameUI.js

import { SlotModalBase } from './slotModalBase.js';
import { DomUtils } from '../utils/domUtils.js';
import { formatSaveFileMetadata } from './helpers/slotDataFormatter.js';
import { renderSlotItem } from './helpers/renderSlotItem.js';
import { buildModalElementsConfig } from './helpers/buildModalElementsConfig.js';
import createMessageElement from './helpers/createMessageElement.js';

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
   */
  constructor({
    logger,
    documentContext,
    domElementFactory,
    saveLoadService,
    validatedEventDispatcher,
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
      datasetKey: 'slotIdentifier',
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
      const manualSaves = await this.saveLoadService.listManualSaveSlots();
      this.logger.debug(
        `${this._logPrefix} Fetched ${manualSaves.length} manual save slots.`
      );

      // Sort by timestamp descending (newest first), corrupted at bottom
      manualSaves.sort((a, b) => {
        if (a.isCorrupted && !b.isCorrupted) return 1;
        if (!a.isCorrupted && b.isCorrupted) return -1;
        if (a.isCorrupted && b.isCorrupted) {
          return (a.saveName || a.identifier).localeCompare(
            b.saveName || b.identifier
          );
        }
        try {
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        } catch {
          return 0;
        }
      });
      displaySlots = manualSaves.map((s) => ({
        ...s,
        slotItemMeta: formatSaveFileMetadata(s),
      }));
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

    const slotDiv = renderSlotItem(
      this.domElementFactory,
      'slotIdentifier',
      slotData.identifier,
      metadata,
      (evt) => {
        this._onItemSelected(
          /** @type {HTMLElement} */ (evt.currentTarget),
          slotData
        );
      }
    );
    if (!slotDiv) return null;

    slotDiv.setAttribute('tabindex', itemIndex === 0 ? '0' : '-1');
    return slotDiv;
  }

  /**
   * Gets the message to display when the load slots list is empty.
   *
   * @private
   * @returns {string | HTMLElement} Element or text explaining no saves found.
   */
  _getEmptyLoadSlotsMessage() {
    const message = 'No saved games found.';
    if (this.domElementFactory) {
      return createMessageElement(
        this.domElementFactory,
        'empty-slot-message',
        message
      );
    }
    return message;
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
    if (!this.elements.listContainerElement) {
      this.logger.error(
        `${this._logPrefix} List container element not found in this.elements.`
      );
      this._displayStatusMessage(
        'Error: UI component for slots missing.',
        'error'
      );
      return;
    }

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
   * Keyboard navigation handler for the slot list.
   *
   * @param {KeyboardEvent} event - Key event to process.
   * @private
   */
  _handleSlotNavigation(event) {
    super._handleSlotNavigation(event);
  }

  /**
   * Handles the "Load" button click.
   *
   * @private
   * @async
   */
  async _handleLoad() {
    if (!this.selectedSlotData || this.selectedSlotData.isCorrupted) {
      this.logger.warn(
        `${this._logPrefix} Load attempt ignored: no slot selected, or slot corrupted.`
      );
      if (this.selectedSlotData?.isCorrupted) {
        this._displayStatusMessage(
          'Cannot load a corrupted save file. Please delete it or choose another.',
          'error'
        );
      } else if (!this.selectedSlotData) {
        this._displayStatusMessage(
          'Please select a save slot to load.',
          'error'
        );
      }
      return;
    }
    if (!this.gameEngine) {
      this.logger.error(
        `${this._logPrefix} GameEngine not available. Cannot load game.`
      );
      this._displayStatusMessage(
        'Cannot load: Game engine is not ready.',
        'error'
      );
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

    try {
      const result = await this.gameEngine.loadGame(slotToLoad.identifier);
      if (result && result.success) {
        this._displayStatusMessage(
          `Game "${slotToLoad.saveName}" loaded successfully. Resuming...`,
          'success'
        );
        this.logger.debug(
          `${this._logPrefix} Game loaded successfully from ${slotToLoad.identifier}`
        );
        setTimeout(() => this.hide(), 1500);
      } else {
        const errorMsg =
          result?.error || 'An unknown error occurred while loading the game.';
        this._displayStatusMessage(`Load failed: ${errorMsg}`, 'error');
        this.logger.error(
          `${this._logPrefix} Failed to load game from ${slotToLoad.identifier}: ${errorMsg}`
        );
        this._setOperationInProgress(false); // Only if load fails, re-enable UI
      }
    } catch (error) {
      const exceptionMsg =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `${this._logPrefix} Exception during load operation for ${slotToLoad.identifier}:`,
        error
      );
      this._displayStatusMessage(
        `Load failed: ${exceptionMsg || 'An unexpected error occurred.'}`,
        'error'
      );
      this._setOperationInProgress(false); // Re-enable UI on exception
    }
    // Note: _setOperationInProgress(false) is called in finally block by BaseModalRenderer if it's overridden to do so,
    // or explicitly here on failure paths. Success path leads to hide().
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
    const confirmMsg = `Are you sure you want to delete the save "${slotToDelete.saveName}"? This action cannot be undone.`;

    if (!window.confirm(confirmMsg)) {
      this.logger.debug(
        `${this._logPrefix} Delete operation cancelled by user for: ${slotToDelete.identifier}`
      );
      return;
    }

    this.logger.debug(
      `${this._logPrefix} User initiated delete for: ${slotToDelete.identifier} ("${slotToDelete.saveName}")`
    );
    this._setOperationInProgress(true);
    this._displayStatusMessage(
      `Deleting save "${slotToDelete.saveName}"...`,
      'info'
    );

    try {
      const result = await this.saveLoadService.deleteManualSave(
        slotToDelete.identifier
      );
      if (result && result.success) {
        this._displayStatusMessage(
          `Save "${slotToDelete.saveName}" deleted successfully.`,
          'success'
        );
        this.logger.debug(
          `${this._logPrefix} Save deleted successfully: ${slotToDelete.identifier}`
        );
        this.selectedSlotData = null;
        await this._populateLoadSlotsList(); // Refresh list

        // After refreshing, update state and focus
        this._setOperationInProgress(false);
        const firstSlot =
          this.elements.listContainerElement?.querySelector('.save-slot');
        if (firstSlot) {
          /** @type {HTMLElement} */ (firstSlot).focus();
          const firstSlotIdentifier = /** @type {HTMLElement} */ (firstSlot)
            .dataset.slotIdentifier;
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
        const errorMsg =
          result?.error || 'An unknown error occurred while deleting the save.';
        this._displayStatusMessage(`Delete failed: ${errorMsg}`, 'error');
        this.logger.error(
          `${this._logPrefix} Failed to delete save ${slotToDelete.identifier}: ${errorMsg}`
        );
        this._setOperationInProgress(false);
      }
    } catch (error) {
      const exceptionMsg =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `${this._logPrefix} Exception during delete operation for ${slotToDelete.identifier}:`,
        error
      );
      this._displayStatusMessage(
        `Delete failed: ${exceptionMsg || 'An unexpected error occurred.'}`,
        'error'
      );
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
