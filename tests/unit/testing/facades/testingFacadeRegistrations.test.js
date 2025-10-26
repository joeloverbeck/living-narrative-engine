/**
 * @file Unit tests for testingFacadeRegistrations.js
 * @description Tests for the dependency injection registration and mock facade creation functions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  registerTestingFacades,
  createMockFacades,
} from '../../../common/facades/testingFacadeRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { LLMServiceFacade } from '../../../common/facades/llmServiceFacade.js';
import { ActionServiceFacade } from '../../../common/facades/actionServiceFacade.js';
import { EntityServiceFacade } from '../../../common/facades/entityServiceFacade.js';
import { TurnExecutionFacade } from '../../../common/facades/turnExecutionFacade.js';
// Test module imports removed - they're now in tests/common/testing/builders/

describe('testingFacadeRegistrations', () => {
  describe('registerTestingFacades', () => {
    let mockContainer;
    let mockResolve;

    beforeEach(() => {
      mockResolve = jest.fn();
      mockContainer = {
        register: jest.fn(),
        resolve: mockResolve,
      };
    });

    it('should register all testing facades with the container', () => {
      registerTestingFacades(mockContainer);

      // Should register 4 facades
      expect(mockContainer.register).toHaveBeenCalledTimes(4);

      // Check that each facade is registered with the correct token
      expect(mockContainer.register).toHaveBeenCalledWith(
        tokens.ILLMServiceFacade,
        expect.any(Function),
        { lifecycle: 'singleton' }
      );
      expect(mockContainer.register).toHaveBeenCalledWith(
        tokens.IActionServiceFacade,
        expect.any(Function),
        { lifecycle: 'singleton' }
      );
      expect(mockContainer.register).toHaveBeenCalledWith(
        tokens.IEntityServiceFacade,
        expect.any(Function),
        { lifecycle: 'singleton' }
      );
      expect(mockContainer.register).toHaveBeenCalledWith(
        tokens.ITurnExecutionFacade,
        expect.any(Function),
        { lifecycle: 'singleton' }
      );
    });

    it('should create LLMServiceFacade with resolved dependencies', () => {
      const mockDependencies = {
        llmAdapter: { getAIDecision: jest.fn() },
        llmChooser: { getAIChoice: jest.fn() },
        promptPipeline: { generatePrompt: jest.fn() },
        responseProcessor: { processResponse: jest.fn() },
        decisionProvider: { getDecision: jest.fn() },
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      };

      mockResolve.mockImplementation((token) => {
        const tokenToKey = {
          [tokens.LLMAdapter]: 'llmAdapter',
          [tokens.ILLMChooser]: 'llmChooser',
          [tokens.IAIPromptPipeline]: 'promptPipeline',
          [tokens.ILLMResponseProcessor]: 'responseProcessor',
          [tokens.ILLMDecisionProvider]: 'decisionProvider',
          [tokens.ILogger]: 'logger',
        };
        return mockDependencies[tokenToKey[token]];
      });

      registerTestingFacades(mockContainer);

      // Get the factory function for LLMServiceFacade
      const [, llmFactory] = mockContainer.register.mock.calls.find(
        (call) => call[0] === tokens.ILLMServiceFacade
      );

      // Call the factory function
      const llmFacade = llmFactory({});

      expect(llmFacade).toBeInstanceOf(LLMServiceFacade);
    });

    it('should create ActionServiceFacade with resolved dependencies', () => {
      const mockDependencies = {
        actionDiscoveryService: { discoverActions: jest.fn() },
        actionPipelineOrchestrator: {
          discoverActions: jest.fn(),
          execute: jest.fn(),
        },
        availableActionsProvider: { getAvailableActions: jest.fn() },
        actionIndex: { getActionDefinition: jest.fn() },
        targetResolutionService: { resolveTargets: jest.fn() },
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      };

      mockResolve.mockImplementation((token) => {
        const tokenToKey = {
          [tokens.IActionDiscoveryService]: 'actionDiscoveryService',
          [tokens.ActionPipelineOrchestrator]: 'actionPipelineOrchestrator',
          [tokens.IAvailableActionsProvider]: 'availableActionsProvider',
          [tokens.ActionIndex]: 'actionIndex',
          [tokens.ITargetResolutionService]: 'targetResolutionService',
          [tokens.ILogger]: 'logger',
        };
        return mockDependencies[tokenToKey[token]];
      });

      registerTestingFacades(mockContainer);

      // Get the factory function for ActionServiceFacade
      const [, actionFactory] = mockContainer.register.mock.calls.find(
        (call) => call[0] === tokens.IActionServiceFacade
      );

      // Call the factory function
      const actionFacade = actionFactory({});

      expect(actionFacade).toBeInstanceOf(ActionServiceFacade);
    });

    it('supports ActionServiceFacade when orchestrator only provides discovery', async () => {
      const mockDependencies = {
        actionDiscoveryService: { discoverActions: jest.fn() },
        actionPipelineOrchestrator: { discoverActions: jest.fn() },
        availableActionsProvider: { getAvailableActions: jest.fn() },
        actionIndex: {
          getActionDefinition: jest.fn().mockReturnValue({
            id: 'test:action',
            targets: [],
          }),
        },
        targetResolutionService: { resolveTargets: jest.fn() },
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      };

      mockResolve.mockImplementation((token) => {
        const tokenToKey = {
          [tokens.IActionDiscoveryService]: 'actionDiscoveryService',
          [tokens.ActionPipelineOrchestrator]: 'actionPipelineOrchestrator',
          [tokens.IAvailableActionsProvider]: 'availableActionsProvider',
          [tokens.ActionIndex]: 'actionIndex',
          [tokens.ITargetResolutionService]: 'targetResolutionService',
          [tokens.ILogger]: 'logger',
        };
        return mockDependencies[tokenToKey[token]];
      });

      registerTestingFacades(mockContainer);

      const [, actionFactory] = mockContainer.register.mock.calls.find(
        (call) => call[0] === tokens.IActionServiceFacade
      );

      const actionFacade = actionFactory({});

      expect(actionFacade).toBeInstanceOf(ActionServiceFacade);

      const validation = await actionFacade.validateAction({
        actionId: 'test:action',
        actorId: 'actor-1',
      });

      expect(validation.success).toBe(false);
      expect(validation.code).toBe('PIPELINE_UNAVAILABLE');
      expect(validation.error).toContain('execute');
    });

    it('should create EntityServiceFacade with resolved dependencies', () => {
      const mockDependencies = {
        entityManager: {
          createEntity: jest.fn(),
          getEntityInstance: jest.fn(),
        },
        eventBus: { dispatch: jest.fn() },
        dataRegistry: { get: jest.fn() },
        scopeRegistry: { getScope: jest.fn() },
        gameDataRepository: { getEntityDefinition: jest.fn() },
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      };

      mockResolve.mockImplementation((token) => {
        const tokenToKey = {
          [tokens.IEntityManager]: 'entityManager',
          [tokens.IEventBus]: 'eventBus',
          [tokens.IDataRegistry]: 'dataRegistry',
          [tokens.IScopeRegistry]: 'scopeRegistry',
          [tokens.IGameDataRepository]: 'gameDataRepository',
          [tokens.ILogger]: 'logger',
        };
        return mockDependencies[tokenToKey[token]];
      });

      registerTestingFacades(mockContainer);

      // Get the factory function for EntityServiceFacade
      const [, entityFactory] = mockContainer.register.mock.calls.find(
        (call) => call[0] === tokens.IEntityServiceFacade
      );

      // Call the factory function
      const entityFacade = entityFactory({});

      expect(entityFacade).toBeInstanceOf(EntityServiceFacade);
    });

    it('should create TurnExecutionFacade with resolved dependencies', () => {
      const mockLLMService = {
        getAIDecision: jest.fn(),
        generatePrompt: jest.fn(),
        processResponse: jest.fn(),
        getDecision: jest.fn(),
      };
      const mockActionService = {
        discoverActions: jest.fn(),
        executeAction: jest.fn(),
        getAvailableActions: jest.fn(),
      };
      const mockEntityService = {
        createTestActor: jest.fn(),
        createEntity: jest.fn(),
        updateComponent: jest.fn(),
      };
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      mockResolve.mockImplementation((token) => {
        const tokenToKey = {
          [tokens.ILLMServiceFacade]: mockLLMService,
          [tokens.IActionServiceFacade]: mockActionService,
          [tokens.IEntityServiceFacade]: mockEntityService,
          [tokens.ILogger]: mockLogger,
        };
        return tokenToKey[token];
      });

      registerTestingFacades(mockContainer);

      // Get the factory function for TurnExecutionFacade
      const [, turnFactory] = mockContainer.register.mock.calls.find(
        (call) => call[0] === tokens.ITurnExecutionFacade
      );

      // Call the factory function
      const turnFacade = turnFactory({});

      expect(turnFacade).toBeInstanceOf(TurnExecutionFacade);
    });
  });

  describe('createMockFacades', () => {
    it('should create mock facades with default dependencies', () => {
      const facades = createMockFacades();

      expect(facades).toHaveProperty('llmService');
      expect(facades).toHaveProperty('actionService');
      expect(facades).toHaveProperty('entityService');
      expect(facades).toHaveProperty('turnExecutionFacade');
      expect(facades).toHaveProperty('mockDeps');

      expect(facades.llmService).toBeInstanceOf(LLMServiceFacade);
      expect(facades.actionService).toBeInstanceOf(ActionServiceFacade);
      expect(facades.entityService).toBeInstanceOf(EntityServiceFacade);
      expect(facades.turnExecutionFacade).toBeInstanceOf(TurnExecutionFacade);
    });

    it('should create mock facades with jest.fn mocks', () => {
      const facades = createMockFacades({}, jest.fn);

      // Test that the mocks are properly set up with jest.fn
      expect(facades.mockDeps.logger.debug).toHaveBeenCalledTimes(0);
      expect(facades.mockDeps.llm.llmAdapter.getAIDecision).toBeDefined();
      expect(
        facades.mockDeps.action.actionDiscoveryService.discoverActions
      ).toBeDefined();
      expect(facades.mockDeps.entity.entityManager.createEntity).toBeDefined();
    });

    it('should merge custom dependencies with defaults', () => {
      const customLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const facades = createMockFacades({ logger: customLogger }, jest.fn);

      expect(facades.mockDeps.logger).toBe(customLogger);
      expect(facades.mockDeps.llm.logger).toBe(customLogger);
      expect(facades.mockDeps.action.logger).toBe(customLogger);
      expect(facades.mockDeps.entity.logger).toBe(customLogger);
    });

    it('should handle non-jest mock functions gracefully', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      // Test that fallback implementations work
      await expect(
        facades.mockDeps.llm.llmAdapter.getAIDecision()
      ).resolves.toEqual({ actionId: 'core:look' });
      await expect(facades.mockDeps.llm.llmChooser.getAIChoice()).resolves.toBe(
        'choice'
      );
      await expect(
        facades.mockDeps.llm.promptPipeline.generatePrompt()
      ).resolves.toBe('prompt');
      await expect(
        facades.mockDeps.llm.responseProcessor.processResponse()
      ).resolves.toEqual({ processed: true });
      await expect(
        facades.mockDeps.llm.decisionProvider.getDecision()
      ).resolves.toEqual({ actionId: 'core:look' });

      await expect(
        facades.mockDeps.action.actionDiscoveryService.discoverActions()
      ).resolves.toEqual({
        actions: [
          { id: 'core:look', name: 'Look' },
          { id: 'core:wait', name: 'Wait' },
          { id: 'core:move', name: 'Move' },
        ],
      });
      await expect(
        facades.mockDeps.action.actionPipelineOrchestrator.execute()
      ).resolves.toEqual({
        success: true,
        effects: ['Action executed successfully'],
        description: 'The action was performed.',
      });
      await expect(
        facades.mockDeps.action.availableActionsProvider.getAvailableActions()
      ).resolves.toEqual([
        { id: 'core:look', name: 'Look' },
        { id: 'core:wait', name: 'Wait' },
        { id: 'core:move', name: 'Move' },
      ]);
      await expect(
        facades.mockDeps.action.actionIndex.getActionDefinition()
      ).resolves.toEqual({ id: 'test-action' });
      await expect(
        facades.mockDeps.action.targetResolutionService.resolveTargets()
      ).resolves.toEqual({});
    });

    it('should handle entity manager createEntity with mock store', async () => {
      const facades = createMockFacades({}, jest.fn);

      const config = {
        id: 'test-entity-1',
        components: { 'core:name': { value: 'Test Entity' } },
      };

      const entityId =
        await facades.mockDeps.entity.entityManager.createEntity(config);
      expect(entityId).toBe('test-entity-1');

      const entity =
        await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity).toEqual({
        id: 'test-entity-1',
        components: { 'core:name': { value: 'Test Entity' } },
      });
    });

    it('should handle entity manager createEntity without jest', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const config = {
        id: 'test-entity-2',
        components: { 'core:name': { value: 'Test Entity 2' } },
      };

      const entityId =
        await facades.mockDeps.entity.entityManager.createEntity(config);
      expect(entityId).toBe('test-entity-2');

      const entity =
        await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity).toEqual({
        id: 'test-entity-2',
        components: { 'core:name': { value: 'Test Entity 2' } },
      });
    });

    it('should handle entity manager updateComponent', async () => {
      const facades = createMockFacades({}, jest.fn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity(
        {
          id: 'test-entity-3',
          components: { 'core:name': { value: 'Original Name' } },
        }
      );

      await facades.mockDeps.entity.entityManager.updateComponent(
        entityId,
        'core:name',
        { value: 'Updated Name' }
      );

      const entity =
        await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity.components['core:name']).toEqual({ value: 'Updated Name' });
    });

    it('should handle entity manager updateComponent without jest', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity(
        {
          id: 'test-entity-4',
          components: {},
        }
      );

      await facades.mockDeps.entity.entityManager.updateComponent(
        entityId,
        'core:location',
        { value: 'New Location' }
      );

      const entity =
        await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity.components['core:location']).toEqual({
        value: 'New Location',
      });
    });

    it('should handle entity manager removeEntity', async () => {
      const facades = createMockFacades({}, jest.fn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity(
        {
          id: 'test-entity-5',
        }
      );

      const removed =
        await facades.mockDeps.entity.entityManager.removeEntity(entityId);
      expect(removed).toBe(true);

      const entity =
        await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity).toBeUndefined();
    });

    it('should handle entity manager removeEntity without jest', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity(
        {
          id: 'test-entity-6',
        }
      );

      const removed =
        await facades.mockDeps.entity.entityManager.removeEntity(entityId);
      expect(removed).toBe(true);

      const entity =
        await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity).toBeUndefined();
    });

    it('should handle eventBus dispatch', async () => {
      const facades = createMockFacades({}, jest.fn);

      const event = { type: 'TEST_EVENT', payload: { data: 'test' } };
      await expect(
        facades.mockDeps.entity.eventBus.dispatch(event)
      ).resolves.toBeUndefined();
    });

    it('should handle eventBus dispatch without jest', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const event = { type: 'TEST_EVENT', payload: { data: 'test' } };
      await expect(
        facades.mockDeps.entity.eventBus.dispatch(event)
      ).resolves.toBeUndefined();
    });

    it('should handle gameDataRepository getEntityDefinition', () => {
      const facades = createMockFacades({}, jest.fn);

      const actorDef =
        facades.mockDeps.entity.gameDataRepository.getEntityDefinition(
          'core:actor'
        );
      expect(actorDef).toEqual({
        id: 'core:actor',
        components: {
          'core:actor': {},
          'core:name': {},
          'core:location': {},
        },
      });

      const locationDef =
        facades.mockDeps.entity.gameDataRepository.getEntityDefinition(
          'core:location'
        );
      expect(locationDef).toEqual({
        id: 'core:location',
        components: {
          'core:location': {},
          'core:name': {},
          'core:description': {},
        },
      });

      const unknownDef =
        facades.mockDeps.entity.gameDataRepository.getEntityDefinition(
          'unknown:entity'
        );
      expect(unknownDef).toBeNull();
    });

    it('should handle gameDataRepository getEntityDefinition without jest', () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const actorDef =
        facades.mockDeps.entity.gameDataRepository.getEntityDefinition(
          'core:actor'
        );
      expect(actorDef).toEqual({
        id: 'core:actor',
        components: {
          'core:actor': {},
          'core:name': {},
          'core:location': {},
        },
      });

      const unknownDef =
        facades.mockDeps.entity.gameDataRepository.getEntityDefinition(
          'unknown:entity'
        );
      expect(unknownDef).toBeNull();
    });

    it('should handle entity creation with auto-generated ID', async () => {
      const facades = createMockFacades({}, jest.fn);

      const config = {
        components: { 'core:name': { value: 'Auto ID Entity' } },
      };

      const entityId =
        await facades.mockDeps.entity.entityManager.createEntity(config);
      expect(entityId).toMatch(/^entity-\d+-[\d.]+$/);

      const entity =
        await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity.components).toEqual({
        'core:name': { value: 'Auto ID Entity' },
      });
    });

    it('should merge custom LLM dependencies', () => {
      const customLLMDeps = {
        llmAdapter: {
          getAIDecision: jest
            .fn()
            .mockResolvedValue({ actionId: 'custom:action' }),
        },
      };

      const facades = createMockFacades({ llm: customLLMDeps }, jest.fn);

      expect(facades.mockDeps.llm.llmAdapter.getAIDecision).toBe(
        customLLMDeps.llmAdapter.getAIDecision
      );
      // Other LLM deps should still have defaults
      expect(facades.mockDeps.llm.llmChooser).toBeDefined();
      expect(facades.mockDeps.llm.promptPipeline).toBeDefined();
    });

    it('should merge custom action dependencies', () => {
      const customActionDeps = {
        actionDiscoveryService: {
          discoverActions: jest.fn().mockResolvedValue({ actions: ['custom'] }),
        },
      };

      const facades = createMockFacades({ action: customActionDeps }, jest.fn);

      expect(
        facades.mockDeps.action.actionDiscoveryService.discoverActions
      ).toBe(customActionDeps.actionDiscoveryService.discoverActions);
      // Other action deps should still have defaults
      expect(facades.mockDeps.action.actionPipelineOrchestrator).toBeDefined();
      expect(facades.mockDeps.action.availableActionsProvider).toBeDefined();
    });

    it('should merge custom entity dependencies', () => {
      const customEntityDeps = {
        entityManager: {
          createEntity: jest.fn().mockResolvedValue('custom-entity-id'),
        },
      };

      const facades = createMockFacades({ entity: customEntityDeps }, jest.fn);

      expect(facades.mockDeps.entity.entityManager.createEntity).toBe(
        customEntityDeps.entityManager.createEntity
      );
      // Other entity deps should still have defaults
      expect(facades.mockDeps.entity.eventBus).toBeDefined();
      expect(facades.mockDeps.entity.dataRegistry).toBeDefined();
    });
  });

  // createTestModules tests removed - function moved to tests/common/testing/builders/ to avoid src->test dependencies
});
