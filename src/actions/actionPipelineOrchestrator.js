/**
 * @file Orchestrator for the action discovery pipeline
 * @see ./pipeline/Pipeline.js
 */

import { Pipeline } from './pipeline/Pipeline.js';
import { ComponentFilteringStage } from './pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from './pipeline/stages/PrerequisiteEvaluationStage.js';
import { TargetResolutionStage } from './pipeline/stages/TargetResolutionStage.js';
import { ActionFormattingStage } from './pipeline/stages/ActionFormattingStage.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('./actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('./validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */
/** @typedef {import('../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter */
/** @typedef {import('./errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class ActionPipelineOrchestrator
 * @description Orchestrates the entire action discovery pipeline
 */
export class ActionPipelineOrchestrator {
  #actionIndex;
  #prerequisiteService;
  #targetService;
  #formatter;
  #entityManager;
  #safeEventDispatcher;
  #getEntityDisplayNameFn;
  #errorBuilder;
  #logger;

  /**
   * Creates an ActionPipelineOrchestrator instance
   *
   * @param {object} deps - Dependencies
   * @param {ActionIndex} deps.actionIndex - The action index for candidate actions
   * @param {PrerequisiteEvaluationService} deps.prerequisiteService - Service for evaluating prerequisites
   * @param {ITargetResolutionService} deps.targetService - Service for resolving targets
   * @param {IActionCommandFormatter} deps.formatter - Formatter for action commands
   * @param {EntityManager} deps.entityManager - Entity manager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher
   * @param {Function} deps.getEntityDisplayNameFn - Function to get entity display names
   * @param {ActionErrorContextBuilder} deps.errorBuilder - Builder for error contexts
   * @param {ILogger} deps.logger - Logger for diagnostic output
   */
  constructor({
    actionIndex,
    prerequisiteService,
    targetService,
    formatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    errorBuilder,
    logger,
  }) {
    this.#actionIndex = actionIndex;
    this.#prerequisiteService = prerequisiteService;
    this.#targetService = targetService;
    this.#formatter = formatter;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#errorBuilder = errorBuilder;
    this.#logger = logger;
  }

  /**
   * Discovers actions for an actor
   *
   * @param {Entity} actor - The actor entity
   * @param {ActionContext} context - The action context
   * @param {object} [options] - Optional settings
   * @param {TraceContext} [options.trace] - Optional trace context
   * @returns {Promise<import('../interfaces/IActionDiscoveryService.js').DiscoveredActionsResult>} The discovered actions result
   */
  async discoverActions(actor, context, options = {}) {
    const { trace } = options;
    const pipeline = this.#createPipeline();

    const initialContext = {
      actor,
      actionContext: context,
      candidateActions: [],
      trace,
    };

    this.#logger.debug(
      `Starting action discovery pipeline for actor ${actor.id}`
    );

    const result = await pipeline.execute(initialContext);

    this.#logger.debug(
      `Action discovery pipeline completed for actor ${actor.id}. ` +
        `Found ${result.actions.length} actions, ${result.errors.length} errors.`
    );

    return {
      actions: result.actions,
      errors: result.errors,
      trace,
    };
  }

  /**
   * Creates the pipeline with all stages
   *
   * @returns {Pipeline} The configured pipeline
   * @private
   */
  #createPipeline() {
    const stages = [
      new ComponentFilteringStage(
        this.#actionIndex,
        this.#errorBuilder,
        this.#logger
      ),
      new PrerequisiteEvaluationStage(
        this.#prerequisiteService,
        this.#errorBuilder,
        this.#logger
      ),
      new TargetResolutionStage(
        this.#targetService,
        this.#errorBuilder,
        this.#logger
      ),
      new ActionFormattingStage({
        commandFormatter: this.#formatter,
        entityManager: this.#entityManager,
        safeEventDispatcher: this.#safeEventDispatcher,
        getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
        errorContextBuilder: this.#errorBuilder,
        logger: this.#logger,
      }),
    ];

    return new Pipeline(stages, this.#logger);
  }
}

export default ActionPipelineOrchestrator;
