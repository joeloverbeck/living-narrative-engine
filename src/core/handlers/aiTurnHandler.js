// src/core/handlers/aiTurnHandler.js
// ****** CORRECTED FILE ******

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */ // <<< Added Import

/**
 * @class AITurnHandler
 * @extends ITurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic for AI-controlled entities. Determines an action,
 * processes it via CommandProcessor, signals turn completion via ITurnEndPort, and
 * dispatches semantic events: 'core:ai_turn_processing_started', 'core:ai_turn_processing_ended'.
 */
class AITurnHandler extends ITurnHandler {
    /** @type {ILogger} */ #logger;
    /** @type {ICommandProcessor} */ #commandProcessor;
    /** @type {IValidatedEventDispatcher} */ #validatedEventDispatcher; // Still useful for AI specific events
    /** @type {IActionDiscoverySystem | undefined} */ #actionDiscoverySystem; // Optional
    /** @type {IWorldContext} */ #worldContext;
    /** @type {ITurnEndPort} */ #turnEndPort; // <<< Added Dependency

    /**
     * Creates an instance of AITurnHandler.
     * @param {object} options - The options object.
     * @param {ILogger} options.logger - The logger instance.
     * @param {ICommandProcessor} options.commandProcessor - The command processor instance.
     * @param {IValidatedEventDispatcher} options.validatedEventDispatcher - For AI-specific events.
     * @param {IWorldContext} options.worldContext - The world context instance.
     * @param {ITurnEndPort} options.turnEndPort - Port to signal turn completion. // <<< Added Param
     * @param {IActionDiscoverySystem} [options.actionDiscoverySystem] - (Optional) The action discovery system.
     * @throws {Error} If essential dependencies are missing or invalid.
     */
    constructor({
                    logger, commandProcessor, validatedEventDispatcher,
                    worldContext, turnEndPort, actionDiscoverySystem // <<< Added turnEndPort
                }) {
        super();
        const className = this.constructor.name;
        // Validate Logger first
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            // Use console.error ONLY if logger is unavailable for proper logging
            console.error(`${className} Constructor: Invalid or missing logger provided.`);
            throw new Error(`${className} requires a valid logger instance.`);
        }
        this.#logger = logger;

        // Validate other required dependencies
        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandProcessor.`);
            throw new Error(`${className} requires a valid commandProcessor instance.`);
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing validatedEventDispatcher.`);
            throw new Error(`${className} requires a valid validatedEventDispatcher instance.`);
        }
        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing worldContext (requires getLocationOfEntity).`);
            throw new Error(`${className} requires a valid worldContext instance.`);
        }
        // <<< Added Validation for TurnEndPort >>>
        if (!turnEndPort || typeof turnEndPort.notifyTurnEnded !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).`);
            throw new Error(`${className}: Invalid or missing turnEndPort.`);
        }
        // <<< END Added Validation >>>

        // Validate optional dependency
        // Ensure actionDiscoverySystem is treated as undefined if null or not an object before checking method
        const isValidADS = actionDiscoverySystem && typeof actionDiscoverySystem === 'object' && typeof actionDiscoverySystem.getValidActions === 'function';
        if (actionDiscoverySystem && !isValidADS) { // Only warn if it was provided but invalid
            this.#logger.warn(`${className} Constructor: Provided actionDiscoverySystem is invalid (must be an object with getValidActions method). Storing undefined.`);
            this.#actionDiscoverySystem = undefined;
        } else if (isValidADS) {
            this.#actionDiscoverySystem = actionDiscoverySystem;
        } else {
            this.#actionDiscoverySystem = undefined; // Explicitly undefined if not provided or null etc.
        }


        this.#commandProcessor = commandProcessor;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#worldContext = worldContext;
        this.#turnEndPort = turnEndPort; // <<< Added Assignment

        this.#logger.info(`${className} initialized.`);
    }

    /**
     * Initiates and handles the turn for an AI-controlled actor. Determines an action,
     * processes it, and notifies the TurnEndPort upon completion or error.
     * Dispatches 'core:ai_turn_processing_started' and 'core:ai_turn_processing_ended'.
     * @param {Entity} actor - The AI-controlled entity taking its turn.
     * @returns {Promise<void>} A promise that resolves when the turn initiation and processing attempt is complete.
     * @throws {Error} If the actor is invalid. Critical processing errors are handled internally via TurnEndPort.
     * @override // Overrides ITurnHandler.startTurn
     */
    async startTurn(actor) { // <<< Renamed from handleTurn
        const actorId = actor?.id; // Safely access id
        const className = this.constructor.name;

        // --- Actor Validation ---
        // Use instanceof Entity for more robust checking if Entity class is consistently used
        if (!(actor instanceof Entity) || !actorId) {
            const actorInfo = actor ? (actorId ?? typeof actor) : String(actor);
            this.#logger.error(`${className}: Attempted to start turn for an invalid actor: ${actorInfo}`);
            // If actor is invalid, we cannot notify completion properly. Throw early.
            throw new Error(`${className}: Actor must be a valid entity instance.`);
        }

        this.#logger.info(`${className}: Starting AI turn processing for actor: ${actorId}`);

        // --- Dispatch Start Event ---
        // Pass actorId directly, ensuring it's valid from check above
        await this.#dispatchSafely('core:ai_turn_processing_started', {entityId: actorId}, actorId, 'ai_turn_processing_started');

        /** @type {CommandResult | null} */
        let cmdResult = null;
        let determinedCommandString = "wait"; // Default command
        let turnSuccess = false; // Assume failure until proven otherwise

        try {
            // --- 1. AI Decision Making ---
            this.#logger.debug(`${className}: Determining action for AI actor ${actorId}.`);
            determinedCommandString = await this.#determineAIAction(actor);
            this.#logger.debug(`${className}: AI actor ${actorId} determined command: "${determinedCommandString}"`);

            // --- 2. Delegate command processing ---
            this.#logger.debug(`${className}: Processing command '${determinedCommandString}' for actor ${actorId} via CommandProcessor.`);
            cmdResult = await this.#commandProcessor.processCommand(actor, determinedCommandString);

            // --- 3. Determine Turn Success ---
            // Turn is successful IF AND ONLY IF:
            // a) The command processor successfully parsed/initiated the command (cmdResult.success is true)
            // b) The resulting action (if any) completed successfully (cmdResult.actionResult.success is true)
            const processSuccess = cmdResult.success;
            // Action success defaults to false if actionResult is null/undefined or lacks a success property
            const actionOutcomeSuccess = cmdResult.actionResult?.success === true;
            turnSuccess = processSuccess && actionOutcomeSuccess;

            this.#logger.info(
                `${className}: CommandProcessor result for AI ${actorId} (Cmd: "${determinedCommandString}"): ` +
                `ProcessSuccess=${processSuccess}, ActionSuccess=${actionOutcomeSuccess}, TurnEndedByAction=${cmdResult.turnEnded ?? 'N/A'}. ` +
                `=> Final Turn Success=${turnSuccess}`
            );

            if (!turnSuccess) {
                const failureReason = !processSuccess ? `Processing failed (${cmdResult.error || cmdResult.message})` : `Action failed (${cmdResult.actionResult?.reason || 'Unknown reason'})`;
                this.#logger.warn(`${className}: AI turn for ${actorId} concluded with failure. Reason: ${failureReason}. Result: ${JSON.stringify(cmdResult)}`);
            }

        } catch (error) {
            // Catch critical errors *during* the decision or processing steps
            this.#logger.error(`${className}: CRITICAL error during AI turn processing for actor ${actorId}: ${error.message}`, error);
            // Ensure finally block runs to dispatch end events and notify port
            turnSuccess = false; // Ensure turn is marked as failure
            // Optionally add minimal cmdResult for logging/event dispatch if needed
            cmdResult = cmdResult || {
                success: false,
                turnEnded: false,
                actionResult: null,
                error: 'Critical internal error',
                internalError: error
            };
        } finally {
            // --- 4. Post-Processing (Always Run) ---
            this.#logger.info(`${className}: AI turn processing logic complete for actor: ${actorId}. Notifying TurnEndPort (Success: ${turnSuccess}) and dispatching end event.`);

            // Dispatch AI specific end event (use result from try block, or minimal error result from catch)
            const actionResultPayload = cmdResult?.actionResult ?? null; // Can be null
            await this.#dispatchSafely('core:ai_turn_processing_ended', {
                entityId: actorId,
                actionResult: actionResultPayload
            }, actorId, 'ai_turn_processing_ended');

            // <<< Notify TurnEndPort (Crucial step) >>>
            try {
                await this.#turnEndPort.notifyTurnEnded(actorId, turnSuccess);
                this.#logger.debug(`${className}: Notified TurnEndPort successfully for ${actorId} (Success: ${turnSuccess}).`);
            } catch (notifyError) {
                // This is a critical failure; the game loop might stall.
                this.#logger.error(`${className}: CRITICAL - Failed to notify TurnEndPort for ${actorId} (Success: ${turnSuccess}): ${notifyError.message}. TurnManager may stall.`, notifyError);
            }
            // <<< END Notify >>>

            // Responsibility of TurnManager (reacting to notifyTurnEnded) to dispatch 'core:turn_ended'

            this.#logger.info(`${className}: AI turn fully concluded for actor: ${actorId}.`);
        }
        // The method itself resolves once notification is attempted. Does not return success/failure status.
    }

    /**
     * Determines the action command string for the AI actor.
     * Uses ActionDiscoverySystem if available, otherwise falls back to 'wait'.
     * @private
     * @param {Entity} actor - The AI actor.
     * @returns {Promise<string>} The command string the AI decided on.
     */
    async #determineAIAction(actor) {
        const actorId = actor.id;
        const className = this.constructor.name;

        // Attempt to use ActionDiscoverySystem if it was provided and valid
        if (this.#actionDiscoverySystem) {
            try {
                this.#logger.debug(`${className}: Attempting action discovery for AI ${actorId}.`);
                const currentLocation = await this.#worldContext.getLocationOfEntity(actorId);

                if (!currentLocation) {
                    this.#logger.warn(`${className}: AI ${actorId} could not determine current location via worldContext. Action discovery may be limited. Falling back.`);
                    // Decide if fallback is appropriate or if discovery can proceed without location
                }

                // Build context for ActionDiscoverySystem (adapt as needed)
                const context = {
                    actingEntity: actor,
                    currentLocation: currentLocation || null, // Pass null if not found
                    worldContext: this.#worldContext,
                    entityManager: null, // Placeholder - Inject if needed by specific ADS rules
                    gameDataRepository: null, // Placeholder - Inject if needed
                    logger: this.#logger, // Pass logger for potential use within actions/discovery
                    dispatch: this.#validatedEventDispatcher.dispatchValidated.bind(this.#validatedEventDispatcher) // Allow discovery logic to dispatch events if necessary
                };

                const validActions = await this.#actionDiscoverySystem.getValidActions(actor, context);
                this.#logger.debug(`${className}: AI ${actorId} discovered ${validActions.length} valid actions.`);

                if (validActions.length > 0) {
                    // --- AI Decision Logic ---
                    // Example: Prioritize 'wait', then take the first other action. Replace with more sophisticated logic.
                    const waitAction = validActions.find(a => a.id === 'core:wait');
                    const chosenActionInfo = waitAction || validActions[0]; // Simple fallback to first action

                    // Use the 'command' property if provided, otherwise fallback to the action 'id' as the command
                    const command = chosenActionInfo.command || chosenActionInfo.id;
                    this.#logger.info(`${className}: AI ${actorId} chose action: '${command}' (from action ID: ${chosenActionInfo.id})`);
                    return command;
                    // --- End AI Decision Logic ---

                } else {
                    this.#logger.debug(`${className}: AI ${actorId} discovered no valid actions. Falling back.`);
                }

            } catch (err) {
                this.#logger.error(`${className}: AI ${actorId} encountered an error during action discovery: ${err.message}. Falling back.`, err);
                // Fall through to default action on error
            }
        } else {
            this.#logger.debug(`${className}: No ActionDiscoverySystem available for AI ${actorId}.`);
        }

        // Default/fallback action if ADS is missing, fails, or returns no actions
        this.#logger.debug(`${className}: AI ${actorId} falling back to 'wait' action.`);
        return "wait";
    }

    /**
     * Helper to safely dispatch events using the validated dispatcher, with improved logging.
     * @private
     * @param {string} eventName - The name of the event.
     * @param {object} payload - The event payload (should include entityId).
     * @param {string} actorId - The ID of the actor involved (for logging).
     * @param {string} contextName - A descriptive name for the event context (for logging).
     * @returns {Promise<void>}
     */
    async #dispatchSafely(eventName, payload, actorId, contextName) {
        const className = this.constructor.name;
        try {
            await this.#validatedEventDispatcher.dispatchValidated(eventName, payload);
            this.#logger.debug(`${className}: Dispatched ${contextName} event successfully for actor ${actorId}.`);
        } catch (dispatchError) {
            // Log failure but don't let it stop the turn processing flow
            this.#logger.error(`${className}: Failed to dispatch ${contextName} event for actor ${actorId}: ${dispatchError.message}`, dispatchError);
        }
    }

    /**
     * Gracefully shuts down the handler. Logs the action.
     * (Currently no specific resources like timers or subscriptions to release).
     * @public
     * @override // Overrides ITurnHandler.destroy
     */
    destroy() {
        const className = this.constructor.name;
        this.#logger.info(`${className}: Destroying handler.`);
        // --- Resource Cleanup (if any) ---
        // e.g., clearTimeout(this.#someTimer);
        // e.g., this.#eventBus.unsubscribe(this.#listener);
        // Currently, no stateful resources managed directly by this handler instance require cleanup.
        // Dependencies are managed externally.
        // --- End Resource Cleanup ---
        this.#logger.info(`${className}: Destruction complete.`);
    }
}

export default AITurnHandler;