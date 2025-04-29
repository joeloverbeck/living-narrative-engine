// src/core/setup/inputSetupService.js

// --- Type Imports ---
/** @typedef {import('../config/appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../gameLoop.js').default} GameLoop */
/** @typedef {import('../inputHandler.js').default} InputHandler */ // Added for type hinting

/**
 * @class InputSetupService
 * @description Responsible for configuring the core InputHandler service.
 * It resolves the InputHandler from the container and sets up its
 * command processing callback, linking it to the GameLoop and event system.
 * This class encapsulates the setup logic for user input processing.
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
     * @param {object} options - The dependencies for the service.
     * @param {AppContainer} options.container - The application's dependency injection container, used to resolve the InputHandler.
     * @param {ILogger} options.logger - The logging service for outputting information and errors.
     * @param {ValidatedEventDispatcher} options.validatedEventDispatcher - The service used for dispatching validated events (e.g., command echo, disabling input).
     * @param {GameLoop} options.gameLoop - The main game loop instance, which processes submitted commands when running.
     * @throws {Error} If any of the required dependencies (container, logger, validatedEventDispatcher, gameLoop) are missing.
     */
  constructor({ container, logger, validatedEventDispatcher, gameLoop }) {
    // AC5: Check for missing dependencies
    if (!container) {
      throw new Error("InputSetupService: Missing required dependency 'container'.");
    }
    if (!logger) {
      // Cannot use logger here as it might be the missing dependency
      console.error("InputSetupService: Missing required dependency 'logger'.");
      throw new Error("InputSetupService: Missing required dependency 'logger'.");
    }
    if (!validatedEventDispatcher) {
      logger.error("InputSetupService: Missing required dependency 'validatedEventDispatcher'.");
      throw new Error("InputSetupService: Missing required dependency 'validatedEventDispatcher'.");
    }
    if (!gameLoop) {
      logger.error("InputSetupService: Missing required dependency 'gameLoop'.");
      throw new Error("InputSetupService: Missing required dependency 'gameLoop'.");
    }

    // AC6: Store dependencies in private fields
    this.#container = container;
    this.#logger = logger;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#gameLoop = gameLoop;

    this.#logger.info('InputSetupService: Instance created successfully with dependencies.');
  }

  /**
     * @public
     * @description Configures the application's InputHandler.
     * This method resolves the InputHandler from the container and sets up
     * the callback function responsible for processing raw command strings entered by the user.
     * The callback will typically involve echoing the command to the UI and passing it
     * to the GameLoop for parsing and execution.
     *
     * @returns {void}
     * @throws {Error} If the InputHandler cannot be resolved or configured.
     */
  configureInputHandler() {
    // Implementation moved from GameEngine.#initialize as per Ticket 3 (AC3)
    this.#logger.debug('InputSetupService: Attempting to configure InputHandler...');

    try {
      // AC1: Identify block - Start
      const inputHandler = /** @type {InputHandler} */ (this.#container.resolve('InputHandler')); // AC3: Use service's container

      // Define the command processing function
      const processInputCommand = async (command) => { // AC3: Ensure async
        // Use service's validated dispatcher
        if (this.#validatedEventDispatcher) { // AC3: Use service's validatedEventDispatcher
          await this.#validatedEventDispatcher.dispatchValidated('ui:command_echo', { command });
        } else {
          // Use service's logger (guaranteed by constructor)
          // Adapt log message prefix
          this.#logger.error('InputSetupService: ValidatedEventDispatcher not available in processInputCommand.'); // AC3: Adapt logging
        }

        // Use service's game loop
        if (this.#gameLoop && this.#gameLoop.isRunning) { // AC3: Use service's gameLoop
          this.#gameLoop.processSubmittedCommand(command);
        } else {
          // Use service's logger (guaranteed by constructor)
          // Adapt log message prefix
          this.#logger.warn('InputSetupService: Input received, but GameLoop is not ready/running.'); // AC3: Adapt logging
          // Use service's validated dispatcher
          if (this.#validatedEventDispatcher) { // AC3: Use service's validatedEventDispatcher
            await this.#validatedEventDispatcher.dispatchValidated('ui:disable_input', { message: 'Game not running.' });
          }
        }
      };

      // Set the callback on the resolved input handler
      inputHandler.setCommandCallback(processInputCommand); // AC1: Identify block - End (inclusive)

      // AC3: Use service's logger and adapt message; Place after callback is set
      this.#logger.info('InputSetupService: InputHandler resolved and command callback configured.');

    } catch (error) {
      this.#logger.error('InputSetupService: Failed to resolve or configure InputHandler.', error);
      // Propagate the error as this is critical for game function
      throw new Error(`InputSetupService configuration failed: ${error.message}`);
    }
    // AC2: Code moved into this method body
  }
}

// AC1 & AC2: File created and class defined (from Sub-Ticket 3.1). Method body now implemented.
export default InputSetupService;