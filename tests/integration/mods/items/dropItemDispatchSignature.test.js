/**
 * @file Integration test to reproduce and verify the dispatch signature bug in dropItemAtLocationHandler
 * @description This test ensures that the handler correctly calls dispatcher with separate
 * eventName and payload parameters, not a single {type, payload} object.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import DropItemAtLocationHandler from '../../../../src/logic/operationHandlers/dropItemAtLocationHandler.js';

describe('DropItemAtLocationHandler - Dispatch Signature', () => {
  let testBed;
  let handler;
  let mockEntityManager;
  let mockDispatcher;
  let dispatchCalls;

  beforeEach(() => {
    testBed = createTestBed();
    dispatchCalls = [];

    // Create mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentType) => {
        if (entityId === 'actor1' && componentType === 'items:inventory') {
          return {
            items: ['item1', 'item2'],
            capacity: { maxWeight: 50, maxItems: 10 },
          };
        }
        return null;
      }),
      batchAddComponentsOptimized: jest.fn(async () => ({
        results: [],
        errors: [],
        updateCount: 2,
      })),
      getEntityInstance: jest.fn((entityId) => ({
        getComponentTypeIds: () => [
          'items:item',
          'items:portable',
          'core:position',
        ],
      })),
    };

    // Create mock dispatcher that captures calls
    mockDispatcher = {
      dispatch: jest.fn((...args) => {
        dispatchCalls.push({
          args,
          argCount: args.length,
          firstArg: args[0],
          secondArg: args[1],
        });
        return Promise.resolve(true);
      }),
    };

    handler = new DropItemAtLocationHandler({
      logger: testBed.createMockLogger(),
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should call dispatch with TWO parameters (eventName, payload), not one object', async () => {
    // Act
    await handler.execute(
      {
        actorEntity: 'actor1',
        itemEntity: 'item1',
        locationId: 'location1',
      },
      { logger: testBed.createMockLogger() }
    );

    // Assert: dispatcher.dispatch should have been called
    expect(mockDispatcher.dispatch).toHaveBeenCalled();
    expect(dispatchCalls.length).toBe(1);

    const call = dispatchCalls[0];

    // CRITICAL: Verify dispatch was called with TWO separate parameters
    expect(call.argCount).toBe(2);

    // First parameter should be the event name STRING
    expect(typeof call.firstArg).toBe('string');
    expect(call.firstArg).toBe('items:item_dropped');

    // Second parameter should be the payload OBJECT
    expect(typeof call.secondArg).toBe('object');
    expect(call.secondArg).toEqual({
      actorEntity: 'actor1',
      itemEntity: 'item1',
      locationId: 'location1',
    });

    // FAILURE CASE: If this test fails, it means dispatch was called like:
    // dispatch({type: 'items:item_dropped', payload: {...}})
    // which results in firstArg being an object, not a string
    expect(call.firstArg).not.toHaveProperty('type');
    expect(call.firstArg).not.toHaveProperty('payload');
  });

  it('should NOT pass an object with type and payload properties as first argument', async () => {
    // Act
    await handler.execute(
      {
        actorEntity: 'actor1',
        itemEntity: 'item1',
        locationId: 'location1',
      },
      { logger: testBed.createMockLogger() }
    );

    // Assert
    const call = dispatchCalls[0];

    // This is the WRONG pattern that causes "[object Object]" errors
    // First arg should be a string, not an object with type/payload
    expect(typeof call.firstArg).not.toBe('object');
  });

  it('should result in event name being a string when logged', async () => {
    // Act
    await handler.execute(
      {
        actorEntity: 'actor1',
        itemEntity: 'item1',
        locationId: 'location1',
      },
      { logger: testBed.createMockLogger() }
    );

    // Assert
    const call = dispatchCalls[0];

    // When converted to string for logging, event name should not be "[object Object]"
    expect(String(call.firstArg)).not.toBe('[object Object]');
    expect(String(call.firstArg)).toBe('items:item_dropped');
  });
});
