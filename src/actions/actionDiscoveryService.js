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
import { getAvailableExits } from '../utils/locationUtils.js';
import { getEntityDisplayName } from '../utils/entityUtils.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { getActorLocation } from '../utils/actorLocationUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';

// ────────────────────────────────────────────────────────────────────────────────
/**
 * Service responsible for discovering which actions are available for an
 * actor in a given context.
 */
export class ActionDiscoveryService extends IActionDiscoveryService {
  #gameDataRepository;
  #entityManager;
  #actionValidationService;
  #formatActionCommandFn;
  #getEntityIdsForScopesFn;
  #getAvailableExitsFn;
  #logger;
  #safeEventDispatcher;

  /**
   * Creates an instance of ActionDiscoveryService.
   *
   * @param {object} deps - Service dependencies.
   * @param {GameDataRepository} deps.gameDataRepository - Repository exposing action definitions.
   * @param {EntityManager} deps.entityManager - Entity manager used for lookups.
   * @param {ActionValidationService} deps.actionValidationService - Validates whether actions are usable.
   * @param {ILogger} deps.logger - Logger used for diagnostic output.
   * @param {formatActionCommandFn} deps.formatActionCommandFn - Function that converts actions to commands.
   * @param {getEntityIdsForScopesFn} deps.getEntityIdsForScopesFn - Resolves entity IDs from target scopes.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher used to emit error events.
   * @param {typeof getAvailableExits} [deps.getAvailableExitsFn] - Function to retrieve exits for a location.
   */
  constructor({
    gameDataRepository,
    entityManager,
    actionValidationService,
    logger,
    formatActionCommandFn,
    getEntityIdsForScopesFn,
    safeEventDispatcher,
    getAvailableExitsFn = getAvailableExits,
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
      getAvailableExitsFn: { value: getAvailableExitsFn, isFunction: true },
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
    this.#getAvailableExitsFn = getAvailableExitsFn;
    this.#safeEventDispatcher = safeEventDispatcher;

    this.#logger.debug('ActionDiscoveryService initialised.');
  }

  /**
   * Discover all actions that the given actor can perform in the supplied context.
   *
   * @param {Entity} actorEntity - The entity attempting to act.
   * @param {ActionContext} context - Context such as current location and world state.
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]>} Resolves with an array of discovered actions.
   */
  async getValidActions(actorEntity, context) {
    this.#logger.debug(
      `Starting action discovery for actor: ${actorEntity.id}`
    );
    const allDefs = this.#gameDataRepository.getAllActionDefinitions();
    /** @type {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} */
    const validActions = [];

    /* ── Resolve actor location via utility ───────── */
    let currentLocation = getActorLocation(actorEntity.id, this.#entityManager);

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
                getEntityDisplayNameFn: getEntityDisplayName,
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

          const exits = this.#getAvailableExitsFn(
            currentLocation,
            this.#entityManager,
            this.#safeEventDispatcher,
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
                  getEntityDisplayNameFn: getEntityDisplayName,
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
                  getEntityDisplayNameFn: getEntityDisplayName,
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
