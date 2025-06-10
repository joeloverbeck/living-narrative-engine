// src/actions/actionDiscoveryService.js

// --- Type Imports ---
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./validation/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('./validation/actionValidationService.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../entities/entityScopeService.js').getEntityIdsForScopes} getEntityIdsForScopesFn */
/** @typedef {import('./actionFormatter.js').formatActionCommand} formatActionCommandFn */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionDefinition.js').TargetDomain} TargetDomain */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */

/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id - The unique ID of the action definition.
 * @property {string} name - The human-readable name of the action.
 * @property {string} command - The formatted command string.
 * @property {string} [description] - Optional. The detailed description of the action.
 * @property {object} params - Parameters for the action (at minimum { targetId?: string }).
 * @property {string} [params.targetId] - Optional ID of the target entity or location.
 */

import { ActionTargetContext } from '../models/actionTargetContext.js';
import { IActionDiscoveryService } from '../interfaces/IActionDiscoveryService.js';
import { validateDependency } from '../utils/validationUtils.js';
import { getAvailableExits } from '../utils/locationUtils.js';

export class ActionDiscoveryService extends IActionDiscoveryService {
  #gameDataRepository;
  #entityManager;
  #actionValidationService;
  #formatActionCommandFn;
  #getEntityIdsForScopesFn;
  #logger;

  /**
   * @param {object} dependencies
   * @param {GameDataRepository} dependencies.gameDataRepository
   * @param {EntityManager} dependencies.entityManager
   * @param {ActionValidationService} dependencies.actionValidationService
   * @param {ILogger} dependencies.logger
   * @param {formatActionCommandFn} dependencies.formatActionCommandFn
   * @param {getEntityIdsForScopesFn} dependencies.getEntityIdsForScopesFn
   */
  constructor({
    gameDataRepository,
    entityManager,
    actionValidationService,
    logger,
    formatActionCommandFn,
    getEntityIdsForScopesFn,
  }) {
    super();

    // 1. Validate logger: require debug, warn, error (info is optional)
    try {
      validateDependency(logger, 'ActionDiscoveryService: logger', console, {
        requiredMethods: ['debug', 'warn', 'error'],
      });
      this.#logger = logger;
    } catch (e) {
      const errorMsg = `ActionDiscoveryService Constructor: CRITICAL - Invalid or missing ILogger instance. Error: ${e.message}`;
      // eslint-disable-next-line no-console
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // 2. Validate other dependencies
    try {
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
    } catch (e) {
      this.#logger.error(
        `ActionDiscoveryService Constructor: Dependency validation failed. Error: ${e.message}`
      );
      throw e;
    }

    this.#gameDataRepository = gameDataRepository;
    this.#entityManager = entityManager;
    this.#actionValidationService = actionValidationService;
    this.#formatActionCommandFn = formatActionCommandFn;
    this.#getEntityIdsForScopesFn = getEntityIdsForScopesFn;

    this.#logger.debug('ActionDiscoveryService initialized.');
  }

  /**
   * @param {Entity} actorEntity
   * @param {ActionContext} context
   * @returns {Promise<DiscoveredActionInfo[]>}
   */
  async getValidActions(actorEntity, context) {
    this.#logger.debug(
      `Starting action discovery for actor: ${actorEntity.id}`
    );
    const allDefs = this.#gameDataRepository.getAllActionDefinitions();
    /** @type {DiscoveredActionInfo[]} */
    const validActions = [];

    for (const actionDef of allDefs) {
      const domain = actionDef.target_domain;
      try {
        // --- none / self domains ---
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
            const command = this.#formatActionCommandFn(
              actionDef,
              targetCtx,
              this.#entityManager,
              { logger: this.#logger, debug: true }
            );
            if (command !== null) {
              validActions.push({
                id: actionDef.id,
                name: actionDef.name || actionDef.commandVerb,
                command,
                description: actionDef.description || '',
                params: {},
              });
            }
          }

          // --- directional actions ---
        } else if (domain === 'direction') {
          const exits = getAvailableExits(
            context.currentLocation,
            this.#entityManager,
            this.#logger
          );
          // Log number of available exits
          this.#logger.debug(
            `Found ${exits.length} available exits for location: ${context.currentLocation.id} via getAvailableExits.`
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
              const command = this.#formatActionCommandFn(
                actionDef,
                targetCtx,
                this.#entityManager,
                { logger: this.#logger, debug: true }
              );
              if (command !== null) {
                validActions.push({
                  id: actionDef.id,
                  name: actionDef.name || actionDef.commandVerb,
                  command,
                  description: actionDef.description || '',
                  params: { targetId: exit.target },
                });
              }
            }
          }

          // --- entity‐scope actions (including 'entity') ---
        } else {
          const potentialIds = this.#getEntityIdsForScopesFn([domain], context);

          for (const targetId of potentialIds) {
            const targetCtx = ActionTargetContext.forEntity(targetId);

            if (
              this.#actionValidationService.isValid(
                actionDef,
                actorEntity,
                targetCtx
              )
            ) {
              const command = this.#formatActionCommandFn(
                actionDef,
                targetCtx,
                this.#entityManager,
                { logger: this.#logger, debug: true }
              );
              if (command !== null) {
                validActions.push({
                  id: actionDef.id,
                  name: actionDef.name || actionDef.commandVerb,
                  command,
                  description: actionDef.description || '',
                  params: { targetId },
                });
              }
            }
          }
        }
      } catch (err) {
        this.#logger.error(
          `Error processing action definition ${actionDef.id} for actor ${actorEntity.id}:`,
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
