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
  getLocationIdForLog,
  getAvailableExits,
} from '../utils/locationUtils.js';
import {
  discoverSelfOrNone,
  discoverDirectionalActions,
  discoverScopedEntityActions,
} from './discoveryHandlers.js';
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
  #getActorLocationFn;
  #getAvailableExitsFn;
  #getEntityDisplayNameFn;

  static DOMAIN_HANDLERS = {
    none(...args) {
      return ActionDiscoveryService.callHandler(
        discoverSelfOrNone,
        this,
        ...args
      );
    },
    self(...args) {
      return ActionDiscoveryService.callHandler(
        discoverSelfOrNone,
        this,
        ...args
      );
    },
    direction(...args) {
      return ActionDiscoveryService.callHandler(
        discoverDirectionalActions,
        this,
        ...args
      );
    },
  };

  /**
   * @description Wrapper that invokes the provided discovery handler with
   *   parameters forwarded from DOMAIN_HANDLERS.
   * @param {Function} handler - Discovery handler to invoke.
   * @param {ActionDiscoveryService} svc - Service instance providing context.
   * @param {...any} args - Arguments forwarded from DOMAIN_HANDLERS.
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]}
   *   Results from the handler.
   */
  static callHandler(handler, svc, ...args) {
    const [
      actionDef,
      actorEntity,
      currentLocation,
      locIdForLog,
      domain,
      context,
      formatterOptions,
    ] = args;

    switch (handler) {
      case discoverSelfOrNone:
        return handler(
          actionDef,
          actorEntity,
          formatterOptions,
          svc.#buildDiscoveredAction.bind(svc)
        );
      case discoverDirectionalActions:
        return handler(
          actionDef,
          actorEntity,
          currentLocation,
          locIdForLog,
          formatterOptions,
          svc.#buildDiscoveredAction.bind(svc),
          svc.#entityManager,
          svc.#safeEventDispatcher,
          svc.#logger,
          svc.#getAvailableExitsFn
        );
      default:
        return discoverScopedEntityActions(
          actionDef,
          actorEntity,
          domain,
          context,
          formatterOptions,
          svc.#buildDiscoveredAction.bind(svc),
          svc.#getEntityIdsForScopesFn,
          svc.#logger
        );
    }
  }

  /**
   * @param {object} deps
   * @param {GameDataRepository} deps.gameDataRepository
   * @param {EntityManager}      deps.entityManager
   * @param {ActionValidationService} deps.actionValidationService
   * @param {ILogger}            deps.logger
   * @param {formatActionCommandFn} deps.formatActionCommandFn
   * @param {getEntityIdsForScopesFn} deps.getEntityIdsForScopesFn
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param deps.getActorLocationFn
   * @param deps.getAvailableExitsFn
   * @param deps.getEntityDisplayNameFn
   */
  constructor({
    gameDataRepository,
    entityManager,
    actionValidationService,
    logger,
    formatActionCommandFn,
    getEntityIdsForScopesFn,
    safeEventDispatcher,
    getActorLocationFn = getActorLocation,
    getAvailableExitsFn = getAvailableExits,
    getEntityDisplayNameFn = getEntityDisplayName,
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
      getActorLocationFn: { value: getActorLocationFn, isFunction: true },
      getAvailableExitsFn: { value: getAvailableExitsFn, isFunction: true },
      getEntityDisplayNameFn: {
        value: getEntityDisplayNameFn,
        isFunction: true,
      },
    });

    this.#gameDataRepository = gameDataRepository;
    this.#entityManager = entityManager;
    this.#actionValidationService = actionValidationService;
    this.#formatActionCommandFn = formatActionCommandFn;
    this.#getEntityIdsForScopesFn = getEntityIdsForScopesFn;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getActorLocationFn = getActorLocationFn;
    this.#getAvailableExitsFn = getAvailableExitsFn;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;

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
      this.#getEntityDisplayNameFn
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
   * @description Processes a single action definition using the appropriate
   * handler. Errors are safely dispatched and result in no actions returned.
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {Entity|string|null} currentLocation
   * @param {string} locIdForLog
   * @param {ActionContext} context
   * @param {object} formatterOptions
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]}
   */
  #processActionDefinition(
    actionDef,
    actorEntity,
    currentLocation,
    locIdForLog,
    context,
    formatterOptions
  ) {
    const domain = actionDef.target_domain;
    try {
      const handler =
        this.constructor.DOMAIN_HANDLERS[domain] ||
        ((...handlerArgs) =>
          ActionDiscoveryService.callHandler(
            discoverScopedEntityActions,
            this,
            ...handlerArgs
          ));
      return handler.call(
        this,
        actionDef,
        actorEntity,
        currentLocation,
        locIdForLog,
        domain,
        context,
        formatterOptions
      );
    } catch (err) {
      safeDispatchError(
        this.#safeEventDispatcher,
        `ActionDiscoveryService: Error processing action ${actionDef.id} for actor ${actorEntity.id}.`,
        { error: err.message, stack: err.stack }
      );
      return [];
    }
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
    let currentLocation = this.#getActorLocationFn(
      actorEntity.id,
      this.#entityManager
    );

    const locIdForLog = getLocationIdForLog(currentLocation);

    /* ── iterate over action definitions ─────────────────────────────────── */
    for (const actionDef of allDefs) {
      const discovered = this.#processActionDefinition(
        actionDef,
        actorEntity,
        currentLocation,
        locIdForLog,
        context,
        formatterOptions
      );
      validActions.push(...discovered);
    }

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${validActions.length} actions.`
    );
    return validActions;
  }
}
