// src/turns/services/AIGameStateProvider.js

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider_InterfaceType */
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
    PERCEPTION_LOG_COMPONENT_ID
} from "../../constants/componentIds.js";

/**
 * @class AIGameStateProvider
 * @implements {IAIGameStateProvider_InterfaceType}
 * @description Gathers game state information for an AI actor and packages it into an AIGameStateDTO.
 */
export class AIGameStateProvider extends IAIGameStateProvider {
    constructor() {
        super();
    }

    _getComponentText(entity, componentId, defaultValue = 'N/A', propertyPath = 'text') {
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
        return {
            id: actor.id,
            name: this._getComponentText(actor, NAME_COMPONENT_ID, 'Unknown Name'),
            description: this._getComponentText(actor, DESCRIPTION_COMPONENT_ID, 'No description available.'),
        };
    }

    async _buildLocationSummary(actor, turnContext, logger) {
        logger.debug(`AIGameStateProvider: Building location summary for actor ${actor.id}`);

        const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
        const currentLocationInstanceId = positionComponent?.locationId;

        let entityManager;
        try {
            if (turnContext && typeof turnContext.getEntityManager === 'function') {
                entityManager = turnContext.getEntityManager();
            } else {
                logger.warn(`AIGameStateProvider: turnContext.getEntityManager is not a function for actor ${actor.id}. EntityManager not available.`);
                entityManager = null;
            }
        } catch (e) {
            logger.warn(`AIGameStateProvider: Error accessing EntityManager for actor ${actor.id}: ${e.message}`);
            entityManager = null;
        }

        if (!currentLocationInstanceId) {
            logger.info(`AIGameStateProvider: Actor ${actor.id} has no position component or locationId. Cannot generate location summary.`);
            return null;
        }
        if (!entityManager) {
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
                        direction: exit.direction || 'Unmarked Exit',
                        targetLocationId: exit.target,
                    }))
                    .filter(e => e.direction && e.direction !== 'Unmarked Exit' && e.targetLocationId);
            }

            let charactersDto = [];
            logger.debug(`AIGameStateProvider: Querying entities for location: ${currentLocationInstanceId}`);
            const entityIdsSet = await entityManager.getEntitiesInLocation(currentLocationInstanceId); // This returns a Set

            // Log the raw Set object and explain JSON.stringify behavior
            logger.debug(`AIGameStateProvider: Received entityIdsSet from EntityManager for ${currentLocationInstanceId}: ${JSON.stringify(entityIdsSet)} (Note: JSON.stringify(Set) often yields '{}'. Actual Set size: ${entityIdsSet ? entityIdsSet.size : 'N/A'})`);

            // Convert the Set to an Array for further processing
            const entityIdsInLoc = entityIdsSet ? Array.from(entityIdsSet) : [];
            logger.debug(`AIGameStateProvider: Converted entityIdsSet to array entityIdsInLoc (size ${entityIdsInLoc.length}): ${JSON.stringify(entityIdsInLoc)}`);


            // Now, use the entityIdsInLoc (which is an array)
            if (Array.isArray(entityIdsInLoc)) { // This check is technically redundant if Array.from() was successful, but good for safety.
                logger.debug(`AIGameStateProvider: Iterating ${entityIdsInLoc.length} IDs from converted array. Actor ID to skip: ${actor.id}`);
                for (const entityIdInLoc of entityIdsInLoc) {
                    if (entityIdInLoc === actor.id) {
                        logger.debug(`AIGameStateProvider: Skipping self: ${entityIdInLoc}`);
                        continue;
                    }
                    logger.debug(`AIGameStateProvider: Processing entityIdInLoc: ${entityIdInLoc}`);
                    const otherEntity = await entityManager.getEntityInstance(entityIdInLoc);
                    if (otherEntity) {
                        logger.debug(`AIGameStateProvider: Successfully retrieved entity instance for ${entityIdInLoc}. Name: ${this._getComponentText(otherEntity, NAME_COMPONENT_ID, 'Unknown Name')}`);
                        charactersDto.push({
                            id: otherEntity.id,
                            name: this._getComponentText(otherEntity, NAME_COMPONENT_ID, 'Unnamed Character'),
                            description: this._getComponentText(otherEntity, DESCRIPTION_COMPONENT_ID, 'No description available.')
                        });
                    } else {
                        logger.warn(`AIGameStateProvider: Could not retrieve entity instance for ID '${entityIdInLoc}' in location '${currentLocationInstanceId}'. This entity will NOT be listed.`);
                    }
                }
            } else {
                // This path should ideally not be hit if entityIdsSet was a valid Set or null/undefined
                logger.error(`AIGameStateProvider: entityIdsInLoc is NOT an array even after attempting conversion from Set. Value: ${JSON.stringify(entityIdsInLoc)}. Location: ${currentLocationInstanceId}. Character list will be empty.`);
            }

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
        let availableActionsDto = [];
        try {
            if (typeof turnContext.getActionDiscoverySystem === 'function') {
                const ads = turnContext.getActionDiscoverySystem();
                const entityManager = turnContext.getEntityManager();
                const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);

                const actionCtx = {
                    currentLocation: positionComponent?.locationId ? {id: positionComponent.locationId} : null,
                    entityManager,
                    worldContext: turnContext?.game ?? {},
                    logger,
                };

                const discoveredActions = await ads.getValidActions(actor, actionCtx);
                if (discoveredActions && Array.isArray(discoveredActions)) {
                    availableActionsDto = discoveredActions.map(action => ({
                        id: action.id || 'unknown:action',
                        command: action.command || '',
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
            availableActionsDto = [];
        }
        return availableActionsDto;
    }

    async _getPerceptionLog(actor, logger) {
        logger.debug(`AIGameStateProvider: Retrieving perception log for actor ${actor.id}`);
        let perceptionLogDto = [];
        try {
            if (actor.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
                const perceptionData = actor.getComponentData(PERCEPTION_LOG_COMPONENT_ID);
                if (perceptionData && Array.isArray(perceptionData.logEntries)) {
                    perceptionLogDto = perceptionData.logEntries.map(entry => ({
                        description: entry.descriptionText || "Undescribed event.",
                        timestamp: entry.timestamp || Date.now(),
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
        const locationSummary = await this._buildLocationSummary(actor, turnContext, logger);
        const availableActions = await this._getAvailableActions(actor, turnContext, locationSummary, logger);
        const perceptionLog = await this._getPerceptionLog(actor, logger);

        const gameState = {
            actorState,
            currentLocation: locationSummary,
            availableActions,
            perceptionLog,
        };

        logger.info(`AIGameStateProvider: Successfully built game state for actor ${actor.id}.`);
        logger.debug(`AIGameStateProvider: GameState DTO for ${actor.id}:`, {gameState});

        return gameState;
    }
}
