// src/turns/strategies/aiPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import {IActorTurnStrategy} from '../interfaces/IActorTurnStrategy.js';

/**
 * Default/Fallback ITurnAction to be used when the strategy cannot produce a valid action due to an internal error.
 * @type {Readonly<ITurnAction>}
 */
const FALLBACK_AI_ACTION = Object.freeze({
    actionDefinitionId: 'core:ai_error_fallback_wait', // Or a more specific "AI error" action
    commandString: 'AI Error: Fallback action (wait)',
    resolvedParameters: {errorContext: 'unknown_error'},
});

/**
 * @class AIPlayerStrategy
 * @implements {IActorTurnStrategy}
 * @description Implements the IActorTurnStrategy for AI-controlled actors.
 * This class is responsible for an AI actor's decision-making process during its turn.
 * It generates a game summary from the ITurnContext, passes it to an ILLMAdapter,
 * parses the LLM's JSON response, and transforms it into a valid ITurnAction.
 * Includes comprehensive error handling to return a fallback action on failure.
 */
export class AIPlayerStrategy extends IActorTurnStrategy {
    /**
     * @private
     * @type {ILLMAdapter}
     */
    #llmAdapter;

    /**
     * Creates an instance of AIPlayerStrategy.
     * @param {object} dependencies - The dependencies for this strategy.
     * @param {ILLMAdapter} dependencies.llmAdapter - The adapter for communicating with the LLM.
     * @throws {Error} If llmAdapter is not provided or is invalid.
     */
    constructor({llmAdapter}) {
        super();
        if (!llmAdapter || typeof llmAdapter.generateAction !== 'function') {
            const errorMsg = "AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.";
            console.error(errorMsg, {providedAdapter: llmAdapter}); // Console log as logger might not be available
            throw new Error(errorMsg);
        }
        this.#llmAdapter = llmAdapter;
    }

    /**
     * @private
     * Safely gets the logger from the context or returns a console fallback.
     * @param {ITurnContext | null | undefined} context - The turn context.
     * @returns {ILogger} A logger instance.
     */
    _getSafeLogger(context) {
        try {
            if (context && typeof context.getLogger === 'function') {
                const logger = context.getLogger();
                if (logger && typeof logger.error === 'function') {
                    return logger;
                }
            }
        } catch (e) {
            console.error("AIPlayerStrategy: Error retrieving logger from context, using console. Error:", e);
        }
        // Fallback logger
        return {
            info: console.info.bind(console, "[AIPlayerStrategy (fallback logger)]"),
            warn: console.warn.bind(console, "[AIPlayerStrategy (fallback logger)]"),
            error: console.error.bind(console, "[AIPlayerStrategy (fallback logger)]"),
            debug: console.debug.bind(console, "[AIPlayerStrategy (fallback logger)]"),
        };
    }

    /**
     * @private
     * Generates a fallback ITurnAction with a specific error context.
     * @param {string} errorContext - A string describing the error.
     * @param {string} [actorId='UnknownActor'] - The ID of the actor for logging purposes.
     * @returns {ITurnAction} The fallback ITurnAction.
     */
    _createFallbackAction(errorContext, actorId = 'UnknownActor') {
        // No logger call here, as the calling function should have logged the detailed error.
        // This function just constructs the action.
        return {
            ...FALLBACK_AI_ACTION,
            commandString: `AI Error for ${actorId}: ${errorContext}. Waiting.`,
            resolvedParameters: {
                ...FALLBACK_AI_ACTION.resolvedParameters,
                errorContext: errorContext,
                actorId: actorId, // Add actorId for easier debugging from action
            },
        };
    }


    /**
     * @private
     * Validates the parsed LLM output and transforms it into an ITurnAction.
     * If validation fails, it logs the error and returns a specific fallback action.
     * @param {any} parsedJson - The parsed JSON object from the LLM.
     * @param {string} actorId - The ID of the actor for logging purposes.
     * @param {ILogger} logger - The logger instance.
     * @returns {ITurnAction} A valid ITurnAction or a fallback action on validation failure.
     */
    _transformAndValidateLLMOutput(parsedJson, actorId, logger) {
        if (!parsedJson || typeof parsedJson !== 'object') {
            logger.error(`AIPlayerStrategy: LLM output for actor ${actorId} is not a valid object after parsing. Received:`, parsedJson);
            return this._createFallbackAction('invalid_llm_output_type', actorId);
        }

        const {actionDefinitionId, resolvedParameters, commandString} = parsedJson;

        if (typeof actionDefinitionId !== 'string' || actionDefinitionId.trim() === '') {
            logger.error(`AIPlayerStrategy: Invalid or missing 'actionDefinitionId' in LLM output for actor ${actorId}. Received:`, parsedJson);
            return this._createFallbackAction('missing_or_invalid_actionDefinitionId', actorId);
        }

        let finalResolvedParameters = resolvedParameters;
        if (typeof resolvedParameters !== 'object' || resolvedParameters === null) {
            logger.warn(`AIPlayerStrategy: 'resolvedParameters' in LLM output for actor ${actorId} is not an object or is null. Defaulting to empty object. Received:`, parsedJson);
            finalResolvedParameters = {};
        }

        const finalAction = {
            actionDefinitionId: actionDefinitionId.trim(),
            resolvedParameters: finalResolvedParameters,
            commandString: (typeof commandString === 'string' && commandString.trim() !== '') ? commandString.trim() : `AI Action: ${actionDefinitionId.trim()}`,
        };

        logger.info(`AIPlayerStrategy: Successfully transformed LLM output to ITurnAction for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`);
        logger.debug(`AIPlayerStrategy: Transformed ITurnAction details for ${actorId}:`, finalAction);
        return finalAction;
    }


    /**
     * Determines the action an AI actor will take for the current turn.
     * It extracts relevant information from the ITurnContext to compile a
     * "minimal game summary", logs this summary, passes it to an ILLMAdapter,
     * logs the LLM's JSON response, parses and validates it, and then returns
     * a transformed ITurnAction. Includes comprehensive error handling.
     *
     * @async
     * @param {ITurnContext} context - The turn context for the current turn.
     * @returns {Promise<ITurnAction>} A Promise that resolves to an ITurnAction object,
     * potentially a fallback action if errors occur.
     */
    async decideAction(context) {
        const logger = this._getSafeLogger(context);
        let actor;
        let actorId = 'UnknownActor';

        try {
            // 1. ITurnContext Issues: Actor and Logger
            if (!context) {
                logger.error("AIPlayerStrategy: Critical - ITurnContext is null or undefined.");
                return this._createFallbackAction('null_turn_context');
            }
            actor = context.getActor(); // Attempt to get actor
            if (!actor || !actor.id) {
                logger.error("AIPlayerStrategy: Critical - Actor not available or ID missing in ITurnContext.");
                return this._createFallbackAction('missing_actor_in_context');
            }
            actorId = actor.id;
            logger.info(`AIPlayerStrategy: decideAction called for actor ${actorId}.`);

            // --- Game Summary Generation ---
            /** @typedef {object} ActorSummary */
            /** @typedef {object} VisibleEntitySummary */
            /** @typedef {object} LocationSummary */
            /** @typedef {object} MinimalGameSummary */
            /** @type {MinimalGameSummary} */
            const gameSummary = {
                actor: {id: actorId, name: actor.name || 'N/A'},
                visibleEntities: [],
                location: {},
                objectives: [],
                errors: [], // To collect errors during summary generation
            };
            const addSummaryError = (message) => {
                logger.warn(`AIPlayerStrategy: Error generating game summary for ${actorId}: ${message}`);
                if (gameSummary.errors) gameSummary.errors.push(message);
            };

            try {
                // Actor details
                if (typeof actor.getHealth === 'function') gameSummary.actor.health = actor.getHealth();
                else logger.debug(`AIPlayerStrategy: Actor ${actorId} does not have a getHealth method.`);
                if (typeof actor.getStatusEffects === 'function') gameSummary.actor.statusEffects = actor.getStatusEffects();
                else logger.debug(`AIPlayerStrategy: Actor ${actorId} does not have getStatusEffects method.`);

                // Game service interactions
                const gameService = context.getGame(); // May throw if context.getGame() fails
                if (typeof gameService.getVisibleEntities === 'function') {
                    const visible = gameService.getVisibleEntities(actorId);
                    gameSummary.visibleEntities = visible.map(entity => ({
                        id: entity.id,
                        type: entity.type || 'unknown',
                    }));
                } else addSummaryError("gameService.getVisibleEntities is not a function.");

                if (typeof gameService.getLocationInfo === 'function' && typeof actor.getCurrentLocationId === 'function') {
                    const locationId = actor.getCurrentLocationId();
                    if (locationId) {
                        const locInfo = gameService.getLocationInfo(locationId);
                        gameSummary.location = {
                            name: locInfo.name || 'Unknown Location',
                            description: locInfo.description || 'No description.'
                        };
                    } else addSummaryError("Actor's current location ID is unknown.");
                } else addSummaryError("gameService.getLocationInfo or actor.getCurrentLocationId is not available.");

                // Objectives
                if (typeof actor.getObjectives === 'function') gameSummary.objectives = actor.getObjectives();
                else logger.debug(`AIPlayerStrategy: Actor ${actorId} does not have getObjectives method.`);

            } catch (summaryGenError) {
                addSummaryError(`Failed during game summary data retrieval: ${summaryGenError.message}`);
                logger.error(`AIPlayerStrategy: Exception during game summary generation for ${actorId}. Summary may be incomplete. Error: ${summaryGenError.message}`, summaryGenError);
                // Continue with potentially incomplete summary, or return fallback if gameService itself failed.
                // If context.getGame() threw, gameService would be undefined, caught by general try-catch.
            }

            logger.info(`AIPlayerStrategy: Generated game summary for actor ${actorId}:`, gameSummary);
            const gameSummaryString = JSON.stringify(gameSummary); // This could throw if summary has circular refs, though unlikely here
            logger.debug(`AIPlayerStrategy: Stringified game summary for actor ${actorId}: ${gameSummaryString}`);


            // --- Call ILLMAdapter.generateAction ---
            /** @type {LLMActorContext} */
            const actorSpecificContext = {
                actorId: actorId,
                name: actor.name || undefined,
            };
            logger.debug(`AIPlayerStrategy: Constructed actorSpecificContext for LLM for actor ${actorId}:`, actorSpecificContext);

            let llmJsonOutput;
            try {
                logger.info(`AIPlayerStrategy: Calling llmAdapter.generateAction for actor ${actorId}.`);
                llmJsonOutput = await this.#llmAdapter.generateAction(gameSummaryString, actorSpecificContext);
                logger.info(`AIPlayerStrategy: Received JSON response from LLM for actor ${actorId}: ${llmJsonOutput}`);
            } catch (llmError) {
                logger.error(`AIPlayerStrategy: Error calling llmAdapter.generateAction for actor ${actorId}: ${llmError.message}`, llmError);
                return this._createFallbackAction(`llm_adapter_failure: ${llmError.message}`, actorId);
            }

            // --- JSON Parsing ---
            let parsedJson;
            try {
                parsedJson = JSON.parse(llmJsonOutput);
                logger.debug(`AIPlayerStrategy: Successfully parsed LLM JSON for actor ${actorId}.`);
            } catch (parseError) {
                logger.error(`AIPlayerStrategy: Failed to parse JSON from LLM for actor ${actorId}. JSON: "${llmJsonOutput}". Error: ${parseError.message}`, parseError);
                return this._createFallbackAction(`llm_json_parse_failure: ${parseError.message}`, actorId);
            }

            // --- Transformation and Validation ---
            // _transformAndValidateLLMOutput now handles its own logging and returns a fallback if needed.
            return this._transformAndValidateLLMOutput(parsedJson, actorId, logger);

        } catch (error) {
            // Catch-all for unexpected errors not caught by specific try-catch blocks above
            // (e.g., context.getGame() fails, JSON.stringify fails)
            const mainErrorMsg = `AIPlayerStrategy: Unhandled error during decideAction for actor ${actorId}: ${error.message}`;
            logger.error(mainErrorMsg, error);
            return this._createFallbackAction(`unhandled_decide_action_error: ${error.message}`, actorId);
        }
    }
}

// --- FILE END ---