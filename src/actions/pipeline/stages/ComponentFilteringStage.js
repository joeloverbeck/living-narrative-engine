/**
 * @file Stage for filtering actions based on actor components
 * @see ../PipelineStage.js
 */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';

/** @typedef {import('../../actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../errors/actionErrorContextBuilder.js').ActionErrorContextBuilder} ActionErrorContextBuilder */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */

/**
 * @class ComponentFilteringStage
 * @augments PipelineStage
 * @description Filters candidate actions based on actor component requirements
 * Enhanced with action tracing capabilities for debugging
 */
export class ComponentFilteringStage extends PipelineStage {
  #actionIndex;
  #errorContextBuilder;
  #logger;
  #entityManager;

  /**
   * Creates a ComponentFilteringStage instance
   *
   * @param {ActionIndex} actionIndex - The action index for candidate actions
   * @param {ActionErrorContextBuilder} errorContextBuilder - Builder for error contexts
   * @param {ILogger} logger - Logger for diagnostic output
   * @param {EntityManager} entityManager - Entity manager for component data
   */
  constructor(actionIndex, errorContextBuilder, logger, entityManager) {
    super('ComponentFiltering');
    this.#actionIndex = actionIndex;
    this.#errorContextBuilder = errorContextBuilder;
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Internal execution of the component filtering stage
   *
   * @param {object} context - The pipeline context
   * @param {import('../../../entities/entity.js').default} context.actor - The actor entity
   * @param {import('../../tracing/traceContext.js').TraceContext|import('../../tracing/structuredTrace.js').StructuredTrace|import('../../tracing/actionAwareStructuredTrace.js').default} [context.trace] - Optional trace context
   * @returns {Promise<PipelineResult>} The filtered candidate actions
   */
  async executeInternal(context) {
    const { actor, trace } = context;
    const source = `${this.name}Stage.execute`;
    const stageStartTime = Date.now();
    const startPerformanceTime = performance.now(); // ACTTRA-018: Performance timing

    // Check if we have action-aware tracing
    const isActionAwareTrace = this.#isActionAwareTrace(trace);

    trace?.step(
      `Filtering actions for actor ${actor.id} based on components`,
      source
    );

    try {
      // Get actor's components for analysis (if tracing)
      let actorComponents = [];
      if (isActionAwareTrace && this.#entityManager) {
        try {
          actorComponents =
            this.#entityManager.getAllComponentTypesForEntity(actor.id) || [];
        } catch (err) {
          this.#logger.warn(
            `Failed to get actor components for tracing: ${err.message}`
          );
        }
      }

      // Get candidate actions from the index (ActionIndex does ALL the filtering)
      const candidateActions = this.#actionIndex.getCandidateActions(
        actor,
        trace
      );

      // TEMPORARY DIAGNOSTIC: Log filtering results
      this.#logger.debug('[DIAGNOSTIC] ComponentFilteringStage:', {
        actorId: actor.id,
        actorComponents: actor.componentTypeIds || [],
        candidateCount: candidateActions.length,
        candidateIds: candidateActions.map((a) => a.id),
      });

      this.#logger.debug(
        `Found ${candidateActions.length} candidate actions for actor ${actor.id}`
      );

      // If action-aware tracing, analyze each candidate that passed filtering
      if (isActionAwareTrace && trace.captureActionData) {
        for (const actionDef of candidateActions) {
          await this.#captureComponentAnalysis(
            trace,
            actionDef,
            actor.id,
            actorComponents,
            true // passed filtering (it's in candidateActions)
          );

          // ACTTRA-018: Capture performance data for this action
          const endPerformanceTime = performance.now();
          await this.#capturePerformanceData(
            trace,
            actionDef,
            startPerformanceTime,
            endPerformanceTime,
            candidateActions.length
          );
        }
      }

      if (candidateActions.length === 0) {
        trace?.info('No candidate actions found for actor', source);
        return PipelineResult.success({
          data: { candidateActions: [] },
          continueProcessing: false, // No point continuing if no candidates
        });
      }

      trace?.success(
        `Component filtering completed: ${candidateActions.length} candidates`,
        source,
        { candidateCount: candidateActions.length }
      );

      return PipelineResult.success({
        data: { candidateActions },
      });
    } catch (error) {
      // Build error context using the error context builder
      const errorContext = this.#errorContextBuilder.buildErrorContext({
        error,
        actionDef: { id: 'candidateRetrieval', name: 'Candidate Retrieval' },
        actorId: actor.id,
        phase: 'discovery',
        trace,
        additionalContext: {
          stage: 'component_filtering',
        },
      });

      this.#logger.error(
        `Error retrieving candidate actions: ${error.message}`,
        error
      );

      return PipelineResult.failure([errorContext]);
    }
  }

  /**
   * Check if the trace is an ActionAwareStructuredTrace
   *
   * @private
   * @param {any} trace - The trace object to check
   * @returns {boolean} True if trace is action-aware
   */
  #isActionAwareTrace(trace) {
    return trace && typeof trace.captureActionData === 'function';
  }

  /**
   * Capture component analysis data for action tracing
   *
   * @private
   * @param {import('../../tracing/actionAwareStructuredTrace.js').default} trace - The action-aware trace
   * @param {object} actionDef - The action definition
   * @param {string} actorId - The actor ID
   * @param {string[]} actorComponents - The actor's components
   * @param {boolean} passed - Whether the action passed filtering
   * @returns {Promise<void>}
   */
  async #captureComponentAnalysis(
    trace,
    actionDef,
    actorId,
    actorComponents,
    passed
  ) {
    try {
      // Extract requirements from action definition
      // Note: Actual structure uses required_components.actor format
      const requiredComponents = actionDef.required_components?.actor || [];
      const forbiddenComponents = actionDef.forbidden_components?.actor || [];

      // Analyze why this action passed/failed
      const missingRequired = requiredComponents.filter(
        (comp) => !actorComponents.includes(comp)
      );
      const hasForbidden = forbiddenComponents.filter((comp) =>
        actorComponents.includes(comp)
      );

      const traceData = {
        stage: 'component_filtering',
        actorId,
        actorComponents: [...actorComponents],
        requiredComponents: [...requiredComponents],
        forbiddenComponents: [...forbiddenComponents],
        componentMatchPassed: passed,
        missingComponents: missingRequired,
        forbiddenComponentsPresent: hasForbidden,
        analysisMethod: 'post-processing', // Indicate we analyzed after filtering
        timestamp: Date.now(),
      };

      await trace.captureActionData(
        'component_filtering',
        actionDef.id,
        traceData
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to capture component analysis for action '${actionDef.id}': ${error.message}`
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
   * @returns {Promise<void>}
   */
  async #capturePerformanceData(
    trace,
    actionDef,
    startTime,
    endTime,
    totalCandidates
  ) {
    try {
      if (trace && trace.captureActionData) {
        await trace.captureActionData('stage_performance', actionDef.id, {
          stage: 'component_filtering',
          duration: endTime - startTime,
          timestamp: Date.now(),
          itemsProcessed: totalCandidates,
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

export default ComponentFilteringStage;
