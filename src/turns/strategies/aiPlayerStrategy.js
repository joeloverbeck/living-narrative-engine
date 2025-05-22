// src/turns/strategies/aiPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */


import {IActorTurnStrategy} from '../interfaces/IActorTurnStrategy.js';
import {
    DESCRIPTION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    NAME_COMPONENT_ID,
    PERCEPTION_LOG_COMPONENT_ID,
    POSITION_COMPONENT_ID
} from "../../constants/componentIds.js";

/**
 * Default/Fallback ITurnAction to be used when the strategy cannot produce a valid action due to an internal error.
 * @type {Readonly<ITurnAction>}
 */
const FALLBACK_AI_ACTION = Object.freeze({
    actionDefinitionId: 'core:wait', // Or a more specific "AI error" action
    commandString: 'wait',
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
            if (!context) {
                logger.error("AIPlayerStrategy: Critical - ITurnContext is null or undefined.");
                return this._createFallbackAction('null_turn_context');
            }
            actor = context.getActor();
            if (!actor || !actor.id) {
                logger.error("AIPlayerStrategy: Critical - Actor not available or ID missing in ITurnContext.");
                return this._createFallbackAction('missing_actor_in_context');
            }
            actorId = actor.id;
            logger.info(`AIPlayerStrategy: decideAction called for actor ${actorId}.`);

            // --- Location Summary Generation ---
            let locationSummary = null;
            const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);

            try {
                const entityManager = context.getEntityManager();
                const currentLocationInstanceId = positionComponent?.locationId;

                if (currentLocationInstanceId && entityManager) {
                    const locationEntity = entityManager.getEntityInstance(currentLocationInstanceId);
                    if (locationEntity) {
                        const name = locationEntity.getComponentData(NAME_COMPONENT_ID)?.text || 'Unknown Location';
                        const description = locationEntity.getComponentData(DESCRIPTION_COMPONENT_ID)?.text || 'No description available.';

                        const exitsComponentData = locationEntity.getComponentData(EXITS_COMPONENT_ID);
                        let exits = [];
                        if (exitsComponentData && Array.isArray(exitsComponentData)) {
                            exits = exitsComponentData.map(exit => ({
                                direction: exit.direction || 'Unmarked Exit',
                                targetLocationId: exit.target, // Use exit.target as per JSON data
                            })).filter(e => e.direction && e.direction !== 'Unmarked Exit' && e.targetLocationId);
                        }

                        let charactersInLocation = [];
                        const entityIdsInLoc = entityManager.getEntitiesInLocation(currentLocationInstanceId);
                        if (entityIdsInLoc) {
                            for (const entityIdInLoc of entityIdsInLoc) {
                                if (entityIdInLoc === actorId) continue;

                                const otherEntity = entityManager.getEntityInstance(entityIdInLoc);
                                if (otherEntity) {
                                    charactersInLocation.push({
                                        id: otherEntity.id,
                                        name: otherEntity.getComponentData(NAME_COMPONENT_ID)?.text || 'Unnamed Character',
                                        description: otherEntity.getComponentData(DESCRIPTION_COMPONENT_ID)?.text || 'No description available.'
                                    });
                                }
                            }
                        }

                        locationSummary = {
                            name: name,
                            description: description,
                            exits: exits,
                            characters: charactersInLocation,
                        };
                        logger.debug(`AIPlayerStrategy: Generated location summary for actor ${actorId} in location ${currentLocationInstanceId}:`, locationSummary);
                    } else {
                        logger.warn(`AIPlayerStrategy: Location entity for ID '${currentLocationInstanceId}' not found via EntityManager for actor ${actorId}.`);
                    }
                } else if (!entityManager) {
                    logger.warn(`AIPlayerStrategy: EntityManager not available through context for actor ${actorId}. Cannot fetch location details.`);
                } else {
                    logger.info(`AIPlayerStrategy: Actor ${actorId} has no position component or locationId. Cannot generate location summary.`);
                }
            } catch (locError) {
                logger.error(`AIPlayerStrategy: Error generating location summary for actor ${actorId}: ${locError.message}`, locError);
            }

            // ── Available-Actions Discovery ─────────────────────────────
            let availableActions = [];
            try {
                if (typeof context.getActionDiscoverySystem === 'function') {
                    const ads = context.getActionDiscoverySystem();
                    const entityManager = context.getEntityManager();
                    const actionCtx = {
                        currentLocation: locationSummary ? {id: positionComponent?.locationId} : null,
                        entityManager,
                        worldContext: context?.game ?? {},
                        logger,
                        gameDataRepository: {},
                    };
                    availableActions =
                        await ads.getValidActions(actor, actionCtx);
                } else {
                    logger.warn(`AIPlayerStrategy: ITurnContext has no getActionDiscoverySystem() – skipping action discovery for actor ${actorId}.`);
                }
            } catch (adsErr) {
                logger.error(`AIPlayerStrategy: Error while discovering actions for actor ${actorId}: ${adsErr.message}`, adsErr);
            }

            // --- Perception Log Retrieval ---
            /** @type {Array<{description: string, timestamp: number, type: string}>} */
            let perceptionLogEntries = [];
            try {
                if (actor.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
                    /** @type {PerceptionLogComponentData | undefined} */
                    const perceptionData = actor.getComponentData(PERCEPTION_LOG_COMPONENT_ID);
                    if (perceptionData && Array.isArray(perceptionData.logEntries)) {
                        perceptionLogEntries = perceptionData.logEntries.map(entry => ({
                            description: entry.descriptionText,
                            timestamp: entry.timestamp,
                            type: entry.perceptionType,
                        }));
                        logger.debug(`AIPlayerStrategy: Retrieved ${perceptionLogEntries.length} perception log entries for actor ${actorId}.`);
                    } else {
                        logger.info(`AIPlayerStrategy: Actor ${actorId} has '${PERCEPTION_LOG_COMPONENT_ID}' but 'logEntries' are missing or malformed.`);
                    }
                } else {
                    logger.info(`AIPlayerStrategy: Actor ${actorId} does not have a '${PERCEPTION_LOG_COMPONENT_ID}' component. No perception log included.`);
                }
            } catch (perceptionError) {
                logger.error(`AIPlayerStrategy: Error retrieving perception log for actor ${actorId}: ${perceptionError.message}`, perceptionError);
            }


            // ── Game Summary Object (still useful for structured logging if needed) ────
            const gameSummary = {
                actor: {
                    id: actor.id,
                    name: actor.getComponentData(NAME_COMPONENT_ID)?.text || 'Unknown Name',
                    description: actor.getComponentData(DESCRIPTION_COMPONENT_ID)?.text || 'No description available.',
                },
                currentLocation: locationSummary,
                perceptionLog: perceptionLogEntries,
                availableActions: availableActions.map(a => ({
                    id: a.id,
                    command: a.command,
                    name: a.name,
                    description: a.description
                })),
            };

            // ── Construct LLM Prompt String ───────────────────────────────────
            const promptSegments = [];

            // Segment 1: Character
            promptSegments.push(`You're ${gameSummary.actor.name}. Description: ${gameSummary.actor.description}.`);

            // Segment 2: Location
            let locationSegmentLines = [];
            if (gameSummary.currentLocation) {
                locationSegmentLines.push(`You're in the location ${gameSummary.currentLocation.name}. Description: ${gameSummary.currentLocation.description}.`);

                if (gameSummary.currentLocation.exits && gameSummary.currentLocation.exits.length > 0) {
                    const exitStrings = gameSummary.currentLocation.exits.map(exit =>
                        `${exit.direction} to ${exit.targetLocationId}`
                    );
                    locationSegmentLines.push(`Exits: ${exitStrings.join(', ')}.`);
                } else {
                    locationSegmentLines.push("There are no obvious exits.");
                }

                if (gameSummary.currentLocation.characters && gameSummary.currentLocation.characters.length > 0) {
                    const characterStrings = gameSummary.currentLocation.characters.map(char =>
                        `${char.name} (${char.description || 'No description'})`
                    );
                    locationSegmentLines.push(`Characters here: ${characterStrings.join(', ')}.`);
                } else {
                    locationSegmentLines.push("You are alone here.");
                }
                promptSegments.push(locationSegmentLines.join('\n'));
            } else {
                promptSegments.push("Your current location is unknown.");
            }

            // Segment 3: Recent Events
            let eventsSegmentLines = ["Recent events:"];
            if (gameSummary.perceptionLog && gameSummary.perceptionLog.length > 0) {
                gameSummary.perceptionLog.forEach(entry => {
                    eventsSegmentLines.push(`- ${entry.description}`);
                });
            } else {
                eventsSegmentLines.push("None.");
            }
            promptSegments.push(eventsSegmentLines.join('\n'));

            // Segment 4: Available Actions
            let actionsSegmentLines = ["Your available actions are:"];
            if (gameSummary.availableActions && gameSummary.availableActions.length > 0) {
                gameSummary.availableActions.forEach(action => {
                    const detail = action.description || action.name || 'Perform action';
                    actionsSegmentLines.push(`- ${action.command} (${detail})`);
                });
            } else {
                actionsSegmentLines.push("You have no specific actions available right now.");
            }
            promptSegments.push(actionsSegmentLines.join('\n'));

            // Segment 5: Fixed Concluding Instruction
            promptSegments.push("Apart from picking one among the available actions, you have the opportunity to speak. It's not obligatory. Use your reasoning to determine if you should talk in this context.");

            const llmPromptString = promptSegments.join('\n\n');

            logger.info(`AIPlayerStrategy: Generated LLM prompt for actor ${actorId}. Length: ${llmPromptString.length}`);
            logger.debug(`AIPlayerStrategy: LLM Prompt for ${actorId}:\n${llmPromptString}`);


            // --- Call ILLMAdapter.generateAction ---
            const llmJsonResponse = await this.#llmAdapter.generateAction(llmPromptString);
            logger.debug(`AIPlayerStrategy: Received LLM JSON response for actor ${actorId}: ${llmJsonResponse}`);

            let parsedLlmOutput;
            try {
                parsedLlmOutput = JSON.parse(llmJsonResponse);
            } catch (parseError) {
                logger.error(`AIPlayerStrategy: Failed to parse LLM JSON response for actor ${actorId}. Error: ${parseError.message}. Response: ${llmJsonResponse}`, parseError);
                return this._createFallbackAction('llm_response_parse_error', actorId);
            }

            return this._transformAndValidateLLMOutput(parsedLlmOutput, actorId, logger);

        } catch (error) {
            const mainErrorMsg = `AIPlayerStrategy: Unhandled error during decideAction for actor ${actorId}: ${error.message}`;
            logger.error(mainErrorMsg, error);
            return this._createFallbackAction(`unhandled_decide_action_error: ${error.message}`, actorId);
        }
    }
}

// --- FILE END ---