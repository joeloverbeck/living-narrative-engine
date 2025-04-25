// src/core/GameLoop.js

// --- Type Imports ---
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./inputHandler.js').default} InputHandler */
/** @typedef {import('./commandParser.js').default} CommandParser */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // [EVENT-MIGR-015] Task 1: ADDED Type Import
/** @typedef {import('../systems/actionDiscoverySystem.js').ActionDiscoverySystem} ActionDiscoverySystem */
/** @typedef {import('../core/services/consoleLogger.js').default} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */


// --- Define the options object structure ---
/**
 * @typedef {object} GameLoopOptions
 * @property {GameDataRepository} gameDataRepository
 * @property {EntityManager} entityManager
 * @property {GameStateManager} gameStateManager
 * @property {InputHandler} inputHandler
 * @property {CommandParser} commandParser
 * @property {ActionExecutor} actionExecutor
 * @property {EventBus} eventBus
 * @property {ActionDiscoverySystem} actionDiscoverySystem
 * @property {ValidatedEventDispatcher} validatedDispatcher // [EVENT-MIGR-015] Task 1: ADDED Property
 * @property {ILogger} logger
 */

/**
 * GameLoop orchestrates the main game flow *after* initialization.
 * It manages dependencies, processes user input, delegates action execution,
 * discovers available player actions, and relies on the EventBus for communication.
 * Adapted for browser environment with HTML input field.
 */
class GameLoop {
  #gameDataRepository;
  #entityManager;
  #gameStateManager;
  #inputHandler;
  #commandParser;
  #actionExecutor;
  #eventBus; // Still needed for subscribe and potentially other dispatches not covered by this refactor
  #actionDiscoverySystem;
  #validatedDispatcher; // [EVENT-MIGR-015] Task 1: ADDED Private Field
  #logger;

  #isRunning = false;

  /**
     * @param {GameLoopOptions} options - Configuration object containing all dependencies.
     */
  constructor(options) {
    // --- Destructure and Validate constructor arguments ---
    const {
      gameDataRepository,
      entityManager,
      gameStateManager,
      inputHandler,
      commandParser,
      actionExecutor,
      eventBus,
      actionDiscoverySystem,
      validatedDispatcher, // [EVENT-MIGR-015] Task 1: ADDED Destructuring
      logger
    } = options || {};

    // --- Validate Dependencies ---
    if (!gameDataRepository) throw new Error('GameLoop requires options.gameDataRepository.');
    if (!entityManager) throw new Error('GameLoop requires options.entityManager.');
    if (!gameStateManager) throw new Error('GameLoop requires options.gameStateManager.');
    if (!inputHandler || typeof inputHandler.enable !== 'function' || typeof inputHandler.disable !== 'function') {
      throw new Error('GameLoop requires a valid options.inputHandler object.');
    }
    if (!commandParser || typeof commandParser.parse !== 'function') {
      throw new Error('GameLoop requires a valid options.commandParser object.');
    }
    if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
      throw new Error('GameLoop requires a valid options.actionExecutor object.');
    }
    if (!eventBus || typeof eventBus.dispatch !== 'function' || typeof eventBus.subscribe !== 'function') {
      throw new Error('GameLoop requires a valid options.eventBus object.');
    }
    if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
      throw new Error('GameLoop requires a valid options.actionDiscoverySystem object.');
    }
    // [EVENT-MIGR-015] Task 1: ADDED Validation START
    if (!validatedDispatcher || typeof validatedDispatcher.dispatchValidated !== 'function') {
      throw new Error('GameLoop requires a valid options.validatedDispatcher object.');
    }
    // [EVENT-MIGR-015] Task 1: ADDED Validation END
    if (!logger || typeof logger.info !== 'function') {
      throw new Error('GameLoop requires a valid options.logger object (ILogger).');
    }

    // --- Assign Dependencies ---
    this.#gameDataRepository = gameDataRepository;
    this.#entityManager = entityManager;
    this.#gameStateManager = gameStateManager;
    this.#inputHandler = inputHandler;
    this.#commandParser = commandParser;
    this.#actionExecutor = actionExecutor;
    this.#eventBus = eventBus; // Still needed for subscribe and potentially other dispatches
    this.#actionDiscoverySystem = actionDiscoverySystem;
    this.#validatedDispatcher = validatedDispatcher; // [EVENT-MIGR-015] Task 1: ADDED Assignment
    this.#logger = logger;

    this.#isRunning = false; // Initialize running state

    this.#subscribeToEvents();

    this.#logger.info('GameLoop: Instance created with dependencies (including ActionDiscoverySystem, ValidatedEventDispatcher & Logger). Ready to start.');
  }

  /**
     * Sets up necessary event bus subscriptions for the GameLoop.
     * @private
     */
  #subscribeToEvents() {
    // [EVENT-MIGR-015] No change here, still using raw eventBus for subscribe
    this.#eventBus.subscribe('command:submit', this.#handleSubmittedCommandFromEvent.bind(this));
    this.#logger.info("GameLoop: Subscribed to 'command:submit' event.");
  }

  /**
     * Handles commands received via the 'command:submit' event (e.g., from UI input field).
     * @private
     * @param {{command: string}} eventData - The event payload containing the command string.
     */
  async #handleSubmittedCommandFromEvent(eventData) {
    // [EVENT-MIGR-015] No change in functionality here
    if (!this.#isRunning) {
      this.#logger.warn('GameLoop received command submission via event, but loop is not running.');
      return;
    }
    if (eventData && typeof eventData.command === 'string') {
      this.#logger.info(`GameLoop: Received command via event: "${eventData.command}"`);
      await this.processSubmittedCommand(eventData.command);
    } else {
      this.#logger.warn("GameLoop received invalid 'command:submit' event data:", eventData);
      // Even if data is bad, ensure actions are discovered and input is enabled for next try
      await this._discoverPlayerActions();
      this.promptInput(); // Enable input again
    }
  }

  /**
     * Starts the main game loop and enables input.
     * Assumes GameInitializer has already run successfully.
     */
  async start() {
    // [EVENT-MIGR-015] No change in functionality here
    if (this.#isRunning) {
      this.#logger.warn('GameLoop: start() called but loop is already running.');
      return;
    }

    // --- Game state check ---
    if (!this.#gameStateManager.getPlayer() || !this.#gameStateManager.getCurrentLocation()) {
      const errorMsg = 'Critical Error: GameLoop cannot start because initial game state (player/location) is missing!';
      this.#logger.error('GameLoop:', errorMsg);
      // [EVENT-MIGR-015] Task 3: Refactored (Line ~157)
      this.#validatedDispatcher.dispatchValidated('event:display_message', {text: errorMsg, type: 'error'});
      this.#isRunning = false;
      const stopMessage = 'Game stopped due to initialization error.';
      this.#inputHandler.disable();
      // [EVENT-MIGR-015] Task 3: Refactored (Line ~163)
      this.#validatedDispatcher.dispatchValidated('event:disable_input', {message: stopMessage});
      // [EVENT-MIGR-015] Task 3: Refactored (Line ~164)
      this.#validatedDispatcher.dispatchValidated('event:display_message', {text: stopMessage, type: 'info'});
      return;
    }

    // --- If checks pass, proceed with starting ---
    this.#isRunning = true;
    this.#logger.info('GameLoop: Started.');

    // Discover initial actions FIRST
    await this._discoverPlayerActions();

    // THEN enable input
    this.promptInput('Enter command...'); // Provide initial placeholder
  }


  /**
     * Processes a command string submitted by the input handler or event bus.
     * Parses the command, executes the action, discovers next actions, and re-enables input.
     * @param {string} command - The raw command string from the input.
     */
  async processSubmittedCommand(command) {
    // [EVENT-MIGR-015] No change in functionality here
    if (!this.#isRunning) return;

    this.#logger.debug(`Processing command: "${command}"`);
    const parsedCommand = this.#commandParser.parse(command);

    // --- Handle Parsing Errors ---
    if (parsedCommand.error || !parsedCommand.actionId) {
      const message = parsedCommand.error ||
                (parsedCommand.originalInput.trim().length > 0 ? "Unknown command. Try 'help'." : '');

      if (message) {
        // [EVENT-MIGR-015] Task 3: Refactored (Line ~181)
        this.#validatedDispatcher.dispatchValidated('event:display_message', {text: message, type: 'error'});
      }
      // Even on error, discover actions for the *next* turn and re-enable input
      await this._discoverPlayerActions();
      this.promptInput(); // Re-enable input
      return;
    }

    // --- Execute Action ---
    if (!this.#gameStateManager.getPlayer() || !this.#gameStateManager.getCurrentLocation()) {
      this.#logger.error('GameLoop Error: Attempted to execute action but game state is missing!');
      // [EVENT-MIGR-015] Task 3: Refactored (Line ~198)
      this.#validatedDispatcher.dispatchValidated('event:display_message', {
        text: 'Internal Error: Game state not fully initialized.',
        type: 'error'
      });
      // Discover actions and re-enable input even after internal error
      await this._discoverPlayerActions();
      this.promptInput(); // Re-enable input
      return;
    }

    // Execute the action (synchronous in this example)
    this.executeAction(parsedCommand.actionId, parsedCommand);

    // Discover actions for the *next* turn AFTER execution
    await this._discoverPlayerActions();

    // THEN re-enable input
    this.promptInput();
  }

  /**
     * Prepares context and delegates action execution to the ActionExecutor.
     * (Synchronous as ActionExecutor.executeAction is synchronous)
     * @private
     */
  executeAction(actionId, parsedCommand) {
    // [EVENT-MIGR-015] No change in functionality here
    const currentPlayer = this.#gameStateManager.getPlayer();
    const currentLocationBeforeAction = this.#gameStateManager.getCurrentLocation();

    if (!currentPlayer || !currentLocationBeforeAction) {
      this.#logger.error('GameLoop executeAction called but state missing from GameStateManager.');
      // [EVENT-MIGR-015] Task 3: Refactored (Line ~227)
      this.#validatedDispatcher.dispatchValidated('event:display_message', {
        text: 'Internal Error: Game state inconsistent.',
        type: 'error'
      });
      return; // Don't continue if state is bad
    }

    /** @type {ActionContext} */
    const context = {
      playerEntity: currentPlayer,
      currentLocation: currentLocationBeforeAction,
      parsedCommand: parsedCommand,
      gameDataRepository: this.#gameDataRepository,
      entityManager: this.#entityManager,
      // NOTE: The dispatch function passed into context STILL uses the raw eventBus.
      // This is consistent with the ticket description which focuses on GameLoop's *direct* dispatches.
      // A separate task would be needed to refactor actions/systems to use ValidatedEventDispatcher if desired.
      dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
      // NOTE: Passing raw eventBus into context as well.
      eventBus: this.#eventBus
      // NOTE: validatedDispatcher is NOT passed into the ActionContext yet.
    };

    this.#logger.debug(`Executing action: ${actionId}`);
    // Assuming executeAction itself doesn't throw errors handled here, but ActionExecutor handles internal ones.
    this.#actionExecutor.executeAction(actionId, context);
  }


  /**
     * Discovers available actions for the player based on the current state
     * via ActionDiscoverySystem and dispatches the result via the EventBus.
     * Handles errors during action discovery gracefully.
     * @private
     * @async
     */
  async _discoverPlayerActions() {
    // [EVENT-MIGR-015] No change in functionality here
    if (!this.#isRunning) return;

    // *** FEAT-CORE-ACTIONS-02: AC4 (Scope) START ***
    // Initialize validActions here so it's available in the finally block.
    // Defaults to empty array in case of errors during discovery.
    let validActions = [];
    // *** FEAT-CORE-ACTIONS-02: AC4 (Scope) END ***

    this.#logger.debug('Attempting to discover player actions...');
    try {
      const playerEntity = this.#gameStateManager.getPlayer();
      const currentLocation = this.#gameStateManager.getCurrentLocation();

      if (!playerEntity || !currentLocation) {
        this.#logger.error('Cannot discover actions: Player or Location is missing from GameStateManager.');
        // Skip discovery attempt if state is bad, validActions remains []
        return; // Exit try block, proceed to finally
      }

      // Construct context needed by getValidActions & dependencies
      // Type assertion ensures ActionContext compatibility if needed by ActionDiscoverySystem internally
      /** @type {ActionContext} */
      const discoveryContext = {
        playerEntity: playerEntity,
        currentLocation: currentLocation,
        entityManager: this.#entityManager,
        gameDataRepository: this.#gameDataRepository,
        // NOTE: Still passing raw eventBus/dispatch into context for action discovery, same as executeAction.
        dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
        eventBus: this.#eventBus,
        // `parsedCommand` is not relevant for discovery, so omit or set to null/undefined if required by type
        parsedCommand: undefined
      };

      this.#logger.debug(`Calling getValidActions for player ${playerEntity.id}`);
      // Call the injected ActionDiscoverySystem and store the result
      validActions = await this.#actionDiscoverySystem.getValidActions(playerEntity, discoveryContext); // AC6: Discovery logic unchanged

      // NOTE: Logging of discovered actions moved to the finally block after dispatch.

    } catch (error) {
      // Log errors during the discovery process itself
      this.#logger.error('Error during player action discovery:', error);
      // validActions will remain as initialized (likely []) due to the error
    } finally {
      // *** FEAT-CORE-ACTIONS-02: AC2, AC3, AC4, AC5 START ***
      // This block executes regardless of whether the try block succeeded or failed.
      /** @type {UIUpdateActionsPayload} */
      const payload = {actions: validActions}; // AC4: Payload structure
      // [EVENT-MIGR-015] Task 3: Refactored (Line ~301)
      this.#validatedDispatcher.dispatchValidated('event:update_available_actions', payload); // AC2: Dispatch in finally, AC3: Use constant event name
      this.#logger.debug(`Dispatched ${'event:update_available_actions'} with ${validActions.length} actions.`); // AC5: Logging dispatch
      // *** FEAT-CORE-ACTIONS-02: AC2, AC3, AC4, AC5 END ***
    }
    // AC6: Method continues to function correctly. Control flow passes through finally.
  }


  /**
     * Enables the input handler and dispatches an event to update the UI input state.
     * This signals the UI (e.g., DomRenderer) that the game is ready for the next command.
     * @param {string} [message="Enter command..."] - Placeholder text for the input field.
     */
  promptInput(message = 'Enter command...') {
    // [EVENT-MIGR-015] No change in functionality here
    if (!this.#isRunning) return;
    this.#inputHandler.enable(); // Logically enable input capture in the handler
    // Dispatch event for UI update (e.g., DomRenderer listens for this)
    // [EVENT-MIGR-015] Task 3: Refactored (Line ~317)
    const payload = {placeholder: message};
    this.#validatedDispatcher.dispatchValidated('event:enable_input', payload); // Signal UI
    this.#logger.debug(`Input enabled via 'event:enable_input' event. Placeholder: "${message}"`);
  }

  /**
     * Stops the game loop, disables input handler, and dispatches events for UI updates.
     */
  stop() {
    // [EVENT-MIGR-015] No change in functionality here
    if (!this.#isRunning) {
      return;
    }
    this.#isRunning = false;
    const stopMessage = 'Game stopped.';

    this.#inputHandler.disable(); // Logically disable input capture
    // [EVENT-MIGR-015] Task 3: Refactored (Line ~329)
    const disablePayload = {message: stopMessage};
    this.#validatedDispatcher.dispatchValidated('event:disable_input', disablePayload); // Signal UI
    // [EVENT-MIGR-015] Task 3: Refactored (Line ~331)
    /** @type {UIMessageDisplayPayload} */ // Optional: Explicit type for clarity
    const messagePayload = {text: stopMessage, type: 'info'};
    this.#validatedDispatcher.dispatchValidated('event:display_message', messagePayload);

    this.#logger.info('GameLoop: Stopped.');
  }

  /**
     * Gets the current running state.
     * @returns {boolean}
     */
  get isRunning() {
    return this.#isRunning;
  }
}

export default GameLoop;