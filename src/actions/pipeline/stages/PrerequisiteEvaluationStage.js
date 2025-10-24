/**
 * @file Stage for evaluating action prerequisites
 * Enhanced with action tracing capabilities for detailed prerequisite debugging
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { ERROR_PHASES } from '../../errors/actionErrorTypes.js';

/** @typedef {import('../../validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../tracing/actionAwareStructuredTrace.js').default} ActionAwareStructuredTrace */

/**
 * @class PrerequisiteEvaluationStage
 * @augments PipelineStage
 * @description Evaluates prerequisites for each candidate action
 * Enhanced with detailed action tracing for prerequisite evaluation debugging
 */
export class PrerequisiteEvaluationStage extends PipelineStage {
  #prerequisiteService;
  #errorContextBuilder;
  #logger;
  #seenObjects;

  /**
   * Creates a PrerequisiteEvaluationStage instance
   *
   * @param {PrerequisiteEvaluationService} prerequisiteService - Service for evaluating prerequisites
   * @param {ActionErrorContextBuilder} errorContextBuilder - Builder for error contexts
   * @param {ILogger} logger - Logger for diagnostic output
   */
  constructor(prerequisiteService, errorContextBuilder, logger) {
    super('PrerequisiteEvaluation');
    this.#prerequisiteService = prerequisiteService;
    this.#errorContextBuilder = errorContextBuilder;
    this.#logger = logger;
  }

  /**
   * Internal execution of the prerequisite evaluation stage with enhanced action tracing
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../../../interfaces/IGameDataRepository.js').ActionDefinition[]} context.candidateActions - Candidate actions
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace|ActionAwareStructuredTrace} [context.trace] - Optional trace context
   * @param {object} [context.actionContext] - Base context for prerequisite evaluation
   * @returns {Promise<PipelineResult>} Actions that passed prerequisites
   */
  async executeInternal(context) {
    const { actor, candidateActions = [], trace, actionContext } = context;
    const source = `${this.name}Stage.execute`;
    const stageStartTime = Date.now();
    const startPerformanceTime = performance.now(); // ACTTRA-018: Performance timing

    // Check if we have action-aware tracing capability
    const isActionAwareTrace = this.#isActionAwareTrace(trace);

    if (isActionAwareTrace) {
      this.#logger.debug(
        `PrerequisiteEvaluationStage: Action tracing enabled for actor ${actor.id}`,
        { actorId: actor.id, traceType: 'ActionAwareStructuredTrace' }
      );
    }

    trace?.step(
      `Evaluating prerequisites for ${candidateActions.length} candidate actions`,
      source
    );

    // Capture pre-evaluation data for tracing
    if (isActionAwareTrace) {
      await this.#capturePreEvaluationData(
        trace,
        actor,
        candidateActions,
        actionContext,
        stageStartTime
      );
    }

    const validActions = [];
    const errors = [];
    const evaluationResults = new Map();

    // Process each candidate action
    for (const actionDef of candidateActions) {
      try {
        const evaluationResult = await this.#evaluateActionWithTracing(
          actionDef,
          actor,
          actionContext,
          trace,
          isActionAwareTrace
        );

        evaluationResults.set(actionDef.id, evaluationResult);

        if (evaluationResult.passed) {
          validActions.push(actionDef);
          trace?.success(
            `Action '${actionDef.id}' passed prerequisite check`,
            source
          );
        } else {
          trace?.info(
            `Action '${actionDef.id}' failed prerequisite check`,
            source
          );
        }
      } catch (error) {
        // Build error context
        const errorContext = this.#errorContextBuilder.buildErrorContext({
          error,
          actionDef,
          actorId: actor.id,
          phase: ERROR_PHASES.VALIDATION,
          trace,
          additionalContext: {
            stage: 'prerequisite_evaluation',
          },
        });

        errors.push(errorContext);

        this.#logger.error(
          `Error checking prerequisites for action '${actionDef.id}': ${error.message}`,
          errorContext
        );

        // Capture error in tracing if available
        if (isActionAwareTrace && trace.captureActionData) {
          await this.#capturePrerequisiteError(trace, actionDef, actor, error);
        }
      }
    }

    // ACTTRA-018: Capture performance data for each action
    const endPerformanceTime = performance.now();
    if (isActionAwareTrace && trace.captureActionData) {
      for (const actionDef of candidateActions) {
        await this.#capturePerformanceData(
          trace,
          actionDef,
          startPerformanceTime,
          endPerformanceTime,
          candidateActions.length,
          validActions.length
        );
      }
    }

    // Capture post-evaluation summary
    if (isActionAwareTrace) {
      await this.#capturePostEvaluationData(
        trace,
        actor,
        candidateActions.length,
        validActions.length,
        evaluationResults,
        stageStartTime
      );
    }

    this.#logger.debug(
      `Prerequisite evaluation complete: ${validActions.length}/${candidateActions.length} actions passed`
    );

    trace?.info(
      `Prerequisite evaluation completed: ${validActions.length} valid actions, ${errors.length} errors`,
      source
    );

    // Continue processing even if some actions failed prerequisites
    return PipelineResult.success({
      data: {
        candidateActions: validActions,
        prerequisiteErrors: errors,
      },
      errors,
    });
  }

  /**
   * Check if trace is ActionAwareStructuredTrace
   *
   * @private
   * @param {object} trace - Trace instance to check
   * @returns {boolean}
   */
  #isActionAwareTrace(trace) {
    return trace && typeof trace.captureActionData === 'function';
  }

  /**
   * Evaluate single action prerequisites with optional tracing
   *
   * @private
   * @param {object} actionDef - Action definition to evaluate
   * @param {object} actor - Actor entity
   * @param {object} actionContext - Base context for evaluation
   * @param {object} trace - Trace context
   * @param {boolean} isActionAwareTrace - Whether trace supports action data capture
   * @returns {Promise<object>} Evaluation result with detailed data
   */
  async #evaluateActionWithTracing(
    actionDef,
    actor,
    actionContext,
    trace,
    isActionAwareTrace
  ) {
    const evaluationStartTime = Date.now();

    try {
      // Handle actions with no prerequisites
      if (!this.#hasPrerequisites(actionDef)) {
        const result = {
          passed: true,
          reason: 'No prerequisites defined',
          hasPrerequisites: false,
          evaluationTime: Date.now() - evaluationStartTime,
        };

        // Capture no-prerequisites scenario if tracing enabled
        if (isActionAwareTrace && trace.captureActionData) {
          await this.#captureNoPrerequisitesData(
            trace,
            actionDef,
            actor,
            result
          );
        }

        return result;
      }

      // Extract and normalize prerequisites
      const prerequisites = this.#extractPrerequisites(actionDef);

      // Create enhanced trace for prerequisite service if action tracing is enabled
      const enhancedTrace = isActionAwareTrace
        ? this.#createPrerequisiteTrace(trace, actionDef)
        : trace;

      // Perform prerequisite evaluation using the service
      const serviceResult = this.#prerequisiteService.evaluate(
        prerequisites,
        actionDef,
        actor,
        enhancedTrace
      );

      const isObjectResult =
        typeof serviceResult === 'object' && serviceResult !== null;
      const evaluationPassed = isObjectResult
        ? Object.prototype.hasOwnProperty.call(serviceResult, 'passed')
          ? Boolean(serviceResult.passed)
          : Boolean(serviceResult)
        : Boolean(serviceResult);

      const normalizedPrerequisites = isObjectResult
        ? (serviceResult.prerequisites ?? prerequisites)
        : prerequisites;

      const evaluationDetails = this.#extractEvaluationDetails(
        enhancedTrace,
        normalizedPrerequisites,
        evaluationPassed
      );

      const evaluationReason =
        isObjectResult && serviceResult.reason
          ? serviceResult.reason
          : evaluationPassed
            ? 'All prerequisites satisfied'
            : 'One or more prerequisites failed';

      const hasPrerequisites =
        isObjectResult &&
        Object.prototype.hasOwnProperty.call(serviceResult, 'hasPrerequisites')
          ? Boolean(serviceResult.hasPrerequisites)
          : true;

      const result = {
        passed: evaluationPassed,
        reason: evaluationReason,
        hasPrerequisites,
        prerequisites: normalizedPrerequisites,
        evaluationDetails: evaluationDetails,
        evaluationTime:
          isObjectResult &&
          Object.prototype.hasOwnProperty.call(
            serviceResult,
            'evaluationTime'
          ) &&
          typeof serviceResult.evaluationTime === 'number'
            ? serviceResult.evaluationTime
            : Date.now() - evaluationStartTime,
      };

      if (isObjectResult && serviceResult.error) {
        result.error = serviceResult.error;
      }

      if (isObjectResult && serviceResult.errorType) {
        result.errorType = serviceResult.errorType;
      }

      // Capture detailed evaluation data if tracing enabled
      if (isActionAwareTrace && trace.captureActionData) {
        await this.#capturePrerequisiteEvaluationData(
          trace,
          actionDef,
          actor,
          result
        );
      }

      return result;
    } catch (error) {
      const result = {
        passed: false,
        reason: `Prerequisite evaluation error: ${error.message}`,
        hasPrerequisites: this.#hasPrerequisites(actionDef),
        error: error.message,
        errorType: error.constructor.name,
        evaluationTime: Date.now() - evaluationStartTime,
      };

      // Don't rethrow - let the stage continue processing other actions
      this.#logger.error(
        `Error evaluating prerequisites for action '${actionDef.id}'`,
        error
      );

      return result;
    }
  }

  /**
   * Check if action has prerequisites
   *
   * @private
   * @param {object} actionDef - Action definition
   * @returns {boolean}
   */
  #hasPrerequisites(actionDef) {
    if (!actionDef.prerequisites) {
      return false;
    }

    if (Array.isArray(actionDef.prerequisites)) {
      return actionDef.prerequisites.length > 0;
    }

    if (typeof actionDef.prerequisites === 'object') {
      return Object.keys(actionDef.prerequisites).length > 0;
    }

    return Boolean(actionDef.prerequisites);
  }

  /**
   * Extract prerequisites from action definition
   *
   * @private
   * @param {object} actionDef - Action definition
   * @returns {Array} Normalized prerequisites
   */
  #extractPrerequisites(actionDef) {
    const prerequisites = actionDef.prerequisites;

    // If already an array, return as-is
    if (Array.isArray(prerequisites)) {
      return prerequisites;
    }

    // If it's an object, keep as array for service compatibility
    // The service expects an array of prerequisite objects
    return prerequisites;
  }

  /**
   * Create enhanced trace for prerequisite service integration
   *
   * @private
   * @param {object} baseTrace - Base ActionAwareStructuredTrace
   * @param {object} actionDef - Action being evaluated
   * @returns {object} Enhanced trace for prerequisite service
   */
  #createPrerequisiteTrace(baseTrace, actionDef) {
    // Create a wrapper trace that captures prerequisite-specific data
    const prerequisiteTrace = {
      // Preserve original trace methods
      step: baseTrace.step?.bind(baseTrace),
      info: baseTrace.info?.bind(baseTrace),
      success: baseTrace.success?.bind(baseTrace),
      failure: baseTrace.failure?.bind(baseTrace),
      error: baseTrace.error?.bind(baseTrace),
      data: baseTrace.data?.bind(baseTrace),

      // Support span-based tracing if available
      withSpan: baseTrace.withSpan?.bind(baseTrace),

      // Add prerequisite-specific capture method
      captureJsonLogicTrace: (logicExpression, context, result, steps) => {
        try {
          // Store JSON Logic trace data for later extraction
          if (!prerequisiteTrace._jsonLogicTraces) {
            prerequisiteTrace._jsonLogicTraces = [];
          }

          prerequisiteTrace._jsonLogicTraces.push({
            expression: logicExpression,
            context: this.#createSafeContext(context),
            result,
            evaluationSteps: steps || [],
            timestamp: Date.now(),
          });
        } catch (error) {
          this.#logger.warn(
            `Failed to capture JSON Logic trace for action '${actionDef.id}'`,
            error
          );
        }
      },

      // Add context capture method
      captureEvaluationContext: (contextData) => {
        prerequisiteTrace._evaluationContext =
          this.#createSafeContext(contextData);
      },
    };

    return prerequisiteTrace;
  }

  /**
   * Create safe context for tracing (handles circular references)
   *
   * @private
   * @param {object} context - Context to make safe
   * @returns {object} Safe context for JSON serialization
   */
  #createSafeContext(context) {
    try {
      return JSON.parse(
        JSON.stringify(context, (key, value) => {
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

          // Limit string length for large data
          if (typeof value === 'string' && value.length > 500) {
            return value.substring(0, 500) + '... [truncated]';
          }

          return value;
        })
      );
    } catch (error) {
      return { contextError: 'Failed to serialize context safely' };
    } finally {
      this.#seenObjects = null;
    }
  }

  /**
   * Extract evaluation details from enhanced trace
   *
   * @private
   * @param {object} enhancedTrace - Enhanced trace with captured data
   * @param {Array} prerequisites - Original prerequisites
   * @param {boolean} evaluationPassed - Whether evaluation passed
   * @returns {object} Detailed evaluation information
   */
  #extractEvaluationDetails(enhancedTrace, prerequisites, evaluationPassed) {
    const details = {
      prerequisiteCount: Array.isArray(prerequisites)
        ? prerequisites.length
        : 1,
      evaluationPassed,
      hasJsonLogicTraces: false,
      hasEvaluationContext: false,
    };

    // Extract JSON Logic traces if available
    if (
      enhancedTrace?._jsonLogicTraces &&
      enhancedTrace._jsonLogicTraces.length > 0
    ) {
      details.hasJsonLogicTraces = true;
      details.jsonLogicTraces = enhancedTrace._jsonLogicTraces;
    }

    // Extract evaluation context if available
    if (enhancedTrace?._evaluationContext) {
      details.hasEvaluationContext = true;
      details.evaluationContext = enhancedTrace._evaluationContext;
    }

    return details;
  }

  /**
   * Capture pre-evaluation stage data
   *
   * @param trace
   * @param actor
   * @param candidateActions
   * @param actionContext
   * @param stageStartTime
   * @private
   */
  async #capturePreEvaluationData(
    trace,
    actor,
    candidateActions,
    actionContext,
    stageStartTime
  ) {
    try {
      // This is general stage information, not action-specific
      const stageData = {
        stage: 'prerequisite_evaluation_start',
        actorId: actor.id,
        candidateActionCount: candidateActions.length,
        hasActionContext: !!actionContext,
        stageStartTime,
        timestamp: Date.now(),
      };

      this.#logger.debug(
        'PrerequisiteEvaluationStage: Captured pre-evaluation data',
        stageData
      );
    } catch (error) {
      this.#logger.warn(
        'Failed to capture pre-evaluation data for tracing',
        error
      );
    }
  }

  /**
   * Capture prerequisite evaluation data for traced action
   *
   * @param trace
   * @param actionDef
   * @param actor
   * @param evaluationResult
   * @private
   */
  async #capturePrerequisiteEvaluationData(
    trace,
    actionDef,
    actor,
    evaluationResult
  ) {
    try {
      const traceData = {
        stage: 'prerequisite_evaluation',
        actorId: actor.id,
        hasPrerequisites: evaluationResult.hasPrerequisites,
        prerequisiteCount: evaluationResult.prerequisites
          ? Array.isArray(evaluationResult.prerequisites)
            ? evaluationResult.prerequisites.length
            : 1
          : 0,
        evaluationPassed: evaluationResult.passed,
        evaluationReason: evaluationResult.reason,
        evaluationTimeMs: evaluationResult.evaluationTime,
        timestamp: Date.now(),
      };

      // Include prerequisites if present (filtered by verbosity in ActionAwareStructuredTrace)
      if (evaluationResult.prerequisites) {
        traceData.prerequisites = evaluationResult.prerequisites;
      }

      // Include evaluation details if available
      if (evaluationResult.evaluationDetails) {
        traceData.evaluationDetails = evaluationResult.evaluationDetails;
      }

      // Include error information if evaluation failed due to error
      if (evaluationResult.error) {
        traceData.error = evaluationResult.error;
        traceData.errorType = evaluationResult.errorType;
      }

      await trace.captureActionData(
        'prerequisite_evaluation',
        actionDef.id,
        traceData
      );

      this.#logger.debug(
        `PrerequisiteEvaluationStage: Captured prerequisite data for action '${actionDef.id}'`,
        {
          actionId: actionDef.id,
          passed: evaluationResult.passed,
          hasPrerequisites: evaluationResult.hasPrerequisites,
          prerequisiteCount: traceData.prerequisiteCount,
        }
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture prerequisite evaluation data for action '${actionDef.id}'`,
        error
      );
    }
  }

  /**
   * Capture data for actions with no prerequisites
   *
   * @param trace
   * @param actionDef
   * @param actor
   * @param result
   * @private
   */
  async #captureNoPrerequisitesData(trace, actionDef, actor, result) {
    try {
      const traceData = {
        stage: 'prerequisite_evaluation',
        actorId: actor.id,
        hasPrerequisites: false,
        evaluationPassed: true,
        evaluationReason: 'No prerequisites defined',
        evaluationTimeMs: result.evaluationTime,
        timestamp: Date.now(),
      };

      await trace.captureActionData(
        'prerequisite_evaluation',
        actionDef.id,
        traceData
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture no-prerequisites data for action '${actionDef.id}'`,
        error
      );
    }
  }

  /**
   * Capture prerequisite evaluation error
   *
   * @param trace
   * @param actionDef
   * @param actor
   * @param error
   * @private
   */
  async #capturePrerequisiteError(trace, actionDef, actor, error) {
    try {
      const errorData = {
        stage: 'prerequisite_evaluation',
        actorId: actor.id,
        evaluationFailed: true,
        error: error.message,
        errorType: error.constructor.name,
        timestamp: Date.now(),
      };

      await trace.captureActionData(
        'prerequisite_evaluation',
        actionDef.id,
        errorData
      );

      this.#logger.debug(
        `PrerequisiteEvaluationStage: Captured prerequisite error for action '${actionDef.id}'`,
        { actionId: actionDef.id, error: error.message }
      );
    } catch (traceError) {
      this.#logger.warn(
        `Failed to capture prerequisite error data for action '${actionDef.id}'`,
        traceError
      );
    }
  }

  /**
   * Capture post-evaluation summary data
   *
   * @param trace
   * @param actor
   * @param originalCount
   * @param passedCount
   * @param evaluationResults
   * @param stageStartTime
   * @private
   */
  async #capturePostEvaluationData(
    trace,
    actor,
    originalCount,
    passedCount,
    evaluationResults,
    stageStartTime
  ) {
    try {
      const summaryData = {
        stage: 'prerequisite_evaluation_summary',
        actorId: actor.id,
        originalActionCount: originalCount,
        passedActionCount: passedCount,
        failedActionCount: originalCount - passedCount,
        evaluationSuccessRate:
          originalCount > 0 ? passedCount / originalCount : 1.0,
        stageDurationMs: Date.now() - stageStartTime,
        timestamp: Date.now(),
      };

      // Add statistics about prerequisite types if available
      let actionsWithPrerequisites = 0;
      let actionsWithoutPrerequisites = 0;

      for (const [, result] of evaluationResults) {
        if (result.hasPrerequisites) {
          actionsWithPrerequisites++;
        } else {
          actionsWithoutPrerequisites++;
        }
      }

      summaryData.actionsWithPrerequisites = actionsWithPrerequisites;
      summaryData.actionsWithoutPrerequisites = actionsWithoutPrerequisites;

      this.#logger.debug(
        'PrerequisiteEvaluationStage: Captured post-evaluation summary',
        summaryData
      );
    } catch (error) {
      this.#logger.warn(
        'Failed to capture post-evaluation summary for tracing',
        error
      );
    }
  }

  /**
   * Capture performance data for ACTTRA-018
   *
   * @private
   * @param {import('../../tracing/actionAwareStructuredTrace.js').default} trace - The action-aware trace
   * @param {object} actionDef - The action definition
   * @param {number} startTime - Start performance time
   * @param {number} endTime - End performance time
   * @param {number} totalCandidates - Total number of candidates processed
   * @param {number} passedCandidates - Number of candidates that passed prerequisites
   * @returns {Promise<void>}
   */
  async #capturePerformanceData(
    trace,
    actionDef,
    startTime,
    endTime,
    totalCandidates,
    passedCandidates
  ) {
    try {
      if (trace && trace.captureActionData) {
        await trace.captureActionData('stage_performance', actionDef.id, {
          stage: 'prerequisite_evaluation',
          duration: endTime - startTime,
          timestamp: Date.now(),
          itemsProcessed: totalCandidates,
          itemsPassed: passedCandidates,
          stageName: this.name,
        });
      }
    } catch (error) {
      this.#logger.debug(
        `Failed to capture performance data for action '${actionDef.id}': ${error.message}`
      );
    }
  }
}

export default PrerequisiteEvaluationStage;
