// src/setup/inputSetupService.js

// --- Type Imports ---
/** @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../events/safeEventDispatcher.js').SafeEventDispatcher} SafeEventDispatcher */
// GameLoop import removed
/** @typedef {import('../interfaces/IInputHandler.js').IInputHandler} IInputHandler */ // Use Interface type

// --- Token Import ---
import { tokens } from '../dependencyInjection/tokens.js';

/**
 * @class InputSetupService
 * @description Configures the InputHandler, linking user command input to the
 * event system via 'core:submit_command' events.
 */
class InputSetupService {
  #container;
  #logger;
  #safeEventDispatcher;

  // #gameLoop field removed

  /**
   * Creates an instance of InputSetupService.
   *
   * @param {object} options - The dependencies.
   * @param {AppContainer} options.container
   * @param {ILogger} options.logger
   * @param {SafeEventDispatcher} options.safeEventDispatcher
   * // gameLoop option removed
   * @throws {Error} If dependencies are missing.
   */
  constructor({ container, logger, safeEventDispatcher }) {
    // gameLoop removed
    // Simplified validation for brevity, assume checks pass
    if (!container) throw new Error("InputSetupService: Missing 'container'.");
    if (!logger) throw new Error("InputSetupService: Missing 'logger'.");
    if (!safeEventDispatcher)
      throw new Error("InputSetupService: Missing 'safeEventDispatcher'.");
    // gameLoop validation removed

    this.#container = container;
    this.#logger = logger;
    this.#safeEventDispatcher = safeEventDispatcher;
    // #gameLoop assignment removed

    this.#logger.info('InputSetupService: Instance created.');
  }

  /**
   * @public
   * @description Configures the application's InputHandler by resolving it
   * and setting its command processing callback. The callback now dispatches
   * a 'core:submit_command' event instead of directly interacting with GameLoop.
   * Dispatches 'initialization:input_setup_service:started/completed/failed' events.
   * @returns {void}
   * @throws {Error} If the InputHandler cannot be resolved or configured.
   */
  configureInputHandler() {
    this.#logger.debug(
      'InputSetupService: Attempting to configure InputHandler...'
    );

    try {
      // --- Resolve Input Handler ---
      const inputHandler = /** @type {IInputHandler} */ (
        this.#container.resolve(tokens.IInputHandler)
      );

      // --- Define the Command Processing Callback ---
      const processInputCommand = async (command) => {
        // --- REFACTORED LOGIC ---
        // Instead of checking GameLoop and calling its method,
        // simply dispatch the command submission event.
        // The PlayerTurnHandler (or other interested systems) will
        // subscribe to this event and decide whether to act on it based
        // on the current game state (e.g., is it the player's turn?).
        this.#logger.debug(
          `InputSetupService: Dispatching core:submit_command for command "${command}"`
        );
        this.#safeEventDispatcher
          .dispatch('core:submit_command', { command })
          .catch((e) =>
            this.#logger.error(
              `Failed dispatching core:submit_command for command "${command}"`,
              e
            )
          ); // Log dispatch errors specifically for core:submit_command
        // --- END REFACTORED LOGIC ---
      };

      // Set the callback on the InputHandler instance
      inputHandler.setCommandCallback(processInputCommand);

      this.#logger.info(
        'InputSetupService: InputHandler resolved and command callback configured to dispatch core:submit_command events.'
      );
    } catch (error) {
      this.#logger.error(
        'InputSetupService: Failed to resolve or configure InputHandler.',
        error
      );

      // Propagate the error as this is critical
      throw new Error(
        `InputSetupService configuration failed: ${error.message}`
      );
    }
  }
}

export default InputSetupService;
