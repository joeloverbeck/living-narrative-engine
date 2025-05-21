// src/domUI/engineUIManager.js

import {
    ENGINE_INITIALIZING_UI,
    ENGINE_READY_UI,
    ENGINE_OPERATION_IN_PROGRESS_UI,
    ENGINE_OPERATION_FAILED_UI,
    ENGINE_STOPPED_UI,
    ENGINE_MESSAGE_DISPLAY_REQUESTED,
    REQUEST_SHOW_SAVE_GAME_UI,
    REQUEST_SHOW_LOAD_GAME_UI,
    CANNOT_SAVE_GAME_INFO
} from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../domUI/domUiFacade.js').DomUiFacade} DomUiFacade
 * @typedef {import('../interfaces/IEvent.js').IEvent} IEvent
 */

/**
 * @class EngineUIManager
 * @description Manages UI updates based on events dispatched by the GameEngine.
 * It acts as an intermediary between game state events and direct UI manipulations
 * performed via the DomUiFacade.
 */
export class EngineUIManager {
    /**
     * @private
     * @type {ISafeEventDispatcher}
     */
    #eventDispatcher;

    /**
     * @private
     * @type {DomUiFacade}
     */
    #domUiFacade;

    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of EngineUIManager.
     * @param {object} dependencies - The dependencies for the service.
     * @param {ISafeEventDispatcher} dependencies.eventDispatcher - The event dispatcher for subscribing to game events.
     * @param {DomUiFacade} dependencies.domUiFacade - The facade for interacting with DOM UI components.
     * @param {ILogger} dependencies.logger - The logger service.
     */
    constructor({eventDispatcher, domUiFacade, logger}) {
        if (!eventDispatcher) {
            throw new Error('EngineUIManager: ISafeEventDispatcher dependency is required.');
        }
        if (!domUiFacade) {
            throw new Error('EngineUIManager: DomUiFacade dependency is required.');
        }
        if (!logger) {
            throw new Error('EngineUIManager: ILogger dependency is required.');
        }

        this.#eventDispatcher = eventDispatcher;
        this.#domUiFacade = domUiFacade;
        this.#logger = logger;

        this.#logger.info('EngineUIManager: Service instantiated.');
    }

    /**
     * Initializes the EngineUIManager by setting up event subscriptions.
     * This method should be called once the service is created and its dependencies are resolved.
     * @returns {void}
     */
    initialize() {
        this.#logger.info('EngineUIManager: Initializing...');
        this.#subscribeToEvents();
        this.#logger.info('EngineUIManager: Initialization complete. Event subscriptions active.');
    }

    /**
     * @private
     * Subscribes to various UI-related events dispatched by the GameEngine.
     * Each event is bound to a specific handler method within this class.
     * @returns {void}
     */
    #subscribeToEvents() {
        this.#eventDispatcher.subscribe(ENGINE_INITIALIZING_UI, this.#handleEngineInitializingUI.bind(this));
        this.#eventDispatcher.subscribe(ENGINE_READY_UI, this.#handleEngineReadyUI.bind(this));
        this.#eventDispatcher.subscribe(ENGINE_OPERATION_IN_PROGRESS_UI, this.#handleEngineOperationInProgressUI.bind(this));
        this.#eventDispatcher.subscribe(ENGINE_OPERATION_FAILED_UI, this.#handleEngineOperationFailedUI.bind(this));
        this.#eventDispatcher.subscribe(ENGINE_STOPPED_UI, this.#handleEngineStoppedUI.bind(this));
        this.#eventDispatcher.subscribe(ENGINE_MESSAGE_DISPLAY_REQUESTED, this.#handleEngineMessageDisplayRequested.bind(this));
        this.#eventDispatcher.subscribe(REQUEST_SHOW_SAVE_GAME_UI, this.#handleRequestShowSaveGameUI.bind(this));
        this.#eventDispatcher.subscribe(REQUEST_SHOW_LOAD_GAME_UI, this.#handleRequestShowLoadGameUI.bind(this));
        this.#eventDispatcher.subscribe(CANNOT_SAVE_GAME_INFO, this.#handleCannotSaveGameInfo.bind(this));

        this.#logger.debug('EngineUIManager: Subscribed to all designated UI events.');
    }

    /**
     * @private
     * Handles the ENGINE_INITIALIZING_UI event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object containing payload: { worldName: string }.
     */
    #handleEngineInitializingUI(event) {
        this.#logger.debug(`EngineUIManager: Received ${ENGINE_INITIALIZING_UI}`, event.payload);
        // GE-REFAC-008: Implement UI update logic (e.g., this.#domUiFacade.title.set(`Initializing ${event.payload.worldName}...`))
    }

    /**
     * @private
     * Handles the ENGINE_READY_UI event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object containing payload: { activeWorld: string | null, message: string }.
     */
    #handleEngineReadyUI(event) {
        this.#logger.debug(`EngineUIManager: Received ${ENGINE_READY_UI}`, event.payload);
        // GE-REFAC-008: Implement UI update logic (e.g., this.#domUiFacade.title.set(event.payload.activeWorld || "Game Ready"))
    }

    /**
     * @private
     * Handles the ENGINE_OPERATION_IN_PROGRESS_UI event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object containing payload: { titleMessage: string, inputDisabledMessage: string }.
     */
    #handleEngineOperationInProgressUI(event) {
        this.#logger.debug(`EngineUIManager: Received ${ENGINE_OPERATION_IN_PROGRESS_UI}`, event.payload);
        // GE-REFAC-008: Implement UI update logic
    }

    /**
     * @private
     * Handles the ENGINE_OPERATION_FAILED_UI event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object containing payload: { errorMessage: string, errorTitle: string }.
     */
    #handleEngineOperationFailedUI(event) {
        this.#logger.debug(`EngineUIManager: Received ${ENGINE_OPERATION_FAILED_UI}`, event.payload);
        // GE-REFAC-008: Implement UI update logic
    }

    /**
     * @private
     * Handles the ENGINE_STOPPED_UI event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object containing payload: { inputDisabledMessage: string }.
     */
    #handleEngineStoppedUI(event) {
        this.#logger.debug(`EngineUIManager: Received ${ENGINE_STOPPED_UI}`, event.payload);
        // GE-REFAC-008: Implement UI update logic
    }

    /**
     * @private
     * Handles the ENGINE_MESSAGE_DISPLAY_REQUESTED event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object containing payload: { message: string, type: 'info' | 'error' | 'fatal' | 'warning' }.
     */
    #handleEngineMessageDisplayRequested(event) {
        this.#logger.debug(`EngineUIManager: Received ${ENGINE_MESSAGE_DISPLAY_REQUESTED}`, event.payload);
        // GE-REFAC-008: Implement UI update logic (e.g., this.#domUiFacade.messages.render(event.payload.message, event.payload.type))
    }

    /**
     * @private
     * Handles the REQUEST_SHOW_SAVE_GAME_UI event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object (payload is empty: {}).
     */
    #handleRequestShowSaveGameUI(event) {
        this.#logger.debug(`EngineUIManager: Received ${REQUEST_SHOW_SAVE_GAME_UI}`, event.payload);
        // GE-REFAC-008: Implement UI update logic (e.g., this.#domUiFacade.saveGame.show())
    }

    /**
     * @private
     * Handles the REQUEST_SHOW_LOAD_GAME_UI event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object (payload is empty: {}).
     */
    #handleRequestShowLoadGameUI(event) {
        this.#logger.debug(`EngineUIManager: Received ${REQUEST_SHOW_LOAD_GAME_UI}`, event.payload);
        // GE-REFAC-008: Implement UI update logic (e.g., this.#domUiFacade.loadGame.show())
    }

    /**
     * @private
     * Handles the CANNOT_SAVE_GAME_INFO event.
     * Placeholder for logic to be implemented in GE-REFAC-008.
     * @param {IEvent} event - The event object (payload is empty: {}).
     */
    #handleCannotSaveGameInfo(event) {
        this.#logger.debug(`EngineUIManager: Received ${CANNOT_SAVE_GAME_INFO}`, event.payload);
        // GE-REFAC-008: Implement UI update logic (e.g., this.#domUiFacade.messages.render("Cannot save at this moment.", 'warning'))
    }

    /**
     * Disposes of the EngineUIManager, primarily for cleaning up event subscriptions if necessary.
     * Currently, ISafeEventDispatcher handles unsubscription if the listener itself is destroyed or deregistered.
     * This method is provided for completeness and future use if manual unsubscription becomes necessary.
     * @returns {void}
     */
    dispose() {
        this.#logger.info('EngineUIManager: Disposing. (No explicit unsubscriptions needed with current ISafeEventDispatcher behavior).');
        // If ISafeEventDispatcher required manual unsubscription, it would happen here:
        // Example:
        // this.#eventDispatcher.unsubscribe(ENGINE_INITIALIZING_UI, this.#handleEngineInitializingUI.bind(this));
        // ... and so on for all subscriptions.
        // However, typically, the dispatcher might handle this if the subscribed instance is garbage collected,
        // or if subscriptions return a handle that can be individually disposed.
    }
}