// src/actions/actionDiscoveryService.js
// ────────────────────────────────────────────────────────────────────────────────
// Type imports
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./validation/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../entities/entityScopeService.js').getEntityIdsForScopes} getEntityIdsForScopesFn */
/** @typedef {import('./actionFormatter.js').formatActionCommand} formatActionCommandFn */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { ActionTargetContext } from '../models/actionTargetContext.js';
import { IActionDiscoveryService } from '../interfaces/IActionDiscoveryService.js';
import {
  getAvailableExits,
  getLocationIdForLog,
} from '../utils/locationUtils.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { getActorLocation } from '../utils/actorLocationUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { getEntityDisplayName } from '../utils/entityUtils.js';

// ────────────────────────────────────────────────────────────────────────────────
export class ActionDiscoveryService extends IActionDiscoveryService {
  #gameDataRepository;
  #entityManager;
  #actionValidationService;
  #formatActionCommandFn;
  #getEntityIdsForScopesFn;
  #logger;
  #safeEventDispatcher;

  /**
   * @param {object} deps
   * @param {GameDataRepository} deps.gameDataRepository
   * @param {EntityManager}      deps.entityManager
   * @param {ActionValidationService} deps.actionValidationService
   * @param {ILogger}            deps.logger
   * @param {formatActionCommandFn} deps.formatActionCommandFn
   * @param {getEntityIdsForScopesFn} deps.getEntityIdsForScopesFn
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({
    gameDataRepository,
    entityManager,
    actionValidationService,
    logger,
    formatActionCommandFn,
    getEntityIdsForScopesFn,
    safeEventDispatcher,
  }) {
    super();
    this.#logger = setupService('ActionDiscoveryService', logger, {
      gameDataRepository: {
        value: gameDataRepository,
        requiredMethods: ['getAllActionDefinitions'],
      },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'getEntityInstance'],
      },
      actionValidationService: {
        value: actionValidationService,
        requiredMethods: ['isValid'],
      },
      formatActionCommandFn: { value: formatActionCommandFn, isFunction: true },
      getEntityIdsForScopesFn: {
        value: getEntityIdsForScopesFn,
        isFunction: true,
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    this.#gameDataRepository = gameDataRepository;
    this.#entityManager = entityManager;
    this.#actionValidationService = actionValidationService;
    this.#formatActionCommandFn = formatActionCommandFn;
    this.#getEntityIdsForScopesFn = getEntityIdsForScopesFn;
    this.#safeEventDispatcher = safeEventDispatcher;

    this.#logger.debug('ActionDiscoveryService initialised.');
  }

  /**
   * @description Builds a DiscoveredActionInfo object for a valid action.
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef - The action definition.
   * @param {Entity} actorEntity - The entity performing the action.
   * @param {ActionTargetContext} targetCtx - The context of the action target.
   * @param {object} formatterOptions - Options for formatting the command string.
   * @param {object} params - Extra params to include in the result.
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo|null} The info object or null.
   */
  // eslint-disable-next-line no-unused-private-class-members
  #buildDiscoveredAction(
    actionDef,
    actorEntity,
    targetCtx,
    formatterOptions,
    params = {}
  ) {
    if (
      !this.#actionValidationService.isValid(actionDef, actorEntity, targetCtx)
    ) {
      return null;
    }

    const formattedCommand = this.#formatActionCommandFn(
      actionDef,
      targetCtx,
      this.#entityManager,
      formatterOptions,
      getEntityDisplayName
    );

    if (formattedCommand === null) {
      return null;
    }

    return {
      id: actionDef.id,
      name: actionDef.name || actionDef.commandVerb,
      command: formattedCommand,
      description: actionDef.description || '',
      params,
    };
  }

  /**
   * Handles discovery for actions targeting 'self' or having no target.
   *
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {object} formatterOptions
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]}
   */
  #discoverSelfOrNone(actionDef, actorEntity, formatterOptions) {
    const targetCtx =
      actionDef.target_domain === 'self'
        ? ActionTargetContext.forEntity(actorEntity.id)
        : ActionTargetContext.noTarget();

    if (
      !this.#actionValidationService.isValid(actionDef, actorEntity, targetCtx)
    ) {
      return [];
    }

    const formattedCommand = this.#formatActionCommandFn(
      actionDef,
      targetCtx,
      this.#entityManager,
      formatterOptions,
      getEntityDisplayName
    );

    if (formattedCommand === null) {
      return [];
    }

    return [
      {
        id: actionDef.id,
        name: actionDef.name || actionDef.commandVerb,
        command: formattedCommand,
        description: actionDef.description || '',
        params: {},
      },
    ];
  }

  /**
   * Handles discovery for actions targeting a direction.
   *
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {Entity|string|null} currentLocation
   * @param {string} locIdForLog
   * @param {object} formatterOptions
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]}
   */
  #discoverDirectionalActions(
    actionDef,
    actorEntity,
    currentLocation,
    locIdForLog,
    formatterOptions
  ) {
    if (!currentLocation) {
      this.#logger.debug(
        `No location for actor ${actorEntity.id}; skipping direction-based actions.`
      );
      return [];
    }

    const exits = getAvailableExits(
      currentLocation,
      this.#entityManager,
      this.#safeEventDispatcher,
      this.#logger
    );
    this.#logger.debug(
      `Found ${exits.length} available exits for location: ${locIdForLog} via getAvailableExits.`
    );

    /** @type {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} */
    const discoveredActions = [];

    for (const exit of exits) {
      const targetCtx = ActionTargetContext.forDirection(exit.direction);

      if (
        !this.#actionValidationService.isValid(
          actionDef,
          actorEntity,
          targetCtx
        )
      ) {
        continue;
      }

      const formattedCommand = this.#formatActionCommandFn(
        actionDef,
        targetCtx,
        this.#entityManager,
        formatterOptions,
        getEntityDisplayName
      );

      if (formattedCommand === null) {
        continue;
      }

      discoveredActions.push({
        id: actionDef.id,
        name: actionDef.name || actionDef.commandVerb,
        command: formattedCommand,
        description: actionDef.description || '',
        params: { targetId: exit.target },
      });
    }

    return discoveredActions;
  }

  /**
   * Handles discovery for actions targeting entities via scope domains.
   *
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {string} domain
   * @param {ActionContext} context
   * @param {object} formatterOptions
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]}
   */
  #discoverScopedEntityActions(
    actionDef,
    actorEntity,
    domain,
    context,
    formatterOptions
  ) {
    const targetIds =
      this.#getEntityIdsForScopesFn([domain], context) ?? new Set();
    /** @type {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} */
    const discoveredActions = [];

    for (const targetId of targetIds) {
      const targetCtx = ActionTargetContext.forEntity(targetId);
      if (
        !this.#actionValidationService.isValid(
          actionDef,
          actorEntity,
          targetCtx
        )
      ) {
        continue;
      }

      const formattedCommand = this.#formatActionCommandFn(
        actionDef,
        targetCtx,
        this.#entityManager,
        formatterOptions,
        getEntityDisplayName
      );

      if (formattedCommand === null) {
        continue;
      }

      discoveredActions.push({
        id: actionDef.id,
        name: actionDef.name || actionDef.commandVerb,
        command: formattedCommand,
        description: actionDef.description || '',
        params: { targetId },
      });
    }

    return discoveredActions;
  }

  /**
   * @param {Entity} actorEntity
   * @param {ActionContext} context
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]>}
   */
  async getValidActions(actorEntity, context) {
    this.#logger.debug(
      `Starting action discovery for actor: ${actorEntity.id}`
    );
    const allDefs = this.#gameDataRepository.getAllActionDefinitions();
    /** @type {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} */
    const validActions = [];

    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    /* ── Resolve actor location via utility ───────── */
    let currentLocation = getActorLocation(actorEntity.id, this.#entityManager);

    const locIdForLog = getLocationIdForLog(currentLocation);

    /* ── iterate over action definitions ─────────────────────────────────── */
    for (const actionDef of allDefs) {
      const domain = actionDef.target_domain;
      try {
        let discovered = [];
        switch (domain) {
          case 'none':
          case 'self':
            discovered = this.#discoverSelfOrNone(
              actionDef,
              actorEntity,
              formatterOptions
            );
            break;
          case 'direction':
            discovered = this.#discoverDirectionalActions(
              actionDef,
              actorEntity,
              currentLocation,
              locIdForLog,
              formatterOptions
            );
            break;
          default:
            discovered = this.#discoverScopedEntityActions(
              actionDef,
              actorEntity,
              domain,
              context,
              formatterOptions
            );
        }
        validActions.push(...discovered);
      } catch (err) {
        safeDispatchError(
          this.#safeEventDispatcher,
          `ActionDiscoveryService: Error processing action ${actionDef.id} for actor ${actorEntity.id}.`,
          { error: err.message, stack: err.stack }
        );
      }
    }

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${validActions.length} actions.`
    );
    return validActions;
  }
}
