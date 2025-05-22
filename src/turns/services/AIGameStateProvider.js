// src/turns/services/AIGameStateProvider.js

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider_InterfaceType */ // JSDoc type alias for the interface
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../dtos/AIActorStateDTO.js').AIActorStateDTO} AIActorStateDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIPerceptionLogEntryDTO} AIPerceptionLogEntryDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AILocationSummaryDTO} AILocationSummaryDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AILocationExitDTO} AILocationExitDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AICharacterInLocationDTO} AICharacterInLocationDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */


import {IAIGameStateProvider} from '../interfaces/IAIGameStateProvider.js';
import {
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    POSITION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    PERCEPTION_LOG_COMPONENT_ID // Added import
    // Import other relevant component IDs here as needed for buildGameState
} from "../../constants/componentIds.js";

/**
 * @class AIGameStateProvider
 * @implements {IAIGameStateProvider_InterfaceType}
 * @description Gathers game state information for an AI actor and packages it into an AIGameStateDTO.
 */
export class AIGameStateProvider extends IAIGameStateProvider {
    /**
     * Creates an instance of AIGameStateProvider.
     * Dependencies can be injected here if future enhancements require them
     * (e.g., configuration for data gathering).
     */
    constructor() {
        super();
        // Initialization if needed, e.g., this.config = config;
    }

    /**
     * @private
     * Safely retrieves text data from an entity's component.
     * @param {Entity} entity - The entity to query.
     * @param {string} componentId - The ID of the component.
     * @param {string} [defaultValue='N/A'] - Default value if data is not found, not a string, or is an empty string after trimming.
     * @param {string} [propertyPath='text'] - The property path within the component data to access.
     * @returns {string} The component text (trimmed if found and not empty) or default value.
     */
    _getComponentText(entity, componentId, defaultValue = 'N/A', propertyPath = 'text') {
        if (!entity || typeof entity.getComponentData !== 'function') {
            return defaultValue;
        }

        const componentData = entity.getComponentData(componentId);

        // Access the property using the propertyPath
        // This handles simple cases like 'text' or 'name'.
        // For deeply nested paths like 'details.summary', this will also work if componentData is an object.
        const value = componentData?.[propertyPath];

        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }

        return defaultValue;
    }

    /**
     * @private
     * Builds the actor's own state DTO.
     * @param {Entity} actor - The AI actor.
     * @param {ILogger} logger - Logger instance for detailed logging.
     * @returns {AIActorStateDTO} The actor state DTO.
     */
    _buildActorState(actor, logger) {
        logger.debug(`AIGameStateProvider: Building actor state for ${actor.id}`);
        // Assuming actor and actor.id are valid as per the context where this method will be called (e.g., buildGameState).
        // If actor or actor.id could be invalid here, further checks might be needed,
        // potentially returning null or throwing an error, depending on error handling strategy.

        return {
            id: actor.id,
            name: this._getComponentText(actor, NAME_COMPONENT_ID, 'Unknown Name'),
            description: this._getComponentText(actor, DESCRIPTION_COMPONENT_ID, 'No description available.'),
        };
    }

    /**
     * @private
     * Builds the summary of the actor's current location.
     * @param {Entity} actor - The AI actor.
     * @param {ITurnContext} turnContext - The current turn context.
     * @param {ILogger} logger - Logger instance.
     * @returns {Promise<AILocationSummaryDTO | null>} The location summary DTO, or null if not determinable.
     */
    async _buildLocationSummary(actor, turnContext, logger) {
        logger.debug(`AIGameStateProvider: Building location summary for actor ${actor.id}`);

        const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
        const currentLocationInstanceId = positionComponent?.locationId;

        let entityManager; // Define entityManager here to check its availability
        try {
            // Check if getEntityManager is a function before calling it.
            if (turnContext && typeof turnContext.getEntityManager === 'function') {
                entityManager = turnContext.getEntityManager();
            } else {
                // Log if getEntityManager is not a function on turnContext.
                // This might happen if turnContext is not fully initialized or is of an unexpected type.
                logger.warn(`AIGameStateProvider: turnContext.getEntityManager is not a function for actor ${actor.id}. EntityManager not available.`);
                entityManager = null;
            }
        } catch (e) {
            logger.warn(`AIGameStateProvider: Error accessing EntityManager for actor ${actor.id}: ${e.message}`);
            entityManager = null; // Ensure it's null if access fails
        }

        if (!currentLocationInstanceId) {
            logger.info(`AIGameStateProvider: Actor ${actor.id} has no position component or locationId. Cannot generate location summary.`);
            return null;
        }
        if (!entityManager) {
            // This log might be redundant if the above warning for `turnContext.getEntityManager` not being a function was already issued,
            // but it's a good fallback if entityManager is null for other reasons after the try-catch.
            logger.warn(`AIGameStateProvider: EntityManager not available for actor ${actor.id}. Cannot fetch location details.`);
            return null;
        }

        try {
            const locationEntity = await entityManager.getEntityInstance(currentLocationInstanceId);
            if (!locationEntity) {
                logger.warn(`AIGameStateProvider: Location entity for ID '${currentLocationInstanceId}' not found for actor ${actor.id}.`);
                return null;
            }

            const name = this._getComponentText(locationEntity, NAME_COMPONENT_ID, 'Unknown Location');
            const description = this._getComponentText(locationEntity, DESCRIPTION_COMPONENT_ID, 'No description available.');

            const exitsComponentData = locationEntity.getComponentData(EXITS_COMPONENT_ID);
            let exitsDto = [];
            if (exitsComponentData && Array.isArray(exitsComponentData)) {
                exitsDto = exitsComponentData
                    .map(exit => ({
                        direction: exit.direction || 'Unmarked Exit', // Default if direction is falsy
                        targetLocationId: exit.target,
                    }))
                    .filter(e => e.direction && e.direction !== 'Unmarked Exit' && e.targetLocationId);
                // Filter out exits that ended up as 'Unmarked Exit' (meaning original was missing/falsy)
                // or those missing a target.
            }

            let charactersDto = [];
            const entityIdsInLoc = await entityManager.getEntitiesInLocation(currentLocationInstanceId);
            if (entityIdsInLoc && Array.isArray(entityIdsInLoc)) {
                for (const entityIdInLoc of entityIdsInLoc) {
                    if (entityIdInLoc === actor.id) continue; // Skip self

                    const otherEntity = await entityManager.getEntityInstance(entityIdInLoc);
                    if (otherEntity) {
                        charactersDto.push({
                            id: otherEntity.id,
                            name: this._getComponentText(otherEntity, NAME_COMPONENT_ID, 'Unnamed Character'),
                            description: this._getComponentText(otherEntity, DESCRIPTION_COMPONENT_ID, 'No description available.')
                        });
                    } else {
                        logger.debug(`AIGameStateProvider: Could not retrieve entity instance for ID '${entityIdInLoc}' in location '${currentLocationInstanceId}'.`);
                    }
                }
            }

            const summary = {
                name,
                description,
                exits: exitsDto,
                characters: charactersDto,
                // According to AILocationSummaryDTO, items is optional and not handled here yet.
            };

            logger.debug(`AIGameStateProvider: Generated location summary for actor ${actor.id} in location ${currentLocationInstanceId}. Exits: ${summary.exits.length}, Characters: ${summary.characters.length}`);
            return summary;
        } catch (locError) {
            logger.error(`AIGameStateProvider: Error generating location summary for actor ${actor.id} at '${currentLocationInstanceId}': ${locError.message}`, {
                error: locError,
                stack: locError.stack
            });
            return null;
        }
    }

    /**
     * @private
     * Retrieves available actions for the actor.
     * @param {Entity} actor - The AI actor.
     * @param {ITurnContext} turnContext - The current turn context.
     * @param {AILocationSummaryDTO | null} locationSummary - Previously built location summary.
     * @param {ILogger} logger - Logger instance.
     * @returns {Promise<AIAvailableActionDTO[]>} An array of available action DTOs.
     */
    async _getAvailableActions(actor, turnContext, locationSummary, logger) {
        logger.debug(`AIGameStateProvider: Discovering available actions for actor ${actor.id}`);
        let availableActionsDto = [];
        try {
            if (typeof turnContext.getActionDiscoverySystem === 'function') {
                const ads = turnContext.getActionDiscoverySystem();
                const entityManager = turnContext.getEntityManager(); // Ensure this is available for actionCtx
                const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID); // For current location ID for actionCtx

                // Construct the context required by getValidActions
                // This context structure is based on the original AIPlayerStrategy
                const actionCtx = {
                    currentLocation: positionComponent?.locationId ? {id: positionComponent.locationId} : null,
                    entityManager,
                    worldContext: turnContext?.game ?? {}, // From original context.game
                    logger, // Pass the logger to ADS
                    // gameDataRepository: {}, // This was empty in original; review if ADS truly needs it or if it can be omitted.
                };

                const discoveredActions = await ads.getValidActions(actor, actionCtx);
                if (discoveredActions && Array.isArray(discoveredActions)) {
                    availableActionsDto = discoveredActions.map(action => ({
                        id: action.id || 'unknown:action', // Ensure fallback for critical ID
                        command: action.command || '',    // Ensure fallback
                        name: action.name || 'Unnamed Action',
                        description: action.description || 'No description available.'
                    }));
                }
                logger.debug(`AIGameStateProvider: Discovered ${availableActionsDto.length} actions for actor ${actor.id}.`);
            } else {
                logger.warn(`AIGameStateProvider: ITurnContext for actor ${actor.id} has no getActionDiscoverySystem() method. Action discovery skipped.`);
            }
        } catch (adsErr) {
            logger.error(`AIGameStateProvider: Error while discovering actions for actor ${actor.id}: ${adsErr.message}`, {
                error: adsErr,
                stack: adsErr.stack
            });
            // availableActionsDto remains empty (or is an empty array), error is logged
            availableActionsDto = []; // Ensure it's an empty array on error
        }
        return availableActionsDto;
    }

    /**
     * @private
     * Retrieves perception log for the actor.
     * @param {Entity} actor - The AI actor.
     * @param {ILogger} logger - Logger instance.
     * @returns {Promise<AIPerceptionLogEntryDTO[]>} An array of perception log entry DTOs.
     */
    async _getPerceptionLog(actor, logger) {
        logger.debug(`AIGameStateProvider: Retrieving perception log for actor ${actor.id}`);
        let perceptionLogDto = [];
        try {
            if (actor.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
                /** @type {{logEntries: Array<{descriptionText: string, timestamp: number, perceptionType: string}>} | undefined} */
                const perceptionData = actor.getComponentData(PERCEPTION_LOG_COMPONENT_ID);
                if (perceptionData && Array.isArray(perceptionData.logEntries)) {
                    perceptionLogDto = perceptionData.logEntries.map(entry => ({
                        description: entry.descriptionText || "Undescribed event.",
                        timestamp: entry.timestamp || Date.now(), // Or a specific game time if available
                        type: entry.perceptionType || "unknown",
                    }));
                    logger.debug(`AIGameStateProvider: Retrieved ${perceptionLogDto.length} perception log entries for actor ${actor.id}.`);
                } else {
                    logger.info(`AIGameStateProvider: Actor ${actor.id} has '${PERCEPTION_LOG_COMPONENT_ID}' but 'logEntries' are missing or malformed. Data:`, {perceptionData});
                }
            } else {
                logger.info(`AIGameStateProvider: Actor ${actor.id} does not have a '${PERCEPTION_LOG_COMPONENT_ID}' component. No perception log included.`);
            }
        } catch (perceptionError) {
            logger.error(`AIGameStateProvider: Error retrieving perception log for actor ${actor.id}: ${perceptionError.message}`, {error: perceptionError});
            // perceptionLogDto remains empty, error is logged
        }
        return perceptionLogDto;
    }

    /**
     * Asynchronously builds the AIGameStateDTO for a given AI actor within the current turn context.
     * @async
     * @param {Entity} actor - The AI-controlled entity.
     * @param {ITurnContext} turnContext - The context of the current turn.
     * @param {ILogger} logger - An instance of the logger.
     * @returns {Promise<AIGameStateDTO>} A promise that resolves to the AIGameStateDTO.
     * @throws {Error} If actor or turnContext is fundamentally invalid.
     */
    async buildGameState(actor, turnContext, logger) {
        if (!actor || !actor.id) {
            const errorMsg = "AIGameStateProvider: Actor is invalid or missing ID. Cannot build game state.";
            logger.error(errorMsg, {actor});
            throw new Error(errorMsg); // Critical failure
        }
        if (!turnContext) {
            const errorMsg = `AIGameStateProvider: TurnContext is invalid for actor ${actor.id}. Cannot build game state.`;
            logger.error(errorMsg, {turnContext});
            throw new Error(errorMsg); // Critical failure
        }

        logger.debug(`AIGameStateProvider: Starting to build game state for actor ${actor.id}.`);

        // These calls will use the logger instance passed to buildGameState.
        const actorState = this._buildActorState(actor, logger); // Sync
        const locationSummary = await this._buildLocationSummary(actor, turnContext, logger); // Async
        const availableActions = await this._getAvailableActions(actor, turnContext, locationSummary, logger); // Async
        const perceptionLog = await this._getPerceptionLog(actor, logger); // Async

        /** @type {AIGameStateDTO} */
        const gameState = {
            actorState,
            currentLocation: locationSummary, // Can be null
            availableActions,              // Can be empty
            perceptionLog,                 // Can be empty
            // Other optional fields from AIGameStateDTO (e.g., worldStateSummary, missionBriefing)
            // are not populated here as they are for future tickets.
            // They will be undefined by default if not explicitly set.
        };

        logger.info(`AIGameStateProvider: Successfully built game state for actor ${actor.id}.`);
        // Avoid logging the full gameState in info unless necessary due to size. Debug is better.
        logger.debug(`AIGameStateProvider: GameState DTO for ${actor.id}:`, {gameState});

        return gameState;
    }
}