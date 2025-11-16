/**
 * @file ConditionalStepExecutor - Executes conditional branching steps from refinement methods
 * @see ../../services/contextAssemblyService.js
 * @see ../../../logic/jsonLogicEvaluationService.js
 * @see ./primitiveActionStepExecutor.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import StepExecutionError from '../../errors/stepExecutionError.js';

/**
 * Executes conditional steps from GOAP refinement methods.
 *
 * Responsibilities:
 * - Evaluate JSON Logic conditions with assembled context
 * - Execute thenSteps on truthy conditions
 * - Execute elseSteps on falsy conditions (if present)
 * - Support nested conditionals up to 3 levels deep
 * - Handle onFailure modes (fail, skip, replan)
 * - Aggregate results from branch execution
 * - Provide diagnostic logging for debugging
 *
 * Nesting Depth:
 * - Level 1: Direct conditional in refinement method
 * - Level 2: Conditional nested within another conditional
 * - Level 3: Deepest allowed nesting
 * - Level 4+: Throws StepExecutionError
 */
class ConditionalStepExecutor {
  #contextAssemblyService;
  #primitiveActionStepExecutor;
  #conditionalStepExecutor; // Self-reference for nested conditionals
  #jsonLogicService;
  #logger;

  // Maximum allowed nesting depth per GOAPIMPL-013 spec
  static MAX_NESTING_DEPTH = 3;

  /**
   * Creates a new ConditionalStepExecutor instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.contextAssemblyService - Assembles context for condition evaluation
   * @param {object} dependencies.primitiveActionStepExecutor - Executes primitive action steps
   * @param {object} dependencies.conditionalStepExecutor - Self-reference for nested conditionals
   * @param {object} dependencies.jsonLogicService - Evaluates JSON Logic expressions
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({
    contextAssemblyService,
    primitiveActionStepExecutor,
    conditionalStepExecutor,
    jsonLogicService,
    jsonLogicEvaluationService,
    logger,
  }) {
    validateDependency(
      contextAssemblyService,
      'IContextAssemblyService',
      logger,
      {
        requiredMethods: ['assembleConditionContext'],
      }
    );
    validateDependency(
      primitiveActionStepExecutor,
      'IPrimitiveActionStepExecutor',
      logger,
      {
        requiredMethods: ['execute'],
      }
    );
    const nestedExecutor = conditionalStepExecutor ?? this;

    if (conditionalStepExecutor) {
      validateDependency(
        conditionalStepExecutor,
        'IConditionalStepExecutor',
        logger,
        {
          requiredMethods: ['execute'],
        }
      );
    }
    const logicService = jsonLogicService ?? jsonLogicEvaluationService;

    validateDependency(logicService, 'JsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#contextAssemblyService = contextAssemblyService;
    this.#primitiveActionStepExecutor = primitiveActionStepExecutor;
    this.#conditionalStepExecutor = nestedExecutor;
    this.#jsonLogicService = logicService;
    this.#logger = logger;
  }

  /**
   * Execute a conditional step from a refinement method.
   *
   * Execution flow:
   * 1. Validate nesting depth (max 3 levels)
   * 2. Assemble condition context
   * 3. Evaluate condition via JSON Logic
   * 4. Select branch (thenSteps or elseSteps)
   * 5. Execute branch steps sequentially
   * 6. Handle failures per onFailure mode
   * 7. Build aggregate result
   * 8. Return result
   *
   * @param {object} step - ConditionalStep from refinement method schema
   * @param {string} step.stepType - Must be 'conditional'
   * @param {object} step.condition - JSON Logic expression
   * @param {Array<object>} step.thenSteps - Steps to execute if condition is truthy
   * @param {Array<object>} [step.elseSteps] - Steps to execute if condition is falsy (optional)
   * @param {string} [step.onFailure] - Failure handling mode: 'fail', 'skip', or 'replan' (defaults to 'replan')
   * @param {string} [step.description] - Human-readable description for logging
   * @param {object} context - Execution context
   * @param {object} context.task - Task object with params
   * @param {object} context.refinement - Refinement object with localState
   * @param {object} context.actor - Actor entity data
   * @param {object} context.world - World state
   * @param {number} stepIndex - Step index for debugging/logging
   * @param {number} [currentDepth] - Current nesting depth for recursion (defaults to 0)
   * @returns {Promise<object>} Execution result with success/failure status
   * @throws {StepExecutionError} If nesting depth exceeds maximum or step validation fails
   */
  async execute(step, context, stepIndex, currentDepth = 0) {
    const description = step.description || 'unnamed conditional';

    this.#logger.debug(
      `Executing conditional step ${stepIndex} at depth ${currentDepth}: ${description}`,
      {
        stepIndex,
        currentDepth,
        description,
        hasElseSteps: Boolean(step.elseSteps && step.elseSteps.length > 0),
        onFailure: step.onFailure || 'replan',
      }
    );

    try {
      // 1. Validate nesting depth
      this.#validateNestingDepth(currentDepth, stepIndex, description);

      // 2. Assemble condition context
      const conditionContext = this.#assembleConditionContext(
        context,
        stepIndex
      );

      // 3. Evaluate condition
      const conditionResult = this.#evaluateCondition(
        step.condition,
        conditionContext,
        stepIndex,
        description
      );

      // 4. Select branch
      const selectedBranch = this.#selectBranch(
        step,
        conditionResult,
        stepIndex,
        description
      );

      // 5. Execute branch steps sequentially
      const branchResults = await this.#executeBranchSteps(
        selectedBranch,
        context,
        stepIndex,
        currentDepth,
        description
      );

      // 6. Check for failures and handle per onFailure mode
      const failedResult = branchResults.find((r) => !r.success);
      if (failedResult) {
        return this.#handleStepFailure(
          step,
          failedResult,
          stepIndex,
          description
        );
      }

      // 7. Build aggregate result
      const result = this.#buildAggregateResult(
        branchResults,
        conditionResult,
        stepIndex,
        description
      );

      // 8. Return result
      this.#logger.info(
        `Conditional step ${stepIndex} completed: ${description}`,
        {
          success: result.success,
          conditionResult,
          branchStepsExecuted: branchResults.length,
        }
      );

      return result;
    } catch (error) {
      // Handle execution failures gracefully
      this.#logger.error(
        `Conditional step ${stepIndex} failed: ${description}`,
        error
      );

      // For StepExecutionError, re-throw to preserve error context
      if (error instanceof StepExecutionError) {
        throw error;
      }

      // Wrap other errors
      const failureResult = {
        success: false,
        data: {},
        error: error.message || 'Unknown error during conditional execution',
        timestamp: Date.now(),
        stepType: 'conditional',
        description,
      };

      return failureResult;
    }
  }

  /**
   * Validate nesting depth does not exceed maximum allowed.
   *
   * @private
   * @param {number} currentDepth - Current nesting depth
   * @param {number} stepIndex - Step index for error messages
   * @param {string} description - Step description for error messages
   * @throws {StepExecutionError} If depth exceeds maximum
   */
  #validateNestingDepth(currentDepth, stepIndex, description) {
    if (currentDepth >= ConditionalStepExecutor.MAX_NESTING_DEPTH) {
      throw new StepExecutionError(
        `Conditional nesting depth limit exceeded (max ${ConditionalStepExecutor.MAX_NESTING_DEPTH}) at step ${stepIndex}: ${description}`,
        {
          currentDepth,
          maxDepth: ConditionalStepExecutor.MAX_NESTING_DEPTH,
          stepIndex,
          description,
        }
      );
    }
  }

  /**
   * Assemble condition context for JSON Logic evaluation.
   *
   * @private
   * @param {object} context - Execution context
   * @param {number} stepIndex - Step index for logging
   * @returns {object} Assembled condition context
   */
  #assembleConditionContext(context, stepIndex) {
    this.#logger.debug(
      `Assembling condition context for step ${stepIndex}`,
      {
        hasTask: Boolean(context.task),
        hasRefinement: Boolean(context.refinement),
        hasActor: Boolean(context.actor),
        hasWorld: Boolean(context.world),
      }
    );

    const conditionContext =
      this.#contextAssemblyService.assembleConditionContext(context);

    this.#logger.debug(
      `Condition context assembled for step ${stepIndex}`,
      {
        contextKeys: Object.keys(conditionContext),
      }
    );

    return conditionContext;
  }

  /**
   * Evaluate condition using JSON Logic.
   * Treats evaluation errors as falsy per GOAPIMPL-013 spec.
   *
   * @private
   * @param {object} condition - JSON Logic expression
   * @param {object} conditionContext - Assembled context
   * @param {number} stepIndex - Step index for logging
   * @param {string} description - Step description for logging
   * @returns {boolean} Condition result (truthy/falsy)
   */
  #evaluateCondition(condition, conditionContext, stepIndex, description) {
    try {
      this.#logger.debug(
        `Evaluating condition for step ${stepIndex}: ${description}`,
        {
          condition,
          contextKeys: Object.keys(conditionContext),
        }
      );

      const result = this.#jsonLogicService.evaluate(
        condition,
        conditionContext
      );

      const isTruthy = Boolean(result);

      this.#logger.debug(
        `Condition evaluated for step ${stepIndex}: ${isTruthy ? 'truthy' : 'falsy'}`,
        {
          result,
          isTruthy,
          stepIndex,
        }
      );

      return isTruthy;
    } catch (error) {
      // Per GOAPIMPL-013 lines 336-340: treat evaluation errors as falsy
      this.#logger.error(
        `Condition evaluation failed for step ${stepIndex}, treating as falsy: ${description}`,
        {
          condition,
          context: conditionContext,
          error: error.message,
          stepIndex,
        }
      );

      return false; // Treat as falsy per spec
    }
  }

  /**
   * Select branch to execute based on condition result.
   *
   * @private
   * @param {object} step - Conditional step
   * @param {boolean} conditionResult - Condition evaluation result
   * @param {number} stepIndex - Step index for logging
   * @param {string} description - Step description for logging
   * @returns {Array<object>} Selected branch steps (may be empty)
   */
  #selectBranch(step, conditionResult, stepIndex, description) {
    const selectedBranch = conditionResult
      ? step.thenSteps
      : step.elseSteps || [];

    this.#logger.debug(
      `Selected ${conditionResult ? 'then' : 'else'} branch for step ${stepIndex}: ${description}`,
      {
        conditionResult,
        branchType: conditionResult ? 'then' : 'else',
        branchStepCount: selectedBranch.length,
        stepIndex,
      }
    );

    return selectedBranch;
  }

  /**
   * Execute all steps in selected branch sequentially.
   *
   * @private
   * @param {Array<object>} branchSteps - Steps to execute
   * @param {object} context - Execution context
   * @param {number} parentStepIndex - Parent step index
   * @param {number} currentDepth - Current nesting depth
   * @param {string} _parentDescription - Parent step description (unused, kept for API consistency)
   * @returns {Promise<Array<object>>} Array of step results
   */
  async #executeBranchSteps(
    branchSteps,
    context,
    parentStepIndex,
    currentDepth,
    _parentDescription
  ) {
    const results = [];

    for (let i = 0; i < branchSteps.length; i++) {
      const branchStep = branchSteps[i];
      const subStepIndex = this.#calculateSubStepIndex(
        parentStepIndex,
        currentDepth,
        i
      );

      this.#logger.debug(
        `Executing branch step ${subStepIndex} (${i + 1}/${branchSteps.length}) of parent step ${parentStepIndex}`,
        {
          stepType: branchStep.stepType,
          parentStepIndex,
          subStepIndex,
          currentDepth,
        }
      );

      const result = await this.#dispatchStep(
        branchStep,
        context,
        subStepIndex,
        currentDepth
      );

      results.push(result);

      // Early exit if step failed - failure handling done by caller
      if (!result.success) {
        this.#logger.warn(
          `Branch step ${subStepIndex} failed, stopping branch execution`,
          {
            subStepIndex,
            parentStepIndex,
            stepType: branchStep.stepType,
          }
        );
        break;
      }
    }

    return results;
  }

  /**
   * Dispatch step to appropriate executor based on step type.
   *
   * @private
   * @param {object} branchStep - Step to execute
   * @param {object} context - Execution context
   * @param {number} stepIndex - Step index
   * @param {number} currentDepth - Current nesting depth
   * @returns {Promise<object>} Step execution result
   * @throws {StepExecutionError} If step type is unknown
   */
  async #dispatchStep(branchStep, context, stepIndex, currentDepth) {
    if (branchStep.stepType === 'primitive_action') {
      return await this.#primitiveActionStepExecutor.execute(
        branchStep,
        context,
        stepIndex
      );
    } else if (branchStep.stepType === 'conditional') {
      // Recursive call for nested conditionals
      return await this.#conditionalStepExecutor.execute(
        branchStep,
        context,
        stepIndex,
        currentDepth + 1 // Increment depth for nesting tracking
      );
    } else {
      throw new StepExecutionError(
        `Unknown step type: ${branchStep.stepType} at step ${stepIndex}`,
        {
          stepType: branchStep.stepType,
          stepIndex,
          supportedTypes: ['primitive_action', 'conditional'],
        }
      );
    }
  }

  /**
   * Calculate sub-step index for nested steps.
   * Uses simple incrementing counter for simplicity.
   *
   * @private
   * @param {number} parentStepIndex - Parent step index
   * @param {number} currentDepth - Current nesting depth
   * @param {number} branchStepIndex - Index within branch
   * @returns {number} Sub-step index
   */
  #calculateSubStepIndex(parentStepIndex, currentDepth, branchStepIndex) {
    // Simple incrementing counter: parentIndex + depth offset + branch offset
    return parentStepIndex + (currentDepth + 1) * 100 + branchStepIndex + 1;
  }

  /**
   * Handle step failure according to onFailure mode.
   *
   * @private
   * @param {object} step - Conditional step
   * @param {object} failedResult - Failed step result
   * @param {number} stepIndex - Step index
   * @param {string} description - Step description
   * @returns {object} Failure result based on onFailure mode
   * @throws {StepExecutionError} If onFailure mode is 'fail'
   */
  #handleStepFailure(step, failedResult, stepIndex, description) {
    const onFailure = step.onFailure || 'replan';

    this.#logger.warn(
      `Conditional step ${stepIndex} branch failed, handling with mode: ${onFailure}`,
      {
        stepIndex,
        description,
        onFailure,
        failedStepError: failedResult.error,
      }
    );

    switch (onFailure) {
      case 'fail':
        throw new StepExecutionError(
          `Conditional step ${stepIndex} failed with onFailure=fail: ${description}`,
          {
            stepIndex,
            description,
            onFailure,
            failedResult,
          }
        );

      case 'skip':
        this.#logger.warn(
          `Conditional step ${stepIndex} failed, skipping (onFailure=skip): ${description}`,
          {
            stepIndex,
            description,
          }
        );
        return this.#buildSkipResult(stepIndex, description, failedResult);

      case 'replan':
      default:
        this.#logger.info(
          `Conditional step ${stepIndex} failed, requesting replan (onFailure=replan): ${description}`,
          {
            stepIndex,
            description,
          }
        );
        return this.#buildReplanResult(stepIndex, description, failedResult);
    }
  }

  /**
   * Build aggregate result from branch step results.
   *
   * @private
   * @param {Array<object>} branchResults - Results from branch execution
   * @param {boolean} conditionResult - Condition evaluation result
   * @param {number} stepIndex - Step index
   * @param {string} description - Step description
   * @returns {object} Aggregate result
   */
  #buildAggregateResult(branchResults, conditionResult, stepIndex, description) {
    const allSuccessful = branchResults.every((r) => r.success);

    const aggregateData = {
      conditionResult,
      branchStepCount: branchResults.length,
      branchResults: branchResults.map((r) => ({
        success: r.success,
        data: r.data,
        error: r.error,
      })),
    };

    return {
      success: allSuccessful,
      data: aggregateData,
      error: allSuccessful ? null : 'One or more branch steps failed',
      timestamp: Date.now(),
      stepType: 'conditional',
      description,
    };
  }

  /**
   * Build skip result for onFailure=skip mode.
   *
   * @private
   * @param {number} stepIndex - Step index
   * @param {string} description - Step description
   * @param {object} failedResult - Failed step result
   * @returns {object} Skip result
   */
  #buildSkipResult(stepIndex, description, failedResult) {
    return {
      success: true, // Treated as success per skip semantics
      data: {
        skipped: true,
        reason: 'Branch step failed with onFailure=skip',
        originalError: failedResult.error,
      },
      error: null,
      timestamp: Date.now(),
      stepType: 'conditional',
      description,
    };
  }

  /**
   * Build replan result for onFailure=replan mode.
   *
   * @private
   * @param {number} stepIndex - Step index
   * @param {string} description - Step description
   * @param {object} failedResult - Failed step result
   * @returns {object} Replan result
   */
  #buildReplanResult(stepIndex, description, failedResult) {
    return {
      success: false,
      data: {
        replanRequested: true,
        reason: 'Branch step failed with onFailure=replan',
        originalError: failedResult.error,
      },
      error: failedResult.error,
      timestamp: Date.now(),
      stepType: 'conditional',
      description,
    };
  }
}

export default ConditionalStepExecutor;
