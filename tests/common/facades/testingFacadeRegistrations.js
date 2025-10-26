/**
 * @file Testing Facade Registrations - Dependency injection setup for facade services
 * @description Provides registration functions for testing facade services.
 * These registrations simplify test container setup by providing pre-configured
 * facade instances with all required dependencies.
 *
 * Phase 2 Enhancement: Now also exports test module builders for an even simpler
 * testing experience with fluent API and preset configurations.
 */

import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { LLMServiceFacade } from './llmServiceFacade.js';
import { ActionServiceFacade } from './actionServiceFacade.js';
import { EntityServiceFacade } from './entityServiceFacade.js';
import { TurnExecutionFacade } from './turnExecutionFacade.js';

// Test module builders have been moved to tests/common/testing/builders/ to avoid src->test dependencies

/**
 * Registers all testing facade services with the dependency injection container.
 * This provides a convenient way to set up all facades for testing environments.
 *
 * @param {object} container - The dependency injection container instance.
 */
export function registerTestingFacades(container) {
  // Register LLM Service Facade
  container.register(
    tokens.ILLMServiceFacade,
    ({
      llmAdapter = container.resolve(tokens.LLMAdapter),
      llmChooser = container.resolve(tokens.ILLMChooser),
      promptPipeline = container.resolve(tokens.IAIPromptPipeline),
      responseProcessor = container.resolve(tokens.ILLMResponseProcessor),
      decisionProvider = container.resolve(tokens.ILLMDecisionProvider),
      logger = container.resolve(tokens.ILogger),
    }) =>
      new LLMServiceFacade({
        llmAdapter,
        llmChooser,
        promptPipeline,
        responseProcessor,
        decisionProvider,
        logger,
      }),
    { lifecycle: 'singleton' }
  );

  // Register Action Service Facade
  container.register(
    tokens.IActionServiceFacade,
    ({
      actionDiscoveryService = container.resolve(
        tokens.IActionDiscoveryService
      ),
      actionPipelineOrchestrator = container.resolve(
        tokens.ActionPipelineOrchestrator
      ),
      availableActionsProvider = container.resolve(
        tokens.IAvailableActionsProvider
      ),
      actionIndex = container.resolve(tokens.ActionIndex),
      targetResolutionService = container.resolve(
        tokens.ITargetResolutionService
      ),
      logger = container.resolve(tokens.ILogger),
    }) =>
      new ActionServiceFacade({
        actionDiscoveryService,
        actionPipelineOrchestrator,
        availableActionsProvider,
        actionIndex,
        targetResolutionService,
        logger,
      }),
    { lifecycle: 'singleton' }
  );

  // Register Entity Service Facade
  container.register(
    tokens.IEntityServiceFacade,
    ({
      entityManager = container.resolve(tokens.IEntityManager),
      eventBus = container.resolve(tokens.IEventBus),
      dataRegistry = container.resolve(tokens.IDataRegistry),
      scopeRegistry = container.resolve(tokens.IScopeRegistry),
      gameDataRepository = container.resolve(tokens.IGameDataRepository),
      logger = container.resolve(tokens.ILogger),
    }) =>
      new EntityServiceFacade({
        entityManager,
        eventBus,
        dataRegistry,
        scopeRegistry,
        gameDataRepository,
        logger,
      }),
    { lifecycle: 'singleton' }
  );

  // Register Turn Execution Facade (main orchestrator)
  container.register(
    tokens.ITurnExecutionFacade,
    ({
      llmService = container.resolve(tokens.ILLMServiceFacade),
      actionService = container.resolve(tokens.IActionServiceFacade),
      entityService = container.resolve(tokens.IEntityServiceFacade),
      logger = container.resolve(tokens.ILogger),
    }) =>
      new TurnExecutionFacade({
        llmService,
        actionService,
        entityService,
        logger,
      }),
    { lifecycle: 'singleton' }
  );
}

/**
 * Creates mock instances of facade services for testing.
 * This is useful when you need facade instances without full container setup.
 * Note: This function should only be called from test files where jest is available.
 *
 * @param {object} [mockDeps] - Optional mock dependencies to override defaults.
 * @param {object} [mockFn] - Mock function creator (typically jest.fn).
 * @returns {object} Object containing all facade instances.
 */
export function createMockFacades(mockDeps = {}, mockFn = () => () => {}) {
  // Create mock logger if not provided
  const mockLogger = mockDeps.logger || {
    debug: mockFn(),
    info: mockFn(),
    warn: mockFn(),
    error: mockFn(),
  };

  // Create mock LLM service dependencies
  const mockLLMDeps = {
    llmAdapter: {
      getAIDecision: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue({ actionId: 'core:look' })
          : async () => ({ actionId: 'core:look' });
      })(),
    },
    llmChooser: {
      getAIChoice: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue('choice')
          : async () => 'choice';
      })(),
    },
    promptPipeline: {
      generatePrompt: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue('prompt')
          : async () => 'prompt';
      })(),
    },
    responseProcessor: {
      processResponse: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue({ processed: true })
          : async () => ({ processed: true });
      })(),
    },
    decisionProvider: {
      getDecision: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue({ actionId: 'core:look' })
          : async () => ({ actionId: 'core:look' });
      })(),
    },
    logger: mockLogger,
    ...mockDeps.llm,
  };

  // Create mock action service dependencies
  const mockActionDeps = {
    actionDiscoveryService: {
      discoverActions: (() => {
        const mock = mockFn();
        const defaultActions = [
          { id: 'core:look', name: 'Look' },
          { id: 'core:wait', name: 'Wait' },
          { id: 'core:move', name: 'Move' },
        ];
        return mock.mockResolvedValue
          ? mock.mockResolvedValue({ actions: defaultActions })
          : async () => ({ actions: defaultActions });
      })(),
    },
    actionPipelineOrchestrator: {
      discoverActions: (() => {
        const mock = mockFn();
        const defaultResult = {
          actions: [
            { id: 'core:look', name: 'Look' },
            { id: 'core:wait', name: 'Wait' },
          ],
          errors: [],
        };
        return mock.mockResolvedValue
          ? mock.mockResolvedValue(defaultResult)
          : async () => defaultResult;
      })(),
      execute: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue({
              success: true,
              effects: ['Action executed successfully'],
              description: 'The action was performed.',
            })
          : async () => ({
              success: true,
              effects: ['Action executed successfully'],
              description: 'The action was performed.',
            });
      })(),
    },
    availableActionsProvider: {
      getAvailableActions: (() => {
        const mock = mockFn();
        const defaultActions = [
          { id: 'core:look', name: 'Look' },
          { id: 'core:wait', name: 'Wait' },
          { id: 'core:move', name: 'Move' },
        ];
        return mock.mockResolvedValue
          ? mock.mockResolvedValue(defaultActions)
          : async () => defaultActions;
      })(),
    },
    actionIndex: {
      getActionDefinition: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue({ id: 'test-action' })
          : async () => ({ id: 'test-action' });
      })(),
    },
    targetResolutionService: {
      resolveTargets: (() => {
        const mock = mockFn();
        return mock.mockResolvedValue
          ? mock.mockResolvedValue({})
          : async () => ({});
      })(),
    },
    logger: mockLogger,
    ...mockDeps.action,
  };

  // Create mock entity definitions for common test entities
  const mockEntityDefinitions = {
    'core:actor': {
      id: 'core:actor',
      components: {
        'core:actor': {},
        'core:name': {},
        'core:location': {},
      },
    },
    'core:location': {
      id: 'core:location',
      components: {
        'core:location': {},
        'core:name': {},
        'core:description': {},
      },
    },
  };

  // Create a shared entity store for the mock entity manager
  const mockEntityStore = new Map();

  // Create mock entity service dependencies
  const mockEntityDeps = {
    entityManager: {
      createEntity: (() => {
        const mock = mockFn();
        if (mock.mockImplementation) {
          return mock.mockImplementation(async (config) => {
            // Return the provided ID or generate one
            const id = config.id || `entity-${Date.now()}-${Math.random()}`;
            // Store the entity
            mockEntityStore.set(id, {
              id,
              components: config.components || {},
              ...config,
            });
            return id;
          });
        } else {
          // Fallback for non-Jest mock functions
          return async (config) => {
            const id = config.id || `entity-${Date.now()}-${Math.random()}`;
            mockEntityStore.set(id, {
              id,
              components: config.components || {},
              ...config,
            });
            return id;
          };
        }
      })(),
      getEntityInstance: (() => {
        const mock = mockFn();
        if (mock.mockImplementation) {
          return mock.mockImplementation(async (entityId) => {
            // Add better error handling and debugging
            if (!entityId) {
              console.warn('getEntityInstance called with undefined entityId');
              return null;
            }
            const entity = mockEntityStore.get(entityId);
            if (!entity) {
              console.warn(
                `Entity not found in mock store: ${entityId}. Available entities: ${Array.from(mockEntityStore.keys()).join(', ')}`
              );
            }
            return entity;
          });
        } else {
          // Fallback for non-Jest mock functions
          return async (entityId) => {
            if (!entityId) {
              console.warn('getEntityInstance called with undefined entityId');
              return null;
            }
            const entity = mockEntityStore.get(entityId);
            if (!entity) {
              console.warn(
                `Entity not found in mock store: ${entityId}. Available entities: ${Array.from(mockEntityStore.keys()).join(', ')}`
              );
            }
            return entity;
          };
        }
      })(),
      updateComponent: (() => {
        const mock = mockFn();
        if (mock.mockImplementation) {
          return mock.mockImplementation(
            async (entityId, componentId, data) => {
              // Update the entity's components in the tracked entities
              const entity = mockEntityStore.get(entityId);
              if (entity) {
                if (!entity.components) entity.components = {};
                entity.components[componentId] = data;
              }
              return true;
            }
          );
        } else {
          // Fallback for non-Jest mock functions
          return async (entityId, componentId, data) => {
            const entity = mockEntityStore.get(entityId);
            if (entity) {
              if (!entity.components) entity.components = {};
              entity.components[componentId] = data;
            }
            return true;
          };
        }
      })(),
      removeEntity: (() => {
        const mock = mockFn();
        if (mock.mockImplementation) {
          return mock.mockImplementation(async (entityId) => {
            return mockEntityStore.delete(entityId);
          });
        } else {
          // Fallback for non-Jest mock functions
          return async (entityId) => mockEntityStore.delete(entityId);
        }
      })(),
    },
    eventBus: {
      dispatch: (() => {
        const mock = mockFn();
        return mock.mockImplementation
          ? mock.mockImplementation(async (event) => {
              // Add to entity service mock events for testing
              return Promise.resolve();
            })
          : async (event) => Promise.resolve();
      })(),
    },
    dataRegistry: { get: mockFn() },
    scopeRegistry: { getScope: mockFn() },
    gameDataRepository: {
      getEntityDefinition: (() => {
        const mock = mockFn();
        if (mock.mockImplementation) {
          return mock.mockImplementation((id) => {
            return mockEntityDefinitions[id] || null;
          });
        } else {
          // Fallback for non-Jest mock functions
          return (id) => mockEntityDefinitions[id] || null;
        }
      })(),
    },
    logger: mockLogger,
    ...mockDeps.entity,
  };

  // Create facade instances
  const llmService = new LLMServiceFacade(mockLLMDeps);
  const actionService = new ActionServiceFacade(mockActionDeps);
  const entityService = new EntityServiceFacade(mockEntityDeps);
  const turnExecutionFacade = new TurnExecutionFacade({
    llmService,
    actionService,
    entityService,
    logger: mockLogger,
  });

  // Add cleanup methods to facades
  const addCleanupMethods = (facade, store) => {
    facade.cleanup = () => {
      if (store) {
        store.clear();
      }
    };
    return facade;
  };

  // Add debugging method to entity service
  entityService.getTestEntities = () => {
    return mockEntityStore;
  };

  return {
    llmService,
    actionService,
    entityService: addCleanupMethods(entityService, mockEntityStore),
    turnExecutionFacade,
    logger: mockLogger, // Direct access to logger for test utilities
    mockDeps: {
      llm: mockLLMDeps,
      action: mockActionDeps,
      entity: mockEntityDeps,
      logger: mockLogger,
    },
    // Global cleanup method
    cleanupAll() {
      mockEntityStore.clear();
      // Clear any other shared resources
      if (mockLogger.debug && mockLogger.debug.mockClear) {
        mockLogger.debug.mockClear();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
      }
    },
  };
}

// Note: createTestModules function and test module exports have been removed.
// Test modules are now located in tests/common/testing/builders/ to avoid src->test dependencies.
// Import them directly from there in your test files.
