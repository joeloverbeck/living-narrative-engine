/**
 * @file Integration test to verify openContainerHandler correctness
 * @description Tests that the handler uses correct parameter structures for
 * batchAddComponentsOptimized and dispatcher.dispatch
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
import OpenContainerHandler from '../../../../src/logic/operationHandlers/openContainerHandler.js';

describe('OpenContainerHandler - Parameter Structure Validation', () => {
  let testBed;
  let handler;
  let mockEntityManager;
  let mockDispatcher;
  let batchAddCalls;
  let dispatchCalls;

  beforeEach(() => {
    testBed = createTestBed();
    batchAddCalls = [];
    dispatchCalls = [];

    // Create mock entity manager that captures batch calls
    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentType) => {
        if (entityId === 'container1' && componentType === 'items:openable') {
          return {};
        }
        if (entityId === 'container1' && componentType === 'containers-core:container') {
          return {
            contents: ['item1', 'item2'],
            isOpen: false,
            requiresKey: false,
          };
        }
        return null;
      }),
      batchAddComponentsOptimized: jest.fn(
        async (componentSpecs, emitEvent) => {
          batchAddCalls.push({
            specs: componentSpecs,
            emitEvent,
            firstSpec: componentSpecs[0],
          });
          return {
            results: [],
            errors: [],
            updateCount: componentSpecs.length,
          };
        }
      ),
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

    handler = new OpenContainerHandler({
      logger: testBed.createMockLogger(),
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('batchAddComponentsOptimized parameter structure', () => {
    it('should use correct property names: instanceId, componentTypeId, componentData', async () => {
      // Act
      await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'container1',
        },
        { logger: testBed.createMockLogger() }
      );

      // Assert
      expect(mockEntityManager.batchAddComponentsOptimized).toHaveBeenCalled();
      expect(batchAddCalls.length).toBe(1);

      const spec = batchAddCalls[0].firstSpec;

      // CRITICAL: Verify correct property names
      expect(spec).toHaveProperty('instanceId');
      expect(spec).toHaveProperty('componentTypeId');
      expect(spec).toHaveProperty('componentData');

      // FAILURE CASE: These wrong property names would cause issues
      expect(spec).not.toHaveProperty('entityId');
      expect(spec).not.toHaveProperty('componentId');
      expect(spec).not.toHaveProperty('data');

      // Verify values are correct
      expect(spec.instanceId).toBe('container1');
      expect(spec.componentTypeId).toBe('containers-core:container');
      expect(spec.componentData).toEqual({
        contents: ['item1', 'item2'],
        isOpen: true,
        requiresKey: false,
      });
    });
  });

  describe('dispatch parameter structure', () => {
    it('should call dispatch with TWO parameters (eventName, payload), not one object', async () => {
      // Act
      await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'container1',
        },
        { logger: testBed.createMockLogger() }
      );

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
      expect(dispatchCalls.length).toBe(1);

      const call = dispatchCalls[0];

      // CRITICAL: Verify dispatch was called with TWO separate parameters
      expect(call.argCount).toBe(2);

      // First parameter should be the event name STRING
      expect(typeof call.firstArg).toBe('string');
      expect(call.firstArg).toBe('containers:container_opened');

      // Second parameter should be the payload OBJECT
      expect(typeof call.secondArg).toBe('object');
      expect(call.secondArg).toEqual({
        actorEntity: 'actor1',
        containerEntity: 'container1',
        contents: ['item1', 'item2'],
      });
    });

    it('should NOT pass an object with type and payload properties as first argument', async () => {
      // Act
      await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'container1',
        },
        { logger: testBed.createMockLogger() }
      );

      // Assert
      const call = dispatchCalls[0];

      // This is the WRONG pattern - first arg should be a string, not an object
      expect(typeof call.firstArg).not.toBe('object');
    });
  });

  describe('complete workflow validation', () => {
    it('should successfully open a container with correct parameter structures throughout', async () => {
      // Act
      const result = await handler.execute(
        {
          actorEntity: 'actor1',
          containerEntity: 'container1',
        },
        { logger: testBed.createMockLogger() }
      );

      // Assert: Successful execution
      expect(result.success).toBe(true);
      expect(result.contents).toEqual(['item1', 'item2']);

      // Assert: batch update was called correctly
      expect(batchAddCalls.length).toBe(1);
      const spec = batchAddCalls[0].firstSpec;
      expect(spec.instanceId).toBeDefined();
      expect(spec.componentTypeId).toBeDefined();
      expect(spec.componentData).toBeDefined();

      // Assert: dispatch was called correctly
      expect(dispatchCalls.length).toBe(1);
      expect(dispatchCalls[0].argCount).toBe(2);
      expect(typeof dispatchCalls[0].firstArg).toBe('string');
    });
  });
});
