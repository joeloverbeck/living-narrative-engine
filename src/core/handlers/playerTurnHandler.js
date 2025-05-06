// src/core/handlers/playerTurnHandler.js
// --- FILE START ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';
import { TURN_ENDED_ID } from '../constants/eventIds.js'; // <<< ADDED for turn end event

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
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
/** @typedef {import('../../types/eventTypes.js').SystemEventPayloads} SystemEventPayloads */


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
 * @description Handles the turn logic for player-controlled entities. (V3 - Event-driven turn completion with microtask fallback).
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

    // --- Fields for event-driven turn end ---
    /** @type {UnsubscribeFn | null} */
    #turnEndedSubscription = null;
    /** @type {boolean} */
    #isAwaitingTurnEndEvent = false;
    /** @type {string | null} */ // Store actorId whose turn_ended event we are waiting for
    #awaitingTurnEndForActorId = null;


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

        if (!safeEventDispatcher || typeof safeEventDispatcher.dispatchSafely !== 'function' || typeof safeEventDispatcher.subscribe !== 'function') { // Check for subscribe
            this.#logger.error(`${className} Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely and subscribe methods).`);
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

        // Clean up any potential lingering state from a previous, improperly ended turn/wait cycle.
        this.#clearTurnEndWaitingMechanisms();

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
            const promptErrorMessageCheck = `${className}: PlayerPromptService threw an error during prompt`;
            if (!initError?.message?.includes(promptErrorMessageCheck)) {
                this.#clearTurnEndWaitingMechanisms(); // Ensure cleanup on other init errors
                await this._handleTurnEnd(actorId, initError);
            }
            // If prompt failed, _handleTurnEnd was already called by #_promptPlayerForAction before re-throwing.
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
            await this.#_promptPlayerForAction(currentActorAtStart).catch(error => {
                this.#logger.debug(`${className}: Caught re-thrown error from failed re-prompt in empty command case. Error: ${error.message}`);
                // Turn is already ended by #_promptPlayerForAction if it failed
            });
            return; // Finished handling empty command case.
        }

        // --- Process Valid Command ---
        this.#logger.info(`${className}: Handling command "${trimmedCommand}" for current actor ${actorId}.`);
        try {
            this.#_assertTurnActiveFor(actorId);
            await this.#_processValidatedCommand(currentActorAtStart, trimmedCommand);
        } catch (error) {
            const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;
            if (error?.message?.startsWith(promptErrorOriginCheck)) {
                this.#logger.debug(`${className}: Prompt error already handled by #_promptPlayerForAction. Ignoring in _handleSubmittedCommand catch block. Error: ${error.message}`);
            } else if (error.message.includes('Turn is not active')) {
                this.#logger.warn(`${className}: Turn state changed during processing. Aborting processing of command "${trimmedCommand}". Error: ${error.message}`);
            } else {
                this.#logger.error(`${className}: Unhandled error during _handleSubmittedCommand flow for ${actorId} command "${trimmedCommand}": ${error.message}`, error);
                // Only end turn if it belongs to the current actor and we are NOT already in a waiting state
                // (as errors during waiting state are handled by its own logic or subsequent _handleTurnEnd calls)
                if (this.#currentActor && this.#currentActor.id === actorId && !this.#isAwaitingTurnEndEvent) {
                    this.#logger.warn(`${className}: Attempting fallback turn end due to unhandled error in _handleSubmittedCommand for ${actorId}.`);
                    await this._handleTurnEnd(actorId, error);
                } else if (this.#isAwaitingTurnEndEvent && this.#currentActor && this.#currentActor.id === actorId) {
                    this.#logger.warn(`${className}: Unhandled error occurred in _handleSubmittedCommand while _already_ awaiting turn:end event for ${actorId}. Turn will be ended with failure.`);
                    await this._handleTurnEnd(actorId, error); // This ensures turn ends even if error occurred at a higher level while waiting.
                }
            }
        }
    }

    /**
     * Processes a validated non-empty command, determines next steps (re-prompt, wait for turn:end, or end immediately on pre-dispatch failure).
     * @private
     * @param {Entity} actor - The actor performing the command.
     * @param {string} commandString - The validated command string.
     * @returns {Promise<void>}
     * @throws {Error} Propagates errors from assertions or failed re-prompts/system issues.
     */
    async #_processValidatedCommand(actor, commandString) {
        const actorId = actor.id;
        const className = this.constructor.name;
        let result = null;

        this.#_assertTurnActiveFor(actorId); // Assert at the beginning
        this.#logger.debug(`${className}: Processing validated command "${commandString}" for ${actorId}.`);

        // Crucial: Clear any prior waiting state if command processing restarts unexpectedly.
        this.#clearTurnEndWaitingMechanisms();

        try {
            this.#logger.info(`${className}: Delegating command "${commandString}" for ${actorId} to ICommandProcessor...`);
            result = await this.#commandProcessor.processCommand(actor, commandString);
            this.#_assertTurnActiveFor(actorId); // Re-assert turn active after async operation
            this.#logger.info(`${className}: CommandProcessor raw result for ${actorId}: ${JSON.stringify(result)}`);

            if (!result.success) {
                // Case 1: CommandProcessor itself failed (e.g., parse error, target resolution failed BEFORE action_attempt dispatch)
                this.#logger.warn(`${className}: CommandProcessor FAILED for "${commandString}" by ${actorId}. Error: ${result.error || 'N/A'}. Ending turn with failure.`);
                const failureError = result.error ? new Error(result.error) : new Error(`Command processing failed for ${commandString}.`);
                // if (result.internalError) { failureError.internalMessage = result.internalError; } // Optional
                await this._handleTurnEnd(actorId, failureError);
                return; // Early exit, turn ended.
            }

            // Case 2: CommandProcessor SUCCEEDED (core:action_attempt was dispatched successfully)
            this.#logger.info(`${className}: CommandProcessor SUCCEEDED for "${commandString}" by ${actorId}. Interpreting outcome...`);
            const directive = await this.#commandOutcomeInterpreter.interpret(result, actor.id);
            this.#_assertTurnActiveFor(actorId); // Re-assert, interpreter might be async
            this.#logger.info(`${className}: Received directive '${directive}' for actor ${actorId} after successful command processing.`);

            switch (directive) {
                case TurnDirective.RE_PROMPT:
                    this.#logger.info(`${className}: Directive is RE_PROMPT for ${actorId}. Re-prompting.`);
                    await this.#_promptPlayerForAction(actor); // Throws on prompt failure, caught by caller. Turn ends inside #_promptPlayerForAction on its error.
                    break;

                case TurnDirective.END_TURN_SUCCESS:
                case TurnDirective.END_TURN_FAILURE: // *Even if* interpreter says end, for a successfully DISPATCHED command, we now wait for rule or fallback.
                    this.#logger.info(`<span class="math-inline">\{className\}\: Directive is '</span>{directive}' for <span class="math-inline">\{actorId\}\. Waiting for '</span>{TURN_ENDED_ID}' event.`); // Updated log
                    await this.#waitForTurnEndEvent(actor); // <<< UPDATED Call
                    break;

                default: // UNKNOWN DIRECTIVE
                    this.#logger.error(`${className}: Received unknown directive '${directive}' for actor ${actorId} after successful command. Forcing turn failure.`);
                    const unknownDirectiveError = new Error(`Received unexpected directive: ${directive}`);
                    await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                        eventName: 'core:system_error_occurred',
                        message: `Handler received unknown directive '${directive}' for actor ${actorId}.`,
                        type: 'error',
                        details: unknownDirectiveError.message
                    });
                    await this._handleTurnEnd(actorId, unknownDirectiveError);
                    break;
            }

        } catch (error) { // Catches errors from _assertTurnActiveFor, interpreter, #_promptPlayerForAction, or #waitForTurnEndEventOrFallback setup.
            if (error.message.includes('Turn is not active')) {
                this.#logger.warn(`${className}: Turn state changed during processing of command "${commandString}". Aborting. Error: ${error.message}`);
            } else {
                const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;
                if (error?.message?.startsWith(promptErrorOriginCheck)) {
                    this.#logger.debug(`${className}: Error from failed prompt handled by #_promptPlayerForAction. Propagating up from #_processValidatedCommand for command "${commandString}".`);
                    throw error; // Re-throw so _handleSubmittedCommand's catch can ignore it if needed (turn already ended).
                } else {
                    this.#logger.error(`${className}: Error during #_processValidatedCommand flow for ${actorId} command "${commandString}": ${error.message}`, error);
                    await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                        eventName: 'core:system_error_occurred',
                        message: `An internal error occurred while handling command or directive for ${actorId}.`,
                        type: 'error',
                        details: error.message
                    });

                    // If an error occurs here, and we weren't already waiting, end the turn.
                    // If we were trying to set up the wait, #waitForTurnEndEventOrFallback's error handling should also end the turn.
                    if (this.#currentActor?.id === actorId && !this.#isAwaitingTurnEndEvent) {
                        this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to error in #_processValidatedCommand for "${commandString}".`);
                        await this._handleTurnEnd(actorId, error);
                    } else if (this.#currentActor?.id === actorId && this.#isAwaitingTurnEndEvent) {
                        this.#logger.info(`${className}: Error occurred in #_processValidatedCommand while _already_ awaiting turn end or during setup for ${actorId}. Turn will be ended with failure.`);
                        await this._handleTurnEnd(actorId, error); // Ensure turn ends.
                    }
                }
            }
        }
    }


    /**
     * Sets up subscription for `core:turn_ended` event.
     * The turn will ONLY end if this event is received for the current actor.
     * @private
     * @param {Entity} actor - The actor whose turn end is being awaited.
     * @returns {Promise<void>} Resolves if the subscription is set up, rejects if subscription fails immediately.
     */
    async #waitForTurnEndEvent(actor) { // <<< RENAMED for clarity (optional)
        const actorId = actor.id;
        const className = this.constructor.name;

        if (this.#isAwaitingTurnEndEvent) {
            this.#logger.warn(`${className}: #waitForTurnEndEvent called for ${actorId} while already awaiting. Clearing previous wait mechanisms first.`);
            this.#clearTurnEndWaitingMechanisms(); // Should be idempotent.
        }

        this.#isAwaitingTurnEndEvent = true;
        this.#awaitingTurnEndForActorId = actorId;

        this.#logger.debug(`${className}: Subscribing to '${TURN_ENDED_ID}' for actor ${actorId} and waiting.`);

        /** @param {SystemEventPayloads[typeof TURN_ENDED_ID]} payload */
        const turnEndedListener = (payload) => {
            // Check if we are still waiting AND if the event is for the correct actor.
            if (this.#isAwaitingTurnEndEvent && payload.entityId === this.#awaitingTurnEndForActorId) {
                this.#logger.info(`${className}: Received target '${TURN_ENDED_ID}' event for current actor ${this.#awaitingTurnEndForActorId}. Success: ${payload.success}.`);
                // _handleTurnEnd calls #clearTurnEndWaitingMechanisms which handles cleanup.
                const errorForTurnEnd = payload.success ? null : new Error(`Turn explicitly ended by rule with failure status for actor ${this.#awaitingTurnEndForActorId}.`);
                this._handleTurnEnd(this.#awaitingTurnEndForActorId, errorForTurnEnd)
                    .catch(err => this.#logger.error(`${className}: Error in _handleTurnEnd after receiving '${TURN_ENDED_ID}' event: ${err.message}`, err));
            } else if (this.#isAwaitingTurnEndEvent) { // Still awaiting, but event is for someone else
                this.#logger.debug(`${className}: Received '${TURN_ENDED_ID}' for ${payload.entityId} while waiting for ${this.#awaitingTurnEndForActorId}. Ignoring this event.`);
            }
            // If !this.#isAwaitingTurnEndEvent, the turn was already handled (e.g. by a previous event or an error).
        };

        // Attempt to subscribe
        this.#turnEndedSubscription = this.#safeEventDispatcher.subscribe(TURN_ENDED_ID, turnEndedListener);

        // Handle immediate subscription failure
        if (!this.#turnEndedSubscription) {
            this.#logger.error(`${className}: Failed to subscribe to '${TURN_ENDED_ID}' via SafeEventDispatcher for actor ${actorId}. Ending turn with failure.`);
            // Cleanup flags directly as _handleTurnEnd might not be appropriate if subscription itself failed.
            this.#isAwaitingTurnEndEvent = false; // Manually reset flags
            this.#awaitingTurnEndForActorId = null;
            // Call _handleTurnEnd directly ONLY if subscription fails, otherwise wait for event.
            await this._handleTurnEnd(actorId, new Error("Internal error: Failed to set up turn end event listener."));
            // Note: No return here needed now as _handleTurnEnd is awaited.
        }

    }


    /**
     * Delegates prompting to PlayerPromptService and handles errors by ending the turn.
     * @private
     * @param {Entity} actor - The player actor.
     * @returns {Promise<void>} Resolves on successful prompt.
     * @throws {Error} Throws if assertion fails or prompt service fails (after attempting to handle turn end).
     */
    async #_promptPlayerForAction(actor) {
        const className = this.constructor.name;
        const actorId = actor?.id || 'INVALID_ACTOR';

        this.#_assertTurnActiveFor(actorId); // Assert before prompt
        this.#logger.debug(`${className}: Delegating prompt logic for actor ${actorId} to PlayerPromptService.`);

        try {
            await this.#playerPromptService.prompt(actor);
            this.#logger.debug(`${className}: PlayerPromptService.prompt completed successfully for actor ${actorId}.`);
        } catch (error) {
            const logMessage = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}: ${error.message}`;
            this.#logger.error(logMessage, error); // Log error details
            this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to prompt error.`);
            // It's crucial that turn end handling (including cleanup of waiting mechanisms) happens *before* re-throwing.
            await this._handleTurnEnd(actorId, error); // Ends turn. _handleTurnEnd will call #clearTurnEndWaitingMechanisms.
            throw error; // Re-throw error AFTER handling turn end, so caller (e.g., startTurn or command handler) knows.
        }
    }


    /**
     * Handles the end of a player's turn. Cleans subscriptions, notifies port, resets state.
     * @protected
     * @param {string} actorId - ID of the actor whose turn is ending.
     * @param {any} [error=null] - Error object if turn ended due to failure.
     * @returns {Promise<void>} Resolves when notification and cleanup are attempted.
     */
    async _handleTurnEnd(actorId, error = null) {
        const className = this.constructor.name;
        const isSuccess = (error === null || error === undefined);
        const endingStatus = isSuccess ? 'success' : 'failure';

        // Check if currentActor is set and matches actorId. If not, this turn end is likely stale or for a different context.
        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}: _handleTurnEnd called for ${actorId} (status: ${endingStatus}), but current actor is ${this.#currentActor?.id || 'null'} or does not match. Turn may have already ended or belongs to different handler context. Attempting cleanup for waiting mechanisms if ${actorId} was the one being awaited.`);
            // If we were specifically WAITING for this actorId, clean up those mechanisms.
            if (this.#awaitingTurnEndForActorId === actorId) {
                this.#clearTurnEndWaitingMechanisms();
            }
            // Also attempt to clear command subscription if active, as it might be stale.
            this.#_unsubscribeFromCommands();
            return; // Exit early, no further processing for this actorId if it's not the current one.
        }

        // At this point, this.#currentActor.id === actorId
        this.#logger.info(`${className}: Ending turn for actor ${actorId} (status: ${endingStatus}).`);
        if (!isSuccess) {
            const reasonMsg = error instanceof Error ? error.message : String(error);
            this.#logger.warn(`${className}: Turn for ${actorId} ended with failure. Reason: ${reasonMsg}`);
        }

        // CRITICAL: Clear all related subscriptions and waiting state flags FIRST.
        // This prevents race conditions or re-entrant calls.
        this.#clearTurnEndWaitingMechanisms(); // Handles turn_ended event subscription and flags.
        this.#_unsubscribeFromCommands();     // Handles command input subscription.

        try {
            this.#logger.debug(`Notifying TurnEndPort for actor ${actorId}, success=${isSuccess}.`);
            await this.#turnEndPort.notifyTurnEnded(actorId, isSuccess);
            this.#logger.debug(`TurnEndPort notified successfully for ${actorId}.`);
        } catch (notifyError) {
            this.#logger.error(`${className}: CRITICAL - Error notifying TurnEndPort for ${actorId}: ${notifyError.message}. State might be inconsistent.`, notifyError);
        }

        // LASTLY, clean up the primary turn state (this.#currentActor).
        this.#_cleanupTurnState(actorId);

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
            this.#logger.debug(`${className}: Unsubscribing from command input for actor ${this.#currentActor?.id || this.#awaitingTurnEndForActorId || 'N/A'}.`);
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
            this.#logger.warn(`${className}: #_cleanupTurnState called for ${actorId}, but current actor is ${this.#currentActor.id}. No primary actor state cleanup performed for ${actorId}.`);
        } else {
            this.#logger.warn(`${className}: #_cleanupTurnState called for ${actorId}, but no actor was active. No primary actor state cleanup performed.`);
        }
    }

    /**
     * Clears all mechanisms related to waiting for a turn:end event.
     * This includes unsubscribing from the event and resetting flags.
     * Should be idempotent.
     * @private
     */
    #clearTurnEndWaitingMechanisms() {
        const className = this.constructor.name;
        const actorContext = this.#awaitingTurnEndForActorId || (this.#currentActor ? this.#currentActor.id : 'N/A (no specific await)');
        if (this.#isAwaitingTurnEndEvent || this.#turnEndedSubscription) { // Log only if there's something to clear
            this.#logger.debug(`${className}: Clearing turn end waiting mechanisms for actor context '${actorContext}'. (Subscription: ${!!this.#turnEndedSubscription}, AwaitingFlag: ${this.#isAwaitingTurnEndEvent})`);
        }

        if (this.#turnEndedSubscription) {
            try {
                this.#turnEndedSubscription();
            } catch (unsubError) {
                this.#logger.error(`${className}: Error calling turn_ended event unsubscribe function during clear: ${unsubError.message}`, unsubError);
            }
            this.#turnEndedSubscription = null;
        }
        this.#isAwaitingTurnEndEvent = false;
        this.#awaitingTurnEndForActorId = null;
    }

    /**
     * Gracefully shuts down the handler.
     * @public
     * @override
     */
    destroy() {
        const className = this.constructor.name;
        this.#logger.info(`${className}: Destroying handler...`);
        const actorIdForCleanup = this.#currentActor?.id || this.#awaitingTurnEndForActorId;

        // Clear all subscriptions and waiting states first.
        this.#clearTurnEndWaitingMechanisms();
        this.#_unsubscribeFromCommands();

        if (actorIdForCleanup) {
            // If there was a currentActor or we were awaiting for someone, attempt a "forced" turn end
            this.#logger.warn(`${className}: Destroying handler. If turn for ${actorIdForCleanup} was active or awaited, forcing turn end (failure).`);
            const destructionError = new Error(`${className} destroyed during turn or while awaiting turn end.`);

            // Call _handleTurnEnd without await (fire and forget cleanup)
            // It will re-verify actor an handle state internally.
            this._handleTurnEnd(actorIdForCleanup, destructionError)
                .catch(err => {
                    this.#logger.error(`${className}: Error during forced _handleTurnEnd in destroy for ${actorIdForCleanup}: ${err.message}`, err);
                    // Fallback cleanup of currentActor if _handleTurnEnd somehow failed or didn't run for it.
                    if (this.#currentActor && this.#currentActor.id === actorIdForCleanup) {
                        this.#_cleanupTurnState(actorIdForCleanup);
                    }
                });
        } else {
            // Ensure currentActor is null if no specific actor context for cleanup.
            if (this.#currentActor) { // Should be null if actorIdForCleanup was null, but for safety.
                this.#_cleanupTurnState(this.#currentActor.id); // This will set #currentActor to null
            } else {
                this.#currentActor = null; // Explicitly ensure it.
            }
            this.#logger.debug(`${className}: No active turn or await context found during destruction. State cleared.`);
        }

        this.#logger.info(`${className}: Destruction sequence for handler initiated.`);
    }
}

export default PlayerTurnHandler;
// --- FILE END ---