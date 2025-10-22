/**
 * @file Stage for formatting resolved actions
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { LegacyFallbackFormatter } from './actionFormatting/legacy/LegacyFallbackFormatter.js';
import { TargetNormalizationService } from './actionFormatting/TargetNormalizationService.js';
import { ActionFormattingDecider } from './actionFormatting/ActionFormattingDecider.js';
import { PerActionMetadataStrategy } from './actionFormatting/strategies/PerActionMetadataStrategy.js';
import { GlobalMultiTargetStrategy } from './actionFormatting/strategies/GlobalMultiTargetStrategy.js';
import { FormattingAccumulator } from './actionFormatting/FormattingAccumulator.js';
import { ActionFormattingErrorFactory } from './actionFormatting/ActionFormattingErrorFactory.js';
import { TraceAwareInstrumentation } from './actionFormatting/TraceAwareInstrumentation.js';
import { NoopInstrumentation } from './actionFormatting/NoopInstrumentation.js';
import { ActionFormattingCoordinator } from './actionFormatting/ActionFormattingCoordinator.js';

/** @typedef {import('./actionFormatting/ActionFormattingInstrumentation.js').ActionFormattingInstrumentation} ActionFormattingInstrumentation */
/** @typedef {import('../../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class ActionFormattingStage
 * @augments PipelineStage
 * @description Formats actions with resolved targets into final discovered actions
 */
export class ActionFormattingStage extends PipelineStage {
  #commandFormatter;
  #entityManager;
  #safeEventDispatcher;
  #getEntityDisplayNameFn;
  #errorContextBuilder;
  #logger;
  #legacyFallbackFormatter;
  #targetNormalizationService;

  #errorFactory;

  #perActionMetadataStrategy;

  #globalMultiTargetStrategy;

  #decider;

  /**
   * Creates an ActionFormattingStage instance
   *
   * @param {object} deps - Dependencies
   * @param {IActionCommandFormatter} deps.commandFormatter - Formatter for action commands
   * @param {EntityManager} deps.entityManager - Entity manager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher
   * @param {Function} deps.getEntityDisplayNameFn - Function to get entity display names
   * @param {ActionErrorContextBuilder} deps.errorContextBuilder - Builder for error contexts
   * @param {ILogger} deps.logger - Logger for diagnostic output
   */
  constructor({
    commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    errorContextBuilder,
    logger,
  }) {
    super('ActionFormatting');
    /*
     * Constructor wiring overview (keep in sync with ActionFormattingCoordinator expectations):
     * - Injected services forwarded to the coordinator:
     *   commandFormatter, entityManager, safeEventDispatcher, getEntityDisplayNameFn,
     *   errorContextBuilder (via errorFactory), and logger.
     * - Stage-managed collaborators instantiated here:
     *   targetNormalizationService, legacyFallbackFormatter, perActionMetadataStrategy,
     *   globalMultiTargetStrategy, errorFactory, and decider.
     *
     * These collaborators either feed directly into ActionFormattingCoordinator or into the
     * strategies supplied to ActionFormattingDecider. Avoid introducing helper-flow state or
     * unrelated responsibilities here so the stage remains a thin wiring layer.
     */
    this.#commandFormatter = commandFormatter;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#errorContextBuilder = errorContextBuilder;
    this.#logger = logger;

    this.#targetNormalizationService = new TargetNormalizationService({
      logger: this.#logger,
    });

    this.#legacyFallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
    });

    this.#errorFactory = new ActionFormattingErrorFactory({
      errorContextBuilder: this.#errorContextBuilder,
    });

    this.#perActionMetadataStrategy = new PerActionMetadataStrategy({
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      safeEventDispatcher: this.#safeEventDispatcher,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
      logger: this.#logger,
      fallbackFormatter: this.#legacyFallbackFormatter,
      targetNormalizationService: this.#targetNormalizationService,
    });
    this.#perActionMetadataStrategy.priority = 300;

    this.#globalMultiTargetStrategy = new GlobalMultiTargetStrategy({
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      safeEventDispatcher: this.#safeEventDispatcher,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
      logger: this.#logger,
      fallbackFormatter: this.#legacyFallbackFormatter,
      targetNormalizationService: this.#targetNormalizationService,
    });
    this.#globalMultiTargetStrategy.priority = 200;

    this.#decider = new ActionFormattingDecider({
      strategies: [
        this.#perActionMetadataStrategy,
        this.#globalMultiTargetStrategy,
      ],
      errorFactory: this.#errorFactory,
    });
  }

  /**
   * Internal execution of the action formatting stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {Array<{actionDef: import('../../../interfaces/IGameDataRepository.js').ActionDefinition, targetContexts: import('../../../models/actionTargetContext.js').ActionTargetContext[]}>} context.actionsWithTargets - Actions with their targets
   * @param {Object<string, import('../../../interfaces/IActionCommandFormatter.js').ResolvedTarget[]>} [context.resolvedTargets] - Multi-target resolved data from MultiTargetResolutionStage
   * @param {object} [context.targetDefinitions] - Target definitions for multi-target actions
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace|import('../../tracing/actionAwareStructuredTrace.js').default} [context.trace] - Optional trace context
   * @returns {Promise<import('../PipelineResult.js').PipelineResult>} Formatted actions
   */
  async executeInternal(context) {
    const { trace } = context;
    const source = `${this.name}Stage.execute`;

    trace?.step(
      `Formatting ${context.actionsWithTargets?.length ?? 0} actions with their targets`,
      source
    );

    const hasActionAwareTrace =
      trace && typeof trace.captureActionData === 'function';
    const instrumentation = hasActionAwareTrace
      ? new TraceAwareInstrumentation(trace)
      : new NoopInstrumentation();

    const coordinator = new ActionFormattingCoordinator({
      context,
      instrumentation,
      decider: this.#decider,
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory: this.#errorFactory,
      fallbackFormatter: this.#legacyFallbackFormatter,
      targetNormalizationService: this.#targetNormalizationService,
      commandFormatter: this.#commandFormatter,
      entityManager: this.#entityManager,
      safeEventDispatcher: this.#safeEventDispatcher,
      getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
      logger: this.#logger,
      validateVisualProperties: (visual, actionId) =>
        this.#validateVisualProperties(visual, actionId),
    });

    return coordinator.run();
  }

  /**
   * Basic validation for actionDef.visual structure
   * Logs warnings for invalid visual properties but doesn't block processing
   *
   * @param {object} visual - Visual properties to validate
   * @param {string} actionId - Action ID for logging context
   * @returns {boolean} True if valid or correctable, false if severely malformed
   * @private
   */
  #validateVisualProperties(visual, actionId) {
    if (!visual) {
      return true; // null or undefined is acceptable
    }

    if (typeof visual !== 'object' || Array.isArray(visual)) {
      this.#logger.warn(
        `Invalid visual property structure for action '${actionId}': expected object, got ${typeof visual}. Visual properties will be passed through.`
      );
      return true; // Pass through for downstream validation
    }

    // Check for known visual properties and warn about unknowns
    const knownProperties = [
      'backgroundColor',
      'textColor',
      'hoverBackgroundColor',
      'hoverTextColor',
    ];
    const providedProperties = Object.keys(visual);
    const unknownProperties = providedProperties.filter(
      (prop) => !knownProperties.includes(prop)
    );

    if (unknownProperties.length > 0) {
      this.#logger.warn(
        `Unknown visual properties for action '${actionId}': ${unknownProperties.join(', ')}. These will be passed through but may not be used.`
      );
    }

    // Basic type validation for known properties
    for (const [prop, value] of Object.entries(visual)) {
      if (knownProperties.includes(prop) && typeof value !== 'string') {
        this.#logger.warn(
          `Visual property '${prop}' for action '${actionId}' should be a string, got ${typeof value}. Property will be passed through.`
        );
      }
    }

    return true;
  }
}

export default ActionFormattingStage;
