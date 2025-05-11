// src/core/turns/states/awaitingPlayerInputState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {ProcessingCommandState} from './processingCommandState.js';
import {TurnIdleState} from './turnIdleState.js'; // For error recovery

/**
 * @class AwaitingPlayerInputState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * Active when the system is waiting for an actor's decision (e.g. human player input).
 * It retrieves the actor's IActorTurnStrategy from ITurnContext and calls its decideAction() method.
 * All interactions with actor, services, logger, etc., are through ITurnContext.
 */
export class AwaitingPlayerInputState extends AbstractTurnState {
    // #unsubscribeFromCommandInputFn is removed as direct subscription is no longer this state's responsibility.
    // The strategy (e.g., HumanPlayerStrategy) will handle its own input mechanisms.

    /**
     * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
     */
    constructor(handler) {
        super(handler);
    }

    /** @override */
    getStateName() {
        return "AwaitingPlayerInputState";
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [previousState]
     */
    async enterState(handler, previousState) {
        const turnCtx = this._getTurnContext();

        if (!turnCtx) {
            const fallbackLogger = handler.getLogger();
            fallbackLogger.error(`${this.getStateName()}: Critical - ITurnContext not available on entry. Transitioning to Idle.`);
            handler._resetTurnStateAndResources(`critical-entry-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const logger = turnCtx.getLogger();
        await super.enterState(handler, previousState); // Handles initial logging via context

        const actor = turnCtx.getActor();
        if (!actor) {
            logger.error(`${this.getStateName()}: Critical - Actor not found in ITurnContext on entry. Ending turn.`);
            turnCtx.endTurn(new Error(`${this.getStateName()}: Actor not found in ITurnContext on entry.`));
            return;
        }
        const actorId = actor.id;

        try {
            logger.info(`${this.getStateName()}: Actor ${actorId} is now awaiting decision via its strategy.`);

            // Check if getStrategy method exists on the context before calling it
            if (typeof turnCtx.getStrategy !== 'function') {
                const strategyErrorMsg = `${this.getStateName()}: Actor ${actorId} has no valid IActorTurnStrategy or getStrategy() is missing on context.`;
                logger.error(strategyErrorMsg);
                turnCtx.endTurn(new Error(strategyErrorMsg));
                return;
            }

            const strategy = turnCtx.getStrategy(); // Assumes ITurnContext.getStrategy() exists (PTH-REFACTOR-003.4)
            if (!strategy || typeof strategy.decideAction !== 'function') {
                const strategyErrorMsg = `${this.getStateName()}: Actor ${actorId} has no valid IActorTurnStrategy or getStrategy() is missing on context.`;
                logger.error(strategyErrorMsg);
                turnCtx.endTurn(new Error(strategyErrorMsg));
                return;
            }

            logger.debug(`${this.getStateName()}: Calling decideAction() on strategy for actor ${actorId}.`);
            const turnAction = await strategy.decideAction(turnCtx); // Strategy handles its own prompting/logic

            if (!turnAction || typeof turnAction.actionDefinitionId !== 'string') {
                // Even a "pass" or "wait" should be a valid ITurnAction.
                const invalidActionMsg = `${this.getStateName()}: Strategy for actor ${actorId} returned an invalid or null ITurnAction.`;
                logger.error(invalidActionMsg, {receivedAction: turnAction});
                turnCtx.endTurn(new Error(invalidActionMsg));
                return;
            }

            logger.info(`${this.getStateName()}: Received ITurnAction from strategy for actor ${actorId}. Action ID: ${turnAction.actionDefinitionId}, Command: "${turnAction.commandString || 'N/A'}".`);

            // Store the chosen action in the context
            // Assumes ITurnContext.setChosenAction() exists (may need to be added via another ticket).
            // If not, ProcessingCommandState might take the ITurnAction directly.
            if (typeof turnCtx.setChosenAction === 'function') {
                turnCtx.setChosenAction(turnAction);
                logger.debug(`${this.getStateName()}: Stored ITurnAction in ITurnContext for actor ${actorId}.`);
            } else {
                logger.warn(`${this.getStateName()}: ITurnContext.setChosenAction() not found. Proceeding without storing action directly in context. ProcessingCommandState might need to handle the ITurnAction object.`);
            }

            // Transition to ProcessingCommandState, passing the ITurnAction's command string or the action itself.
            // The ticket states: "assume transition to ProcessingCommandState with the ITurnAction or its command string."
            // For now, let's pass the commandString if available, as ProcessingCommandState currently expects that.
            // This might need adjustment based on how ProcessingCommandState evolves.
            const commandToProcess = turnAction.commandString || turnAction.actionDefinitionId; // Fallback to actionId if no command string
            logger.debug(`${this.getStateName()}: Transitioning to ProcessingCommandState for actor ${actorId} with command/action: "${commandToProcess}".`);
            await turnCtx.requestTransition(ProcessingCommandState, [commandToProcess, turnAction]); // Pass both for flexibility

        } catch (error) {
            const errorMessage = `${this.getStateName()}: Error during strategy execution or transition for actor ${actorId}.`;
            logger.error(errorMessage, error);
            turnCtx.endTurn(new Error(`${errorMessage} Details: ${error.message}`));
        }
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [nextState]
     */
    async exitState(handler, nextState) {
        // No direct subscriptions to manage in this state anymore.
        // HumanPlayerStrategy will manage its own subscriptions if it uses them.
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger(); // Fallback logger
        logger.debug(`${this.getStateName()}: Exiting AwaitingPlayerInputState.`);
        await super.exitState(handler, nextState);
    }

    /**
     * @override
     * This method's role is significantly reduced or potentially removed.
     * If IActorTurnStrategy.decideAction() directly returns the ITurnAction,
     * this callback-style input handling is no longer the primary mechanism.
     * It's kept for now as a fallback or to handle unexpected calls, but should ideally become obsolete.
     * @param {BaseTurnHandler} handler
     * @param {string} commandString
     * @param {Entity} actorEntityFromSubscription - The entity instance from a potential outdated subscription.
     */
    async handleSubmittedCommand(handler, commandString, actorEntityFromSubscription) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : (handler ? handler.getLogger() : console);

        const actorIdForLog = actorEntityFromSubscription?.id || (turnCtx ? turnCtx.getActor()?.id : 'UnknownActor');

        logger.warn(
            `${this.getStateName()}: handleSubmittedCommand was called directly for actor ${actorIdForLog} with command "${commandString}". ` +
            `This is unexpected as input should be resolved via IActorTurnStrategy.decideAction(). ` +
            `Attempting to end turn with an error.`
        );

        const errorMsg = `Unexpected direct command submission in AwaitingPlayerInputState for actor ${actorIdForLog}. Input should be handled by strategy.`;
        if (turnCtx) {
            turnCtx.endTurn(new Error(errorMsg));
        } else if (handler) {
            // If no context, attempt a more forceful reset through the handler.
            logger.error(`${this.getStateName()}: No ITurnContext available to end turn. Forcing handler reset for actor ${actorIdForLog}.`);
            handler._resetTurnStateAndResources(`unexpected-command-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
        } else {
            // Very bad situation, no context, no handler.
            logger.error(`${this.getStateName()}: CRITICAL - No ITurnContext or handler available to process unexpected command for ${actorIdForLog}.`);
        }
    }


    /** @override */
    async handleTurnEndedEvent(handler, payload) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (!turnCtx) {
            logger.warn(`${this.getStateName()}: handleTurnEndedEvent received but no ITurnContext active. Payload for: ${payload?.entityId}.`);
            await super.handleTurnEndedEvent(handler, payload);
            return;
        }

        const currentActor = turnCtx.getActor();
        if (currentActor && payload && payload.entityId === currentActor.id) {
            logger.info(`${this.getStateName()}: core:turn_ended event received for current actor ${currentActor.id}. Ending turn via ITurnContext.`);
            const errorForTurnEnd = payload.error ? (payload.error instanceof Error ? payload.error : new Error(String(payload.error))) : null;
            turnCtx.endTurn(errorForTurnEnd);
        } else {
            logger.debug(`${this.getStateName()}: core:turn_ended event for entity ${payload?.entityId} (payload error: ${payload?.error}) ignored or not for current actor ${currentActor?.id}.`);
            await super.handleTurnEndedEvent(handler, payload);
        }
    }

    /** @override */
    async destroy(handler) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_at_destroy';

        logger.info(`${this.getStateName()}: Handler destroyed while awaiting input for ${actorId}.`);

        // No direct subscriptions to clean up here anymore.

        if (turnCtx) {
            const destroyError = new Error(`Turn handler destroyed while actor ${actorId} was in ${this.getStateName()}.`);
            logger.debug(`${this.getStateName()}: Notifying turn end for ${actorId} due to destruction via ITurnContext.`);
            turnCtx.endTurn(destroyError);
        } else {
            logger.warn(`${this.getStateName()}: Handler destroyed, but no active ITurnContext for actor ${actorId}. No specific turn to end via context.`);
        }
        await super.destroy(handler);
        logger.debug(`${this.getStateName()}: Destroy handling for ${actorId} complete.`);
    }
}

// --- FILE END ---