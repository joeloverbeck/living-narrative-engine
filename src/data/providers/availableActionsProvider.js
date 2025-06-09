/**
 * @file This module provides the available actions data for an actor.
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

export class AvailableActionsProvider extends IAvailableActionsProvider {
  /** @type {IActionDiscoveryService} */
  #actionDiscoveryService;
  /** @type {IEntityManager} */
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
   */
  async get(actor, turnContext, logger) {
    logger.debug(
      `AvailableActionsProvider: Discovering actions for actor ${actor.id}`
    );
    /** @type {AIAvailableActionDTO[]} */
    let availableActionsDto = [];

    try {
      const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
      const currentLocationId = positionComponent?.locationId;
      let currentLocationEntity = null;
      if (currentLocationId && this.#entityManager) {
        currentLocationEntity =
          await this.#entityManager.getEntityInstance(currentLocationId);
      }

      /** @type {import('../../systems/actionDiscoveryService.js').ActionContext} */
      const actionCtx = {
        actingEntity: actor,
        currentLocation: currentLocationEntity,
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
          command: a.command || DEFAULT_FALLBACK_ACTION_COMMAND,
          name: a.name || DEFAULT_FALLBACK_ACTION_NAME,
          description: a.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
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
