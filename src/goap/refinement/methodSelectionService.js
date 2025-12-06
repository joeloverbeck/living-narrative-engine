/**
 * @file Method selection service for GOAP task refinement.
 * @description Evaluates refinement method applicability conditions and selects
 * the first applicable method for decomposing abstract planning tasks into
 * executable primitive actions.
 * @see docs/goap/refinement-condition-context.md
 * @see tickets/GOAPIMPL-011-method-selection-algorithm.md
 */

import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import MethodSelectionError from '../errors/methodSelectionError.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').IGameDataRepository} IGameDataRepository
 * @typedef {import('../services/contextAssemblyService.js').default} IContextAssemblyService
 * @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService
 */

/**
 * @typedef {object} MethodEvaluationResult
 * @property {string} methodId - Method identifier
 * @property {boolean} applicable - Whether method is applicable
 * @property {string} reason - Explanation of applicability status
 */

/**
 * @typedef {object} SelectionDiagnostics
 * @property {number} methodsEvaluated - Number of methods evaluated
 * @property {MethodEvaluationResult[]} evaluationResults - Detailed evaluation results
 */

/**
 * @typedef {object} MethodSelectionResult
 * @property {object|null} selectedMethod - Selected method data or null if none applicable
 * @property {SelectionDiagnostics} diagnostics - Selection diagnostics for debugging
 */

/**
 * Service for selecting applicable refinement methods during GOAP task execution.
 *
 * Evaluates refinement method applicability conditions in sequential order and
 * returns the first method with satisfied conditions. This service implements
 * the method selection algorithm that bridges GOAP planning tasks to primitive
 * action execution.
 *
 * Selection Algorithm:
 * 1. Load task definition from GameDataRepository
 * 2. Iterate through task's refinement methods in order
 * 3. For each method:
 *    - If no applicability condition exists → select (always applicable)
 *    - If applicability condition exists → evaluate with JSON Logic
 *    - If condition evaluates true → select (short-circuit)
 *    - If condition evaluates false → continue to next method
 *    - If evaluation error → log warning, treat as "not applicable", continue
 * 4. If no methods applicable → return null (valid outcome, not error)
 *
 * @class
 */
class MethodSelectionService {
  /** @type {IGameDataRepository} */
  #gameDataRepository;

  /** @type {IContextAssemblyService} */
  #contextAssemblyService;

  /** @type {JsonLogicEvaluationService} */
  #jsonLogicService;

  /** @type {ILogger} */
  #logger;

  /**
   * Creates a new Method Selection Service instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {IGameDataRepository} dependencies.gameDataRepository - Game data access
   * @param {IContextAssemblyService} dependencies.contextAssemblyService - Context assembly
   * @param {JsonLogicEvaluationService} dependencies.jsonLogicService - JSON Logic evaluation
   * @param dependencies.jsonLogicEvaluationService
   * @param {ILogger} dependencies.logger - Logging service
   */
  constructor({
    gameDataRepository,
    contextAssemblyService,
    jsonLogicService,
    jsonLogicEvaluationService,
    logger,
  }) {
    validateDependency(gameDataRepository, 'IGameDataRepository', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(
      contextAssemblyService,
      'IContextAssemblyService',
      logger,
      {
        requiredMethods: [
          'assembleRefinementContext',
          'assembleConditionContext',
        ],
      }
    );
    const logicService = jsonLogicService ?? jsonLogicEvaluationService;

    validateDependency(logicService, 'JsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#gameDataRepository = gameDataRepository;
    this.#contextAssemblyService = contextAssemblyService;
    this.#jsonLogicService = logicService;
    this.#logger = logger;
  }

  /**
   * Selects the first applicable refinement method for a task.
   *
   * @param {string} taskId - Task ID (e.g., "core:consume_nourishing_item")
   * @param {string} actorId - Actor entity ID
   * @param {object} taskParams - Task parameters with resolved entity references
   * @param {object} options - Selection options
   * @param {boolean} options.enableDiagnostics - Enable detailed diagnostics
   * @returns {MethodSelectionResult} Selection result with method and diagnostics
   * @throws {MethodSelectionError} If task not found or method loading fails
   */
  selectMethod(taskId, actorId, taskParams, options = {}) {
    const { enableDiagnostics = true } = options;

    // Validate inputs
    assertNonBlankString(taskId, 'taskId', 'selectMethod', this.#logger);
    assertNonBlankString(actorId, 'actorId', 'selectMethod', this.#logger);

    if (!taskParams || typeof taskParams !== 'object') {
      throw new MethodSelectionError(
        'Task parameters must be provided as an object',
        {
          taskId,
          actorId,
          reason: 'Invalid or missing task parameters',
        }
      );
    }

    this.#logger.debug(
      `[MethodSelection] Selecting method for task '${taskId}'`,
      {
        taskId,
        actorId,
        taskParams,
      }
    );

    // Load task definition
    const task = this.#loadTask(taskId);

    // Check if task has refinement methods
    if (!task.refinementMethods || task.refinementMethods.length === 0) {
      this.#logger.warn(
        `[MethodSelection] Task '${taskId}' has no refinement methods defined`
      );
      return {
        selectedMethod: null,
        diagnostics: {
          methodsEvaluated: 0,
          evaluationResults: [],
        },
      };
    }

    // Evaluate methods in order
    const evaluationResults = [];
    let selectedMethod = null;

    for (const methodRef of task.refinementMethods) {
      const { methodId, $ref } = methodRef;

      // Load method data from $ref path
      const methodData = this.#loadMethodData(methodId, $ref, taskId);

      // Evaluate applicability
      const evaluationResult = this.#evaluateMethodApplicability(
        methodData,
        taskId,
        actorId,
        taskParams
      );

      if (enableDiagnostics) {
        evaluationResults.push(evaluationResult);
      }

      if (evaluationResult.applicable) {
        selectedMethod = methodData;
        this.#logger.debug(
          `[MethodSelection] Selected method '${methodId}' for task '${taskId}'`
        );
        break; // Short-circuit: stop after first applicable method
      }
    }

    if (!selectedMethod) {
      this.#logger.debug(
        `[MethodSelection] No applicable methods found for task '${taskId}'`
      );
    }

    return {
      selectedMethod,
      diagnostics: {
        methodsEvaluated: evaluationResults.length,
        evaluationResults,
      },
    };
  }

  /**
   * Loads task definition from GameDataRepository.
   *
   * @private
   * @param {string} taskId - Task ID to load
   * @returns {object} Task definition
   * @throws {MethodSelectionError} If task not found
   */
  #loadTask(taskId) {
    const tasks = this.#gameDataRepository.get('tasks');

    if (!tasks || typeof tasks !== 'object') {
      throw new MethodSelectionError(`Task registry not available`, {
        taskId,
        reason: 'Task registry not initialized',
      });
    }

    const task = tasks[taskId];

    if (!task) {
      throw new MethodSelectionError(
        `Task '${taskId}' not found in game data`,
        {
          taskId,
          reason: 'Task definition not loaded',
        }
      );
    }

    return task;
  }

  /**
   * Loads refinement method data from its $ref path.
   *
   * @private
   * @param {string} methodId - Method identifier
   * @param {string} refPath - $ref path to method file
   * @param {string} taskId - Parent task ID for error context
   * @throws {MethodSelectionError} If method data cannot be loaded
   */
  #loadMethodData(methodId, refPath, taskId) {
    // Load refinement method from GameDataRepository
    // Methods are loaded by RefinementMethodLoader during mod loading phase
    const methods = this.#gameDataRepository.get('refinement-methods');

    if (!methods || typeof methods !== 'object') {
      throw new MethodSelectionError(
        `Refinement method registry not available`,
        {
          taskId,
          methodId,
          refPath,
          reason:
            'Method registry not initialized - ensure mod loading completed successfully',
        }
      );
    }

    // Methods are stored in registry with their full qualified ID
    const method = methods[methodId];

    if (!method) {
      throw new MethodSelectionError(
        `Refinement method '${methodId}' not found in registry`,
        {
          taskId,
          methodId,
          refPath,
          reason: 'Method not loaded or $ref path incorrect',
          availableMethods: Object.keys(methods).filter((id) =>
            id.startsWith(taskId.split(':')[1])
          ),
        }
      );
    }

    // Validate that loaded method matches expected taskId
    if (method.taskId !== taskId) {
      throw new MethodSelectionError(
        `Refinement method '${methodId}' taskId mismatch: expected '${taskId}', got '${method.taskId}'`,
        {
          taskId,
          methodId,
          refPath,
          actualTaskId: method.taskId,
          reason: 'Method definition taskId does not match requested task',
        }
      );
    }

    this.#logger.debug(
      `[MethodSelection] Loaded refinement method '${methodId}' for task '${taskId}'`,
      {
        methodId,
        taskId,
        hasApplicability: !!method.applicability,
        stepCount: method.steps?.length || 0,
      }
    );

    return method;
  }

  /**
   * Evaluates a method's applicability condition.
   *
   * @private
   * @param {object} methodData - Method definition
   * @param {string} taskId - Task ID
   * @param {string} actorId - Actor entity ID
   * @param {object} taskParams - Task parameters
   * @returns {MethodEvaluationResult} Evaluation result
   */
  #evaluateMethodApplicability(methodData, taskId, actorId, taskParams) {
    const methodId = methodData.id;

    // If no applicability field, method is always applicable
    if (!methodData.applicability) {
      return {
        methodId,
        applicable: true,
        reason: 'No applicability condition (always applicable)',
      };
    }

    const { condition } = methodData.applicability;

    // If applicability exists but no condition, treat as always applicable
    if (!condition) {
      return {
        methodId,
        applicable: true,
        reason: 'Applicability defined but no condition (always applicable)',
      };
    }

    try {
      // Assemble refinement context for condition evaluation
      const refinementContext =
        this.#contextAssemblyService.assembleRefinementContext(
          actorId,
          { id: taskId, params: taskParams }, // Build task object
          {} // Empty localState during method selection
        );

      // Transform to condition context for JSON Logic
      const conditionContext =
        this.#contextAssemblyService.assembleConditionContext(
          refinementContext
        );

      // Evaluate condition
      const result = this.#jsonLogicService.evaluate(
        condition,
        conditionContext
      );

      if (result === true) {
        return {
          methodId,
          applicable: true,
          reason: 'Applicability condition evaluated to true',
        };
      } else {
        return {
          methodId,
          applicable: false,
          reason: `Applicability condition evaluated to false (result: ${result})`,
        };
      }
    } catch (error) {
      // Treat evaluation errors as "not applicable" and log warning
      this.#logger.warn(
        `[MethodSelection] Error evaluating applicability for method '${methodId}': ${error.message}`,
        {
          methodId,
          taskId,
          actorId,
          error: error.message,
        }
      );

      return {
        methodId,
        applicable: false,
        reason: `Evaluation error: ${error.message}`,
      };
    }
  }
}

export default MethodSelectionService;
