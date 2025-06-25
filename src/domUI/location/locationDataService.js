/**
 * @module domUI/location/locationDataService
 * @description Service for resolving location information and characters present.
 */

import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../../constants/componentIds.js';

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../entities/entityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/CommonTypes.js').NamespacedId} NamespacedId */

/**
 * Service providing location related data for UI components.
 */
export class LocationDataService {
  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {IEntityManager} deps.entityManager
   * @param {EntityDisplayDataProvider} deps.entityDisplayDataProvider
   * @param {IDataRegistry} [deps.dataRegistry]
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({
    logger,
    entityManager,
    entityDisplayDataProvider,
    dataRegistry,
    safeEventDispatcher,
  }) {
    this.logger = logger;
    this.entityManager = entityManager;
    this.entityDisplayDataProvider = entityDisplayDataProvider;
    this.dataRegistry = dataRegistry;
    this.safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * Resolve the location instance ID for the given actor.
   *
   * @param {NamespacedId} actorId - Actor entity ID.
   * @returns {string|null} Location instance ID or null when unresolved.
   */
  resolveLocationInstanceId(actorId) {
    const locId = this.entityDisplayDataProvider.getEntityLocationId(actorId);
    if (!locId) {
      if (this.dataRegistry && typeof this.dataRegistry.getAll === 'function') {
        const allInstances = this.dataRegistry.getAll('entityInstances') || [];
        const allDefs = this.dataRegistry.getAll('entityDefinitions') || [];
        this.logger.error(
          '[DEBUG] Registry entityInstances:',
          allInstances.map((e) => ({
            id: e.id,
            instanceId: e.instanceId,
            definitionId: e.definitionId,
            componentOverrides: e.componentOverrides,
          }))
        );
        this.logger.error(
          '[DEBUG] Registry entityDefinitions:',
          allDefs.map((e) => ({
            id: e.id,
            components: Object.keys(e.components),
          }))
        );
      } else {
        this.logger.error('[DEBUG] dataRegistry or getAll not available');
      }
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `Entity '${actorId}' has no valid position or locationId.`,
        details: {
          raw: JSON.stringify({
            entityId: actorId,
            functionName: 'handleTurnStarted',
          }),
          stack: new Error().stack,
        },
      });
      return null;
    }
    return locId;
  }

  /**
   * Gather character display data for entities at a location.
   *
   * @param {string} locationInstanceId - Location instance identifier.
   * @param {NamespacedId} currentActorId - Actor initiating the turn.
   * @returns {Array<import('../../entities/entityDisplayDataProvider.js').CharacterDisplayInfo>} Array of character data.
   */
  gatherLocationCharacters(locationInstanceId, currentActorId) {
    const charactersInLocation = [];
    const entityIdsInLocation =
      this.entityManager.getEntitiesInLocation(locationInstanceId);

    for (const entityIdInLoc of entityIdsInLocation) {
      if (entityIdInLoc === currentActorId) continue;
      const entity = this.entityManager.getEntityInstance(entityIdInLoc);
      if (entity && entity.hasComponent(ACTOR_COMPONENT_ID)) {
        const characterInfo =
          this.entityDisplayDataProvider.getCharacterDisplayInfo(entityIdInLoc);
        if (characterInfo) {
          charactersInLocation.push(characterInfo);
        } else {
          this.logger.warn(
            `[LocationDataService] Could not get display info for character '${entityIdInLoc}'.`
          );
        }
      }
    }
    this.logger.debug(
      `[LocationDataService] Found ${charactersInLocation.length} other characters.`
    );
    return charactersInLocation;
  }
}

export default LocationDataService;
