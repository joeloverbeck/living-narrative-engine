/**
 * @file ActionAwareStructuredTrace - Extends StructuredTrace with action-specific capabilities
 * @see structuredTrace.js
 * @see actionTraceFilter.js
 */

import { StructuredTrace } from './structuredTrace.js';
import ActionTraceFilter from './actionTraceFilter.js';
import { string } from '../../utils/validationCore.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * @typedef {import('./actionTraceFilter.js').default} ActionTraceFilter
 */

/**
 * @typedef {object} ActionTraceData
 * @property {string} actionId - Unique identifier for the action
 * @property {string} actorId - ID of the actor performing the action
 * @property {number} startTime - Timestamp when action tracing began
 * @property {Object<string, StageTraceData>} stages - Data captured at each pipeline stage
 * @property {object} context - Additional trace context
 */

/**
 * @typedef {object} StageTraceData
 * @property {number} timestamp - When this stage was captured
 * @property {object} data - Stage-specific data (filtered by verbosity)
 * @property {number} stageCompletedAt - When this stage completed processing
 */

/**
 * @typedef {object} TracingSummary
 * @property {number} tracedActionCount - Number of actions being traced
 * @property {number} totalStagesTracked - Total number of stages across all actions
 * @property {number} sessionDuration - Duration of tracing session in milliseconds
 * @property {number} averageStagesPerAction - Average stages per action
 */

/**
 * Extends StructuredTrace with action-specific data capture capabilities
 *
 * @class ActionAwareStructuredTrace
 * @augments StructuredTrace
 */
class ActionAwareStructuredTrace extends StructuredTrace {
  #actionTraceFilter;
  #tracedActionData;
  #actorId;
  #context;
  #logger;
  #seenObjects;

  /**
   * @param {object} dependencies
   * @param {ActionTraceFilter} dependencies.actionTraceFilter - Filter for action tracing
   * @param {string} dependencies.actorId - ID of the actor being traced
   * @param {object} [dependencies.context] - Additional trace context
   * @param {object} [dependencies.logger] - Logger instance
   * @param {import('./traceContext.js').TraceContext} [dependencies.traceContext] - Optional existing TraceContext
   * @param {import('../../configuration/traceConfigLoader.js').TraceConfigurationFile} [dependencies.traceConfig] - Optional trace configuration
   * @param {import('./performanceMonitor.js').PerformanceMonitor} [dependencies.performanceMonitor] - Optional performance monitor
   */
  constructor({
    actionTraceFilter,
    actorId,
    context = {},
    logger = null,
    traceContext = null,
    traceConfig = null,
    performanceMonitor = null,
  }) {
    super(traceContext, traceConfig);

    if (!actionTraceFilter) {
      throw new InvalidArgumentError('ActionTraceFilter is required');
    }

    string.assertNonBlank(
      actorId,
      'actorId',
      'ActionAwareStructuredTrace constructor'
    );
    this.#logger = ensureValidLogger(logger, 'ActionAwareStructuredTrace');

    this.#actionTraceFilter = actionTraceFilter;
    this.#tracedActionData = new Map();
    this.#actorId = actorId;
    this.#context = context;

    // Optional performance monitor integration for ACTTRA-018
    // If trace config enables performance tracking, use the provided monitor
    if (traceConfig?.enablePerformanceTracking && performanceMonitor) {
      this.performanceMonitor = performanceMonitor;
      this.#logger.debug(
        'Performance tracking enabled for ActionAwareStructuredTrace'
      );
    }

    this.#logger.debug('ActionAwareStructuredTrace initialized', {
      actorId: this.#actorId,
      contextKeys: Object.keys(this.#context),
      filterEnabled: this.#actionTraceFilter.isEnabled(),
      performanceTracking: !!this.performanceMonitor,
    });
  }

  /**
   * Capture action-specific data during pipeline processing
   *
   * @param {string} stage - Pipeline stage name (e.g., 'component_filtering', 'prerequisite_evaluation')
   * @param {string} actionId - Action ID being processed (e.g., 'movement:go')
   * @param {object} data - Stage-specific data to capture
   * @returns {void}
   * @example
   * trace.captureActionData('component_filtering', 'movement:go', {
   *   actorComponents: ['core:position', 'core:movement'],
   *   requiredComponents: ['core:position'],
   *   passed: true
   * });
   */
  captureActionData(stage, actionId, data) {
    try {
      // Fast return if this action shouldn't be traced
      if (!this.#actionTraceFilter.shouldTrace(actionId)) {
        return;
      }

      string.assertNonBlank(stage, 'stage', 'captureActionData');
      string.assertNonBlank(actionId, 'actionId', 'captureActionData');
      if (!data) {
        throw new InvalidArgumentError('Data is required for action capture');
      }

      // Initialize action trace data if first time seeing this action
      if (!this.#tracedActionData.has(actionId)) {
        this.#tracedActionData.set(actionId, {
          actionId,
          actorId: this.#actorId,
          startTime: Date.now(),
          stages: {},
          context: this.#context,
        });
      }

      const actionTrace = this.#tracedActionData.get(actionId);
      const filteredData = this.#filterDataByVerbosity(data, stage);

      // Add performance timing if not already present (ACTTRA-018)
      const captureTime = performance.now();
      const enhancedData = {
        ...filteredData,
        _performance: {
          captureTime: captureTime,
          stage: stage,
          actionId: actionId,
          timestamp: Date.now(),
        },
      };

      actionTrace.stages[stage] = {
        timestamp: Date.now(),
        data: enhancedData,
        stageCompletedAt: Date.now(),
      };

      // If performance monitor is available, track the operation
      if (this.performanceMonitor) {
        try {
          this.performanceMonitor.trackOperation?.(
            `stage_${stage}`,
            captureTime
          );
        } catch (monitorError) {
          // Don't let monitor errors break tracing
          this.#logger.debug(
            `Performance monitor tracking failed for stage '${stage}': ${monitorError.message}`
          );
        }
      }

      // Log trace capture for debugging
      this.#logger.debug(
        `ActionAwareStructuredTrace: Captured data for action '${actionId}' at stage '${stage}'`,
        {
          actionId,
          stage,
          dataKeys: Object.keys(enhancedData),
          verbosity: this.#actionTraceFilter.getVerbosityLevel(),
          hasPerformanceData: true,
        }
      );
    } catch (error) {
      // Don't throw - tracing failures shouldn't break the pipeline
      this.#logger.error(
        `ActionAwareStructuredTrace: Error capturing action data for '${actionId}' at stage '${stage}'`,
        error
      );
    }
  }

  /**
   * Get complete trace data for all traced actions
   *
   * @returns {Map<string, ActionTraceData>} Map of actionId to trace data
   * @example
   * const tracedActions = trace.getTracedActions();
   * for (const [actionId, traceData] of tracedActions) {
   *   console.log(`Action ${actionId} processed in ${Object.keys(traceData.stages).length} stages`);
   * }
   */
  getTracedActions() {
    return new Map(this.#tracedActionData);
  }

  /**
   * Get trace data for a specific action
   *
   * @param {string} actionId - Action ID to get trace data for
   * @returns {ActionTraceData|null} Trace data for the action, or null if not found
   */
  getActionTrace(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'getActionTrace');
    return this.#tracedActionData.get(actionId) || null;
  }

  /**
   * Check if an action is being traced
   *
   * @param {string} actionId - Action ID to check
   * @returns {boolean} True if action is being traced
   */
  isActionTraced(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'isActionTraced');
    return this.#tracedActionData.has(actionId);
  }

  /**
   * Get summary statistics for traced actions
   *
   * @returns {TracingSummary} Summary statistics
   */
  getTracingSummary() {
    const tracedCount = this.#tracedActionData.size;
    let totalStages = 0;
    let oldestStart = Date.now();
    let newestStart = 0;

    for (const [, actionData] of this.#tracedActionData) {
      totalStages += Object.keys(actionData.stages).length;
      oldestStart = Math.min(oldestStart, actionData.startTime);
      newestStart = Math.max(newestStart, actionData.startTime);
    }

    return {
      tracedActionCount: tracedCount,
      totalStagesTracked: totalStages,
      sessionDuration: tracedCount > 0 ? newestStart - oldestStart : 0,
      averageStagesPerAction: tracedCount > 0 ? totalStages / tracedCount : 0,
    };
  }

  /**
   * Calculate stage performance from captured data (ACTTRA-018)
   * Analyzes timing data between stages to calculate inter-stage durations
   *
   * @param {string} actionId - Action ID to calculate performance for
   * @returns {object|null} Stage performance data with timings, or null if not found
   * @example
   * const perf = trace.calculateStagePerformance('movement:go');
   * // Returns: {
   * //   component_filtering: { startTime: 100, endTime: 100, duration: 0 },
   * //   prerequisite_evaluation: { startTime: 100, endTime: 200, duration: 100 }
   * // }
   */
  calculateStagePerformance(actionId) {
    const actionTrace = this.#tracedActionData.get(actionId);
    if (!actionTrace) {
      return null;
    }

    const stageTimings = {};
    let previousTime = null;

    // Get all stages and sort them by timestamp
    const stages = Object.entries(actionTrace.stages).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    // Calculate inter-stage durations (duration since previous stage)
    for (const [stageName, stageData] of stages) {
      if (stageData.data?._performance?.captureTime !== undefined) {
        const stageTime = stageData.data._performance.captureTime;

        if (previousTime === null) {
          // First stage - has no previous stage
          stageTimings[stageName] = {
            startTime: stageTime,
            endTime: stageTime,
            duration: 0, // First stage has no duration from previous
            timestamp: stageData.data._performance.timestamp,
          };
        } else {
          // Subsequent stages - calculate duration from previous stage
          const duration = stageTime - previousTime;
          stageTimings[stageName] = {
            startTime: previousTime,
            endTime: stageTime,
            duration: duration,
            timestamp: stageData.data._performance.timestamp,
          };
        }

        previousTime = stageTime;
      }
    }

    return stageTimings;
  }

  /**
   * Get the action trace filter instance
   *
   * @returns {ActionTraceFilter} The action trace filter
   */
  getActionTraceFilter() {
    return this.#actionTraceFilter;
  }

  /**
   * Get the actor ID for this trace
   *
   * @returns {string} Actor ID
   */
  getActorId() {
    return this.#actorId;
  }

  /**
   * Getter for actorId to maintain compatibility with ActionExecutionTrace
   * Used by FileTraceOutputHandler for filename generation
   *
   * @returns {string} The actor ID
   */
  get actorId() {
    return this.#actorId;
  }

  /**
   * Getter for actionId to maintain compatibility with ActionExecutionTrace
   * For discovery traces, returns 'discovery' or the first traced action
   * Used by FileTraceOutputHandler for filename generation
   *
   * @returns {string} An action ID or 'discovery' for multi-action traces
   */
  get actionId() {
    // For action discovery traces, we don't have a single actionId
    // Return 'discovery' as a sensible default, or the first traced action if available
    if (this.#tracedActionData.size > 0) {
      const firstActionId = Array.from(this.#tracedActionData.keys())[0];
      // If we have exactly one action, use its ID
      // Otherwise, use 'discovery' to indicate this is a multi-action trace
      return this.#tracedActionData.size === 1 ? firstActionId : 'discovery';
    }
    return 'discovery';
  }

  /**
   * Capture operator evaluation data from JSON Logic operators
   *
   * @param {object} operatorData - Data from the operator evaluation
   * @param {string} operatorData.operator - Name of the operator (e.g., 'isSocketCovered')
   * @param {string} operatorData.entityId - Entity being evaluated
   * @param {*} operatorData.result - Result of the evaluation
   * @param {string} [operatorData.reason] - Reason for the result
   * @param {object} [operatorData.details] - Additional evaluation details
   * @returns {void}
   */
  captureOperatorEvaluation(operatorData) {
    try {
      // Store operator evaluations in a special stage
      const stage = 'operator_evaluations';
      const timestamp = Date.now();

      // Get or create operator evaluations array for current action context
      // We need to associate this with the current action being evaluated
      // Since we might be in scope evaluation, we'll use a special key
      const contextKey = '_current_scope_evaluation';

      if (!this.#tracedActionData.has(contextKey)) {
        this.#tracedActionData.set(contextKey, {
          actionId: contextKey,
          actorId: this.#actorId,
          startTime: timestamp,
          stages: {},
          context: { ...this.#context, type: 'operator_evaluations' },
        });
      }

      const trace = this.#tracedActionData.get(contextKey);

      // Initialize operator evaluations array if needed
      if (!trace.stages[stage]) {
        trace.stages[stage] = {
          timestamp,
          data: {
            evaluations: [],
            _performance: {
              captureTime: performance.now(),
              stage,
              timestamp,
            },
          },
          stageCompletedAt: timestamp,
        };
      }

      // Add this evaluation to the array
      trace.stages[stage].data.evaluations.push({
        ...operatorData,
        timestamp,
        captureTime: performance.now(),
      });

      this.#logger.debug(
        `ActionAwareStructuredTrace: Captured operator evaluation for '${operatorData.operator}'`,
        {
          operator: operatorData.operator,
          entityId: operatorData.entityId,
          result: operatorData.result,
          hasDetails: !!operatorData.details,
        }
      );
    } catch (error) {
      // Don't throw - tracing failures shouldn't break operator execution
      this.#logger.error(
        'ActionAwareStructuredTrace: Error capturing operator evaluation',
        error
      );
    }
  }

  /**
   * Clear all traced action data
   *
   * @returns {void}
   */
  clearActionData() {
    const previousSize = this.#tracedActionData.size;
    this.#tracedActionData.clear();
    this.#logger.debug(
      `ActionAwareStructuredTrace: Cleared ${previousSize} traced actions`
    );
  }

  /**
   * Capture detailed legacy conversion data from LegacyTargetCompatibilityLayer
   *
   * @param {string} actionId - Action being processed
   * @param {object} conversionData - Data from legacy compatibility layer
   */
  captureLegacyConversion(actionId, conversionData) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    this.captureActionData('legacy_processing', actionId, {
      isLegacy: conversionData.isLegacy,
      originalFormat: this.#analyzeLegacyFormat(conversionData.originalAction),
      conversionResult: conversionData.targetDefinitions,
      conversionTime: conversionData.processingTime,
      success: !conversionData.error,
      error: conversionData.error,
      migrationSuggestion: conversionData.migrationSuggestion,
      timestamp: Date.now(),
    });
  }

  /**
   * Capture legacy action detection and format analysis
   *
   * @param {string} actionId - Action ID
   * @param {object} detectionData - Legacy detection results
   */
  captureLegacyDetection(actionId, detectionData) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    this.captureActionData('legacy_detection', actionId, {
      hasStringTargets: detectionData.hasStringTargets,
      hasScopeOnly: detectionData.hasScopeOnly,
      hasLegacyFields: detectionData.hasLegacyFields,
      legacyFormat: detectionData.detectedFormat,
      requiresConversion: detectionData.requiresConversion,
      timestamp: Date.now(),
    });
  }

  /**
   * Get summary of legacy action processing for this trace session
   *
   * @returns {object} Legacy processing summary
   */
  getLegacyProcessingSummary() {
    const summary = {
      totalLegacyActions: 0,
      conversionsByFormat: {},
      successfulConversions: 0,
      failedConversions: 0,
      averageConversionTime: 0,
      totalConversionTime: 0,
    };

    for (const [actionId, traceData] of this.#tracedActionData) {
      const legacyData = traceData.stages.legacy_processing;
      if (legacyData && legacyData.data.isLegacy) {
        summary.totalLegacyActions++;

        const format = legacyData.data.originalFormat;
        summary.conversionsByFormat[format] =
          (summary.conversionsByFormat[format] || 0) + 1;

        if (legacyData.data.success) {
          summary.successfulConversions++;
        } else {
          summary.failedConversions++;
        }

        if (legacyData.data.conversionTime) {
          summary.totalConversionTime += legacyData.data.conversionTime;
        }
      }
    }

    summary.averageConversionTime =
      summary.totalLegacyActions > 0
        ? summary.totalConversionTime / summary.totalLegacyActions
        : 0;

    return summary;
  }

  /**
   * Analyze legacy action format for tracing purposes
   *
   * @private
   * @param {object} action - Action definition to analyze
   * @returns {string} Detected legacy format type
   */
  #analyzeLegacyFormat(action) {
    if (!action) {
      return 'unknown';
    }

    if (typeof action.targets === 'string') {
      return 'string_targets';
    }
    if (action.scope && !action.targets) {
      return 'scope_property';
    }
    if (action.targetType || action.targetCount) {
      return 'legacy_target_type';
    }
    return 'unknown';
  }

  /**
   * Check if an action uses multi-target resolution
   *
   * @param {object} action - Action definition
   * @returns {boolean}
   */
  isMultiTargetAction(action) {
    // Check for modern multi-target format
    if (
      action.targets &&
      typeof action.targets === 'object' &&
      !Array.isArray(action.targets)
    ) {
      return true;
    }

    // Check for scope-based targeting (can resolve to multiple)
    if (action.scope || action.targetScope) {
      return true;
    }

    // Check for dynamic targets
    if (action.targetQuery || action.dynamicTargets) {
      return true;
    }

    // Legacy single target or no targets
    return false;
  }

  /**
   * Capture multi-target resolution data
   *
   * @param {string} actionId - Action ID
   * @param {object} resolutionData - Resolution data from MultiTargetResolutionStage
   */
  captureMultiTargetResolution(actionId, resolutionData) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    const traceData = {
      stage: 'multi_target_resolution',
      targetKeys: resolutionData.targetKeys || [],
      resolvedCounts: resolutionData.resolvedCounts || {},
      totalTargets: resolutionData.totalTargets || 0,
      resolutionOrder: resolutionData.resolutionOrder || [],
      hasContextDependencies: resolutionData.hasContextDependencies || false,
      resolutionTimeMs: resolutionData.resolutionTimeMs || 0,
      timestamp: Date.now(),
    };

    this.captureActionData('multi_target_resolution', actionId, traceData);
  }

  /**
   * Capture scope evaluation details
   *
   * @param {string} actionId - Action ID
   * @param {string} targetKey - Target placeholder key
   * @param {object} evaluationData - Scope evaluation data
   * @param {object} [enhancedData] - Enhanced evaluation details from resolvers
   */
  captureScopeEvaluation(
    actionId,
    targetKey,
    evaluationData,
    enhancedData = null
  ) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    const traceData = {
      stage: 'scope_evaluation',
      targetKey,
      scope: evaluationData.scope,
      context: evaluationData.context,
      resultCount: evaluationData.resultCount || 0,
      evaluationTimeMs: evaluationData.evaluationTimeMs || 0,
      cacheHit: evaluationData.cacheHit || false,
      error: evaluationData.error,
      // Optional richer context to debug scope inputs/outputs
      resolvedIds: evaluationData.resolvedIds || [],
      contextDetails: evaluationData.contextDetails || null,
      timestamp: Date.now(),
    };

    // Include enhanced data if provided from resolvers
    if (enhancedData) {
      traceData.entityDiscovery = enhancedData.entityDiscovery || null;
      traceData.filterEvaluations = enhancedData.filterEvaluations || null;
      traceData.resolverDetails = enhancedData.resolverDetails || null;
    }

    this.captureActionData('scope_evaluation', actionId, traceData);
  }

  /**
   * Capture enhanced scope evaluation data from trace logs
   * This method collects the detailed entity discovery and filter evaluation data
   * that's generated by the enhanced sourceResolver and filterResolver
   *
   * @param {string} actionId - Action ID being processed
   * @param {string} scope - Scope name being evaluated
   * @param {Array} traceLogs - Array of trace logs from the scope resolution
   */
  captureEnhancedScopeEvaluation(actionId, scope, traceLogs) {
    if (!this.#actionTraceFilter.shouldTrace(actionId) || !traceLogs) {
      return;
    }

    // Extract entity discovery data from trace logs
    const entityDiscoveryLogs = traceLogs.filter(
      (log) => log.source === 'ScopeEngine.entityDiscovery'
    );

    // Extract filter evaluation data from trace logs
    const filterEvaluationLogs = traceLogs.filter(
      (log) => log.source === 'ScopeEngine.filterEvaluation'
    );

    const enhancedData = {
      scope,
      timestamp: Date.now(),
      entityDiscovery: entityDiscoveryLogs.map((log) => ({
        componentId: log.data?.componentId,
        totalEntities: log.data?.totalEntities,
        foundEntities: log.data?.foundEntities,
        entityDetails: log.data?.entityDetails,
        resultIds: log.data?.resultIds,
      })),
      filterEvaluations: filterEvaluationLogs.map((log) => ({
        itemId: log.data?.itemId,
        filterPassed: log.data?.filterPassed,
        evaluationResult: log.data?.evaluationResult,
        entityDetails: {
          hasPositionComponent: log.data?.hasPositionComponent,
          hasAllowsSittingComponent: log.data?.hasAllowsSittingComponent,
          actorLocationId: log.data?.actorLocationId,
          entityLocationId: log.data?.entityLocationId,
          allowsSittingSpots: log.data?.allowsSittingSpots,
        },
        locationMismatch: log.data?.locationMismatch,
        spotAvailability: log.data?.spotAvailability,
        filterAnalysis: log.data?.filterAnalysis,
      })),
    };

    // Store in a special enhanced scope evaluation stage
    this.captureActionData('enhanced_scope_evaluation', actionId, enhancedData);
  }

  /**
   * Capture target relationship analysis
   *
   * @param {string} actionId - Action ID
   * @param {object} relationshipData - Analyzed relationships
   */
  captureTargetRelationships(actionId, relationshipData) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    const traceData = {
      stage: 'target_relationships',
      totalTargets: relationshipData.totalTargets || 0,
      relationships: relationshipData.relationships || [],
      patterns: relationshipData.patterns || [],
      analysisTimeMs: relationshipData.analysisTimeMs || 0,
      timestamp: Date.now(),
    };

    this.captureActionData('target_relationships', actionId, traceData);
  }

  /**
   * Get multi-target summary for a traced action
   *
   * @param {string} actionId - Action ID
   * @returns {object|null} Multi-target summary or null
   */
  getMultiTargetSummary(actionId) {
    const actionTrace = this.getActionTrace(actionId);
    if (!actionTrace) {
      return null;
    }

    const summary = {
      isMultiTarget: false,
      targetKeys: [],
      totalTargets: 0,
      resolutionTimeMs: 0,
      scopeEvaluations: [],
      hasRelationships: false,
    };

    // Check for multi-target resolution data
    // Note: multi_target_resolution data is captured twice - once at start with
    // resolutionTimeMs = 0, and once at end with actual time
    // We need to get the final one with the actual resolution time
    const multiTargetStage = actionTrace.stages['multi_target_resolution'];
    let multiTargetData = null;
    if (multiTargetStage && multiTargetStage.data) {
      multiTargetData = multiTargetStage.data;
      // If resolutionTimeMs is 0, it's the initial capture, so look for an update
      // The update would overwrite the same stage, so we have the final data
    }

    if (multiTargetData) {
      summary.isMultiTarget = true;
      summary.targetKeys = multiTargetData.targetKeys || [];
      summary.totalTargets = multiTargetData.totalTargets || 0;
      summary.resolutionTimeMs = multiTargetData.resolutionTimeMs || 0;
    }

    // Collect all scope evaluations
    for (const [stageName, stageData] of Object.entries(actionTrace.stages)) {
      if (stageName === 'scope_evaluation' && stageData.data) {
        // Extract the relevant fields from the captured data
        const scopeData = {
          targetKey: stageData.data.targetKey,
          scope: stageData.data.scope,
          context: stageData.data.context,
          resultCount: stageData.data.resultCount,
          evaluationTimeMs: stageData.data.evaluationTimeMs,
          cacheHit: stageData.data.cacheHit,
        };
        if (stageData.data.error) {
          scopeData.error = stageData.data.error;
        }
        summary.scopeEvaluations.push(scopeData);
      }
    }

    // Check for relationship data
    const relationshipStage = actionTrace.stages['target_relationships'];
    if (relationshipStage && relationshipStage.data) {
      summary.hasRelationships = true;
      summary.relationshipCount =
        relationshipStage.data.relationships?.length || 0;
    }

    return summary;
  }

  /**
   * Filter captured data based on verbosity level and inclusion configuration
   *
   * @private
   * @param {object} data - Raw data to filter
   * @param {string} stage - Pipeline stage name for stage-specific filtering
   * @returns {object} Filtered data
   */
  #filterDataByVerbosity(data, stage) {
    const verbosity = this.#actionTraceFilter.getVerbosityLevel();
    const config = this.#actionTraceFilter.getInclusionConfig();

    // Start with base data that's always included
    const filteredData = {
      timestamp: data.timestamp || Date.now(),
      stage,
    };

    // Special handling for legacy and multi-target stages - always include all data
    if (
      stage === 'legacy_processing' ||
      stage === 'legacy_detection' ||
      stage === 'multi_target_resolution' ||
      stage === 'scope_evaluation' ||
      stage === 'target_relationships' ||
      stage === 'enhanced_scope_evaluation'
    ) {
      return { ...filteredData, ...data };
    }

    try {
      switch (verbosity) {
        case 'minimal':
          return this.#applyMinimalFiltering(data, filteredData, config);

        case 'standard':
          return this.#applyStandardFiltering(data, filteredData, config);

        case 'detailed':
          return this.#applyDetailedFiltering(data, filteredData, config);

        case 'verbose':
          return this.#applyVerboseFiltering(data, filteredData, config);

        default:
          this.#logger.warn(
            `Unknown verbosity level: ${verbosity}, using 'standard'`
          );
          return this.#applyStandardFiltering(data, filteredData, config);
      }
    } catch (error) {
      this.#logger.error(
        `Error filtering data for verbosity '${verbosity}'`,
        error
      );
      return { ...filteredData, error: 'Data filtering failed' };
    }
  }

  /**
   * Apply minimal verbosity filtering - only essential data
   *
   * @private
   * @param {object} data - Raw data
   * @param {object} filteredData - Base filtered data
   * @param {object} config - Inclusion configuration
   * @returns {object} Filtered data
   */
  #applyMinimalFiltering(data, filteredData, config) {
    // Only include basic success/failure information
    if (data.passed !== undefined) {
      filteredData.passed = data.passed;
    }
    if (data.success !== undefined) {
      filteredData.success = data.success;
    }
    if (data.error) {
      filteredData.error =
        typeof data.error === 'string' ? data.error : data.error.message;
    }

    return filteredData;
  }

  /**
   * Apply standard verbosity filtering - balanced detail
   *
   * @private
   * @param {object} data - Raw data
   * @param {object} filteredData - Base filtered data
   * @param {object} config - Inclusion configuration
   * @returns {object} Filtered data
   */
  #applyStandardFiltering(data, filteredData, config) {
    // Include minimal data
    Object.assign(filteredData, this.#applyMinimalFiltering(data, {}, config));

    // Add standard-level details
    if (data.actorId) {
      filteredData.actorId = data.actorId;
    }

    // Include component data if configured
    if (config.componentData && data.actorComponents) {
      filteredData.actorComponents = data.actorComponents;
    }
    if (config.componentData && data.requiredComponents) {
      filteredData.requiredComponents = data.requiredComponents;
    }

    // Include basic prerequisite info if configured
    if (config.prerequisites && data.prerequisites) {
      filteredData.prerequisiteCount = Array.isArray(data.prerequisites)
        ? data.prerequisites.length
        : Object.keys(data.prerequisites).length;
    }

    // Include target summary if configured
    if (config.targets) {
      if (data.targetCount !== undefined) {
        filteredData.targetCount = data.targetCount;
      }
      if (data.targetKeys) {
        filteredData.targetKeys = data.targetKeys;
      }
    }

    return filteredData;
  }

  /**
   * Apply detailed verbosity filtering - comprehensive data
   *
   * @private
   * @param {object} data - Raw data
   * @param {object} filteredData - Base filtered data
   * @param {object} config - Inclusion configuration
   * @returns {object} Filtered data
   */
  #applyDetailedFiltering(data, filteredData, config) {
    // Include standard data
    Object.assign(filteredData, this.#applyStandardFiltering(data, {}, config));

    // Add detailed-level information
    if (config.prerequisites && data.prerequisites) {
      filteredData.prerequisites = data.prerequisites;
    }

    if (config.targets && data.resolvedTargets) {
      // Include resolved targets but limit size
      filteredData.resolvedTargets = this.#limitArraySize(
        data.resolvedTargets,
        10
      );
    }

    if (data.formattedCommand) {
      filteredData.formattedCommand = data.formattedCommand;
    }
    if (data.template) {
      filteredData.template = data.template;
    }

    // Include performance metrics
    if (data.duration !== undefined) {
      filteredData.duration = data.duration;
    }

    return filteredData;
  }

  /**
   * Apply verbose verbosity filtering - all available data
   *
   * @private
   * @param {object} data - Raw data
   * @param {object} filteredData - Base filtered data
   * @param {object} config - Inclusion configuration
   * @returns {object} Filtered data
   */
  #applyVerboseFiltering(data, filteredData, config) {
    // Include detailed data
    Object.assign(filteredData, this.#applyDetailedFiltering(data, {}, config));

    // Add verbose-level information - include most data with some safety limits
    const safeData = this.#createSafeDataCopy(data);

    // Merge all data but respect configuration flags
    Object.assign(filteredData, safeData);

    // Remove sensitive or redundant data
    delete filteredData.sensitiveData;
    delete filteredData.rawTokens;
    delete filteredData.internalState;

    return filteredData;
  }

  /**
   * Limit array size to prevent excessive memory usage
   *
   * @private
   * @param {Array} array - Array to limit
   * @param {number} maxSize - Maximum size
   * @returns {Array} Limited array
   */
  #limitArraySize(array, maxSize) {
    if (!Array.isArray(array)) {
      return array;
    }

    if (array.length <= maxSize) {
      return array;
    }

    return [
      ...array.slice(0, maxSize - 1),
      {
        truncated: true,
        originalLength: array.length,
        showing: maxSize - 1,
      },
    ];
  }

  /**
   * Create a safe copy of data, handling circular references and large objects
   *
   * @private
   * @param {object} data - Data to copy
   * @returns {object} Safe copy
   */
  #createSafeDataCopy(data) {
    try {
      // Use JSON serialization to handle circular references safely
      const jsonString = JSON.stringify(data, (key, value) => {
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (this.#seenObjects && this.#seenObjects.has(value)) {
            return '[Circular Reference]';
          }
          if (!this.#seenObjects) {
            this.#seenObjects = new WeakSet();
          }
          this.#seenObjects.add(value);
        }

        // Limit string length
        if (typeof value === 'string' && value.length > 1000) {
          return value.substring(0, 1000) + '... [truncated]';
        }

        return value;
      });

      // Reset seen objects for next call
      this.#seenObjects = null;

      return JSON.parse(jsonString);
    } catch (error) {
      this.#logger.warn(
        'Failed to create safe data copy, using fallback',
        error
      );
      return { dataError: 'Failed to serialize data safely' };
    }
  }

  // ==========================================
  // Enhanced Filtering Methods (Opt-in)
  // Added for ACTTRA-017 - Backward compatible
  // ==========================================

  /**
   * Capture action data with enhanced filtering capabilities
   * This is an opt-in method that doesn't affect existing code
   *
   * @param {string} stage - Pipeline stage name
   * @param {string} actionId - Action ID being processed
   * @param {object} data - Stage-specific data to capture
   * @param {object} [options] - Enhanced capture options
   * @param {string} [options.category] - Data category (core, performance, diagnostic, etc.)
   * @param {object} [options.context] - Additional context for filtering
   * @param {boolean} [options.summarize] - Whether to apply data summarization
   * @param {string} [options.targetVerbosity] - Target verbosity for summarization
   * @returns {void}
   */
  captureEnhancedActionData(stage, actionId, data, options = {}) {
    // Validate inputs using existing patterns
    string.assertNonBlank(stage, 'Stage');
    string.assertNonBlank(actionId, 'Action ID');

    // Check if we have an enhanced filter
    const isEnhancedFilter =
      this.#actionTraceFilter.shouldCaptureEnhanced !== undefined;

    // If we have an enhanced filter, use it
    if (isEnhancedFilter) {
      const shouldCapture = this.#actionTraceFilter.shouldCaptureEnhanced(
        options.category || 'core',
        `${stage}_${actionId}`,
        data,
        options.context || {}
      );

      if (!shouldCapture) {
        return; // Filtered out
      }
    } else {
      // Fall back to regular shouldTrace if not enhanced
      if (!this.#actionTraceFilter.shouldTrace(actionId)) {
        return;
      }
    }

    // Apply data summarization if requested
    let processedData = data;
    if (options.summarize) {
      const targetVerbosity =
        options.targetVerbosity ||
        (this.#actionTraceFilter.getVerbosityLevel
          ? this.#actionTraceFilter.getVerbosityLevel()
          : 'standard');
      processedData = this.#summarizeDataEnhanced(data, targetVerbosity);
    }

    // Add enhanced metadata
    const enhancedData = {
      ...processedData,
      _enhanced: {
        category: options.category || 'core',
        verbosityLevel: this.#actionTraceFilter.getVerbosityLevel
          ? this.#actionTraceFilter.getVerbosityLevel()
          : 'standard',
        timestamp: new Date().toISOString(),
      },
    };

    // Capture data directly without using parent's filtering
    // Initialize action trace data if first time seeing this action
    if (!this.#tracedActionData.has(actionId)) {
      this.#tracedActionData.set(actionId, {
        actionId,
        actorId: this.#actorId,
        startTime: Date.now(),
        stages: {},
        context: this.#context,
      });
    }

    const actionTrace = this.#tracedActionData.get(actionId);

    // Store the enhanced data directly without additional filtering
    actionTrace.stages[stage] = {
      timestamp: Date.now(),
      data: enhancedData,
      stageCompletedAt: Date.now(),
    };

    // Log trace capture for debugging
    this.#logger.debug(
      `ActionAwareStructuredTrace: Captured enhanced data for action '${actionId}' at stage '${stage}'`,
      {
        actionId,
        stage,
        dataKeys: Object.keys(enhancedData),
        category: options.category || 'core',
      }
    );
  }

  /**
   * Enhanced data summarization based on verbosity
   *
   * @private
   * @param {object} data - Data to summarize
   * @param {string} targetVerbosity - Target verbosity level
   * @returns {object} Summarized data
   */
  #summarizeDataEnhanced(data, targetVerbosity) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const levelMap = { minimal: 0, standard: 1, detailed: 2, verbose: 3 };
    const targetLevel = levelMap[targetVerbosity] || 1;

    // Apply progressive summarization based on verbosity
    const summarized = { ...data };

    if (targetLevel < 2) {
      // Less than detailed
      // Remove performance metrics
      delete summarized.performance;
      delete summarized.timing;
      delete summarized.metrics;

      // Truncate arrays
      Object.keys(summarized).forEach((key) => {
        if (Array.isArray(summarized[key]) && summarized[key].length > 3) {
          summarized[key] = summarized[key].slice(0, 3);
          summarized[`${key}_truncated`] = true;
          summarized[`${key}_original_length`] = data[key].length;
        }
      });
    }

    if (targetLevel < 3) {
      // Less than verbose
      // Remove diagnostic information
      delete summarized.diagnostic;
      delete summarized.debug;
      delete summarized.internal;

      // Truncate long strings
      Object.keys(summarized).forEach((key) => {
        if (
          typeof summarized[key] === 'string' &&
          summarized[key].length > 200
        ) {
          summarized[key] = summarized[key].substring(0, 197) + '...';
        }
      });
    }

    return summarized;
  }

  /**
   * Add dynamic filtering rule (opt-in)
   *
   * @param {string} ruleName - Name of the rule
   * @param {Function} ruleFunction - Rule function
   * @returns {void}
   */
  addDynamicTraceRule(ruleName, ruleFunction) {
    if (this.#actionTraceFilter.addDynamicRule) {
      this.#actionTraceFilter.addDynamicRule(ruleName, ruleFunction);
    } else {
      this.#logger.warn('Dynamic rules require EnhancedActionTraceFilter');
    }
  }

  /**
   * Remove dynamic filtering rule
   *
   * @param {string} ruleName - Name of the rule to remove
   * @returns {void}
   */
  removeDynamicTraceRule(ruleName) {
    if (this.#actionTraceFilter.removeDynamicRule) {
      this.#actionTraceFilter.removeDynamicRule(ruleName);
    }
  }

  /**
   * Get enhanced statistics (opt-in)
   *
   * @returns {object|null} Enhanced statistics or null if not available
   */
  getEnhancedTraceStats() {
    if (this.#actionTraceFilter.getEnhancedStats) {
      return this.#actionTraceFilter.getEnhancedStats();
    }
    return null;
  }

  /**
   * Export filtered trace data based on verbosity (opt-in)
   *
   * @param {string} targetVerbosity - Target verbosity level for export
   * @param {string[]} [categories] - Optional categories to include
   * @returns {object} Filtered trace data
   */
  exportFilteredTraceData(targetVerbosity, categories = null) {
    const filteredData = {};
    const traceData = this.getTracedActions(); // Use existing method

    for (const [actionId, actionTrace] of traceData) {
      const stageData = {};

      for (const [stage, data] of Object.entries(actionTrace.stages)) {
        // Check if stage should be included based on categories
        if (categories && !this.#shouldIncludeStage(stage, categories)) {
          continue;
        }

        // Apply verbosity filtering if enhanced
        if (data.data._enhanced) {
          const levelMap = { minimal: 0, standard: 1, detailed: 2, verbose: 3 };
          const dataLevel = levelMap[data.data._enhanced.verbosityLevel] || 1;
          const targetLevel = levelMap[targetVerbosity] || 1;

          if (targetLevel < dataLevel) {
            continue; // Skip data above target verbosity
          }
        }

        stageData[stage] = this.#summarizeDataEnhanced(
          data.data,
          targetVerbosity
        );
      }

      if (Object.keys(stageData).length > 0) {
        filteredData[actionId] = {
          ...actionTrace,
          stages: stageData,
        };
      }
    }

    return filteredData;
  }

  /**
   * Check if a stage should be included based on categories
   *
   * @private
   * @param {string} stage - Stage name
   * @param {string[]} categories - Categories to include
   * @returns {boolean} Whether to include the stage
   */
  #shouldIncludeStage(stage, categories) {
    // Map stages to categories
    const stageCategories = {
      component_filtering: 'business_logic',
      prerequisite_evaluation: 'business_logic',
      target_resolution: 'business_logic',
      formatting: 'business_logic',
      legacy_processing: 'legacy',
      legacy_detection: 'legacy',
      multi_target_resolution: 'core',
      scope_evaluation: 'core',
      target_relationships: 'core',
      action_start: 'core',
      action_complete: 'core',
      stage_start: 'core',
      stage_complete: 'core',
      timing_data: 'performance',
      resource_usage: 'performance',
      performance_metrics: 'performance',
      error_details: 'diagnostic',
      validation_results: 'diagnostic',
      debug_info: 'diagnostic',
    };

    const category = stageCategories[stage];
    return !category || categories.includes(category);
  }

  /**
   * Reset enhanced statistics
   *
   * @returns {void}
   */
  resetEnhancedStats() {
    if (this.#actionTraceFilter.resetEnhancedStats) {
      this.#actionTraceFilter.resetEnhancedStats();
    }
  }

  /**
   * Clear enhanced filter cache
   *
   * @returns {void}
   */
  clearEnhancedCache() {
    if (this.#actionTraceFilter.clearEnhancedCache) {
      this.#actionTraceFilter.clearEnhancedCache();
    }
  }

  /**
   * Optimize enhanced filter cache
   *
   * @param {number} [maxAge] - Maximum age for cache entries in milliseconds
   * @returns {void}
   */
  optimizeEnhancedCache(maxAge = 300000) {
    if (this.#actionTraceFilter.optimizeCache) {
      this.#actionTraceFilter.optimizeCache(maxAge);
    }
  }

  /**
   * Serialize the trace data to JSON format
   * This method provides compatibility with the trace output service
   *
   * @returns {object} Serialized trace data
   */
  toJSON() {
    const tracedActions = this.getTracedActions();
    const summary = this.getTracingSummary();
    const spans = this.getSpans ? this.getSpans() : [];

    const result = {
      timestamp: new Date().toISOString(),
      traceType: 'action_aware_structured',
      actorId: this.#actorId,
      context: this.#context,
      summary: summary,
      spans: spans,
      actions: {},
    };

    // Convert Map to object for JSON serialization
    for (const [actionId, data] of tracedActions) {
      result.actions[actionId] = {
        ...data,
        stageOrder: Object.keys(data.stages || {}),
        totalDuration: this.#calculateTotalDuration(data),
      };
    }

    return result;
  }

  /**
   * Calculate total duration from stage data
   * Helper method for toJSON
   *
   * @private
   * @param {object} actionData - Action trace data
   * @returns {number} Total duration in ms
   */
  #calculateTotalDuration(actionData) {
    if (!actionData.stages) return 0;

    const timestamps = Object.values(actionData.stages)
      .map((stage) => stage.timestamp)
      .filter((ts) => ts);

    if (timestamps.length < 2) return 0;

    // Use reduce to avoid stack overflow with large arrays
    const maxTimestamp = timestamps.reduce(
      (max, ts) => Math.max(max, ts),
      -Infinity
    );
    const minTimestamp = timestamps.reduce(
      (min, ts) => Math.min(min, ts),
      Infinity
    );
    return maxTimestamp - minTimestamp;
  }
}

export default ActionAwareStructuredTrace;
