// src/data/providers/availableActionsProvider.js

/**
 * @file Provides available actions data for an actor, now including action params.
 * @see src/data/providers/availableActionsProvider.js
 */

import { IAvailableActionsProvider } from '../../interfaces/IAvailableActionsProvider.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import {
  DEFAULT_FALLBACK_ACTION_ID,
  DEFAULT_FALLBACK_ACTION_COMMAND,
  DEFAULT_FALLBACK_ACTION_NAME,
  DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
} from '../../constants/textDefaults.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Provider that discovers actions via the ActionDiscoveryService and surfaces
 * id, name, command, description, AND params for AI consumption.
 */
export class AvailableActionsProvider extends IAvailableActionsProvider {
  #actionDiscoveryService;
  #entityManager;

  /**
   * @param {object} dependencies
   * @param {IActionDiscoveryService} dependencies.actionDiscoveryService
   * @param {IEntityManager} dependencies.entityManager
   */
  constructor({ actionDiscoveryService, entityManager }) {
    super();
    this.#actionDiscoveryService = actionDiscoveryService;
    this.#entityManager = entityManager;
  }

  /**
   * @override
   * @param {Entity} actor
   * @param {ITurnContext} turnContext
   * @param {ILogger} logger
   * @returns {Promise<AIAvailableActionDTO[]>}
   */
  async get(actor, turnContext, logger) {
    logger.debug(
      `AvailableActionsProvider: Discovering actions for actor ${actor.id}`
    );
    let availableActionsDto = [];

    try {
      const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
      const locationId = positionComponent?.locationId;
      let locationEntity = null;
      if (locationId) {
        locationEntity =
          await this.#entityManager.getEntityInstance(locationId);
      }

      const actionCtx = {
        actingEntity: actor,
        currentLocation: locationEntity,
        entityManager: this.#entityManager,
        worldContext: turnContext?.game ?? {},
        logger,
      };

      const discovered = await this.#actionDiscoveryService.getValidActions(
        actor,
        actionCtx
      );

      if (Array.isArray(discovered)) {
        availableActionsDto = discovered.map((a) => ({
          id: a.id || DEFAULT_FALLBACK_ACTION_ID,
          name: a.name || DEFAULT_FALLBACK_ACTION_NAME,
          command: a.command || DEFAULT_FALLBACK_ACTION_COMMAND,
          description: a.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
          params: a.params || {},
        }));
      }
    } catch (err) {
      logger.error(
        `AvailableActionsProvider: Error discovering actions for ${actor.id}: ${err.message}`,
        err
      );
      availableActionsDto = [];
    }

    return availableActionsDto;
  }
}
