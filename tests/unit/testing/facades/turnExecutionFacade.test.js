/**
 * @file Unit tests for the TurnExecutionFacade class.
 * @description Tests the turn execution facade that simplifies turn-based gameplay
 * testing by orchestrating LLM, action, and entity service facades.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { TurnExecutionFacade } from '../../../../src/testing/facades/turnExecutionFacade.js';

describe('TurnExecutionFacade', () => {
  let mockDependencies;
  let facade;

  // Mock LLM service facade
  const mockLLMService = {
    getAIDecision: jest.fn(),
    configureLLMStrategy: jest.fn(),
    setMockResponse: jest.fn(),
    clearMockResponses: jest.fn(),
    dispose: jest.fn(),
  };

  // Mock action service facade
  const mockActionService = {
    discoverActions: jest.fn(),
    validateAction: jest.fn(),
    executeAction: jest.fn(),
    setMockActions: jest.fn(),
    setMockValidation: jest.fn(),
    clearMockData: jest.fn(),
    dispose: jest.fn(),
  };

  // Mock entity service facade
  const mockEntityService = {
    createTestActor: jest.fn(),
    createTestWorld: jest.fn(),
    getDispatchedEvents: jest.fn(),
    clearTestData: jest.fn(),
    dispose: jest.fn(),
  };

  // Mock logger
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create default mock dependencies
    mockDependencies = {
      llmService: mockLLMService,
      actionService: mockActionService,
      entityService: mockEntityService,
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      facade = new TurnExecutionFacade(mockDependencies);
      expect(facade).toBeInstanceOf(TurnExecutionFacade);
    });

    test('should throw error when llmService is missing', () => {
      delete mockDependencies.llmService;
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid llmService dependency.'
      );
    });

    test('should throw error when llmService lacks getAIDecision method', () => {
      mockDependencies.llmService = { configureLLMStrategy: jest.fn() };
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid llmService dependency.'
      );
    });

    test('should throw error when actionService is missing', () => {
      delete mockDependencies.actionService;
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid actionService dependency.'
      );
    });

    test('should throw error when actionService lacks discoverActions method', () => {
      mockDependencies.actionService = { validateAction: jest.fn() };
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid actionService dependency.'
      );
    });

    test('should throw error when entityService is missing', () => {
      delete mockDependencies.entityService;
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid entityService dependency.'
      );
    });

    test('should throw error when entityService lacks createTestActor method', () => {
      mockDependencies.entityService = { createTestWorld: jest.fn() };
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid entityService dependency.'
      );
    });

    test('should throw error when logger is missing', () => {
      delete mockDependencies.logger;
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid logger dependency.'
      );
    });

    test('should throw error when logger lacks debug method', () => {
      mockDependencies.logger = { info: jest.fn() };
      expect(() => new TurnExecutionFacade(mockDependencies)).toThrow(
        'TurnExecutionFacade: Missing or invalid logger dependency.'
      );
    });
  });

  describe('initializeTestEnvironment', () => {
    beforeEach(() => {
      facade = new TurnExecutionFacade(mockDependencies);
    });

    test('should initialize test environment with default configuration', async () => {
      const mockWorld = {
        id: 'world-1',
        mainLocationId: 'location-1',
        locations: ['location-1'],
      };

      mockLLMService.configureLLMStrategy.mockResolvedValue();
      mockEntityService.createTestWorld.mockResolvedValue(mockWorld);
      mockEntityService.createTestActor
        .mockResolvedValueOnce('actor-ai-1')
        .mockResolvedValueOnce('actor-player-1');

      const result = await facade.initializeTestEnvironment();

      expect(mockLLMService.configureLLMStrategy).toHaveBeenCalledWith(
        'tool-calling',
        {}
      );
      expect(mockEntityService.createTestWorld).toHaveBeenCalledWith({
        createConnections: false,
      });
      expect(mockEntityService.createTestActor).toHaveBeenCalledTimes(2);
      
      expect(result).toMatchObject({
        world: mockWorld,
        actors: {
          aiActorId: 'actor-ai-1',
          playerActorId: 'actor-player-1',
        },
        actorIds: ['actor-ai-1', 'actor-player-1'],
        aiActor: { id: 'actor-ai-1' },
        initialized: expect.any(Number),
      });
    });

    test('should initialize test environment with custom actors array', async () => {
      const mockWorld = {
        id: 'world-1',
        mainLocationId: 'location-1',
      };

      const customActors = [
        { id: 'npc1', name: 'Guard', type: 'ai', location: 'location-1' },
        { id: 'npc2', name: 'Merchant', type: 'ai', location: 'location-2' },
      ];

      mockLLMService.configureLLMStrategy.mockResolvedValue();
      mockEntityService.createTestWorld.mockResolvedValue(mockWorld);
      mockEntityService.createTestActor
        .mockResolvedValueOnce('actor-1')
        .mockResolvedValueOnce('actor-2');

      const result = await facade.initializeTestEnvironment({
        actors: customActors,
      });

      expect(mockEntityService.createTestActor).toHaveBeenCalledTimes(2);
      expect(mockEntityService.createTestActor).toHaveBeenCalledWith({
        id: 'npc1',
        name: 'Guard',
        location: 'location-1',
        components: {
          'core:actor': { type: 'ai' },
        },
      });
      
      expect(result.actors).toEqual({
        npc1: 'actor-1',
        npc2: 'actor-2',
      });
      expect(result.actorIds).toEqual(['actor-1', 'actor-2']);
    });

    test('should handle error during initialization', async () => {
      const error = new Error('Test initialization error');
      mockLLMService.configureLLMStrategy.mockRejectedValue(error);

      await expect(facade.initializeTestEnvironment()).rejects.toThrow(
        'Test initialization error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnExecutionFacade: Error initializing test environment',
        error
      );
    });

    test('should configure world with custom settings', async () => {
      const mockWorld = { id: 'world-1', mainLocationId: 'location-1' };
      const worldConfig = {
        name: 'Test World',
        description: 'A test world',
        createConnections: true,
      };

      mockLLMService.configureLLMStrategy.mockResolvedValue();
      mockEntityService.createTestWorld.mockResolvedValue(mockWorld);
      mockEntityService.createTestActor
        .mockResolvedValueOnce('actor-1')
        .mockResolvedValueOnce('actor-2');

      await facade.initializeTestEnvironment({
        worldConfig,
        createConnections: false, // Should be overridden by worldConfig
      });

      expect(mockEntityService.createTestWorld).toHaveBeenCalledWith({
        name: 'Test World',
        description: 'A test world',
        createConnections: true,
      });
    });
  });

  describe('executeAITurn', () => {
    beforeEach(async () => {
      facade = new TurnExecutionFacade(mockDependencies);
      
      // Initialize test environment first
      const mockWorld = {
        id: 'world-1',
        mainLocationId: 'location-1',
      };
      mockLLMService.configureLLMStrategy.mockResolvedValue();
      mockEntityService.createTestWorld.mockResolvedValue(mockWorld);
      mockEntityService.createTestActor.mockResolvedValue('actor-1');
      
      await facade.initializeTestEnvironment();
      jest.clearAllMocks();
    });

    test('should execute successful AI turn', async () => {
      const actorId = 'actor-1';
      const availableActions = [
        { id: 'core:move', name: 'Move' },
        { id: 'core:look', name: 'Look' },
      ];
      const aiDecision = {
        actionId: 'core:move',
        targets: { direction: 'north' },
      };
      const validation = { success: true };
      const execution = { success: true, results: [] };

      mockActionService.discoverActions.mockResolvedValue(availableActions);
      mockLLMService.getAIDecision.mockResolvedValue(aiDecision);
      mockActionService.validateAction.mockResolvedValue(validation);
      mockActionService.executeAction.mockResolvedValue(execution);

      const result = await facade.executeAITurn(actorId);

      expect(mockActionService.discoverActions).toHaveBeenCalledWith(actorId);
      expect(mockLLMService.getAIDecision).toHaveBeenCalledWith(actorId, {
        availableActions,
      });
      expect(mockActionService.validateAction).toHaveBeenCalledWith({
        actionId: 'core:move',
        actorId,
        targets: { direction: 'north' },
      });
      expect(mockActionService.executeAction).toHaveBeenCalledWith({
        actionId: 'core:move',
        actorId,
        targets: { direction: 'north' },
      });

      expect(result).toMatchObject({
        success: true,
        actorId,
        aiDecision,
        validation,
        execution,
        availableActionCount: 2,
        duration: expect.any(Number),
      });
    });

    test('should throw error when test environment not initialized', async () => {
      const uninitializedFacade = new TurnExecutionFacade(mockDependencies);
      
      await expect(
        uninitializedFacade.executeAITurn('actor-1')
      ).rejects.toThrow(
        'TurnExecutionFacade: Test environment not initialized. Call initializeTestEnvironment() first.'
      );
    });

    test('should handle no available actions', async () => {
      mockActionService.discoverActions.mockResolvedValue([]);

      const result = await facade.executeAITurn('actor-1');

      expect(result).toMatchObject({
        success: false,
        error: 'No available actions found for actor',
        actorId: 'actor-1',
        duration: expect.any(Number),
      });
    });

    test('should handle AI decision without valid action', async () => {
      mockActionService.discoverActions.mockResolvedValue([
        { id: 'core:move' },
      ]);
      mockLLMService.getAIDecision.mockResolvedValue({
        // Missing actionId
        targets: {},
      });

      const result = await facade.executeAITurn('actor-1');

      expect(result).toMatchObject({
        success: false,
        error: 'AI decision did not specify a valid action',
        aiDecision: { targets: {} },
        duration: expect.any(Number),
      });
    });

    test('should handle validation failure', async () => {
      mockActionService.discoverActions.mockResolvedValue([
        { id: 'core:move' },
      ]);
      mockLLMService.getAIDecision.mockResolvedValue({
        actionId: 'core:move',
        targets: {},
      });
      mockActionService.validateAction.mockResolvedValue({
        success: false,
        errors: ['Invalid target'],
      });

      const result = await facade.executeAITurn('actor-1');

      expect(result).toMatchObject({
        success: false,
        error: 'Action validation failed',
        validation: { success: false, errors: ['Invalid target'] },
        duration: expect.any(Number),
      });
    });

    test('should handle execution failure', async () => {
      mockActionService.discoverActions.mockResolvedValue([
        { id: 'core:move' },
      ]);
      mockLLMService.getAIDecision.mockResolvedValue({
        actionId: 'core:move',
        targets: {},
      });
      mockActionService.validateAction.mockResolvedValue({ success: true });
      mockActionService.executeAction.mockResolvedValue({
        success: false,
        error: 'Execution failed',
      });

      const result = await facade.executeAITurn('actor-1');

      expect(result).toMatchObject({
        success: false,
        error: 'Action execution failed',
        execution: { success: false, error: 'Execution failed' },
        duration: expect.any(Number),
      });
    });

    test('should skip execution with validateOnly option', async () => {
      mockActionService.discoverActions.mockResolvedValue([
        { id: 'core:move' },
      ]);
      mockLLMService.getAIDecision.mockResolvedValue({
        actionId: 'core:move',
        targets: {},
      });
      mockActionService.validateAction.mockResolvedValue({ success: true });

      const result = await facade.executeAITurn(
        'actor-1',
        {},
        { validateOnly: true }
      );

      expect(mockActionService.executeAction).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        execution: null,
        duration: expect.any(Number),
      });
    });

    test('should handle exception during turn execution', async () => {
      const error = new Error('Unexpected error');
      mockActionService.discoverActions.mockRejectedValue(error);

      const result = await facade.executeAITurn('actor-1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnExecutionFacade: Error executing AI turn',
        error
      );
      expect(result).toMatchObject({
        success: false,
        error: 'Unexpected error',
        actorId: 'actor-1',
        duration: expect.any(Number),
      });
    });
  });

  describe('executePlayerTurn', () => {
    beforeEach(async () => {
      facade = new TurnExecutionFacade(mockDependencies);
      
      // Initialize test environment
      const mockWorld = {
        id: 'world-1',
        mainLocationId: 'location-1',
      };
      mockLLMService.configureLLMStrategy.mockResolvedValue();
      mockEntityService.createTestWorld.mockResolvedValue(mockWorld);
      mockEntityService.createTestActor.mockResolvedValue('actor-1');
      
      await facade.initializeTestEnvironment();
      jest.clearAllMocks();
    });

    test('should execute successful player turn', async () => {
      const validation = { success: true };
      const execution = { success: true, results: [] };

      mockActionService.validateAction.mockResolvedValue(validation);
      mockActionService.executeAction.mockResolvedValue(execution);

      const result = await facade.executePlayerTurn('actor-1', 'go north');

      expect(mockActionService.validateAction).toHaveBeenCalledWith({
        actionId: 'core:move',
        actorId: 'actor-1',
        targets: { object: 'north' },
      });
      expect(mockActionService.executeAction).toHaveBeenCalledWith({
        actionId: 'core:move',
        actorId: 'actor-1',
        targets: { object: 'north' },
      });

      expect(result).toMatchObject({
        success: true,
        actorId: 'actor-1',
        command: 'go north',
        parsedCommand: {
          actionId: 'core:move',
          targets: { object: 'north' },
        },
        validation,
        execution,
        duration: expect.any(Number),
      });
    });

    test('should parse various player commands', async () => {
      const testCases = [
        { command: 'move east', expectedAction: 'core:move', expectedTarget: 'east' },
        { command: 'look around', expectedAction: 'core:look', expectedTarget: 'around' },
        { command: 'examine sword', expectedAction: 'core:examine', expectedTarget: 'sword' },
        { command: 'take key', expectedAction: 'core:take', expectedTarget: 'key' },
        { command: 'get potion', expectedAction: 'core:take', expectedTarget: 'potion' },
        { command: 'drop book', expectedAction: 'core:drop', expectedTarget: 'book' },
        { command: 'say hello', expectedAction: 'core:say', expectedTarget: 'hello' },
        { command: 'talk merchant', expectedAction: 'core:talk', expectedTarget: 'merchant' },
        { command: 'attack goblin', expectedAction: 'core:attack', expectedTarget: 'goblin' },
      ];

      mockActionService.validateAction.mockResolvedValue({ success: true });
      mockActionService.executeAction.mockResolvedValue({ success: true });

      for (const { command, expectedAction, expectedTarget } of testCases) {
        const result = await facade.executePlayerTurn('actor-1', command);
        expect(result.parsedCommand.actionId).toBe(expectedAction);
        expect(result.parsedCommand.targets.object).toBe(expectedTarget);
      }
    });

    test('should throw error when test environment not initialized', async () => {
      const uninitializedFacade = new TurnExecutionFacade(mockDependencies);
      
      await expect(
        uninitializedFacade.executePlayerTurn('actor-1', 'go north')
      ).rejects.toThrow(
        'TurnExecutionFacade: Test environment not initialized. Call initializeTestEnvironment() first.'
      );
    });

    test('should handle validation failure', async () => {
      mockActionService.validateAction.mockResolvedValue({
        success: false,
        errors: ['Invalid command'],
      });

      const result = await facade.executePlayerTurn('actor-1', 'go nowhere');

      expect(result).toMatchObject({
        success: false,
        error: 'Action validation failed',
        validation: { success: false, errors: ['Invalid command'] },
        command: 'go nowhere',
        duration: expect.any(Number),
      });
    });

    test('should handle execution failure', async () => {
      mockActionService.validateAction.mockResolvedValue({ success: true });
      mockActionService.executeAction.mockResolvedValue({
        success: false,
        error: 'Cannot move in that direction',
      });

      const result = await facade.executePlayerTurn('actor-1', 'go north');

      expect(result).toMatchObject({
        success: false,
        actorId: 'actor-1',
        command: 'go north',
        execution: { success: false, error: 'Cannot move in that direction' },
        duration: expect.any(Number),
      });
    });

    test('should handle exception during turn execution', async () => {
      const error = new Error('Command parsing error');
      mockActionService.validateAction.mockRejectedValue(error);

      const result = await facade.executePlayerTurn('actor-1', 'invalid command');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnExecutionFacade: Error executing player turn',
        error
      );
      expect(result).toMatchObject({
        success: false,
        error: 'Command parsing error',
        actorId: 'actor-1',
        command: 'invalid command',
        duration: expect.any(Number),
      });
    });
  });

  describe('setupMocks', () => {
    beforeEach(() => {
      facade = new TurnExecutionFacade(mockDependencies);
    });

    test('should setup AI response mocks', () => {
      const mocks = {
        aiResponses: {
          'actor-1': { actionId: 'core:move', targets: {} },
          'actor-2': { actionId: 'core:look', targets: {} },
        },
      };

      facade.setupMocks(mocks);

      expect(mockLLMService.setMockResponse).toHaveBeenCalledTimes(2);
      expect(mockLLMService.setMockResponse).toHaveBeenCalledWith(
        'actor-1',
        { actionId: 'core:move', targets: {} }
      );
      expect(mockLLMService.setMockResponse).toHaveBeenCalledWith(
        'actor-2',
        { actionId: 'core:look', targets: {} }
      );
    });

    test('should setup action result mocks', () => {
      const mocks = {
        actionResults: {
          'actor-1': [{ id: 'core:move' }, { id: 'core:look' }],
          'actor-2': [{ id: 'core:talk' }],
        },
      };

      facade.setupMocks(mocks);

      expect(mockActionService.setMockActions).toHaveBeenCalledTimes(2);
      expect(mockActionService.setMockActions).toHaveBeenCalledWith(
        'actor-1',
        [{ id: 'core:move' }, { id: 'core:look' }]
      );
      expect(mockActionService.setMockActions).toHaveBeenCalledWith(
        'actor-2',
        [{ id: 'core:talk' }]
      );
    });

    test('should setup validation result mocks', () => {
      const mocks = {
        validationResults: {
          'actor-1:core:move': { success: true },
          'actor-2:core:special:action': { success: false, errors: ['Invalid'] },
        },
      };

      facade.setupMocks(mocks);

      expect(mockActionService.setMockValidation).toHaveBeenCalledTimes(2);
      expect(mockActionService.setMockValidation).toHaveBeenCalledWith(
        'actor-1',
        'core:move',
        { success: true }
      );
      expect(mockActionService.setMockValidation).toHaveBeenCalledWith(
        'actor-2',
        'core:special:action',
        { success: false, errors: ['Invalid'] }
      );
    });

    test('should handle empty mocks', () => {
      facade.setupMocks({});
      
      expect(mockLLMService.setMockResponse).not.toHaveBeenCalled();
      expect(mockActionService.setMockActions).not.toHaveBeenCalled();
      expect(mockActionService.setMockValidation).not.toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      facade = new TurnExecutionFacade(mockDependencies);
    });

    test('should get test environment when initialized', async () => {
      const mockWorld = { id: 'world-1' };
      mockLLMService.configureLLMStrategy.mockResolvedValue();
      mockEntityService.createTestWorld.mockResolvedValue(mockWorld);
      mockEntityService.createTestActor.mockResolvedValue('actor-1');
      
      const env = await facade.initializeTestEnvironment();
      const retrieved = facade.getTestEnvironment();
      
      expect(retrieved).toBe(env);
    });

    test('should return null test environment when not initialized', () => {
      const env = facade.getTestEnvironment();
      expect(env).toBeNull();
    });

    test('should get dispatched events without filter', () => {
      const mockEvents = [
        { type: 'ACTION_EXECUTED', payload: {} },
        { type: 'TURN_STARTED', payload: {} },
      ];
      mockEntityService.getDispatchedEvents.mockReturnValue(mockEvents);

      const events = facade.getDispatchedEvents();

      expect(mockEntityService.getDispatchedEvents).toHaveBeenCalledWith(
        undefined
      );
      expect(events).toBe(mockEvents);
    });

    test('should get dispatched events with filter', () => {
      const mockEvents = [{ type: 'ACTION_EXECUTED', payload: {} }];
      mockEntityService.getDispatchedEvents.mockReturnValue(mockEvents);

      const events = facade.getDispatchedEvents('ACTION_EXECUTED');

      expect(mockEntityService.getDispatchedEvents).toHaveBeenCalledWith(
        'ACTION_EXECUTED'
      );
      expect(events).toBe(mockEvents);
    });

    test('should clear test data', async () => {
      await facade.clearTestData();

      expect(mockLLMService.clearMockResponses).toHaveBeenCalled();
      expect(mockActionService.clearMockData).toHaveBeenCalled();
      expect(mockEntityService.clearTestData).toHaveBeenCalled();
      expect(facade.getTestEnvironment()).toBeNull();
    });

    test('should provide access to service facades', () => {
      expect(facade.llmService).toBe(mockLLMService);
      expect(facade.actionService).toBe(mockActionService);
      expect(facade.entityService).toBe(mockEntityService);
    });
  });

  describe('dispose', () => {
    beforeEach(() => {
      facade = new TurnExecutionFacade(mockDependencies);
    });

    test('should dispose all resources', async () => {
      await facade.dispose();

      expect(mockLLMService.clearMockResponses).toHaveBeenCalled();
      expect(mockActionService.clearMockData).toHaveBeenCalled();
      expect(mockEntityService.clearTestData).toHaveBeenCalled();
      expect(mockLLMService.dispose).toHaveBeenCalled();
      expect(mockActionService.dispose).toHaveBeenCalled();
      expect(mockEntityService.dispose).toHaveBeenCalled();
    });

    test('should handle missing dispose methods gracefully', async () => {
      // Remove dispose methods
      delete mockLLMService.dispose;
      delete mockActionService.dispose;
      delete mockEntityService.dispose;

      // Should not throw
      await expect(facade.dispose()).resolves.not.toThrow();
    });
  });
});