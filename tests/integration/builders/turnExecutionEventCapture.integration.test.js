/**
 * @file turnExecutionEventCapture.integration.test.js
 * @description Integration tests for event capture functionality in TurnExecutionTestModule
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestModuleBuilder } from '../../common/testing/builders/testModuleBuilder.js';

describe('TurnExecutionTestModule - Event Capture Integration', () => {
  let testEnv;

  afterEach(async () => {
    if (testEnv?.cleanup) {
      await testEnv.cleanup();
    }
  });

  describe('Event Bus Hooking', () => {
    it('should capture events when event capture is enabled', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withEventCapture(['ENTITY_CREATED', 'COMPONENT_UPDATED'])
        .withTestActors(['test-actor'])
        .build();

      // Dispatch test events through the event bus
      const eventBus = testEnv.facades.mockDeps.entity.eventBus;

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-1' },
      });

      await eventBus.dispatch({
        type: 'COMPONENT_UPDATED',
        payload: { entityId: 'test-entity-1', componentId: 'core:name' },
      });

      // Verify events were captured
      const capturedEvents = testEnv.getCapturedEvents();
      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents[0].type).toBe('ENTITY_CREATED');
      expect(capturedEvents[0].payload.entityId).toBe('test-entity-1');
      expect(capturedEvents[0].timestamp).toBeDefined();
      expect(capturedEvents[1].type).toBe('COMPONENT_UPDATED');
    });

    it('should filter events based on allowed types', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withEventCapture(['ENTITY_CREATED']) // Only capture ENTITY_CREATED
        .withTestActors(['test-actor'])
        .build();

      const eventBus = testEnv.facades.mockDeps.entity.eventBus;

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-1' },
      });

      await eventBus.dispatch({
        type: 'COMPONENT_UPDATED', // This should NOT be captured
        payload: { entityId: 'test-entity-1', componentId: 'core:name' },
      });

      await eventBus.dispatch({
        type: 'ENTITY_REMOVED', // This should NOT be captured
        payload: { entityId: 'test-entity-1' },
      });

      // Verify only ENTITY_CREATED was captured
      const capturedEvents = testEnv.getCapturedEvents();
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('ENTITY_CREATED');
    });

    it('should allow filtering captured events by type', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withEventCapture(['ENTITY_CREATED', 'COMPONENT_UPDATED', 'ENTITY_REMOVED'])
        .withTestActors(['test-actor'])
        .build();

      const eventBus = testEnv.facades.mockDeps.entity.eventBus;

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'entity-1' },
      });

      await eventBus.dispatch({
        type: 'COMPONENT_UPDATED',
        payload: { entityId: 'entity-1', componentId: 'core:name' },
      });

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'entity-2' },
      });

      await eventBus.dispatch({
        type: 'ENTITY_REMOVED',
        payload: { entityId: 'entity-1' },
      });

      // Get all events
      const allEvents = testEnv.getCapturedEvents();
      expect(allEvents).toHaveLength(4);

      // Filter by ENTITY_CREATED
      const createdEvents = testEnv.getCapturedEvents('ENTITY_CREATED');
      expect(createdEvents).toHaveLength(2);
      expect(createdEvents[0].payload.entityId).toBe('entity-1');
      expect(createdEvents[1].payload.entityId).toBe('entity-2');

      // Filter by COMPONENT_UPDATED
      const updatedEvents = testEnv.getCapturedEvents('COMPONENT_UPDATED');
      expect(updatedEvents).toHaveLength(1);
      expect(updatedEvents[0].payload.componentId).toBe('core:name');

      // Filter by ENTITY_REMOVED
      const removedEvents = testEnv.getCapturedEvents('ENTITY_REMOVED');
      expect(removedEvents).toHaveLength(1);
      expect(removedEvents[0].payload.entityId).toBe('entity-1');
    });

    it('should clear captured events when requested', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withEventCapture(['ENTITY_CREATED'])
        .withTestActors(['test-actor'])
        .build();

      const eventBus = testEnv.facades.mockDeps.entity.eventBus;

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-1' },
      });

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-2' },
      });

      // Verify events were captured
      let capturedEvents = testEnv.getCapturedEvents();
      expect(capturedEvents).toHaveLength(2);

      // Clear captured events
      testEnv.clearCapturedEvents();

      // Verify events were cleared
      capturedEvents = testEnv.getCapturedEvents();
      expect(capturedEvents).toHaveLength(0);

      // Verify new events are still captured after clearing
      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-3' },
      });

      capturedEvents = testEnv.getCapturedEvents();
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].payload.entityId).toBe('test-entity-3');
    });

    it('should not capture events when event capture is not enabled', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withTestActors(['test-actor'])
        .build();

      const eventBus = testEnv.facades.mockDeps.entity.eventBus;

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-1' },
      });

      // Verify event capture methods are not available
      expect(testEnv.getCapturedEvents).toBeUndefined();
      expect(testEnv.clearCapturedEvents).toBeUndefined();
    });

    it('should unsubscribe from event bus on cleanup', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withEventCapture(['ENTITY_CREATED'])
        .withTestActors(['test-actor'])
        .build();

      const eventBus = testEnv.facades.mockDeps.entity.eventBus;

      // Capture an event before cleanup
      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-1' },
      });

      expect(testEnv.getCapturedEvents()).toHaveLength(1);

      // Cleanup the test environment
      await testEnv.cleanup();

      // Dispatch an event after cleanup
      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-2' },
      });

      // The event should still be in the captured events array
      // because cleanup doesn't clear the array, it only unsubscribes
      // But the length should still be 1, not 2, because we're unsubscribed
      expect(testEnv.getCapturedEvents()).toHaveLength(1);
    });

    it('should include timestamps on captured events', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withEventCapture(['ENTITY_CREATED'])
        .withTestActors(['test-actor'])
        .build();

      const eventBus = testEnv.facades.mockDeps.entity.eventBus;

      const beforeTime = Date.now();

      await eventBus.dispatch({
        type: 'ENTITY_CREATED',
        payload: { entityId: 'test-entity-1' },
      });

      const afterTime = Date.now();

      const capturedEvents = testEnv.getCapturedEvents();
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].timestamp).toBeDefined();
      expect(typeof capturedEvents[0].timestamp).toBe('number');
      expect(capturedEvents[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(capturedEvents[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle event bus not available gracefully', async () => {
      // This test ensures the module doesn't crash if the event bus is not available
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withEventCapture(['ENTITY_CREATED'])
        .withTestActors(['test-actor'])
        .build();

      // Remove the event bus to simulate it not being available
      delete testEnv.facades.mockDeps.entity.eventBus;

      // The test environment should still be usable
      expect(testEnv.getCapturedEvents).toBeDefined();
      expect(testEnv.getCapturedEvents()).toEqual([]);

      // Cleanup should not throw
      await expect(testEnv.cleanup()).resolves.not.toThrow();
    });
  });
});
