// src/domUI/loadGameUI.js

import { BaseModalRenderer } from './baseModalRenderer.js';
import { DomUtils } from '../utils/domUtils.js';
import { FormatUtils } from '../utils/formatUtils.js';

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

const LOAD_GAME_UI_ELEMENTS_CONFIG = {
  modalElement: { selector: '#load-game-screen', required: true },
  closeButton: { selector: '#cancel-load-button', required: true },
  listContainerElement: { selector: '#load-slots-container', required: true },
  confirmLoadButtonEl: {
    selector: '#confirm-load-button',
    required: true,
    expectedType: HTMLButtonElement,
  },
  deleteSaveButtonEl: {
    selector: '#delete-save-button',
    required: true,
    expectedType: HTMLButtonElement,
  },
  statusMessageElement: {
    selector: '#load-game-status-message',
    required: true,
  },
};

/**
 * @class LoadGameUI
 * @augments BaseModalRenderer
 * @description Manages the modal dialog for loading saved games.
 */
class LoadGameUI extends BaseModalRenderer {
  saveLoadService;
  gameEngine = null;
  domElementFactory; // Kept for direct use in _renderLoadSlotItem

  selectedSlotData = null;
  currentSlotsDisplayData = [];

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
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: LOAD_GAME_UI_ELEMENTS_CONFIG,
      domElementFactory, // Pass to BaseModalRenderer if it needs it, or store locally
    });

    if (!domElementFactory || typeof domElementFactory.create !== 'function') {
      throw new Error(
        `${this._logPrefix} DomElementFactory dependency is missing or invalid.`
      );
    }
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
    this.domElementFactory = domElementFactory; // Already available via super if passed, but can be aliased.

    // _bindUiElements is handled by BoundDomRendererBase (via BaseModalRenderer)

    this.logger.debug(
      `${this._logPrefix} Instance created and extends BaseModalRenderer.`
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
    this.logger.info(
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
    if (this.elements.listContainerElement) {
      this._addDomListener(
        this.elements.listContainerElement,
        'keydown',
        this._handleSlotNavigation.bind(this)
      );
    }
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
      displaySlots = manualSaves; // Already LoadSlotDisplayData compatible due to SaveFileMetadata structure
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

    const slotClasses = ['save-slot'];
    if (slotData.isCorrupted) slotClasses.push('corrupted');

    const slotDiv = this.domElementFactory.div(slotClasses);
    if (!slotDiv) return null;

    slotDiv.setAttribute('role', 'radio');
    slotDiv.setAttribute('aria-checked', 'false');
    slotDiv.setAttribute('tabindex', itemIndex === 0 ? '0' : '-1');
    slotDiv.dataset.slotIdentifier = slotData.identifier;

    const slotInfoDiv = this.domElementFactory.div('slot-info');
    if (!slotInfoDiv) return slotDiv;

    let nameText = slotData.saveName || 'Unnamed Save';
    if (slotData.isCorrupted) nameText += ' (Corrupted)';
    const slotNameEl = this.domElementFactory.span('slot-name', nameText);

    let timestampText = 'Timestamp: N/A';
    if (
      !slotData.isCorrupted &&
      slotData.timestamp &&
      slotData.timestamp !== 'N/A'
    ) {
      try {
        timestampText = `Saved: ${new Date(slotData.timestamp).toLocaleString()}`;
      } catch {
        this.logger.warn(
          `${this._logPrefix} Invalid timestamp for slot ${slotData.identifier}: ${slotData.timestamp}`
        );
        timestampText = 'Saved: Invalid Date';
      }
    }
    const slotTimestampEl = this.domElementFactory.span(
      'slot-timestamp',
      timestampText
    );

    slotInfoDiv.appendChild(slotNameEl);
    slotInfoDiv.appendChild(slotTimestampEl);
    slotDiv.appendChild(slotInfoDiv);

    if (!slotData.isCorrupted) {
      const playtimeText = `Playtime: ${FormatUtils.formatPlaytime(slotData.playtimeSeconds)}`;
      const slotPlaytimeEl = this.domElementFactory.span(
        'slot-playtime',
        playtimeText
      );
      if (slotPlaytimeEl) slotDiv.appendChild(slotPlaytimeEl);
    }

    this._addDomListener(slotDiv, 'click', () => {
      // isOperationInProgress is handled by _setOperationInProgress disabling elements
      this._handleSlotSelection(slotDiv, slotData);
    });

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
      return (
        this.domElementFactory.p('empty-slot-message', message) ||
        this.documentContext.document.createTextNode(message)
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
    const listContainer = this.elements.listContainerElement;
    if (!listContainer) {
      this.logger.error(
        `${this._logPrefix} List container element not found in this.elements.`
      );
      this._displayStatusMessage(
        'Error: UI component for slots missing.',
        'error'
      );
      return;
    }

    this._setOperationInProgress(true); // Disables interactions, shows "Loading..."
    this._displayStatusMessage('Loading saved games...', 'info');

    DomUtils.clearElement(listContainer);
    this.currentSlotsDisplayData = [];

    const slotsData = await this._getLoadSlotsData();

    if (slotsData.length === 0) {
      const emptyMessageElement = this._getEmptyLoadSlotsMessage();
      listContainer.appendChild(
        emptyMessageElement instanceof HTMLElement
          ? emptyMessageElement
          : this.documentContext.document.createTextNode(
              String(emptyMessageElement)
            )
      );
    } else {
      slotsData.forEach((slotData, index) => {
        const listItemElement = this._renderLoadSlotItem(slotData, index);
        if (listItemElement) {
          listContainer.appendChild(listItemElement);
        }
      });
    }

    this._clearStatusMessage(); // Clear "Loading saved games..."
    this._setOperationInProgress(false); // Re-enable interactions

    this._handleSlotSelection(null, null); // Update button states
    this.logger.debug(`${this._logPrefix} Load slots list populated.`);
  }

  /**
   * Handles UI updates when a save slot is selected or deselected.
   *
   * @param {HTMLElement | null} selectedSlotElement - The clicked slot element.
   * @param {LoadSlotDisplayData | null} slotData - Associated slot information.
   * @private
   */
  _handleSlotSelection(selectedSlotElement, slotData) {
    this.selectedSlotData = slotData;
    // _clearStatusMessage() // Called by _onShow usually, or when an operation message is shown

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
      !(selectedSlotElement === this.documentContext.document?.activeElement)
    ) {
      selectedSlotElement.focus();
    } else if (!selectedSlotElement && this.elements.listContainerElement) {
      // If selection cleared, ensure first is focusable
      const firstSlot =
        this.elements.listContainerElement.querySelector('.save-slot');
      if (firstSlot) firstSlot.setAttribute('tabindex', '0');
    }

    const canLoad = !!(slotData && !slotData.isCorrupted);
    const canDelete = !!slotData; // Allow deleting corrupted saves

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
    // BaseModalRenderer._setOperationInProgress handles disabling during operations
  }

  /**
   * Keyboard navigation handler for the save slot list.
   *
   * @param {KeyboardEvent} event - The key event.
   * @private
   */
  _handleSlotNavigation(event) {
    // Check if operation in progress from BaseModalRenderer's state if needed,
    // but usually _setOperationInProgress disables the whole modal or relevant parts.
    if (!this.elements.listContainerElement) return;
    const target = /** @type {HTMLElement} */ (event.target);

    if (
      !target.classList.contains('save-slot') ||
      target.closest('.disabled-interaction')
    ) {
      return;
    }

    const slots = Array.from(
      this.elements.listContainerElement.querySelectorAll(
        '.save-slot[role="radio"]'
      )
    );
    if (slots.length === 0) return;

    let currentIndex = slots.findIndex((slot) => slot === target);
    let nextIndex = -1;

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : slots.length - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        nextIndex = currentIndex < slots.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = slots.length - 1;
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const slotIdentifier = target.dataset.slotIdentifier;
        const currentSlotData = this.currentSlotsDisplayData.find(
          (s) => s.identifier === slotIdentifier
        );
        if (currentSlotData) {
          this._handleSlotSelection(target, currentSlotData);
        }
        return;
      }
      default:
        return;
    }

    if (nextIndex !== -1 && nextIndex !== currentIndex) {
      const nextSlot = /** @type {HTMLElement | undefined} */ (
        slots[nextIndex]
      );
      if (nextSlot) {
        // Tabindex is managed by _handleSlotSelection
        nextSlot.focus(); // Focus should trigger click, which calls _handleSlotSelection
        const nextSlotIdentifier = nextSlot.dataset.slotIdentifier;
        const nextSlotData = this.currentSlotsDisplayData.find(
          (s) => s.identifier === nextSlotIdentifier
        );
        if (nextSlotData) this._handleSlotSelection(nextSlot, nextSlotData);
      }
    }
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
    this.logger.info(
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
        this.logger.info(
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
      this.logger.info(
        `${this._logPrefix} Delete operation cancelled by user for: ${slotToDelete.identifier}`
      );
      return;
    }

    this.logger.info(
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
        this.logger.info(
          `${this._logPrefix} Save deleted successfully: ${slotToDelete.identifier}`
        );
        this.selectedSlotData = null;
        await this._populateLoadSlotsList(); // Refresh list
      } else {
        const errorMsg =
          result?.error || 'An unknown error occurred while deleting the save.';
        this._displayStatusMessage(`Delete failed: ${errorMsg}`, 'error');
        this.logger.error(
          `${this._logPrefix} Failed to delete save ${slotToDelete.identifier}: ${errorMsg}`
        );
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
    } finally {
      this._setOperationInProgress(false);
      // Re-focus or update button states as necessary after list re-render
      const firstSlot =
        this.elements.listContainerElement?.querySelector('.save-slot');
      if (firstSlot) {
        /** @type {HTMLElement} */ (firstSlot).focus();
        const firstSlotIdentifier = /** @type {HTMLElement} */ (firstSlot)
          .dataset.slotIdentifier;
        const firstSlotData = this.currentSlotsDisplayData.find(
          (s) => s.identifier === firstSlotIdentifier
        );
        if (firstSlotData)
          this._handleSlotSelection(
            /** @type {HTMLElement} */ (firstSlot),
            firstSlotData
          );
        else this._handleSlotSelection(null, null);
      } else {
        this._handleSlotSelection(null, null);
      }
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
    this.logger.info(`${this._logPrefix} LoadGameUI disposed.`);
  }
}

export default LoadGameUI;
