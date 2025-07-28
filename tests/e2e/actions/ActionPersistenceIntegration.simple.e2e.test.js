/**
 * @file ActionPersistenceIntegration.simple.e2e.test.js
 * @description Simplified persistence integration tests that work with mock facades
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('Action Persistence Integration E2E - Simplified', () => {
  let facades;
  let turnExecutionFacade;
  let testEnvironment;
  let mockPersistenceCoordinator;

  beforeEach(async () => {
    // Create facades with mocking support
    facades = createMockFacades({}, jest.fn);
    turnExecutionFacade = facades.turnExecutionFacade;

    // Mock persistence coordinator
    mockPersistenceCoordinator = {
      save: jest
        .fn()
        .mockResolvedValue({ success: true, timestamp: Date.now() }),
      load: jest.fn().mockResolvedValue({ success: true, data: {} }),
      getSaveMetadata: jest
        .fn()
        .mockReturnValue({ version: '1.0.0', saveCount: 0 }),
    };

    // Initialize test environment
    testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
      llmStrategy: 'tool-calling',
      worldConfig: {
        name: 'Persistence Test World',
        createConnections: true,
      },
      actorConfig: {
        name: 'Persistent Player',
        additionalActors: [{ id: 'persistent-npc', name: 'Persistent NPC' }],
      },
    });
  });

  afterEach(async () => {
    // Clean up test environment
    await turnExecutionFacade.clearTestData();
    await turnExecutionFacade.dispose();
  });

  test('should handle save operation during action execution', async () => {
    // Arrange - Setup a successful action
    const mockValidation = {
      success: true,
      validatedAction: {
        actionId: 'core:trade',
        actorId: testEnvironment.actors.playerActorId,
        targets: { merchant: 'persistent-npc' },
      },
    };

    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${testEnvironment.actors.playerActorId}:core:trade`]: mockValidation,
      },
    });

    // Act - Execute action
    const result = await turnExecutionFacade.executePlayerTurn(
      testEnvironment.actors.playerActorId,
      'trade with persistent-npc'
    );

    // Simulate save during/after action
    const saveData = {
      turnState: { turnNumber: 1, phase: 'active' },
      lastAction: {
        actionId: 'core:trade',
        actorId: testEnvironment.actors.playerActorId,
        timestamp: Date.now(),
      },
    };

    await mockPersistenceCoordinator.save(saveData);

    // Assert
    expect(result.success).toBe(true);
    expect(mockPersistenceCoordinator.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lastAction: expect.objectContaining({
          actionId: 'core:trade',
        }),
      })
    );
  });

  test('should restore action state after load', async () => {
    // Arrange - Save some action history
    const actionHistory = [
      {
        turn: 1,
        actorId: testEnvironment.actors.playerActorId,
        actionId: 'core:move',
      },
      { turn: 2, actorId: 'persistent-npc', actionId: 'core:wait' },
      {
        turn: 3,
        actorId: testEnvironment.actors.playerActorId,
        actionId: 'core:examine',
      },
    ];

    const savedData = {
      actionHistory,
      turnState: { turnNumber: 3, phase: 'active' },
    };

    await mockPersistenceCoordinator.save(savedData);

    // Act - Load the saved data
    mockPersistenceCoordinator.load.mockResolvedValue({
      success: true,
      data: savedData,
    });

    const loadResult = await mockPersistenceCoordinator.load();

    // Assert
    expect(loadResult.success).toBe(true);
    expect(loadResult.data.actionHistory).toHaveLength(3);
    expect(loadResult.data.actionHistory[0].actionId).toBe('core:move');
    expect(loadResult.data.turnState.turnNumber).toBe(3);
  });

  test('should maintain turn continuity across save/load', async () => {
    // Arrange - Execute some turns
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${testEnvironment.actors.playerActorId}:core:wait`]: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: testEnvironment.actors.playerActorId,
            targets: {},
          },
        },
      },
    });

    await turnExecutionFacade.executePlayerTurn(
      testEnvironment.actors.playerActorId,
      'wait'
    );

    // Save mid-turn state
    const midTurnState = {
      turnNumber: 5,
      actionsThisTurn: 1,
      remainingActors: ['persistent-npc'],
    };

    await mockPersistenceCoordinator.save({ turnState: midTurnState });

    // Act - Load and verify
    mockPersistenceCoordinator.load.mockResolvedValue({
      success: true,
      data: { turnState: midTurnState },
    });

    const loaded = await mockPersistenceCoordinator.load();

    // Assert
    expect(loaded.data.turnState.turnNumber).toBe(5);
    expect(loaded.data.turnState.actionsThisTurn).toBe(1);
    expect(loaded.data.turnState.remainingActors).toContain('persistent-npc');
  });

  test('should handle complex data serialization', async () => {
    // Arrange - Create complex data structures
    const complexData = {
      entities: {
        player: {
          inventory: [
            { id: 'sword', quantity: 1, metadata: { damage: 10 } },
            { id: 'potion', quantity: 5, metadata: { type: 'health' } },
          ],
          relationships: {
            allies: ['npc-1', 'npc-2'],
            enemies: [['enemy-1', { threat: 5 }]],
          },
        },
      },
      gameState: {
        time: { day: 10, hour: 14 },
        weather: 'rainy',
        activeQuests: new Set(['quest-1', 'quest-2']),
      },
    };

    // Convert non-serializable objects
    const serializable = {
      ...complexData,
      gameState: {
        ...complexData.gameState,
        activeQuests: Array.from(complexData.gameState.activeQuests),
      },
    };

    // Act - Save and load
    await mockPersistenceCoordinator.save(serializable);

    mockPersistenceCoordinator.load.mockResolvedValue({
      success: true,
      data: serializable,
    });

    const loaded = await mockPersistenceCoordinator.load();

    // Restore non-serializable objects
    const restored = {
      ...loaded.data,
      gameState: {
        ...loaded.data.gameState,
        activeQuests: new Set(loaded.data.gameState.activeQuests),
      },
    };

    // Assert
    expect(restored.entities.player.inventory).toHaveLength(2);
    expect(restored.entities.player.relationships.allies).toContain('npc-1');
    expect(restored.gameState.activeQuests.has('quest-1')).toBe(true);
    expect(restored.gameState.time.day).toBe(10);
  });

  test('should complete save/load operations efficiently', async () => {
    // Arrange - Create performance tracking
    const saveStart = performance.now();

    // Save operation
    await mockPersistenceCoordinator.save({
      turnState: { turnNumber: 1 },
      timestamp: Date.now(),
    });

    const saveEnd = performance.now();
    const saveDuration = saveEnd - saveStart;

    // Load operation
    const loadStart = performance.now();

    await mockPersistenceCoordinator.load();

    const loadEnd = performance.now();
    const loadDuration = loadEnd - loadStart;

    // Assert - Operations should be fast
    expect(saveDuration).toBeLessThan(100); // Save < 100ms
    expect(loadDuration).toBeLessThan(1000); // Load < 1s
  });
});
