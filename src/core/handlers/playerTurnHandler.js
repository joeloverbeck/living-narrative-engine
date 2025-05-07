// src/core/handlers/playerTurnHandler.js
// --- FILE START ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';
import {TURN_ENDED_ID} from '../constants/eventIds.js';

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
 * @description Handles the turn logic for player-controlled entities.
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
    /** @type {string | null} */
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

        if (!safeEventDispatcher || typeof safeEventDispatcher.dispatchSafely !== 'function' || typeof safeEventDispatcher.subscribe !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely and subscribe methods).`);
            throw new Error(`${className}: Invalid or missing safeEventDispatcher.`);
        }
        this.#safeEventDispatcher = safeEventDispatcher;

        this.#logger.debug(`${className} initialized successfully with all dependencies.`);
    }

    async startTurn(actor) {
        const actorId = actor?.id || 'UNKNOWN';
        const className = this.constructor.name;
        this.#logger.info(`${className}: Starting turn initiation for actor ${actorId}.`);

        if (!actor || !actor.id) {
            this.#logger.error(`${className}: Attempted to start turn for an invalid actor.`);
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
            this.#_unsubscribeFromCommands();
            this.#logger.debug(`${className}: Subscribing to command input for actor ${actorId}...`);
            const commandHandler = this._handleSubmittedCommand.bind(this);
            this.#commandUnsubscribeFn = this.#commandInputPort.onCommand(commandHandler);
            if (!this.#commandUnsubscribeFn) {
                throw new Error('CommandInputPort.onCommand did not return a valid unsubscribe function.');
            }
            this.#logger.debug(`${className}: Command subscription successful for ${actorId}.`);

            await this.#_promptPlayerForAction(actor);
            this.#logger.debug(`${className}: Initial prompt sequence initiated for ${actorId}. Waiting for command submission.`);

        } catch (initError) {
            this.#logger.error(`${className}: Critical error during turn initiation for ${actor.id}: ${initError.message}`, initError);
            const promptErrorMessageCheck = `${className}: PlayerPromptService threw an error during prompt`;
            if (!initError?.message?.includes(promptErrorMessageCheck)) {
                this.#clearTurnEndWaitingMechanisms();
                await this._handleTurnEnd(actor.id, initError);
            }
            throw initError;
        }
    }

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

        if (!trimmedCommand) {
            this.#logger.warn(`${className}: Received empty command string. Re-prompting actor ${actorId}.`);
            await this.#_promptPlayerForAction(currentActorAtStart).catch(error => {
                this.#logger.debug(`${className}: Caught re-thrown error from failed re-prompt in empty command case. Error: ${error.message}`);
            });
            return;
        }

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
                if (this.#currentActor && this.#currentActor.id === actorId && !this.#isAwaitingTurnEndEvent) {
                    this.#logger.warn(`${className}: Attempting fallback turn end due to unhandled error in _handleSubmittedCommand for ${actorId}.`);
                    await this._handleTurnEnd(actorId, error);
                } else if (this.#isAwaitingTurnEndEvent && this.#currentActor && this.#currentActor.id === actorId) {
                    this.#logger.warn(`${className}: Unhandled error occurred in _handleSubmittedCommand while _already_ awaiting turn:end event for ${actorId}. Turn will be ended with failure.`);
                    await this._handleTurnEnd(actorId, error);
                }
            }
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
            this.#logger.info(`${className}: Delegating command "${commandString}" for ${actorId} to ICommandProcessor...`);
            cmdProcResult = await this.#commandProcessor.processCommand(actor, commandString);
            this.#_assertTurnActiveFor(actorId); // Re-assert turn active after async command processing
            this.#logger.info(`${className}: CommandProcessor raw result for ${actorId}: ${JSON.stringify(cmdProcResult)}`);

            if (!cmdProcResult.success) {
                this.#logger.warn(`${className}: CommandProcessor FAILED for "${commandString}" by ${actorId}. Error: ${cmdProcResult.error || 'N/A'}.`);

                // If CommandProcessor itself indicates the turn is definitively over with this failure
                if (cmdProcResult.turnEnded === true) {
                    this.#logger.info(`${className}: CommandProcessor FAILED and indicated turn has ended for ${actorId}. Bypassing CommandOutcomeInterpreter.`);
                    const failureError = cmdProcResult.error ? (cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(String(cmdProcResult.error))) : new Error(`Command processing failed and explicitly ended turn for command "${commandString}".`);
                    await this._handleTurnEnd(actorId, failureError);
                } else {
                    // Command processor failed, but didn't end turn, so ask interpreter.
                    this.#logger.info(`${className}: CommandProcessor FAILED for "${commandString}" by ${actorId}. Error: ${cmdProcResult.error || 'N/A'}. Interpreting this failure with CommandOutcomeInterpreter.`);
                    const directiveForFailure = await this.#commandOutcomeInterpreter.interpret(cmdProcResult, actor.id);
                    this.#_assertTurnActiveFor(actorId); // Re-assert after interpreter
                    this.#logger.info(`${className}: Directive for CommandProcessor failure: '${directiveForFailure}' for actor ${actorId}.`);

                    switch (directiveForFailure) {
                        case TurnDirective.RE_PROMPT:
                            this.#logger.info(`${className}: Directive is RE_PROMPT for ${actorId} due to CommandProcessor failure. Re-prompting.`);
                            await this.#_promptPlayerForAction(actor); // Player gets another chance this turn
                            break;
                        case TurnDirective.END_TURN_FAILURE:
                        default: // Includes END_TURN_SUCCESS (unlikely here) or unknown directives
                            this.#logger.info(`${className}: Directive is to end turn ('${directiveForFailure}') for ${actorId} due to CommandProcessor failure (or unknown directive).`);
                            const interpretedFailureError = cmdProcResult.error ? (cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(String(cmdProcResult.error))) : new Error(`Turn ended by CommandOutcomeInterpreter directive '${directiveForFailure}' after command processing failed for "${commandString}".`);
                            await this._handleTurnEnd(actorId, interpretedFailureError);
                            break;
                    }
                }
                return; // Processing of this command submission ends here.
            }

            // Case 2: CommandProcessor SUCCEEDED (core:attempt_action was dispatched successfully).
            this.#logger.info(`${className}: CommandProcessor SUCCEEDED for "${commandString}" by ${actorId}. core:attempt_action was dispatched.`);

            let directiveFromInterpreter = null;
            if (this.#commandOutcomeInterpreter) {
                this.#logger.info(`${className}: Calling CommandOutcomeInterpreter based on CommandProcessor's success (actor: ${actorId}).`);
                directiveFromInterpreter = await this.#commandOutcomeInterpreter.interpret(cmdProcResult, actor.id);
                this.#_assertTurnActiveFor(actorId);
                this.#logger.info(`${className}: CommandOutcomeInterpreter processed. Received directive: '${directiveFromInterpreter}' for actor ${actorId}.`);
            } else {
                this.#logger.warn(`${className}: No CommandOutcomeInterpreter available after successful command processing for ${actorId}. Assuming default flow to wait for turn end event.`);
            }

            if (directiveFromInterpreter && !Object.values(TurnDirective).includes(directiveFromInterpreter)) {
                const unknownDirectiveError = new Error(`Received unexpected directive: ${directiveFromInterpreter}`);
                this.#logger.error(
                    `${className}: Received unknown directive '${directiveFromInterpreter}' for actor ${actorId} after successful command. Forcing turn failure.`
                );
                await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                    eventName: 'core:system_error_occurred',
                    message: `Handler received unknown directive '${directiveFromInterpreter}' for actor ${actorId}.`,
                    type: 'error',
                    details: unknownDirectiveError.message
                });
                await this._handleTurnEnd(actorId, unknownDirectiveError);
                return;
            }

            this.#logger.info(`${className}: Proceeding to wait for '${TURN_ENDED_ID}' event from Rules Interpreter for actor ${actorId}.`);
            await this.#waitForTurnEndEvent(actor);

        } catch (error) {
            if (error.message.includes('Turn is not active')) {
                this.#logger.warn(`${className}: Turn state changed during processing of command "${commandString}". Aborting. Error: ${error.message}`);
            } else {
                const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;
                if (error?.message?.startsWith(promptErrorOriginCheck)) {
                    this.#logger.debug(`${className}: Error from failed prompt handled by #_promptPlayerForAction. Propagating up from #_processValidatedCommand for command "${commandString}".`);
                    throw error;
                } else {
                    this.#logger.error(`${className}: Error during #_processValidatedCommand flow for ${actorId} command "${commandString}": ${error.message}`, error);
                    if (!(error.message.startsWith("Received unexpected directive:"))) {
                        await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                            eventName: 'core:system_error_occurred',
                            message: `An internal error occurred while handling command or directive for ${actorId}.`,
                            type: 'error',
                            details: error.message
                        });
                    }
                    if (this.#currentActor?.id === actorId) {
                        // Check if cmdProcResult exists before trying to access its properties.
                        // If commandProcessor.processCommand threw, cmdProcResult would be null.
                        const isCmdProcSuccess = cmdProcResult ? cmdProcResult.success : false;

                        if (!this.#isAwaitingTurnEndEvent || isCmdProcSuccess) {
                            if (!(error.message.startsWith("Received unexpected directive:"))) {
                                this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to error in #_processValidatedCommand for "${commandString}".`);
                                await this._handleTurnEnd(actorId, error);
                            }
                        }
                    }
                }
            }
        }
    }

    async #waitForTurnEndEvent(actor) {
        const actorId = actor.id;
        const className = this.constructor.name;

        if (this.#isAwaitingTurnEndEvent) {
            this.#logger.warn(`${className}: #waitForTurnEndEvent called for ${actorId} while already awaiting. Clearing previous wait mechanisms first.`);
            this.#clearTurnEndWaitingMechanisms();
        }

        this.#isAwaitingTurnEndEvent = true;
        this.#awaitingTurnEndForActorId = actorId;
        this.#logger.debug(`${className}: Subscribing to '${TURN_ENDED_ID}' for actor ${actorId} and waiting.`);

        /** @param {SystemEventPayloads[typeof TURN_ENDED_ID]} payload */
        const turnEndedListener = (payload) => {
            if (this.#isAwaitingTurnEndEvent && payload.entityId === this.#awaitingTurnEndForActorId) {
                this.#logger.info(`${className}: Received target '${TURN_ENDED_ID}' event for current actor ${this.#awaitingTurnEndForActorId}. Success from event: ${payload.success}.`);
                const errorForTurnEnd = payload.success ? null : new Error(`Turn explicitly ended by rule with failure status for actor ${this.#awaitingTurnEndForActorId}. Message: ${payload.message || 'No message.'}`);
                this._handleTurnEnd(this.#awaitingTurnEndForActorId, errorForTurnEnd)
                    .catch(err => this.#logger.error(`${className}: Error in _handleTurnEnd after receiving '${TURN_ENDED_ID}' event: ${err.message}`, err));
            } else if (this.#isAwaitingTurnEndEvent) {
                this.#logger.debug(`${className}: Received '${TURN_ENDED_ID}' for ${payload.entityId} while waiting for ${this.#awaitingTurnEndForActorId}. Ignoring this event.`);
            }
        };

        this.#turnEndedSubscription = this.#safeEventDispatcher.subscribe(TURN_ENDED_ID, turnEndedListener);

        if (!this.#turnEndedSubscription) {
            this.#logger.error(`${className}: Failed to subscribe to '${TURN_ENDED_ID}' via SafeEventDispatcher for actor ${actorId}. Ending turn with failure.`);
            this.#isAwaitingTurnEndEvent = false;
            this.#awaitingTurnEndForActorId = null;
            const subscriptionError = new Error("Internal error: Failed to set up turn end event listener.");
            throw subscriptionError;
        }
    }

    async #_promptPlayerForAction(actor) {
        const className = this.constructor.name;
        const actorId = actor?.id || 'INVALID_ACTOR';
        this.#_assertTurnActiveFor(actorId);
        this.#logger.debug(`${className}: Delegating prompt logic for actor ${actorId} to PlayerPromptService.`);
        try {
            await this.#playerPromptService.prompt(actor);
            this.#logger.debug(`${className}: PlayerPromptService.prompt completed successfully for actor ${actorId}.`);
        } catch (error) {
            const logMessage = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}: ${error.message}`;
            this.#logger.error(logMessage, error);
            if (this.#currentActor && this.#currentActor.id === actorId) {
                this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to prompt error.`);
                await this._handleTurnEnd(actorId, error);
            } else {
                this.#logger.warn(`${className}: Prompt error for ${actorId}, but actor is no longer current or active. Turn end not handled by this instance of prompt error.`);
            }
            throw error;
        }
    }

    async _handleTurnEnd(actorId, error = null) {
        const className = this.constructor.name;
        const isSuccess = (error === null || error === undefined);
        const endingStatus = isSuccess ? 'success' : 'failure';
        const actorContextForLog = this.#currentActor?.id || this.#awaitingTurnEndForActorId || actorId;

        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            if (this.#isAwaitingTurnEndEvent && this.#awaitingTurnEndForActorId === actorId) {
                this.#logger.warn(`${className}: _handleTurnEnd called for ${actorId} (status: ${endingStatus}) which was awaited, but is not the current primary actor (${this.#currentActor?.id}). Clearing wait mechanisms for ${actorId}.`);
                this.#clearTurnEndWaitingMechanisms();
            } else {
                this.#logger.warn(`${className}: _handleTurnEnd called for ${actorId} (status: ${endingStatus}), but this actor is not the current active actor (${this.#currentActor?.id}) nor explicitly awaited. Turn may have already ended or belongs to a different context. Minimal cleanup attempted.`);
            }
            this.#_unsubscribeFromCommands();
            return;
        }

        this.#logger.info(`${className}: Ending turn for actor ${actorId} (status: ${endingStatus}).`);
        if (!isSuccess) {
            const reasonMsg = error instanceof Error ? error.message : String(error);
            this.#logger.warn(`${className}: Turn for ${actorId} ended with failure. Reason: ${reasonMsg}`);
        }

        this.#clearTurnEndWaitingMechanisms();
        this.#_unsubscribeFromCommands();

        try {
            this.#logger.debug(`Notifying TurnEndPort for actor ${actorId}, success=${isSuccess}.`);
            await this.#turnEndPort.notifyTurnEnded(actorId, isSuccess);
            this.#logger.debug(`TurnEndPort notified successfully for ${actorId}.`);
        } catch (notifyError) {
            this.#logger.error(`${className}: CRITICAL - Error notifying TurnEndPort for ${actorId}: ${notifyError.message}. State might be inconsistent.`, notifyError);
        }

        this.#_cleanupTurnState(actorId);
        this.#logger.debug(`${className}: _handleTurnEnd sequence completed for ${actorContextForLog}.`);
    }

    #_assertTurnActiveFor(actorId) {
        const className = this.constructor.name;
        if (!this.#currentActor) {
            throw new Error(`${className}: Assertion Failed - Turn is not active. Expected actor '${actorId}' but no turn is in progress.`);
        }
        if (this.#currentActor.id !== actorId) {
            throw new Error(`${className}: Assertion Failed - Turn is not active for the correct actor. Expected '${actorId}' but current actor is '${this.#currentActor.id}'.`);
        }
    }

    #_unsubscribeFromCommands() {
        const className = this.constructor.name;
        if (this.#commandUnsubscribeFn) {
            const actorContext = this.#currentActor?.id || this.#awaitingTurnEndForActorId || 'active context';
            this.#logger.debug(`${className}: Unsubscribing from command input for actor context '${actorContext}'.`);
            try {
                this.#commandUnsubscribeFn();
            } catch (unsubError) {
                this.#logger.error(`${className}: Error calling command unsubscribe function: ${unsubError.message}`, unsubError);
            } finally {
                this.#commandUnsubscribeFn = null;
            }
        }
    }

    #_cleanupTurnState(actorId) {
        const className = this.constructor.name;
        if (this.#currentActor && this.#currentActor.id === actorId) {
            this.#logger.debug(`${className}: Cleaning up primary active turn state for actor ${actorId}.`);
            this.#currentActor = null;
            this.#logger.debug(`${className}: Active turn state (currentActor) reset for ${actorId}.`);
        } else if (this.#currentActor) {
            this.#logger.warn(`${className}: #_cleanupTurnState called for ${actorId}, but current active actor is ${this.#currentActor.id}. No primary actor state cleanup performed for ${actorId} in this call.`);
        }
    }

    #clearTurnEndWaitingMechanisms() {
        const className = this.constructor.name;
        const actorContext = this.#awaitingTurnEndForActorId || (this.#currentActor ? this.#currentActor.id : 'general');

        if (this.#isAwaitingTurnEndEvent || this.#turnEndedSubscription) {
            this.#logger.debug(`${className}: Clearing turn end waiting mechanisms for actor context '${actorContext}'. (Subscription: ${!!this.#turnEndedSubscription}, AwaitingFlag: ${this.#isAwaitingTurnEndEvent})`);
        }

        if (this.#turnEndedSubscription) {
            try {
                this.#turnEndedSubscription();
            } catch (unsubError) {
                this.#logger.error(`${className}: Error calling turn_ended event unsubscribe function for '${actorContext}' during clear: ${unsubError.message}`, unsubError);
            }
            this.#turnEndedSubscription = null;
        }
        this.#isAwaitingTurnEndEvent = false;
        this.#awaitingTurnEndForActorId = null;
    }

    destroy() {
        const className = this.constructor.name;
        this.#logger.info(`${className}: Destroying handler...`);
        const actorIdForCleanup = this.#currentActor?.id || this.#awaitingTurnEndForActorId;

        this.#clearTurnEndWaitingMechanisms();
        this.#_unsubscribeFromCommands();

        if (actorIdForCleanup) {
            // Adjusted log message for test #3
            this.#logger.warn(`${className}: Destroying handler. If turn for ${actorIdForCleanup} was active or awaited, forcing turn end (failure).`);
            const destructionError = new Error(`${className} destroyed during turn processing or while awaiting turn end for actor ${actorIdForCleanup}.`);
            this.#turnEndPort.notifyTurnEnded(actorIdForCleanup, false)
                .catch(notifyErr => {
                    this.#logger.error(`${className}: Error notifying TurnEndPort during destroy for ${actorIdForCleanup}: ${notifyErr.message}`, notifyErr);
                })
                .finally(() => {
                    if (this.#currentActor && this.#currentActor.id === actorIdForCleanup) {
                        this.#currentActor = null;
                        this.#logger.debug(`${className}: #currentActor cleared for ${actorIdForCleanup} during destroy.`);
                    }
                });
        } else {
            if (this.#currentActor) {
                this.#logger.debug(`${className}: No specific awaited actor, but #currentActor (${this.#currentActor.id}) was set. Clearing #currentActor during destroy.`);
                this.#currentActor = null;
            } else {
                // Adjusted log message for test #4
                this.#logger.debug(`${className}: No active turn or await context found during destruction. State cleared.`);
            }
        }
        this.#logger.info(`${className}: Destruction sequence for handler completed.`);
    }
}

export default PlayerTurnHandler;
// --- FILE END ---