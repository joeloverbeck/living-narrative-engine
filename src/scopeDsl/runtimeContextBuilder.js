/**
 * @file RuntimeContextBuilder
 * @description Builds runtime contexts for Scope-DSL evaluation.
 */

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../entities/entity.js').default} Entity */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * @typedef {object} RuntimeContextBuilderDeps
 * @property {IEntityManager} entityManager
 * @property {JsonLogicEvaluationService} jsonLogicEvaluationService
 * @property {ILogger} logger
 */

/**
 * Utility class that constructs runtime context objects for the Scope-DSL engine.
 *
 * @class RuntimeContextBuilder
 */
class RuntimeContextBuilder {
  #entityManager;
  #jsonLogicEvalService;
  #logger;

  /**
   * @param {RuntimeContextBuilderDeps} deps
   */
  constructor({ entityManager, jsonLogicEvaluationService, logger }) {
    validateDependency(entityManager, 'entityManager', logger);
    validateDependency(
      jsonLogicEvaluationService,
      'jsonLogicEvaluationService',
      logger,
      {
        requiredMethods: ['evaluate'],
      }
    );
    validateDependency(logger, 'logger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#entityManager = entityManager;
    this.#jsonLogicEvalService = jsonLogicEvaluationService;
    this.#logger = logger;
  }

  /**
   * Builds the runtime context passed to the scope engine.
   *
   * @param {Entity} actorEntity - The acting entity.
   * @param {ActionContext} discoveryContext - Context for scope resolution.
   * @returns {object} Runtime context for Scope-DSL evaluation.
   */
  build(actorEntity, discoveryContext) {
    return {
      entityManager: this.#entityManager,
      jsonLogicEval: this.#jsonLogicEvalService,
      logger: this.#logger,
      actor: actorEntity,
      location: discoveryContext.currentLocation,
    };
  }
}

export default RuntimeContextBuilder;
