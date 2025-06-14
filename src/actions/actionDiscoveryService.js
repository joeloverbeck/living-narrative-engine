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
import { validateDependency } from '../utils/validationUtils.js';
import { getAvailableExits } from '../utils/locationUtils.js';
import { createPrefixedLogger } from '../utils/loggerUtils.js';

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
    validateDependency(logger, 'ActionDiscoveryService: logger', console, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#logger = createPrefixedLogger(logger, 'ActionDiscoveryService: ');

    validateDependency(
      gameDataRepository,
      'ActionDiscoveryService: gameDataRepository',
      this.#logger,
      { requiredMethods: ['getAllActionDefinitions'] }
    );
    validateDependency(
      entityManager,
      'ActionDiscoveryService: entityManager',
      this.#logger,
      { requiredMethods: ['getComponentData', 'getEntityInstance'] }
    );
    validateDependency(
      actionValidationService,
      'ActionDiscoveryService: actionValidationService',
      this.#logger,
      { requiredMethods: ['isValid'] }
    );
    validateDependency(
      formatActionCommandFn,
      'ActionDiscoveryService: formatActionCommandFn',
      this.#logger,
      { isFunction: true }
    );
    validateDependency(
      getEntityIdsForScopesFn,
      'ActionDiscoveryService: getEntityIdsForScopesFn',
      this.#logger,
      { isFunction: true }
    );
    validateDependency(
      safeEventDispatcher,
      'ActionDiscoveryService: safeEventDispatcher',
      this.#logger,
      { requiredMethods: ['dispatch'] }
    );

    this.#gameDataRepository = gameDataRepository;
    this.#entityManager = entityManager;
    this.#actionValidationService = actionValidationService;
    this.#formatActionCommandFn = formatActionCommandFn;
    this.#getEntityIdsForScopesFn = getEntityIdsForScopesFn;
    this.#safeEventDispatcher = safeEventDispatcher;

    this.#logger.debug('ActionDiscoveryService initialised.');
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

    /* ── Resolve actor location (entity preferred, id as fallback) ───────── */
    let currentLocation = null;
    try {
      const pos = this.#entityManager.getComponentData(
        actorEntity.id,
        'core:position'
      );
      if (pos && typeof pos.locationId === 'string' && pos.locationId) {
        currentLocation =
          this.#entityManager.getEntityInstance(pos.locationId) ??
          pos.locationId;
      }
    } catch {
      /* ignore – currentLocation remains null */
    }
    const locIdForLog =
      typeof currentLocation === 'string'
        ? currentLocation
        : (currentLocation?.id ?? 'unknown');

    /* ── iterate over action definitions ─────────────────────────────────── */
    for (const actionDef of allDefs) {
      const domain = actionDef.target_domain;
      try {
        /* 1) none / self */
        if (domain === 'none' || domain === 'self') {
          const targetCtx =
            domain === 'self'
              ? ActionTargetContext.forEntity(actorEntity.id)
              : ActionTargetContext.noTarget();

          if (
            this.#actionValidationService.isValid(
              actionDef,
              actorEntity,
              targetCtx
            )
          ) {
            const cmd = this.#formatActionCommandFn(
              actionDef,
              targetCtx,
              this.#entityManager,
              {
                logger: this.#logger,
                debug: true,
                safeEventDispatcher: this.#safeEventDispatcher,
              }
            );
            if (cmd !== null) {
              validActions.push({
                id: actionDef.id,
                name: actionDef.name || actionDef.commandVerb,
                command: cmd,
                description: actionDef.description || '',
                params: {},
              });
            }
          }

          /* 2) direction */
        } else if (domain === 'direction') {
          if (!currentLocation) {
            this.#logger.debug(
              `No location for actor ${actorEntity.id}; skipping direction-based actions.`
            );
            continue;
          }

          const exits = getAvailableExits(
            currentLocation,
            this.#entityManager,
            this.#logger
          );
          this.#logger.debug(
            `Found ${exits.length} available exits for location: ${locIdForLog} via getAvailableExits.`
          );

          for (const exit of exits) {
            const targetCtx = ActionTargetContext.forDirection(exit.direction);

            if (
              this.#actionValidationService.isValid(
                actionDef,
                actorEntity,
                targetCtx
              )
            ) {
              const cmd = this.#formatActionCommandFn(
                actionDef,
                targetCtx,
                this.#entityManager,
                {
                  logger: this.#logger,
                  debug: true,
                  safeEventDispatcher: this.#safeEventDispatcher,
                }
              );
              if (cmd !== null) {
                validActions.push({
                  id: actionDef.id,
                  name: actionDef.name || actionDef.commandVerb,
                  command: cmd,
                  description: actionDef.description || '',
                  params: { targetId: exit.target },
                });
              }
            }
          }

          /* 3) other scopes / entity */
        } else {
          const ids =
            this.#getEntityIdsForScopesFn([domain], context) ?? new Set();
          for (const targetId of ids) {
            const targetCtx = ActionTargetContext.forEntity(targetId);
            if (
              this.#actionValidationService.isValid(
                actionDef,
                actorEntity,
                targetCtx
              )
            ) {
              const cmd = this.#formatActionCommandFn(
                actionDef,
                targetCtx,
                this.#entityManager,
                {
                  logger: this.#logger,
                  debug: true,
                  safeEventDispatcher: this.#safeEventDispatcher,
                }
              );
              if (cmd !== null) {
                validActions.push({
                  id: actionDef.id,
                  name: actionDef.name || actionDef.commandVerb,
                  command: cmd,
                  description: actionDef.description || '',
                  params: { targetId },
                });
              }
            }
          }
        }
      } catch (err) {
        this.#logger.error(
          `Error processing action ${actionDef.id} for actor ${actorEntity.id}:`,
          err
        );
      }
    }

    this.#logger.debug(
      `Finished action discovery for actor ${actorEntity.id}. Found ${validActions.length} actions.`
    );
    return validActions;
  }
}
