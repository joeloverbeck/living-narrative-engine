/**
 * @file Orchestrator for the action discovery pipeline
 * @see ./pipeline/Pipeline.js
 */

import { Pipeline } from './pipeline/Pipeline.js';
import { ComponentFilteringStage } from './pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from './pipeline/stages/PrerequisiteEvaluationStage.js';
import { TargetComponentValidationStage } from './pipeline/stages/TargetComponentValidationStage.js';
import { ActionFormattingStage } from './pipeline/stages/ActionFormattingStage.js';
import TargetCandidatePruner from './pipeline/services/implementations/TargetCandidatePruner.js';
import TargetValidationConfigProvider from './pipeline/stages/TargetValidationConfigProvider.js';
import TargetValidationReporter from './pipeline/stages/TargetValidationReporter.js';
import ContextUpdateEmitter from './pipeline/services/implementations/ContextUpdateEmitter.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('./actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('./validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */
/** @typedef {import('../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('./scopes/unifiedScopeResolver.js').UnifiedScopeResolver} UnifiedScopeResolver */
/** @typedef {import('../scopeDsl/utils/targetContextBuilder.js').default} TargetContextBuilder */
/** @typedef {import('../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter */
/** @typedef {import('./errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./pipeline/stages/MultiTargetResolutionStage.js').MultiTargetResolutionStage} MultiTargetResolutionStage */
/** @typedef {import('./validation/TargetComponentValidator.js').TargetComponentValidator} TargetComponentValidator */
/** @typedef {import('./validation/TargetRequiredComponentsValidator.js').default} TargetRequiredComponentsValidator */
/** @typedef {import('../combat/services/ChanceCalculationService.js').default} ChanceCalculationService */

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
  #unifiedScopeResolver;
  #targetContextBuilder;
  #multiTargetResolutionStage;
  #targetComponentValidator;
  #targetRequiredComponentsValidator;
  #targetCandidatePruner;
  #targetValidationConfigProvider;
  #targetValidationReporter;
  #contextUpdateEmitter;
  /** @type {ChanceCalculationService|null} */
  #chanceCalculationService;

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
   * @param {UnifiedScopeResolver} deps.unifiedScopeResolver - Unified scope resolver
   * @param {TargetContextBuilder} deps.targetContextBuilder - Target context builder
   * @param {MultiTargetResolutionStage} deps.multiTargetResolutionStage - Multi-target resolution stage
   * @param {TargetComponentValidator} deps.targetComponentValidator - Target component validator
   * @param {TargetRequiredComponentsValidator} deps.targetRequiredComponentsValidator - Target required components validator
   * @param {TargetCandidatePruner} [deps.targetCandidatePruner] - Optional pruner for multi-target candidate resolution
   * @param {TargetValidationConfigProvider} [deps.targetValidationConfigProvider] - Optional configuration snapshot provider
   * @param {TargetValidationReporter} [deps.targetValidationReporter] - Optional reporter for trace and telemetry output
   * @param {ContextUpdateEmitter} [deps.contextUpdateEmitter] - Optional emitter for applying validation results to context
   * @param {ChanceCalculationService} [deps.chanceCalculationService] - Optional chance calculation service for chance-based actions
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
    unifiedScopeResolver,
    targetContextBuilder,
    multiTargetResolutionStage,
    targetComponentValidator,
    targetRequiredComponentsValidator,
    targetCandidatePruner = null,
    targetValidationConfigProvider = null,
    targetValidationReporter = null,
    contextUpdateEmitter = null,
    chanceCalculationService = null,
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
    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#targetContextBuilder = targetContextBuilder;
    this.#multiTargetResolutionStage = multiTargetResolutionStage;
    this.#targetComponentValidator = targetComponentValidator;
    this.#targetRequiredComponentsValidator = targetRequiredComponentsValidator;
    this.#targetCandidatePruner =
      targetCandidatePruner ?? new TargetCandidatePruner({ logger });
    this.#targetValidationConfigProvider =
      targetValidationConfigProvider ?? new TargetValidationConfigProvider();
    this.#targetValidationReporter =
      targetValidationReporter ?? new TargetValidationReporter({ logger });
    this.#contextUpdateEmitter =
      contextUpdateEmitter ?? new ContextUpdateEmitter();
    this.#chanceCalculationService = chanceCalculationService;
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
        this.#logger,
        this.#entityManager
      ),
      new PrerequisiteEvaluationStage(
        this.#prerequisiteService,
        this.#errorBuilder,
        this.#logger
      ),
      this.#multiTargetResolutionStage,
      new TargetComponentValidationStage({
        targetComponentValidator: this.#targetComponentValidator,
        targetRequiredComponentsValidator:
          this.#targetRequiredComponentsValidator,
        logger: this.#logger,
        actionErrorContextBuilder: this.#errorBuilder,
        targetCandidatePruner: this.#targetCandidatePruner,
        configProvider: this.#targetValidationConfigProvider,
        validationReporter: this.#targetValidationReporter,
        contextUpdateEmitter: this.#contextUpdateEmitter,
      }),
      new ActionFormattingStage({
        commandFormatter: this.#formatter,
        entityManager: this.#entityManager,
        safeEventDispatcher: this.#safeEventDispatcher,
        getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
        errorContextBuilder: this.#errorBuilder,
        logger: this.#logger,
        chanceCalculationService: this.#chanceCalculationService,
      }),
    ];

    return new Pipeline(stages, this.#logger);
  }
}

export default ActionPipelineOrchestrator;
