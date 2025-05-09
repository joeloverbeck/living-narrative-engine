// src/core/turnStates/processingCommandState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../commandProcessor.js').CommandResult} CommandResult
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 */

import {AbstractTurnState} from './abstractTurnState.js';
// States for transitions
import {AwaitingPlayerInputState} from './awaitingPlayerInputState.js'; // For re-prompt
import {AwaitingExternalTurnEndState} from './awaitingExternalTurnEndState.js'; // For wait directive
import {TurnEndingState} from './turnEndingState.js'; // For end turn directive or errors
import {TurnIdleState} from './turnIdleState.js';     // For critical errors if turn cannot end normally

// Constants
import TurnDirective from '../constants/turnDirectives.js';
import SystemEvent from '../constants/systemEvents.js'; // For dispatching system_error_occurred
// import CoreErrorCodes from '../constants/coreErrorCodes.js'; // Not directly used in this version, can be removed if not needed by strategies/context


/**
 * @class ProcessingCommandState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * This state is entered after a command has been submitted by the player. During this state,
 * the submitted command is processed by the `ICommandProcessor`, and its outcome is subsequently
 * interpreted by the `ICommandOutcomeInterpreter`. Based on the interpretation, it transitions
 * the {@link PlayerTurnHandler} to the next appropriate state.
 */
export class ProcessingCommandState extends AbstractTurnState {
    /**
     * The command string to be processed.
     * @private
     * @type {string}
     */
    #commandString;

    /**
     * Creates an instance of ProcessingCommandState.
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler instance that manages this state.
     * @param {string} commandString - The command string submitted by the player to be processed.
     */
    constructor(context, commandString) {
        super(context);
        if (typeof commandString !== 'string' || commandString.trim() === '') {
            const errorMsg = `${this.constructor.name} Constructor: commandString must be a non-empty string. Received: "${commandString}"`;
            context.logger.error(errorMsg);
            // This is a critical setup error. The calling state should ideally prevent this.
            throw new Error(errorMsg);
        }
        this.#commandString = commandString;
    }

    /**
     * Returns the unique identifier for this state.
     * @override
     * @returns {string} The state name "ProcessingCommandState".
     */
    getStateName() {
        return "ProcessingCommandState";
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * - Logs entry.
     * - Asserts current actor validity.
     * - Clears residual turn end waiting mechanisms.
     * - Initiates command processing.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>}
     */
    async enterState(context, previousState) {
        const actor = context.getCurrentActor();
        const actorId = actor?.id ?? 'UNKNOWN_ACTOR';

        context.logger.info(`${this.getStateName()}: Entered for actor ${actorId}. Command: "${this.#commandString}". Previous state: ${previousState?.getStateName() ?? 'None'}.`);

        if (!actor) {
            const errorMsg = `${this.getStateName()}: Critical - No current actor found on entry. This indicates an invalid sequence. Command was "${this.#commandString}".`;
            context.logger.error(errorMsg);
            try {
                await context._transitionToState(new TurnIdleState(context));
            } catch (transitionError) {
                context.logger.error(`${this.getStateName()}: Failed to transition to TurnIdleState after null actor error: ${transitionError.message}`, transitionError);
            }
            return;
        }

        // AC: "Clears any existing turn end waiting mechanisms via context.#clearTurnEndWaitingMechanisms()"
        // Assumes PlayerTurnHandler exposes a method for this specific purpose (e.g., _clearTurnEndWaitingMechanisms).
        if (typeof context._clearTurnEndWaitingMechanisms === 'function') {
            context.logger.debug(`${this.getStateName()}: Clearing turn end waiting mechanisms for actor ${actorId}.`);
            context._clearTurnEndWaitingMechanisms();
        } else {
            context.logger.warn(`${this.getStateName()}: context._clearTurnEndWaitingMechanisms() is not available. Turn end waiting mechanisms might not be properly cleared. This could affect AwaitingExternalTurnEndState if re-entered unexpectedly.`);
        }

        // AC: "Immediately calls a private orchestrator method within this state (e.g., this._processCommandInternal(context))."
        // This call is not awaited in enterState to allow enterState to return quickly.
        // _processCommandInternal manages its own async lifecycle and error handling.
        this._processCommandInternal(context)
            .catch(error => {
                const currentActorForError = context.getCurrentActor();
                const actorIdForErrorLog = currentActorForError?.id ?? actorId;
                context.logger.error(`${this.getStateName()}: Unhandled error from _processCommandInternal invocation for actor ${actorIdForErrorLog}, command "${this.#commandString}". Error: ${error.message}`, error);

                if (currentActorForError) {
                    context._handleTurnEnd(currentActorForError.id, new Error(`Critical unhandled error during command processing: ${error.message}`))
                        .then(() => {
                            // Ensure transition to TurnEndingState if _handleTurnEnd doesn't guarantee it or if further action is needed.
                            // However, _handleTurnEnd is expected to lead to TurnEndingState -> TurnIdleState.
                            // A direct transition here might conflict if _handleTurnEnd already started one.
                            // For robustness, ensure we are in a terminal state.
                            if (!(context._TEST_GET_CURRENT_STATE() instanceof TurnEndingState) && !(context._TEST_GET_CURRENT_STATE() instanceof TurnIdleState)) {
                                return context._transitionToState(new TurnEndingState(context));
                            }
                        })
                        .catch(turnEndError => {
                            context.logger.error(`${this.getStateName()}: Further error during emergency turn end for ${actorIdForErrorLog}: ${turnEndError.message}`, turnEndError);
                            context._transitionToState(new TurnIdleState(context)).catch(idleErr => {
                                context.logger.error(`${this.getStateName()}: CRITICAL - Failed to transition to TurnIdleState after multiple errors for ${actorIdForErrorLog}: ${idleErr.message}`, idleErr);
                            });
                        });
                } else {
                    context.logger.warn(`${this.getStateName()}: No current actor to end turn for after unhandled error from _processCommandInternal. Attempting transition to TurnIdleState.`);
                    context._transitionToState(new TurnIdleState(context)).catch(idleErr => {
                        context.logger.error(`${this.getStateName()}: CRITICAL - Failed to transition to TurnIdleState after unhandled error (no actor): ${idleErr.message}`, idleErr);
                    });
                }
            });
    }

    /**
     * Orchestrates the command processing sequence.
     * This private method is called by `enterState`. It handles calling the command processor,
     * checking turn validity, and then delegating to success or failure handlers.
     * It includes comprehensive error handling for the processing pipeline.
     *
     * @private
     * @async
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler context.
     * @returns {Promise<void>} A promise that resolves when processing and subsequent handling are complete.
     */
    async _processCommandInternal(context) {
        const actor = context.getCurrentActor();
        if (!actor) {
            context.logger.error(`${this.getStateName()}._processCommandInternal: Critical - No actor available at the start of command processing. Command: "${this.#commandString}". Aborting.`);
            try {
                await context._transitionToState(new TurnIdleState(context));
            } catch (transitionError) {
                context.logger.error(`${this.getStateName()}._processCommandInternal: Failed to transition to TurnIdleState after missing actor: ${transitionError.message}`, transitionError);
            }
            return;
        }
        const actorId = actor.id;

        context.logger.debug(`${this.getStateName()}._processCommandInternal: Starting processing for actor ${actorId}, command: "${this.#commandString}".`);

        try {
            context.logger.info(`${this.getStateName()}: Delegating to commandProcessor.processCommand for actor ${actorId}, command: "${this.#commandString}".`);
            const cmdProcResult = await context.commandProcessor.processCommand(actor, this.#commandString);
            context.logger.debug(`${this.getStateName()}: Command processing completed for actor ${actorId}. Success: ${cmdProcResult?.success}.`);

            const currentActorInContext = context.getCurrentActor();
            if (!currentActorInContext || currentActorInContext.id !== actorId) {
                context.logger.warn(`${this.getStateName()}: Turn became invalid for actor ${actorId} after command processing (current context actor: ${currentActorInContext?.id ?? 'null'}). Command was "${this.#commandString}". Ending turn.`);
                await context._handleTurnEnd(actorId, new Error(`Turn became invalid for actor ${actorId} during command processing.`));
                return;
            }

            if (cmdProcResult.success) {
                context.logger.debug(`${this.getStateName()}: Command successful for actor ${actorId}. Delegating to _handleProcessorSuccess.`);
                await this._handleProcessorSuccess(context, actor, cmdProcResult, this.#commandString);
            } else {
                context.logger.debug(`${this.getStateName()}: Command failed for actor ${actorId}. Delegating to _handleProcessorFailure.`);
                await this._handleProcessorFailure(context, actor, cmdProcResult, this.#commandString);
            }
        } catch (error) {
            context.logger.error(`${this.getStateName()}: Error during command processing pipeline for actor ${actorId}, command "${this.#commandString}". Error: ${error.message}`, error);

            await context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: `Error in ${this.getStateName()} for actor ${actorId}, command "${this.#commandString}": ${error.message}`,
                error: error,
                actorId: actorId,
                commandString: this.#commandString,
                state: this.getStateName(),
            });

            const actorToEndTurnFor = context.getCurrentActor();
            if (actorToEndTurnFor && actorToEndTurnFor.id === actorId) {
                context.logger.info(`${this.getStateName()}: Ending turn for actor ${actorId} due to error in processing pipeline.`);
                await context._handleTurnEnd(actorId, error);
            } else {
                context.logger.warn(`${this.getStateName()}: Error occurred in processing pipeline for actor ${actorId}, but current actor is now ${actorToEndTurnFor?.id ?? 'null'}. Turn ending for ${actorId} might have already been handled or is no longer appropriate by this state.`);
                if (!actorToEndTurnFor) {
                    context.logger.debug(`${this.getStateName()}: No current actor after error. Attempting transition to TurnIdleState.`);
                    try {
                        await context._transitionToState(new TurnIdleState(context));
                    } catch (idleTransitionError) {
                        context.logger.error(`${this.getStateName()}: CRITICAL - Failed to transition to TurnIdleState after processing error and actor mismatch: ${idleTransitionError.message}`, idleTransitionError);
                    }
                }
            }
        }
    }

    /**
     * Handles the successful outcome of command processing.
     * @private
     * @async
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler context.
     * @param {Entity} actor - The actor for whom the command was processed.
     * @param {CommandResult} cmdProcResult - The successful result from the command processor.
     * @param {string} commandString - The original command string.
     * @returns {Promise<void>}
     * @throws {Error} If critical errors occur.
     */
    async _handleProcessorSuccess(context, actor, cmdProcResult, commandString) {
        const actorId = actor.id;
        context.logger.debug(`${this.getStateName()}._handleProcessorSuccess: Handling successful command for actor ${actorId}. Command: "${commandString}".`);

        let currentActorInContext = context.getCurrentActor();
        if (!currentActorInContext || currentActorInContext.id !== actorId) {
            context.logger.warn(`${this.getStateName()}._handleProcessorSuccess: Turn became invalid for actor ${actorId} before outcome interpretation (current context actor: ${currentActorInContext?.id ?? 'null'}). Ending turn.`);
            await context._handleTurnEnd(actorId, new Error(`Turn became invalid for actor ${actorId} before command outcome interpretation.`));
            return;
        }

        if (!context.commandOutcomeInterpreter) {
            const errorMsg = `${this.getStateName()}._handleProcessorSuccess: CommandOutcomeInterpreter is missing in context for actor ${actorId}. Cannot interpret command result.`;
            context.logger.error(errorMsg);
            context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: errorMsg,
                actorId: actorId,
                commandString: commandString,
                state: this.getStateName(),
            });
            await context._handleTurnEnd(actorId, new Error("Critical: CommandOutcomeInterpreter missing."));
            return;
        }

        let directive;
        try {
            context.logger.debug(`${this.getStateName()}._handleProcessorSuccess: Interpreting command outcome for actor ${actorId}.`);
            directive = await context.commandOutcomeInterpreter.interpret(actor, cmdProcResult, commandString);
            context.logger.info(`${this.getStateName()}._handleProcessorSuccess: Outcome interpretation for actor ${actorId} resulted in directive: ${directive?.type ?? 'UNKNOWN_DIRECTIVE'}.`);
        } catch (interpretationError) {
            context.logger.error(`${this.getStateName()}._handleProcessorSuccess: Error during command outcome interpretation for actor ${actorId}. Error: ${interpretationError.message}`, interpretationError);
            await context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: `Error during command outcome interpretation for actor ${actorId}: ${interpretationError.message}`,
                error: interpretationError,
                actorId: actorId,
                commandString: commandString,
                state: this.getStateName(),
            });
            await context._handleTurnEnd(actorId, interpretationError);
            return;
        }

        currentActorInContext = context.getCurrentActor();
        if (!currentActorInContext || currentActorInContext.id !== actorId) {
            context.logger.warn(`${this.getStateName()}._handleProcessorSuccess: Turn became invalid for actor ${actorId} after outcome interpretation (current context actor: ${currentActorInContext?.id ?? 'null'}). Ending turn.`);
            await context._handleTurnEnd(actorId, new Error(`Turn became invalid for actor ${actorId} after command outcome interpretation.`));
            return;
        }

        if (!directive || !directive.type || !Object.values(TurnDirective).includes(directive.type)) {
            const errorMsg = `${this.getStateName()}._handleProcessorSuccess: Unknown or invalid TurnDirective received: ${JSON.stringify(directive)} for actor ${actorId}.`;
            context.logger.error(errorMsg);
            context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: errorMsg,
                directiveReceived: directive,
                actorId: actorId,
                commandString: commandString,
                state: this.getStateName(),
            });
            await context._handleTurnEnd(actorId, new Error(`Unknown TurnDirective: ${directive?.type ?? 'N/A'}`));
            return;
        }

        context.logger.info(`${this.getStateName()}._handleProcessorSuccess: Delegating to strategy execution for actor ${actorId}, directive: ${directive.type}.`);
        if (typeof context.executeTurnDirectiveStrategy === 'function') {
            try {
                await context.executeTurnDirectiveStrategy(actor, directive, cmdProcResult, commandString);
                context.logger.debug(`${this.getStateName()}._handleProcessorSuccess: Strategy execution for directive ${directive.type} completed for actor ${actorId}.`);
            } catch (strategyError) {
                context.logger.error(`${this.getStateName()}._handleProcessorSuccess: Error during strategy execution for directive ${directive.type}, actor ${actorId}. Error: ${strategyError.message}`, strategyError);
                throw strategyError; // Re-throw for _processCommandInternal to handle
            }
        } else {
            const criticalMsg = `${this.getStateName()}._handleProcessorSuccess: context.executeTurnDirectiveStrategy is not a function. Cannot process directive ${directive.type} for actor ${actorId}.`;
            context.logger.error(criticalMsg);
            context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: criticalMsg,
                actorId: actorId,
                directive: directive.type,
                state: this.getStateName(),
            });
            await context._handleTurnEnd(actorId, new Error("System configuration error: executeTurnDirectiveStrategy missing."));
        }
    }

    /**
     * Handles the failed outcome of command processing.
     * @private
     * @async
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler context.
     * @param {Entity} actor - The actor for whom the command was processed.
     * @param {CommandResult} cmdProcResult - The failed result from the command processor.
     * @param {string} commandString - The original command string.
     * @returns {Promise<void>}
     * @throws {Error} If critical errors occur.
     */
    async _handleProcessorFailure(context, actor, cmdProcResult, commandString) {
        const actorId = actor.id;
        context.logger.warn(`${this.getStateName()}._handleProcessorFailure: Handling failed command for actor ${actorId}. Command: "${commandString}". Result: ${cmdProcResult.message || 'No message'}`);

        if (cmdProcResult.turnEnded === true) {
            context.logger.info(`${this.getStateName()}._handleProcessorFailure: Command failure indicated an immediate turn end for actor ${actorId}.`);
            const errorForTurnEnd = cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(cmdProcResult.message || `Command "${commandString}" failed and ended the turn.`);
            await context._handleTurnEnd(actorId, errorForTurnEnd);
            return;
        }

        let currentActorInContext = context.getCurrentActor();
        if (!currentActorInContext || currentActorInContext.id !== actorId) {
            context.logger.warn(`${this.getStateName()}._handleProcessorFailure: Turn became invalid for actor ${actorId} before failure outcome interpretation (current context actor: ${currentActorInContext?.id ?? 'null'}). Ending turn.`);
            await context._handleTurnEnd(actorId, new Error(`Turn became invalid for actor ${actorId} before command failure interpretation.`));
            return;
        }

        if (!context.commandOutcomeInterpreter) {
            const errorMsg = `${this.getStateName()}._handleProcessorFailure: CommandOutcomeInterpreter is missing in context for actor ${actorId}. Cannot interpret command failure.`;
            context.logger.error(errorMsg);
            context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: errorMsg,
                actorId: actorId,
                commandString: commandString,
                state: this.getStateName(),
            });
            const failureError = cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(cmdProcResult.message || "Command failed.");
            await context._handleTurnEnd(actorId, new Error(`Critical: CommandOutcomeInterpreter missing during failure processing. Original error: ${failureError.message}`));
            return;
        }

        let directive;
        try {
            context.logger.debug(`${this.getStateName()}._handleProcessorFailure: Interpreting command failure outcome for actor ${actorId}.`);
            directive = await context.commandOutcomeInterpreter.interpret(actor, cmdProcResult, commandString);
            context.logger.info(`${this.getStateName()}._handleProcessorFailure: Failure outcome interpretation for actor ${actorId} resulted in directive: ${directive?.type ?? 'UNKNOWN_DIRECTIVE'}.`);
        } catch (interpretationError) {
            context.logger.error(`${this.getStateName()}._handleProcessorFailure: Error during command failure outcome interpretation for actor ${actorId}. Error: ${interpretationError.message}`, interpretationError);
            context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: `Error during command failure outcome interpretation for actor ${actorId}: ${interpretationError.message}`,
                error: interpretationError,
                actorId: actorId,
                commandString: commandString,
                state: this.getStateName(),
            });
            await context._handleTurnEnd(actorId, interpretationError);
            return;
        }

        currentActorInContext = context.getCurrentActor();
        if (!currentActorInContext || currentActorInContext.id !== actorId) {
            context.logger.warn(`${this.getStateName()}._handleProcessorFailure: Turn became invalid for actor ${actorId} after failure outcome interpretation (current context actor: ${currentActorInContext?.id ?? 'null'}). Ending turn.`);
            await context._handleTurnEnd(actorId, new Error(`Turn became invalid for actor ${actorId} after command failure interpretation.`));
            return;
        }

        if (!directive || !directive.type || !Object.values(TurnDirective).includes(directive.type)) {
            const errorMsg = `${this.getStateName()}._handleProcessorFailure: Unknown or invalid TurnDirective received after failure: ${JSON.stringify(directive)} for actor ${actorId}.`;
            context.logger.error(errorMsg);
            context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: errorMsg,
                directiveReceived: directive,
                actorId: actorId,
                commandString: commandString,
                state: this.getStateName(),
            });
            const failureErrorForTurnEnd = cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(cmdProcResult.message || "Command failed.");
            await context._handleTurnEnd(actorId, new Error(`Unknown TurnDirective after failure: ${directive?.type ?? 'N/A'}. Original error: ${failureErrorForTurnEnd.message}`));
            return;
        }

        context.logger.info(`${this.getStateName()}._handleProcessorFailure: Delegating to strategy execution for actor ${actorId}, directive from failure: ${directive.type}.`);
        if (typeof context.executeTurnDirectiveStrategy === 'function') {
            try {
                await context.executeTurnDirectiveStrategy(actor, directive, cmdProcResult, commandString);
                context.logger.debug(`${this.getStateName()}._handleProcessorFailure: Strategy execution for directive ${directive.type} (from failure) completed for actor ${actorId}.`);
            } catch (strategyError) {
                context.logger.error(`${this.getStateName()}._handleProcessorFailure: Error during strategy execution for directive ${directive.type} (from failure), actor ${actorId}. Error: ${strategyError.message}`, strategyError);
                throw strategyError; // Re-throw for _processCommandInternal to handle
            }
        } else {
            const criticalMsg = `${this.getStateName()}._handleProcessorFailure: context.executeTurnDirectiveStrategy is not a function. Cannot process directive ${directive.type} (from failure) for actor ${actorId}.`;
            context.logger.error(criticalMsg);
            context.safeEventDispatcher.dispatchSafely(SystemEvent.CORE_SYSTEM_ERROR_OCCURRED, {
                message: criticalMsg,
                actorId: actorId,
                directive: directive.type,
                state: this.getStateName(),
            });
            const originalFailureError = cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(cmdProcResult.message || "Command failed.");
            await context._handleTurnEnd(actorId, new Error(`System configuration error: executeTurnDirectiveStrategy missing. Original error: ${originalFailureError.message}`));
        }
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>}
     */
    async exitState(context, nextState) {
        const actor = context.getCurrentActor();
        context.logger.info(`${this.getStateName()}: Exiting for actor ${actor?.id ?? 'N/A'}. Transitioning to ${nextState?.getStateName() ?? 'None'}. Command was: "${this.#commandString}".`);
    }

    /**
     * Handles cleanup if the {@link PlayerTurnHandler} is destroyed while this state is active.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance being destroyed.
     * @returns {Promise<void>}
     */
    async destroy(context) {
        const actor = context.getCurrentActor();
        const actorId = actor?.id ?? 'N/A_at_destroy';

        context.logger.warn(`${this.getStateName()}: PlayerTurnHandler is being destroyed while processing command "${this.#commandString}" for actor ${actorId}.`);

        if (actor) {
            const destroyError = new Error(`Turn handler destroyed while processing command "${this.#commandString}" for actor ${actorId}.`);
            context.logger.debug(`${this.getStateName()}: Delegating to context._handleTurnEnd for actor ${actorId} due to destruction.`);
            try {
                await context._handleTurnEnd(actor.id, destroyError);
            } catch (handleEndError) {
                context.logger.error(`${this.getStateName()}: Error calling _handleTurnEnd during destroy for actor ${actorId}: ${handleEndError.message}`, handleEndError);
            }
        } else {
            context.logger.warn(`${this.getStateName()}: PlayerTurnHandler destroyed, but no current actor was associated with the context during this state's destroy. Command was "${this.#commandString}".`);
        }
        context.logger.debug(`${this.getStateName()}: Destroy handling for command "${this.#commandString}" completed.`);
    }

    /**
     * This method should not be called while in ProcessingCommandState.
     * @override
     * @async
     */
    async startTurn(context, actor) {
        context.logger.error(`${this.getStateName()}: startTurn called for actor ${actor?.id} but command "${this.#commandString}" is already being processed for ${context.getCurrentActor()?.id}. This is a logic error.`);
        return super.startTurn(context, actor);
    }

    /**
     * This method should not be called while in ProcessingCommandState.
     * @override
     * @async
     */
    async handleSubmittedCommand(context, commandString) {
        context.logger.error(`${this.getStateName()}: handleSubmittedCommand ('${commandString}') called, but command "${this.#commandString}" is already being processed for ${context.getCurrentActor()?.id}. This indicates a command submission race or logic error.`);
        return super.handleSubmittedCommand(context, commandString);
    }

    /**
     * Handles the `core:turn_ended` system event.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {object} payload - The event payload, expected to have `entityId` and optionally `error`.
     * @property {string} payload.entityId The ID of the entity whose turn ended.
     * @property {string|Error} [payload.error] Optional error information.
     */
    async handleTurnEndedEvent(context, payload) {
        const currentActor = context.getCurrentActor();
        const processingActorId = currentActor?.id;
        const eventActorId = payload?.entityId;

        context.logger.warn(`${this.getStateName()}: handleTurnEndedEvent received for actor ${eventActorId} while processing command "${this.#commandString}" for actor ${processingActorId}.`);

        if (currentActor && eventActorId === processingActorId) {
            context.logger.error(`${this.getStateName()}: External turn_ended event for current actor ${processingActorId} received during command processing. This is unexpected and preempts processing. Ending turn.`);
            const eventError = payload.error ? (payload.error instanceof Error ? payload.error : new Error(String(payload.error))) : new Error(`Turn preempted by external event for actor ${processingActorId} during command processing.`);
            await context._handleTurnEnd(processingActorId, eventError);
        } else {
            context.logger.warn(`${this.getStateName()}: Ignoring turn_ended event for ${eventActorId} as it does not match current processing actor ${processingActorId}, or no current actor.`);
            return super.handleTurnEndedEvent(context, payload);
        }
    }

    /**
     * This method is part of the state's internal logic.
     * @override
     * @async
     */
    async processCommandResult(context, actor, cmdProcResult, commandString) {
        context.logger.error(`${this.getStateName()}: processCommandResult called externally for actor ${actor?.id} on state instance. This method is for internal use by the state's processing flow. Command was "${this.#commandString}".`);
        return super.processCommandResult(context, actor, cmdProcResult, commandString);
    }

    /**
     * This method is part of the state's internal logic.
     * @override
     * @async
     */
    async handleDirective(context, actor, directive, cmdProcResult) {
        context.logger.error(`${this.getStateName()}: handleDirective called externally for actor ${actor?.id}, directive ${directive?.type} on state instance. This method is for internal use. Command was "${this.#commandString}".`);
        return super.handleDirective(context, actor, directive, cmdProcResult);
    }
}

// --- FILE END ---