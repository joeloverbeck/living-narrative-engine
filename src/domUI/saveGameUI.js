// src/domUI/saveGameUI.js

import { SlotModalBase } from './slotModalBase.js';
import { DomUtils } from '../utils/domUtils.js';
import { formatPlaytime, formatTimestamp } from '../utils/textUtils.js';
import { createSelectableItem } from './helpers/createSelectableItem.js';

/**
 * @typedef {import('../engine/gameEngine.js').default} GameEngine
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */

/**
 * @typedef {SaveFileMetadata & {slotId: number, isEmpty?: false}} FilledSlotData
 * @typedef {{slotId: number, isEmpty: true, saveName?: string, timestamp?: string, playtimeSeconds?: number, isCorrupted?: false}} EmptySlotData
 * @typedef {{slotId: number, isEmpty: false, saveName?: string, timestamp?: string, playtimeSeconds?: number, isCorrupted: true, identifier?: string}} CorruptedSlotData
 * @typedef {FilledSlotData | EmptySlotData | CorruptedSlotData} SlotDisplayData
 */

const MAX_SAVE_SLOTS = 10;

const SAVE_GAME_UI_ELEMENTS_CONFIG = {
  modalElement: { selector: '#save-game-screen', required: true },
  closeButton: { selector: '#cancel-save-button', required: true }, // Cancel button acts as close
  listContainerElement: { selector: '#save-slots-container', required: true },
  saveNameInputEl: {
    selector: '#save-name-input',
    required: true,
    expectedType: HTMLInputElement,
  },
  confirmSaveButtonEl: {
    selector: '#confirm-save-button',
    required: true,
    expectedType: HTMLButtonElement,
  },
  statusMessageElement: {
    selector: '#save-game-status-message',
    required: true,
  },
  // openSaveGameButtonEl is external and handled by main.js or equivalent
};

/**
 * @class SaveGameUI
 * @augments BaseModalRenderer
 * @description Manages the modal dialog for saving the game.
 */
export class SaveGameUI extends SlotModalBase {
  saveLoadService;
  gameEngine = null;
  domElementFactory; // Keep for direct use in _renderSaveSlotItem
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
      elementsConfig: SAVE_GAME_UI_ELEMENTS_CONFIG,
      domElementFactory,
      datasetKey: 'slotId',
      confirmButtonKey: 'confirmSaveButtonEl',
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
    this.domElementFactory = domElementFactory; // Already available via super, but can be aliased if preferred

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
    if (this.elements.confirmSaveButtonEl) {
      this._addDomListener(
        this.elements.confirmSaveButtonEl,
        'click',
        this._handleSave.bind(this)
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
    if (this.elements.saveNameInputEl) {
      this._addDomListener(
        this.elements.saveNameInputEl,
        'input',
        this._handleSaveNameInput.bind(this)
      );
    }
  }

  /**
   * Initializes the SaveGameUI with the GameEngine instance.
   *
   * @param {GameEngine} gameEngineInstance - The main game engine instance.
   */
  init(gameEngineInstance) {
    if (
      !gameEngineInstance ||
      typeof gameEngineInstance.triggerManualSave !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} Invalid GameEngine instance provided during init. Save functionality will be broken.`
      );
      return;
    }
    this.gameEngine = gameEngineInstance;
    this.logger.debug(`${this._logPrefix} GameEngine instance received.`);
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
    this.currentSlotsDisplayData = [];
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

      const actualSavesByIdentifier = new Map(
        actualSaves.map((s) => [s.identifier, s])
      );

      for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        // This logic assumes save slots are somewhat identified by an index or can be mapped.
        // For robust slot management, ISaveLoadService might need methods like `getSlot(slotId)`.
        // Here, we'll fill with actual saves first, then empty ones.
        // Sorting actualSaves by some criteria (e.g., timestamp or name) might be good
        // if their order from listManualSaveSlots isn't guaranteed or ideal.
        // For this refactor, we keep it simple: use them as they come, then fill empty.

        if (i < actualSaves.length) {
          const save = actualSaves[i]; // This assumes actualSaves are in a desired order for slots 1..N
          displaySlots.push({
            slotId: i, // Conceptual UI slot ID
            identifier: save.identifier,
            saveName: save.saveName,
            timestamp: save.timestamp,
            playtimeSeconds: save.playtimeSeconds,
            isCorrupted: save.isCorrupted || false,
            isEmpty: false,
          });
        } else {
          displaySlots.push({
            slotId: i,
            isEmpty: true,
            saveName: `Empty Slot ${i + 1}`,
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
    this.currentSlotsDisplayData = displaySlots.slice(0, MAX_SAVE_SLOTS);
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

    const slotDiv = createSelectableItem(
      this.domElementFactory,
      'div',
      'slotId',
      slotData.slotId,
      '',
      slotData.isEmpty,
      slotData.isCorrupted
    );
    if (!slotDiv) return null;
    slotDiv.setAttribute('tabindex', itemIndex === 0 ? '0' : '-1');

    const slotInfoDiv = this.domElementFactory.div('slot-info');
    if (!slotInfoDiv) return slotDiv; // Return partially constructed div

    let nameText = slotData.saveName || `Slot ${slotData.slotId + 1}`;
    if (slotData.isEmpty)
      nameText = slotData.saveName || `Empty Slot ${slotData.slotId + 1}`;
    if (slotData.isCorrupted)
      nameText =
        (slotData.saveName || `Slot ${slotData.slotId + 1}`) + ' (Corrupted)';

    const slotNameEl = this.domElementFactory.span('slot-name', nameText);
    slotInfoDiv.appendChild(slotNameEl);

    let timestampText = '';
    if (
      !slotData.isEmpty &&
      !slotData.isCorrupted &&
      slotData.timestamp &&
      slotData.timestamp !== 'N/A'
    ) {
      const formatted = formatTimestamp(slotData.timestamp);
      if (formatted === 'Invalid Date') {
        this.logger.warn(
          `${this._logPrefix} Invalid timestamp for slot ${slotData.slotId}: ${slotData.timestamp}`
        );
      }
      timestampText = `Saved: ${formatted}`;
    } else if (slotData.isCorrupted) {
      timestampText = 'Timestamp: N/A';
    }
    const slotTimestampEl = this.domElementFactory.span(
      'slot-timestamp',
      timestampText
    );
    slotInfoDiv.appendChild(slotTimestampEl);
    slotDiv.appendChild(slotInfoDiv);

    if (!slotData.isEmpty && !slotData.isCorrupted) {
      const playtimeText = `Playtime: ${formatPlaytime(slotData.playtimeSeconds || 0)}`;
      const slotPlaytimeEl = this.domElementFactory.span(
        'slot-playtime',
        playtimeText
      );
      if (slotPlaytimeEl) slotDiv.appendChild(slotPlaytimeEl);
    }

    // Use _addDomListener for managed event listener
    this._addDomListener(slotDiv, 'click', () => {
      // isSavingInProgress is checked by _setOperationInProgress which disables elements.
      // No need for direct check here if UI elements are correctly disabled.
      this._handleSlotSelection(slotDiv, slotData);
    });

    return slotDiv;
  }

  /**
   * Gets the message to display when the save slots list is empty.
   *
   * @private
   * @returns {string | HTMLElement}
   */
  _getEmptySaveSlotsMessage() {
    if (this.domElementFactory) {
      return this.domElementFactory.p(
        'empty-slot-message',
        'No save slots available to display.'
      );
    }
    return 'No save slots available to display.';
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

    await this.populateSlotsList(
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
   * @param selectedSlotElement
   * @param slotData
   * @private
   */
  _handleSlotSelection(selectedSlotElement, slotData) {
    this.logger.debug(
      `${this._logPrefix} Slot selected: ID ${slotData.slotId}`,
      slotData
    );
    super._handleSlotSelection(selectedSlotElement, slotData);

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
    if (
      !this.selectedSlotData ||
      !this.elements.saveNameInputEl ||
      !this.gameEngine
    ) {
      this.logger.error(
        `${this._logPrefix} Cannot save: missing selected slot, name input, or game engine.`
      );
      this._displayStatusMessage(
        'Cannot save: Internal error. Please select a slot and enter a name.',
        'error'
      );
      return;
    }

    const currentSaveName = this.elements.saveNameInputEl.value.trim();
    if (!currentSaveName) {
      this._displayStatusMessage('Please enter a name for your save.', 'error');
      this.elements.saveNameInputEl.focus();
      return;
    }

    if (this.selectedSlotData.isCorrupted) {
      this._displayStatusMessage(
        'Cannot save to a corrupted slot. Please choose another slot.',
        'error'
      );
      return;
    }

    if (!this.selectedSlotData.isEmpty) {
      const originalSaveName =
        this.selectedSlotData.saveName ||
        `Slot ${this.selectedSlotData.slotId + 1}`;
      if (
        !window.confirm(
          `Are you sure you want to overwrite the existing save "${originalSaveName}" with "${currentSaveName}"?`
        )
      ) {
        this.logger.debug(
          `${this._logPrefix} Save overwrite cancelled by user for slot ${this.selectedSlotData.slotId}.`
        );
        return;
      }
    }

    this._setOperationInProgress(true);
    this._displayStatusMessage(
      `Saving game as "${currentSaveName}"...`,
      'info'
    ); // Initial "Saving..." message

    let saveSucceeded = false; // Flag to track save status
    let finalMessage = '';
    let finalMessageType = 'info';

    try {
      this.logger.debug(
        `${this._logPrefix} Calling gameEngine.triggerManualSave with name: "${currentSaveName}". Selected slot conceptual ID: ${this.selectedSlotData.slotId}, actual identifier if exists: ${this.selectedSlotData.identifier}`
      );
      const result = await this.gameEngine.triggerManualSave(
        currentSaveName,
        this.selectedSlotData.identifier
      );

      if (result && result.success) {
        // Don't display final success message yet. It will be cleared by _populateSaveSlotsList.
        // Set flags to display it after list population.
        saveSucceeded = true;
        finalMessage = `Game saved as "${currentSaveName}".`;
        finalMessageType = 'success';
        this.logger.debug(
          `${this._logPrefix} Game saved successfully: ${result.message || `Saved as "${currentSaveName}"`}`
        );

        await this._populateSaveSlotsList(); // Refresh slots

        const returnedIdentifier = result.filePath;
        if (!returnedIdentifier) {
          this.logger.error(
            `${this._logPrefix} Save operation succeeded but did not return a valid filePath/identifier. Result object:`,
            result
          );
          // If this happens, re-selection will fail, but the save itself was "successful" at engine level.
          // Keep finalMessage as the game saved message, but re-selection might fail.
        }

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
            this._handleSlotSelection(slotElement, newlySavedSlotData);
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
      } else {
        // Save operation failed (result.success is false)
        finalMessage = `Save failed: ${result?.error || 'An unknown error occurred while saving.'}`;
        finalMessageType = 'error';
        this.logger.error(`${this._logPrefix} Save failed: ${finalMessage}`);
      }
    } catch (error) {
      // Exception during the save process
      const exceptionMsg =
        error instanceof Error ? error.message : String(error);
      finalMessage = `Save failed: ${exceptionMsg || 'An unexpected error occurred.'}`;
      finalMessageType = 'error';
      this.logger.error(
        `${this._logPrefix} Exception during save operation:`,
        error
      );
    } finally {
      this._setOperationInProgress(false);
      // Now display the final status message, after _populateSaveSlotsList might have cleared it
      if (finalMessage) {
        this._displayStatusMessage(finalMessage, finalMessageType);
      } else if (!saveSucceeded) {
        // If finalMessage is empty and save didn't succeed (e.g. unexpected path), ensure some error.
        this._displayStatusMessage(
          'An unspecified error occurred during the save operation.',
          'error'
        );
      }
      // If saveSucceeded and finalMessage is empty, it means success message was intended.
      // This state implies we want the "Loading..." from _populateSaveSlotsList to be cleared,
      // and the new state (selected slot, etc.) is the main feedback.
      // However, for a save action, there should always be a clear "saved" or "failed" message.
    }
  }

  /**
   * Dispose method. Calls super.dispose() for base class cleanup.
   *
   * @override
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing SaveGameUI.`);
    super.dispose(); // Handles VED subscriptions, DOM listeners, and BoundDOMRenderer elements.
    this.gameEngine = null;
    this.selectedSlotData = null;
    this.currentSlotsDisplayData = [];
    this.logger.debug(`${this._logPrefix} SaveGameUI disposed.`);
  }
}

export default SaveGameUI;
