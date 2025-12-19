/**
 * @file Integration test for sitting closeness establishment when multiple actors sit on furniture
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';

describe('Sitting Closeness Establishment Integration', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockEventDispatcher;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    // Capture console errors and warnings to detect the issue
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock entity manager with furniture and actors
    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        if (
          entityId === 'test:sofa' &&
          componentId === 'sitting:allows_sitting'
        ) {
          return {
            spots: [
              'test:actor1', // spot 0 occupied by actor1
              'test:actor2', // spot 1 occupied by actor2
              null, // spot 2 empty
            ],
          };
        }
        if (componentId === 'personal-space-states:closeness') {
          return { partners: [] };
        }
        if (componentId === 'positioning:movement_lock') {
          return { locked: false };
        }
        return null;
      }),
      addComponent: jest.fn(),
    };

    // Create mock event dispatcher
    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Create handler
    handler = new EstablishSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
      closenessCircleService,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should dispatch event with correct format when establishing closeness', async () => {
    const executionContext = {
      entityManager: mockEntityManager,
      eventBus: { dispatch: jest.fn() },
      logger: mockLogger,
      contextVariables: {},
    };

    // Execute the operation - actor2 sits adjacent to actor1
    const result = await handler.execute(
      {
        furniture_id: 'test:sofa',
        actor_id: 'test:actor2',
        spot_index: 1,
      },
      executionContext
    );

    // Log result to debug
    if (!result.success) {
      console.log('Operation failed with error:', result.error);
      console.log('Logger errors:', mockLogger.error.mock.calls);
    }

    // Verify operation succeeded
    expect(result.success).toBe(true);
    expect(result.adjacentActors).toEqual(['test:actor1']);

    // THE CRITICAL TEST: Verify the event was dispatched with CORRECT format
    // Should be dispatched as ('eventName', payload) not { type: 'EVENT', payload: {...} }

    // First, verify dispatch was called
    expect(mockEventDispatcher.dispatch).toHaveBeenCalled();

    // Verify it was called with the correct format: event name as first param, payload as second
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      'sitting:sitting_closeness_established', // First arg should be event name string
      expect.objectContaining({
        // Second arg should be payload object
        actorId: 'test:actor2',
        furnitureId: 'test:sofa',
        adjacentActors: ['test:actor1'],
      })
    );

    // Verify no console errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
