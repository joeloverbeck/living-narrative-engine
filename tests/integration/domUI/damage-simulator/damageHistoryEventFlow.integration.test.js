/**
 * @file damageHistoryEventFlow.integration.test.js
 * @description Integration tests verifying that DamageHistoryTracker correctly receives
 * events from DamageExecutionService and DamageSimulatorUI. This test was created to
 * reproduce and verify the fix for a bug where damage history was never recorded because
 * event name constants were mismatched between emitters and subscribers.
 * @see DamageHistoryTracker.js - Subscribes to execution and entity loading events
 * @see DamageExecutionService.js - Emits execution complete events
 * @see DamageSimulatorUI.js - Emits entity loading events
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import DamageHistoryTracker from '../../../../src/domUI/damage-simulator/DamageHistoryTracker.js';
import DamageExecutionService from '../../../../src/domUI/damage-simulator/DamageExecutionService.js';
import DamageSimulatorUI from '../../../../src/domUI/damage-simulator/DamageSimulatorUI.js';

describe('DamageHistoryTracker Event Flow Integration', () => {
  describe('Event Constant Alignment', () => {
    it('should have matching EXECUTION_COMPLETE event names between DamageExecutionService and DamageHistoryTracker', () => {
      // This test documents and enforces that the event names must match
      // between the emitter (DamageExecutionService) and subscriber (DamageHistoryTracker)
      expect(DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE).toBe(
        DamageHistoryTracker.EVENTS.EXECUTION_COMPLETE
      );
    });

    it('should have matching ENTITY_LOADING event names between DamageSimulatorUI and DamageHistoryTracker', () => {
      // This test documents and enforces that the event names must match
      // between the emitter (DamageSimulatorUI) and subscriber (DamageHistoryTracker)
      expect(DamageSimulatorUI.UI_EVENTS.ENTITY_LOADING).toBe(
        DamageHistoryTracker.EVENTS.ENTITY_LOADING
      );
    });
  });

  describe('Event Flow Integration', () => {
    let mockLogger;
    let subscribers;
    let mockEventBus;
    let mockContainerElement;
    let tracker;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Create a simple event bus that stores subscribers and allows dispatching
      subscribers = {};
      mockEventBus = {
        dispatch: jest.fn((eventType, payload) => {
          const handlers = subscribers[eventType] || [];
          handlers.forEach((handler) => handler({ type: eventType, payload }));
        }),
        subscribe: jest.fn((eventType, handler) => {
          if (!subscribers[eventType]) {
            subscribers[eventType] = [];
          }
          subscribers[eventType].push(handler);
          return () => {
            const index = subscribers[eventType].indexOf(handler);
            if (index > -1) {
              subscribers[eventType].splice(index, 1);
            }
          };
        }),
      };

      mockContainerElement = {
        innerHTML: '',
        appendChild: jest.fn(),
        querySelector: jest.fn().mockReturnValue(null),
      };

      tracker = new DamageHistoryTracker({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
    });

    afterEach(() => {
      if (tracker) {
        tracker.destroy();
      }
    });

    it('should record damage when DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE event is dispatched', () => {
      // Dispatch the event using the same constant that DamageExecutionService uses
      mockEventBus.dispatch(DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE, {
        entityId: 'test-entity',
        results: [
          {
            success: true,
            targetPartId: 'part-head',
            targetPartName: 'Head',
            damageDealt: 25,
            damageType: 'slashing',
            severity: 'moderate',
          },
        ],
      });

      // Verify the tracker recorded the damage
      const entries = tracker.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].targetPartName).toBe('Head');
      expect(entries[0].damageDealt).toBe(25);
      expect(entries[0].damageType).toBe('slashing');
    });

    it('should clear history when UI_EVENTS.ENTITY_LOADING event is dispatched', () => {
      // First record some damage
      tracker.record({
        success: true,
        targetPartId: 'part-head',
        targetPartName: 'Head',
        damageDealt: 25,
        damageType: 'slashing',
        severity: 'moderate',
      });
      expect(tracker.getEntries()).toHaveLength(1);

      // Dispatch the entity loading event using the same constant that DamageSimulatorUI uses
      mockEventBus.dispatch(DamageSimulatorUI.UI_EVENTS.ENTITY_LOADING, {
        definitionId: 'new-entity-definition',
      });

      // Verify the history was cleared
      expect(tracker.getEntries()).toHaveLength(0);
    });

    it('should handle multiple damage results in a single execution complete event', () => {
      mockEventBus.dispatch(DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE, {
        entityId: 'test-entity',
        results: [
          { success: true, targetPartName: 'Head', damageDealt: 10, damageType: 'slashing', severity: 'minor' },
          { success: true, targetPartName: 'Arm', damageDealt: 15, damageType: 'piercing', severity: 'moderate' },
          { success: true, targetPartName: 'Leg', damageDealt: 20, damageType: 'bludgeoning', severity: 'severe' },
        ],
      });

      const entries = tracker.getEntries();
      expect(entries).toHaveLength(3);

      const stats = tracker.getStatistics();
      expect(stats.totalDamage).toBe(45);
      expect(stats.hitCount).toBe(3);
    });

    it('should skip failed results in execution complete event', () => {
      mockEventBus.dispatch(DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE, {
        entityId: 'test-entity',
        results: [
          { success: true, targetPartName: 'Head', damageDealt: 10, damageType: 'slashing', severity: 'minor' },
          { success: false, error: 'Part destroyed' },
          { success: true, targetPartName: 'Arm', damageDealt: 15, damageType: 'piercing', severity: 'moderate' },
        ],
      });

      const entries = tracker.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].targetPartName).toBe('Head');
      expect(entries[1].targetPartName).toBe('Arm');
    });
  });
});
