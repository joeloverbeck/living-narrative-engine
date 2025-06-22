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

  static DOMAIN_HANDLERS = {
    none(
      actionDef,
      actorEntity,
      _currentLocation,
      _locIdForLog,
      _domain,
      _context,
      formatterOptions
    ) {
      return discoverSelfOrNone(
        actionDef,
        actorEntity,
        formatterOptions,
        this.#buildDiscoveredAction.bind(this)
      );
    },
    self(
      actionDef,
      actorEntity,
      _currentLocation,
      _locIdForLog,
      _domain,
      _context,
      formatterOptions
    ) {
      return discoverSelfOrNone(
        actionDef,
        actorEntity,
        formatterOptions,
        this.#buildDiscoveredAction.bind(this)
      );
    },
    direction(
      actionDef,
      actorEntity,
      currentLocation,
      locIdForLog,
      _domain,
      _context,
      formatterOptions
    ) {
      return discoverDirectionalActions(
        actionDef,
        actorEntity,
        currentLocation,
        locIdForLog,
        formatterOptions,
        this.#buildDiscoveredAction.bind(this),
        this.#entityManager,
        this.#safeEventDispatcher,
        this.#logger
      );
    },
  };

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
        function (
          actionDefArg,
          actorEntityArg,
          _currentLocationArg,
          _locIdForLogArg,
          domainArg,
          contextArg,
          formatterOptionsArg
        ) {
          return discoverScopedEntityActions(
            actionDefArg,
            actorEntityArg,
            domainArg,
            contextArg,
            formatterOptionsArg,
            this.#buildDiscoveredAction.bind(this),
            this.#getEntityIdsForScopesFn,
            this.#logger
          );
        };
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
    let currentLocation = getActorLocation(actorEntity.id, this.#entityManager);

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
