// src/domUI/saveGameUI.js

/**
 * @typedef {import('../core/gameEngine.js').default} GameEngine
 * @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../domUI/IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../domUI/domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata
 */

/**
 * @typedef {SaveFileMetadata & {slotId: number, isEmpty?: false}} FilledSlotData
 * @typedef {{slotId: number, isEmpty: true, saveName?: string, timestamp?: string, playtimeSeconds?: number, isCorrupted?: false}} EmptySlotData
 * @typedef {{slotId: number, isEmpty: false, saveName?: string, timestamp?: string, playtimeSeconds?: number, isCorrupted: true, identifier?: string}} CorruptedSlotData
 * @typedef {FilledSlotData | EmptySlotData | CorruptedSlotData} SlotDisplayData
 */


const MAX_SAVE_SLOTS = 10;

class SaveGameUI {
    /** @protected @readonly @type {string} */
    _logPrefix;

    /** @private @type {ILogger} */
    logger;
    /** @private @type {IDocumentContext} */
    documentContext;
    /** @private @type {DomElementFactory} */
    domElementFactory;
    /** @private @type {ISaveLoadService} */
    saveLoadService;
    /** @private @type {GameEngine | null} */
    gameEngine = null;

    /** @private @type {HTMLElement | null} */
    saveGameScreenEl = null;
    /** @private @type {HTMLElement | null} */
    saveSlotsContainerEl = null;
    /** @private @type {HTMLInputElement | null} */
    saveNameInputEl = null;
    /** @private @type {HTMLButtonElement | null} */
    confirmSaveButtonEl = null;
    /** @private @type {HTMLButtonElement | null} */
    cancelSaveButtonEl = null;
    /** @private @type {HTMLElement | null} */
    statusMessageAreaEl = null;
    /** @private @type {HTMLButtonElement | null} */
    openSaveGameButtonEl = null;

    /** @private @type {SlotDisplayData | null} */
    selectedSlotData = null;
    /** @private @type {Array<SlotDisplayData>} */
    currentSlotsDisplayData = [];
    /** @private @type {boolean} */
    isSavingInProgress = false;

    /**
     * @param {object} deps - Dependencies
     * @param {ILogger} deps.logger
     * @param {IDocumentContext} deps.documentContext
     * @param {DomElementFactory} deps.domElementFactory
     * @param {ISaveLoadService} deps.saveLoadService
     */
    constructor({logger, documentContext, domElementFactory, saveLoadService}) {
        this._logPrefix = `[${this.constructor.name}]`;

        if (!logger || typeof logger.debug !== 'function') {
            throw new Error(`${this._logPrefix} Logger dependency is missing or invalid.`);
        }
        if (!documentContext || typeof documentContext.query !== 'function') {
            throw new Error(`${this._logPrefix} DocumentContext dependency is missing or invalid.`);
        }
        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            throw new Error(`${this._logPrefix} DomElementFactory dependency is missing or invalid.`);
        }
        if (!saveLoadService || typeof saveLoadService.listManualSaveSlots !== 'function') {
            throw new Error(`${this._logPrefix} ISaveLoadService dependency is missing or invalid.`);
        }

        this.logger = logger;
        this.documentContext = documentContext;
        this.domElementFactory = domElementFactory;
        this.saveLoadService = saveLoadService;

        this._bindUiElements();
        this.logger.debug(`${this._logPrefix} Instance created.`);
    }

    _bindUiElements() {
        this.saveGameScreenEl = this.documentContext.query('#save-game-screen');
        this.saveSlotsContainerEl = this.documentContext.query('#save-slots-container');
        this.saveNameInputEl = /** @type {HTMLInputElement | null} */ (this.documentContext.query('#save-name-input'));
        this.confirmSaveButtonEl = /** @type {HTMLButtonElement | null} */ (this.documentContext.query('#confirm-save-button'));
        this.cancelSaveButtonEl = /** @type {HTMLButtonElement | null} */ (this.documentContext.query('#cancel-save-button'));
        this.statusMessageAreaEl = this.documentContext.query('#save-game-status-message');
        this.openSaveGameButtonEl = /** @type {HTMLButtonElement | null} */ (this.documentContext.query('#open-save-game-button')); // This button is external to the modal

        if (!this.saveGameScreenEl || !this.saveSlotsContainerEl || !this.saveNameInputEl ||
            !this.confirmSaveButtonEl || !this.cancelSaveButtonEl || !this.statusMessageAreaEl) {
            this.logger.error(`${this._logPrefix} One or more critical modal UI elements not found. Save Game UI may not function correctly.`);
        }
        // Note: openSaveGameButtonEl is not critical for the modal's internal function, but for its invocation.
    }

    /**
     * Initializes the SaveGameUI with the GameEngine instance and sets up event listeners.
     * @param {GameEngine} gameEngineInstance - The main game engine instance.
     */
    init(gameEngineInstance) {
        if (!gameEngineInstance || typeof gameEngineInstance.triggerManualSave !== 'function') {
            this.logger.error(`${this._logPrefix} Invalid GameEngine instance provided during init. Save functionality will be broken.`);
            // Do not set this.gameEngine if it's invalid to prevent further errors.
            return;
        }
        this.gameEngine = gameEngineInstance;

        if (!this.saveGameScreenEl) {
            this.logger.error(`${this._logPrefix} Cannot init: Core UI elements not bound.`);
            return;
        }
        this._initEventListeners();
        this.logger.info(`${this._logPrefix} Initialized and event listeners attached.`);
    }

    _initEventListeners() {
        // openSaveGameButtonEl listener will be attached in main.js as it's part of main DOM, not modal internal.
        if (this.cancelSaveButtonEl) {
            this.cancelSaveButtonEl.addEventListener('click', () => this.hide());
        }
        if (this.confirmSaveButtonEl) {
            this.confirmSaveButtonEl.addEventListener('click', this._handleSave.bind(this)); // Connect to _handleSave
        }
        if (this.saveGameScreenEl) {
            // Prevent form submission if it's part of a form
            this.saveGameScreenEl.addEventListener('submit', (event) => event.preventDefault());
        }
        if (this.saveSlotsContainerEl) {
            this.saveSlotsContainerEl.addEventListener('keydown', this._handleSlotNavigation.bind(this));
        }
        if (this.saveNameInputEl) {
            this.saveNameInputEl.addEventListener('input', this._handleSaveNameInput.bind(this));
        }
    }

    show() {
        if (this.isSavingInProgress) {
            this.logger.warn(`${this._logPrefix} Attempted to show UI while save is in progress.`);
            return;
        }
        if (!this.saveGameScreenEl || !this.saveNameInputEl || !this.confirmSaveButtonEl) {
            this.logger.error(`${this._logPrefix} Cannot show SaveGameUI: critical elements missing.`);
            return;
        }
        this.saveGameScreenEl.style.display = 'flex';
        this.saveGameScreenEl.setAttribute('aria-hidden', 'false');
        this.selectedSlotData = null;
        this.saveNameInputEl.value = '';
        this.saveNameInputEl.disabled = true;
        this.confirmSaveButtonEl.disabled = true;
        this._clearStatusMessage();
        this._loadAndRenderSaveSlots(); // This is async
        if (this.cancelSaveButtonEl) {
            this.cancelSaveButtonEl.focus();
        }
        this.logger.debug(`${this._logPrefix} UI shown.`);
    }

    hide() {
        if (this.isSavingInProgress) {
            this.logger.warn(`${this._logPrefix} Attempted to hide UI while save is in progress. Hiding is allowed.`);
        }
        if (!this.saveGameScreenEl) return;
        this.saveGameScreenEl.style.display = 'none';
        this.saveGameScreenEl.setAttribute('aria-hidden', 'true');
        this._clearStatusMessage();
        this.logger.debug(`${this._logPrefix} UI hidden.`);
        // Focus should be managed by the caller of hide(), e.g., back to the game menu button
    }

    /** @private */
    _clearStatusMessage() {
        if (this.statusMessageAreaEl) {
            this.statusMessageAreaEl.textContent = '';
            this.statusMessageAreaEl.className = 'status-message-area'; // Reset class
        }
    }

    /**
     * Updates the UI to reflect that an operation is in progress.
     * @private
     * @param {boolean} inProgress - True if an operation is in progress, false otherwise.
     */
    _updateUIAfterSaveAttempt(inProgress) {
        this.isSavingInProgress = inProgress;
        if (this.saveNameInputEl) this.saveNameInputEl.disabled = inProgress;
        if (this.confirmSaveButtonEl) this.confirmSaveButtonEl.disabled = inProgress || !this.selectedSlotData || !this.saveNameInputEl?.value.trim();
        if (this.cancelSaveButtonEl) this.cancelSaveButtonEl.disabled = inProgress;

        this.saveSlotsContainerEl?.querySelectorAll('.save-slot').forEach(slotElement => {
            if (inProgress) {
                slotElement.classList.add('disabled-interaction');
            } else {
                slotElement.classList.remove('disabled-interaction');
            }
        });

        // Re-evaluate confirm button state if operation finished
        if (!inProgress) {
            this._handleSaveNameInput();
        }
    }

    /** @private */
    async _loadAndRenderSaveSlots() {
        if (!this.saveSlotsContainerEl || !this.domElementFactory) {
            this.logger.error(`${this._logPrefix} Save slots container or DOM factory not found.`);
            return;
        }
        this.saveSlotsContainerEl.innerHTML = ''; // Clear previous slots
        this._showLoadingState(true);
        this.currentSlotsDisplayData = [];

        try {
            const actualSaves = await this.saveLoadService.listManualSaveSlots(); // [cite: 847]
            this.logger.debug(`${this._logPrefix} Fetched ${actualSaves.length} actual save slots.`);

            // Create a full list of display slots, merging actual saves with empty ones
            for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
                // Try to find an actual save that might correspond to this conceptual "slot index"
                // This part is tricky if identifiers are not slot-index based.
                // For simplicity, we'll assume listManualSaveSlots() returns all existing manual saves
                // and we display them, then fill up to MAX_SAVE_SLOTS with "empty" placeholders.
                // A more robust system would involve the service understanding "slots".
                // Current ISaveLoadService.listManualSaveSlots returns SaveFileMetadata, which has `identifier`.
                // We'll use `actualSaves` as the source of truth for filled slots, and then add empty ones.

                if (i < actualSaves.length) {
                    const save = actualSaves[i];
                    this.currentSlotsDisplayData.push({
                        slotId: i, // Conceptual slot ID for UI
                        identifier: save.identifier,
                        saveName: save.saveName,
                        timestamp: save.timestamp,
                        playtimeSeconds: save.playtimeSeconds,
                        isCorrupted: save.isCorrupted || false,
                        isEmpty: false
                    });
                } else {
                    this.currentSlotsDisplayData.push({
                        slotId: i, // Conceptual slot ID
                        isEmpty: true,
                        saveName: `Empty Slot ${i + 1}` // Placeholder for display
                    });
                }
            }
            // Ensure we don't exceed MAX_SAVE_SLOTS if actualSaves is somehow larger
            this.currentSlotsDisplayData = this.currentSlotsDisplayData.slice(0, MAX_SAVE_SLOTS);


            this.logger.debug(`${this._logPrefix} Processed save slots data for display:`, this.currentSlotsDisplayData);
            this._renderSaveSlotsDOM(this.currentSlotsDisplayData);

        } catch (error) {
            this.logger.error(`${this._logPrefix} Error loading save slots:`, error);
            this._displayStatusMessage('Error loading save slots information.', 'error');
            if (this.domElementFactory && this.saveSlotsContainerEl) {
                const pError = this.domElementFactory.p('error-message', 'Could not load save slots list.');
                if (pError) this.saveSlotsContainerEl.appendChild(pError);
            }
        } finally {
            this._showLoadingState(false);
        }
    }

    /** @private */
    _showLoadingState(isLoading) {
        if (!this.saveSlotsContainerEl || !this.domElementFactory) return;
        const loadingMsgId = 'save-slots-loading-message';
        let loadingMsgElement = this.documentContext.query(`#${loadingMsgId}`);

        if (isLoading) {
            this._updateUIAfterSaveAttempt(true); // Disable UI actions during load
            if (!loadingMsgElement) {
                loadingMsgElement = this.domElementFactory.p(undefined, 'Loading save slots...');
                if (loadingMsgElement) {
                    loadingMsgElement.id = loadingMsgId;
                    this.saveSlotsContainerEl.appendChild(loadingMsgElement);
                }
            }
        } else {
            this._updateUIAfterSaveAttempt(false); // Re-enable UI actions after load
            if (loadingMsgElement) {
                loadingMsgElement.remove();
            }
        }
    }

    /** @private */
    _displayStatusMessage(message, type = 'info') {
        if (!this.statusMessageAreaEl) return;
        this.statusMessageAreaEl.textContent = message;
        this.statusMessageAreaEl.className = `status-message-area ${type}`;
    }

    /** @private */
    _formatPlaytime(totalSeconds) {
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
            return 'N/A';
        }
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60); // Ensure integer seconds
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /** @private */
    _renderSaveSlotsDOM(slotsData) {
        if (!this.saveSlotsContainerEl || !this.domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render save slots: container or factory missing.`);
            return;
        }
        this.saveSlotsContainerEl.innerHTML = ''; // Clear previous content

        if (!slotsData || slotsData.length === 0) {
            const pEmpty = this.domElementFactory.p('empty-slot-message', 'No save slots available to display.');
            if (pEmpty) this.saveSlotsContainerEl.appendChild(pEmpty);
            return;
        }

        slotsData.forEach((slotData, index) => {
            const slotClasses = ['save-slot'];
            if (slotData.isEmpty) slotClasses.push('empty');
            if (slotData.isCorrupted) slotClasses.push('corrupted');

            const slotDiv = this.domElementFactory.div(slotClasses);
            if (!slotDiv) return;

            slotDiv.setAttribute('role', 'radio');
            slotDiv.setAttribute('aria-checked', 'false');
            slotDiv.setAttribute('tabindex', index === 0 ? '0' : '-1');
            slotDiv.dataset.slotId = String(slotData.slotId); // Use conceptual slotId for interaction tracking

            const slotInfoDiv = this.domElementFactory.div('slot-info');
            if (!slotInfoDiv) return;

            let nameText = slotData.saveName || `Slot ${slotData.slotId + 1}`; // Default name for empty/unnamed
            if (slotData.isEmpty) nameText = slotData.saveName || `Empty Slot ${slotData.slotId + 1}`; // Explicitly use placeholder for empty
            if (slotData.isCorrupted) nameText = (slotData.saveName || `Slot ${slotData.slotId + 1}`) + ' (Corrupted)';


            const slotNameEl = this.domElementFactory.span('slot-name', nameText);

            let timestampText = '';
            if (!slotData.isEmpty && !slotData.isCorrupted && slotData.timestamp && slotData.timestamp !== 'N/A') {
                try {
                    timestampText = `Saved: ${new Date(slotData.timestamp).toLocaleString()}`;
                } catch (e) {
                    this.logger.warn(`${this._logPrefix} Invalid timestamp for slot ${slotData.slotId}: ${slotData.timestamp}`);
                    timestampText = 'Saved: Invalid Date';
                }
            } else if (slotData.isCorrupted) {
                timestampText = 'Timestamp: N/A';
            }
            const slotTimestampEl = this.domElementFactory.span('slot-timestamp', timestampText);

            slotInfoDiv.appendChild(slotNameEl);
            slotInfoDiv.appendChild(slotTimestampEl);
            slotDiv.appendChild(slotInfoDiv);

            if (!slotData.isEmpty && !slotData.isCorrupted) {
                const playtimeText = `Playtime: ${this._formatPlaytime(slotData.playtimeSeconds || 0)}`;
                const slotPlaytimeEl = this.domElementFactory.span('slot-playtime', playtimeText);
                if (slotPlaytimeEl) slotDiv.appendChild(slotPlaytimeEl);
            }
            // No thumbnail as per user instruction

            slotDiv.addEventListener('click', () => {
                if (this.isSavingInProgress) return;
                this._handleSlotSelection(slotDiv, slotData);
            });
            this.saveSlotsContainerEl.appendChild(slotDiv);
        });
        this.logger.debug(`${this._logPrefix} Rendered ${slotsData.length} slot DOM elements.`);
    }

    /** @private */
    _handleSaveNameInput() {
        if (!this.confirmSaveButtonEl || !this.saveNameInputEl) return;
        const nameIsValid = this.saveNameInputEl.value.trim().length > 0;
        // Enable save if a slot is selected (even an empty one), name is valid, and not currently saving.
        // Corrupted slots cannot be saved over.
        const canSaveToSlot = this.selectedSlotData ? !this.selectedSlotData.isCorrupted : false;
        this.confirmSaveButtonEl.disabled = !(this.selectedSlotData && canSaveToSlot && nameIsValid && !this.isSavingInProgress);
    }


    /** @private */
    _handleSlotSelection(selectedSlotElement, slotData) {
        this.logger.debug(`${this._logPrefix} Slot selected: ID ${slotData.slotId}`, slotData);
        this.selectedSlotData = slotData;
        this._clearStatusMessage();

        const allSlotElements = this.saveSlotsContainerEl?.querySelectorAll('.save-slot');
        allSlotElements?.forEach(slotEl => {
            const isSelected = slotEl === selectedSlotElement;
            slotEl.classList.toggle('selected', isSelected);
            slotEl.setAttribute('aria-checked', String(isSelected));
            slotEl.setAttribute('tabindex', isSelected ? '0' : '-1');
        });

        if (selectedSlotElement && !(selectedSlotElement === this.documentContext.document?.activeElement)) {
            selectedSlotElement.focus();
        }

        if (this.saveNameInputEl) {
            if (slotData.isCorrupted) {
                this.saveNameInputEl.value = '';
                this.saveNameInputEl.disabled = true;
            } else {
                this.saveNameInputEl.disabled = false;
                if (!slotData.isEmpty && slotData.saveName) {
                    this.saveNameInputEl.value = slotData.saveName;
                } else {
                    // Pre-fill with a default name for empty slots or if existing name is blank
                    const now = new Date();
                    this.saveNameInputEl.value = `Save ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}`;
                }
            }
        }
        this._handleSaveNameInput(); // Update save button state
    }

    /** @private */
    _handleSlotNavigation(event) {
        if (this.isSavingInProgress) {
            event.preventDefault();
            return;
        }
        if (!this.saveSlotsContainerEl) return;
        const target = /** @type {HTMLElement} */ (event.target);

        if (!target.classList.contains('save-slot')) {
            return;
        }

        const slots = Array.from(this.saveSlotsContainerEl.querySelectorAll('.save-slot[role="radio"]'));
        if (slots.length === 0) return;

        let currentIndex = slots.findIndex(slot => slot === target);
        let nextIndex = -1;

        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                event.preventDefault();
                nextIndex = (currentIndex > 0) ? currentIndex - 1 : slots.length - 1;
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                event.preventDefault();
                nextIndex = (currentIndex < slots.length - 1) ? currentIndex + 1 : 0;
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
            case ' ':
                event.preventDefault();
                const slotId = parseInt(target.dataset.slotId || '-1', 10);
                const slotData = this.currentSlotsDisplayData.find(s => s.slotId === slotId);
                if (slotData) {
                    this._handleSlotSelection(target, slotData);
                }
                return;
            default:
                return;
        }

        if (nextIndex !== -1 && nextIndex !== currentIndex) {
            const nextSlot = /** @type {HTMLElement | undefined} */ (slots[nextIndex]);
            if (nextSlot) {
                target.setAttribute('tabindex', '-1');
                nextSlot.setAttribute('tabindex', '0');
                nextSlot.focus();
                // Optional: also select on focus change
                const nextSlotId = parseInt(nextSlot.dataset.slotId || '-1', 10);
                const nextSlotData = this.currentSlotsDisplayData.find(s => s.slotId === nextSlotId);
                if (nextSlotData) this._handleSlotSelection(nextSlot, nextSlotData);
            }
        }
    }

    /**
     * Handles the save game operation.
     * @private
     * @async
     */
    async _handleSave() { // [cite: 985]
        if (this.isSavingInProgress) {
            this.logger.warn(`${this._logPrefix} Save operation already in progress.`);
            return;
        }
        if (!this.selectedSlotData || !this.saveNameInputEl || !this.gameEngine) {
            this.logger.error(`${this._logPrefix} Cannot save: missing selected slot, name input, or game engine.`);
            this._displayStatusMessage('Cannot save: Internal error. Please select a slot and enter a name.', 'error');
            return;
        }

        const currentSaveName = this.saveNameInputEl.value.trim();
        if (!currentSaveName) {
            this._displayStatusMessage('Please enter a name for your save.', 'error');
            this.saveNameInputEl.focus();
            return;
        }

        if (this.selectedSlotData.isCorrupted) {
            this._displayStatusMessage('Cannot save to a corrupted slot. Please choose another slot.', 'error');
            return;
        }

        // Overwrite confirmation if the slot is not empty [cite: 969] (implicitly from SL-T3.1 AC)
        if (!this.selectedSlotData.isEmpty) {
            const originalSaveName = this.selectedSlotData.saveName || `Slot ${this.selectedSlotData.slotId + 1}`;
            const confirmOverwrite = window.confirm(
                `Are you sure you want to overwrite the existing save "${originalSaveName}" with "${currentSaveName}"?`
            );
            if (!confirmOverwrite) {
                this.logger.info(`${this._logPrefix} Save overwrite cancelled by user for slot ${this.selectedSlotData.slotId}.`);
                return;
            }
        }

        this._updateUIAfterSaveAttempt(true); // Disable UI elements, set isSavingInProgress = true
        this._displayStatusMessage(`Saving game as "${currentSaveName}"...`, 'info'); // [cite: 995]

        try {
            // GameEngine.triggerManualSave now expects only the saveName.
            // The concept of "slotId" or "identifier" for overwriting is handled by the fact
            // that saveManualGame in SaveLoadService will overwrite if a file with the derived name exists.
            this.logger.info(`${this._logPrefix} Calling gameEngine.triggerManualSave with name: "${currentSaveName}".`);
            const result = await this.gameEngine.triggerManualSave(currentSaveName);


            if (result && result.success) {
                this._displayStatusMessage(`Game saved as "${currentSaveName}".`, 'success'); // [cite: 997]
                this.logger.info(`${this._logPrefix} Game saved successfully: ${result.message || `Saved as "${currentSaveName}"`}`);
                // Refresh slots to show new timestamp etc.
                await this._loadAndRenderSaveSlots();
                // Try to re-select the slot that was just saved.
                // This is a bit complex as the identifier might have changed if it's based on saveName.
                // For now, we'll clear selection and input. A more advanced re-selection could be added.
                const newlySavedSlot = this.currentSlotsDisplayData.find(
                    s => s.saveName === currentSaveName && !s.isEmpty && !s.isCorrupted
                );
                if (newlySavedSlot && this.saveSlotsContainerEl) {
                    const slotElement = /** @type {HTMLElement | null} */ (this.saveSlotsContainerEl.querySelector(`.save-slot[data-slot-id="${newlySavedSlot.slotId}"]`));
                    if (slotElement) this._handleSlotSelection(slotElement, newlySavedSlot);
                } else {
                    this.selectedSlotData = null;
                    if (this.saveNameInputEl) this.saveNameInputEl.value = ''; // Clear input
                    this._handleSaveNameInput(); // Update button states
                }


            } else {
                const errorMsg = result?.error || 'An unknown error occurred while saving.';
                this._displayStatusMessage(`Save failed: ${errorMsg}`, 'error'); // [cite: 998]
                this.logger.error(`${this._logPrefix} Save failed: ${errorMsg}`);
            }
        } catch (error) {
            const exceptionMsg = (error instanceof Error) ? error.message : String(error);
            this.logger.error(`${this._logPrefix} Exception during save operation:`, error);
            this._displayStatusMessage(`Save failed: ${exceptionMsg || 'An unexpected error occurred.'}`, 'error'); // [cite: 998]
        } finally {
            this._updateUIAfterSaveAttempt(false); // Re-enable UI
        }
    }


    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing...`);
        // Event listeners on modal elements are typically fine if the modal is hidden/shown.
        // If the modal itself is removed from DOM, they are cleaned up.
        // The openSaveGameButtonEl listener is managed externally (in main.js).
        this.logger.info(`${this._logPrefix} Disposed.`);
    }
}

export default SaveGameUI;