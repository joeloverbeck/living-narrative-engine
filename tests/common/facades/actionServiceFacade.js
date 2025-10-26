/**
 * @file ActionServiceFacade - Simplified interface for action processing in tests
 * @description Service facade that consolidates action-related services into a single,
 * easy-to-use interface for testing. Reduces test complexity by wrapping
 * ActionDiscoveryService, ActionPipelineOrchestrator, AvailableActionsProvider, and ActionIndex.
 */

/** @typedef {import('../../actions/actionDiscoveryService.js').ActionDiscoveryService} ActionDiscoveryService */
/** @typedef {import('../../actions/actionPipelineOrchestrator.js').ActionPipelineOrchestrator} ActionPipelineOrchestrator */
/** @typedef {import('../../data/providers/availableActionsProvider.js').AvailableActionsProvider} AvailableActionsProvider */
/** @typedef {import('../../actions/actionIndex.js').ActionIndex} ActionIndex */
/** @typedef {import('../../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * Facade providing simplified access to all action-related services for testing.
 * This facade reduces the complexity of setting up action processing in tests
 * by providing a single interface that coordinates multiple underlying services.
 */
export class ActionServiceFacade {
  #actionDiscoveryService;
  #actionPipelineOrchestrator;
  /** @type {boolean} */
  #supportsPipelineExecution;
  #availableActionsProvider;
  #actionIndex;
  #targetResolutionService;
  #logger;

  // Test-specific state
  #mockActions = new Map();
  #mockValidations = new Map();

  /**
   * Creates an instance of ActionServiceFacade.
   *
   * @param {object} deps - Dependencies object containing all required action services.
   * @param {ActionDiscoveryService} deps.actionDiscoveryService - Service for discovering available actions.
   * @param {ActionPipelineOrchestrator} deps.actionPipelineOrchestrator - Orchestrator for action pipeline processing.
   * @param {AvailableActionsProvider} deps.availableActionsProvider - Provider for available actions data.
   * @param {ActionIndex} deps.actionIndex - Index service for action lookup and caching.
   * @param {ITargetResolutionService} deps.targetResolutionService - Service for resolving action targets.
   * @param {ILogger} deps.logger - Logger for diagnostic output.
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({
    actionDiscoveryService,
    actionPipelineOrchestrator,
    availableActionsProvider,
    actionIndex,
    targetResolutionService,
    logger,
  }) {
    // Validate action discovery service
    if (
      !actionDiscoveryService ||
      typeof actionDiscoveryService.discoverActions !== 'function'
    ) {
      throw new Error(
        'ActionServiceFacade: Missing or invalid actionDiscoveryService dependency.'
      );
    }

    // Validate action pipeline orchestrator
    if (
      !actionPipelineOrchestrator ||
      typeof actionPipelineOrchestrator.discoverActions !== 'function'
    ) {
      throw new Error(
        'ActionServiceFacade: Missing or invalid actionPipelineOrchestrator dependency.'
      );
    }

    // Validate available actions provider
    if (
      !availableActionsProvider ||
      typeof availableActionsProvider.getAvailableActions !== 'function'
    ) {
      throw new Error(
        'ActionServiceFacade: Missing or invalid availableActionsProvider dependency.'
      );
    }

    // Validate action index
    if (!actionIndex || typeof actionIndex.getActionDefinition !== 'function') {
      throw new Error(
        'ActionServiceFacade: Missing or invalid actionIndex dependency.'
      );
    }

    // Validate target resolution service
    if (
      !targetResolutionService ||
      typeof targetResolutionService.resolveTargets !== 'function'
    ) {
      throw new Error(
        'ActionServiceFacade: Missing or invalid targetResolutionService dependency.'
      );
    }

    // Validate logger
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'ActionServiceFacade: Missing or invalid logger dependency.'
      );
    }

    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionPipelineOrchestrator = actionPipelineOrchestrator;
    this.#supportsPipelineExecution =
      typeof actionPipelineOrchestrator.execute === 'function';
    this.#availableActionsProvider = availableActionsProvider;
    this.#actionIndex = actionIndex;
    this.#targetResolutionService = targetResolutionService;
    this.#logger = logger;
  }

  /**
   * Discovers available actions for the specified actor.
   * This is a simplified interface that coordinates action discovery
   * and filtering based on the actor's current context.
   *
   * @param {string} actorId - The ID of the actor to discover actions for.
   * @param {object} [options] - Optional configuration for action discovery.
   * @param {boolean} [options.includeDisabled] - Whether to include disabled actions.
   * @param {string[]} [options.filterCategories] - Categories to filter actions by.
   * @returns {Promise<object[]>} Array of available action definitions.
   */
  async discoverActions(actorId, options = {}) {
    this.#logger.debug('ActionServiceFacade: Discovering actions', {
      actorId,
      options,
    });

    try {
      // Check for mock actions first (for testing)
      const mockKey = `${actorId}:discover`;
      if (this.#mockActions.has(mockKey)) {
        const mockActions = this.#mockActions.get(mockKey);
        this.#logger.debug('ActionServiceFacade: Using mock actions', {
          mockKey,
          mockActions,
        });
        return mockActions;
      }

      // Delegate to the action discovery service
      const discoveryResult =
        await this.#actionDiscoveryService.discoverActions(actorId, options);

      this.#logger.debug('ActionServiceFacade: Actions discovered', {
        actorId,
        actionCount: discoveryResult?.actions?.length || 0,
      });

      return discoveryResult.actions || [];
    } catch (error) {
      this.#logger.error(
        'ActionServiceFacade: Error discovering actions',
        error
      );
      throw error;
    }
  }

  /**
   * Validates an action against game rules and actor capabilities.
   * This coordinates prerequisite checking, target resolution, and rule validation.
   *
   * @param {object} action - The action to validate.
   * @param {string} action.actionId - The ID of the action definition.
   * @param {string} action.actorId - The ID of the actor performing the action.
   * @param {object} [action.targets] - The targets for the action.
   * @param {object} [options] - Optional validation configuration.
   * @returns {Promise<object>} Validation result with success/failure and details.
   */
  async validateAction(action, options = {}) {
    this.#logger.debug('ActionServiceFacade: Validating action', {
      action,
      options,
    });

    try {
      // Check for mock validation first (for testing)
      const mockKey = `${action.actorId}:${action.actionId}:validate`;
      if (this.#mockValidations.has(mockKey)) {
        const mockValidation = this.#mockValidations.get(mockKey);
        this.#logger.debug('ActionServiceFacade: Using mock validation', {
          mockKey,
          mockValidation,
        });
        return mockValidation;
      }

      // Get action definition
      const actionDefinition = await this.#actionIndex.getActionDefinition(
        action.actionId
      );
      if (!actionDefinition) {
        return {
          success: false,
          error: `Action definition not found: ${action.actionId}`,
          code: 'ACTION_NOT_FOUND',
        };
      }

      // Resolve targets if needed
      let resolvedTargets = action.targets;
      if (actionDefinition.targets && actionDefinition.targets.length > 0) {
        const targetResolution =
          await this.#targetResolutionService.resolveTargets({
            actionId: action.actionId,
            actorId: action.actorId,
            targets: action.targets || {},
          });

        if (!targetResolution.success) {
          return {
            success: false,
            error: 'Target resolution failed',
            details: targetResolution.errors,
            code: 'TARGET_RESOLUTION_FAILED',
          };
        }

        resolvedTargets = targetResolution.resolvedTargets;
      }

      // Use pipeline orchestrator for full validation
      if (!this.#supportsPipelineExecution) {
        const message =
          'ActionServiceFacade: actionPipelineOrchestrator.execute is unavailable. Provide an orchestrator with execute() to validate actions.';
        this.#logger.error(message, {
          actionId: action.actionId,
          actorId: action.actorId,
        });
        return {
          success: false,
          error: message,
          code: 'PIPELINE_UNAVAILABLE',
        };
      }

      const validationResult = await this.#actionPipelineOrchestrator.execute({
        action: {
          ...action,
          targets: resolvedTargets,
        },
        actionDefinition,
        validateOnly: true,
      });

      this.#logger.debug('ActionServiceFacade: Action validation completed', {
        action: action.actionId,
        success: validationResult.success,
      });

      return validationResult;
    } catch (error) {
      this.#logger.error('ActionServiceFacade: Error validating action', error);
      return {
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Executes a validated action.
   * This coordinates the full action execution pipeline including
   * effects processing, state updates, and event dispatching.
   *
   * @param {object} action - The action to execute.
   * @param {string} action.actionId - The ID of the action definition.
   * @param {string} action.actorId - The ID of the actor performing the action.
   * @param {object} [action.targets] - The targets for the action.
   * @param {object} [options] - Optional execution configuration.
   * @returns {Promise<object>} Execution result with success/failure and effects.
   */
  async executeAction(action, options = {}) {
    this.#logger.debug('ActionServiceFacade: Executing action', {
      action,
      options,
    });

    try {
      // Get action definition
      const actionDefinition = await this.#actionIndex.getActionDefinition(
        action.actionId
      );
      if (!actionDefinition) {
        return {
          success: false,
          error: `Action definition not found: ${action.actionId}`,
          code: 'ACTION_NOT_FOUND',
        };
      }

      // Execute through pipeline orchestrator
      if (!this.#supportsPipelineExecution) {
        const message =
          'ActionServiceFacade: actionPipelineOrchestrator.execute is unavailable. Provide an orchestrator with execute() to run actions.';
        this.#logger.error(message, {
          actionId: action.actionId,
          actorId: action.actorId,
        });
        return {
          success: false,
          error: message,
          code: 'PIPELINE_UNAVAILABLE',
        };
      }

      const executionResult = await this.#actionPipelineOrchestrator.execute({
        action,
        actionDefinition,
        validateOnly: false,
      });

      this.#logger.debug('ActionServiceFacade: Action execution completed', {
        action: action.actionId,
        success: executionResult.success,
      });

      return executionResult;
    } catch (error) {
      this.#logger.error('ActionServiceFacade: Error executing action', error);
      return {
        success: false,
        error: error.message,
        code: 'EXECUTION_ERROR',
      };
    }
  }

  /**
   * Gets available actions for an actor using the provider.
   * This is a higher-level interface that formats actions for UI display.
   *
   * @param {string} actorId - The ID of the actor.
   * @param {object} [options] - Optional configuration.
   * @returns {Promise<object[]>} Array of formatted available actions.
   */
  async getAvailableActions(actorId, options = {}) {
    this.#logger.debug('ActionServiceFacade: Getting available actions', {
      actorId,
      options,
    });

    try {
      const availableActions =
        await this.#availableActionsProvider.getAvailableActions(
          actorId,
          options
        );

      this.#logger.debug('ActionServiceFacade: Available actions retrieved', {
        actorId,
        actionCount: availableActions?.length || 0,
      });

      return availableActions || [];
    } catch (error) {
      this.#logger.error(
        'ActionServiceFacade: Error getting available actions',
        error
      );
      throw error;
    }
  }

  /**
   * Sets mock actions for testing purposes.
   * This allows tests to simulate action discovery without complex setup.
   *
   * @param {string} actorId - The actor ID to mock actions for.
   * @param {object[]} actions - The mock actions to return.
   */
  setMockActions(actorId, actions) {
    const mockKey = `${actorId}:discover`;
    this.#mockActions.set(mockKey, actions);
    this.#logger.debug('ActionServiceFacade: Mock actions set', {
      mockKey,
      actionCount: actions.length,
    });
  }

  /**
   * Gets mock actions for testing purposes.
   * This allows test helpers to access the mock actions that were set.
   *
   * @param {string} actorId - The actor ID to get mock actions for.
   * @returns {object[]} The mock actions for this actor.
   */
  getMockActions(actorId) {
    const mockKey = `${actorId}:discover`;
    return this.#mockActions.get(mockKey) || [];
  }

  /**
   * Sets mock validation results for testing purposes.
   * This allows tests to simulate action validation without actual rule processing.
   *
   * @param {string} actorId - The actor ID to mock validation for.
   * @param {string} actionId - The action ID to mock validation for.
   * @param {object} validationResult - The mock validation result to return.
   */
  setMockValidation(actorId, actionId, validationResult) {
    const mockKey = `${actorId}:${actionId}:validate`;
    this.#mockValidations.set(mockKey, validationResult);
    this.#logger.debug('ActionServiceFacade: Mock validation set', {
      mockKey,
      validationResult,
    });
  }

  /**
   * Clears all mock data.
   * Useful for test cleanup between test cases.
   */
  clearMockData() {
    this.#mockActions.clear();
    this.#mockValidations.clear();
    this.#logger.debug('ActionServiceFacade: All mock data cleared');
  }

  /**
   * Provides direct access to the action discovery service.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {ActionDiscoveryService} The action discovery service instance.
   */
  get actionDiscoveryService() {
    return this.#actionDiscoveryService;
  }

  /**
   * Provides direct access to the action pipeline orchestrator.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {ActionPipelineOrchestrator} The action pipeline orchestrator instance.
   */
  get actionPipelineOrchestrator() {
    return this.#actionPipelineOrchestrator;
  }

  /**
   * Provides direct access to the available actions provider.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {AvailableActionsProvider} The available actions provider instance.
   */
  get availableActionsProvider() {
    return this.#availableActionsProvider;
  }

  /**
   * Provides direct access to the action index.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {ActionIndex} The action index instance.
   */
  get actionIndex() {
    return this.#actionIndex;
  }

  /**
   * Provides direct access to the target resolution service.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {ITargetResolutionService} The target resolution service instance.
   */
  get targetResolutionService() {
    return this.#targetResolutionService;
  }

  /**
   * Dispose method to clean up resources.
   * Call this when the facade is no longer needed.
   */
  dispose() {
    this.#logger.debug('ActionServiceFacade: Disposing resources');

    this.clearMockData();

    // Dispose underlying services if they support it
    this.#actionDiscoveryService?.dispose?.();
    this.#actionPipelineOrchestrator?.dispose?.();
    this.#availableActionsProvider?.dispose?.();
    this.#actionIndex?.dispose?.();
    this.#targetResolutionService?.dispose?.();
  }
}
