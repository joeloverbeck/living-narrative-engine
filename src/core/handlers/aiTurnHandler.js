// src/core/handlers/aiTurnHandler.js
// --- FILE START (Entire file content as requested) ---

// JSDoc type imports
/** @typedef {import('../../entities/entity.js').default} Entity */ // Corrected path
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */ // Corrected path
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */ // Corrected path
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */ // Corrected path
/** @typedef {import('../interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */ // Corrected path
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // Added import
// --- MODIFICATION START (Task 2 - Import IWorldContext) ---
/** @typedef {import('../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
// --- MODIFICATION END (Task 2 - Import IWorldContext) ---
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */ // Corrected path

/**
 * @class AITurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic for AI-controlled entities. Determines an action,
 * processes it via CommandProcessor, and dispatches semantic events:
 * 'core:ai_turn_processing_started', 'core:ai_turn_processing_ended', and 'core:turn_ended'.
 */
class AITurnHandler {
    /** @type {ILogger} */ #logger;
    /** @type {ICommandProcessor} */ #commandProcessor;
    /** @type {IValidatedEventDispatcher} */ #validatedEventDispatcher;
    /** @type {IActionDiscoverySystem | undefined} */ #actionDiscoverySystem; // Optional
    // --- MODIFICATION START (Task 2 - Add worldContext) ---
    /** @type {IWorldContext} */ #worldContext;

    // --- MODIFICATION END (Task 2 - Add worldContext) ---

    /**
     * Creates an instance of AITurnHandler.
     * @param {object} options - The options object.
     * @param {ILogger} options.logger - The logger instance.
     * @param {ICommandProcessor} options.commandProcessor - The command processor instance.
     * @param {IValidatedEventDispatcher} options.validatedEventDispatcher - The event dispatcher.
     * @param {IActionDiscoverySystem} [options.actionDiscoverySystem] - (Optional) The action discovery system.
     // --- MODIFICATION START (Task 2 - Add worldContext to constructor param) ---
     * @param {IWorldContext} options.worldContext - The world context instance.
     // --- MODIFICATION END (Task 2 - Add worldContext to constructor param) ---
     * @throws {Error} If essential dependencies (logger, commandProcessor, validatedEventDispatcher, worldContext) are missing or invalid.
     */
    // --- MODIFICATION START (Task 2 - Destructure worldContext) ---
    constructor({logger, commandProcessor, validatedEventDispatcher, worldContext, actionDiscoverySystem}) {
        // --- MODIFICATION END (Task 2 - Destructure worldContext) ---
        // Validate Logger first
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            console.error('AITurnHandler Constructor: Invalid or missing logger provided.');
            throw new Error('AITurnHandler requires a valid logger instance.');
        }
        this.#logger = logger;

        // Validate other required dependencies
        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            this.#logger.error('AITurnHandler Constructor: Invalid or missing commandProcessor.');
            throw new Error('AITurnHandler requires a valid commandProcessor instance.');
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            this.#logger.error('AITurnHandler Constructor: Invalid or missing validatedEventDispatcher.');
            throw new Error('AITurnHandler requires a valid validatedEventDispatcher instance.');
        }
        // --- MODIFICATION START (Task 2 - Validate worldContext) ---
        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function') {
            this.#logger.error('AITurnHandler Constructor: Invalid or missing worldContext (requires getLocationOfEntity).');
            throw new Error('AITurnHandler requires a valid worldContext instance.');
        }
        // --- MODIFICATION END (Task 2 - Validate worldContext) ---

        // Validate optional dependency
        if (actionDiscoverySystem && typeof actionDiscoverySystem.getValidActions !== 'function') {
            this.#logger.warn('AITurnHandler Constructor: Provided actionDiscoverySystem is invalid or missing getValidActions method.');
            this.#actionDiscoverySystem = undefined;
        } else {
            this.#actionDiscoverySystem = actionDiscoverySystem;
        }

        this.#commandProcessor = commandProcessor;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        // --- MODIFICATION START (Task 2 - Assign worldContext) ---
        this.#worldContext = worldContext;
        // --- MODIFICATION END (Task 2 - Assign worldContext) ---

        this.#logger.info('AITurnHandler initialized.');
    }

    /**
     * Handles the turn for an AI-controlled actor. Dispatches start/end processing events
     * and the turn end event.
     * @param {Entity} actor - The AI-controlled entity taking its turn.
     * @returns {Promise<void>} A promise that resolves when the turn handling is complete.
     * @throws {Error} If the actor is invalid or if command processing throws a critical error.
     */
    async handleTurn(actor) {
        const actorId = actor?.id; // Safely access id

        if (!actor || !actorId) {
            this.#logger.error('AITurnHandler: Attempted to handle turn for an invalid actor.');
            throw new Error('AITurnHandler: Actor must be a valid entity.');
        }

        this.#logger.info(`Starting AI turn processing for actor: ${actorId}`);

        // --- SEMANTIC EVENT DISPATCH: core:ai_turn_processing_started ---
        try {
            await this.#validatedEventDispatcher.dispatchValidated('core:ai_turn_processing_started', {entityId: actorId});
            this.#logger.debug(`Dispatched core:ai_turn_processing_started for ${actorId}.`);
        } catch (dispatchError) {
            this.#logger.error(`AITurnHandler: Failed to dispatch core:ai_turn_processing_started for ${actorId}: ${dispatchError.message}`, dispatchError);
            // Decide if this is critical enough to stop the turn. For now, log and continue.
        }
        // --- END SEMANTIC EVENT DISPATCH ---

        /** @type {CommandResult | null} */
        let cmdResult = null;
        let determinedCommandString = "wait"; // Placeholder

        try {
            // --- 1. AI Decision Making (Placeholder/Future Work) ---
            // TODO: Implement sophisticated AI decision-making using ActionDiscoverySystem, AI components etc.
            // For now, the AI simply decides to "wait".
            determinedCommandString = await this.#determineAIAction(actor); // Pass full actor
            this.#logger.debug(`AI actor ${actorId} determined command: "${determinedCommandString}"`);

            // --- 2. Delegate command processing ---
            this.#logger.debug(`AITurnHandler: Processing command '${determinedCommandString}' for actor ${actorId} via CommandProcessor.`);
            cmdResult = await this.#commandProcessor.processCommand(actor, determinedCommandString);

            // Log the outcome (CommandProcessor already dispatched action_executed/failed)
            this.#logger.info(
                `AITurnHandler: CommandProcessor result for AI ${actorId} command "${determinedCommandString}": ` +
                `Success=${cmdResult.success}, TurnEnded=${cmdResult.turnEnded}.`
            );
            if (!cmdResult.success) {
                this.#logger.warn(`AITurnHandler: Command failed for AI actor ${actorId}. See previous logs/events for details.`);
            }

            // Note: Turn always ends for AI after one command attempt in this simple model.
            // If cmdResult.turnEnded was false, we might log a warning or reconsider AI logic.
            if (cmdResult && !cmdResult.turnEnded) {
                this.#logger.warn(`AITurnHandler: AI command '${determinedCommandString}' processed but did not end turn according to CommandResult for actor ${actorId}. Turn will end anyway.`);
            }

        } catch (error) {
            // Catch critical errors *during* the decision or processing call
            this.#logger.error(`AITurnHandler: CRITICAL error during AI turn for actor ${actorId}: ${error.message}`, error);
            // Ensure finally block runs to dispatch end events, then rethrow
            throw error; // Propagate critical failure to TurnManager
        } finally {
            // --- 3. Dispatch End Events (Always Run) ---
            this.#logger.info(`AI turn processing complete for actor: ${actorId}. Dispatching end events.`);

            // --- SEMANTIC EVENT DISPATCH: core:ai_turn_processing_ended ---
            try {
                // Pass the actionResult part of the commandResult if available
                const actionResultPayload = cmdResult?.actionResult ?? null;
                await this.#validatedEventDispatcher.dispatchValidated('core:ai_turn_processing_ended', {
                    entityId: actorId,
                    actionResult: actionResultPayload // Can be null if command failed before action execution
                });
                this.#logger.debug(`Dispatched core:ai_turn_processing_ended for ${actorId}.`);
            } catch (dispatchError) {
                this.#logger.error(`AITurnHandler: Failed to dispatch core:ai_turn_processing_ended for ${actorId}: ${dispatchError.message}`, dispatchError);
            }
            // --- END SEMANTIC EVENT DISPATCH ---

            // --- SEMANTIC EVENT DISPATCH: core:turn_ended ---
            try {
                await this.#validatedEventDispatcher.dispatchValidated('core:turn_ended', {entityId: actorId});
                this.#logger.debug(`Dispatched core:turn_ended for ${actorId}.`);
            } catch (dispatchError) {
                this.#logger.error(`AITurnHandler: Failed to dispatch core:turn_ended for ${actorId}: ${dispatchError.message}`, dispatchError);
            }
            // --- END SEMANTIC EVENT DISPATCH ---

            this.#logger.info(`AI turn fully concluded for actor: ${actorId}.`);
            // The promise implicitly resolves here if no error was thrown and caught above.
        }
    }

    /**
     * Placeholder for future AI action determination logic.
     * @private
     * @param {Entity} actor The AI actor.
     * @returns {Promise<string>} The command string the AI decided on.
     */
    async #determineAIAction(actor) {
        // Example using ActionDiscoverySystem if available
        if (this.#actionDiscoverySystem) {
            try {
                // --- MODIFICATION START (Task 2 - Use worldContext) ---
                // Simplified context building for discovery
                // Use worldContext to get location by ID
                const currentLocation = await this.#worldContext.getLocationOfEntity(actor.id);
                // --- MODIFICATION END (Task 2 - Use worldContext) ---

                if (!currentLocation) {
                    this.#logger.warn(`AI ${actor.id} could not determine current location via worldContext. Falling back.`);
                    // Fall through to default action if location is unknown
                } else {
                    // Build context only if location was found
                    const context = {
                        actingEntity: actor,
                        currentLocation,
                        worldContext: this.#worldContext
                        // TODO: Add other needed context properties like entityManager, gameDataRepository if ActionDiscoverySystem requires them
                    };
                    const validActions = await this.#actionDiscoverySystem.getValidActions(actor, context);

                    if (validActions.length > 0) {
                        // TODO: Implement actual decision logic (e.g., pick highest priority, random)
                        const chosenAction = validActions.find(a => a.id === 'core:wait') || validActions[0]; // Prefer wait or take first
                        this.#logger.debug(`AI ${actor.id} discovered actions, choosing: ${chosenAction.id}`);
                        // TODO: Construct command string based on chosen action and potential targets/params
                        return chosenAction.id; // Return simple action ID for now
                    }
                }
            } catch (err) {
                this.#logger.error(`AI ${actor.id} failed during action discovery: ${err.message}`, err);
            }
        }
        // Default/fallback action
        this.#logger.debug(`AI ${actor.id} falling back to 'wait' action.`);
        return "wait";
    }

    /**
     * Gracefully shuts down the handler. (Currently no specific resources to release)
     * @public
     */
    destroy() {
        this.#logger.info('AITurnHandler: Destroying handler.');
        // No subscriptions or timers to clear in this version.
        this.#logger.info('AITurnHandler: Destruction complete.');
    }
}

export default AITurnHandler;
// --- FILE END ---