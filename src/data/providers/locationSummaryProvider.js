/**
 * @file This module provides location summary data.
 * @see src/data/providers/locationSummaryProvider.js
 */

import { ILocationSummaryProvider } from '../../interfaces/ILocationSummaryProvider.js';
import {
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../constants/componentIds.js';
import {
  DEFAULT_FALLBACK_EXIT_DIRECTION,
  DEFAULT_FALLBACK_LOCATION_NAME,
} from '../../constants/textDefaults.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AILocationSummaryDTO} AILocationSummaryDTO */
/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AILocationExitDTO} AILocationExitDTO */
/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AICharacterInLocationDTO} AICharacterInLocationDTO */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IEntitySummaryProvider.js').IEntitySummaryProvider} IEntitySummaryProvider */
/** @typedef {import('../../locations/services/lightingStateService.js').LightingStateService} ILightingStateService */

/** Component ID for darkness description */
const DESCRIPTION_IN_DARKNESS_COMPONENT_ID = 'locations:description_in_darkness';
const OPENABLE_COMPONENT_ID = 'mechanisms:openable';

export class LocationSummaryProvider extends ILocationSummaryProvider {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IEntitySummaryProvider} */
  #summaryProvider;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;
  /** @type {ILightingStateService} */
  #lightingStateService;

  /**
   * Creates the provider.
   *
   * @param {object} dependencies - Constructor dependencies
   * @param {IEntityManager} dependencies.entityManager - Provides entity lookups.
   * @param {IEntitySummaryProvider} dependencies.summaryProvider - Supplies summary data for entities.
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.safeEventDispatcher - Dispatcher for error events.
   * @param {ILightingStateService} dependencies.lightingStateService - Service for querying location lighting state.
   */
  constructor({
    entityManager,
    summaryProvider,
    safeEventDispatcher,
    lightingStateService,
  }) {
    super();
    if (!safeEventDispatcher?.dispatch) {
      throw new Error(
        'LocationSummaryProvider requires a valid ISafeEventDispatcher.'
      );
    }
    this.#entityManager = entityManager;
    this.#summaryProvider = summaryProvider;
    /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
    this.#dispatcher = safeEventDispatcher;
    this.#lightingStateService = lightingStateService;
  }

  async #buildExitDTOs(locationEntity) {
    const exitsComponentData =
      locationEntity.getComponentData(EXITS_COMPONENT_ID);
    if (!exitsComponentData || !Array.isArray(exitsComponentData)) return [];

    const exitPromises = exitsComponentData
      .filter((exitData) => exitData.target)
      .map(async (exitData) => {
        try {
          const targetEntity = await this.#entityManager.getEntityInstance(
            exitData.target
          );
          const targetSummary = targetEntity
            ? this.#summaryProvider.getSummary(targetEntity)
            : null;
          const exitSummary = {
            direction: exitData.direction || DEFAULT_FALLBACK_EXIT_DIRECTION,
            targetLocationId: exitData.target,
            targetLocationName:
              targetSummary?.name || DEFAULT_FALLBACK_LOCATION_NAME,
          };
          if (!exitData.blocker) {
            return exitSummary;
          }
          try {
            const blockerEntity = await this.#entityManager.getEntityInstance(
              exitData.blocker
            );
            if (!blockerEntity) {
              return exitSummary;
            }
            const blockerSummary = this.#summaryProvider.getSummary(
              blockerEntity
            );
            const openableState =
              blockerEntity.getComponentData(OPENABLE_COMPONENT_ID) || {};
            const blockerIsLocked = openableState.isLocked === true;
            const blockerIsOpen = openableState.isOpen === true;
            const isBlocked =
              blockerIsLocked || openableState.isOpen === false;
            return {
              ...exitSummary,
              blockerId: exitData.blocker,
              blockerName: blockerSummary?.name || 'Unknown blocker',
              isBlocked,
              blockerIsLocked,
              blockerIsOpen,
            };
          } catch (err) {
            safeDispatchError(
              this.#dispatcher,
              `LocationSummaryProvider: Error fetching blocker entity '${exitData.blocker}': ${err.message}`,
              { error: err.message, stack: err.stack, exitData }
            );
            return exitSummary;
          }
        } catch (err) {
          safeDispatchError(
            this.#dispatcher,
            `LocationSummaryProvider: Error fetching exit target entity '${exitData.target}': ${err.message}`,
            { error: err.message, stack: err.stack, exitData }
          );
          return null;
        }
      });

    return (await Promise.all(exitPromises)).filter(Boolean);
  }

  async #buildCharacterDTOs(locationId, actorToExcludeId, logger) {
    const entityIdsSet =
      await this.#entityManager.getEntitiesInLocation(locationId);
    if (!entityIdsSet) return [];

    const characterPromises = Array.from(entityIdsSet)
      .filter((id) => id !== actorToExcludeId)
      .map(async (entityId) => {
        try {
          const otherEntity =
            await this.#entityManager.getEntityInstance(entityId);
          // Only include entities with core:actor component (actual characters)
          // This filters out non-character entities like bulletin boards, items, etc.
          if (!otherEntity?.hasComponent('core:actor')) {
            return null;
          }
          // The summary DTO has id, name, and description, which matches AICharacterInLocationDTO
          return this.#summaryProvider.getSummary(otherEntity);
        } catch (err) {
          logger.warn(
            `LocationSummaryProvider: Could not retrieve entity '${entityId}' in location '${locationId}': ${err.message}`
          );
          return null;
        }
      });

    return (await Promise.all(characterPromises)).filter(Boolean);
  }

  /**
   * @override
   */
  async build(actor, logger) {
    logger.debug(
      `LocationSummaryProvider: Building location summary for actor ${actor.id}`
    );
    const position = actor.getComponentData(POSITION_COMPONENT_ID);
    if (!position?.locationId) {
      logger.debug(
        `LocationSummaryProvider: Actor ${actor.id} has no locationId.`
      );
      return null;
    }

    try {
      const locationEntity = await this.#entityManager.getEntityInstance(
        position.locationId
      );
      if (!locationEntity) {
        logger.warn(
          `LocationSummaryProvider: Location entity '${position.locationId}' not found.`
        );
        return null;
      }

      const locationSummary = this.#summaryProvider.getSummary(locationEntity);
      const exits = await this.#buildExitDTOs(locationEntity);
      const characters = await this.#buildCharacterDTOs(
        locationEntity.id,
        actor.id,
        logger
      );

      // Get lighting state from the lighting state service
      const { isLit } = this.#lightingStateService.getLocationLightingState(
        locationEntity.id
      );

      // Get darkness description if the component is present
      const darknessDescData = locationEntity.getComponentData(
        DESCRIPTION_IN_DARKNESS_COMPONENT_ID
      );
      const descriptionInDarkness = darknessDescData?.text || null;

      /** @type {AILocationSummaryDTO} */
      return {
        name: locationSummary.name || DEFAULT_FALLBACK_LOCATION_NAME,
        description: locationSummary.description,
        exits,
        characters,
        isLit,
        descriptionInDarkness,
      };
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `LocationSummaryProvider: Critical error generating summary for location '${position.locationId}': ${err.message}`,
        {
          error: err.message,
          stack: err.stack,
          locationId: position.locationId,
          actorId: actor.id,
        }
      );
      return null;
    }
  }
}
