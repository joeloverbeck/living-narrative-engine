/**
 * @file TurnExecutionFacade - Main orchestrating facade for turn execution testing
 * @description The primary facade that coordinates LLMServiceFacade, ActionServiceFacade,
 * and EntityServiceFacade to provide a single, simplified interface for turn execution
 * testing. This replaces the complex 20+ service setup with a single facade.
 */

/** @typedef {import('./llmServiceFacade.js').LLMServiceFacade} LLMServiceFacade */
/** @typedef {import('./actionServiceFacade.js').ActionServiceFacade} ActionServiceFacade */
/** @typedef {import('./entityServiceFacade.js').EntityServiceFacade} EntityServiceFacade */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * Main facade providing complete turn execution testing capabilities.
 * This facade orchestrates the three service facades to provide a single,
 * comprehensive interface for testing turn-based gameplay. It dramatically
 * reduces test setup complexity from 20+ services to a single facade.
 */
export class TurnExecutionFacade {
  #llmService;
  #actionService;
  #entityService;
  #logger;

  // Test environment state
  #testEnvironment = null;
  #isInitialized = false;

  /**
   * Creates an instance of TurnExecutionFacade.
   *
   * @param {object} deps - Dependencies object containing the service facades.
   * @param {LLMServiceFacade} deps.llmService - The LLM service facade for AI decisions.
   * @param {ActionServiceFacade} deps.actionService - The action service facade for action processing.
   * @param {EntityServiceFacade} deps.entityService - The entity service facade for entity operations.
   * @param {ILogger} deps.logger - Logger for diagnostic output.
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({ llmService, actionService, entityService, logger }) {
    // Validate LLM service facade
    if (!llmService || typeof llmService.getAIDecision !== 'function') {
      throw new Error(
        'TurnExecutionFacade: Missing or invalid llmService dependency.'
      );
    }

    // Validate action service facade
    if (!actionService || typeof actionService.discoverActions !== 'function') {
      throw new Error(
        'TurnExecutionFacade: Missing or invalid actionService dependency.'
      );
    }

    // Validate entity service facade
    if (!entityService || typeof entityService.createTestActor !== 'function') {
      throw new Error(
        'TurnExecutionFacade: Missing or invalid entityService dependency.'
      );
    }

    // Validate logger
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'TurnExecutionFacade: Missing or invalid logger dependency.'
      );
    }

    this.#llmService = llmService;
    this.#actionService = actionService;
    this.#entityService = entityService;
    this.#logger = logger;
  }

  /**
   * Initializes a complete test environment for turn execution.
   * This is the main setup method that replaces the complex initialization
   * found in test beds like FullTurnExecutionTestBed.
   *
   * @param {object} [config] - Configuration for the test environment.
   * @param {string} [config.llmStrategy] - LLM strategy to use.
   * @param {object} [config.llmConfig] - Additional LLM configuration.
   * @param {object} [config.actorConfig] - Configuration for test actors (legacy).
   * @param {Array<object>} [config.actors] - Array of actor configurations.
   * @param {object} [config.worldConfig] - Configuration for test world.
   * @param {boolean} [config.createConnections] - Whether to create connected locations.
   * @returns {Promise<object>} The initialized test environment.
   */
  async initializeTestEnvironment(config = {}) {
    const {
      llmStrategy = 'tool-calling',
      llmConfig = {},
      actorConfig = {},
      actors = [],
      worldConfig = {},
      createConnections = false,
    } = config;

    this.#logger.debug('TurnExecutionFacade: Initializing test environment', {
      config,
    });

    try {
      // 1. Configure LLM strategy
      await this.#llmService.configureLLMStrategy(llmStrategy, llmConfig);

      // 2. Create test world
      const world = await this.#entityService.createTestWorld({
        ...worldConfig,
        createConnections: worldConfig.createConnections ?? createConnections,
      });

      // 3. Create test actors
      const createdActors = {};
      const actorIds = [];

      // Handle new actors array format
      if (actors.length > 0) {
        for (const actorDef of actors) {
          // Extract type to prevent it from being passed as entity definition type
          const { type: actorType, ...restActorDef } = actorDef;

          const actorId = await this.#entityService.createTestActor({
            name: actorDef.name || `Test ${actorType || 'AI'} Actor`,
            location: actorDef.location || world.mainLocationId,
            components: actorDef.components || {
              'core:actor': { type: actorType || 'ai' },
            },
            ...restActorDef,
          });

          createdActors[actorDef.id || actorId] = actorId;
          actorIds.push(actorId);
        }
      } else {
        // Legacy support - create default AI and player actors
        const aiActorId = await this.#entityService.createTestActor({
          name: 'AI Test Actor',
          location: world.mainLocationId,
          ...actorConfig,
        });

        const playerActorId = await this.#entityService.createTestActor({
          name: 'Player Test Actor',
          location: world.mainLocationId,
          components: {
            'core:actor': { type: 'player' },
          },
        });

        createdActors.aiActorId = aiActorId;
        createdActors.playerActorId = playerActorId;
        actorIds.push(aiActorId, playerActorId);
      }

      // 4. Set up basic test data
      const testEnvironment = {
        world,
        actors: createdActors,
        actorIds,
        // Legacy compatibility
        aiActor:
          actors.length > 0
            ? { id: actorIds[0] }
            : { id: createdActors.aiActorId },
        context: {
          world,
          actors: createdActors,
        },
        config: {
          llmStrategy,
          llmConfig,
          ...config,
        },
        initialized: Date.now(),
      };

      this.#testEnvironment = testEnvironment;
      this.#isInitialized = true;

      this.#logger.debug('TurnExecutionFacade: Test environment initialized', {
        actorCount: actorIds.length,
        actors: createdActors,
        locationCount: world.locations ? world.locations.length : 1,
      });

      return testEnvironment;
    } catch (error) {
      this.#logger.error(
        'TurnExecutionFacade: Error initializing test environment',
        error
      );
      throw error;
    }
  }

  /**
   * Executes a complete AI turn for the specified actor.
   * This coordinates AI decision making, action discovery, validation,
   * and execution in a single method call.
   *
   * @param {string} actorId - The ID of the AI actor executing the turn.
   * @param {object} [context] - Additional context for the AI decision.
   * @param {object} [options] - Optional configuration for the turn execution.
   * @param {boolean} [options.validateOnly] - Whether to only validate without executing.
   * @returns {Promise<object>} The turn execution result.
   */
  async executeAITurn(actorId, context = {}, options = {}) {
    this.#logger.debug('TurnExecutionFacade: Executing AI turn', {
      actorId,
      context,
      options,
    });

    if (!this.#isInitialized) {
      throw new Error(
        'TurnExecutionFacade: Test environment not initialized. Call initializeTestEnvironment() first.'
      );
    }

    const startTime = Date.now();
    
    try {

      // 1. Discover available actions
      const availableActions =
        await this.#actionService.discoverActions(actorId);

      if (!availableActions || availableActions.length === 0) {
        return {
          success: false,
          error: 'No available actions found for actor',
          actorId,
          duration: Date.now() - startTime,
        };
      }

      // 2. Get AI decision
      const aiDecision = await this.#llmService.getAIDecision(actorId, {
        ...context,
        availableActions,
      });

      if (!aiDecision || !aiDecision.actionId) {
        return {
          success: false,
          error: 'AI decision did not specify a valid action',
          aiDecision,
          duration: Date.now() - startTime,
        };
      }

      // 3. Validate the chosen action
      const validation = await this.#actionService.validateAction({
        actionId: aiDecision.actionId,
        actorId,
        targets: aiDecision.targets || {},
      });

      if (!validation.success) {
        return {
          success: false,
          error: 'Action validation failed',
          validation,
          aiDecision,
          duration: Date.now() - startTime,
        };
      }

      // 4. Execute the action (unless validateOnly)
      let execution = null;
      if (!options.validateOnly) {
        execution = await this.#actionService.executeAction({
          actionId: aiDecision.actionId,
          actorId,
          targets: aiDecision.targets || {},
        });

        if (!execution.success) {
          return {
            success: false,
            error: 'Action execution failed',
            execution,
            validation,
            aiDecision,
            duration: Date.now() - startTime,
          };
        }
      }

      const result = {
        success: true,
        actorId,
        aiDecision,
        validation,
        execution,
        availableActionCount: availableActions.length,
        duration: Date.now() - startTime,
      };

      this.#logger.debug('TurnExecutionFacade: AI turn completed', {
        actorId,
        actionId: aiDecision.actionId,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      this.#logger.error('TurnExecutionFacade: Error executing AI turn', error);
      return {
        success: false,
        error: error.message,
        actorId,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Executes a complete player turn for the specified actor.
   * This processes a player command through action discovery, validation,
   * and execution.
   *
   * @param {string} actorId - The ID of the player actor executing the turn.
   * @param {string} command - The player's command input.
   * @param {object} [options] - Optional configuration for the turn execution.
   * @returns {Promise<object>} The turn execution result.
   */
  async executePlayerTurn(actorId, command, options = {}) {
    this.#logger.debug('TurnExecutionFacade: Executing player turn', {
      actorId,
      command,
      options,
    });

    if (!this.#isInitialized) {
      throw new Error(
        'TurnExecutionFacade: Test environment not initialized. Call initializeTestEnvironment() first.'
      );
    }

    const startTime = Date.now();
    
    try {

      // 1. Parse command to extract action and targets
      // This is a simplified version - real implementation would use command parsing
      const parsedCommand = this.#parsePlayerCommand(command);

      // 2. Validate the action
      const validation = await this.#actionService.validateAction({
        actionId: parsedCommand.actionId,
        actorId,
        targets: parsedCommand.targets || {},
      });

      if (!validation.success) {
        return {
          success: false,
          error: 'Action validation failed',
          validation,
          command,
          duration: Date.now() - startTime,
        };
      }

      // 3. Execute the action
      const execution = await this.#actionService.executeAction({
        actionId: parsedCommand.actionId,
        actorId,
        targets: parsedCommand.targets || {},
      });

      const result = {
        success: execution.success,
        actorId,
        command,
        parsedCommand,
        validation,
        execution,
        duration: Date.now() - startTime,
      };

      this.#logger.debug('TurnExecutionFacade: Player turn completed', {
        actorId,
        actionId: parsedCommand.actionId,
        success: result.success,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      this.#logger.error(
        'TurnExecutionFacade: Error executing player turn',
        error
      );
      return {
        success: false,
        error: error.message,
        actorId,
        command,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Sets up mock responses for testing scenarios.
   * This allows tests to simulate specific AI decisions and action results
   * without complex setup.
   *
   * @param {object} mocks - Mock configuration.
   * @param {object} [mocks.aiResponses] - Mock AI responses by actor ID.
   * @param {object} [mocks.actionResults] - Mock action results by action ID.
   * @param {object} [mocks.validationResults] - Mock validation results.
   */
  setupMocks(mocks = {}) {
    this.#logger.debug('TurnExecutionFacade: Setting up mocks', { mocks });

    const {
      aiResponses = {},
      actionResults = {},
      validationResults = {},
    } = mocks;

    // Set up LLM mocks
    Object.entries(aiResponses).forEach(([actorId, response]) => {
      this.#llmService.setMockResponse(actorId, response);
    });

    // Set up action mocks
    Object.entries(actionResults).forEach(([actorId, actions]) => {
      this.#actionService.setMockActions(actorId, actions);
    });

    // Set up validation mocks
    Object.entries(validationResults).forEach(([key, result]) => {
      const parts = key.split(':');
      const actorId = parts[0];
      const actionId = parts.slice(1).join(':'); // Rejoin the rest with colons
      this.#actionService.setMockValidation(actorId, actionId, result);
    });
  }

  /**
   * Gets the current test environment.
   * Useful for test assertions and debugging.
   *
   * @returns {object|null} The current test environment or null if not initialized.
   */
  getTestEnvironment() {
    return this.#testEnvironment;
  }

  /**
   * Gets events that have been dispatched during testing.
   * This allows tests to verify that expected events occurred.
   *
   * @param {string} [eventType] - Optional filter by event type.
   * @returns {object[]} Array of dispatched events.
   */
  getDispatchedEvents(eventType) {
    return this.#entityService.getDispatchedEvents(eventType);
  }

  /**
   * Clears all test data and mocks.
   * Call this between test cases for clean setup.
   */
  async clearTestData() {
    this.#logger.debug('TurnExecutionFacade: Clearing test data');

    // Clear service-specific data
    this.#llmService.clearMockResponses();
    this.#actionService.clearMockData();
    await this.#entityService.clearTestData();

    // Reset facade state
    this.#testEnvironment = null;
    this.#isInitialized = false;
  }

  /**
   * Simple command parser for player commands.
   * This is a basic implementation for testing - real implementation
   * would use a more sophisticated command parsing system.
   *
   * @private
   * @param {string} command - The player command to parse.
   * @returns {object} Parsed command with actionId and targets.
   */
  #parsePlayerCommand(command) {
    // Basic command parsing - in real implementation this would be more sophisticated
    const words = command.toLowerCase().trim().split(/\s+/);
    const verb = words[0];

    // Map common verbs to action IDs
    const verbMap = {
      go: 'core:move',
      move: 'core:move',
      look: 'core:look',
      examine: 'core:examine',
      take: 'core:take',
      get: 'core:take',
      drop: 'core:drop',
      say: 'core:say',
      talk: 'core:talk',
    };

    const actionId = verbMap[verb] || `core:${verb}`;
    const targets = {};

    // Basic target extraction
    if (words.length > 1) {
      targets.object = words.slice(1).join(' ');
    }

    return { actionId, targets };
  }

  /**
   * Provides direct access to the LLM service facade.
   * Use sparingly - prefer the higher-level turn execution methods.
   *
   * @returns {LLMServiceFacade} The LLM service facade instance.
   */
  get llmService() {
    return this.#llmService;
  }

  /**
   * Provides direct access to the action service facade.
   * Use sparingly - prefer the higher-level turn execution methods.
   *
   * @returns {ActionServiceFacade} The action service facade instance.
   */
  get actionService() {
    return this.#actionService;
  }

  /**
   * Provides direct access to the entity service facade.
   * Use sparingly - prefer the higher-level turn execution methods.
   *
   * @returns {EntityServiceFacade} The entity service facade instance.
   */
  get entityService() {
    return this.#entityService;
  }

  /**
   * Dispose method to clean up all resources.
   * Call this when the facade is no longer needed.
   */
  async dispose() {
    this.#logger.debug('TurnExecutionFacade: Disposing resources');

    // Clear test data
    await this.clearTestData();

    // Dispose service facades
    this.#llmService?.dispose?.();
    this.#actionService?.dispose?.();
    await this.#entityService?.dispose?.();
  }
}
