// src/domUI/llmSelectionModal.js
// --- FILE START ---

import { SlotModalBase } from './slotModalBase.js';
import { createSelectableItem } from './helpers/createSelectableItem.js';
import { buildModalElementsConfig } from './helpers/buildModalElementsConfig.js';
import { setupRadioListNavigation } from '../utils/listNavigationUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('./domElementFactory.js').DomElementFactory} DomElementFactory
 * @typedef {import('../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */

/**
 * @typedef {object} LlmConfigOption
 * @property {string} configId - The unique identifier for the LLM configuration.
 * @property {string} displayName - The user-friendly display name for the LLM.
 */

/**
 * @typedef {object} LlmListData
 * @property {LlmConfigOption[]} llmOptions - Array of LLM configuration options.
 * @property {string | null} currentActiveLlmId - The ID of the currently active LLM.
 */

/**
 * @class LlmSelectionModal
 * @augments SlotModalBase
 * @description Manages the LLM selection modal, including its visibility,
 * fetching LLM options, displaying them, and handling LLM selection by the user.
 * It extends BaseModalRenderer for modal behaviors and uses BaseListDisplayComponent
 * patterns for rendering the LLM list.
 */
export class LlmSelectionModal extends SlotModalBase {
  #llmAdapter;
  #changeLlmButton = null; // External button, managed here for its event listener
  /** @type {string | null} */
  currentActiveLlmId = null;

  /**
   * Creates an instance of LlmSelectionModal.
   *
   * @param {object} dependencies - The dependencies for this class.
   * @param {ILogger} dependencies.logger - A logger instance.
   * @param {IDocumentContext} dependencies.documentContext - The document context service.
   * @param {DomElementFactory} dependencies.domElementFactory - The DOM element factory.
   * @param {ILLMAdapter} dependencies.llmAdapter - The LLM adapter instance.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The event dispatcher (for BaseModalRenderer).
   */
  constructor({
    logger,
    documentContext,
    domElementFactory,
    llmAdapter,
    validatedEventDispatcher,
  }) {
    if (!logger)
      throw new Error('LlmSelectionModal: Logger dependency is required.');
    if (!documentContext)
      throw new Error(
        'LlmSelectionModal: DocumentContext dependency is required.'
      );
    if (!llmAdapter)
      throw new Error('LlmSelectionModal: LLMAdapter dependency is required.');
    if (!validatedEventDispatcher)
      throw new Error(
        'LlmSelectionModal: ValidatedEventDispatcher dependency is required for BaseModalRenderer.'
      );

    const elementsConfig = buildModalElementsConfig({
      modalElement: '#llm-selection-modal',
      closeButton: '#llm-selection-modal-close-button',
      listContainerElement: '#llm-selection-list',
      statusMessageElement: '#llm-selection-status-message',
    });
    super({
      datasetKey: 'llmId',
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory,
    });

    this.#llmAdapter = llmAdapter;

    this.logger.debug(`${this._logPrefix} Initializing...`);

    // Bind external trigger button
    this.#changeLlmButton = this.documentContext.query('#change-llm-button');
    if (this.#changeLlmButton) {
      // Use _addDomListener from BaseModalRenderer (via BoundDomRendererBase) to manage this listener
      this._addDomListener(this.#changeLlmButton, 'click', () => this.show());
    } else {
      this.logger.error(
        `${this._logPrefix} Could not find #change-llm-button element. Modal cannot be opened by this button.`
      );
    }
    if (this.elements.listContainerElement) {
      this._addDomListener(
        this.elements.listContainerElement,
        'keydown',
        this._handleSlotNavigation.bind(this)
      );
    }
    // Note: #bindDomElements and #attachEventListeners for modal's own elements are handled by BaseModalRenderer/BoundDomRendererBase

    this.logger.debug(`${this._logPrefix} Initialized successfully.`);
  }

  /**
   * @protected
   * @override
   * @description Called by BaseModalRenderer when the modal is shown.
   * Fetches and renders the list of LLM options.
   */
  async _onShow() {
    this.logger.debug(
      `${this._logPrefix} _onShow hook called. Rendering LLM list.`
    );
    await this.renderLlmList();
  }

  /**
   * @protected
   * @override
   * @description Called by BaseModalRenderer when the modal is hidden.
   * Clears the LLM list to ensure fresh data on next show.
   */
  _onHide() {
    this.logger.debug(`${this._logPrefix} _onHide hook called.`);
    if (this.elements.listContainerElement) {
      this.elements.listContainerElement.innerHTML = ''; // Clear list on hide
    }
    // Additional cleanup specific to LlmSelectionModal can go here if needed.
    // Currently, status messages are cleared by BaseModalRenderer.show() -> _clearStatusMessage()
    // and focus is handled by BaseModalRenderer.
  }

  /**
   * @protected
   * @override
   * @description Determines the initial focus element when the modal is shown.
   * Tries to focus the selected LLM item, then the first LLM item, then the close button.
   * @returns {HTMLElement | null}
   */
  _getInitialFocusElement() {
    if (this.elements.listContainerElement) {
      const selectedItem = /** @type {HTMLElement | null} */ (
        this.elements.listContainerElement.querySelector(
          'li.llm-item.selected[tabindex="0"]'
        )
      );
      if (selectedItem) return selectedItem;

      const firstItem = /** @type {HTMLElement | null} */ (
        this.elements.listContainerElement.querySelector(
          'li.llm-item[tabindex="0"]'
        )
      );
      if (firstItem) return firstItem;
    }
    return /** @type {HTMLElement | null} */ (
      this.elements.closeButton || this.elements.modalElement
    );
  }

  // --- List Rendering (using BaseListDisplayComponent patterns) ---

  /**
   * Fetches LLM options and stores the currently active LLM ID.
   *
   * @private
   * @async
   * @returns {Promise<LlmConfigOption[]>} Array of LLM option objects.
   */
  async _getListItemsData() {
    this.logger.debug(`${this._logPrefix} Fetching LLM list data...`);
    try {
      const llmOptions = await this.#llmAdapter.getAvailableLlmOptions();
      this.currentActiveLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
      this.logger.debug(
        `${this._logPrefix} Fetched ${llmOptions.length} LLM options. Active ID: ${this.currentActiveLlmId}`
      );
      return llmOptions;
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error fetching LLM data from adapter: ${error.message}`,
        { error }
      );
      return [];
    }
  }

  /**
   * Renders a single LLM option as an <li> element.
   *
   * @private
   * @param {LlmConfigOption} optionData - The LLM option data.
   * @param {number} itemIndex - The index of the item.
   * @param {LlmListData} allData - All fetched list data, including currentActiveLlmId.
   * @returns {HTMLLIElement | null} The rendered <li> element or null if creation fails.
   */
  _renderListItem(optionData, itemIndex) {
    const { configId, displayName } = optionData;
    const currentActiveLlmId = this.currentActiveLlmId;

    if (!configId) {
      this.logger.warn(
        `${this._logPrefix} LLM option at index ${itemIndex} is missing configId. Skipping.`,
        { optionData }
      );
      return null;
    }

    const nameForDisplay = displayName || configId; // Fallback to configId if displayName is missing

    const listItemElement = createSelectableItem(
      this.domElementFactory,
      'li',
      'llmId',
      configId,
      nameForDisplay,
      false,
      false,
      'llm-item'
    );

    if (!listItemElement) {
      this.logger.error(
        `${this._logPrefix} Failed to create <li> element for LLM option: ${nameForDisplay}`
      );
      return null;
    }
    // Tabindex will be managed by _onListRendered

    const isActive = configId === currentActiveLlmId;
    listItemElement.setAttribute('aria-checked', isActive ? 'true' : 'false');
    if (isActive) {
      listItemElement.classList.add('selected');
    }

    // Use _addDomListener to manage event listeners for automatic cleanup by BaseModalRenderer
    this._addDomListener(listItemElement, 'click', (event) =>
      this.#handleLlmSelection(event)
    );

    return listItemElement;
  }

  /**
   * Gets the message or element to display when the LLM list is empty or fails to load.
   *
   * @private
   * @param {boolean} errorOccurred - Whether an error occurred while fetching list data.
   * @param {string} [errorMessage] - The error message if an error occurred.
   * @returns {string | HTMLElement} Message or element for empty/error state.
   */
  _getEmptyListMessage(
    errorOccurred = false,
    errorMessage = 'Error loading LLM list. Please try again later.'
  ) {
    if (errorOccurred) {
      return this.domElementFactory.create('li', {
        text: errorMessage,
        cls: 'llm-item-message llm-error-message', // Standardized class names
      });
    }
    return this.domElementFactory.create('li', {
      text: 'No Language Models are currently configured.',
      cls: 'llm-item-message llm-empty-message',
    });
  }

  /**
   * Called after the LLM list has been rendered. Manages tabindex for focus.
   *
   * @private
   * @param {LlmListData | null} listData - The data that was rendered.
   * @param {HTMLElement} container - The list container element.
   */
  _onListRendered(listData, container) {
    this.logger.debug(
      `${this._logPrefix} _onListRendered hook called for LLM list.`
    );
    const items = container.querySelectorAll('li.llm-item');
    let focused = false;

    items.forEach((item) => {
      if (item.classList.contains('selected')) {
        item.setAttribute('tabindex', '0');
        focused = true;
      } else {
        item.setAttribute('tabindex', '-1');
      }
    });

    if (!focused && items.length > 0) {
      items[0].setAttribute('tabindex', '0'); // Focus the first item if none selected
    }
    this.logger.debug(
      `${this._logPrefix} LLM list populated with ${items.length} valid options. Active: ${listData?.currentActiveLlmId || 'none'}.`
    );
  }

  /**
   * Keyboard navigation handler for the LLM list.
   *
   * @param {KeyboardEvent} event - Key event to process.
   * @private
   */
  _handleSlotNavigation(event) {
    if (!this.elements.listContainerElement) return;

    const arrowHandler = setupRadioListNavigation(
      this.elements.listContainerElement,
      'li.llm-item[role="radio"]',
      this._datasetKey,
      (el, value) => {
        const slotData = this.currentSlotsDisplayData.find(
          (s) => String(s[this._datasetKey]) === String(value)
        );
        if (slotData) this._onItemSelected(el, slotData);
      }
    );

    arrowHandler(event);

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = /** @type {HTMLElement} */ (event.target);
      const value = target.dataset[this._datasetKey];
      const slotData = this.currentSlotsDisplayData.find(
        (s) => String(s[this._datasetKey]) === String(value)
      );
      if (slotData) this._onItemSelected(target, slotData);
    }
  }

  /**
   * Orchestrates rendering the LLM list: fetches data, clears container,
   * renders items or empty message, and calls post-render hook.
   *
   * @private
   * @async
   */
  async renderLlmList() {
    this.logger.debug(`${this._logPrefix} renderLlmList() called.`);
    const listContainer = this.elements.listContainerElement;

    if (!listContainer) {
      this.logger.error(
        `${this._logPrefix} Cannot render LLM list: 'listContainerElement' is not available.`
      );
      this._displayStatusMessage(
        'Internal error: LLM list container missing.',
        'error'
      );
      return;
    }

    await this.populateSlotsList(
      () => this._getListItemsData(),
      (option, index) => this._renderListItem(option, index),
      () => this._getEmptyListMessage(),
      'Loading Language Models...'
    );

    if (this.currentSlotsDisplayData.length === 0) {
      this.logger.warn(
        `${this._logPrefix} LLM list is empty or failed to load. Displaying empty/error message.`
      );
    }

    this._onListRendered(
      {
        llmOptions: this.currentSlotsDisplayData,
        currentActiveLlmId: this.currentActiveLlmId,
      },
      listContainer
    );
  }

  /**
   * @private
   * @async
   * @param {Event} event - The click event from the LLM list item.
   * @description Handles the logic when an LLM is selected from the list.
   */
  async #handleLlmSelection(event) {
    const clickedItem = /** @type {HTMLElement} */ (event.currentTarget);
    const selectedLlmId = clickedItem.dataset.llmId;

    if (!selectedLlmId) {
      this.logger.error(
        `${this._logPrefix} #handleLlmSelection: llmId missing from clicked item.`,
        { target: clickedItem }
      );
      this._displayStatusMessage(
        'Internal error: LLM ID not found for selection.',
        'error'
      );
      return;
    }

    this.logger.debug(
      `${this._logPrefix} User selected LLM ID: ${selectedLlmId} ("${clickedItem.textContent?.trim()}").`
    );
    this._displayStatusMessage(
      `Switching to ${clickedItem.textContent?.trim()}...`,
      'debug'
    );

    const selectedData = this.currentSlotsDisplayData.find(
      (o) => String(o.configId) === String(selectedLlmId)
    ) || { configId: selectedLlmId };
    this._onItemSelected(clickedItem, selectedData);
    this._setOperationInProgress(true);

    try {
      this.logger.debug(
        `${this._logPrefix} Attempting to call llmAdapter.setActiveLlm with ID: ${selectedLlmId}`
      );
      const success = await this.#llmAdapter.setActiveLlm(selectedLlmId);

      if (success) {
        this.logger.debug(
          `${this._logPrefix} setActiveLlm successful for LLM ID: ${selectedLlmId}. Closing modal.`
        );
        // Success message is cleared on hide by BaseModalRenderer's show calling _clearStatusMessage
        this.hide(); // This will also call _onHide
      } else {
        const errorMsg = `Failed to switch to ${clickedItem.textContent?.trim()}. The LLM may be unavailable or the selection invalid.`;
        this.logger.error(
          `${this._logPrefix} llmAdapter.setActiveLlm returned false for LLM ID: ${selectedLlmId}.`
        );
        this._displayStatusMessage(errorMsg, 'error');
      }
    } catch (error) {
      const castError = /** @type {Error} */ (error);
      const errorMsg = `An error occurred while trying to switch to ${clickedItem.textContent?.trim()}: ${castError.message || 'Unknown error.'}`;
      this.logger.error(
        `${this._logPrefix} Exception during llmAdapter.setActiveLlm for ID: ${selectedLlmId}. Error: ${castError.message}`,
        { error: castError }
      );
      this._displayStatusMessage(errorMsg, 'error');
    } finally {
      this._setOperationInProgress(false); // Re-enable buttons
    }
  }

  /**
   * @public
   * @override
   * @description Overrides BaseModalRenderer.destroy to include cleanup of the external change LLM button listener
   * if it was managed by this class through _addDomListener.
   * BaseModalRenderer's super.dispose() will handle listeners added via _addDomListener.
   * If #changeLlmButton listener was added manually, it needs manual removal here.
   * However, since it's added with _addDomListener, super.dispose() should cover it.
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing LlmSelectionModal.`);
    // The listener on #changeLlmButton, if added via _addDomListener, will be cleaned up by super.dispose().
    // If this.#changeLlmButton had listeners added *not* through _addDomListener, they would need manual removal.
    super.dispose(); // Handles VED subscriptions, DOM listeners added via _addDomListener, and BoundDOMRenderer elements.
    this.logger.debug(`${this._logPrefix} LlmSelectionModal disposed.`);
  }
}

// --- FILE END ---
