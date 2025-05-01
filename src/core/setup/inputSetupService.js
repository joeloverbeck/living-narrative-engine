// src/core/setup/inputSetupService.js

// --- Type Imports ---
/** @typedef {import('../config/appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path
/** @typedef {import('../gameLoop.js').default} GameLoop */
/** @typedef {import('../interfaces/IInputHandler.js').IInputHandler} IInputHandler */ // Use Interface type

// --- Token Import --- ADDED
import { tokens } from '../config/tokens.js'; // ADDED

/**
 * @class InputSetupService
 * @description Configures the InputHandler, linking it to the GameLoop and event system.
 */
class InputSetupService {
  /** @private @type {AppContainer} */
  #container;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {ValidatedEventDispatcher} */
  #validatedEventDispatcher;
  /** @private @type {GameLoop} */
  #gameLoop;

  /**
   * Creates an instance of InputSetupService.
   * @param {object} options - The dependencies.
   * @param {AppContainer} options.container
   * @param {ILogger} options.logger
   * @param {ValidatedEventDispatcher} options.validatedEventDispatcher
   * @param {GameLoop} options.gameLoop
   * @throws {Error} If dependencies are missing.
   */
  constructor({ container, logger, validatedEventDispatcher, gameLoop }) {
    // Simplified validation for brevity, assume checks pass
    if (!container) throw new Error("InputSetupService: Missing 'container'.");
    if (!logger) throw new Error("InputSetupService: Missing 'logger'.");
    if (!validatedEventDispatcher) throw new Error("InputSetupService: Missing 'validatedEventDispatcher'.");
    if (!gameLoop) throw new Error("InputSetupService: Missing 'gameLoop'.");

    this.#container = container;
    this.#logger = logger;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#gameLoop = gameLoop;

    this.#logger.info('InputSetupService: Instance created.');
  }

  /**
   * @public
   * @description Configures the application's InputHandler by resolving it
   * and setting its command processing callback.
   * Dispatches 'initialization:input_setup_service:started/completed/failed' events.
   * @returns {void}
   * @throws {Error} If the InputHandler cannot be resolved or configured.
   */
  configureInputHandler() {
    this.#logger.debug('InputSetupService: Attempting to configure InputHandler...');

    // --- Ticket 16: Dispatch 'started' event ---
    const startPayload = {};
    this.#validatedEventDispatcher.dispatchValidated('initialization:input_setup_service:started', startPayload, { allowSchemaNotFound: true })
        .then(() => this.#logger.debug("Dispatched 'initialization:input_setup_service:started' event."))
        .catch(e => this.#logger.error("Failed to dispatch 'initialization:input_setup_service:started' event", e));
    // --- End Ticket 16 ---

    try {
      // --- MODIFIED: Resolve using the correct token ---
      const inputHandler = /** @type {IInputHandler} */ (this.#container.resolve(tokens.IInputHandler));
      // --- END MODIFICATION ---

      const processInputCommand = async (command) => {
        // Echo command via VED
        this.#validatedEventDispatcher.dispatchValidated('ui:command_echo', { command })
            .catch(e => this.#logger.error("Failed dispatching ui:command_echo", e)); // Log dispatch errors

        // Process if game loop running
        if (this.#gameLoop && this.#gameLoop.isRunning) {
          // Don't await processSubmittedCommand as it handles its own flow
          this.#gameLoop.processSubmittedCommand(command);
        } else {
          this.#logger.warn('Input received, but GameLoop is not ready/running.');
          // Disable input via VED
          this.#validatedEventDispatcher.dispatchValidated('ui:disable_input', { message: 'Game not running.' })
              .catch(e => this.#logger.error("Failed dispatching ui:disable_input", e)); // Log dispatch errors
        }
      };

      // Set the callback
      inputHandler.setCommandCallback(processInputCommand);

      this.#logger.info('InputSetupService: InputHandler resolved and command callback configured.');

      // --- Ticket 16: Dispatch 'completed' event ---
      const completedPayload = {};
      this.#validatedEventDispatcher.dispatchValidated('initialization:input_setup_service:completed', completedPayload, { allowSchemaNotFound: true })
          .then(() => this.#logger.debug("Dispatched 'initialization:input_setup_service:completed' event."))
          .catch(e => this.#logger.error("Failed to dispatch 'initialization:input_setup_service:completed' event", e));
      // --- End Ticket 16 ---

    } catch (error) {
      this.#logger.error('InputSetupService: Failed to resolve or configure InputHandler.', error);

      // --- Ticket 16: Dispatch 'failed' event ---
      const failedPayload = { error: error?.message || 'Unknown error', stack: error?.stack };
      this.#validatedEventDispatcher.dispatchValidated('initialization:input_setup_service:failed', failedPayload, { allowSchemaNotFound: true })
          .then(() => this.#logger.debug("Dispatched 'initialization:input_setup_service:failed' event.", failedPayload))
          .catch(e => this.#logger.error("Failed to dispatch 'initialization:input_setup_service:failed' event", e));
      // --- End Ticket 16 ---

      // Propagate the error as this is critical
      throw new Error(`InputSetupService configuration failed: ${error.message}`);
    }
  }
}

export default InputSetupService;