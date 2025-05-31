// src/turns/services/AIGameStateProvider.js
// --- FILE START ---

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider_InterfaceType */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIActorStateDTO} AIActorStateDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIPerceptionLogEntryDTO} AIPerceptionLogEntryDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AILocationSummaryDTO} AILocationSummaryDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AILocationExitDTO} AILocationExitDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AICharacterInLocationDTO} AICharacterInLocationDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */


import {IAIGameStateProvider} from '../interfaces/IAIGameStateProvider.js';
import {ActorDataExtractor} from './actorDataExtractor.js';
import {
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    POSITION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    PERCEPTION_LOG_COMPONENT_ID,
    PERSONALITY_COMPONENT_ID,
    PROFILE_COMPONENT_ID,
    LIKES_COMPONENT_ID,
    DISLIKES_COMPONENT_ID,
    SECRETS_COMPONENT_ID,
    SPEECH_PATTERNS_COMPONENT_ID
} from "../../constants/componentIds.js";
import {
    DEFAULT_FALLBACK_CHARACTER_NAME,
    DEFAULT_FALLBACK_DESCRIPTION_RAW,
    DEFAULT_FALLBACK_LOCATION_NAME,
    DEFAULT_FALLBACK_EXIT_DIRECTION,
    DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW,
    DEFAULT_FALLBACK_ACTION_ID,
    DEFAULT_FALLBACK_ACTION_COMMAND,
    DEFAULT_FALLBACK_ACTION_NAME,
    DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
    DEFAULT_COMPONENT_VALUE_NA
} from '../../constants/textDefaults.js';

/**
 * @class AIGameStateProvider
 * @implements {IAIGameStateProvider_InterfaceType}
 * @description Gathers game state information for an AI actor and packages it into an AIGameStateDTO.
 */
export class AIGameStateProvider extends IAIGameStateProvider {
    constructor() {
        super();
    }

    _getComponentText(entity, componentId, defaultValue = DEFAULT_COMPONENT_VALUE_NA, propertyPath = 'text') {
        if (!entity || typeof entity.getComponentData !== 'function') {
            return defaultValue;
        }
        const componentData = entity.getComponentData(componentId);
        const value = componentData?.[propertyPath];
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
        return defaultValue;
    }

    _buildActorState(actor, logger) {
        logger.debug(`AIGameStateProvider: Building actor state for ${actor.id}`);
        /** @type {AIActorStateDTO} */
        const actorState = {
            id: actor.id,
        };

        actorState[NAME_COMPONENT_ID] = {
            text: this._getComponentText(actor, NAME_COMPONENT_ID, DEFAULT_FALLBACK_CHARACTER_NAME)
        };
        actorState[DESCRIPTION_COMPONENT_ID] = {
            text: this._getComponentText(actor, DESCRIPTION_COMPONENT_ID, DEFAULT_FALLBACK_DESCRIPTION_RAW)
        };

        const conditionalTextComponents = [
            PERSONALITY_COMPONENT_ID,
            PROFILE_COMPONENT_ID,
            LIKES_COMPONENT_ID,
            DISLIKES_COMPONENT_ID,
            SECRETS_COMPONENT_ID,
        ];

        for (const componentId of conditionalTextComponents) {
            const textValue = this._getComponentText(actor, componentId, null);
            if (textValue !== null) {
                actorState[componentId] = {text: textValue};
                logger.debug(`AIGameStateProvider: Added component '${componentId}' to actor state for ${actor.id}.`);
            } else {
                logger.debug(`AIGameStateProvider: Component '${componentId}' not found or has no text for actor ${actor.id}. Not adding to actor state.`);
            }
        }

        if (actor.hasComponent(SPEECH_PATTERNS_COMPONENT_ID)) {
            const speechData = actor.getComponentData(SPEECH_PATTERNS_COMPONENT_ID);
            if (speechData && Array.isArray(speechData.patterns) && speechData.patterns.length > 0) {
                const validPatterns = speechData.patterns.filter(p => typeof p === 'string' && p.trim() !== '');
                if (validPatterns.length > 0) {
                    actorState[SPEECH_PATTERNS_COMPONENT_ID] = {...speechData, patterns: validPatterns};
                    logger.debug(`AIGameStateProvider: Added component '${SPEECH_PATTERNS_COMPONENT_ID}' with ${validPatterns.length} valid patterns to actor state for ${actor.id}.`);
                } else {
                    logger.debug(`AIGameStateProvider: Component '${SPEECH_PATTERNS_COMPONENT_ID}' found for actor ${actor.id}, but it has no valid, non-empty string patterns. Not adding to actor state.`);
                }
            } else {
                logger.debug(`AIGameStateProvider: Component '${SPEECH_PATTERNS_COMPONENT_ID}' data for actor ${actor.id} is missing 'patterns' array or it's empty. Not adding to actor state.`);
            }
        } else {
            logger.debug(`AIGameStateProvider: Component '${SPEECH_PATTERNS_COMPONENT_ID}' not found for actor ${actor.id}. Not adding to actor state.`);
        }

        return actorState;
    }

    async _buildLocationSummary(actor, turnContext, logger) {
        logger.debug(`AIGameStateProvider: Building location summary for actor ${actor.id}`);

        const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
        const currentLocationInstanceId = positionComponent?.locationId;

        if (!currentLocationInstanceId) {
            logger.info(`AIGameStateProvider: Actor ${actor.id} has no position component or locationId. Cannot generate location summary.`);
            return null;
        }

        let entityManager;
        if (turnContext && typeof turnContext.getEntityManager === 'function') {
            try {
                entityManager = turnContext.getEntityManager();
            } catch (e) {
                logger.warn(`AIGameStateProvider: Error accessing EntityManager for actor ${actor.id}: ${e.message}`);
                return null;
            }
        } else {
            logger.warn(`AIGameStateProvider: turnContext.getEntityManager is not a function for actor ${actor.id}. EntityManager not available.`);
            return null;
        }

        if (!entityManager) {
            logger.warn(`AIGameStateProvider: EntityManager not available for actor ${actor.id}. Cannot fetch location details.`);
            return null;
        }

        // From here, entityManager is confirmed to be truthy and obtained without error.
        try {
            const locationEntity = await entityManager.getEntityInstance(currentLocationInstanceId);
            if (!locationEntity) {
                logger.warn(`AIGameStateProvider: Location entity for ID '${currentLocationInstanceId}' not found for actor ${actor.id}.`);
                return null;
            }

            const name = this._getComponentText(locationEntity, NAME_COMPONENT_ID, DEFAULT_FALLBACK_LOCATION_NAME);
            const description = this._getComponentText(locationEntity, DESCRIPTION_COMPONENT_ID, DEFAULT_FALLBACK_DESCRIPTION_RAW);

            const exitsComponentData = locationEntity.getComponentData(EXITS_COMPONENT_ID);
            /** @type {AILocationExitDTO[]} */
            let exitsDto = [];

            if (exitsComponentData && Array.isArray(exitsComponentData)) {
                const exitPromises = exitsComponentData
                    .filter(exitData => exitData.target) // Ensure target exists before trying to process
                    .map(async (exitData) => {
                        const targetLocationId = exitData.target;
                        let targetLocationName = DEFAULT_FALLBACK_LOCATION_NAME;

                        try {
                            const targetLocationEntity = await entityManager.getEntityInstance(targetLocationId);
                            if (targetLocationEntity) {
                                targetLocationName = this._getComponentText(targetLocationEntity, NAME_COMPONENT_ID, DEFAULT_FALLBACK_LOCATION_NAME);
                            } else {
                                logger.warn(`AIGameStateProvider: Target location entity for exit target ID '${targetLocationId}' not found. Using fallback name.`);
                            }
                        } catch (err) {
                            logger.error(`AIGameStateProvider: Error fetching target location entity for ID '${targetLocationId}': ${err.message}. Using fallback name.`);
                        }

                        return {
                            direction: exitData.direction || DEFAULT_FALLBACK_EXIT_DIRECTION,
                            targetLocationId: targetLocationId,
                            targetLocationName: targetLocationName,
                        };
                    });
                exitsDto = (await Promise.all(exitPromises))
                    .filter(e => e.direction && e.targetLocationId);
            }


            /** @type {AICharacterInLocationDTO[]} */
            let charactersDto = [];
            logger.debug(`AIGameStateProvider: Querying entities for location: ${currentLocationInstanceId}`);
            const entityIdsSet = await entityManager.getEntitiesInLocation(currentLocationInstanceId);

            logger.debug(`AIGameStateProvider: Received entityIdsSet from EntityManager for ${currentLocationInstanceId}: ${JSON.stringify(entityIdsSet)} (Note: JSON.stringify(Set) often yields '{}'. Actual Set size: ${entityIdsSet ? entityIdsSet.size : 'N/A'})`);

            const entityIdsInLoc = entityIdsSet ? Array.from(entityIdsSet) : [];
            logger.debug(`AIGameStateProvider: Converted entityIdsSet to array entityIdsInLoc (size ${entityIdsInLoc.length}): ${JSON.stringify(entityIdsInLoc)}`);


            if (Array.isArray(entityIdsInLoc)) {
                logger.debug(`AIGameStateProvider: Iterating ${entityIdsInLoc.length} IDs from converted array. Actor ID to skip: ${actor.id}`);
                for (const entityIdInLoc of entityIdsInLoc) {
                    if (entityIdInLoc === actor.id) {
                        logger.debug(`AIGameStateProvider: Skipping self: ${entityIdInLoc}`);
                        continue;
                    }
                    logger.debug(`AIGameStateProvider: Processing entityIdInLoc: ${entityIdInLoc}`);
                    const otherEntity = await entityManager.getEntityInstance(entityIdInLoc);
                    if (otherEntity) {
                        logger.debug(`AIGameStateProvider: Successfully retrieved entity instance for ${entityIdInLoc}. Name: ${this._getComponentText(otherEntity, NAME_COMPONENT_ID, DEFAULT_FALLBACK_CHARACTER_NAME)}`);
                        charactersDto.push({
                            id: otherEntity.id,
                            name: this._getComponentText(otherEntity, NAME_COMPONENT_ID, DEFAULT_FALLBACK_CHARACTER_NAME),
                            description: this._getComponentText(otherEntity, DESCRIPTION_COMPONENT_ID, DEFAULT_FALLBACK_DESCRIPTION_RAW)
                        });
                    } else {
                        logger.warn(`AIGameStateProvider: Could not retrieve entity instance for ID '${entityIdInLoc}' in location '${currentLocationInstanceId}'. This entity will NOT be listed.`);
                    }
                }
            } else {
                logger.error(`AIGameStateProvider: entityIdsInLoc is NOT an array even after attempting conversion from Set. Value: ${JSON.stringify(entityIdsInLoc)}. Location: ${currentLocationInstanceId}. Character list will be empty.`);
            }
            /** @type {AILocationSummaryDTO} */
            const summary = {
                name,
                description,
                exits: exitsDto,
                characters: charactersDto,
            };
            logger.debug(`AIGameStateProvider: Final generated location summary for actor ${actor.id} in location ${currentLocationInstanceId}. Exits: ${summary.exits.length}, Characters: ${summary.characters.length}`);
            return summary;
        } catch (locError) {
            logger.error(`AIGameStateProvider: Error generating location summary for actor ${actor.id} at '${currentLocationInstanceId}': ${locError.message}`, {
                error: locError,
                stack: locError.stack
            });
            return null;
        }
    }

    async _getAvailableActions(actor, turnContext, locationSummary, logger) {
        logger.debug(`AIGameStateProvider: Discovering available actions for actor ${actor.id}`);
        /** @type {AIAvailableActionDTO[]} */
        let availableActionsDto = [];
        try {
            if (typeof turnContext.getActionDiscoverySystem === 'function') {
                const ads = turnContext.getActionDiscoverySystem();
                // Ensure entityManager is available for action context, using the one from turnContext
                let entityManagerForActions;
                if (turnContext && typeof turnContext.getEntityManager === 'function') {
                    try {
                        entityManagerForActions = turnContext.getEntityManager();
                    } catch (e) {
                        logger.warn(`AIGameStateProvider (_getAvailableActions): Error accessing EntityManager for action context: ${e.message}. Actions requiring EM may not be discovered correctly.`);
                        entityManagerForActions = null;
                    }
                } else {
                    logger.warn(`AIGameStateProvider (_getAvailableActions): turnContext.getEntityManager is not a function. Actions requiring EM may not be discovered correctly.`);
                    entityManagerForActions = null;
                }


                const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);

                const actionCtx = {
                    currentLocation: positionComponent?.locationId ? {id: positionComponent.locationId} : null,
                    entityManager: entityManagerForActions, // Use potentially null EM
                    worldContext: turnContext?.game ?? {},
                    logger,
                };

                const discoveredActions = await ads.getValidActions(actor, actionCtx);
                if (discoveredActions && Array.isArray(discoveredActions)) {
                    availableActionsDto = discoveredActions.map(action => ({
                        id: action.id || DEFAULT_FALLBACK_ACTION_ID,
                        command: action.command || DEFAULT_FALLBACK_ACTION_COMMAND,
                        name: action.name || DEFAULT_FALLBACK_ACTION_NAME,
                        description: action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW
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
            availableActionsDto = []; // Ensure empty on error
        }
        return availableActionsDto;
    }

    async _getPerceptionLog(actor, logger) {
        logger.debug(`AIGameStateProvider: Retrieving perception log for actor ${actor.id}`);
        /** @type {AIPerceptionLogEntryDTO[]} */
        let perceptionLogDto = [];
        try {
            if (actor.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
                const perceptionData = actor.getComponentData(PERCEPTION_LOG_COMPONENT_ID);
                if (perceptionData && Array.isArray(perceptionData.logEntries)) {
                    perceptionLogDto = perceptionData.logEntries.map(entry => ({
                        descriptionText: entry.descriptionText || DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW,
                        timestamp: entry.timestamp || Date.now(),
                        perceptionType: entry.perceptionType || "unknown",
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
        }
        return perceptionLogDto;
    }

    async buildGameState(actor, turnContext, logger) {
        if (!actor || !actor.id) {
            const errorMsg = "AIGameStateProvider: Actor is invalid or missing ID. Cannot build game state.";
            logger.error(errorMsg, {actor});
            throw new Error(errorMsg);
        }
        if (!turnContext) {
            const errorMsg = `AIGameStateProvider: TurnContext is invalid for actor ${actor.id}. Cannot build game state.`;
            logger.error(errorMsg, {turnContext});
            throw new Error(errorMsg);
        }

        logger.debug(`AIGameStateProvider: Starting to build game state for actor ${actor.id}.`);

        const actorState = this._buildActorState(actor, logger);

        const actorDataExtractor = new ActorDataExtractor();
        const actorPromptData = actorDataExtractor.extractPromptData(actorState);

        const locationSummary = await this._buildLocationSummary(actor, turnContext, logger);
        // Note: _getAvailableActions needs its own robust way to get EntityManager if needed,
        // as locationSummary might be null here.
        const availableActions = await this._getAvailableActions(actor, turnContext, locationSummary, logger);
        const perceptionLog = await this._getPerceptionLog(actor, logger);

        /** @type {AIGameStateDTO} */
        const gameState = {
            actorState,
            actorPromptData,
            currentLocation: locationSummary,
            availableActions,
            perceptionLog,
        };

        logger.info(`AIGameStateProvider: Successfully built game state for actor ${actor.id}.`);
        logger.debug(`AIGameStateProvider: GameState DTO for ${actor.id}:`, {gameState});

        return gameState;
    }
}

// --- FILE END ---