/**
 * @file Service responsible for building rich error context for action system failures.
 * @see specs/action-system-better-error-context.md
 */

import { BaseService } from '../../utils/serviceBase.js';
import { EVALUATION_STEP_TYPES } from './actionErrorTypes.js';

/** @typedef {import('./actionErrorTypes.js').ActionErrorContext} ActionErrorContext */
/** @typedef {import('./actionErrorTypes.js').ActorSnapshot} ActorSnapshot */
/** @typedef {import('./actionErrorTypes.js').EvaluationTrace} EvaluationTrace */
/** @typedef {import('./actionErrorTypes.js').EvaluationStep} EvaluationStep */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('./fixSuggestionEngine.js').FixSuggestionEngine} FixSuggestionEngine */
/** @typedef {import('../../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../tracing/traceContext.js').TraceContext} TraceContext */

/**
 * Service responsible for building rich error context.
 */
export class ActionErrorContextBuilder extends BaseService {
  #logger;
  #entityManager;
  #fixSuggestionEngine;

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   * @param {FixSuggestionEngine} dependencies.fixSuggestionEngine
   */
  constructor({ entityManager, logger, fixSuggestionEngine }) {
    super();
    this.#logger = this._init('ActionErrorContextBuilder', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getEntityInstance',
          'getAllComponentTypesForEntity',
          'getComponentData',
        ],
      },
      fixSuggestionEngine: {
        value: fixSuggestionEngine,
        requiredMethods: ['suggestFixes'],
      },
    });

    this.#entityManager = entityManager;
    this.#fixSuggestionEngine = fixSuggestionEngine;
  }

  /**
   * Builds comprehensive error context.
   *
   * @param {object} params
   * @param {Error} params.error - The original error
   * @param {ActionDefinition} params.actionDef - Action definition
   * @param {string} params.actorId - Actor entity ID
   * @param {string} params.phase - Error phase
   * @param {TraceContext} [params.trace] - Optional trace context
   * @param {string} [params.targetId] - Optional target entity ID
   * @param {object} [params.additionalContext] - Additional context data
   * @returns {ActionErrorContext}
   */
  buildErrorContext({
    error,
    actionDef,
    actorId,
    phase,
    trace = null,
    targetId = null,
    additionalContext = {},
  }) {
    const timestamp = Date.now();

    // Create actor snapshot
    const actorSnapshot = this.#createActorSnapshot(actorId);

    // Extract evaluation trace from TraceContext if available
    const evaluationTrace = trace
      ? this.#extractEvaluationTrace(trace, phase)
      : {
          steps: [],
          finalContext: {},
          failurePoint: 'Unknown',
        };

    // Get suggested fixes
    const suggestedFixes = this.#fixSuggestionEngine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      phase
    );

    // Build environment context
    const environmentContext = {
      ...additionalContext,
      errorName: error.name,
      errorStack: error.stack,
      phase,
      timestamp,
    };

    return {
      actionId: actionDef.id,
      targetId,
      error,
      actionDefinition: actionDef,
      actorSnapshot,
      evaluationTrace,
      suggestedFixes,
      environmentContext,
      timestamp,
      phase,
    };
  }

  /**
   * Creates actor snapshot.
   *
   * @private
   * @param {string} actorId
   * @returns {ActorSnapshot}
   */
  #createActorSnapshot(actorId) {
    try {
      const actorEntity = this.#entityManager.getEntityInstance(actorId);

      // Reconstruct components object from available methods
      const componentTypes =
        this.#entityManager.getAllComponentTypesForEntity(actorId);
      const components = {};
      for (const componentType of componentTypes) {
        components[componentType] = this.#entityManager.getComponentData(
          actorId,
          componentType
        );
      }

      const locationComponent = components['core:location'];
      const location = locationComponent?.value || 'none';

      return {
        id: actorId,
        components: this.#sanitizeComponents(components),
        location,
        metadata: {
          entityType: actorEntity.type || 'unknown',
          capturedAt: Date.now(),
        },
      };
    } catch (err) {
      this.#logger.warn(
        `Failed to create complete actor snapshot for ${actorId}:`,
        err
      );
      return {
        id: actorId,
        components: {},
        location: 'unknown',
        metadata: {
          error: 'Failed to capture snapshot',
          capturedAt: Date.now(),
        },
      };
    }
  }

  /**
   * Sanitizes components to remove sensitive or overly large data.
   *
   * @private
   * @param {object} components
   * @returns {object}
   */
  #sanitizeComponents(components) {
    const sanitized = {};
    const MAX_STRING_LENGTH = 1000;
    const MAX_ARRAY_LENGTH = 100;

    for (const [key, value] of Object.entries(components)) {
      try {
        // Skip very large components
        const jsonString = JSON.stringify(value);
        if (jsonString.length > 10000) {
          sanitized[key] = {
            _truncated: true,
            _reason: 'Component too large',
            _size: jsonString.length,
          };
          continue;
        }

        // Deep clone and sanitize
        sanitized[key] = this.#sanitizeValue(
          value,
          MAX_STRING_LENGTH,
          MAX_ARRAY_LENGTH
        );
      } catch (err) {
        sanitized[key] = {
          _error: true,
          _reason: 'Failed to serialize component',
        };
      }
    }

    return sanitized;
  }

  /**
   * Recursively sanitizes a value.
   *
   * @param value
   * @param maxStringLength
   * @param maxArrayLength
   * @private
   */
  #sanitizeValue(value, maxStringLength, maxArrayLength) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return value.length > maxStringLength
        ? value.substring(0, maxStringLength) + '...(truncated)'
        : value;
    }

    if (Array.isArray(value)) {
      const truncated = value.length > maxArrayLength;
      const processed = value
        .slice(0, maxArrayLength)
        .map((item) =>
          this.#sanitizeValue(item, maxStringLength, maxArrayLength)
        );
      if (truncated) {
        processed.push({ _truncated: true, _originalLength: value.length });
      }
      return processed;
    }

    if (typeof value === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.#sanitizeValue(v, maxStringLength, maxArrayLength);
      }
      return result;
    }

    return value;
  }

  /**
   * Extracts evaluation trace from TraceContext.
   *
   * @private
   * @param {TraceContext} trace
   * @param {string} phase
   * @returns {EvaluationTrace}
   */
  #extractEvaluationTrace(trace, phase) {
    const steps = [];
    let failurePoint = 'Unknown';
    let finalContext = {};

    // Convert trace logs to evaluation steps
    const startTime = trace.logs[0]?.timestamp || Date.now();

    for (const log of trace.logs) {
      const step = this.#convertLogToStep(log, startTime);
      if (step) {
        steps.push(step);

        // Track failure point
        if (!step.success && failurePoint === 'Unknown') {
          failurePoint = step.message;
        }

        // Capture final context from data logs
        if (log.type === 'data' && log.data) {
          finalContext = { ...finalContext, ...log.data };
        }
      }
    }

    return {
      steps,
      finalContext,
      failurePoint,
    };
  }

  /**
   * Converts a trace log entry to an evaluation step.
   *
   * @private
   * @param {import('../tracing/traceContext.js').TraceLogEntry} log
   * @param {number} startTime
   * @returns {EvaluationStep|null}
   */
  #convertLogToStep(log, startTime) {
    // Determine step type based on log source and message
    let stepType = EVALUATION_STEP_TYPES.VALIDATION;

    if (log.source.includes('Prerequisite')) {
      stepType = EVALUATION_STEP_TYPES.PREREQUISITE;
    } else if (
      log.source.includes('Scope') ||
      log.source.includes('Resolution')
    ) {
      stepType = EVALUATION_STEP_TYPES.SCOPE;
    } else if (log.message.includes('condition_ref')) {
      stepType = EVALUATION_STEP_TYPES.CONDITION_REF;
    } else if (log.source.includes('JsonLogic')) {
      stepType = EVALUATION_STEP_TYPES.JSON_LOGIC;
    }

    // Determine success based on log type
    const success =
      log.type === 'success' || log.type === 'info' || log.type === 'step';

    return {
      type: stepType,
      input: log.data?.input || {},
      output: log.data?.output || log.data || {},
      success,
      message: log.message,
      duration: log.timestamp - startTime,
    };
  }
}
