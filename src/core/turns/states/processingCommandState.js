import {AbstractTurnState} from './abstractTurnState.js';
import {TurnIdleState} from './turnIdleState.js';
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';
import {SYSTEM_ERROR_OCCURRED_ID} from '../../constants/eventIds.js'; // Assuming eventIds are in a constants file

/**
 * @description State responsible for processing a submitted command string.
 * It uses ICommandProcessor, interprets the outcome with ICommandOutcomeInterpreter,
 * and then delegates to an appropriate ITurnDirectiveStrategy.
 * All operations are performed exclusively through the ITurnContext interface.
 */
export class ProcessingCommandState extends AbstractTurnState {
    /**
     * @type {string}
     * @private
     */
    _commandString;

    /**
     * @type {boolean}
     * @private
     */
    _isProcessing = false;

    /**
     * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handler The turn handler.
     * @param {string} commandString The command string to process.
     */
    constructor(handler, commandString) {
        super(handler);
        this._commandString = commandString;
        this._isProcessing = false;
    }

    /**
     * @override
     * @async
     * @param {string} [previousStateId=null]
     * @returns {Promise<void>}
     */
    async enterState(previousStateId = null) {
        this._isProcessing = true;
        const turnCtx = this._getTurnContext();

        if (!turnCtx || !turnCtx.isValid()) {
            const logger = turnCtx?.getLogger() ?? console; // Fallback logger
            logger.warn('ProcessingCommandState: Invalid turn context on enter. Attempting to reset and idle.');
            if (turnCtx && typeof turnCtx.endTurn === 'function') {
                await turnCtx.endTurn(new Error('Invalid context during command processing initiation.'));
            } else {
                // Fallback if context is too broken to even end turn
                this._handler._resetTurnStateAndResources(); // Potentially problematic if _handler doesn't have this directly
                this._handler._transitionToState(new TurnIdleState(this._handler)); // or via a context request if available
            }
            this._isProcessing = false;
            return;
        }

        const logger = turnCtx.getLogger();
        logger.debug(`Entering ProcessingCommandState with command: "${this._commandString}" for actor: ${turnCtx.getActor()?.getId()}`);

        const actor = turnCtx.getActor();
        if (!actor) {
            logger.error('ProcessingCommandState: No actor found in turn context. Ending turn.');
            await this.#handleProcessingException(turnCtx, new Error('No actor present at the start of command processing.'));
            this._isProcessing = false;
            return;
        }

        // Asynchronously process the command without blocking enterState
        this._processCommandInternal(turnCtx, actor, this._commandString)
            .catch(error => {
                // This catch is a safety net. #handleProcessingException should ideally be called within _processCommandInternal
                const currentTurnCtx = this._getTurnContext(); // Re-fetch context
                this.#handleProcessingException(currentTurnCtx ?? turnCtx, error);
            })
            .finally(() => {
                this._isProcessing = false;
            });
    }

    /**
     * @override
     * @async
     * @returns {Promise<void>}
     */
    async exitState() {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx?.getLogger() ?? console;
        logger.debug(`Exiting ProcessingCommandState for actor: ${turnCtx?.getActor()?.getId()}`);
        // If processing was somehow interrupted and exitState is called, ensure turn ends.
        if (this._isProcessing && turnCtx && turnCtx.isValid()) {
            logger.warn('ProcessingCommandState: Exiting while still marked as processing. Attempting to end turn.');
            await turnCtx.endTurn(new Error('ProcessingCommandState exited prematurely.'));
        }
        this._isProcessing = false;
    }

    /**
     * @override
     * @async
     * @returns {Promise<void>}
     */
    async destroy() {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx?.getLogger() ?? console;
        logger.debug(`Destroying ProcessingCommandState for actor: ${turnCtx?.getActor()?.getId()}`);

        if (this._isProcessing && turnCtx && turnCtx.isValid()) {
            logger.warn('ProcessingCommandState: Destroyed during active processing. Ending turn.');
            await turnCtx.endTurn(new Error('Command processing was destroyed mid-operation.'));
        }
        this._isProcessing = false;
        // Pass the handler to the superclass's destroy method
        if (super.destroy) { // Check if super.destroy exists
            await super.destroy(this._handler); // Pass this._handler
        }
    }

    /**
     * @returns {import('../interfaces/ITurnContext.js').ITurnContext | null}
     * @protected
     */
    _getTurnContext() {
        // Assuming BaseTurnHandler provides getTurnContext()
        return this._handler.getTurnContext();
    }

    /**
     * Orchestrates the command processing pipeline.
     * @param {import('../interfaces/ITurnContext.js').ITurnContext} turnCtx The turn context.
     * @param {import('../../actors/actor.js').Actor} actor The current actor.
     * @param {string} commandString The command to process.
     * @returns {Promise<void>}
     * @private
     */
    async _processCommandInternal(turnCtx, actor, commandString) {
        const logger = turnCtx.getLogger();
        logger.info(`Processing command "${commandString}" for actor ${actor.getId()}`);

        try {
            // 1. Validate context and actor (re-check after potential await in enterState if any)
            let currentTurnCtx = this._getTurnContext();
            if (!currentTurnCtx || !currentTurnCtx.isValid() || currentTurnCtx.getActor()?.getId() !== actor.getId()) {
                logger.warn(`ProcessingCommandState: Turn context invalidated or actor changed mid-processing for ${actor.getId()}. Original turn will be ended.`);
                if (turnCtx && turnCtx.isValid() && typeof turnCtx.endTurn === 'function') { // Original context
                    await turnCtx.endTurn(new Error('Actor context became invalid during command processing.'));
                }
                // If currentTurnCtx is what changed, the new actor's turn (if any) is not our concern here.
                return;
            }
            // Use the most current context from here
            turnCtx = currentTurnCtx;


            // 2. Get Command Processor
            const commandProcessor = turnCtx.getCommandProcessor();
            if (!commandProcessor) {
                throw new Error('ICommandProcessor not available from ITurnContext.');
            }

            // 3. Process Command
            const processingResult = await commandProcessor.process(turnCtx, actor, commandString);

            // 4. Re-validate context and actor after await
            currentTurnCtx = this._getTurnContext();
            if (!currentTurnCtx || !currentTurnCtx.isValid() || currentTurnCtx.getActor()?.getId() !== actor.getId()) {
                logger.warn(`ProcessingCommandState: Turn context invalidated or actor changed post-command-processing for ${actor.getId()}. Original turn ending.`);
                if (turnCtx && turnCtx.isValid() && typeof turnCtx.endTurn === 'function') { // Original context at the start of this method
                    await turnCtx.endTurn(new Error('Actor context became invalid after command processing.'));
                }
                return;
            }
            turnCtx = currentTurnCtx; // Use the latest

            // 5. Get Command Outcome Interpreter
            const outcomeInterpreter = turnCtx.getCommandOutcomeInterpreter();
            if (!outcomeInterpreter) {
                throw new Error('ICommandOutcomeInterpreter not available from ITurnContext.');
            }

            // 6. Interpret Outcome
            const directiveType = outcomeInterpreter.interpret(processingResult);
            logger.debug(`Command processing for "${commandString}" resulted in directive: ${directiveType}`);

            // 7. Resolve and Execute Strategy
            const strategy = TurnDirectiveStrategyResolver.resolveStrategy(directiveType);
            if (!strategy) {
                throw new Error(`No ITurnDirectiveStrategy found for directive: ${directiveType}`);
            }

            if (processingResult.success) {
                await this._handleProcessorSuccess(turnCtx, actor, directiveType, strategy, processingResult);
            } else {
                await this._handleProcessorFailure(turnCtx, actor, directiveType, strategy, processingResult);
            }

        } catch (error) {
            // Ensure we use the context that was active when the error is caught,
            // or the initial context if re-fetch fails.
            const errorHandlingCtx = this._getTurnContext() || turnCtx;
            await this.#handleProcessingException(errorHandlingCtx, error);
        }
    }

    /**
     * Handles successful command processing outcomes by executing the resolved strategy.
     * @param {import('../interfaces/ITurnContext.js').ITurnContext} turnCtx
     * @param {import('../../actors/actor.js').Actor} actor
     * @param {string} directiveType
     * @param {import('../strategies/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} strategy
     * @param {object} cmdProcResult The result from ICommandProcessor.
     * @returns {Promise<void>}
     * @protected
     */
    async _handleProcessorSuccess(turnCtx, actor, directiveType, strategy, cmdProcResult) {
        const logger = turnCtx.getLogger();
        logger.debug(`Handling successful command processing. Strategy: ${strategy.constructor.name}, Directive: ${directiveType}`);
        await strategy.execute(turnCtx, actor, directiveType, cmdProcResult);
    }

    /**
     * Handles failed command processing outcomes by executing the resolved strategy.
     * @param {import('../interfaces/ITurnContext.js').ITurnContext} turnCtx
     * @param {import('../../actors/actor.js').Actor} actor
     * @param {string} directiveType
     * @param {import('../strategies/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} strategy
     * @param {object} cmdProcResult The result from ICommandProcessor.
     * @returns {Promise<void>}
     * @protected
     */
    async _handleProcessorFailure(turnCtx, actor, directiveType, strategy, cmdProcResult) {
        const logger = turnCtx.getLogger();
        logger.warn(`Handling failed command processing. Strategy: ${strategy.constructor.name}, Directive: ${directiveType}, Error: ${cmdProcResult.error}`);
        await strategy.execute(turnCtx, actor, directiveType, cmdProcResult);
    }

    /**
     * Handles exceptions that occur during command processing.
     * @param {import('../interfaces/ITurnContext.js').ITurnContext} turnCtx The turn context.
     * @param {Error} error The error that occurred.
     * @returns {Promise<void>}
     * @private
     */
    async #handleProcessingException(turnCtx, error) {
        // Validate turnCtx *before* using it, especially if it was re-fetched.
        if (!turnCtx || typeof turnCtx.getLogger !== 'function' || typeof turnCtx.getSafeEventDispatcher !== 'function' || typeof turnCtx.endTurn !== 'function') {
            console.error('ProcessingCommandState: Critical error - Invalid turn context during exception handling. Cannot dispatch event or end turn properly.', error);
            // Attempt a more primitive cleanup if handler is available and has the method
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function') {
                this._handler._resetTurnStateAndResources();
                this._handler._transitionToState(new TurnIdleState(this._handler));
            }
            this._isProcessing = false; // Ensure state is reset
            return;
        }

        const logger = turnCtx.getLogger();
        logger.error(`Error during command processing: ${error.message}`, error);

        const eventDispatcher = turnCtx.getSafeEventDispatcher();
        if (eventDispatcher) {
            try {
                await eventDispatcher.dispatchSafely(SYSTEM_ERROR_OCCURRED_ID, {
                    error: error,
                    message: `System error during command processing for actor ${turnCtx.getActor()?.getId()}: ${error.message}`,
                    actorId: turnCtx.getActor()?.getId(),
                    turnState: this.constructor.name,
                });
            } catch (dispatchError) {
                logger.error(`Failed to dispatch system error event: ${dispatchError.message}`, dispatchError);
            }
        } else {
            logger.warn('ProcessingCommandState: ISafeEventDispatcher not available from ITurnContext. Cannot dispatch SYSTEM_ERROR_OCCURRED_ID.');
        }

        // End the turn
        if (turnCtx.isValid()) { // Check validity before ending
            await turnCtx.endTurn(error);
        } else {
            logger.warn('ProcessingCommandState: Turn context became invalid before explicit turn end in exception handler.');
            // Fallback if context is too broken but was minimally valid at start of this method
            if (this._handler && typeof this._handler._resetTurnStateAndResources === 'function') {
                this._handler._resetTurnStateAndResources();
                this._handler._transitionToState(new TurnIdleState(this._handler));
            }
        }
        this._isProcessing = false; // Ensure state is reset
    }

    /**
     * @override
     * @returns {string}
     */
    get id() {
        return 'ProcessingCommand';
    }
}