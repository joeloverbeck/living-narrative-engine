// src/domUI/llmSelectionModal.js
// --- FILE START ---

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('./IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('./domElementFactory.js').DomElementFactory} DomElementFactory
 * @typedef {import('../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter
 */

/**
 * @class LlmSelectionModal
 * @description Manages the LLM selection modal, including its visibility,
 * fetching LLM options, displaying them, and handling LLM selection by the user.
 */
export class LlmSelectionModal {
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {IDocumentContext} */
    #documentContext;
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {ILLMAdapter} */
    #llmAdapter;

    /** @private @type {HTMLElement | null} */
    #changeLlmButton = null;
    /** @private @type {HTMLElement | null} */
    #modalElement = null;
    /** @private @type {HTMLElement | null} */
    #llmListElement = null;
    /** @private @type {HTMLElement | null} */
    #closeModalButton = null;
    /** @private @type {HTMLElement | null} */
    #llmStatusMessageElement = null; // For displaying errors or success messages related to selection

    /**
     * Creates an instance of LlmSelectionModal.
     * @param {object} dependencies - The dependencies for this class.
     * @param {ILogger} dependencies.logger - A logger instance.
     * @param {IDocumentContext} dependencies.documentContext - The document context service.
     * @param {DomElementFactory} dependencies.domElementFactory - The DOM element factory.
     * @param {ILLMAdapter} dependencies.llmAdapter - The LLM adapter instance.
     */
    constructor({logger, documentContext, domElementFactory, llmAdapter}) {
        if (!logger) throw new Error('LlmSelectionModal: Logger dependency is required.');
        if (!documentContext) throw new Error('LlmSelectionModal: DocumentContext dependency is required.');
        if (!domElementFactory) throw new Error('LlmSelectionModal: DomElementFactory dependency is required.');
        if (!llmAdapter) throw new Error('LlmSelectionModal: LLMAdapter dependency is required.');

        this.#logger = logger;
        this.#documentContext = documentContext;
        this.#domElementFactory = domElementFactory;
        this.#llmAdapter = llmAdapter;

        this.#logger.info('LlmSelectionModal: Initializing...');

        this.#bindDomElements();
        this.#attachEventListeners();

        this.#logger.info('LlmSelectionModal: Initialized successfully.');
    }

    /**
     * @private
     * @description Queries the DOM for required elements and stores references to them.
     */
    #bindDomElements() {
        this.#changeLlmButton = this.#documentContext.query('#change-llm-button');
        if (!this.#changeLlmButton) {
            this.#logger.error('LlmSelectionModal: Could not find #change-llm-button element.');
        }

        this.#modalElement = this.#documentContext.query('#llm-selection-modal');
        if (!this.#modalElement) {
            this.#logger.error('LlmSelectionModal: Could not find #llm-selection-modal element.');
        }

        this.#llmListElement = this.#documentContext.query('#llm-selection-list');
        if (!this.#llmListElement) {
            this.#logger.error('LlmSelectionModal: CRITICAL - #llm-selection-list element NOT FOUND. LLM list cannot be populated.');
        }

        this.#closeModalButton = this.#documentContext.query('#llm-selection-modal-close-button');
        if (!this.#closeModalButton) {
            this.#logger.error('LlmSelectionModal: Could not find #llm-selection-modal-close-button element.');
        }

        this.#llmStatusMessageElement = this.#documentContext.query('#llm-selection-status-message');
        if (!this.#llmStatusMessageElement) {
            this.#logger.warn('LlmSelectionModal: Could not find #llm-selection-status-message element. Status messages during LLM switch may not be displayed.');
        }
    }

    /**
     * @private
     * @description Attaches event listeners to the DOM elements.
     */
    #attachEventListeners() {
        if (this.#changeLlmButton) {
            this.#changeLlmButton.addEventListener('click', () => this.show());
        } else {
            this.#logger.warn('LlmSelectionModal: Cannot attach listener to #change-llm-button as it was not found.');
        }

        if (this.#closeModalButton) {
            this.#closeModalButton.addEventListener('click', () => this.hide());
        } else {
            this.#logger.warn('LlmSelectionModal: Cannot attach listener to #llm-selection-modal-close-button as it was not found.');
        }

        if (this.#modalElement) {
            this.#modalElement.addEventListener('click', (event) => {
                if (event.target === this.#modalElement) { // Click on overlay background
                    this.hide();
                }
            });
        }
    }

    /**
     * @private
     * @async
     * @param {Event} event - The click event from the LLM list item.
     * @description Handles the logic when an LLM is selected from the list.
     */
    async #handleLlmSelection(event) {
        const clickedItem = event.currentTarget; // currentTarget is the element the listener was attached to (the LI)
        const selectedLlmId = clickedItem.dataset.llmId;

        if (!selectedLlmId) {
            this.#logger.error('LlmSelectionModal: #handleLlmSelection called but llmId is missing from clicked item data.', {target: clickedItem});
            if (this.#llmStatusMessageElement) {
                this.#llmStatusMessageElement.textContent = 'Internal error: LLM ID not found for selection.';
                this.#llmStatusMessageElement.className = 'status-message-area llm-error-message';
            }
            return;
        }

        this.#logger.info(`LlmSelectionModal: User selected LLM ID: ${selectedLlmId} (${clickedItem.textContent}).`);

        // 1. Optimistic visual update of the list
        if (this.#llmListElement) {
            const items = this.#llmListElement.querySelectorAll('li.llm-item');
            items.forEach(item => {
                const isSelected = item === clickedItem;
                item.classList.toggle('selected', isSelected);
                item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                item.setAttribute('tabindex', isSelected ? '0' : '-1'); // Update tabindex for focus management
            });
        }

        // 2. Clear previous status messages specific to LLM switching
        if (this.#llmStatusMessageElement) {
            this.#llmStatusMessageElement.textContent = '';
            this.#llmStatusMessageElement.className = 'status-message-area'; // Reset classes
        }

        try {
            this.#logger.debug(`LlmSelectionModal: Attempting to call llmAdapter.setActiveLlm with ID: ${selectedLlmId}`);
            const success = await this.#llmAdapter.setActiveLlm(selectedLlmId);

            if (success) {
                this.#logger.info(`LlmSelectionModal: setActiveLlm successful for LLM ID: ${selectedLlmId}. Closing modal.`);
                // Optional: Provide brief success feedback before closing
                // if (this.#llmStatusMessageElement) {
                //     this.#llmStatusMessageElement.textContent = `Successfully switched to ${clickedItem.textContent}.`;
                //     this.#llmStatusMessageElement.classList.add('llm-success-message');
                // }
                // await new Promise(resolve => setTimeout(resolve, 750)); // Delay if showing message

                this.hide();
                // (Optional: Dispatch an event or call a callback for external UI feedback, e.g., update "Change LLM" button text)
                // Example:
                // const llmChangedEvent = new CustomEvent('llmChanged', {
                //     detail: { llmId: selectedLlmId, displayName: clickedItem.textContent },
                //     bubbles: true,
                //     composed: true
                // });
                // this.#documentContext.dispatchEvent(llmChangedEvent);
            } else {
                // setActiveLlm returned false (e.g., LLM ID not found by adapter, or validation failed)
                const errorMsg = `Failed to switch to ${clickedItem.textContent}. The LLM may be unavailable or the selection invalid.`;
                this.#logger.error(`LlmSelectionModal: llmAdapter.setActiveLlm returned false for LLM ID: ${selectedLlmId}.`);
                if (this.#llmStatusMessageElement) {
                    this.#llmStatusMessageElement.textContent = errorMsg;
                    this.#llmStatusMessageElement.classList.add('llm-error-message');
                }
                // Modal remains open, visual selection is kept to indicate user's last attempt.
            }
        } catch (error) {
            // Exception occurred during setActiveLlm
            const errorMsg = `An error occurred while trying to switch to ${clickedItem.textContent}: ${error.message || 'Unknown error.'}`;
            this.#logger.error(`LlmSelectionModal: Exception during llmAdapter.setActiveLlm for ID: ${selectedLlmId}. Error: ${error.message}`, {error});
            if (this.#llmStatusMessageElement) {
                this.#llmStatusMessageElement.textContent = errorMsg;
                this.#llmStatusMessageElement.classList.add('llm-error-message');
            }
            // Modal remains open, visual selection is kept.
        }
    }

    /**
     * @public
     * @async
     * @description Fetches LLM data, populates the list, and makes the LLM selection modal visible.
     */
    async show() {
        this.#logger.info('LlmSelectionModal: show() called.');

        if (!this.#modalElement) {
            this.#logger.error('LlmSelectionModal: Cannot show modal, #llm-selection-modal element not found.');
            return;
        }

        // Clear any previous status messages from LLM switching attempts
        if (this.#llmStatusMessageElement) {
            this.#llmStatusMessageElement.textContent = '';
            this.#llmStatusMessageElement.className = 'status-message-area';
        }

        if (!this.#llmListElement) {
            this.#logger.error('LlmSelectionModal: #llm-selection-list element not found. Cannot populate LLM list.');
            // Display error within the modal if possible, or fallback to console.
            // For now, error is logged. Modal will show empty or with static frame.
            this.#modalElement.style.display = 'flex'; // Show modal frame
            requestAnimationFrame(() => {
                if (this.#modalElement) this.#modalElement.classList.add('visible');
            });
            return;
        }

        this.#llmListElement.innerHTML = ''; // Clear previous items/messages from the list

        let llmOptions = [];
        let currentActiveLlmId = null;
        let errorOccurredLoadingList = false;
        let listLoadingErrorMessage = 'Error loading LLM list. Please try again later.';

        try {
            this.#logger.debug('LlmSelectionModal: Fetching available LLM options...');
            llmOptions = await this.#llmAdapter.getAvailableLlmOptions();
            this.#logger.debug(`LlmSelectionModal: Fetched ${llmOptions.length} LLM options.`);

            this.#logger.debug('LlmSelectionModal: Fetching current active LLM ID...');
            currentActiveLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
            this.#logger.debug(`LlmSelectionModal: Current active LLM ID: ${currentActiveLlmId}`);

        } catch (error) {
            const specificErrorMsg = error instanceof Error ? error.message : String(error);
            this.#logger.error(`LlmSelectionModal: Error fetching LLM data from adapter for list population: ${specificErrorMsg}`, {error});
            errorOccurredLoadingList = true;
            listLoadingErrorMessage = `Failed to load LLM list: ${specificErrorMsg}`;
        }

        if (errorOccurredLoadingList) {
            const errorItem = this.#domElementFactory.create('li', {
                textContent: listLoadingErrorMessage, // This uses textContent, if factory expects 'text', this might be an issue too
                // However, the main problem was with the LLM options list.
                // For consistency, if the factory strictly uses 'text', this should also be 'text'.
                // Let's assume 'text' is the convention for the factory's generic create method for now.
                // So, changing this one too for consistency with the primary fix.
                text: listLoadingErrorMessage,
                className: 'llm-item-message llm-error-message'
            });
            this.#llmListElement.appendChild(errorItem);
        } else if (llmOptions.length === 0) {
            this.#logger.warn('LlmSelectionModal: No LLM options available or list is empty.');
            const noOptionsItem = this.#domElementFactory.create('li', {
                // textContent: 'No Language Models are currently configured.', // Same as above
                text: 'No Language Models are currently configured.',
                className: 'llm-item-message llm-empty-message'
            });
            this.#llmListElement.appendChild(noOptionsItem);
        } else {
            let firstItemElement = null;
            let selectedItemElement = null;

            llmOptions.forEach((option, index) => {
                const {id, displayName} = option;
                const listItemElement = this.#domElementFactory.create('li', {
                    cls: 'llm-item',
                    text: displayName || id // CORRECTED: Was textContent, now text
                });

                listItemElement.dataset.llmId = id;
                listItemElement.setAttribute('role', 'radio');
                listItemElement.setAttribute('tabindex', '-1');

                const isActive = (id === currentActiveLlmId);
                listItemElement.setAttribute('aria-checked', isActive ? 'true' : 'false');

                if (isActive) {
                    listItemElement.classList.add('selected');
                    selectedItemElement = listItemElement;
                }

                // Attach click listener for selection logic
                listItemElement.addEventListener('click', (event) => this.#handleLlmSelection(event));

                this.#llmListElement.appendChild(listItemElement);

                if (index === 0) {
                    firstItemElement = listItemElement;
                }
            });

            // Set tabindex="0" for the currently selected item, or the first item if none are selected.
            // This makes the radiogroup navigable.
            if (selectedItemElement) {
                selectedItemElement.setAttribute('tabindex', '0');
            } else if (firstItemElement) {
                firstItemElement.setAttribute('tabindex', '0');
            }
            this.#logger.info(`LlmSelectionModal: LLM list populated with ${llmOptions.length} options. Current active: ${currentActiveLlmId || 'none'}.`);
        }

        // Make the modal visible
        this.#modalElement.style.display = 'flex';
        requestAnimationFrame(() => {
            if (this.#modalElement) {
                this.#modalElement.classList.add('visible');
                this.#logger.info('LlmSelectionModal: Modal display set to visible.');
                // Focus the first focusable element or the list itself for accessibility
                const focusTarget = this.#llmListElement.querySelector('li[tabindex="0"]') || this.#closeModalButton;
                if (focusTarget) {
                    focusTarget.focus();
                }
            }
        });
    }

    /**
     * @public
     * @description Hides the LLM selection modal.
     */
    hide() {
        if (this.#modalElement && this.#modalElement.classList.contains('visible')) {
            this.#modalElement.classList.remove('visible');
            // CSS should handle display:none based on .visible class removal
            this.#logger.info('LlmSelectionModal: Modal hidden.');

            // Clear any status messages when hiding
            if (this.#llmStatusMessageElement) {
                this.#llmStatusMessageElement.textContent = '';
                this.#llmStatusMessageElement.className = 'status-message-area';
            }

            // Return focus to the button that opened the modal, if available
            if (this.#changeLlmButton) {
                this.#changeLlmButton.focus();
            }
        } else if (this.#modalElement) {
            // Already hidden or not properly set up.
            this.#logger.debug('LlmSelectionModal: hide() called, but modal was not visible or not found.');
        } else {
            this.#logger.error('LlmSelectionModal: Cannot hide modal, #llm-selection-modal element not found.');
        }
    }
}

// --- FILE END ---