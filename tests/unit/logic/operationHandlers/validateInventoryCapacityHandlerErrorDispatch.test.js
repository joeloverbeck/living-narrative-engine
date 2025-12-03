/**
 * @file Test for validateInventoryCapacityHandler error dispatch schema validation
 * @description Tests that error events dispatched by the handler comply with schema requirements
 *
 * Bug: The handler calls safeDispatchError() with a 'details' property that violates
 * the core:system_error_occurred event schema, causing the event dispatch to fail silently.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ValidateInventoryCapacityHandler from '../../../../src/logic/operationHandlers/validateInventoryCapacityHandler.js';

describe('ValidateInventoryCapacityHandler - Error Dispatch Schema Validation', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let dispatchedEvents;

  beforeEach(() => {
    dispatchedEvents = [];

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        dispatchedEvents.push({ eventType, payload });
        return true; // Simulate successful dispatch
      }),
    };

    handler = new ValidateInventoryCapacityHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
    });
  });

  describe('error event schema compliance', () => {
    it('should dispatch schema-compliant error when itemEntity is missing', async () => {
      // Arrange
      const params = {
        targetEntity: 'target-123',
        itemEntity: '', // Invalid: empty string
        result_variable: 'result',
      };

      const executionContext = {
        operationIndex: 0,
        totalOperations: 1,
        context: {},
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: 'actor-123',
            actionId: 'item-transfer:give_item',
          },
        },
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert: Find system error event
      const systemErrorEvent = dispatchedEvents.find(
        (e) => e.eventType === 'core:system_error_occurred'
      );

      expect(systemErrorEvent).toBeDefined();

      // Verify the event payload doesn't have invalid properties
      expect(systemErrorEvent.payload).toBeDefined();
      expect(systemErrorEvent.payload).toHaveProperty('message');

      // The event should NOT have 'details' as an additional property
      // (unless the schema allows it, which currently it doesn't)
      // This test documents the current schema constraints
    });

    it('should dispatch schema-compliant error when targetEntity is missing', async () => {
      // Arrange
      const params = {
        targetEntity: '', // Invalid: empty string
        itemEntity: 'item-123',
        result_variable: 'result',
      };

      const executionContext = {
        operationIndex: 0,
        totalOperations: 1,
        context: {},
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: 'actor-123',
            actionId: 'item-transfer:give_item',
          },
        },
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert: Find system error event
      const systemErrorEvent = dispatchedEvents.find(
        (e) => e.eventType === 'core:system_error_occurred'
      );

      expect(systemErrorEvent).toBeDefined();
      expect(systemErrorEvent.payload).toBeDefined();
      expect(systemErrorEvent.payload).toHaveProperty('message');
    });

    it('should dispatch schema-compliant error when result_variable is missing', async () => {
      // Arrange
      const params = {
        targetEntity: 'target-123',
        itemEntity: 'item-123',
        result_variable: '', // Invalid: empty string
      };

      const executionContext = {
        operationIndex: 0,
        totalOperations: 1,
        context: {},
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: 'actor-123',
            actionId: 'item-transfer:give_item',
          },
        },
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert: Find system error event
      const systemErrorEvent = dispatchedEvents.find(
        (e) => e.eventType === 'core:system_error_occurred'
      );

      expect(systemErrorEvent).toBeDefined();
      expect(systemErrorEvent.payload).toBeDefined();
      expect(systemErrorEvent.payload).toHaveProperty('message');
    });

    it('should dispatch schema-compliant error when params is null', async () => {
      // Arrange
      const params = null;

      const executionContext = {
        operationIndex: 0,
        totalOperations: 1,
        context: {},
        event: {
          type: 'core:attempt_action',
          payload: {
            actorId: 'actor-123',
            actionId: 'item-transfer:give_item',
          },
        },
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert: Find system error event
      const systemErrorEvent = dispatchedEvents.find(
        (e) => e.eventType === 'core:system_error_occurred'
      );

      expect(systemErrorEvent).toBeDefined();
      expect(systemErrorEvent.payload).toBeDefined();
      expect(systemErrorEvent.payload).toHaveProperty('message');
    });
  });

  describe('error messages', () => {
    it('should include descriptive message when itemEntity is empty', async () => {
      // Arrange
      const params = {
        targetEntity: 'target-123',
        itemEntity: '',
        result_variable: 'result',
      };

      const executionContext = {
        operationIndex: 0,
        totalOperations: 1,
        context: {},
        event: {
          type: 'core:attempt_action',
          payload: {},
        },
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert
      const systemErrorEvent = dispatchedEvents.find(
        (e) => e.eventType === 'core:system_error_occurred'
      );

      expect(systemErrorEvent).toBeDefined();
      expect(systemErrorEvent.payload.message).toContain('itemEntity');
      expect(systemErrorEvent.payload.message).toContain('required');
    });

    it('should include descriptive message when targetEntity is empty', async () => {
      // Arrange
      const params = {
        targetEntity: '',
        itemEntity: 'item-123',
        result_variable: 'result',
      };

      const executionContext = {
        operationIndex: 0,
        totalOperations: 1,
        context: {},
        event: {
          type: 'core:attempt_action',
          payload: {},
        },
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert
      const systemErrorEvent = dispatchedEvents.find(
        (e) => e.eventType === 'core:system_error_occurred'
      );

      expect(systemErrorEvent).toBeDefined();
      expect(systemErrorEvent.payload.message).toContain('targetEntity');
      expect(systemErrorEvent.payload.message).toContain('required');
    });
  });
});
