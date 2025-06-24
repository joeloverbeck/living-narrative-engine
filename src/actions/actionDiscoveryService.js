// ────────────────────────────────────────────────────────────────────────────────
// Type imports
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./validation/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('./actionFormatter.js').formatActionCommand} formatActionCommandFn */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../scopeDsl/scopeRegistry.js').default} ScopeRegistry */

import { ActionTargetContext } from '../models/actionTargetContext.js';
import { IActionDiscoveryService } from '../interfaces/IActionDiscoveryService.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../constants/targetDomains.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { getActorLocation } from '../utils/actorLocationUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { getEntityDisplayName } from '../utils/entityUtils.js';
import { DomainContextIncompatibilityError } from '../errors/domainContextIncompatibilityError.js';
import { parseDslExpression } from '../scopeDsl/parser.js';

// ────────────────────────────────────────────────────────────────────────────────
/**
 * @class ActionDiscoveryService
 * @augments IActionDiscoveryService
 * @description Discovers valid actions for entities. Does not extend BaseService because it already inherits from IActionDiscoveryService.
 */
export class ActionDiscoveryService extends IActionDiscoveryService {
  #gameDataRepository;
  #entityManager;
  #actionValidationService;
  #formatActionCommandFn;
  #logger;
  #safeEventDispatcher;
  #getActorLocationFn;
  #getEntityDisplayNameFn;
  #scopeRegistry;
  #scopeEngine;

  /**
   * @param {object} deps
   * @param {GameDataRepository} deps.gameDataRepository
   * @param {EntityManager}      deps.entityManager
   * @param {ActionValidationService} deps.actionValidationService
   * @param {ILogger}            deps.logger
   * @param {formatActionCommandFn} deps.formatActionCommandFn
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {ScopeRegistry}      deps.scopeRegistry
   * @param {import('../interfaces/IScopeEngine.js').IScopeEngine} deps.scopeEngine
   * @param {Function}           deps.getActorLocationFn
   * @param {Function}           deps.getEntityDisplayNameFn
   */
  constructor({
    gameDataRepository,
    entityManager,
    actionValidationService,
    logger,
    formatActionCommandFn,
    safeEventDispatcher,
    scopeRegistry,
    scopeEngine,
    getActorLocationFn = getActorLocation,
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
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      scopeRegistry: { value: scopeRegistry, requiredMethods: ['getScope'] },
      scopeEngine: { value: scopeEngine, requiredMethods: ['resolve'] },
      getActorLocationFn: { value: getActorLocationFn, isFunction: true },
      getEntityDisplayNameFn: {
        value: getEntityDisplayNameFn,
        isFunction: true,
      },
    });

    this.#gameDataRepository = gameDataRepository;
    this.#entityManager = entityManager;
    this.#actionValidationService = actionValidationService;
    this.#formatActionCommandFn = formatActionCommandFn;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#scopeRegistry = scopeRegistry;
    this.#scopeEngine = scopeEngine;
    this.#getActorLocationFn = getActorLocationFn;
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
   * @throws {DomainContextIncompatibilityError} Propagates error from validation service.
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
      // This will now only be false for "normal" failures like prerequisites.
      // Domain/context failures will throw an error, which is handled by #processActionDefinition.
      return null;
    }

    const formatResult = this.#formatActionCommandFn(
      actionDef,
      targetCtx,
      this.#entityManager,
      formatterOptions,
      this.#getEntityDisplayNameFn
    );
    if (!formatResult.ok) {
      return null;
    }

    const formattedCommand = formatResult.value;

    return {
      id: actionDef.id,
      name: actionDef.name || actionDef.commandVerb,
      command: formattedCommand,
      description: actionDef.description || '',
      params,
    };
  }

  /**
   * @description Handles discovery for actions targeting 'self' or having no target.
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {object} formatterOptions
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]}
   */
  #handleSelfOrNone(actionDef, actorEntity, formatterOptions) {
    const targetCtx =
      actionDef.scope === TARGET_DOMAIN_SELF
        ? ActionTargetContext.forEntity(actorEntity.id)
        : ActionTargetContext.noTarget();

    const action = this.#buildDiscoveredAction(
      actionDef,
      actorEntity,
      targetCtx,
      formatterOptions
    );

    return [action].filter(Boolean);
  }

  /**
   * @description Handles discovery for actions targeting entities via scope domains.
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {string} scopeName - The scope name.
   * @param {ActionContext} context - Current action context.
   * @param {object} formatterOptions - Formatter options.
   * @returns {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]}
   */
  #handleScopedEntityActions(
    actionDef,
    actorEntity,
    scopeName,
    context,
    formatterOptions
  ) {
    this.#logger.debug(`Resolving scope '${scopeName}' with DSL`);
    const scopeDefinition = this.#scopeRegistry.getScope(scopeName);

    if (
      !scopeDefinition ||
      typeof scopeDefinition.expr !== 'string' ||
      !scopeDefinition.expr.trim()
    ) {
      const errorMessage = `Missing scope definition: Scope '${scopeName}' not found or has no expression in registry.`;
      this.#logger.warn(errorMessage);
      safeDispatchError(this.#safeEventDispatcher, errorMessage, { scopeName });
      return [];
    }

    let targetIds;
    try {
      const ast = parseDslExpression(scopeDefinition.expr);

      // The scope engine needs a specific 'runtime context', not the general 'action context'.
      const runtimeCtx = {
        entityManager: this.#entityManager,
        // FIX: Defensively default jsonLogicEval to an empty object if not provided.
        jsonLogicEval: context.jsonLogicEval || {},
        logger: this.#logger,
        actor: actorEntity,
        location: context.currentLocation, // Use currentLocation prepared by #prepareDiscoveryContext
      };

      targetIds =
        this.#scopeEngine.resolve(ast, actorEntity, runtimeCtx) ?? new Set();
    } catch (error) {
      this.#logger.error(
        `Error resolving scope '${scopeName}' with DSL:`,
        error
      );
      safeDispatchError(
        this.#safeEventDispatcher,
        `Error resolving scope '${scopeName}': ${error.message}`,
        { error: error.message, stack: error.stack }
      );
      return [];
    }

    /** @type {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} */
    const discoveredActions = [];

    for (const targetId of targetIds) {
      const targetCtx = ActionTargetContext.forEntity(targetId);

      const action = this.#buildDiscoveredAction(
        actionDef,
        actorEntity,
        targetCtx,
        formatterOptions,
        { targetId }
      );

      if (action) {
        discoveredActions.push(action);
      }
    }

    return discoveredActions;
  }

  /**
   * @description Processes a single action definition using the appropriate
   * handler. Errors are safely dispatched and result in no actions returned.
   * @param {import('../data/gameDataRepository.js').ActionDefinition} actionDef
   * @param {Entity} actorEntity
   * @param {ActionContext} context
   * @param {object} formatterOptions
   * @returns {{actions: import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[], errors: Error[]}}
   */
  #processActionDefinition(actionDef, actorEntity, context, formatterOptions) {
    const scope = actionDef.scope;
    try {
      let actions;
      if (scope === TARGET_DOMAIN_NONE || scope === TARGET_DOMAIN_SELF) {
        actions = this.#handleSelfOrNone(
          actionDef,
          actorEntity,
          formatterOptions
        );
      } else {
        actions = this.#handleScopedEntityActions(
          actionDef,
          actorEntity,
          scope,
          context,
          formatterOptions
        );
      }
      return { actions, errors: [] };
    } catch (err) {
      if (err instanceof DomainContextIncompatibilityError) {
        const detailsPayload = {
          actionId: err.actionId,
          actorId: err.actorId,
          targetId: err.targetId,
          expectedScope: err.expectedScope,
          actualContextType: err.contextType,
        };

        safeDispatchError(
          this.#safeEventDispatcher,
          `Domain/Context Incompatibility: ${err.message}`,
          {
            raw: JSON.stringify(detailsPayload, null, 2),
            stack: err.stack,
            timestamp: new Date().toISOString(),
          }
        );
      } else {
        safeDispatchError(
          this.#safeEventDispatcher,
          `ActionDiscoveryService: Error processing action ${actionDef.id} for actor ${actorEntity.id}.`,
          { error: err.message, stack: err.stack }
        );
      }
      return { actions: [], errors: [err] };
    }
  }

  /**
   * @description Prepares a populated discovery context for the specified actor.
   * @param {Entity} actorEntity
   * @param {ActionContext} context
   * @returns {ActionContext}
   */
  #prepareDiscoveryContext(actorEntity, context) {
    const discoveryContext = { ...context };
    if (!discoveryContext.getActor) {
      discoveryContext.getActor = () => actorEntity;
    }

    discoveryContext.currentLocation =
      context.currentLocation ??
      this.#getActorLocationFn(actorEntity.id, this.#entityManager);

    return discoveryContext;
  }

  /**
   * @param {Entity} actorEntity
   * @param {ActionContext} context
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionsResult>}
   */
  async getValidActions(actorEntity, context) {
    // Handle null actorEntity gracefully
    if (!actorEntity) {
      this.#logger.debug('Actor entity is null; returning empty result.');
      return { actions: [], errors: [] };
    }

    this.#logger.debug(
      `Starting action discovery for actor: ${actorEntity.id}`
    );
    const allDefs = this.#gameDataRepository.getAllActionDefinitions();
    /** @type {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} */
    const validActions = [];
    /** @type {Error[]} */
    const errors = [];

    const formatterOptions = {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };

    // Prepare context for this discovery operation
    const discoveryContext = this.#prepareDiscoveryContext(
      actorEntity,
      context
    );

    /* ── iterate over action definitions ─────────────────────────────────── */
    for (const actionDef of allDefs) {
      const { actions, errors: discoveredErrors } =
        this.#processActionDefinition(
          actionDef,
          actorEntity,
          discoveryContext,
          formatterOptions
        );
      validActions.push(...actions);
      errors.push(...discoveredErrors);
    }

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${validActions.length} actions.`
    );
    return { actions: validActions, errors };
  }
}
