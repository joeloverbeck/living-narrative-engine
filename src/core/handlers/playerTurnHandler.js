// src/core/handlers/playerTurnHandler.js
// --- FILE START (Entire file content as requested) ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/./IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {{ command: string }} CommandSubmitEventData */
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */
/** @typedef {import('../../actions/actionTypes.js').ActionDefinitionMinimal} ActionDefinitionMinimal */
/** @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../ports/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../ports/commonTypes.js').UnsubscribeFn} UnsubscribeFn */
/** @typedef {import('../services/playerPromptService.js').default} PlayerPromptService */
/** @typedef {import('../interpreters/commandOutcomeInterpreter.js').default} CommandOutcomeInterpreter */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */


// Define PlayerTurnPrompt Payload Type
/**
 * @typedef {object} PlayerTurnPromptPayload
 * @property {string} entityId - The unique ID of the player entity being prompted.
 * @property {DiscoveredActionInfo[]} availableActions - Array of objects containing valid action IDs and commands.
 * @property {string} [error] - Optional error message if prompting occurred due to an error.
 */


/**
 * @class PlayerTurnHandler
 * @extends ITurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic for player-controlled entities. (V2 - Event-driven turn completion).
 */
class PlayerTurnHandler extends ITurnHandler {
    // --- Private Fields ---
    /** @type {ILogger} */
    #logger;
    /** @type {IActionDiscoverySystem} */
    #actionDiscoverySystem;
    /** @type {ICommandProcessor} */
    #commandProcessor;
    /** @type {IWorldContext} */
    #worldContext;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameDataRepository} */
    #gameDataRepository;
    /** @type {IPromptOutputPort} */
    #promptOutputPort;
    /** @type {ITurnEndPort} */
    #turnEndPort;
    /** @type {ICommandInputPort} */
    #commandInputPort;
    /** @type {PlayerPromptService} */
    #playerPromptService;
    /** @type {CommandOutcomeInterpreter} */
    #commandOutcomeInterpreter;
    /** @type {ISafeEventDispatcher} */
    #safeEventDispatcher;

    /** @type {Entity | null} */
    #currentActor = null;
    /** @type {UnsubscribeFn | null} */
    #commandUnsubscribeFn = null;

    /**
     * Creates an instance of PlayerTurnHandler.
     * @param {object} dependencies - Dependencies.
     * @param {ILogger} dependencies.logger
     * @param {IActionDiscoverySystem} dependencies.actionDiscoverySystem
     * @param {ICommandProcessor} dependencies.commandProcessor
     * @param {IWorldContext} dependencies.worldContext
     * @param {EntityManager} dependencies.entityManager
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {IPromptOutputPort} dependencies.promptOutputPort
     * @param {ITurnEndPort} dependencies.turnEndPort
     * @param {ICommandInputPort} dependencies.commandInputPort
     * @param {PlayerPromptService} dependencies.playerPromptService
     * @param {CommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter
     * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
     */
    constructor({
                    logger,
                    actionDiscoverySystem,
                    commandProcessor,
                    worldContext,
                    entityManager,
                    gameDataRepository,
                    promptOutputPort,
                    turnEndPort,
                    commandInputPort,
                    playerPromptService,
                    commandOutcomeInterpreter,
                    safeEventDispatcher,
                }) {
        super();
        const className = this.constructor.name;

        // --- Dependency Validations ---
        if (!logger || typeof logger.error !== 'function') {
            console.error(`${className} Constructor: Invalid or missing logger dependency.`);
            throw new Error(`${className}: Invalid or missing logger dependency.`);
        }
        this.#logger = logger;

        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing actionDiscoverySystem (requires getValidActions).`);
            throw new Error(`${className}: Invalid or missing actionDiscoverySystem.`);
        }
        this.#actionDiscoverySystem = actionDiscoverySystem;

        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandProcessor (requires processCommand).`);
            throw new Error(`${className}: Invalid or missing commandProcessor.`);
        }
        this.#commandProcessor = commandProcessor;

        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing worldContext (requires getLocationOfEntity).`);
            throw new Error(`${className}: Invalid or missing worldContext.`);
        }
        this.#worldContext = worldContext;

        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing entityManager (requires getEntityInstance).`);
            throw new Error(`${className}: Invalid or missing entityManager.`);
        }
        this.#entityManager = entityManager;

        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing gameDataRepository (requires getActionDefinition).`);
            throw new Error(`${className}: Invalid or missing gameDataRepository.`);
        }
        this.#gameDataRepository = gameDataRepository;

        if (!promptOutputPort || typeof promptOutputPort.prompt !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing promptOutputPort (requires prompt method).`);
            throw new Error(`${className}: Invalid or missing promptOutputPort.`);
        }
        this.#promptOutputPort = promptOutputPort;

        if (!turnEndPort || typeof turnEndPort.notifyTurnEnded !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).`);
            throw new Error(`${className}: Invalid or missing turnEndPort.`);
        }
        this.#turnEndPort = turnEndPort;

        if (!commandInputPort || typeof commandInputPort.onCommand !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandInputPort (requires onCommand method).`);
            throw new Error(`${className}: Invalid or missing commandInputPort.`);
        }
        this.#commandInputPort = commandInputPort;

        if (!playerPromptService || typeof playerPromptService.prompt !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing playerPromptService (requires prompt method).`);
            throw new Error(`${className}: Invalid or missing playerPromptService.`);
        }
        this.#playerPromptService = playerPromptService;

        if (!commandOutcomeInterpreter || typeof commandOutcomeInterpreter.interpret !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method).`);
            throw new Error(`${className}: Invalid or missing commandOutcomeInterpreter.`);
        }
        this.#commandOutcomeInterpreter = commandOutcomeInterpreter;

        if (!safeEventDispatcher || typeof safeEventDispatcher.dispatchSafely !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely method).`);
            throw new Error(`${className}: Invalid or missing safeEventDispatcher.`);
        }
        this.#safeEventDispatcher = safeEventDispatcher;
        // --- End Dependency Validations ---

        this.#logger.debug(`${className} initialized successfully with all dependencies.`);
    }

    /**
     * Initiates the turn handling sequence for a player actor.
     * @param {Entity} actor - The player entity taking its turn.
     * @returns {Promise<void>} Resolves on successful initiation, rejects on critical error.
     * @throws {Error} If actor invalid, turn active, subscription/prompt fails.
     * @override
     */
    async startTurn(actor) {
        const actorId = actor?.id || 'UNKNOWN';
        const className = this.constructor.name;
        this.#logger.info(`${className}: Starting turn initiation for actor ${actorId}.`);

        // --- Initial validation checks ---
        if (!actor || !actor.id) {
            this.#logger.error(`${className}: Attempted to start turn for an invalid actor.`);
            throw new Error(`${className}: Actor must be a valid entity.`);
        }
        if (this.#currentActor) {
            const errorMsg = `${className}: Attempted to start a new turn for ${actor.id} while turn for ${this.#currentActor.id} is already in progress.`;
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        // --- End initial validation ---

        this.#currentActor = actor;

        try {
            // Subscribe to commands FIRST
            this.#_unsubscribeFromCommands();
            this.#logger.debug(`${className}: Subscribing to command input for actor ${actorId}...`);
            const commandHandler = this._handleSubmittedCommand.bind(this);
            this.#commandUnsubscribeFn = this.#commandInputPort.onCommand(commandHandler);
            if (!this.#commandUnsubscribeFn) {
                throw new Error('CommandInputPort.onCommand did not return a valid unsubscribe function.');
            }
            this.#logger.debug(`${className}: Command subscription successful for ${actorId}.`);

            // Initiate the turn by prompting the player.
            await this.#_promptPlayerForAction(actor);
            this.#logger.debug(`${className}: Initial prompt sequence initiated for ${actorId}. Waiting for command submission.`);

        } catch (initError) {
            this.#logger.error(`${className}: Critical error during turn initiation for ${actor.id}: ${initError.message}`, initError);
            // If prompt failed, _handleTurnEnd was already called. Avoid double call.
            const promptErrorMessageCheck = `${className}: PlayerPromptService threw an error during prompt`;
            if (!initError?.message?.includes(promptErrorMessageCheck)) {
                await this._handleTurnEnd(actorId, initError);
            }
            throw initError; // Re-throw so caller knows initiation failed.
        }
    }


    /**
     * Handles the command submitted by the player.
     * @protected
     * @param {string} commandString - The command string received.
     * @returns {Promise<void>}
     */
    async _handleSubmittedCommand(commandString) {
        const trimmedCommand = commandString?.trim();
        const className = this.constructor.name;

        this.#logger.debug(`${className}: Received submitted command via subscription: "${trimmedCommand}"`);

        const currentActorAtStart = this.#currentActor;
        if (!currentActorAtStart) {
            this.#logger.warn(`${className}: Received submitted command but no player turn is active. Ignoring.`);
            return;
        }
        const actorId = currentActorAtStart.id;

        // --- Handle Empty Command ---
        if (!trimmedCommand) {
            this.#logger.warn(`${className}: Received empty command string. Re-prompting actor ${actorId}.`);
            // #_promptPlayerForAction handles its own errors (logs, ends turn, re-throws)
            // Catch the re-thrown error here to prevent UnhandledPromiseRejectionWarning, but do nothing else.
            await this.#_promptPlayerForAction(currentActorAtStart).catch(error => {
                this.#logger.debug(`${className}: Caught re-thrown error from failed re-prompt in empty command case. Error: ${error.message}`);
            });
            return; // Finished handling empty command case.
        }

        // --- Process Valid Command ---
        this.#logger.info(`${className}: Handling command "${trimmedCommand}" for current actor ${actorId}.`);
        try {
            this.#_assertTurnActiveFor(actorId);
            await this.#_processValidatedCommand(currentActorAtStart, trimmedCommand);
        } catch (error) {
            // Check if the error originated from a handled prompt failure to avoid double logging/handling.
            const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;
            if (error?.message?.startsWith(promptErrorOriginCheck)) {
                this.#logger.debug(`${className}: Prompt error already handled by #_promptPlayerForAction. Ignoring in _handleSubmittedCommand catch block. Error: ${error.message}`);
            } else {
                // Handle *other* unexpected errors during processing
                this.#logger.error(`${className}: Unhandled error during command processing flow for ${actorId} command "${trimmedCommand}": ${error.message}`, error);
                if (!error.message.includes('Turn is not active') && this.#currentActor && this.#currentActor.id === actorId) {
                    this.#logger.warn(`${className}: Attempting fallback turn end due to unhandled error during command processing flow for ${actorId}.`);
                    await this._handleTurnEnd(actorId, error); // Signal failure
                }
            }
        }
    }

    /**
     * Processes a validated non-empty command.
     * @private
     * @param {Entity} actor - The actor performing the command.
     * @param {string} commandString - The validated command string.
     * @returns {Promise<void>}
     * @throws {Error} Propagates errors from assertions or failed re-prompts.
     */
    async #_processValidatedCommand(actor, commandString) {
        const actorId = actor.id;
        const className = this.constructor.name;
        let result = null;

        this.#_assertTurnActiveFor(actorId);
        this.#logger.debug(`${className}: Processing validated command "${commandString}" for ${actorId}.`);

        try {
            // Process Command
            this.#logger.info(`${className}: Delegating command "${commandString}" for ${actorId} to ICommandProcessor...`);
            result = await this.#commandProcessor.processCommand(actor, commandString);
            this.#_assertTurnActiveFor(actorId);
            this.#logger.info(`${className}: CommandProcessor raw result for ${actorId}: ${JSON.stringify(result)}`);

            // Interpret Outcome
            this.#logger.info(`${className}: Interpreting command outcome for ${actorId}...`);
            const directive = await this.#commandOutcomeInterpreter.interpret(result, actor.id);
            this.#_assertTurnActiveFor(actorId);
            this.#logger.info(`${className}: Received directive '${directive}' for actor ${actorId}.`);

            // Execute Directive
            this.#logger.debug(`${className}: Executing directive '${directive}' for actor ${actorId}.`);
            switch (directive) {
                case TurnDirective.END_TURN_SUCCESS:
                    await this._handleTurnEnd(actorId, null);
                    break;
                case TurnDirective.END_TURN_FAILURE:
                    const failureError = result?.error || new Error(`Command failed for ${actorId} with no specific error provided.`);
                    await this._handleTurnEnd(actorId, failureError);
                    break;
                case TurnDirective.RE_PROMPT:
                    this.#_assertTurnActiveFor(actorId);
                    await this.#_promptPlayerForAction(actor); // This now throws on prompt failure
                    break;
                default: // <<< UNKNOWN DIRECTIVE CASE >>>
                    this.#logger.error(`${className}: Received unknown directive '${directive}'. Forcing turn failure.`);
                    const unknownDirectiveError = new Error(`Received unexpected directive: ${directive}`);
                    // <<< FIX: Add correct payload to dispatchSafely >>>
                    await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                        message: `Handler received unknown directive '${directive}' for actor ${actorId}.`,
                        type: 'error',
                        details: unknownDirectiveError.message
                    });
                    // <<< END FIX >>>
                    await this._handleTurnEnd(actorId, unknownDirectiveError);
                    break;
            }
            this.#logger.debug(`${className}: Directive '${directive}' execution finished for ${actorId}.`);

        } catch (error) {
            // Catches assertion errors, processor/interpreter errors, or re-thrown prompt errors.
            if (error.message.includes('Turn is not active')) {
                this.#logger.warn(`${className}: Turn state changed during processing. Aborting. Error: ${error.message}`);
            } else {
                const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;
                if (error?.message?.startsWith(promptErrorOriginCheck)) {
                    this.#logger.debug(`${className}: Error from failed prompt handled by #_promptPlayerForAction. Propagating up from #_processValidatedCommand.`);
                    throw error; // Re-throw so _handleSubmittedCommand's catch can ignore it.
                } else {
                    // Handle other unexpected errors
                    this.#logger.error(`${className}: Error during command processing/interpretation for ${actorId} command "${commandString}": ${error.message}`, error);
                    await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                        message: `An internal error occurred while handling command or directive for ${actorId}.`,
                        type: 'error',
                        details: error.message // Pass the error message as details
                    });
                    this.#logger.info(`${className}: Signalling FAILED turn end due to processing/interpretation error.`);
                    await this._handleTurnEnd(actorId, error); // Signal failure
                }
            }
        }
    }


    /**
     * Delegates prompting to PlayerPromptService and handles errors.
     * @private
     * @param {Entity} actor - The player actor.
     * @returns {Promise<void>} Resolves on successful prompt.
     * @throws {Error} Throws if assertion fails or prompt service fails (after handling turn end).
     */
    async #_promptPlayerForAction(actor) {
        const className = this.constructor.name;
        const actorId = actor?.id || 'INVALID_ACTOR';

        this.#_assertTurnActiveFor(actorId);
        this.#logger.debug(`${className}: Delegating prompt logic for actor ${actorId} to PlayerPromptService.`);

        try {
            await this.#playerPromptService.prompt(actor);
            this.#logger.debug(`${className}: PlayerPromptService.prompt completed successfully.`);
        } catch (error) {
            const logMessage = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}: ${error.message}`;
            this.#logger.error(logMessage, error); // Log error details
            this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to prompt error.`);
            await this._handleTurnEnd(actorId, error); // End turn *before* throwing
            throw error; // Re-throw error after handling turn end
        }
    }


    /**
     * Handles the end of a player's turn.
     * @protected
     * @param {string} actorId - ID of the actor whose turn is ending.
     * @param {any} [error=null] - Error object if turn ended due to failure.
     * @returns {Promise<void>} Resolves when notification and cleanup are attempted.
     */
    async _handleTurnEnd(actorId, error = null) {
        const className = this.constructor.name;
        const isSuccess = (error === null || error === undefined);
        const endingStatus = isSuccess ? 'success' : 'failure';

        try {
            this.#_assertTurnActiveFor(actorId); // Check if turn is still active for this actor
        } catch (assertionError) {
            this.#logger.warn(`${className}: _handleTurnEnd called for ${actorId} (status: ${endingStatus}), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${assertionError.message}`);
            this.#_unsubscribeFromCommands(); // Attempt unsubscribe even if assertion fails
            return; // Exit early
        }

        this.#logger.info(`${className}: Ending turn for actor ${actorId} (status: ${endingStatus}).`);
        if (!isSuccess) {
            const reasonMsg = error instanceof Error ? error.message : String(error);
            this.#logger.warn(`${className}: Turn for ${actorId} ended with failure. Reason: ${reasonMsg}`);
        }

        this.#_unsubscribeFromCommands(); // Unsubscribe first

        try {
            this.#logger.debug(`Notifying TurnEndPort for actor ${actorId}, success=${isSuccess}.`);
            await this.#turnEndPort.notifyTurnEnded(actorId, isSuccess);
            this.#logger.debug(`TurnEndPort notified successfully for ${actorId}.`);
        } catch (notifyError) {
            this.#logger.error(`${className}: CRITICAL - Error notifying TurnEndPort: ${notifyError.message}. State might be inconsistent.`, notifyError);
        }

        this.#_cleanupTurnState(actorId); // Cleanup state last

        this.#logger.debug(`${className}: _handleTurnEnd sequence completed for ${actorId}.`);
    }

    /**
     * Asserts that the turn is active for the specified actor.
     * @private
     * @param {string} actorId - The actor ID to check.
     * @throws {Error} If the turn is not active for the specified actor.
     */
    #_assertTurnActiveFor(actorId) {
        const className = this.constructor.name;
        if (!this.#currentActor) {
            throw new Error(`${className}: Assertion Failed - Turn is not active. Expected actor '${actorId}' but no turn is in progress.`);
        }
        if (this.#currentActor.id !== actorId) {
            throw new Error(`${className}: Assertion Failed - Turn is not active for the correct actor. Expected '${actorId}' but current actor is '${this.#currentActor.id}'.`);
        }
    }

    /**
     * Unsubscribes from command input if currently subscribed.
     * @private
     */
    #_unsubscribeFromCommands() {
        const className = this.constructor.name;
        if (this.#commandUnsubscribeFn) {
            this.#logger.debug(`${className}: Unsubscribing from command input.`);
            try {
                this.#commandUnsubscribeFn();
            } catch (unsubError) {
                this.#logger.error(`${className}: Error calling command unsubscribe function: ${unsubError.message}`, unsubError);
            } finally {
                this.#commandUnsubscribeFn = null;
            }
        } else {
            this.#logger.debug(`${className}: No command unsubscribe function found or already unsubscribed.`);
        }
    }

    /**
     * Cleans up the active turn state if the actorId matches.
     * @private
     * @param {string} actorId - The ID of the actor whose state should potentially be cleared.
     */
    #_cleanupTurnState(actorId) {
        const className = this.constructor.name;
        if (this.#currentActor && this.#currentActor.id === actorId) {
            this.#logger.debug(`${className}: Cleaning up active turn state for actor ${actorId}.`);
            this.#currentActor = null;
            this.#logger.debug(`${className}: Active turn state reset for ${actorId}.`);
        } else if (this.#currentActor) {
            this.#logger.warn(`${className}: #_cleanupTurnState called for ${actorId}, but current actor is ${this.#currentActor.id}. No cleanup performed.`);
        } else {
            this.#logger.warn(`${className}: #_cleanupTurnState called for ${actorId}, but no actor was active. No cleanup performed.`);
        }
    }

    /**
     * Gracefully shuts down the handler.
     * @public
     * @override
     */
    destroy() {
        const handlerId = this.constructor.name;
        this.#logger.info(`${handlerId}: Destroying handler...`);
        const currentActor = this.#currentActor; // Capture before potential cleanup

        this.#_unsubscribeFromCommands(); // Always attempt unsubscribe

        if (currentActor) {
            const actorIdForLog = currentActor.id;
            this.#logger.warn(`${handlerId}: Destroying handler while turn for ${actorIdForLog} was active. Forcing turn end (failure).`);
            const destructionError = new Error(`${handlerId} destroyed during turn.`);

            // Call _handleTurnEnd without await (fire and forget cleanup)
            this._handleTurnEnd(actorIdForLog, destructionError)
                .catch(err => { // Catch potential errors from _handleTurnEnd itself
                    this.#logger.error(`${handlerId}: Error during forced _handleTurnEnd in destroy: ${err.message}`, err);
                    this.#_cleanupTurnState(actorIdForLog); // Ensure state is clear even if _handleTurnEnd failed
                });
        } else {
            this.#currentActor = null; // Ensure state is null if no turn was active
            this.#logger.debug(`${handlerId}: No active turn found during destruction. State cleared.`);
        }

        this.#logger.info(`${handlerId}: Destruction sequence initiated.`);
    }
}

export default PlayerTurnHandler;
// --- FILE END ---