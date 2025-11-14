/**
 * @file RefinementEngine - Orchestrates the complete refinement process
 * The RefinementEngine is the main entry point for task-to-action decomposition.
 * It coordinates method selection, step execution, state management, and event dispatching.
 * Workflow:
 * 1. Load task definition
 * 2. Select applicable refinement method
 * 3. Initialize refinement state
 * 4. Execute method steps sequentially
 * 5. Handle failures per fallbackBehavior
 * 6. Dispatch lifecycle events
 * 7. Return step execution results
 * @see specs/goap-system-specs.md lines 163-195 for refinement pipeline
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import RefinementError from '../errors/refinementError.js';

/**
 * Orchestrates task refinement into executable action sequences.
 *
 * The engine transforms abstract planning tasks into concrete step execution results
 * by coordinating method selection, state management, and step execution.
 */
class RefinementEngine {
  #methodSelectionService;
  #container;
  #primitiveActionStepExecutor;
  #conditionalStepExecutor;
  #contextAssemblyService;
  #gameDataRepository;
  #eventBus;
  #logger;

  /**
   * Creates a new RefinementEngine instance.
   *
   * @param {object} dependencies - Required services
   * @param {object} dependencies.methodSelectionService - IMethodSelectionService
   * @param {object} dependencies.container - AppContainer (for lazy IRefinementStateManager resolution)
   * @param {object} dependencies.primitiveActionStepExecutor - IPrimitiveActionStepExecutor
   * @param {object} dependencies.conditionalStepExecutor - IConditionalStepExecutor
   * @param {object} dependencies.contextAssemblyService - IContextAssemblyService
   * @param {object} dependencies.gameDataRepository - GameDataRepository
   * @param {object} dependencies.eventBus - IEventBus
   * @param {object} dependencies.logger - ILogger
   */
  constructor({
    methodSelectionService,
    container,
    primitiveActionStepExecutor,
    conditionalStepExecutor,
    contextAssemblyService,
    gameDataRepository,
    eventBus,
    logger,
  }) {
    validateDependency(
      methodSelectionService,
      'IMethodSelectionService',
      logger,
      {
        requiredMethods: ['selectMethod'],
      }
    );
    validateDependency(container, 'AppContainer', logger, {
      requiredMethods: ['resolve'],
    });
    validateDependency(
      primitiveActionStepExecutor,
      'IPrimitiveActionStepExecutor',
      logger,
      {
        requiredMethods: ['execute'],
      }
    );
    validateDependency(
      conditionalStepExecutor,
      'IConditionalStepExecutor',
      logger,
      {
        requiredMethods: ['execute'],
      }
    );
    validateDependency(
      contextAssemblyService,
      'IContextAssemblyService',
      logger,
      {
        requiredMethods: ['assembleRefinementContext'],
      }
    );
    validateDependency(gameDataRepository, 'GameDataRepository', logger, {
      requiredMethods: ['getTask'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#methodSelectionService = methodSelectionService;
    this.#container = container;
    this.#primitiveActionStepExecutor = primitiveActionStepExecutor;
    this.#conditionalStepExecutor = conditionalStepExecutor;
    this.#contextAssemblyService = contextAssemblyService;
    this.#gameDataRepository = gameDataRepository;
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  /**
   * Refine a task into step execution results.
   *
   * This is the main entry point for the refinement process. It coordinates:
   * - Method selection from task's refinementMethods
   * - Step-by-step execution with state accumulation
   * - Fallback behavior handling on failures
   * - Event dispatching for refinement lifecycle
   *
   * @param {string} taskId - Task identifier (e.g., "core:consume_nourishing_item")
   * @param {string} actorId - Actor entity ID performing the task
   * @param {object} taskParams - Resolved task parameters (e.g., {item: "item_7"})
   * @returns {Promise<object>} Refinement result
   *   - success: boolean - Whether refinement succeeded
   *   - stepResults: Array<object> - Results from each step execution
   *   - methodId: string - ID of selected refinement method
   *   - taskId: string - Original task ID
   *   - actorId: string - Actor who performed refinement
   *   - timestamp: number - Completion timestamp
   *   - replan: boolean (optional) - Whether replanning is requested
   *   - skipped: boolean (optional) - Whether task was skipped
   *   - error: string (optional) - Error message if failed
   * @throws {RefinementError} If fallbackBehavior is 'fail' and refinement cannot proceed
   */
  async refine(taskId, actorId, taskParams) {
    const startTime = Date.now();

    this.#logger.info('Starting task refinement', {
      taskId,
      actorId,
      params: taskParams,
    });

    // Dispatch refinement started event
    this.#eventBus.dispatch({
      type: 'GOAP_REFINEMENT_STARTED',
      payload: {
        taskId,
        actorId,
        timestamp: startTime,
      },
    });

    try {
      // Load task definition
      const task = this.#loadTask(taskId);

      // Select applicable refinement method
      const { selectedMethod, diagnostics } =
        this.#methodSelectionService.selectMethod(
          taskId,
          actorId,
          taskParams,
          { enableDiagnostics: true }
        );

      // Handle no applicable method
      if (!selectedMethod) {
        this.#logger.debug('No applicable method found', {
          taskId,
          diagnostics,
        });
        return this.#handleNoApplicableMethod(
          task,
          actorId,
          diagnostics
        );
      }

      this.#logger.info('Method selected for refinement', {
        taskId,
        methodId: selectedMethod.id,
        stepCount: selectedMethod.steps.length,
      });

      // Dispatch method selected event
      this.#eventBus.dispatch({
        type: 'GOAP_METHOD_SELECTED',
        payload: {
          taskId,
          methodId: selectedMethod.id,
          actorId,
        },
      });

      // Execute method steps with state management
      const stepResults = await this.#executeMethodSteps(
        selectedMethod,
        task,
        actorId,
        taskParams
      );

      // Dispatch refinement completed event
      this.#eventBus.dispatch({
        type: 'GOAP_REFINEMENT_COMPLETED',
        payload: {
          taskId,
          methodId: selectedMethod.id,
          actorId,
          stepsExecuted: stepResults.length,
          success: true,
        },
      });

      this.#logger.info('Task refinement completed', {
        taskId,
        methodId: selectedMethod.id,
        stepsExecuted: stepResults.length,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        stepResults,
        methodId: selectedMethod.id,
        taskId,
        actorId,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.#logger.error('Task refinement failed', error, {
        taskId,
        actorId,
      });

      // Dispatch refinement failed event
      this.#eventBus.dispatch({
        type: 'GOAP_REFINEMENT_FAILED',
        payload: {
          taskId,
          actorId,
          reason: error.message,
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * Load task definition from repository.
   *
   * @param {string} taskId - Task identifier
   * @returns {object} Task definition
   * @throws {RefinementError} If task not found
   * @private
   */
  #loadTask(taskId) {
    try {
      const task = this.#gameDataRepository.getTask(taskId);
      if (!task) {
        throw new RefinementError(
          `Task not found: ${taskId}`,
          'TASK_NOT_FOUND'
        );
      }
      return task;
    } catch (error) {
      if (error instanceof RefinementError) {
        throw error;
      }
      throw new RefinementError(
        `Failed to load task: ${error.message}`,
        'TASK_LOAD_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Handle case when no applicable method is found.
   *
   * Uses task's fallbackBehavior to determine next action:
   * - 'replan': Signal planner to replan
   * - 'fail': Throw error and fail task
   * - 'continue': Skip task and continue plan
   *
   * @param {object} task - Task definition
   * @param {string} actorId - Actor ID
   * @param {object} diagnostics - Method selection diagnostics
   * @returns {object} Fallback result
   * @throws {RefinementError} If fallbackBehavior is 'fail'
   * @private
   */
  #handleNoApplicableMethod(task, actorId, diagnostics) {
    const fallbackBehavior = task.fallbackBehavior || 'fail';

    this.#logger.warn('No applicable method, applying fallback', {
      taskId: task.id,
      fallbackBehavior,
      methodsEvaluated: diagnostics.methodsEvaluated,
    });

    switch (fallbackBehavior) {
      case 'replan':
        this.#logger.info('Requesting replan', { taskId: task.id });
        return {
          success: false,
          replan: true,
          reason: 'no_applicable_method',
          taskId: task.id,
          actorId,
          timestamp: Date.now(),
          diagnostics,
        };

      case 'fail':
        throw new RefinementError(
          `No applicable method for task '${task.id}'`,
          'NO_APPLICABLE_METHOD',
          { diagnostics }
        );

      case 'continue':
        this.#logger.info('Skipping task, continuing plan', {
          taskId: task.id,
        });
        return {
          success: true,
          skipped: true,
          reason: 'no_applicable_method',
          taskId: task.id,
          actorId,
          timestamp: Date.now(),
          diagnostics,
        };

      default:
        throw new RefinementError(
          `Unknown fallback behavior: ${fallbackBehavior}`,
          'INVALID_FALLBACK_BEHAVIOR'
        );
    }
  }

  /**
   * Execute all steps of a refinement method.
   *
   * Manages the complete step execution loop:
   * - Resolves fresh transient state manager for isolation
   * - Initializes refinement state
   * - Builds context for each step
   * - Routes to appropriate executor
   * - Handles step failures
   * - Dispatches step events
   * - Cleans up state (always, via finally)
   *
   * @param {object} selectedMethod - Selected refinement method
   * @param {object} task - Task definition
   * @param {string} actorId - Actor ID
   * @param {object} taskParams - Task parameters
   * @returns {Promise<Array<object>>} Array of step results
   * @throws {RefinementError} If step execution fails critically
   * @private
   */
  async #executeMethodSteps(selectedMethod, task, actorId, taskParams) {
    // CRITICAL: Resolve fresh transient RefinementStateManager to prevent state leakage
    // Each refinement execution gets its own isolated state manager instance
    const tokens = await import('../../dependencyInjection/tokens.js');
    const refinementStateManager = this.#container.resolve(
      tokens.tokens.IRefinementStateManager
    );

    // Initialize refinement state
    refinementStateManager.initialize();

    try {
      const stepResults = [];

      for (const [index, step] of selectedMethod.steps.entries()) {
        this.#logger.debug('Executing step', {
          taskId: task.id,
          methodId: selectedMethod.id,
          stepIndex: index,
          stepType: step.stepType,
        });

        // Assemble step context with current state snapshot
        const stepContext = await this.#contextAssemblyService.assembleRefinementContext(
          actorId,
          {
            id: task.id,
            params: taskParams,
          },
          refinementStateManager.getSnapshot()
        );

        // Execute step based on type
        let result;
        if (step.stepType === 'primitive_action') {
          result = await this.#primitiveActionStepExecutor.execute(
            step,
            stepContext,
            index
          );
        } else if (step.stepType === 'conditional') {
          result = await this.#conditionalStepExecutor.execute(
            step,
            stepContext,
            index
          );
        } else {
          throw new RefinementError(
            `Unknown step type: ${step.stepType}`,
            'INVALID_STEP_TYPE',
            { stepIndex: index, stepType: step.stepType }
          );
        }

        stepResults.push(result);

        // Dispatch step executed event
        this.#eventBus.dispatch({
          type: 'GOAP_STEP_EXECUTED',
          payload: {
            taskId: task.id,
            methodId: selectedMethod.id,
            stepIndex: index,
            stepType: step.stepType,
            success: result.success,
          },
        });

        // Handle step failure
        if (!result.success) {
          this.#logger.warn('Step execution failed', {
            taskId: task.id,
            methodId: selectedMethod.id,
            stepIndex: index,
            error: result.error,
          });

          // Check if replan was requested by conditional executor
          if (result.data?.replanRequested) {
            throw new RefinementError(
              `Step ${index} requested replan: ${result.error}`,
              'STEP_REPLAN_REQUESTED',
              { stepIndex: index, stepResult: result }
            );
          }

          // Otherwise, step was skipped or failed - continue based on step type
          // Conditional executor handles onFailure internally
        }
      }

      return stepResults;
    } finally {
      // Always clear state after method execution, even on error
      refinementStateManager.clear();
    }
  }
}

export default RefinementEngine;
