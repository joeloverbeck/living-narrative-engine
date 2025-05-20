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
        this.openSaveGameButtonEl = /** @type {HTMLButtonElement | null} */ (this.documentContext.query('#open-save-game-button'));

        if (!this.saveGameScreenEl || !this.saveSlotsContainerEl || !this.saveNameInputEl ||
            !this.confirmSaveButtonEl || !this.cancelSaveButtonEl || !this.statusMessageAreaEl) {
            this.logger.error(`${this._logPrefix} One or more critical modal UI elements not found. Save Game UI may not function correctly.`);
        }
        if (!this.openSaveGameButtonEl) {
            this.logger.warn(`${this._logPrefix} #open-save-game-button not found. The UI cannot be opened via this button.`);
        }
    }

    init(gameEngineInstance) {
        if (!gameEngineInstance || typeof gameEngineInstance.triggerManualSave !== 'function') {
            this.logger.error(`${this._logPrefix} Invalid GameEngine instance provided during init. Save functionality will be broken.`);
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
        if (this.openSaveGameButtonEl) {
            this.openSaveGameButtonEl.addEventListener('click', () => this.show());
        }
        if (this.cancelSaveButtonEl) {
            this.cancelSaveButtonEl.addEventListener('click', () => this.hide());
        }
        if (this.saveGameScreenEl) {
            this.saveGameScreenEl.addEventListener('submit', (event) => event.preventDefault());
        }
        if (this.saveSlotsContainerEl) {
            this.saveSlotsContainerEl.addEventListener('keydown', this._handleSlotNavigation.bind(this));
        }
        if (this.saveNameInputEl) {
            this.saveNameInputEl.addEventListener('input', this._handleSaveNameInput.bind(this));
        }
        if (this.confirmSaveButtonEl) { // MODIFIED: Added listener for save button
            this.confirmSaveButtonEl.addEventListener('click', this._handleSave.bind(this));
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
        this._loadAndRenderSaveSlots();
        if (this.cancelSaveButtonEl) {
            this.cancelSaveButtonEl.focus();
        }
        this.logger.debug(`${this._logPrefix} UI shown.`);
    }

    hide() {
        if (this.isSavingInProgress) {
            this.logger.warn(`${this._logPrefix} Attempted to hide UI while save is in progress. Allowing hide.`);
            // Allow hiding even if saving, but ensure state is consistent.
            // Or, prevent hiding: return;
        }
        if (!this.saveGameScreenEl) return;
        this.saveGameScreenEl.style.display = 'none';
        this.saveGameScreenEl.setAttribute('aria-hidden', 'true');
        this._clearStatusMessage();
        this.logger.debug(`${this._logPrefix} UI hidden.`);
        if (this.openSaveGameButtonEl) {
            this.openSaveGameButtonEl.focus();
        }
    }

    /** @private */
    _clearStatusMessage() {
        if (this.statusMessageAreaEl) {
            this.statusMessageAreaEl.textContent = '';
            this.statusMessageAreaEl.className = 'status-message-area';
        }
    }

    /** @private */
    _updateUIAfterSaveAttempt(enable) {
        if (this.saveNameInputEl) this.saveNameInputEl.disabled = !enable;
        if (this.confirmSaveButtonEl) this.confirmSaveButtonEl.disabled = !enable;
        if (this.cancelSaveButtonEl) this.cancelSaveButtonEl.disabled = !enable;
        if (this.saveSlotsContainerEl) {
            this.saveSlotsContainerEl.querySelectorAll('.save-slot').forEach(slot => {
                if (enable) {
                    slot.classList.remove('disabled-interaction'); // Assuming a CSS class to visually disable slots
                } else {
                    slot.classList.add('disabled-interaction');
                }
            });
        }
        // Re-evaluate confirm button state if enabling
        if (enable) {
            this._handleSaveNameInput();
        }
    }

    /** @private */
    async _loadAndRenderSaveSlots() {
        // ... (previous implementation of _loadAndRenderSaveSlots - unchanged for this step)
        if (!this.saveSlotsContainerEl) {
            this.logger.error(`${this._logPrefix} Save slots container not found.`);
            return;
        }
        this.saveSlotsContainerEl.innerHTML = '';
        this._showLoadingState(true);

        try {
            // const actualSaves = await this.saveLoadService.listManualSaveSlots();
            /** @type {Array<SlotDisplayData>} */
            const mockProcessedSaves = [
                {
                    slotId: 0,
                    identifier: 'manual_saves/my_first_adventure.sav',
                    saveName: 'My First Adventure',
                    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
                    playtimeSeconds: 3600,
                    isEmpty: false,
                    isCorrupted: false
                },
                {slotId: 1, isEmpty: true, saveName: `Empty Slot 2`},
                {slotId: 2, isEmpty: true, saveName: `Empty Slot 3`},
                {
                    slotId: 3,
                    identifier: 'manual_saves/corrupted.sav',
                    saveName: 'Old Data (Corrupted)',
                    timestamp: 'N/A',
                    playtimeSeconds: 0,
                    isEmpty: false,
                    isCorrupted: true
                },
                {slotId: 4, isEmpty: true, saveName: `Empty Slot 5`},
            ];

            this.currentSlotsDisplayData = [];
            for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
                const existingSave = mockProcessedSaves.find(s => s.slotId === i);
                if (existingSave) {
                    this.currentSlotsDisplayData.push(existingSave);
                } else {
                    this.currentSlotsDisplayData.push({slotId: i, isEmpty: true, saveName: `Empty Slot ${i + 1}`});
                }
            }
            this.logger.debug(`${this._logPrefix} Processed save slots data:`, this.currentSlotsDisplayData);
            this._renderSaveSlotsDOM(this.currentSlotsDisplayData);

        } catch (error) {
            this.logger.error(`${this._logPrefix} Error loading save slots:`, error);
            this._displayStatusMessage('Error loading save slots.', 'error');
            if (this.domElementFactory && this.saveSlotsContainerEl) {
                const pError = this.domElementFactory.p('error-message', 'Could not load save slots.');
                if (pError) this.saveSlotsContainerEl.appendChild(pError);
            }
        } finally {
            this._showLoadingState(false);
        }
    }

    /** @private */
    _showLoadingState(isLoading) {
        // ... (previous implementation - unchanged)
        if (!this.saveSlotsContainerEl || !this.domElementFactory) return;
        const loadingMsgElement = this.saveSlotsContainerEl.querySelector('.loading-message');
        if (isLoading) {
            this._updateUIAfterSaveAttempt(false); // Disable UI during load
            if (!loadingMsgElement) {
                const pLoading = this.domElementFactory.p('loading-message', 'Loading save slots...');
                if (pLoading) this.saveSlotsContainerEl.appendChild(pLoading);
            }
        } else {
            this._updateUIAfterSaveAttempt(true); // Re-enable UI after load
            if (loadingMsgElement) loadingMsgElement.remove();
        }
    }

    /** @private */
    _displayStatusMessage(message, type = 'info') {
        // ... (previous implementation - unchanged)
        if (!this.statusMessageAreaEl) return;
        this.statusMessageAreaEl.textContent = message;
        this.statusMessageAreaEl.className = `status-message-area ${type}`;
    }

    /** @private */
    _formatPlaytime(totalSeconds) {
        // ... (previous implementation - unchanged)
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
            return 'N/A';
        }
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /** @private */
    _renderSaveSlotsDOM(slotsData) {
        // ... (previous implementation - unchanged)
        if (!this.saveSlotsContainerEl || !this.domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render save slots: container or factory missing.`);
            return;
        }
        this.saveSlotsContainerEl.innerHTML = '';

        if (!slotsData || slotsData.length === 0) {
            const pEmpty = this.domElementFactory.p('empty-slot-message', 'No save slots available.');
            if (pEmpty) this.saveSlotsContainerEl.appendChild(pEmpty);
            return;
        }

        slotsData.forEach((slotData, index) => {
            const slotDiv = this.domElementFactory.div(`save-slot ${slotData.isEmpty ? 'empty' : ''} ${slotData.isCorrupted ? 'corrupted' : ''}`);
            if (!slotDiv) return;

            slotDiv.setAttribute('role', 'radio');
            slotDiv.setAttribute('aria-checked', 'false');
            slotDiv.setAttribute('tabindex', index === 0 ? '0' : '-1');
            slotDiv.dataset.slotId = String(slotData.slotId);

            const slotInfoDiv = this.domElementFactory.div('slot-info');
            if (!slotInfoDiv) return;

            let nameText = slotData.saveName || `Slot ${slotData.slotId + 1}`;
            if (slotData.isEmpty) nameText = `Empty Slot ${slotData.slotId + 1}`;
            if (slotData.isCorrupted) nameText += ' (Corrupted)';

            const slotNameEl = this.domElementFactory.span('slot-name', nameText);

            let timestampText = '';
            if (!slotData.isEmpty && !slotData.isCorrupted && slotData.timestamp && slotData.timestamp !== 'N/A') {
                timestampText = new Date(slotData.timestamp).toLocaleString();
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
                slotDiv.appendChild(slotPlaytimeEl);
            }

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
        // ... (previous implementation - unchanged)
        if (!this.confirmSaveButtonEl || !this.saveNameInputEl) return;
        const nameIsValid = this.saveNameInputEl.value.trim().length > 0;
        this.confirmSaveButtonEl.disabled = !(this.selectedSlotData && nameIsValid && !this.isSavingInProgress);
    }

    /** @private */
    _handleSlotSelection(selectedSlotElement, slotData) {
        // ... (previous implementation - unchanged)
        this.logger.debug(`${this._logPrefix} Slot selected: ID ${slotData.slotId}`, slotData);
        this.selectedSlotData = slotData;

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
                    const now = new Date();
                    this.saveNameInputEl.value = `Save ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}`;
                }
            }
        }
        this._handleSaveNameInput();
        if (slotData.isCorrupted && this.confirmSaveButtonEl) {
            this.confirmSaveButtonEl.disabled = true;
        }
    }

    /** @private */
    _handleSlotNavigation(event) {
        // ... (previous implementation - unchanged)
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
            }
        }
    }

    /**
     * Handles the save game operation.
     * @private
     * @async
     */
    async _handleSave() {
        if (this.isSavingInProgress) {
            this.logger.warn(`${this._logPrefix} Save operation already in progress.`);
            return;
        }
        if (!this.selectedSlotData || !this.saveNameInputEl || !this.gameEngine) {
            this.logger.error(`${this._logPrefix} Cannot save: missing selected slot, name input, or game engine.`);
            this._displayStatusMessage('Cannot save: internal error.', 'error');
            return;
        }

        const currentSaveName = this.saveNameInputEl.value.trim();
        if (!currentSaveName) {
            this._displayStatusMessage('Please enter a name for your save.', 'error');
            this.saveNameInputEl.focus();
            return;
        }

        if (this.selectedSlotData.isCorrupted) {
            this._displayStatusMessage('Cannot save to a corrupted slot.', 'error');
            return;
        }

        // Overwrite confirmation
        if (!this.selectedSlotData.isEmpty) { // It's an existing, non-corrupted slot
            const originalSaveName = this.selectedSlotData.saveName || `Slot ${this.selectedSlotData.slotId + 1}`;
            // Use window.confirm for simplicity as per AC7
            const confirmOverwrite = window.confirm(
                `Are you sure you want to overwrite the existing save "${originalSaveName}" with "${currentSaveName}"?`
            );
            if (!confirmOverwrite) {
                this.logger.info(`${this._logPrefix} Save overwrite cancelled by user.`);
                return; // User cancelled overwrite
            }
        }

        this.isSavingInProgress = true;
        this._updateUIAfterSaveAttempt(false); // Disable UI elements
        this._displayStatusMessage(`Saving game as "${currentSaveName}"...`, 'info');

        try {
            // Note: GameEngine.triggerManualSave might need adjustment if it expects a slotId/identifier
            // For now, assuming it takes saveName and handles overwriting based on that name.
            // The refined ticket suggested `triggerManualSave(saveName, slotId)`.
            // We'll pass the saveName and the original identifier if it exists, or slotId as a fallback.
            // This part might require GameEngine method signature change.
            const slotIdentifier = this.selectedSlotData.identifier || `slot_${this.selectedSlotData.slotId}`;

            this.logger.info(`${this._logPrefix} Calling gameEngine.triggerManualSave with name: "${currentSaveName}", identifier: "${slotIdentifier}" (or slotId)`);

            // const result = await this.gameEngine.triggerManualSave(currentSaveName); // Original signature
            // Tentative call based on refined ticket's implication for triggerManualSave:
            const result = await this.gameEngine.triggerManualSave(currentSaveName, slotIdentifier);


            if (result && result.success) {
                this._displayStatusMessage(`Game saved as "${currentSaveName}".`, 'success');
                this.logger.info(`${this._logPrefix} Game saved successfully: ${result.message || currentSaveName}`);
                // Refresh slots to show new timestamp etc.
                await this._loadAndRenderSaveSlots();
                // Re-select the slot that was just saved, if possible (matching by name or new identifier)
                // This requires more complex logic to find the newly saved slot in `currentSlotsDisplayData`
                // For now, selection will be cleared.
                this.selectedSlotData = null;
                if (this.saveNameInputEl) this.saveNameInputEl.value = currentSaveName; // Keep the name
                // _handleSaveNameInput will disable save button as selectedSlotData is null

            } else {
                const errorMsg = result?.error || 'An unknown error occurred while saving.';
                this._displayStatusMessage(`Save failed: ${errorMsg}`, 'error');
                this.logger.error(`${this._logPrefix} Save failed: ${errorMsg}`);
            }
        } catch (error) {
            this.logger.error(`${this._logPrefix} Exception during save operation:`, error);
            this._displayStatusMessage(`Save failed: ${error.message || 'An unexpected error occurred.'}`, 'error');
        } finally {
            this.isSavingInProgress = false;
            this._updateUIAfterSaveAttempt(true); // Re-enable UI
            // _handleSaveNameInput is called within _updateUIAfterSaveAttempt if re-enabling
        }
    }


    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing...`);
        // Add specific listener removals if not handled by simple re-binding or if elements persist
        // For example, if openSaveGameButtonEl is outside this component's direct lifecycle:
        // if (this.openSaveGameButtonEl) {
        //    this.openSaveGameButtonEl.removeEventListener('click', this._boundShowFunction);
        // }
        // Event listeners on saveSlotsContainerEl, saveNameInputEl, confirmSaveButtonEl, cancelSaveButtonEl
        // are typically fine if these elements are recreated or hidden/shown, but explicit removal is safer if they persist.
        this.logger.info(`${this._logPrefix} Disposed.`);
    }
}

export default SaveGameUI;