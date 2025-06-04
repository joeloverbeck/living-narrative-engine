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
  CANNOT_SAVE_GAME_INFO,
} from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../domUI/domUiFacade.js').DomUiFacade} DomUiFacade
 */

/**
 * @typedef {object} EngineInitializingUIPayload
 * @property {string} worldName - The name of the world being initialized.
 */

/**
 * @typedef {object} EngineReadyUIPayload
 * @property {string | null} activeWorld - The name of the active world, or null if not applicable.
 * @property {string} message - The message to display, typically for the input prompt.
 */

/**
 * @typedef {object} EngineOperationInProgressUIPayload
 * @property {string} titleMessage - The message to set as the UI title.
 * @property {string} inputDisabledMessage - The message to display when disabling input.
 */

/**
 * @typedef {object} EngineOperationFailedUIPayload
 * @property {string} errorMessage - The error message to render.
 * @property {string} errorTitle - The title to set, indicating an error.
 */

/**
 * @typedef {object} EngineStoppedUIPayload
 * @property {string} inputDisabledMessage - The message to display when disabling input.
 */

/**
 * @typedef {object} EngineMessageDisplayRequestedPayload
 * @property {string} message - The message content to display.
 * @property {'info' | 'error' | 'fatal' | 'warning' | 'success'} type - The type of message.
 */

/**
 * @typedef {import('../interfaces/IEvent.js').IEvent<EngineInitializingUIPayload>} EngineInitializingUIEvent
 * @typedef {import('../interfaces/IEvent.js').IEvent<EngineReadyUIPayload>} EngineReadyUIEvent
 * @typedef {import('../interfaces/IEvent.js').IEvent<EngineOperationInProgressUIPayload>} EngineOperationInProgressUIEvent
 * @typedef {import('../interfaces/IEvent.js').IEvent<EngineOperationFailedUIPayload>} EngineOperationFailedUIEvent
 * @typedef {import('../interfaces/IEvent.js').IEvent<EngineStoppedUIPayload>} EngineStoppedUIEvent
 * @typedef {import('../interfaces/IEvent.js').IEvent<EngineMessageDisplayRequestedPayload>} EngineMessageDisplayRequestedEvent
 * @typedef {import('../interfaces/IEvent.js').IEvent<{}>} EmptyPayloadEvent
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
  constructor({ eventDispatcher, domUiFacade, logger }) {
    if (!eventDispatcher) {
      this.#logger?.error(
        'EngineUIManager: ISafeEventDispatcher dependency is required at construction.'
      ); // Logger might not be set yet
      throw new Error(
        'EngineUIManager: ISafeEventDispatcher dependency is required.'
      );
    }
    if (!domUiFacade) {
      this.#logger?.error(
        'EngineUIManager: DomUiFacade dependency is required at construction.'
      );
      throw new Error('EngineUIManager: DomUiFacade dependency is required.');
    }
    if (!logger) {
      // No logger to log with if logger itself is missing.
      console.error(
        'EngineUIManager: ILogger dependency is required at construction.'
      );
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
    this.#logger.info(
      'EngineUIManager: Initialization complete. Event subscriptions active.'
    );
  }

  /**
   * @private
   * Subscribes to various UI-related events dispatched by the GameEngine.
   * Each event is bound to a specific handler method within this class.
   * @returns {void}
   */
  #subscribeToEvents() {
    this.#eventDispatcher.subscribe(
      ENGINE_INITIALIZING_UI,
      this.#handleEngineInitializingUI.bind(this)
    );
    this.#eventDispatcher.subscribe(
      ENGINE_READY_UI,
      this.#handleEngineReadyUI.bind(this)
    );
    this.#eventDispatcher.subscribe(
      ENGINE_OPERATION_IN_PROGRESS_UI,
      this.#handleEngineOperationInProgressUI.bind(this)
    );
    this.#eventDispatcher.subscribe(
      ENGINE_OPERATION_FAILED_UI,
      this.#handleEngineOperationFailedUI.bind(this)
    );
    this.#eventDispatcher.subscribe(
      ENGINE_STOPPED_UI,
      this.#handleEngineStoppedUI.bind(this)
    );
    this.#eventDispatcher.subscribe(
      ENGINE_MESSAGE_DISPLAY_REQUESTED,
      this.#handleEngineMessageDisplayRequested.bind(this)
    );
    this.#eventDispatcher.subscribe(
      REQUEST_SHOW_SAVE_GAME_UI,
      this.#handleRequestShowSaveGameUI.bind(this)
    );
    this.#eventDispatcher.subscribe(
      REQUEST_SHOW_LOAD_GAME_UI,
      this.#handleRequestShowLoadGameUI.bind(this)
    );
    this.#eventDispatcher.subscribe(
      CANNOT_SAVE_GAME_INFO,
      this.#handleCannotSaveGameInfo.bind(this)
    );

    this.#logger.debug(
      'EngineUIManager: Subscribed to all designated UI events.'
    );
  }

  /**
   * @private
   * Handles the ENGINE_INITIALIZING_UI event. Updates the UI to reflect that
   * the game engine is initializing a new world, setting the title and disabling input.
   * @param {EngineInitializingUIEvent} event - The event object containing payload: { worldName: string }.
   */
  #handleEngineInitializingUI(event) {
    const payload = event.payload;
    this.#logger.debug(
      `EngineUIManager: Received ${ENGINE_INITIALIZING_UI}`,
      payload
    );
    if (!payload || typeof payload.worldName !== 'string') {
      this.#logger.warn(
        `EngineUIManager: Invalid or missing payload for ${ENGINE_INITIALIZING_UI}.`,
        payload
      );
      return;
    }

    const titleMessage = `Initializing ${payload.worldName}...`;
    this.#domUiFacade.title.set(titleMessage);
    this.#domUiFacade.input.setEnabled(false, titleMessage);
    this.#logger.info(
      `EngineUIManager: Handled ${ENGINE_INITIALIZING_UI}. UI updated for world: ${payload.worldName}.`
    );
  }

  /**
   * @private
   * Handles the ENGINE_READY_UI event. Sets the UI title to the active world (or a default)
   * and enables player input with a provided prompt message.
   * @param {EngineReadyUIEvent} event - The event object containing payload: { activeWorld: string | null, message: string }.
   */
  #handleEngineReadyUI(event) {
    const payload = event.payload;
    this.#logger.debug(`EngineUIManager: Received ${ENGINE_READY_UI}`, payload);
    if (!payload || typeof payload.message !== 'string') {
      this.#logger.warn(
        `EngineUIManager: Invalid or missing payload for ${ENGINE_READY_UI}.`,
        payload
      );
      return;
    }

    this.#domUiFacade.title.set(payload.activeWorld || 'Game Ready');
    this.#domUiFacade.input.setEnabled(true, payload.message);
    this.#logger.info(
      `EngineUIManager: Handled ${ENGINE_READY_UI}. UI set to ready state. Active world: ${payload.activeWorld || 'N/A'}.`
    );
  }

  /**
   * @private
   * Handles the ENGINE_OPERATION_IN_PROGRESS_UI event. Updates the UI title
   * and disables input, indicating a background operation is underway.
   * @param {EngineOperationInProgressUIEvent} event - The event object containing payload: { titleMessage: string, inputDisabledMessage: string }.
   */
  #handleEngineOperationInProgressUI(event) {
    const payload = event.payload;
    this.#logger.debug(
      `EngineUIManager: Received ${ENGINE_OPERATION_IN_PROGRESS_UI}`,
      payload
    );
    if (
      !payload ||
      typeof payload.titleMessage !== 'string' ||
      typeof payload.inputDisabledMessage !== 'string'
    ) {
      this.#logger.warn(
        `EngineUIManager: Invalid or missing payload for ${ENGINE_OPERATION_IN_PROGRESS_UI}.`,
        payload
      );
      return;
    }

    this.#domUiFacade.title.set(payload.titleMessage);
    this.#domUiFacade.input.setEnabled(false, payload.inputDisabledMessage);
    this.#logger.info(
      `EngineUIManager: Handled ${ENGINE_OPERATION_IN_PROGRESS_UI}. Title: "${payload.titleMessage}". Input disabled.`
    );
  }

  /**
   * @private
   * Handles the ENGINE_OPERATION_FAILED_UI event. Renders a fatal error message,
   * disables player input, and sets an error title in the UI.
   * @param {EngineOperationFailedUIEvent} event - The event object containing payload: { errorMessage: string, errorTitle: string }.
   */
  #handleEngineOperationFailedUI(event) {
    const payload = event.payload;
    this.#logger.debug(
      `EngineUIManager: Received ${ENGINE_OPERATION_FAILED_UI}`,
      payload
    );
    if (
      !payload ||
      typeof payload.errorMessage !== 'string' ||
      typeof payload.errorTitle !== 'string'
    ) {
      this.#logger.warn(
        `EngineUIManager: Invalid or missing payload for ${ENGINE_OPERATION_FAILED_UI}.`,
        payload
      );
      return;
    }

    this.#domUiFacade.messages.render(payload.errorMessage, 'fatal');
    this.#domUiFacade.input.setEnabled(false, 'Operation failed.'); // As per ticket spec
    this.#domUiFacade.title.set(payload.errorTitle);
    this.#logger.error(
      `EngineUIManager: Handled ${ENGINE_OPERATION_FAILED_UI}. Error Title: "${payload.errorTitle}", Message: "${payload.errorMessage}".`
    );
  }

  /**
   * @private
   * Handles the ENGINE_STOPPED_UI event. Disables player input with a specific message
   * and optionally sets the title to "Game Stopped".
   * @param {EngineStoppedUIPayload} event - The event object containing payload: { inputDisabledMessage: string }.
   */
  #handleEngineStoppedUI(event) {
    const payload = event.payload;
    this.#logger.debug(
      `EngineUIManager: Received ${ENGINE_STOPPED_UI}`,
      payload
    );
    if (!payload || typeof payload.inputDisabledMessage !== 'string') {
      this.#logger.warn(
        `EngineUIManager: Invalid or missing payload for ${ENGINE_STOPPED_UI}.`,
        payload
      );
      return;
    }

    this.#domUiFacade.input.setEnabled(false, payload.inputDisabledMessage);
    this.#domUiFacade.title.set('Game Stopped'); // Optional update as per ticket
    this.#logger.info(
      `EngineUIManager: Handled ${ENGINE_STOPPED_UI}. Input disabled. Title set to "Game Stopped".`
    );
  }

  /**
   * @private
   * Handles the ENGINE_MESSAGE_DISPLAY_REQUESTED event. Renders a message
   * of a specified type (info, error, etc.) in the UI.
   * @param {EngineMessageDisplayRequestedEvent} event - The event object containing payload: { message: string, type: 'info' | 'error' | 'fatal' | 'warning' | 'success' }.
   */
  #handleEngineMessageDisplayRequested(event) {
    const payload = event.payload;
    this.#logger.debug(
      `EngineUIManager: Received ${ENGINE_MESSAGE_DISPLAY_REQUESTED}`,
      payload
    );
    if (
      !payload ||
      typeof payload.message !== 'string' ||
      typeof payload.type !== 'string'
    ) {
      this.#logger.warn(
        `EngineUIManager: Invalid or missing payload for ${ENGINE_MESSAGE_DISPLAY_REQUESTED}.`,
        payload
      );
      return;
    }
    // Ensure type is one of the allowed values, though TS helps here at compile time.
    const validTypes = ['info', 'error', 'fatal', 'warning', 'success'];
    if (!validTypes.includes(payload.type)) {
      this.#logger.warn(
        `EngineUIManager: Invalid message type "${payload.type}" for ${ENGINE_MESSAGE_DISPLAY_REQUESTED}. Defaulting to 'info'.`,
        payload
      );
      payload.type = 'info';
    }

    this.#domUiFacade.messages.render(payload.message, payload.type);
    this.#logger.info(
      `EngineUIManager: Handled ${ENGINE_MESSAGE_DISPLAY_REQUESTED}. Displayed ${payload.type} message: "${payload.message.substring(0, 50)}..."`
    );
  }

  /**
   * @private
   * Handles the REQUEST_SHOW_SAVE_GAME_UI event. Attempts to show the Save Game UI
   * component via the DomUiFacade. Logs a warning if the component is not available.
   * @param {EmptyPayloadEvent} event - The event object (payload is typically empty).
   */
  #handleRequestShowSaveGameUI(event) {
    this.#logger.debug(
      `EngineUIManager: Received ${REQUEST_SHOW_SAVE_GAME_UI}`,
      event.payload
    );
    if (
      this.#domUiFacade.saveGame &&
      typeof this.#domUiFacade.saveGame.show === 'function'
    ) {
      this.#domUiFacade.saveGame.show();
      this.#logger.info(
        `EngineUIManager: Handled ${REQUEST_SHOW_SAVE_GAME_UI}. Save Game UI requested to show.`
      );
    } else {
      this.#logger.warn(
        `EngineUIManager: SaveGameUI component not available or 'show' method missing on DomUiFacade. Cannot show Save Game UI.`
      );
    }
  }

  /**
   * @private
   * Handles the REQUEST_SHOW_LOAD_GAME_UI event. Attempts to show the Load Game UI
   * component via the DomUiFacade. Logs a warning if the component is not available.
   * @param {EmptyPayloadEvent} event - The event object (payload is typically empty).
   */
  #handleRequestShowLoadGameUI(event) {
    this.#logger.debug(
      `EngineUIManager: Received ${REQUEST_SHOW_LOAD_GAME_UI}`,
      event.payload
    );
    if (
      this.#domUiFacade.loadGame &&
      typeof this.#domUiFacade.loadGame.show === 'function'
    ) {
      this.#domUiFacade.loadGame.show();
      this.#logger.info(
        `EngineUIManager: Handled ${REQUEST_SHOW_LOAD_GAME_UI}. Load Game UI requested to show.`
      );
    } else {
      this.#logger.warn(
        `EngineUIManager: LoadGameUI component not available or 'show' method missing on DomUiFacade. Cannot show Load Game UI.`
      );
    }
  }

  /**
   * @private
   * Handles the CANNOT_SAVE_GAME_INFO event. Renders an informational message
   * in the UI indicating that saving is not currently possible.
   * @param {EmptyPayloadEvent} event - The event object (payload is typically empty).
   */
  #handleCannotSaveGameInfo(event) {
    this.#logger.debug(
      `EngineUIManager: Received ${CANNOT_SAVE_GAME_INFO}`,
      event.payload
    );
    const message =
      'Cannot save at this moment (e.g. game not fully initialized or in a critical state).';
    this.#domUiFacade.messages.render(message, 'info');
    this.#logger.info(
      `EngineUIManager: Handled ${CANNOT_SAVE_GAME_INFO}. Displayed info message: "${message}"`
    );
  }

  /**
   * Disposes of the EngineUIManager, primarily for cleaning up event subscriptions if necessary.
   * Currently, ISafeEventDispatcher handles unsubscription if the listener itself is destroyed or deregistered.
   * This method is provided for completeness and future use if manual unsubscription becomes necessary.
   * @returns {void}
   */
  dispose() {
    this.#logger.info(
      'EngineUIManager: Disposing. (No explicit unsubscriptions needed with current ISafeEventDispatcher behavior).'
    );
    // If ISafeEventDispatcher required manual unsubscription, it would happen here:
    // Example:
    // this.#eventDispatcher.unsubscribe(ENGINE_INITIALIZING_UI, this.#handleEngineInitializingUI.bind(this));
    // ... and so on for all subscriptions.
  }
}
