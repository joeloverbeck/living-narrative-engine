// src/core/handlers/playerTurnHandler.js
// --- FILE START ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';
import {TURN_ENDED_ID} from '../constants/eventIds.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {{ command: string }} CommandSubmitEventData */
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */
/** @typedef {import('../../actions/actionTypes.js').ActionDefinitionMinimal} ActionDefinitionMinimal */
/** @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../ports/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../ports/commonTypes.js').UnsubscribeFn} UnsubscribeFn */
/** @typedef {import('../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */


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
 * @description Handles the turn logic for player-controlled entities.
 */
class PlayerTurnHandler extends ITurnHandler {
    // --- Private Fields ---
    /** @type {ILogger} */
    #logger;
    /** @type {ICommandProcessor} */
    #commandProcessor;
    /** @type {IWorldContext} */
    #worldContext;
    /** @type {IEntityManager} */
    #entityManager;
    /** @type {IGameDataRepository} */
    #gameDataRepository;
    /** @type {IPromptOutputPort} */
    #promptOutputPort;
    /** @type {ITurnEndPort} */
    #turnEndPort;
    /** @type {ICommandInputPort} */
    #commandInputPort; // Still needed for SubscriptionLifecycleManager if passed through here
    /** @type {IPlayerPromptService} */
    #playerPromptService;
    /** @type {ICommandOutcomeInterpreter} */
    #commandOutcomeInterpreter;
    /** @type {ISafeEventDispatcher} */
    #safeEventDispatcher; // Still needed for SubscriptionLifecycleManager if passed through here
    /** @type {SubscriptionLifecycleManager} */
    #subscriptionManager;
    /** @type {Entity | null} */
    #currentActor = null;

    // --- Fields for event-driven turn end ---
    /** @type {boolean} */
    #isAwaitingTurnEndEvent = false;
    /** @type {string | null} */
    #awaitingTurnEndForActorId = null;
    /** @type {boolean} */
    #isDestroyed = false; // Flag for idempotency
    #isTerminatingNormally = false; // New flag


    /**
     * Creates an instance of PlayerTurnHandler.
     * @param {object} dependencies - Dependencies.
     * @param {ILogger} dependencies.logger
     * @param {ICommandProcessor} dependencies.commandProcessor
     * @param {IWorldContext} dependencies.worldContext
     * @param {IEntityManager} dependencies.entityManager
     * @param {IGameDataRepository} dependencies.gameDataRepository
     * @param {IPromptOutputPort} dependencies.promptOutputPort
     * @param {ITurnEndPort} dependencies.turnEndPort
     * @param {ICommandInputPort} dependencies.commandInputPort
     * @param {IPlayerPromptService} dependencies.playerPromptService
     * @param {ICommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter
     * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
     * @param {SubscriptionLifecycleManager} dependencies.subscriptionLifecycleManager // <<< ADDED
     */
    constructor({
                    logger,
                    commandProcessor,
                    worldContext,
                    entityManager,
                    gameDataRepository,
                    promptOutputPort,
                    turnEndPort,
                    commandInputPort, // Kept, as SubscriptionLifecycleManager might need it (though it resolves its own)
                    playerPromptService,
                    commandOutcomeInterpreter,
                    safeEventDispatcher, // Kept, as SubscriptionLifecycleManager might need it (though it resolves its own)
                    subscriptionLifecycleManager, // <<< ADDED
                }) {
        super();
        const className = this.constructor.name;

        if (!logger || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            console.error(`${className} Constructor: Invalid or missing logger dependency (must include error and debug methods).`);
            throw new Error(`${className}: Invalid or missing logger dependency.`);
        }
        this.#logger = logger;

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
            this.#logger.error(`${className} Constructor: Invalid or missing entityManager (requires getEntityInstance method from IEntityManager).`);
            throw new Error(`${className}: Invalid or missing entityManager.`);
        }
        this.#entityManager = entityManager;

        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing gameDataRepository (requires getActionDefinition method from IGameDataRepository).`);
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

        // These are direct dependencies for PlayerTurnHandler itself, even if SubscriptionLifecycleManager also uses them.
        if (!commandInputPort || typeof commandInputPort.onCommand !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandInputPort (requires onCommand method).`);
            throw new Error(`${className}: Invalid or missing commandInputPort.`);
        }
        this.#commandInputPort = commandInputPort;

        if (!playerPromptService || typeof playerPromptService.prompt !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing playerPromptService (requires prompt method from IPlayerPromptService).`);
            throw new Error(`${className}: Invalid or missing playerPromptService.`);
        }
        this.#playerPromptService = playerPromptService;

        if (!commandOutcomeInterpreter || typeof commandOutcomeInterpreter.interpret !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method from ICommandOutcomeInterpreter).`);
            throw new Error(`${className}: Invalid or missing commandOutcomeInterpreter.`);
        }
        this.#commandOutcomeInterpreter = commandOutcomeInterpreter;

        if (!safeEventDispatcher || typeof safeEventDispatcher.dispatchSafely !== 'function' || typeof safeEventDispatcher.subscribe !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely and subscribe methods).`);
            throw new Error(`${className}: Invalid or missing safeEventDispatcher.`);
        }
        this.#safeEventDispatcher = safeEventDispatcher;

        // Validate and assign injected SubscriptionLifecycleManager
        if (!subscriptionLifecycleManager || typeof subscriptionLifecycleManager.subscribeToCommandInput !== 'function' || typeof subscriptionLifecycleManager.unsubscribeAll !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing subscriptionLifecycleManager dependency.`);
            throw new Error(`${className}: Invalid or missing subscriptionLifecycleManager dependency.`);
        }
        this.#subscriptionManager = subscriptionLifecycleManager;

        this.#logger.debug(`${className} initialized successfully with all dependencies, including injected SubscriptionLifecycleManager.`);
    }

    /**
     * Resets all turn-related state and cleans up resources, primarily subscriptions.
     * This method is intended to be called at the end of a turn or when the handler is destroyed.
     * @private
     * @param {string} actorIdContextForLog - The actor ID for logging context, defaults to 'N/A'.
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        const className = this.constructor.name;
        this.#logger.debug(`${className}._resetTurnStateAndResources: Starting full state reset for actor context '${actorIdContextForLog}'.`);

        // 1. Subscription Cleanup
        this.#logger.debug(`${className}._resetTurnStateAndResources: Calling unsubscribeAll via SubscriptionLifecycleManager for actor context '${actorIdContextForLog}'.`);
        this.#subscriptionManager.unsubscribeAll();

        // 2. State Flag Resets
        this.#logger.debug(`${className}._resetTurnStateAndResources: Resetting internal state flags for actor context '${actorIdContextForLog}': #currentActor (was ${this.#currentActor?.id || 'null'}), #isAwaitingTurnEndEvent (was ${this.#isAwaitingTurnEndEvent}), #awaitingTurnEndForActorId (was ${this.#awaitingTurnEndForActorId || 'null'}), #isTerminatingNormally (was ${this.#isTerminatingNormally}).`);
        this.#currentActor = null;
        this.#isAwaitingTurnEndEvent = false;
        this.#awaitingTurnEndForActorId = null;
        this.#isTerminatingNormally = false; // Reset for destroy and after turn completion

        this.#logger.debug(`${className}._resetTurnStateAndResources: Full state reset completed for actor context '${actorIdContextForLog}'.`);
    }


    async startTurn(actor) {
        const actorId = actor?.id || 'UNKNOWN';
        const className = this.constructor.name;
        this.#logger.info(`${className}: Starting turn initiation for actor ${actorId}.`);
        this.#isDestroyed = false;
        this.#isTerminatingNormally = false;

        if (!actor || !actor.id) {
            this.#logger.error(`${className}: Attempted to start turn for an invalid or null actor.`);
            throw new Error(`${className}: Actor must be a valid entity.`);
        }
        if (this.#currentActor) {
            const errorMsg = `${className}: Attempted to start a new turn for ${actor.id} while turn for ${this.#currentActor.id} is already in progress.`;
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.#clearTurnEndWaitingMechanisms();
        this.#currentActor = actor;

        try {
            this.#subscriptionManager.unsubscribeFromCommandInput(); // Safeguard

            this.#logger.debug(`${className}: Attempting to subscribe to command input for actor ${actorId}.`);
            const commandHandler = this._handleSubmittedCommand.bind(this);
            const commandSubscribed = this.#subscriptionManager.subscribeToCommandInput(commandHandler);

            if (!commandSubscribed) {
                throw new Error('Failed to subscribe to command input via SubscriptionLifecycleManager.');
            }
            this.#logger.debug(`${className}: Command input subscription successful for actor ${actorId}.`);

            await this._promptPlayerForAction(actor);
            this.#logger.debug(`${className}: Initial prompt sequence initiated for ${actorId}.`);

        } catch (initError) {
            this.#logger.error(`${className}: Critical error during turn initiation for ${actor.id}: ${initError.message}`, initError);
            const promptErrorMessageCheck = `${className}: PlayerPromptService threw an error during prompt`;

            if (!initError?.message?.includes(promptErrorMessageCheck)) {
                this.#logger.info(`${className}: Error during turn initiation for ${actor.id} (not from PlayerPromptService). Proceeding to handle turn end.`);
                if (this.#currentActor && this.#currentActor.id === actor.id) {
                    await this._handleTurnEnd(actor.id, initError);
                } else {
                    this.#logger.warn(`${className}: In startTurn catch for ${actor.id}, current actor is ${this.#currentActor?.id || 'none'}. Turn end not invoked by startTurn. Performing minimal cleanup.`);
                    this._resetTurnStateAndResources(actor.id || 'startTurn_initError_noCurrentActor');
                }
            } else {
                this.#logger.debug(`${className}: Error during turn initiation for ${actor.id} (from PlayerPromptService). _handleTurnEnd already called by _promptPlayerForAction.`);
            }
            throw initError;
        }
    }

    async _handleEmptyCommand(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.warn(`${className}: Received empty command from actor ${actorId}. Re-prompting.`);

        if (this.#currentActor && this.#currentActor.id === actorId) {
            try {
                await this._promptPlayerForAction(actor);
                if (!this.#_isTurnValidForActor(actorId)) { // Check actor validity *after* the prompt
                    this.#logger.warn(`${className}: _handleEmptyCommand: Aborting operation for actor ${actorId}. Turn became invalid after re-prompt attempt.`);
                    // #_isTurnValidForActor logs specific reason
                }
            } catch (error) {
                this.#logger.debug(`${className}: _handleEmptyCommand: Error during re-prompt for actor ${actorId} (caught). Turn should have been ended by _promptPlayerForAction. Error: ${error.message}`);
            }
        } else {
            this.#logger.warn(`${className}: _handleEmptyCommand: Skipping re-prompt for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }


    async _handleSubmittedCommand(commandString) {
        const className = this.constructor.name;
        const currentActorAtStart = this.#currentActor;

        if (!currentActorAtStart) {
            this.#logger.warn(`${className}: Ignoring submitted command: no player turn is active.`);
            return;
        }
        const actorId = currentActorAtStart.id;

        const trimmedCommand = commandString?.trim();
        this.#logger.debug(`${className}: Received command from actor ${actorId}: "${commandString}" (trimmed: "${trimmedCommand}")`);

        if (!trimmedCommand) {
            await this._handleEmptyCommand(currentActorAtStart);
            return;
        }

        this.#logger.info(`${className}: Handling command "${trimmedCommand}" for current actor ${actorId}.`);
        try {
            this.#_assertTurnActiveFor(actorId);
            await this.#_processValidatedCommand(currentActorAtStart, trimmedCommand);
        } catch (error) {
            const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;

            if (error?.message?.startsWith(promptErrorOriginCheck)) {
                this.#logger.debug(`${className}: _handleSubmittedCommand: Re-thrown prompt error for ${actorId} caught. Lower-level handler should have finalized turn. Error: ${error.message}`);
            } else if (error?.message?.includes('Assertion Failed - Turn is not active')) {
                this.#logger.warn(`${className}: _handleSubmittedCommand: Turn state assertion failed for command "${trimmedCommand}" by actor ${actorId}. Error: ${error.message}`);
            } else {
                this.#logger.error(`${className}: _handleSubmittedCommand: Unexpected error for actor ${actorId} (command: "${trimmedCommand}"): ${error.message}`, error);
                if (this.#currentActor && this.#currentActor.id === actorId) {
                    this.#logger.warn(`${className}: _handleSubmittedCommand: Attempting fallback turn end for ${actorId} due to unexpected error. Awaiting event: ${this.#isAwaitingTurnEndEvent}.`);
                    await this._handleTurnEnd(actorId, error);
                } else {
                    this.#logger.warn(`${className}: _handleSubmittedCommand: Unexpected error for command "${trimmedCommand}" (intended for ${actorId}). Current actor is ${this.#currentActor?.id || 'none'}. Skipping fallback turn end.`);
                }
            }
        }
    }

    async _handleCommandProcessorSuccess(actor, cmdProcResult, commandString) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.debug(`${className}: _handleCommandProcessorSuccess for actor ${actorId}, command "${commandString}". Result: ${JSON.stringify(cmdProcResult)}`);
        this.#logger.info(`${className}: CommandProcessor SUCCEEDED for "${commandString}" by ${actorId}. Event 'core:attempt_action' dispatched.`);

        if (!this.#_isTurnValidForActor(actorId)) {
            this.#logger.info(`${className}: _handleCommandProcessorSuccess: Turn for ${actorId} concluded by external rules after command success. Aborting further handler processing.`);
            return;
        }

        let directiveFromInterpreter = null;
        if (this.#commandOutcomeInterpreter) {
            this.#logger.info(`${className}: Interpreting successful command outcome for actor ${actorId}.`);
            directiveFromInterpreter = await this.#commandOutcomeInterpreter.interpret(cmdProcResult, actor.id);

            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: _handleCommandProcessorSuccess: Turn for ${actorId} became invalid after CommandOutcomeInterpreter. Aborting further handler processing.`);
                return;
            }
            this.#logger.info(`${className}: CommandOutcomeInterpreter for ${actorId} returned directive: '${directiveFromInterpreter}'.`);
        } else {
            this.#logger.warn(`${className}: _handleCommandProcessorSuccess: No CommandOutcomeInterpreter for actor ${actorId}. Assuming default: wait for turn end event.`);
        }

        if (directiveFromInterpreter && !Object.values(TurnDirective).includes(directiveFromInterpreter)) {
            const unknownDirectiveError = new Error(`Received unexpected directive: ${directiveFromInterpreter}`);
            this.#logger.error(`${className}: _handleCommandProcessorSuccess: Unknown directive '${directiveFromInterpreter}' for actor ${actorId}. Forcing turn failure.`);
            await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
                message: `Handler received unknown directive '${directiveFromInterpreter}' for actor ${actorId}.`,
                type: 'error',
                details: unknownDirectiveError.message
            });
            if (this.#currentActor && this.#currentActor.id === actorId) {
                await this._handleTurnEnd(actorId, unknownDirectiveError);
            }
            return;
        }

        if (directiveFromInterpreter === TurnDirective.RE_PROMPT) {
            this.#logger.info(`${className}: Directive RE_PROMPT for ${actorId}. Executing re-prompt strategy.`);
            await this._executeRepromptStrategy(actor);
        } else if (directiveFromInterpreter === TurnDirective.END_TURN_SUCCESS) {
            await this._executeEndTurnSuccessStrategy(actor);
        } else if (directiveFromInterpreter === TurnDirective.END_TURN_FAILURE) {
            this.#logger.info(`${className}: Directive END_TURN_FAILURE for ${actorId} (post-success). Executing end turn failure strategy.`);
            const errorForStrategy = new Error("Turn ended by interpreter directive END_TURN_FAILURE after successful command processing.");
            await this._executeEndTurnFailureStrategy(actor, errorForStrategy, TurnDirective.END_TURN_FAILURE, commandString);
        } else {
            await this._executeWaitForTurnEndEventStrategy(actor);
        }
    }

    async _handleCommandProcessorFailure(actor, cmdProcResult, commandString) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.warn(`${className}: CommandProcessor FAILED for "${commandString}" by ${actorId}. Error: ${cmdProcResult.error || 'N/A'}.`);
        const failureError = cmdProcResult.error ? (cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(String(cmdProcResult.error))) : new Error(`Command processing failed for "${commandString}".`);

        if (cmdProcResult.turnEnded === true) {
            this.#logger.info(`${className}: CommandProcessor indicated turn has ended for ${actorId} post-failure. Bypassing interpreter.`);
            if (this.#currentActor && this.#currentActor.id === actorId) {
                await this._handleTurnEnd(actorId, failureError);
            } // Else: actor mismatch, _handleTurnEnd would log/handle it if called.
        } else {
            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: _handleCommandProcessorFailure: Turn for ${actorId} became invalid before CommandOutcomeInterpreter. Aborting further handler processing.`);
                return;
            }

            this.#logger.info(`${className}: Interpreting FAILED command outcome for "${commandString}" by ${actorId}.`);
            const directiveForFailure = await this.#commandOutcomeInterpreter.interpret(cmdProcResult, actor.id);

            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: _handleCommandProcessorFailure: Turn for ${actorId} became invalid after CommandOutcomeInterpreter. Aborting further handler processing.`);
                return;
            }
            this.#logger.info(`${className}: Directive for CommandProcessor failure for ${actorId}: '${directiveForFailure}'.`);

            switch (directiveForFailure) {
                case TurnDirective.RE_PROMPT:
                    await this._executeRepromptStrategy(actor);
                    break;
                case TurnDirective.END_TURN_FAILURE:
                default:
                    await this._executeEndTurnFailureStrategy(actor, cmdProcResult.error, directiveForFailure, commandString);
                    break;
            }
        }
    }

    async _executeRepromptStrategy(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Executing RE_PROMPT strategy for ${actorId}.`);

        if (this.#currentActor && this.#currentActor.id === actorId) {
            try {
                await this._promptPlayerForAction(actor);
                if (!this.#_isTurnValidForActor(actorId)) { // Check actor validity *after* the prompt
                    this.#logger.warn(`${className}: _executeRepromptStrategy: Actor ${actorId} no longer valid after re-prompt attempt. Aborting operation.`);
                }
            } catch (promptError) {
                this.#logger.debug(`${className}: _executeRepromptStrategy: Re-throwing error from _promptPlayerForAction for ${actorId}. Error: ${promptError.message}`);
                throw promptError;
            }
        } else {
            this.#logger.warn(`${className}: _executeRepromptStrategy: Skipping re-prompt for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }

    async _executeEndTurnFailureStrategy(actor, initialErrorOrInfo, directive, commandString) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Executing END_TURN_FAILURE strategy for ${actorId} (directive: '${directive}').`);

        let turnEndError;
        if (initialErrorOrInfo instanceof Error) {
            turnEndError = initialErrorOrInfo;
        } else if (initialErrorOrInfo) {
            turnEndError = new Error(String(initialErrorOrInfo));
        } else {
            turnEndError = new Error(`Turn ended by CommandOutcomeInterpreter directive '${directive}' for command "${commandString}".`);
        }

        if (this.#currentActor && this.#currentActor.id === actorId) {
            this.#logger.warn(`${className}: Ending turn with failure for ${actorId} via strategy. Reason: ${turnEndError.message}`);
            await this._handleTurnEnd(actorId, turnEndError);
        } else {
            this.#logger.warn(`${className}: _executeEndTurnFailureStrategy: Skipping turn end for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }

    async _executeEndTurnSuccessStrategy(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Directive END_TURN_SUCCESS for ${actorId}. Ending turn successfully.`);
        if (this.#currentActor && this.#currentActor.id === actorId) {
            await this._handleTurnEnd(actorId, null);
        } else {
            this.#logger.warn(`${className}: _executeEndTurnSuccessStrategy: Skipping turn end for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }

    async _executeWaitForTurnEndEventStrategy(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Default/No explicit directive for ${actorId}. Proceeding to wait for '${TURN_ENDED_ID}' event.`);
        if (this.#currentActor && this.#currentActor.id === actorId) {
            await this.#waitForTurnEndEvent(actor);
            if (!this.#_isTurnValidForActor(actorId)) { // Check after wait setup attempt
                this.#logger.warn(`${className}: _executeWaitForTurnEndEventStrategy: Actor ${actorId} no longer valid after attempting to set up wait for '${TURN_ENDED_ID}'. Aborting operation.`);
                return;
            }
            this.#logger.debug(`${className}: _executeWaitForTurnEndEventStrategy: Wait for '${TURN_ENDED_ID}' for actor ${actorId} initiated.`);
        } else {
            this.#logger.warn(`${className}: _executeWaitForTurnEndEventStrategy: Skipping wait for '${TURN_ENDED_ID}' for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }


    async #_processValidatedCommand(actor, commandString) {
        const actorId = actor.id;
        const className = this.constructor.name;
        let cmdProcResult = null;

        this.#_assertTurnActiveFor(actorId);
        this.#logger.debug(`${className}: Processing validated command "${commandString}" for ${actorId}.`);
        this.#clearTurnEndWaitingMechanisms();

        try {
            this.#logger.info(`${className}: Delegating command "${commandString}" for ${actorId} to CommandProcessor.`);
            cmdProcResult = await this.#commandProcessor.processCommand(actor, commandString);

            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: #_processValidatedCommand: Turn for ${actorId} became invalid after command processing. Aborting further handler action.`);
                return;
            }

            if (cmdProcResult.success) {
                await this._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);
            } else {
                await this._handleCommandProcessorFailure(actor, cmdProcResult, commandString);
            }

        } catch (error) {
            const stillCurrentOnError = this.#currentActor && this.#currentActor.id === actorId;

            if (error.message.includes('Assertion Failed - Turn is not active')) {
                this.#logger.warn(`${className}: #_processValidatedCommand: Turn state assertion failed for command "${commandString}" by ${actorId}. Error: ${error.message}`);
                return;
            }

            const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;
            if (error?.message?.startsWith(promptErrorOriginCheck)) {
                this.#logger.debug(`${className}: #_processValidatedCommand: Re-thrown prompt error for ${actorId} (command "${commandString}"). Lower-level handler should have finalized. Error: ${error.message}`);
                throw error;
            }

            this.#logger.error(`${className}: #_processValidatedCommand: Unexpected error processing command "${commandString}" for ${actorId}: ${error.message}`, error);

            await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
                message: `Internal error in #_processValidatedCommand for ${actorId}, command "${commandString}".`,
                type: 'error',
                details: error.message
            });

            if (stillCurrentOnError) {
                if (!this.#isAwaitingTurnEndEvent) {
                    this.#logger.info(`${className}: #_processValidatedCommand: Attempting to end turn with failure for ${actorId} due to unexpected error (command "${commandString}").`);
                    await this._handleTurnEnd(actorId, error);
                } else {
                    this.#logger.warn(`${className}: #_processValidatedCommand: Unexpected error for ${actorId} (command "${commandString}") while awaiting '${TURN_ENDED_ID}'. Turn might not end correctly. Error: ${error.message}`);
                }
            } // Else: actor mismatch, error is logged, turn end not attempted for this actorId from here.
        }
    }

    async #waitForTurnEndEvent(actor) {
        const actorId = actor.id;
        const className = this.constructor.name;

        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}: #waitForTurnEndEvent: Skipping wait setup for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
            return;
        }

        if (this.#isAwaitingTurnEndEvent) {
            this.#logger.warn(`${className}: #waitForTurnEndEvent: Already awaiting turn end for ${this.#awaitingTurnEndForActorId}. Clearing previous wait for ${actorId} first.`);
            this.#clearTurnEndWaitingMechanisms();
        }

        this.#isAwaitingTurnEndEvent = true;
        this.#awaitingTurnEndForActorId = actorId;
        this.#logger.debug(`${className}: Subscribing to '${TURN_ENDED_ID}' for actor ${actorId}.`);

        /** @param {SystemEventPayloads[typeof TURN_ENDED_ID]} payload */
        const turnEndedListener = (payload) => {
            const localClassName = this.constructor.name;
            if (this.#isAwaitingTurnEndEvent && payload.entityId === this.#awaitingTurnEndForActorId) {
                this.#logger.info(`${localClassName}: Received target '${TURN_ENDED_ID}' event for actor ${this.#awaitingTurnEndForActorId}. Message: ${payload.message || 'N/A'}.`);
                if (this.#currentActor && this.#currentActor.id === this.#awaitingTurnEndForActorId) {
                    this._handleTurnEnd(this.#awaitingTurnEndForActorId, null)
                        .catch(err => this.#logger.error(`${localClassName}: Error in _handleTurnEnd after '${TURN_ENDED_ID}' event for ${this.#awaitingTurnEndForActorId}: ${err.message}`, err));
                } else {
                    this.#logger.warn(`${localClassName}: Received '${TURN_ENDED_ID}' for awaited actor ${this.#awaitingTurnEndForActorId}, but actor is no longer current (current: ${this.#currentActor?.id || 'none'}). Cleaning up wait mechanisms.`);
                    this.#clearTurnEndWaitingMechanisms();
                }
            } else if (this.#isAwaitingTurnEndEvent) {
                this.#logger.debug(`${localClassName}: Ignoring '${TURN_ENDED_ID}' event for entity ${payload.entityId} (awaiting for ${this.#awaitingTurnEndForActorId}).`);
            } else {
                this.#logger.debug(`${localClassName}: Received '${TURN_ENDED_ID}' for ${payload.entityId}, but no longer awaiting. Listener should have been removed. Safeguard cleanup.`);
                this.#clearTurnEndWaitingMechanisms(); // Safeguard
            }
        };

        const eventSubscribed = this.#subscriptionManager.subscribeToTurnEnded(turnEndedListener);

        if (!eventSubscribed) {
            this.#logger.error(`${className}: Failed to subscribe to '${TURN_ENDED_ID}' for actor ${actorId}. Ending turn with failure.`);
            this.#isAwaitingTurnEndEvent = false;
            this.#awaitingTurnEndForActorId = null;
            const subscriptionError = new Error(`Internal error: Failed to subscribe to ${TURN_ENDED_ID} event listener.`);
            if (this.#currentActor && this.#currentActor.id === actorId) {
                await this._handleTurnEnd(actorId, subscriptionError);
            }
            return;
        }
        this.#logger.debug(`${className}: Successfully subscribed to '${TURN_ENDED_ID}' for actor ${actorId}.`);
    }

    async _promptPlayerForAction(actor) {
        const className = this.constructor.name;
        const actorId = actor?.id || 'INVALID_ACTOR';

        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}: _promptPlayerForAction: Skipping prompt for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
            return;
        }
        this.#_assertTurnActiveFor(actorId); // Asserts current actor, if it fails, error is thrown.

        this.#logger.debug(`${className}: Delegating prompt for actor ${actorId} to PlayerPromptService.`);
        try {
            await this.#playerPromptService.prompt(actor);
            this.#logger.debug(`${className}: PlayerPromptService.prompt completed for actor ${actorId}.`);
        } catch (error) {
            const detailedErrorMessage = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}: ${error.message}`;
            this.#logger.error(detailedErrorMessage, error);
            // Ensure the error message is prefixed if it's not already, for easier tracing.
            if (!error.message.startsWith(`${className}: PlayerPromptService threw an error`)) {
                error.message = detailedErrorMessage; // Modifying error in place
            }

            if (this.#currentActor && this.#currentActor.id === actorId) {
                this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to PlayerPromptService error.`);
                await this._handleTurnEnd(actorId, error);
            } else {
                // This case means actor changed *during* the error handling of this catch block, or was already not current.
                this.#logger.warn(`${className}: PlayerPromptService error for ${actorId}, but actor is no longer current (current: ${this.#currentActor?.id || 'none'}). Turn end not handled by this path.`);
            }
            throw error; // Re-throw for higher-level awareness if needed
        }
    }

    async _handleTurnEnd(actorId, error = null) {
        const className = this.constructor.name;
        const isSuccess = (error === null || error === undefined);
        const endingStatus = isSuccess ? 'success' : 'failure';
        const currentActorAtCall = this.#currentActor; // Capture for logging

        this.#logger.debug(`${className}: _handleTurnEnd called for actor ${actorId} (status: ${endingStatus}). Current actor: ${currentActorAtCall?.id || 'none'}. Awaiting event for: ${this.#awaitingTurnEndForActorId || 'none'}.`);

        if (!currentActorAtCall || currentActorAtCall.id !== actorId) {
            let logContextDetail = `actor ${actorId} is not the current actor (current: ${currentActorAtCall?.id || 'none'})`;
            if (this.#awaitingTurnEndForActorId === actorId) {
                logContextDetail = `actor ${actorId} was awaited, but is not current (current: ${currentActorAtCall?.id || 'none'})`;
            }
            this.#logger.warn(`${className}: _handleTurnEnd: ${logContextDetail}. TurnEndPort NOT notified by this call. Resetting state for context '${actorId}'.`);
            this._resetTurnStateAndResources(actorId); // Reset for the specified actorId context
            return;
        }

        this.#isTerminatingNormally = true;
        this.#logger.info(`${className}: Finalizing turn for ${actorId} (status: ${endingStatus}).`);

        if (!isSuccess) {
            const reasonMsg = error instanceof Error ? error.message : String(error);
            this.#logger.warn(`${className}: Turn for ${actorId} ended with failure. Reason: ${reasonMsg}`);
        }

        try {
            this.#logger.debug(`${className}: Notifying TurnEndPort for actor ${actorId} (success: ${isSuccess}).`);
            await this.#turnEndPort.notifyTurnEnded(actorId, isSuccess);
            this.#logger.debug(`${className}: TurnEndPort notified for ${actorId}.`);
        } catch (notifyError) {
            this.#logger.error(`${className}: CRITICAL - Error notifying TurnEndPort for ${actorId}: ${notifyError.message}. External state might be inconsistent. Handler state will reset.`, notifyError);
        }

        this.#logger.debug(`${className}: Calling _resetTurnStateAndResources for actor ${actorId} post-notification.`);
        this._resetTurnStateAndResources(actorId);

        this.#logger.debug(`${className}: _handleTurnEnd sequence completed for actor ${actorId}.`);
    }

    #_isTurnValidForActor(actorId) {
        const className = this.constructor.name;
        // These logs are specific and clearly indicate the point of failure.
        if (this.#isDestroyed) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for actor ${actorId}; handler is destroyed.`);
            return false;
        }
        if (!this.#currentActor) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for actor ${actorId}; no current actor.`);
            return false;
        }
        if (this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for actor ${actorId}; current actor is ${this.#currentActor.id}.`);
            return false;
        }
        return true;
    }

    #_assertTurnActiveFor(actorId) {
        const className = this.constructor.name;
        // These are assertion errors, their messages are primary.
        if (this.#isDestroyed) {
            throw new Error(`${className}: Assertion Failed - Handler is destroyed. Cannot process for actor '${actorId}'.`);
        }
        if (!this.#currentActor) {
            throw new Error(`${className}: Assertion Failed - Turn not active. Expected actor '${actorId}', but no turn in progress.`);
        }
        if (this.#currentActor.id !== actorId) {
            throw new Error(`${className}: Assertion Failed - Incorrect actor. Expected '${actorId}', current is '${this.#currentActor.id}'.`);
        }
    }

    #clearTurnEndWaitingMechanisms() {
        const className = this.constructor.name;
        const actorContextForLog = this.#awaitingTurnEndForActorId || (this.#currentActor ? this.#currentActor.id : 'general_cleanup');

        if (this.#isAwaitingTurnEndEvent) {
            this.#logger.debug(`${className}.#clearTurnEndWaitingMechanisms: Unsubscribing from '${TURN_ENDED_ID}' for actor context '${actorContextForLog}'.`);
            this.#subscriptionManager.unsubscribeFromTurnEnded();
        } else {
            this.#logger.debug(`${className}.#clearTurnEndWaitingMechanisms: No active wait for '${TURN_ENDED_ID}' event for context '${actorContextForLog}'. Flags reset. No unsubscription needed.`);
        }

        if (this.#isAwaitingTurnEndEvent || this.#awaitingTurnEndForActorId) {
            this.#logger.debug(`${className}.#clearTurnEndWaitingMechanisms: Resetting turn end wait flags (was awaiting: ${this.#isAwaitingTurnEndEvent}, for actor: ${this.#awaitingTurnEndForActorId || 'null'}).`);
        }
        this.#isAwaitingTurnEndEvent = false;
        this.#awaitingTurnEndForActorId = null;
    }


    signalNormalApparentTermination() {
        const className = this.constructor.name;
        this.#logger.debug(`${className}: Normal apparent termination signalled for actor: ${this.#currentActor?.id || this.#awaitingTurnEndForActorId || 'N/A'}. Setting #isTerminatingNormally=true.`);
        this.#isTerminatingNormally = true;
    }

    destroy() {
        const className = this.constructor.name;
        const initialCurrentActorId = this.#currentActor?.id;
        const actorIdForCleanupLog = initialCurrentActorId || this.#awaitingTurnEndForActorId || 'destroy_context_N/A';

        if (this.#isDestroyed) {
            this.#logger.debug(`${className}: Already destroyed. Skipping destruction for context: ${actorIdForCleanupLog}.`);
            return;
        }
        this.#isDestroyed = true;

        this.#logger.info(`${className}: Destroying handler instance (context: ${actorIdForCleanupLog}). Initial current actor: ${initialCurrentActorId || 'null'}. Normally terminating: ${this.#isTerminatingNormally}.`);

        if (initialCurrentActorId) {
            if (!this.#isTerminatingNormally) {
                this.#logger.warn(`${className}: Destroying during active turn for ${initialCurrentActorId} (not normally terminated). Failsafe: notifying TurnEndPort of failure.`);
                this.#turnEndPort.notifyTurnEnded(initialCurrentActorId, false)
                    .catch(notifyErr => {
                        this.#logger.error(`${className}: Error in failsafe TurnEndPort notification for ${initialCurrentActorId} during destroy: ${notifyErr.message}`, notifyErr);
                    });
            } else {
                this.#logger.debug(`${className}: Destroying for ${initialCurrentActorId} (normally terminated). Failsafe TurnEndPort notification skipped.`);
            }
        } else {
            const noActorContext = this.#awaitingTurnEndForActorId ? `awaiting turn end for ${this.#awaitingTurnEndForActorId}` : 'no active or awaited actor';
            this.#logger.debug(`${className}: Destroying handler (${noActorContext}). No failsafe notification needed (no primary active actor).`);
        }

        this.#logger.debug(`${className}: Calling _resetTurnStateAndResources during destroy (context: ${actorIdForCleanupLog}).`);
        this._resetTurnStateAndResources(actorIdForCleanupLog);

        // Note: this.#isTerminatingNormally is reset to false by _resetTurnStateAndResources
        this.#logger.info(`${className}: Destruction completed for handler instance (context: ${actorIdForCleanupLog}). State: destroyed=true, currentActor=null.`);
    }

    /* istanbul ignore next */
    _TEST_SET_CURRENT_ACTOR(actor) {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            this.#currentActor = actor;
        } else {
            this.#logger.error(`${this.constructor.name}: _TEST_SET_CURRENT_ACTOR is for testing purposes only and should not be called in production.`);
        }
    }

    /* istanbul ignore next */
    _TEST_GET_CURRENT_ACTOR() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            return this.#currentActor;
        }
        this.#logger.error(`${this.constructor.name}: _TEST_GET_CURRENT_ACTOR is for testing purposes only.`);
        return null;
    }

    /* istanbul ignore next */
    _TEST_GET_COMMAND_OUTCOME_INTERPRETER() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            return this.#commandOutcomeInterpreter;
        }
        this.#logger.error(`${this.constructor.name}: _TEST_GET_COMMAND_OUTCOME_INTERPRETER is for testing purposes only.`);
        return null;
    }

    /* istanbul ignore next */
    _TEST_GET_SAFE_EVENT_DISPATCHER() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            return this.#safeEventDispatcher;
        }
        this.#logger.error(`${this.constructor.name}: _TEST_GET_SAFE_EVENT_DISPATCHER is for testing purposes only.`);
        return null;
    }

    /* istanbul ignore next */
    _TEST_SET_COMMAND_OUTCOME_INTERPRETER_TO_NULL() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            this.#commandOutcomeInterpreter = null;
        } else {
            this.#logger.error(`${this.constructor.name}: _TEST_SET_COMMAND_OUTCOME_INTERPRETER_TO_NULL is for testing purposes only.`);
        }
    }
}

export default PlayerTurnHandler;
// --- FILE END ---