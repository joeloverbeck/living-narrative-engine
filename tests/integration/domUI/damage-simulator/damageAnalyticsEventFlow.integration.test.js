/**
 * @file damageAnalyticsEventFlow.integration.test.js
 * @description Integration tests verifying that DamageAnalyticsPanel correctly receives
 * events from DamageCapabilityComposer. This test was created to
 * reproduce and verify the fix for a bug where analytics 'Eff. Damage' and 'Hits' columns
 * never updated because event name constants were mismatched between emitters and subscribers.
 * @see DamageAnalyticsPanel.js - Subscribes to config changed and entity loaded events
 * @see DamageCapabilityComposer.js - Emits config changed events when slider moves
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import DamageAnalyticsPanel from '../../../../src/domUI/damage-simulator/DamageAnalyticsPanel.js';
import DamageCapabilityComposer from '../../../../src/domUI/damage-simulator/DamageCapabilityComposer.js';

describe('DamageAnalyticsPanel Event Flow Integration', () => {
  describe('Event Constant Alignment', () => {
    it('should have matching CONFIG_CHANGED event names between DamageCapabilityComposer and DamageAnalyticsPanel', () => {
      // This test documents and enforces that the event names must match
      // between the emitter (DamageCapabilityComposer) and subscriber (DamageAnalyticsPanel)
      expect(DamageCapabilityComposer.COMPOSER_EVENTS.CONFIG_CHANGED).toBe(
        DamageAnalyticsPanel.EVENTS.CONFIG_CHANGED
      );
    });
  });

  describe('Event Flow Integration', () => {
    let mockLogger;
    let subscribers;
    let mockEventBus;
    let mockContainerElement;
    let analyticsPanel;

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

      analyticsPanel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
    });

    afterEach(() => {
      if (analyticsPanel) {
        analyticsPanel.destroy();
      }
    });

    it('should update analytics when DamageCapabilityComposer.COMPOSER_EVENTS.CONFIG_CHANGED event is dispatched', () => {
      // First, set up some anatomy data
      analyticsPanel.setEntity('test-entity', {
        parts: [
          {
            id: 'part-head',
            name: 'Head',
            currentHealth: 100,
            maxHealth: 100,
            armor: 0,
            resistance: 0,
            components: {},
          },
        ],
      });

      // Dispatch the event using the same constant that DamageCapabilityComposer uses
      // The composer sends { config, multiplier, isValid }
      mockEventBus.dispatch(DamageCapabilityComposer.COMPOSER_EVENTS.CONFIG_CHANGED, {
        config: {
          name: 'slashing',
          amount: 25,
          penetration: 0.3,
        },
        multiplier: 1,
        isValid: true,
      });

      // Verify the analytics panel received and processed the damage config
      const analytics = analyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
      expect(analytics.parts[0].effectiveDamage).toBe(25); // 25 damage * 1 multiplier
      expect(analytics.parts[0].hitsToDestroy).toBe(4); // ceil(100 / 25) = 4
    });

    it('should update analytics when entity is loaded with existing damage config', () => {
      // First, set a damage config
      analyticsPanel.updateDamageConfig({ amount: 20, penetration: 0 }, 1);

      // Then dispatch entity loaded event
      mockEventBus.dispatch(DamageAnalyticsPanel.EVENTS.ENTITY_LOADED, {
        instanceId: 'test-entity',
        anatomyData: {
          parts: [
            {
              id: 'part-torso',
              name: 'Torso',
              currentHealth: 80,
              maxHealth: 100,
              armor: 0,
              resistance: 0,
              components: {},
            },
          ],
        },
      });

      // Verify analytics are calculated with existing damage config
      const analytics = analyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
      expect(analytics.parts[0].effectiveDamage).toBe(20);
      expect(analytics.parts[0].hitsToDestroy).toBe(4); // ceil(80 / 20) = 4
    });

    it('should handle damage config with multiplier', () => {
      // Set up anatomy data
      analyticsPanel.setEntity('test-entity', {
        parts: [
          {
            id: 'part-arm',
            name: 'Arm',
            currentHealth: 50,
            maxHealth: 50,
            armor: 0,
            resistance: 0,
            components: {},
          },
        ],
      });

      // Dispatch with multiplier
      mockEventBus.dispatch(DamageCapabilityComposer.COMPOSER_EVENTS.CONFIG_CHANGED, {
        config: {
          name: 'piercing',
          amount: 10,
          penetration: 0,
        },
        multiplier: 2, // 2x multiplier
        isValid: true,
      });

      const analytics = analyticsPanel.getAnalytics();
      expect(analytics.parts[0].effectiveDamage).toBe(20); // 10 * 2 = 20
      expect(analytics.parts[0].hitsToDestroy).toBe(3); // ceil(50 / 20) = 3
    });

    it('should handle penetration affecting armor', () => {
      // Set up anatomy data with armor
      analyticsPanel.setEntity('test-entity', {
        parts: [
          {
            id: 'part-chest',
            name: 'Chest',
            currentHealth: 100,
            maxHealth: 100,
            armor: 10, // 10 armor
            resistance: 0,
            components: {},
          },
        ],
      });

      // Dispatch with 50% penetration
      mockEventBus.dispatch(DamageCapabilityComposer.COMPOSER_EVENTS.CONFIG_CHANGED, {
        config: {
          name: 'slashing',
          amount: 30,
          penetration: 0.5, // 50% penetration
        },
        multiplier: 1,
        isValid: true,
      });

      // Effective armor = 10 * (1 - 0.5) = 5
      // Effective damage = 30 - 5 = 25
      const analytics = analyticsPanel.getAnalytics();
      expect(analytics.parts[0].effectiveDamage).toBe(25);
      expect(analytics.parts[0].hitsToDestroy).toBe(4); // ceil(100 / 25) = 4
    });

    it('should show null values when no damage config is set', () => {
      // Only set entity, no damage config
      analyticsPanel.setEntity('test-entity', {
        parts: [
          {
            id: 'part-leg',
            name: 'Leg',
            currentHealth: 60,
            maxHealth: 60,
            components: {},
          },
        ],
      });

      const analytics = analyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
      expect(analytics.parts[0].effectiveDamage).toBeNull();
      expect(analytics.parts[0].hitsToDestroy).toBeNull();
    });
  });
});
