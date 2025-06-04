// src/domUI/llmSelectionModal.js
// --- FILE START ---

import { BaseModalRenderer } from './baseModalRenderer.js'; // MODIFIED: Import BaseModalRenderer

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

const LLM_SELECTION_MODAL_ELEMENTS_CONFIG = {
  modalElement: { selector: '#llm-selection-modal', required: true },
  closeButton: {
    selector: '#llm-selection-modal-close-button',
    required: true,
  }, // Used by BaseModalRenderer
  listContainerElement: { selector: '#llm-selection-list', required: true }, // For BaseListDisplayComponent pattern
  statusMessageElement: {
    selector: '#llm-selection-status-message',
    required: false,
  }, // For BaseModalRenderer status messages
};

/**
 * @class LlmSelectionModal
 * @augments BaseModalRenderer
 * @description Manages the LLM selection modal, including its visibility,
 * fetching LLM options, displaying them, and handling LLM selection by the user.
 * It extends BaseModalRenderer for modal behaviors and uses BaseListDisplayComponent
 * patterns for rendering the LLM list.
 */
export class LlmSelectionModal extends BaseModalRenderer {
  #llmAdapter;
  #domElementFactory; // Keep for direct use in _renderListItem
  #changeLlmButton = null; // External button, managed here for its event listener

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
    if (!domElementFactory)
      throw new Error(
        'LlmSelectionModal: DomElementFactory dependency is required.'
      );
    if (!llmAdapter)
      throw new Error('LlmSelectionModal: LLMAdapter dependency is required.');
    if (!validatedEventDispatcher)
      throw new Error(
        'LlmSelectionModal: ValidatedEventDispatcher dependency is required for BaseModalRenderer.'
      );

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: LLM_SELECTION_MODAL_ELEMENTS_CONFIG,
      domElementFactory, // Pass to BaseModalRenderer if it needs it, or store locally
    });

    this.#llmAdapter = llmAdapter;
    this.#domElementFactory = domElementFactory; // Store for list item rendering

    this.logger.info(`${this._logPrefix} Initializing...`);

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
    // Note: #bindDomElements and #attachEventListeners for modal's own elements are handled by BaseModalRenderer/BoundDomRendererBase

    this.logger.info(`${this._logPrefix} Initialized successfully.`);
  }

  /**
   * @protected
   * @override
   * @description Called by BaseModalRenderer when the modal is shown.
   * Fetches and renders the list of LLM options.
   */
  async _onShow() {
    this.logger.info(
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
   * Fetches LLM options and the currently active LLM ID from the adapter.
   *
   * @private
   * @async
   * @returns {Promise<LlmListData | null>} Object containing llmOptions and currentActiveLlmId, or null on error.
   */
  async _getListItemsData() {
    this.logger.debug(`${this._logPrefix} Fetching LLM list data...`);
    try {
      const llmOptions = await this.#llmAdapter.getAvailableLlmOptions();
      const currentActiveLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
      this.logger.debug(
        `${this._logPrefix} Fetched ${llmOptions.length} LLM options. Active ID: ${currentActiveLlmId}`
      );
      return { llmOptions, currentActiveLlmId };
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error fetching LLM data from adapter: ${error.message}`,
        { error }
      );
      return null; // Indicates an error in fetching data
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
  _renderListItem(optionData, itemIndex, allData) {
    const { configId, displayName } = optionData;
    const { currentActiveLlmId } = allData;

    if (!configId) {
      this.logger.warn(
        `${this._logPrefix} LLM option at index ${itemIndex} is missing configId. Skipping.`,
        { optionData }
      );
      return null;
    }

    const nameForDisplay = displayName || configId; // Fallback to configId if displayName is missing

    const listItemElement = this.#domElementFactory.create('li', {
      cls: 'llm-item',
      text: nameForDisplay,
    });

    if (!listItemElement) {
      this.logger.error(
        `${this._logPrefix} Failed to create <li> element for LLM option: ${nameForDisplay}`
      );
      return null;
    }

    listItemElement.dataset.llmId = configId;
    listItemElement.setAttribute('role', 'radio');
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
      return this.#domElementFactory.create('li', {
        text: errorMessage,
        cls: 'llm-item-message llm-error-message', // Standardized class names
      });
    }
    return this.#domElementFactory.create('li', {
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
    this.logger.info(
      `${this._logPrefix} LLM list populated with ${items.length} valid options. Active: ${listData?.currentActiveLlmId || 'none'}.`
    );
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
      // Display a status message if the container itself is missing, though BaseModalRenderer checks this on construction.
      this._displayStatusMessage(
        'Internal error: LLM list container missing.',
        'error'
      );
      return;
    }

    // Clear previous content and any managed DOM listeners associated with old items
    // BaseModalRenderer's dispose or a more granular cleanup might be needed if listeners accumulate across renders.
    // For now, assuming _addDomListener handles this gracefully or dispose is called appropriately.
    // If _renderListItem adds listeners, they should be managed. _addDomListener does this.
    listContainer.innerHTML = ''; // Simple clear, BaseModalRenderer should clean up listeners on 'li' if they were added with _addDomListener

    const listData = await this._getListItemsData();
    let errorOccurred = false;
    let errorMessage = '';

    if (!listData) {
      // Indicates error during data fetching
      errorOccurred = true;
      // The specific error message might have been logged in _getListItemsData.
      // A generic message is used here or could be passed from _getListItemsData.
      errorMessage =
        'Failed to load Language Model list. Please try again later.';
    }

    if (
      errorOccurred ||
      !listData.llmOptions ||
      listData.llmOptions.length === 0
    ) {
      this.logger.warn(
        `${this._logPrefix} LLM list is empty or failed to load. Displaying empty/error message.`
      );
      const emptyMessageElement = this._getEmptyListMessage(
        errorOccurred,
        errorMessage
      );
      if (emptyMessageElement) {
        listContainer.appendChild(emptyMessageElement);
      }
    } else {
      listData.llmOptions.forEach((option, index) => {
        const listItemElement = this._renderListItem(option, index, listData);
        if (listItemElement) {
          listContainer.appendChild(listItemElement);
        }
      });
    }
    this._onListRendered(listData, listContainer);
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

    this.logger.info(
      `${this._logPrefix} User selected LLM ID: ${selectedLlmId} ("${clickedItem.textContent?.trim()}").`
    );
    this._displayStatusMessage(
      `Switching to ${clickedItem.textContent?.trim()}...`,
      'info'
    );
    this._setOperationInProgress(true); // Disable buttons during operation

    // Optimistic visual update of the list
    if (this.elements.listContainerElement) {
      const items =
        this.elements.listContainerElement.querySelectorAll('li.llm-item');
      items.forEach((item) => {
        const htmlItem = /** @type {HTMLElement} */ (item);
        const isSelected = htmlItem.dataset.llmId === selectedLlmId;
        htmlItem.classList.toggle('selected', isSelected);
        htmlItem.setAttribute('aria-checked', String(isSelected));
        htmlItem.setAttribute('tabindex', isSelected ? '0' : '-1');
        if (isSelected) {
          htmlItem.focus(); // Ensure focus moves to the selected item
        }
      });
    }

    try {
      this.logger.debug(
        `${this._logPrefix} Attempting to call llmAdapter.setActiveLlm with ID: ${selectedLlmId}`
      );
      const success = await this.#llmAdapter.setActiveLlm(selectedLlmId);

      if (success) {
        this.logger.info(
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
    this.logger.info(`${this._logPrefix} LlmSelectionModal disposed.`);
  }
}

// --- FILE END ---
