// src/domUI/loadGameUI.js

/**
 * @typedef {import('../core/gameEngine.js').default} GameEngine
 * @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../domUI/IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../domUI/domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata
 * @typedef {import('../services/gamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult // Assuming this structure from gamePersistenceService for gameEngine.loadGame
 */

/**
 * Extends SaveFileMetadata for display purposes, including corruption status.
 * @typedef {SaveFileMetadata & { isCorrupted?: boolean }} LoadSlotDisplayData
 */

class LoadGameUI {
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
    loadGameScreenEl = null;
    /** @private @type {HTMLElement | null} */
    loadSlotsContainerEl = null;
    /** @private @type {HTMLButtonElement | null} */
    confirmLoadButtonEl = null;
    /** @private @type {HTMLButtonElement | null} */
    deleteSaveButtonEl = null;
    /** @private @type {HTMLButtonElement | null} */
    cancelLoadButtonEl = null;
    /** @private @type {HTMLElement | null} */
    statusMessageAreaEl = null;
    // openLoadGameButtonEl is external, will be handled in main.js

    /** @private @type {LoadSlotDisplayData | null} */
    selectedSlotData = null;
    /** @private @type {Array<LoadSlotDisplayData>} */
    currentSlotsDisplayData = [];
    /** @private @type {boolean} */
    isOperationInProgress = false;

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
        if (!saveLoadService || typeof saveLoadService.listManualSaveSlots !== 'function') { // Check for methods used by this UI
            throw new Error(`${this._logPrefix} ISaveLoadService dependency is missing or invalid (missing listManualSaveSlots or deleteManualSave).`);
        }

        this.logger = logger;
        this.documentContext = documentContext;
        this.domElementFactory = domElementFactory;
        this.saveLoadService = saveLoadService;

        this._bindUiElements();
        this.logger.debug(`${this._logPrefix} Instance created.`);
    }

    _bindUiElements() {
        this.loadGameScreenEl = this.documentContext.query('#load-game-screen');
        this.loadSlotsContainerEl = this.documentContext.query('#load-slots-container');
        this.confirmLoadButtonEl = /** @type {HTMLButtonElement | null} */ (this.documentContext.query('#confirm-load-button'));
        this.deleteSaveButtonEl = /** @type {HTMLButtonElement | null} */ (this.documentContext.query('#delete-save-button'));
        this.cancelLoadButtonEl = /** @type {HTMLButtonElement | null} */ (this.documentContext.query('#cancel-load-button'));
        this.statusMessageAreaEl = this.documentContext.query('#load-game-status-message');
        // this.openLoadGameButtonEl = this.documentContext.query('#open-load-game-button'); // This is external

        if (!this.loadGameScreenEl || !this.loadSlotsContainerEl || !this.confirmLoadButtonEl ||
            !this.deleteSaveButtonEl || !this.cancelLoadButtonEl || !this.statusMessageAreaEl) {
            this.logger.error(`${this._logPrefix} One or more critical modal UI elements not found. Load Game UI may not function correctly.`);
        }
    }

    /**
     * Initializes the LoadGameUI with the GameEngine instance and sets up event listeners.
     * @param {GameEngine} gameEngineInstance - The main game engine instance.
     */
    init(gameEngineInstance) {
        if (!gameEngineInstance || typeof gameEngineInstance.loadGame !== 'function') {
            this.logger.error(`${this._logPrefix} Invalid GameEngine instance provided during init. Load functionality will be broken.`);
            // Do not set this.gameEngine if it's invalid.
            return;
        }
        this.gameEngine = gameEngineInstance;

        if (!this.loadGameScreenEl) {
            this.logger.error(`${this._logPrefix} Cannot init: Core Load Game UI elements not bound.`);
            return;
        }
        this._initEventListeners();
        this.logger.info(`${this._logPrefix} Initialized and event listeners attached.`);
    }

    _initEventListeners() {
        // The openLoadGameButtonEl listener is attached in main.js
        if (this.cancelLoadButtonEl) {
            this.cancelLoadButtonEl.addEventListener('click', () => this.hide());
        }
        if (this.confirmLoadButtonEl) {
            this.confirmLoadButtonEl.addEventListener('click', this._handleLoad.bind(this)); //
        }
        if (this.deleteSaveButtonEl) {
            this.deleteSaveButtonEl.addEventListener('click', this._handleDelete.bind(this)); //
        }
        if (this.loadGameScreenEl) {
            this.loadGameScreenEl.addEventListener('submit', (event) => event.preventDefault());
        }
        if (this.loadSlotsContainerEl) {
            this.loadSlotsContainerEl.addEventListener('keydown', this._handleSlotNavigation.bind(this));
        }
    }

    show() {
        if (this.isOperationInProgress) {
            this.logger.warn(`${this._logPrefix} Attempted to show LoadGameUI while an operation is in progress.`);
            return;
        }
        if (!this.loadGameScreenEl || !this.confirmLoadButtonEl || !this.deleteSaveButtonEl) {
            this.logger.error(`${this._logPrefix} Cannot show LoadGameUI: critical elements missing.`);
            return;
        }
        this.loadGameScreenEl.style.display = 'flex';
        this.loadGameScreenEl.setAttribute('aria-hidden', 'false');
        this.selectedSlotData = null; //
        this.confirmLoadButtonEl.disabled = true; //
        this.deleteSaveButtonEl.disabled = true; //
        this._clearStatusMessage();
        this._loadAndRenderSaveSlots(); // This is async
        if (this.cancelLoadButtonEl) {
            this.cancelLoadButtonEl.focus();
        }
        this.logger.debug(`${this._logPrefix} LoadGameUI shown.`);
    }

    hide() {
        if (this.isOperationInProgress) {
            this.logger.warn(`${this._logPrefix} Attempted to hide UI while an operation is in progress. Hiding is allowed.`);
        }
        if (!this.loadGameScreenEl) return;
        this.loadGameScreenEl.style.display = 'none';
        this.loadGameScreenEl.setAttribute('aria-hidden', 'true');
        this._clearStatusMessage();
        this.logger.debug(`${this._logPrefix} LoadGameUI hidden.`);
        // Focus management should be handled by the caller, e.g., back to game menu button
    }

    /** @private */
    _clearStatusMessage() {
        if (this.statusMessageAreaEl) {
            this.statusMessageAreaEl.textContent = '';
            this.statusMessageAreaEl.className = 'status-message-area';
        }
    }

    /**
     * Updates the UI to reflect that an operation (load/delete) is in progress.
     * @private
     * @param {boolean} inProgress - True if an operation is in progress, false otherwise.
     */
    _updateUIForInProgress(inProgress) {
        this.isOperationInProgress = inProgress;
        // Disable/Enable buttons based on operation state AND selection state
        const slotSelected = !!this.selectedSlotData;
        const slotCanBeLoaded = slotSelected && !this.selectedSlotData?.isCorrupted;

        if (this.confirmLoadButtonEl) this.confirmLoadButtonEl.disabled = inProgress || !slotCanBeLoaded;
        if (this.deleteSaveButtonEl) this.deleteSaveButtonEl.disabled = inProgress || !slotSelected;
        if (this.cancelLoadButtonEl) this.cancelLoadButtonEl.disabled = inProgress;

        this.loadSlotsContainerEl?.querySelectorAll('.save-slot').forEach(slotElement => {
            if (inProgress) {
                slotElement.classList.add('disabled-interaction');
            } else {
                slotElement.classList.remove('disabled-interaction');
            }
        });
    }

    /** @private */
    async _loadAndRenderSaveSlots() {
        if (!this.loadSlotsContainerEl || !this.domElementFactory) {
            this.logger.error(`${this._logPrefix} Load slots container or DOM factory not found.`);
            return;
        }
        this.loadSlotsContainerEl.innerHTML = '';
        this._showLoadingMessage(true);
        this.currentSlotsDisplayData = []; // Reset internal tracking

        try {
            const manualSaves = await this.saveLoadService.listManualSaveSlots(); // [cite: 905]
            this.logger.debug(`${this._logPrefix} Fetched ${manualSaves.length} manual save slots.`);

            // As per SL-T3.2, this screen lists manual AND auto-save slots separately or with clear distinction.
            // However, current ISaveLoadService only has listManualSaveSlots.
            // For now, only manual saves will be listed. Auto-save listing would require ISaveLoadService extension.
            // The ticket SL-T3.2 Acceptance Criteria also states "thumbnail screenshot" - this is not part of SaveFileMetadata current structure.

            if (manualSaves.length === 0) {
                const pNoSaves = this.domElementFactory.p('empty-slot-message', 'No saved games found.');
                if (pNoSaves) this.loadSlotsContainerEl.appendChild(pNoSaves);
            } else {
                // Sort by timestamp descending (newest first) for better UX
                manualSaves.sort((a, b) => {
                    if (a.isCorrupted && !b.isCorrupted) return 1; // Corrupted at bottom
                    if (!a.isCorrupted && b.isCorrupted) return -1;
                    if (a.isCorrupted && b.isCorrupted) { // Sort corrupted by name/identifier if both corrupted
                        return (a.saveName || a.identifier).localeCompare(b.saveName || b.identifier);
                    }
                    // If both are not corrupted, sort by timestamp
                    try {
                        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                    } catch (e) {
                        return 0; // In case of invalid date strings in non-corrupted items
                    }
                });

                manualSaves.forEach((slotData, index) => {
                    this.currentSlotsDisplayData.push(slotData); // Add to internal tracking for selection
                    this._renderSingleSlotDOM(slotData, index);
                });
            }
        } catch (error) {
            this.logger.error(`${this._logPrefix} Error loading save slots:`, error);
            this._displayStatusMessage('Error loading list of saved games.', 'error');
            const pError = this.domElementFactory.p('error-message', 'Could not load saved games list.');
            if (pError) this.loadSlotsContainerEl.appendChild(pError);
        } finally {
            this._showLoadingMessage(false);
            // Ensure buttons are correctly disabled if no slots or no selection after load
            this._handleSlotSelection(null, null);
        }
    }

    /** @private */
    _displayStatusMessage(message, type = 'info') {
        if (!this.statusMessageAreaEl) return;
        this.statusMessageAreaEl.textContent = message;
        this.statusMessageAreaEl.className = `status-message-area ${type}`;
    }


    /** @private */
    _showLoadingMessage(isLoading) {
        if (!this.loadSlotsContainerEl || !this.domElementFactory) return;
        const loadingMsgId = 'load-slots-loading-message';
        let loadingMsgElement = this.documentContext.query(`#${loadingMsgId}`);

        if (isLoading) {
            this._updateUIForInProgress(true);
            if (!loadingMsgElement) {
                loadingMsgElement = this.domElementFactory.p(undefined, 'Loading saved games...');
                if (loadingMsgElement) {
                    loadingMsgElement.id = loadingMsgId;
                    this.loadSlotsContainerEl.appendChild(loadingMsgElement);
                }
            }
        } else {
            this._updateUIForInProgress(false);
            if (loadingMsgElement) {
                loadingMsgElement.remove();
            }
        }
    }


    /** @private */
    _formatPlaytime(totalSeconds) {
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
            return 'N/A';
        }
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Renders a single save slot in the DOM.
     * @private
     * @param {LoadSlotDisplayData} slotData - The metadata for the save slot.
     * @param {number} index - The index of the slot, used for tabIndex.
     */
    _renderSingleSlotDOM(slotData, index) {
        if (!this.loadSlotsContainerEl || !this.domElementFactory) return;

        const slotClasses = ['save-slot'];
        if (slotData.isCorrupted) slotClasses.push('corrupted');

        const slotDiv = this.domElementFactory.div(slotClasses);
        if (!slotDiv) return;

        slotDiv.setAttribute('role', 'radio');
        slotDiv.setAttribute('aria-checked', 'false');
        slotDiv.setAttribute('tabindex', index === 0 ? '0' : '-1');
        slotDiv.dataset.slotIdentifier = slotData.identifier; // Store unique identifier

        const slotInfoDiv = this.domElementFactory.div('slot-info');
        if (!slotInfoDiv) return;

        let nameText = slotData.saveName || 'Unnamed Save'; // Default if saveName is missing
        if (slotData.isCorrupted) nameText += ' (Corrupted)';
        const slotNameEl = this.domElementFactory.span('slot-name', nameText);

        let timestampText = 'Timestamp: N/A';
        if (!slotData.isCorrupted && slotData.timestamp && slotData.timestamp !== 'N/A') {
            try {
                timestampText = `Saved: ${new Date(slotData.timestamp).toLocaleString()}`; //
            } catch (e) {
                this.logger.warn(`${this._logPrefix} Invalid timestamp for slot ${slotData.identifier}: ${slotData.timestamp}`);
                timestampText = 'Saved: Invalid Date';
            }
        }
        const slotTimestampEl = this.domElementFactory.span('slot-timestamp', timestampText);

        slotInfoDiv.appendChild(slotNameEl);
        slotInfoDiv.appendChild(slotTimestampEl);
        slotDiv.appendChild(slotInfoDiv);

        if (!slotData.isCorrupted) {
            const playtimeText = `Playtime: ${this._formatPlaytime(slotData.playtimeSeconds)}`; //
            const slotPlaytimeEl = this.domElementFactory.span('slot-playtime', playtimeText);
            if (slotPlaytimeEl) slotDiv.appendChild(slotPlaytimeEl);
        }
        // Thumbnail requirement from SL-T3.2 is not implemented as SaveFileMetadata doesn't include it yet.

        slotDiv.addEventListener('click', () => {
            if (this.isOperationInProgress) return;
            this._handleSlotSelection(slotDiv, slotData);
        });
        this.loadSlotsContainerEl.appendChild(slotDiv);
    }

    /**
     * Handles the selection of a save slot.
     * @private
     * @param {HTMLElement | null} selectedSlotElement - The DOM element of the selected slot.
     * @param {LoadSlotDisplayData | null} slotData - The data associated with the selected slot.
     */
    _handleSlotSelection(selectedSlotElement, slotData) {
        this.selectedSlotData = slotData;
        this._clearStatusMessage();

        this.loadSlotsContainerEl?.querySelectorAll('.save-slot').forEach(slotEl => {
            const isSelected = slotEl === selectedSlotElement;
            slotEl.classList.toggle('selected', isSelected);
            slotEl.setAttribute('aria-checked', String(isSelected));
            slotEl.setAttribute('tabindex', isSelected ? '0' : (this.loadSlotsContainerEl?.querySelector('.save-slot.selected') ? '-1' : '0')); // Ensure one is always focusable
        });

        if (selectedSlotElement && !(selectedSlotElement === this.documentContext.document?.activeElement)) {
            selectedSlotElement.focus();
        }


        const canLoad = !!(slotData && !slotData.isCorrupted);
        const canDelete = !!(slotData); // Allow deleting corrupted saves for cleanup

        if (this.confirmLoadButtonEl) this.confirmLoadButtonEl.disabled = !canLoad || this.isOperationInProgress;
        if (this.deleteSaveButtonEl) this.deleteSaveButtonEl.disabled = !canDelete || this.isOperationInProgress; //

        if (slotData) {
            this.logger.debug(`${this._logPrefix} Slot selected: ID ${slotData.identifier}`, slotData);
        } else {
            this.logger.debug(`${this._logPrefix} Slot selection cleared.`);
        }
    }

    /**
     * Handles keyboard navigation within the save slot list.
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
     */
    _handleSlotNavigation(event) {
        if (this.isOperationInProgress) {
            event.preventDefault();
            return;
        }
        if (!this.loadSlotsContainerEl) return;
        const target = /** @type {HTMLElement} */ (event.target);

        if (!target.classList.contains('save-slot')) {
            return;
        }

        const slots = Array.from(this.loadSlotsContainerEl.querySelectorAll('.save-slot[role="radio"]'));
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
                const slotIdentifier = target.dataset.slotIdentifier;
                const currentSlotData = this.currentSlotsDisplayData.find(s => s.identifier === slotIdentifier);
                if (currentSlotData) {
                    this._handleSlotSelection(target, currentSlotData);
                }
                // If it's Enter, and a loadable slot is selected, maybe trigger load?
                // For now, selection is enough. User then clicks "Load".
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
                // Also select the slot on navigation for clearer UX
                const nextSlotIdentifier = nextSlot.dataset.slotIdentifier;
                const nextSlotData = this.currentSlotsDisplayData.find(s => s.identifier === nextSlotIdentifier);
                if (nextSlotData) this._handleSlotSelection(nextSlot, nextSlotData);
            }
        }
    }

    /**
     * Handles the "Load" button click.
     * @private
     * @async
     */
    async _handleLoad() { //
        if (this.isOperationInProgress || !this.selectedSlotData || this.selectedSlotData.isCorrupted) {
            this.logger.warn(`${this._logPrefix} Load attempt ignored: operation in progress, no slot selected, or slot corrupted.`);
            if (this.selectedSlotData?.isCorrupted) {
                this._displayStatusMessage('Cannot load a corrupted save file. Please delete it or choose another.', 'error');
            } else if (!this.selectedSlotData) {
                this._displayStatusMessage('Please select a save slot to load.', 'error');
            }
            return;
        }
        if (!this.gameEngine) {
            this.logger.error(`${this._logPrefix} GameEngine not available. Cannot load game.`);
            this._displayStatusMessage('Cannot load: Game engine is not ready.', 'error');
            return;
        }

        const slotToLoad = this.selectedSlotData;
        this.logger.info(`${this._logPrefix} User initiated load for: ${slotToLoad.identifier} ("${slotToLoad.saveName}")`);
        this._updateUIForInProgress(true);
        this._displayStatusMessage(`Loading game "${slotToLoad.saveName}"...`, 'info'); // [cite: 996]

        try {
            const result = await this.gameEngine.loadGame(slotToLoad.identifier); // [cite: 986]
            if (result && result.success) {
                this._displayStatusMessage(`Game "${slotToLoad.saveName}" loaded successfully. Resuming...`, 'success'); // [cite: 997]
                this.logger.info(`${this._logPrefix} Game loaded successfully from ${slotToLoad.identifier}`);
                // GameEngine's loadGame should handle actual game state transition.
                // The UI should hide itself after a short delay to show the success message.
                setTimeout(() => this.hide(), 1500); // Hide UI on successful load
            } else {
                const errorMsg = result?.error || 'An unknown error occurred while loading the game.';
                this._displayStatusMessage(`Load failed: ${errorMsg}`, 'error'); // [cite: 998]
                this.logger.error(`${this._logPrefix} Failed to load game from ${slotToLoad.identifier}: ${errorMsg}`);
            }
        } catch (error) {
            const exceptionMsg = (error instanceof Error) ? error.message : String(error);
            this.logger.error(`${this._logPrefix} Exception during load operation for ${slotToLoad.identifier}:`, error);
            this._displayStatusMessage(`Load failed: ${exceptionMsg || 'An unexpected error occurred.'}`, 'error'); // [cite: 998]
        } finally {
            this._updateUIForInProgress(false);
        }
    }

    /**
     * Handles the "Delete" button click.
     * @private
     * @async
     */
    async _handleDelete() { //
        if (this.isOperationInProgress || !this.selectedSlotData) {
            this.logger.warn(`${this._logPrefix} Delete attempt ignored: operation in progress or no slot selected.`);
            if (!this.selectedSlotData) {
                this._displayStatusMessage('Please select a save slot to delete.', 'error');
            }
            return;
        }

        const slotToDelete = this.selectedSlotData;
        const confirmMsg = `Are you sure you want to delete the save "${slotToDelete.saveName}"? This action cannot be undone.`;

        // Using window.confirm as per SL-T3.2 AC "option to "Delete" manual save slots (with confirmation)"
        // In a real game, a custom modal confirmation would be better.
        if (!window.confirm(confirmMsg)) {
            this.logger.info(`${this._logPrefix} Delete operation cancelled by user for: ${slotToDelete.identifier}`);
            return;
        }

        this.logger.info(`${this._logPrefix} User initiated delete for: ${slotToDelete.identifier} ("${slotToDelete.saveName}")`);
        this._updateUIForInProgress(true);
        this._displayStatusMessage(`Deleting save "${slotToDelete.saveName}"...`, 'info');

        try {
            const result = await this.saveLoadService.deleteManualSave(slotToDelete.identifier); // [cite: 987]
            if (result && result.success) {
                this._displayStatusMessage(`Save "${slotToDelete.saveName}" deleted successfully.`, 'success'); // [cite: 997]
                this.logger.info(`${this._logPrefix} Save deleted successfully: ${slotToDelete.identifier}`);
                this.selectedSlotData = null; // Clear selection
                // Buttons will be updated by _loadAndRenderSaveSlots -> _handleSlotSelection(null,null)
                await this._loadAndRenderSaveSlots(); // Refresh the list
            } else {
                const errorMsg = result?.error || 'An unknown error occurred while deleting the save.';
                this._displayStatusMessage(`Delete failed: ${errorMsg}`, 'error'); // [cite: 998]
                this.logger.error(`${this._logPrefix} Failed to delete save ${slotToDelete.identifier}: ${errorMsg}`);
            }
        } catch (error) {
            const exceptionMsg = (error instanceof Error) ? error.message : String(error);
            this.logger.error(`${this._logPrefix} Exception during delete operation for ${slotToDelete.identifier}:`, error);
            this._displayStatusMessage(`Delete failed: ${exceptionMsg || 'An unexpected error occurred.'}`, 'error'); // [cite: 998]
        } finally {
            this._updateUIForInProgress(false);
            // If a slot was focused, try to maintain focus or focus the container after list re-render
            const firstSlot = this.loadSlotsContainerEl?.querySelector('.save-slot');
            if (firstSlot) {
                (/** @type {HTMLElement} */ (firstSlot)).focus();
                const firstSlotIdentifier = (/** @type {HTMLElement} */ (firstSlot)).dataset.slotIdentifier;
                const firstSlotData = this.currentSlotsDisplayData.find(s => s.identifier === firstSlotIdentifier);
                if (firstSlotData) this._handleSlotSelection(/** @type {HTMLElement} */ (firstSlot), firstSlotData); else this._handleSlotSelection(null, null);

            } else {
                this._handleSlotSelection(null, null); // Ensure buttons are correctly disabled if list is now empty
            }
        }
    }

    /**
     * Cleans up event listeners.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing...`);
        // Listeners on modal elements are handled if modal is removed from DOM or re-created.
        // External button listeners (openLoadGameButtonEl) are managed in main.js.
        this.logger.info(`${this._logPrefix} Disposed.`);
    }
}

export default LoadGameUI;