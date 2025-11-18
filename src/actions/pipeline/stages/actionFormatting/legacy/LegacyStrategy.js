/**
 * @file Legacy formatting strategy implementation
 */

import { PipelineResult } from '../../../PipelineResult.js';

/**
 * @param {object|undefined} stats
 * @param {string} key
 * @returns {void}
 * @description Safely increments the specified statistic counter when possible.
 */
const safeIncrementStat = (stats, key) => {
  if (!stats || typeof stats !== 'object') {
    return;
  }

  if (typeof stats[key] !== 'number') {
    stats[key] = 0;
  }

  stats[key] += 1;
};

/**
 * @param {object|undefined} trace
 * @returns {{
 *   captureStart: Function,
 *   captureEnd: Function,
 *   incrementStat: Function
 * }}
 * @description Builds a polymorphic adapter around the provided trace instance.
 */
export const createLegacyTraceAdapter = (trace) => {
  if (trace && typeof trace.captureActionData === 'function') {
    return {
      captureStart: (actionDef, targetContexts, isMultiTarget) => {
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: 'formatting',
          formattingPath: 'legacy',
          isMultiTargetInLegacy: isMultiTarget,
          targetContextCount: targetContexts.length,
        });
      },
      captureEnd: (actionDef, result, startTime) => {
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: result.failureCount > 0 ? 'partial' : 'completed',
          formatterMethod: 'format',
          successCount: result.successCount || 0,
          failureCount: result.failureCount || 0,
          performance: { duration: Date.now() - startTime },
        });
      },
      incrementStat: safeIncrementStat,
    };
  }

  // No-op adapter for standard trace
  return {
    captureStart: () => {},
    captureEnd: () => {},
    incrementStat: safeIncrementStat,
  };
};

/**
 * @typedef {import('../../../../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter
 */
/**
 * @typedef {import('../../../../../entities/entityManager.js').default} EntityManager
 */
/**
 * @typedef {import('../../../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */
/**
 * @typedef {import('../../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 */
/**
 * @typedef {import('../../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */

/**
 * @description Formats actions using the legacy path while preserving existing side effects.
 */
export class LegacyStrategy {
  #commandFormatter;
  #entityManager;
  #safeEventDispatcher;
  #getEntityDisplayNameFn;
  #logger;
  #fallbackFormatter;
  #createError;
  #targetNormalizationService;
  #validateVisualProperties;

  /**
   * @param {object} deps
   * @param {IActionCommandFormatter} deps.commandFormatter - Command formatter dependency
   * @param {EntityManager} deps.entityManager - Entity manager reference
   * @param {Function} deps.getEntityDisplayNameFn - Helper to resolve entity display names
   * @param {import('../../../../../logging/consoleLogger.js').default} deps.logger - Logger instance
   * @param {import('./LegacyFallbackFormatter.js').LegacyFallbackFormatter} deps.fallbackFormatter - Legacy fallback formatter
   * @param {Function} deps.createError - Factory to build structured errors
   * @param {import('../TargetNormalizationService.js').TargetNormalizationService} deps.targetNormalizationService - Target normalisation service
   * @param {Function} deps.validateVisualProperties - Visual validation helper
   * @param {ISafeEventDispatcher} [deps.safeEventDispatcher] - Optional dispatcher for formatter side effects
   * @description Creates a new legacy formatting strategy.
   */
  constructor({
    commandFormatter,
    entityManager,
    getEntityDisplayNameFn,
    logger,
    fallbackFormatter,
    createError,
    targetNormalizationService,
    validateVisualProperties,
    safeEventDispatcher = null,
  }) {
    this.#commandFormatter = commandFormatter;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
    this.#logger = logger;
    this.#fallbackFormatter = fallbackFormatter;
    this.#createError = createError;
    this.#targetNormalizationService = targetNormalizationService;
    this.#validateVisualProperties = validateVisualProperties;
  }

  /**
   * Formats actions with targets into formatted commands.
   * Automatically routes to unified formatting logic with appropriate trace handling.
   *
   * @public
   * @param {object} params
   * @param {import('../../../../../entities/entity.js').default} params.actor - Actor performing the actions
   * @param {Array<{actionDef: ActionDefinition, targetContexts: ActionTargetContext[]}>} params.actionsWithTargets - Actions and contexts
   * @param {import('../../../../tracing/actionAwareStructuredTrace.js').default|import('../../../../tracing/traceContext.js').TraceContext|import('../../../../tracing/structuredTrace.js').StructuredTrace|undefined} params.trace - Trace adapter
   * @param {object|undefined} params.processingStats - Mutable statistics accumulator from the stage
   * @param {string} params.traceSource - Source label for trace logging
   * @returns {Promise<{ formattedCommands: Array, errors: Array, fallbackUsed: boolean, statistics: { formatted: number, errors: number, fallbackInvocations: number }, pipelineResult: PipelineResult }>} Outcome information
   * @description Formats actions with or without tracing support.
   */
  async format({
    actor,
    actionsWithTargets = [],
    trace,
    processingStats,
    traceSource,
  }) {
    const formatterOptions = this.#buildFormatterOptions();

    return this.#formatActions({
      actor,
      actionsWithTargets,
      trace,
      formatterOptions,
      processingStats,
      traceSource,
    });
  }

  /**
   * @returns {object}
   * @description Generates formatter options for legacy execution.
   */
  #buildFormatterOptions() {
    return {
      logger: this.#logger,
      debug: true,
      safeEventDispatcher: this.#safeEventDispatcher,
    };
  }

  /**
   * Unified formatting method for all action formatting.
   * Handles both traced and standard formatting paths.
   *
   * @private
   * @param {object} params
   * @param {import('../../../../../entities/entity.js').default} params.actor - Actor performing the actions
   * @param {Array<{actionDef: ActionDefinition, targetContexts: ActionTargetContext[]}>} params.actionsWithTargets - Actions and contexts
   * @param {import('../../../../tracing/actionAwareStructuredTrace.js').default|import('../../../../tracing/traceContext.js').TraceContext|import('../../../../tracing/structuredTrace.js').StructuredTrace|undefined} params.trace - Trace adapter (optional)
   * @param {object} params.formatterOptions - Formatter options
   * @param {object|undefined} params.processingStats - Mutable statistics accumulator (optional)
   * @param {string} params.traceSource - Source label for trace logging
   * @returns {Promise<{ formattedCommands: Array, errors: Array, fallbackUsed: boolean, statistics: { formatted: number, errors: number, fallbackInvocations: number }, pipelineResult: PipelineResult }>}
   * @description Formats actions using trace adapter for polymorphic trace behavior.
   */
  async #formatActions({
    actor,
    actionsWithTargets,
    trace,
    formatterOptions,
    processingStats,
    traceSource,
  }) {
    const formattedActions = [];
    const errors = [];
    let fallbackInvocations = 0;

    // Create trace adapter for polymorphic behavior
    const traceAdapter = this.#createTraceAdapter(trace);

    for (const { actionDef, targetContexts } of actionsWithTargets) {
      const actionStartTime = Date.now();

      // Validate visual properties using injected dependency
      this.#validateVisualProperties(actionDef.visual, actionDef.id);

      const isMultiTargetAction =
        actionDef.targets && typeof actionDef.targets === 'object';

      // Capture start event (no-op for standard trace)
      traceAdapter.captureStart(actionDef, targetContexts, isMultiTargetAction);

      if (isMultiTargetAction) {
        const result = await this.#formatMultiTargetAction({
          actionDef,
          targetContexts,
          formatterOptions,
          actor,
          trace,
          processingStats,
        });

        formattedActions.push(...result.formatted);
        errors.push(...result.errors);
        fallbackInvocations += result.fallbackCount;

        // Capture end event (no-op for standard trace)
        traceAdapter.captureEnd(actionDef, result, actionStartTime);
      } else {
        const singleTargetResult = this.#formatSingleTargetAction({
          actionDef,
          targetContexts,
          formatterOptions,
          actor,
          trace,
          processingStats,
        });

        formattedActions.push(...singleTargetResult.formatted);
        errors.push(...singleTargetResult.errors);

        // Capture end event (no-op for standard trace)
        traceAdapter.captureEnd(actionDef, singleTargetResult, actionStartTime);
      }
    }

    this.#logger.debug(
      `Action formatting complete: ${formattedActions.length} actions formatted successfully`
    );

    trace?.info(
      `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
      traceSource
    );

    return {
      formattedCommands: formattedActions,
      errors,
      fallbackUsed: fallbackInvocations > 0,
      statistics: {
        formatted: formattedActions.length,
        errors: errors.length,
        fallbackInvocations,
      },
      pipelineResult: PipelineResult.success({
        actions: formattedActions,
        errors,
      }),
    };
  }

  /**
   * Creates a trace adapter for polymorphic behavior.
   *
   * @private
   * @param {object|undefined} trace - Trace context
   * @returns {object} Adapter with captureStart, captureEnd, and incrementStat methods
   * @description Returns action-aware adapter or no-op adapter based on trace capabilities.
   */
  #createTraceAdapter(trace) {
    return createLegacyTraceAdapter(trace);
  }

  /**
   * Formats a single target with error handling.
   *
   * @private
   * @param {object} params - Formatting parameters
   * @param {object} params.actionDef - Action definition
   * @param {object} params.targetContext - Target context
   * @param {object} params.formatterOptions - Formatter options
   * @param {object} params.actor - Actor entity
   * @param {object} params.trace - Trace object (optional)
   * @returns {object} Result with success flag and formatted data or error
   */
  #formatSingleTarget({
    actionDef,
    targetContext,
    formatterOptions,
    actor,
    trace = null,
  }) {
    try {
      const formatResult = this.#commandFormatter.format(
        actionDef,
        targetContext,
        this.#entityManager,
        formatterOptions,
        { displayNameFn: this.#getEntityDisplayNameFn }
      );

      if (formatResult.ok) {
        return {
          success: true,
          formatted: {
            id: actionDef.id,
            name: actionDef.name,
            command: formatResult.value,
            description: actionDef.description || '',
            params: { targetId: targetContext.entityId },
            visual: actionDef.visual || null,
          },
        };
      }

      // Format failure - log and use #createError directly
      this.#logger.warn(
        `Failed to format command for action '${actionDef.id}' with target '${targetContext.entityId}'`,
        { formatResult, actionDef, targetContext }
      );
      return {
        success: false,
        error: this.#createError(
          formatResult,
          actionDef,
          actor.id,
          trace,
          targetContext.entityId
        ),
      };
    } catch (error) {
      // Exception during formatting - log with target id fallback and create error
      const targetId =
        error?.target?.entityId ||
        error?.entityId ||
        targetContext.entityId;
      this.#logger.warn(
        `Failed to format command for action '${actionDef.id}' with target '${targetId}'`,
        { error, actionDef, targetContext }
      );

      return {
        success: false,
        error: this.#createError(
          error,
          actionDef,
          actor.id,
          trace,
          null,
          targetContext.entityId
        ),
      };
    }
  }

  /**
   * Formats a single-target action with error handling.
   * Handles iteration over target contexts, error collection, and statistics.
   *
   * @private
   * @param {object} params - Formatting parameters
   * @param {object} params.actionDef - Action definition
   * @param {Array} params.targetContexts - Target contexts to format
   * @param {object} params.formatterOptions - Formatter options
   * @param {object} params.actor - Actor entity
   * @param {object} params.trace - Trace object (optional, only in traced mode)
   * @param {object} params.processingStats - Statistics object (optional, only in traced mode)
   * @returns {object} Result with formatted actions, errors, counts, and timing
   */
  #formatSingleTargetAction({
    actionDef,
    targetContexts,
    formatterOptions,
    actor,
    trace = null,
    processingStats = null,
  }) {
    const formatted = [];
    const errors = [];
    let successCount = 0;
    let failureCount = 0;
    const startTime = Date.now();

    for (const targetContext of targetContexts) {
      const singleTargetParams = {
        actionDef,
        targetContext,
        formatterOptions,
        actor,
      };

      if (trace !== null) {
        singleTargetParams.trace = trace;
      }

      const result = this.#formatSingleTarget(singleTargetParams);

      if (result.success) {
        formatted.push(result.formatted);
        successCount++;
      } else {
        errors.push(result.error);
        failureCount++;
      }
    }

    // Statistics only tracked in traced mode
    if (processingStats) {
      if (successCount > 0) {
        this.#incrementStat(processingStats, 'successful');
        this.#incrementStat(processingStats, 'legacy');
      }
      if (failureCount > 0) {
        this.#incrementStat(processingStats, 'failed');
      }
    }

    return {
      formatted,
      errors,
      successCount,
      failureCount,
      startTime,
    };
  }

  /**
   * Formats a multi-target action with proper validation and error handling.
   * Handles both traced and standard formatting paths.
   *
   * @private
   * @param {object} params - Formatting parameters
   * @param {ActionDefinition} params.actionDef - Action definition
   * @param {ActionTargetContext[]} params.targetContexts - Target contexts
   * @param {object} params.formatterOptions - Formatter options
   * @param {object} params.actor - Actor entity
   * @param {object | null} params.trace - Trace object (null for standard path)
   * @param {object | null} params.processingStats - Statistics object (null for standard path)
   * @returns {Promise<object>} Result with formatted actions and errors
   */
  async #formatMultiTargetAction({
    actionDef,
    targetContexts,
    formatterOptions,
    actor,
    trace,
    processingStats,
  }) {
    // Extract targets from contexts
    const actionSpecificTargets = this.#extractTargetsFromContexts(
      targetContexts,
      actionDef
    );

    // Validate targets exist
    if (
      !actionSpecificTargets ||
      Object.keys(actionSpecificTargets).length === 0
    ) {
      this.#logger.warn(
        `Skipping multi-target action '${actionDef.id}' in legacy formatting path - ` +
          `no resolved targets available for proper formatting`
      );
      return { formatted: [], errors: [], fallbackCount: 0 };
    }

    // Attempt formatMultiTarget if available
    if (this.#commandFormatter.formatMultiTarget) {
      const result = await this.#formatWithMultiTargetFormatter({
        actionDef,
        actionSpecificTargets,
        formatterOptions,
        actor,
        trace,
        processingStats,
      });

      if (result.success) {
        return result;
      }
    }

    const formattedActions = [];
    const errors = [];

    const actualFallbackCount = this.#handleFallback({
      formattedActions,
      errors,
      processingStats,
      targetContexts,
      actionDef,
      formatterOptions,
      actionSpecificTargets,
      actorId: actor.id,
      trace,
      allowMissingTargetId:
        trace && typeof trace.captureActionData === 'function',
    });

    return {
      formatted: formattedActions,
      errors,
      fallbackCount: actualFallbackCount,
    };
  }

  /**
   * Processes command data from multi-target formatter.
   * Handles both string commands and object commands with optional targets.
   *
   * @private
   * @param {string|object} commandData - Command string or object with command/targets
   * @param {object} actionSpecificTargets - Default targets for the action
   * @returns {{ command: string, targets: object }}
   * @description Extracts command and determines which targets to use.
   */
  #processCommandData(commandData, actionSpecificTargets) {
    const command =
      typeof commandData === 'string' ? commandData : commandData.command;

    const specificTargets =
      typeof commandData === 'object' && commandData.targets
        ? commandData.targets
        : actionSpecificTargets;

    return { command, targets: specificTargets };
  }

  /**
   * Formats multi-target action using formatMultiTarget formatter.
   *
   * @private
   * @param {object} params - Formatting parameters
   * @param {ActionDefinition} params.actionDef - Action definition
   * @param {object} params.actionSpecificTargets - Extracted targets by placeholder
   * @param {object} params.formatterOptions - Formatter options
   * @param {object} params.actor - Actor entity
   * @param {object | null} params.trace - Trace object (null for standard path)
   * @param {object | null} params.processingStats - Statistics object (null for standard path)
   * @returns {Promise<object>} Result with success flag, formatted actions, and errors
   */
  async #formatWithMultiTargetFormatter({
    actionDef,
    actionSpecificTargets,
    formatterOptions,
    actor,
    trace,
    processingStats,
  }) {
    const formatResult = this.#commandFormatter.formatMultiTarget(
      actionDef,
      actionSpecificTargets,
      this.#entityManager,
      formatterOptions,
      {
        displayNameFn: this.#getEntityDisplayNameFn,
        targetDefinitions: actionDef.targets,
      }
    );

    if (!formatResult.ok) {
      return { success: false };
    }

    const commands = Array.isArray(formatResult.value)
      ? formatResult.value
      : [formatResult.value];

    const formatted = [];
    const errors = [];

    for (const commandData of commands) {
      const { command, targets: specificTargets } = this.#processCommandData(
        commandData,
        actionSpecificTargets
      );

      const normalizationResult = this.#targetNormalizationService.normalize({
        resolvedTargets: specificTargets,
        isMultiTarget: true,
      });

      if (normalizationResult.error) {
        errors.push(
          this.#createError(
            normalizationResult.error,
            actionDef,
            actor.id,
            trace
          )
        );
        continue;
      }

      const params = {
        ...normalizationResult.params,
        isMultiTarget: true,
      };

      formatted.push({
        id: actionDef.id,
        name: actionDef.name,
        command,
        description: actionDef.description || '',
        params,
        visual: actionDef.visual || null,
      });
    }

    // Track statistics only in traced mode (when processingStats is provided)
    if (processingStats) {
      this.#incrementStat(processingStats, 'successful');
      this.#incrementStat(processingStats, 'multiTarget');
    }

    return { success: true, formatted, errors, fallbackCount: 0 };
  }

  /**
   * @param {object} params
   * @param {Array} params.formattedActions
   * @param {Array} params.errors
   * @param {object|undefined} params.processingStats
   * @param {ActionTargetContext[]} params.targetContexts
   * @param {ActionDefinition} params.actionDef
   * @param {object} params.formatterOptions
   * @param {Record<string, Array>} params.actionSpecificTargets
   * @param {string} params.actorId
   * @param {object|undefined} params.trace
   * @param {boolean} params.allowMissingTargetId
   * @returns {number}
   * @description Applies fallback formatting logic and returns invocation count.
   */
  #handleFallback({
    formattedActions,
    errors,
    processingStats,
    targetContexts,
    actionDef,
    formatterOptions,
    actionSpecificTargets,
    actorId,
    trace,
    allowMissingTargetId,
  }) {
    const fallbackResult = this.#fallbackFormatter.formatWithFallback({
      actionDefinition: actionDef,
      targetContext: targetContexts[0],
      formatterOptions,
      targetDefinitions: actionDef.targets,
      resolvedTargets: actionSpecificTargets,
    });

    if (fallbackResult.ok) {
      const targetId = targetContexts[0]?.entityId;
      const params =
        allowMissingTargetId && !targetId ? {} : { targetId };

      formattedActions.push({
        id: actionDef.id,
        name: actionDef.name,
        command: fallbackResult.value,
        description: actionDef.description || '',
        params,
        visual: actionDef.visual || null,
      });
      this.#incrementStat(processingStats, 'successful');
      this.#incrementStat(processingStats, 'legacy');
      return 1;
    }

    this.#incrementStat(processingStats, 'failed');
    const resolvedTargetId = allowMissingTargetId
      ? targetContexts[0]?.entityId || null
      : targetContexts[0]?.entityId;

    errors.push(
      this.#createError(
        fallbackResult,
        actionDef,
        actorId,
        trace,
        resolvedTargetId
      )
    );

    return 0;
  }

  /**
   * @param {Array<ActionTargetContext>} targetContexts
   * @param {ActionDefinition} actionDef
   * @returns {Record<string, Array>}
   * @description Builds placeholder keyed resolved targets from contexts.
   */
  #extractTargetsFromContexts(targetContexts, actionDef) {
    if (!targetContexts || targetContexts.length === 0) {
      return {};
    }

    const targetsByPlaceholder = {};

    for (const targetContext of targetContexts) {
      const placeholder = targetContext.placeholder || 'primary';

      if (!targetsByPlaceholder[placeholder]) {
        targetsByPlaceholder[placeholder] = [];
      }

      targetsByPlaceholder[placeholder].push({
        id: targetContext.entityId,
        displayName: targetContext.displayName || targetContext.entityId,
        entity: targetContext.entityId
          ? this.#entityManager.getEntityInstance(targetContext.entityId)
          : null,
        contextFromId: targetContext.contextFromId,
      });
    }

    const expectedTargets = Object.keys(actionDef.targets);

    for (const targetKey of expectedTargets) {
      const targetDef = actionDef.targets[targetKey];
      const placeholder = targetDef.placeholder || targetKey;

      if (
        !targetsByPlaceholder[placeholder] ||
        targetsByPlaceholder[placeholder].length === 0
      ) {
        this.#logger.debug(
          `Missing required target '${targetKey}' for action '${actionDef.id}'`
        );
        return {};
      }
    }

    return targetsByPlaceholder;
  }

  /**
   * @param {object|undefined} stats
   * @param {string} key
   * @description Safely increments statistic counters when provided.
   */
  #incrementStat(stats, key) {
    safeIncrementStat(stats, key);
  }
}

export default LegacyStrategy;
