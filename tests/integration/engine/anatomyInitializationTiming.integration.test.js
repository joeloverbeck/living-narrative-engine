/**
 * @file Integration test for anatomy initialization timing fix
 * @description Verifies that timing components work correctly
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import GameSessionManager from '../../../src/engine/gameSessionManager.js';
import EngineState from '../../../src/engine/engineState.js';
import {
  createMockLogger,
  createMockValidatedEventDispatcherForIntegration,
  createMockTurnManager,
  createMockPlaytimeTracker,
} from '../../common/mockFactories.js';

describe('Anatomy Initialization Timing Fix', () => {
  let anatomyInitService;
  let gameSessionManager;
  let mockLogger;
  let mockAnatomyGenerationService;
  let mockEventDispatcher;

  beforeEach(() => {
    mockLogger = createMockLogger();

    // Mock anatomy generation service
    mockAnatomyGenerationService = {
      generateAnatomyIfNeeded: jest.fn().mockResolvedValue(true),
    };

    // Mock event dispatcher
    mockEventDispatcher = createMockValidatedEventDispatcherForIntegration();

    // Create real anatomy initialization service
    anatomyInitService = new AnatomyInitializationService({
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
      anatomyGenerationService: mockAnatomyGenerationService,
    });

    // Create GameSessionManager with anatomy service
    const engineState = new EngineState();
    const turnManager = createMockTurnManager();
    const playtimeTracker = createMockPlaytimeTracker();
    const stopFn = jest.fn().mockResolvedValue();
    const resetCoreGameStateFn = jest.fn();
    const startEngineFn = jest.fn();

    gameSessionManager = new GameSessionManager({
      logger: mockLogger,
      turnManager,
      playtimeTracker,
      safeEventDispatcher: mockEventDispatcher,
      engineState,
      stopFn,
      resetCoreGameStateFn,
      startEngineFn,
      anatomyInitializationService: anatomyInitService,
    });
  });

  it('should have anatomy initialization service with generation tracking', () => {
    // Verify that the anatomy initialization service exists and has the timing methods
    expect(anatomyInitService).toBeDefined();
    expect(typeof anatomyInitService.getPendingGenerationCount).toBe(
      'function'
    );
    expect(typeof anatomyInitService.waitForAllGenerationsToComplete).toBe(
      'function'
    );

    // Verify initial state
    expect(anatomyInitService.getPendingGenerationCount()).toBe(0);
  });

  it('should handle anatomy generation timing in GameSessionManager', async () => {
    // Initialize the service so it listens for events
    anatomyInitService.initialize();

    // Simulate entity creation that triggers anatomy generation
    const event = {
      type: 'ENTITY_CREATED',
      payload: {
        instanceId: 'test:entity',
        definitionId: 'test:definition',
        wasReconstructed: false,
      },
    };

    // Trigger the event through the mock event dispatcher
    // Since it's initialized, the anatomy service should have subscribed to the event
    const subscribeCall = mockEventDispatcher.subscribe.mock.calls.find(
      (call) => call[0] === 'core:entity_created'
    );
    expect(subscribeCall).toBeDefined();

    // Get the handler that was registered
    const eventHandler = subscribeCall[1];

    // Trigger the event handler directly
    const generationPromise = eventHandler(event);

    // Verify that game session manager can handle this
    await gameSessionManager.finalizeNewGameSuccess('TestWorld');

    // Wait for anatomy generation to complete
    await generationPromise;

    // Verify anatomy service was called
    expect(
      mockAnatomyGenerationService.generateAnatomyIfNeeded
    ).toHaveBeenCalledWith('test:entity');

    // Verify the generation count is back to 0
    expect(anatomyInitService.getPendingGenerationCount()).toBe(0);
  });

  it('should handle timeout when no pending generations exist', async () => {
    // Test that the waitForAllGenerationsToComplete method can handle timeouts
    const timeoutPromise =
      anatomyInitService.waitForAllGenerationsToComplete(1); // 1ms timeout

    // Should resolve quickly since there are no pending generations
    await expect(timeoutPromise).resolves.toBeUndefined();
  });
});
