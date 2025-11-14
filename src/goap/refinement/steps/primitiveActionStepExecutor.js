/**
 * @file PrimitiveActionStepExecutor - Executes primitive action steps from refinement methods
 * @see ../../services/parameterResolutionService.js
 * @see ../refinementStateManager.js
 * @see ../../../logic/operationInterpreter.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import StepExecutionError from '../../errors/stepExecutionError.js';

/**
 * Executes primitive action steps from GOAP refinement methods.
 *
 * Responsibilities:
 * - Resolve action definitions from ActionIndex
 * - Bind target placeholders using ParameterResolutionService
 * - Merge step parameters with action defaults (step params override)
 * - Execute operations via OperationInterpreter
 * - Store results in RefinementStateManager if storeResultAs specified
 * - Return structured results with success/failure status
 *
 * IMPORTANT: RefinementStateManager is resolved lazily on each execute() call
 * to ensure fresh transient instances per refinement, preventing state leakage
 * between concurrent actor refinements.
 */
class PrimitiveActionStepExecutor {
  #parameterResolutionService;
  #container;
  #operationInterpreter;
  #actionIndex;
  #gameDataRepository;
  #logger;

  /**
   * Creates a new PrimitiveActionStepExecutor instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.parameterResolutionService - Resolves parameter references
   * @param {object} dependencies.container - DI container for lazy resolution of transient services
   * @param {object} dependencies.operationInterpreter - Executes operations
   * @param {object} dependencies.actionIndex - Registry of action definitions
   * @param {object} dependencies.gameDataRepository - Access to game data
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({
    parameterResolutionService,
    container,
    operationInterpreter,
    actionIndex,
    gameDataRepository,
    logger,
  }) {
    validateDependency(
      parameterResolutionService,
      'IParameterResolutionService',
      logger,
      {
        requiredMethods: ['resolve', 'clearCache'],
      }
    );
    validateDependency(container, 'IAppContainer', logger, {
      requiredMethods: ['resolve'],
    });
    validateDependency(operationInterpreter, 'IOperationInterpreter', logger, {
      requiredMethods: ['execute'],
    });
    validateDependency(actionIndex, 'IActionIndex', logger, {
      requiredMethods: ['getActionById'],
    });
    validateDependency(gameDataRepository, 'IGameDataRepository', logger, {
      requiredMethods: ['getAllActions'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#parameterResolutionService = parameterResolutionService;
    this.#container = container;
    this.#operationInterpreter = operationInterpreter;
    this.#actionIndex = actionIndex;
    this.#gameDataRepository = gameDataRepository;
    this.#logger = logger;
  }

  /**
   * Execute a primitive action step from a refinement method.
   *
   * Execution flow:
   * 0. Resolve fresh transient RefinementStateManager for this execution
   * 1. Resolve action definition from ActionIndex
   * 2. Resolve target bindings using ParameterResolutionService
   * 3. Merge step parameters with action defaults (step overrides)
   * 4. Build operation execution context
   * 5. Execute operation via OperationInterpreter
   * 6. Build structured result
   * 7. Store result in RefinementStateManager if storeResultAs specified
   * 8. Return result
   *
   * @param {object} step - PrimitiveActionStep from refinement method schema
   * @param {string} step.stepType - Must be 'primitive_action'
   * @param {string} step.actionId - Namespaced action ID (e.g., 'items:pick_up_item')
   * @param {object} [step.targetBindings] - Target placeholder bindings
   * @param {object} [step.parameters] - Step-level parameter overrides
   * @param {string} [step.storeResultAs] - Key to store result in refinement.localState
   * @param {object} context - Execution context
   * @param {object} context.task - Task object with params
   * @param {object} context.refinement - Refinement object with localState
   * @param {object} context.actor - Actor entity data
   * @param {number} stepIndex - Step index for debugging/logging
   * @returns {Promise<object>} Execution result with success/failure status
   * @throws {StepExecutionError} If step validation fails
   */
  async execute(step, context, stepIndex) {
    // 0. CRITICAL: Resolve fresh transient RefinementStateManager to prevent state leakage
    // Each execution gets its own isolated state manager instance
    const tokens = await import('../../../dependencyInjection/tokens.js');
    const refinementStateManager = this.#container.resolve(
      tokens.tokens.IRefinementStateManager
    );

    this.#logger.debug(
      `Executing primitive action step ${stepIndex}: ${step.actionId}`,
      {
        actionId: step.actionId,
        targetBindings: step.targetBindings,
        parameters: step.parameters,
        storeResultAs: step.storeResultAs,
      }
    );

    try {
      // 1. Resolve action definition from ActionIndex
      const action = this.#resolveAction(step.actionId, stepIndex);

      // 2. Resolve target bindings
      const resolvedTargets = this.#resolveTargets(
        step.targetBindings || {},
        context,
        stepIndex
      );

      // 3. Merge parameters (step overrides action defaults)
      const mergedParameters = this.#mergeParameters(
        action.parameters || {},
        step.parameters || {}
      );

      // 4. Build operation execution context
      const operationContext = this.#buildOperationContext(
        context,
        resolvedTargets,
        mergedParameters,
        step.actionId
      );

      // 5. Execute operation via OperationInterpreter
      const operationResult = await this.#executeOperation(
        action.operation,
        operationContext,
        step.actionId,
        stepIndex
      );

      // 6. Build structured result
      const result = this.#buildResult(
        operationResult,
        step.actionId,
        stepIndex
      );

      // 7. Store result if storeResultAs specified
      if (step.storeResultAs) {
        this.#storeResult(
          refinementStateManager,
          step.storeResultAs,
          result,
          stepIndex
        );
      }

      // 8. Return result
      this.#logger.info(
        `Primitive action step ${stepIndex} completed: ${step.actionId}`,
        {
          success: result.success,
          storeResultAs: step.storeResultAs,
        }
      );

      return result;
    } catch (error) {
      // Handle execution failures gracefully
      // Note: Method-level fallbackBehavior will handle failures, not step-level
      this.#logger.error(
        `Primitive action step ${stepIndex} failed: ${step.actionId}`,
        error
      );

      const failureResult = {
        success: false,
        data: {},
        error: error.message || 'Unknown error during primitive action execution',
        timestamp: Date.now(),
        actionId: step.actionId,
      };

      // Store failure result if storeResultAs specified
      if (step.storeResultAs) {
        this.#storeResult(
          refinementStateManager,
          step.storeResultAs,
          failureResult,
          stepIndex
        );
      }

      return failureResult;
    }
  }

  /**
   * Resolve action definition from ActionIndex.
   *
   * @private
   * @param {string} actionId - Namespaced action ID
   * @param {number} stepIndex - Step index for error messages
   * @returns {object} Action definition
   * @throws {StepExecutionError} If action not found
   */
  #resolveAction(actionId, stepIndex) {
    const action = this.#actionIndex.getActionById(actionId);

    if (!action) {
      throw new StepExecutionError(
        `Action not found: ${actionId} (step ${stepIndex})`,
        {
          actionId,
          stepIndex,
          availableActions: this.#gameDataRepository
            .getAllActions()
            .map((a) => a.id)
            .slice(0, 10), // First 10 for debugging
        }
      );
    }

    if (!action.operation) {
      throw new StepExecutionError(
        `Action ${actionId} has no operation defined (step ${stepIndex})`,
        {
          actionId,
          stepIndex,
          action,
        }
      );
    }

    return action;
  }

  /**
   * Resolve target bindings using ParameterResolutionService.
   *
   * @private
   * @param {object} targetBindings - Map of placeholder to reference
   * @param {object} context - Execution context
   * @param {number} stepIndex - Step index for error context
   * @returns {object} Map of placeholder to resolved entity ID
   * @throws {StepExecutionError} If target resolution fails
   */
  #resolveTargets(targetBindings, context, stepIndex) {
    const resolvedTargets = {};

    for (const [placeholder, reference] of Object.entries(targetBindings)) {
      try {
        const resolvedValue = this.#parameterResolutionService.resolve(
          reference,
          context,
          {
            validateEntity: true,
            contextType: 'primitive_action',
            stepIndex,
          }
        );

        resolvedTargets[placeholder] = resolvedValue;

        this.#logger.debug(
          `Resolved target binding: ${placeholder} = ${reference} → ${resolvedValue}`,
          {
            placeholder,
            reference,
            resolvedValue,
            stepIndex,
          }
        );
      } catch (error) {
        throw new StepExecutionError(
          `Failed to resolve target binding "${placeholder}" with reference "${reference}" (step ${stepIndex}): ${error.message}`,
          {
            placeholder,
            reference,
            stepIndex,
            originalError: error.message,
          }
        );
      }
    }

    return resolvedTargets;
  }

  /**
   * Merge step parameters with action defaults.
   * Step parameters override action defaults.
   *
   * @private
   * @param {object} actionParameters - Default parameters from action definition
   * @param {object} stepParameters - Override parameters from step
   * @returns {object} Merged parameters
   */
  #mergeParameters(actionParameters, stepParameters) {
    return {
      ...actionParameters, // Action defaults
      ...stepParameters,   // Step overrides
    };
  }

  /**
   * Build operation execution context.
   *
   * @private
   * @param {object} context - Base execution context
   * @param {object} resolvedTargets - Resolved target entity IDs
   * @param {object} mergedParameters - Merged parameters
   * @param {string} actionId - Action ID for reference
   * @returns {object} Operation execution context
   */
  #buildOperationContext(
    context,
    resolvedTargets,
    mergedParameters,
    actionId
  ) {
    return {
      ...context,                // task, refinement, actor
      targets: resolvedTargets,  // Resolved entity IDs
      parameters: mergedParameters, // Merged parameters
      actionId,                  // For debugging/logging
    };
  }

  /**
   * Execute operation via OperationInterpreter.
   *
   * @private
   * @param {object} operation - Operation definition from action
   * @param {object} operationContext - Execution context
   * @param {string} actionId - Action ID for logging
   * @param {number} stepIndex - Step index for logging
   * @returns {Promise<object>} Operation result
   */
  async #executeOperation(operation, operationContext, actionId, stepIndex) {
    this.#logger.debug(
      `Executing operation for action ${actionId} (step ${stepIndex})`,
      {
        operationType: operation.type,
        actionId,
        stepIndex,
      }
    );

    const operationResult = await this.#operationInterpreter.execute(
      operation,
      operationContext
    );

    this.#logger.debug(
      `Operation completed for action ${actionId} (step ${stepIndex})`,
      {
        success: operationResult?.success,
        actionId,
        stepIndex,
      }
    );

    return operationResult;
  }

  /**
   * Build structured result from operation result.
   * Ensures result matches RefinementStateManager validation requirements.
   *
   * @private
   * @param {object} operationResult - Result from operation execution
   * @param {string} actionId - Action ID for reference
   * @param {number} stepIndex - Step index for logging
   * @returns {object} Structured step result
   */
  #buildResult(operationResult, actionId, stepIndex) {
    // Build result structure matching RefinementStateManager validation
    const result = {
      success: Boolean(operationResult && operationResult.success),
      data: operationResult?.data || {},
      error: operationResult?.error || null,
      timestamp: Date.now(),
      actionId,
    };

    this.#logger.debug(`Built result for step ${stepIndex}`, {
      success: result.success,
      hasData: Object.keys(result.data).length > 0,
      hasError: result.error !== null,
      actionId,
      stepIndex,
    });

    return result;
  }

  /**
   * Store result in RefinementStateManager.
   *
   * @private
   * @param {object} stateManager - Fresh transient state manager instance
   * @param {string} key - Storage key
   * @param {object} result - Result to store
   * @param {number} stepIndex - Step index for logging
   */
  #storeResult(stateManager, key, result, stepIndex) {
    this.#logger.debug(
      `Storing result for step ${stepIndex} with key: ${key}`,
      {
        key,
        success: result.success,
        stepIndex,
      }
    );

    stateManager.store(key, result);
  }
}

export default PrimitiveActionStepExecutor;
