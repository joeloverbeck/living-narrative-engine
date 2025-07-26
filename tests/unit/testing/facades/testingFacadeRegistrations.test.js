/**
 * @file Unit tests for testingFacadeRegistrations.js
 * @description Tests for the dependency injection registration and mock facade creation functions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  registerTestingFacades,
  createMockFacades,
  createTestModules,
} from '../../../../src/testing/facades/testingFacadeRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { LLMServiceFacade } from '../../../../src/testing/facades/llmServiceFacade.js';
import { ActionServiceFacade } from '../../../../src/testing/facades/actionServiceFacade.js';
import { EntityServiceFacade } from '../../../../src/testing/facades/entityServiceFacade.js';
import { TurnExecutionFacade } from '../../../../src/testing/facades/turnExecutionFacade.js';
import { TurnExecutionTestModule } from '../../../common/builders/modules/turnExecutionTestModule.js';
import { ActionProcessingTestModule } from '../../../common/builders/modules/actionProcessingTestModule.js';
import { TestScenarioPresets } from '../../../common/builders/presets/testScenarioPresets.js';

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
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
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
        actionPipelineOrchestrator: { execute: jest.fn() },
        availableActionsProvider: { getAvailableActions: jest.fn() },
        actionIndex: { getActionDefinition: jest.fn() },
        targetResolutionService: { resolveTargets: jest.fn() },
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
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

    it('should create EntityServiceFacade with resolved dependencies', () => {
      const mockDependencies = {
        entityManager: { createEntity: jest.fn(), getEntityInstance: jest.fn() },
        eventBus: { dispatch: jest.fn() },
        dataRegistry: { get: jest.fn() },
        scopeRegistry: { getScope: jest.fn() },
        gameDataRepository: { getEntityDefinition: jest.fn() },
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
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
      const mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

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
      expect(facades.mockDeps.action.actionDiscoveryService.discoverActions).toBeDefined();
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
      await expect(facades.mockDeps.llm.llmAdapter.getAIDecision()).resolves.toEqual({ actionId: 'core:look' });
      await expect(facades.mockDeps.llm.llmChooser.getAIChoice()).resolves.toBe('choice');
      await expect(facades.mockDeps.llm.promptPipeline.generatePrompt()).resolves.toBe('prompt');
      await expect(facades.mockDeps.llm.responseProcessor.processResponse()).resolves.toEqual({ processed: true });
      await expect(facades.mockDeps.llm.decisionProvider.getDecision()).resolves.toEqual({ actionId: 'core:look' });
      
      await expect(facades.mockDeps.action.actionDiscoveryService.discoverActions()).resolves.toEqual({ actions: [] });
      await expect(facades.mockDeps.action.actionPipelineOrchestrator.execute()).resolves.toEqual({
        success: true,
        effects: ['Action executed successfully'],
        description: 'The action was performed.',
      });
      await expect(facades.mockDeps.action.availableActionsProvider.getAvailableActions()).resolves.toEqual([]);
      await expect(facades.mockDeps.action.actionIndex.getActionDefinition()).resolves.toEqual({ id: 'test-action' });
      await expect(facades.mockDeps.action.targetResolutionService.resolveTargets()).resolves.toEqual({});
    });

    it('should handle entity manager createEntity with mock store', async () => {
      const facades = createMockFacades({}, jest.fn);

      const config = {
        id: 'test-entity-1',
        components: { 'core:name': { value: 'Test Entity' } },
      };

      const entityId = await facades.mockDeps.entity.entityManager.createEntity(config);
      expect(entityId).toBe('test-entity-1');

      const entity = await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
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

      const entityId = await facades.mockDeps.entity.entityManager.createEntity(config);
      expect(entityId).toBe('test-entity-2');

      const entity = await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity).toEqual({
        id: 'test-entity-2',
        components: { 'core:name': { value: 'Test Entity 2' } },
      });
    });

    it('should handle entity manager updateComponent', async () => {
      const facades = createMockFacades({}, jest.fn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity({
        id: 'test-entity-3',
        components: { 'core:name': { value: 'Original Name' } },
      });

      await facades.mockDeps.entity.entityManager.updateComponent(
        entityId,
        'core:name',
        { value: 'Updated Name' }
      );

      const entity = await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity.components['core:name']).toEqual({ value: 'Updated Name' });
    });

    it('should handle entity manager updateComponent without jest', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity({
        id: 'test-entity-4',
        components: {},
      });

      await facades.mockDeps.entity.entityManager.updateComponent(
        entityId,
        'core:location',
        { value: 'New Location' }
      );

      const entity = await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity.components['core:location']).toEqual({ value: 'New Location' });
    });

    it('should handle entity manager removeEntity', async () => {
      const facades = createMockFacades({}, jest.fn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity({
        id: 'test-entity-5',
      });

      const removed = await facades.mockDeps.entity.entityManager.removeEntity(entityId);
      expect(removed).toBe(true);

      const entity = await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity).toBeNull();
    });

    it('should handle entity manager removeEntity without jest', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const entityId = await facades.mockDeps.entity.entityManager.createEntity({
        id: 'test-entity-6',
      });

      const removed = await facades.mockDeps.entity.entityManager.removeEntity(entityId);
      expect(removed).toBe(true);

      const entity = await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity).toBeNull();
    });

    it('should handle eventBus dispatch', async () => {
      const facades = createMockFacades({}, jest.fn);

      const event = { type: 'TEST_EVENT', payload: { data: 'test' } };
      await expect(facades.mockDeps.entity.eventBus.dispatch(event)).resolves.toBeUndefined();
    });

    it('should handle eventBus dispatch without jest', async () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const event = { type: 'TEST_EVENT', payload: { data: 'test' } };
      await expect(facades.mockDeps.entity.eventBus.dispatch(event)).resolves.toBeUndefined();
    });

    it('should handle gameDataRepository getEntityDefinition', () => {
      const facades = createMockFacades({}, jest.fn);

      const actorDef = facades.mockDeps.entity.gameDataRepository.getEntityDefinition('core:actor');
      expect(actorDef).toEqual({
        id: 'core:actor',
        components: {
          'core:actor': {},
          'core:name': {},
          'core:location': {},
        },
      });

      const locationDef = facades.mockDeps.entity.gameDataRepository.getEntityDefinition('core:location');
      expect(locationDef).toEqual({
        id: 'core:location',
        components: {
          'core:location': {},
          'core:name': {},
          'core:description': {},
        },
      });

      const unknownDef = facades.mockDeps.entity.gameDataRepository.getEntityDefinition('unknown:entity');
      expect(unknownDef).toBeNull();
    });

    it('should handle gameDataRepository getEntityDefinition without jest', () => {
      const simpleMockFn = () => () => {};
      const facades = createMockFacades({}, simpleMockFn);

      const actorDef = facades.mockDeps.entity.gameDataRepository.getEntityDefinition('core:actor');
      expect(actorDef).toEqual({
        id: 'core:actor',
        components: {
          'core:actor': {},
          'core:name': {},
          'core:location': {},
        },
      });

      const unknownDef = facades.mockDeps.entity.gameDataRepository.getEntityDefinition('unknown:entity');
      expect(unknownDef).toBeNull();
    });

    it('should handle entity creation with auto-generated ID', async () => {
      const facades = createMockFacades({}, jest.fn);

      const config = {
        components: { 'core:name': { value: 'Auto ID Entity' } },
      };

      const entityId = await facades.mockDeps.entity.entityManager.createEntity(config);
      expect(entityId).toMatch(/^entity-\d+-[\d.]+$/);

      const entity = await facades.mockDeps.entity.entityManager.getEntityInstance(entityId);
      expect(entity.components).toEqual({ 'core:name': { value: 'Auto ID Entity' } });
    });

    it('should merge custom LLM dependencies', () => {
      const customLLMDeps = {
        llmAdapter: { getAIDecision: jest.fn().mockResolvedValue({ actionId: 'custom:action' }) },
      };

      const facades = createMockFacades({ llm: customLLMDeps }, jest.fn);

      expect(facades.mockDeps.llm.llmAdapter.getAIDecision).toBe(customLLMDeps.llmAdapter.getAIDecision);
      // Other LLM deps should still have defaults
      expect(facades.mockDeps.llm.llmChooser).toBeDefined();
      expect(facades.mockDeps.llm.promptPipeline).toBeDefined();
    });

    it('should merge custom action dependencies', () => {
      const customActionDeps = {
        actionDiscoveryService: { discoverActions: jest.fn().mockResolvedValue({ actions: ['custom'] }) },
      };

      const facades = createMockFacades({ action: customActionDeps }, jest.fn);

      expect(facades.mockDeps.action.actionDiscoveryService.discoverActions).toBe(
        customActionDeps.actionDiscoveryService.discoverActions
      );
      // Other action deps should still have defaults
      expect(facades.mockDeps.action.actionPipelineOrchestrator).toBeDefined();
      expect(facades.mockDeps.action.availableActionsProvider).toBeDefined();
    });

    it('should merge custom entity dependencies', () => {
      const customEntityDeps = {
        entityManager: { createEntity: jest.fn().mockResolvedValue('custom-entity-id') },
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

  describe('createTestModules', () => {
    it('should return an object with forTurnExecution and forActionProcessing functions', () => {
      const modules = createTestModules(jest.fn);

      expect(modules).toHaveProperty('forTurnExecution');
      expect(modules).toHaveProperty('forActionProcessing');
      expect(modules).toHaveProperty('scenarios');
      expect(typeof modules.forTurnExecution).toBe('function');
      expect(typeof modules.forActionProcessing).toBe('function');
    });

    it('should export createTestModules function directly', () => {
      // Import the function directly to ensure it's exported
      const { createTestModules: directImport } = require('../../../../src/testing/facades/testingFacadeRegistrations.js');
      expect(directImport).toBeDefined();
      expect(typeof directImport).toBe('function');
      
      // Test that it works
      const modules = directImport(jest.fn);
      expect(modules).toHaveProperty('forTurnExecution');
    });

    it('should create TurnExecutionTestModule instance', () => {
      const modules = createTestModules(jest.fn);
      const turnModule = modules.forTurnExecution();

      expect(turnModule).toBeInstanceOf(TurnExecutionTestModule);
    });

    it('should create ActionProcessingTestModule instance', () => {
      const modules = createTestModules(jest.fn);
      const actionModule = modules.forActionProcessing();

      expect(actionModule).toBeInstanceOf(ActionProcessingTestModule);
    });

    it('should provide scenario presets', () => {
      const modules = createTestModules(jest.fn);

      expect(modules.scenarios).toHaveProperty('combat');
      expect(modules.scenarios).toHaveProperty('socialInteraction');
      expect(modules.scenarios).toHaveProperty('exploration');
      expect(modules.scenarios).toHaveProperty('performance');

      // Test that each scenario returns a function
      expect(typeof modules.scenarios.combat).toBe('function');
      expect(typeof modules.scenarios.socialInteraction).toBe('function');
      expect(typeof modules.scenarios.exploration).toBe('function');
      expect(typeof modules.scenarios.performance).toBe('function');
    });

    it('should call TestScenarioPresets methods when scenario functions are invoked', () => {
      // Mock the TestScenarioPresets static methods
      const combatSpy = jest.spyOn(TestScenarioPresets, 'combat').mockReturnValue('combat-preset');
      const socialSpy = jest.spyOn(TestScenarioPresets, 'socialInteraction').mockReturnValue('social-preset');
      const explorationSpy = jest.spyOn(TestScenarioPresets, 'exploration').mockReturnValue('exploration-preset');
      const performanceSpy = jest.spyOn(TestScenarioPresets, 'performance').mockReturnValue('performance-preset');

      const modules = createTestModules(jest.fn);

      // Call each scenario function
      const combatResult = modules.scenarios.combat();
      const socialResult = modules.scenarios.socialInteraction();
      const explorationResult = modules.scenarios.exploration();
      const performanceResult = modules.scenarios.performance();

      // Verify the TestScenarioPresets methods were called
      expect(combatSpy).toHaveBeenCalled();
      expect(socialSpy).toHaveBeenCalled();
      expect(explorationSpy).toHaveBeenCalled();
      expect(performanceSpy).toHaveBeenCalled();

      // Verify return values
      expect(combatResult).toBe('combat-preset');
      expect(socialResult).toBe('social-preset');
      expect(explorationResult).toBe('exploration-preset');
      expect(performanceResult).toBe('performance-preset');

      // Restore mocks
      combatSpy.mockRestore();
      socialSpy.mockRestore();
      explorationSpy.mockRestore();
      performanceSpy.mockRestore();
    });

    it('should work with non-jest mock functions', () => {
      const simpleMockFn = () => () => {};
      const modules = createTestModules(simpleMockFn);

      expect(modules.forTurnExecution).toBeDefined();
      expect(modules.forActionProcessing).toBeDefined();
      expect(modules.scenarios).toBeDefined();
    });

    it('should pass mock function to test modules', () => {
      const customMockFn = jest.fn(() => jest.fn());
      const modules = createTestModules(customMockFn);

      // Create modules to verify they receive the mock function
      const turnModule = modules.forTurnExecution();
      const actionModule = modules.forActionProcessing();

      // The modules should be created successfully with the custom mock function
      expect(turnModule).toBeDefined();
      expect(actionModule).toBeDefined();
    });
  });
});