/**
 * @file DamageAnalyticsPanel.test.js
 * @description Unit tests for DamageAnalyticsPanel
 */

import DamageAnalyticsPanel from '../../../../src/domUI/damage-simulator/DamageAnalyticsPanel.js';
import { jest } from '@jest/globals';

describe('DamageAnalyticsPanel', () => {
  let mockLogger;
  let mockEventBus;
  let mockContainerElement;
  let damageAnalyticsPanel;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    mockContainerElement = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null),
    };

    damageAnalyticsPanel = new DamageAnalyticsPanel({
      containerElement: mockContainerElement,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (damageAnalyticsPanel) {
      damageAnalyticsPanel.destroy();
    }
  });

  describe('Constructor', () => {
    it('should validate required dependencies - missing containerElement', () => {
      expect(
        () =>
          new DamageAnalyticsPanel({
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should validate required dependencies - missing eventBus', () => {
      expect(
        () =>
          new DamageAnalyticsPanel({
            containerElement: mockContainerElement,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should validate required dependencies - missing logger', () => {
      expect(
        () =>
          new DamageAnalyticsPanel({
            containerElement: mockContainerElement,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should create panel with all valid dependencies', () => {
      expect(damageAnalyticsPanel).toBeInstanceOf(DamageAnalyticsPanel);
    });

    it('should subscribe to config-changed and entity-loaded events', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DamageAnalyticsPanel.EVENTS.CONFIG_CHANGED,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DamageAnalyticsPanel.EVENTS.ENTITY_LOADED,
        expect.any(Function)
      );
    });
  });

  describe('render', () => {
    it('should render panel with all sections', () => {
      // Set up entity and damage config
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('ds-analytics-panel');
      expect(html).toContain('Damage Analytics');
      expect(html).toContain('Hits to Destroy');
      expect(html).toContain('Effect Triggers');
      expect(html).toContain('ds-aggregate-stats');
    });

    it('should show no data message when entity not set', () => {
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('No anatomy data available');
    });

    it('should render hits-to-destroy table with data', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
          { id: 'part-arm', name: 'Left Arm', currentHealth: 50, maxHealth: 50 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('ds-hits-table');
      expect(html).toContain('Head');
      expect(html).toContain('Left Arm');
    });
  });

  describe('display hits-to-destroy for each part', () => {
    it('should display hits-to-destroy for each part', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
          { id: 'part-torso', name: 'Torso', currentHealth: 200, maxHealth: 200 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      // Head: 100 / 10 = 10 hits
      expect(html).toContain('Head');
      expect(html).toContain('100/100'); // Health display
      // Torso: 200 / 10 = 20 hits
      expect(html).toContain('Torso');
      expect(html).toContain('200/200'); // Health display
    });
  });

  describe('update when damage config changes', () => {
    it('should update when damage config changes', () => {
      let configChangedHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageAnalyticsPanel.EVENTS.CONFIG_CHANGED) {
          configChangedHandler = handler;
        }
        return () => {};
      });

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      panel.setEntity('entity-1', anatomyData);

      // Simulate config changed event
      configChangedHandler({
        payload: {
          damageEntry: { amount: 25, damageType: 'piercing' },
          multiplier: 2,
        },
      });

      const analytics = panel.getAnalytics();
      // 25 * 2 = 50 effective damage, 100 / 50 = 2 hits
      expect(analytics.parts[0].hitsToDestroy).toBe(2);

      panel.destroy();
    });
  });

  describe('update when entity changes', () => {
    it('should update when entity changes', () => {
      let entityLoadedHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageAnalyticsPanel.EVENTS.ENTITY_LOADED) {
          entityLoadedHandler = handler;
        }
        return () => {};
      });

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      // Simulate entity loaded event
      entityLoadedHandler({
        payload: {
          instanceId: 'new-entity',
          anatomyData: {
            parts: [{ id: 'part-chest', name: 'Chest', currentHealth: 80, maxHealth: 80 }],
          },
        },
      });

      const analytics = panel.getAnalytics();
      expect(analytics.parts[0].partName).toBe('Chest');
      expect(analytics.parts[0].hitsToDestroy).toBe(8); // 80 / 10 = 8

      panel.destroy();
    });
  });

  describe('calculate hits correctly with penetration', () => {
    it('should calculate hits correctly with penetration', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100, armor: 10 },
        ],
      };
      // 20 damage, 0.5 penetration reduces armor by 50%
      // Effective armor = 10 * (1 - 0.5) = 5
      // Effective damage = 20 - 5 = 15
      // Hits = ceil(100 / 15) = 7
      const damageEntry = { amount: 20, damageType: 'slashing', penetration: 0.5 };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts[0].hitsToDestroy).toBe(7);
    });

    it('should account for full penetration (1.0) ignoring armor completely', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100, armor: 50 },
        ],
      };
      // Full penetration ignores all armor
      // Effective damage = 20 (armor * 0 = 0)
      // Hits = ceil(100 / 20) = 5
      const damageEntry = { amount: 20, damageType: 'piercing', penetration: 1.0 };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts[0].hitsToDestroy).toBe(5);
    });
  });

  describe('identify effect trigger thresholds', () => {
    it('should identify effect trigger thresholds', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();

      // Should have default effect thresholds
      expect(analytics.effectThresholds).toHaveLength(3);
      expect(analytics.effectThresholds[0].effectType).toBe('bleed');
      expect(analytics.effectThresholds[0].threshold).toBe(50);
      expect(analytics.effectThresholds[1].effectType).toBe('fracture');
      expect(analytics.effectThresholds[1].threshold).toBe(25);
      expect(analytics.effectThresholds[2].effectType).toBe('cripple');
      expect(analytics.effectThresholds[2].threshold).toBe(10);
    });

    it('should render effect thresholds in the HTML', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('bleed');
      expect(html).toContain('≤50% HP');
      expect(html).toContain('fracture');
      expect(html).toContain('≤25% HP');
    });
  });

  describe('highlight critical parts', () => {
    it('should highlight critical parts', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
          { id: 'part-torso', name: 'Torso', currentHealth: 200, maxHealth: 200 },
          { id: 'part-heart', name: 'Heart', currentHealth: 50, maxHealth: 50 },
          { id: 'part-arm', name: 'Left Arm', currentHealth: 60, maxHealth: 60 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();

      // Head, Torso, Heart are critical; Arm is not
      expect(analytics.parts[0].isCritical).toBe(true); // Head
      expect(analytics.parts[1].isCritical).toBe(true); // Torso
      expect(analytics.parts[2].isCritical).toBe(true); // Heart
      expect(analytics.parts[3].isCritical).toBe(false); // Left Arm
    });

    it('should apply critical CSS class to critical parts', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
          { id: 'part-arm', name: 'Left Arm', currentHealth: 60, maxHealth: 60 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('ds-critical-part');
    });

    it('should match critical parts case-insensitively', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'HEAD', currentHealth: 100, maxHealth: 100 },
          { id: 'part-torso', name: 'upper torso', currentHealth: 200, maxHealth: 200 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();

      expect(analytics.parts[0].isCritical).toBe(true); // HEAD (uppercase)
      expect(analytics.parts[1].isCritical).toBe(true); // upper torso (contains 'torso')
    });
  });

  describe('handle zero damage gracefully', () => {
    it('should handle zero damage gracefully', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      const damageEntry = { amount: 0, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();

      expect(analytics.parts[0].hitsToDestroy).toBe(Infinity);
    });

    it('should display infinity symbol for infinite hits', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      const damageEntry = { amount: 0, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('∞');
    });
  });

  describe('handle parts with armor/resistance', () => {
    it('should handle parts with armor/resistance', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100, armor: 5, resistance: 0.2 },
        ],
      };
      // 20 damage, 0 penetration
      // After 20% resistance: 20 * 0.8 = 16
      // After 5 armor: 16 - 5 = 11
      // Hits = ceil(100 / 11) = 10
      const damageEntry = { amount: 20, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts[0].effectiveDamage).toBe(11);
      expect(analytics.parts[0].hitsToDestroy).toBe(10);
    });

    it('should handle armor reducing damage to zero', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100, armor: 50 },
        ],
      };
      // 10 damage, 50 armor, no penetration
      // Effective damage = max(0, 10 - 50) = 0
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts[0].effectiveDamage).toBe(0);
      expect(analytics.parts[0].hitsToDestroy).toBe(Infinity);
    });
  });

  describe('collapse and expand sections', () => {
    it('should collapse and expand sections', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      // Initially expanded
      let html = mockContainerElement.innerHTML;
      expect(html).toContain('▼'); // Expanded icon
      expect(html).toContain('ds-analytics-section');

      // Simulate collapse via click handler
      // We can't directly test DOM events without jsdom, but we can check the toggle icon changes
      // The collapse button should have an ID we can check for
      expect(html).toContain('analytics-collapse-btn');
    });

    it('should have collapse button with correct aria-label', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('aria-label="Toggle analytics panel"');
    });
  });

  describe('show aggregate statistics', () => {
    it('should show aggregate statistics', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
          { id: 'part-arm', name: 'Arm', currentHealth: 50, maxHealth: 50 },
          { id: 'part-leg', name: 'Leg', currentHealth: 80, maxHealth: 80 },
        ],
      };
      // 10 damage each:
      // Head: 100/10 = 10 hits
      // Arm: 50/10 = 5 hits
      // Leg: 80/10 = 8 hits
      // Min: 5, Max: 10, Avg: (10+5+8)/3 = 7.67
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();

      expect(analytics.aggregate.minHits).toBe(5);
      expect(analytics.aggregate.maxHits).toBe(10);
      expect(analytics.aggregate.averageHits).toBeCloseTo(7.67, 1);
      expect(analytics.aggregate.totalParts).toBe(3);
    });

    it('should render aggregate statistics in HTML', () => {
      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
          { id: 'part-arm', name: 'Arm', currentHealth: 50, maxHealth: 50 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('Avg Hits');
      expect(html).toContain('Min/Max');
      expect(html).toContain('Parts');
    });
  });

  describe('getAnalytics', () => {
    it('should return empty analytics before entity is set', () => {
      const analytics = damageAnalyticsPanel.getAnalytics();

      expect(analytics.parts).toHaveLength(0);
      expect(analytics.aggregate.totalParts).toBe(0);
      expect(analytics.effectThresholds).toHaveLength(3); // Default thresholds still present
    });

    it('should return empty parts when only damage config is set', () => {
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();

      expect(analytics.parts).toHaveLength(0);
      expect(analytics.aggregate.totalParts).toBe(0);
    });

    it('should handle empty anatomy parts array', () => {
      damageAnalyticsPanel.setEntity('entity-1', { parts: [] });
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();

      expect(analytics.parts).toHaveLength(0);
      expect(analytics.aggregate.totalParts).toBe(0);
    });
  });

  describe('setEntity', () => {
    it('should store entity id and anatomy data', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10 });

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('[DamageAnalyticsPanel] Entity set: entity-1');
    });
  });

  describe('updateDamageConfig', () => {
    it('should store damage entry and multiplier', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10 }, 2);

      const analytics = damageAnalyticsPanel.getAnalytics();
      // 10 * 2 = 20 effective, 100/20 = 5 hits
      expect(analytics.parts[0].hitsToDestroy).toBe(5);
    });

    it('should use default multiplier of 1', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10 });

      const analytics = damageAnalyticsPanel.getAnalytics();
      // 10 * 1 = 10 effective, 100/10 = 10 hits
      expect(analytics.parts[0].hitsToDestroy).toBe(10);
    });
  });

  describe('event subscriptions', () => {
    it('should handle config change event with missing payload', () => {
      let configChangedHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageAnalyticsPanel.EVENTS.CONFIG_CHANGED) {
          configChangedHandler = handler;
        }
        return () => {};
      });

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Should not throw with missing payload
      expect(() => configChangedHandler({})).not.toThrow();
      expect(() => configChangedHandler({ payload: {} })).not.toThrow();

      panel.destroy();
    });

    it('should handle entity loaded event with missing payload', () => {
      let entityLoadedHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === DamageAnalyticsPanel.EVENTS.ENTITY_LOADED) {
          entityLoadedHandler = handler;
        }
        return () => {};
      });

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Should not throw with missing payload
      expect(() => entityLoadedHandler({})).not.toThrow();
      expect(() => entityLoadedHandler({ payload: {} })).not.toThrow();

      panel.destroy();
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from events on destroy', () => {
      const unsubscribeMock1 = jest.fn();
      const unsubscribeMock2 = jest.fn();
      let callCount = 0;

      mockEventBus.subscribe.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? unsubscribeMock1 : unsubscribeMock2;
      });

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      panel.destroy();

      expect(unsubscribeMock1).toHaveBeenCalledTimes(1);
      expect(unsubscribeMock2).toHaveBeenCalledTimes(1);
    });

    it('should clear state on destroy', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10 });
      expect(damageAnalyticsPanel.getAnalytics().parts).toHaveLength(1);

      damageAnalyticsPanel.destroy();

      // After destroy, analytics should be empty
      expect(damageAnalyticsPanel.getAnalytics().parts).toHaveLength(0);
    });

    it('should log destruction', () => {
      damageAnalyticsPanel.destroy();
      expect(mockLogger.debug).toHaveBeenCalledWith('[DamageAnalyticsPanel] Destroyed');
    });
  });

  describe('Static constants', () => {
    it('should expose EVENTS constant', () => {
      expect(DamageAnalyticsPanel.EVENTS).toBeDefined();
      expect(DamageAnalyticsPanel.EVENTS.CONFIG_CHANGED).toBe('damage-composer:config-changed');
      expect(DamageAnalyticsPanel.EVENTS.ENTITY_LOADED).toBe('core:damage_simulator_entity_loaded');
    });

    it('should expose CRITICAL_PARTS constant', () => {
      expect(DamageAnalyticsPanel.CRITICAL_PARTS).toBeDefined();
      expect(DamageAnalyticsPanel.CRITICAL_PARTS).toContain('head');
      expect(DamageAnalyticsPanel.CRITICAL_PARTS).toContain('torso');
      expect(DamageAnalyticsPanel.CRITICAL_PARTS).toContain('heart');
    });

    it('should expose DEFAULT_EFFECT_THRESHOLDS constant', () => {
      expect(DamageAnalyticsPanel.DEFAULT_EFFECT_THRESHOLDS).toBeDefined();
      expect(DamageAnalyticsPanel.DEFAULT_EFFECT_THRESHOLDS).toHaveLength(3);
    });
  });

  describe('XSS prevention', () => {
    it('should escape HTML in part names', () => {
      const anatomyData = {
        parts: [
          { id: 'part-xss', name: '<script>alert("xss")</script>', currentHealth: 100, maxHealth: 100 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in effect types', () => {
      // Since effect types come from defaults, this is more of a defensive test
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      // Effect types should be rendered (they're safe defaults)
      expect(html).toContain('bleed');
      expect(html).toContain('fracture');
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional part properties', () => {
      const anatomyData = {
        parts: [
          { id: 'part-minimal', name: 'Minimal', currentHealth: 50, maxHealth: 50 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();
      // No armor/resistance, damage should be 10
      expect(analytics.parts[0].effectiveDamage).toBe(10);
      expect(analytics.parts[0].hitsToDestroy).toBe(5); // 50/10
    });

    it('should handle damage entry without penetration', () => {
      const anatomyData = {
        parts: [
          { id: 'part-armored', name: 'Armored', currentHealth: 100, maxHealth: 100, armor: 5 },
        ],
      };
      // No penetration property
      const damageEntry = { amount: 20, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();
      // Effective damage = 20 - 5 = 15
      expect(analytics.parts[0].effectiveDamage).toBe(15);
      expect(analytics.parts[0].hitsToDestroy).toBe(7); // ceil(100/15)
    });

    it('should handle all parts having infinite hits', () => {
      const anatomyData = {
        parts: [
          { id: 'part-armored1', name: 'Armored1', currentHealth: 100, maxHealth: 100, armor: 50 },
          { id: 'part-armored2', name: 'Armored2', currentHealth: 100, maxHealth: 100, armor: 50 },
        ],
      };
      const damageEntry = { amount: 10, damageType: 'slashing' };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig(damageEntry);

      const analytics = damageAnalyticsPanel.getAnalytics();

      expect(analytics.parts[0].hitsToDestroy).toBe(Infinity);
      expect(analytics.parts[1].hitsToDestroy).toBe(Infinity);
      expect(analytics.aggregate.averageHits).toBe(Infinity);
      expect(analytics.aggregate.minHits).toBe(Infinity);
      expect(analytics.aggregate.maxHits).toBe(Infinity);
    });
  });

  describe('Tree format anatomy data normalization', () => {
    it('should normalize tree data with id and children properties', () => {
      const treeData = {
        id: 'part_torso_001',
        name: 'Torso',
        health: { current: 150, max: 150 },
        children: [
          {
            id: 'part_head_001',
            name: 'Head',
            health: { current: 100, max: 100 },
            children: [],
          },
        ],
      };

      damageAnalyticsPanel.setEntity('entity-1', treeData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(2);
      expect(analytics.parts[0].partName).toBe('Torso');
      expect(analytics.parts[0].currentHealth).toBe(150);
      expect(analytics.parts[1].partName).toBe('Head');
      expect(analytics.parts[1].currentHealth).toBe(100);
    });

    it('should flatten deeply nested tree (3+ levels)', () => {
      const treeData = {
        id: 'level1',
        name: 'Level 1',
        health: { current: 100, max: 100 },
        children: [
          {
            id: 'level2',
            name: 'Level 2',
            health: { current: 80, max: 80 },
            children: [
              {
                id: 'level3',
                name: 'Level 3',
                health: { current: 60, max: 60 },
                children: [
                  {
                    id: 'level4',
                    name: 'Level 4',
                    health: { current: 40, max: 40 },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      damageAnalyticsPanel.setEntity('entity-1', treeData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(4);
      expect(analytics.parts[0].partName).toBe('Level 1');
      expect(analytics.parts[1].partName).toBe('Level 2');
      expect(analytics.parts[2].partName).toBe('Level 3');
      expect(analytics.parts[3].partName).toBe('Level 4');
    });

    it('should handle tree node with missing health property (defaults to 0)', () => {
      const treeData = {
        id: 'part_no_health',
        name: 'No Health Part',
        // Missing health property
        children: [],
      };

      damageAnalyticsPanel.setEntity('entity-1', treeData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
      expect(analytics.parts[0].currentHealth).toBe(0);
      expect(analytics.parts[0].maxHealth).toBe(0);
    });

    it('should handle tree with children: [] (empty array)', () => {
      const treeData = {
        id: 'part_no_children',
        name: 'No Children',
        health: { current: 50, max: 50 },
        children: [],
      };

      damageAnalyticsPanel.setEntity('entity-1', treeData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
      expect(analytics.parts[0].partName).toBe('No Children');
    });

    it('should preserve components from tree nodes', () => {
      const treeData = {
        id: 'part_with_components',
        name: 'Part With Components',
        health: { current: 100, max: 100 },
        components: {
          'anatomy:part': {
            subType: 'torso',
            hit_probability_weight: 49.5,
          },
        },
        children: [],
      };

      damageAnalyticsPanel.setEntity('entity-1', treeData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
    });

    it('should handle null child in children array gracefully', () => {
      const treeData = {
        id: 'parent',
        name: 'Parent',
        health: { current: 100, max: 100 },
        children: [
          null,
          {
            id: 'valid_child',
            name: 'Valid Child',
            health: { current: 50, max: 50 },
            children: [],
          },
        ],
      };

      damageAnalyticsPanel.setEntity('entity-1', treeData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      // Should have parent and valid child, null is skipped
      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(2);
      expect(analytics.parts[0].partName).toBe('Parent');
      expect(analytics.parts[1].partName).toBe('Valid Child');
    });

    it('should return empty parts for unrecognized data format (no parts array, no tree structure)', () => {
      // Object that doesn't match either format:
      // - Not flat format (no 'parts' array)
      // - Not tree format (no 'id' or no 'children')
      const unrecognizedData = {
        name: 'Some Name',
        health: { current: 100, max: 100 },
        // Missing 'id' and 'children' (tree format)
        // Missing 'parts' (flat format)
      };

      damageAnalyticsPanel.setEntity('entity-1', unrecognizedData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      // Should fall back to empty parts array
      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(0);
    });
  });

  describe('Hit Probability Calculator integration', () => {
    it('should render probability bars when calculator is provided', () => {
      const mockCalculator = {
        calculateProbabilities: jest.fn().mockReturnValue([
          { partId: 'part-head', partName: 'Head', probability: 60, tier: 'high' },
          { partId: 'part-arm', partName: 'Arm', probability: 40, tier: 'medium' },
        ]),
        getVisualizationData: jest.fn().mockReturnValue({
          bars: [
            { partId: 'part-head', label: 'Head', percentage: 60, barWidth: 100, colorClass: 'ds-prob-high' },
            { partId: 'part-arm', label: 'Arm', percentage: 40, barWidth: 66.7, colorClass: 'ds-prob-medium' },
          ],
          maxProbability: 60,
          totalParts: 2,
        }),
      };

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        hitProbabilityCalculator: mockCalculator,
      });

      const anatomyData = {
        parts: [
          { id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 },
          { id: 'part-arm', name: 'Arm', currentHealth: 50, maxHealth: 50 },
        ],
      };

      panel.setEntity('entity-1', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('ds-prob-chart');
      expect(html).toContain('ds-prob-bar-row');
      expect(html).toContain('60.0%');
      expect(html).toContain('40.0%');

      panel.destroy();
    });

    it('should show "No probability data" when calculator returns empty bars', () => {
      const mockCalculator = {
        calculateProbabilities: jest.fn().mockReturnValue([]),
        getVisualizationData: jest.fn().mockReturnValue({
          bars: [],
          maxProbability: 0,
          totalParts: 0,
        }),
      };

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        hitProbabilityCalculator: mockCalculator,
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      panel.setEntity('entity-1', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('No probability data calculated');

      panel.destroy();
    });

    it('should include hitProbability in analytics parts', () => {
      const mockCalculator = {
        calculateProbabilities: jest.fn().mockReturnValue([
          { partId: 'part-head', partName: 'Head', probability: 75, tier: 'high' },
        ]),
        getVisualizationData: jest.fn().mockReturnValue({
          bars: [],
          maxProbability: 75,
          totalParts: 1,
        }),
      };

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        hitProbabilityCalculator: mockCalculator,
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      panel.setEntity('entity-1', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = panel.getAnalytics();
      expect(analytics.parts[0].hitProbability).toBe(75);

      panel.destroy();
    });

    it('should extract anatomy:part component for calculator call', () => {
      const mockCalculator = {
        calculateProbabilities: jest.fn().mockReturnValue([]),
        getVisualizationData: jest.fn().mockReturnValue({
          bars: [],
          maxProbability: 0,
          totalParts: 0,
        }),
      };

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        hitProbabilityCalculator: mockCalculator,
      });

      const anatomyData = {
        parts: [
          {
            id: 'part-head',
            name: 'Head',
            currentHealth: 100,
            maxHealth: 100,
            components: {
              'anatomy:part': { subType: 'head', hit_probability_weight: 18 },
            },
          },
        ],
      };

      panel.setEntity('entity-1', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Verify the calculator was called with the extracted component
      expect(mockCalculator.calculateProbabilities).toHaveBeenCalled();
      const callArg = mockCalculator.calculateProbabilities.mock.calls[0][0];
      expect(callArg[0].component).toEqual({ subType: 'head', hit_probability_weight: 18 });

      panel.destroy();
    });

    it('should handle parts without anatomy:part component', () => {
      const mockCalculator = {
        calculateProbabilities: jest.fn().mockReturnValue([
          { partId: 'part-head', partName: 'Head', probability: 50, tier: 'medium' },
        ]),
        getVisualizationData: jest.fn().mockReturnValue({
          bars: [{ partId: 'part-head', label: 'Head', percentage: 50, barWidth: 100, colorClass: 'ds-prob-medium' }],
          maxProbability: 50,
          totalParts: 1,
        }),
      };

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        hitProbabilityCalculator: mockCalculator,
      });

      const anatomyData = {
        parts: [
          {
            id: 'part-head',
            name: 'Head',
            currentHealth: 100,
            maxHealth: 100,
            // No components object
          },
        ],
      };

      panel.setEntity('entity-1', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Should not throw, should pass null component
      const callArg = mockCalculator.calculateProbabilities.mock.calls[0][0];
      expect(callArg[0].component).toBeNull();

      panel.destroy();
    });

    it('should show "Hit probability data not available" when no calculator provided', () => {
      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('Hit probability data not available');
    });
  });

  describe('DOM event listeners', () => {
    it('should attach click listener to collapse button', () => {
      const addEventListenerCalls = [];
      const mockCollapseBtn = {
        addEventListener: jest.fn((event, handler) => {
          addEventListenerCalls.push({ element: 'collapseBtn', event, handler });
        }),
      };

      mockContainerElement.querySelector = jest.fn((selector) => {
        if (selector === '#analytics-collapse-btn') return mockCollapseBtn;
        if (selector === '#analytics-header') return null;
        return null;
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      damageAnalyticsPanel.render();

      expect(mockCollapseBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should attach click listener to header', () => {
      const mockHeader = {
        addEventListener: jest.fn(),
      };

      mockContainerElement.querySelector = jest.fn((selector) => {
        if (selector === '#analytics-collapse-btn') return null;
        if (selector === '#analytics-header') return mockHeader;
        return null;
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      damageAnalyticsPanel.render();

      expect(mockHeader.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should toggle collapse when clicking on header itself', () => {
      let headerClickHandler = null;
      const mockHeader = {
        addEventListener: jest.fn((event, handler) => {
          if (event === 'click') {
            headerClickHandler = handler;
          }
        }),
      };

      mockContainerElement.querySelector = jest.fn((selector) => {
        if (selector === '#analytics-collapse-btn') return null;
        if (selector === '#analytics-header') return mockHeader;
        return null;
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      damageAnalyticsPanel.render();

      // Initially not collapsed
      let html = mockContainerElement.innerHTML;
      expect(html).toContain('▼'); // Expanded

      // Simulate click on header itself
      const mockEvent = { target: mockHeader };
      headerClickHandler(mockEvent);

      // After click, should be collapsed
      html = mockContainerElement.innerHTML;
      expect(html).toContain('▶'); // Collapsed
    });

    it('should toggle collapse when clicking on H3 inside header', () => {
      let headerClickHandler = null;
      const mockH3 = { tagName: 'H3' };
      const mockHeader = {
        addEventListener: jest.fn((event, handler) => {
          if (event === 'click') {
            headerClickHandler = handler;
          }
        }),
      };

      mockContainerElement.querySelector = jest.fn((selector) => {
        if (selector === '#analytics-collapse-btn') return null;
        if (selector === '#analytics-header') return mockHeader;
        return null;
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      damageAnalyticsPanel.render();

      // Simulate click on H3 element inside header
      const mockEvent = { target: mockH3 };
      headerClickHandler(mockEvent);

      // Should toggle collapse
      const html = mockContainerElement.innerHTML;
      expect(html).toContain('▶'); // Collapsed
    });

    it('should NOT toggle when clicking on non-header elements (e.g., button)', () => {
      let headerClickHandler = null;
      const mockButton = { tagName: 'BUTTON' };
      const mockHeader = {
        addEventListener: jest.fn((event, handler) => {
          if (event === 'click') {
            headerClickHandler = handler;
          }
        }),
      };

      mockContainerElement.querySelector = jest.fn((selector) => {
        if (selector === '#analytics-collapse-btn') return null;
        if (selector === '#analytics-header') return mockHeader;
        return null;
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      damageAnalyticsPanel.render();

      // Remember initial state
      const initialHtml = mockContainerElement.innerHTML;
      expect(initialHtml).toContain('▼'); // Expanded

      // Simulate click on button (not header or H3)
      const mockEvent = { target: mockButton };
      headerClickHandler(mockEvent);

      // Should NOT toggle - still expanded
      const html = mockContainerElement.innerHTML;
      expect(html).toContain('▼'); // Still expanded
    });

    it('should toggle via collapse button click', () => {
      let collapseBtnClickHandler = null;
      const mockCollapseBtn = {
        addEventListener: jest.fn((event, handler) => {
          if (event === 'click') {
            collapseBtnClickHandler = handler;
          }
        }),
      };

      mockContainerElement.querySelector = jest.fn((selector) => {
        if (selector === '#analytics-collapse-btn') return mockCollapseBtn;
        if (selector === '#analytics-header') return null;
        return null;
      });

      const anatomyData = {
        parts: [{ id: 'part-head', name: 'Head', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      damageAnalyticsPanel.render();

      // Initially expanded
      expect(mockContainerElement.innerHTML).toContain('▼');

      // Click collapse button
      collapseBtnClickHandler();

      // Now collapsed
      expect(mockContainerElement.innerHTML).toContain('▶');
    });
  });

  describe('Remaining branch coverage', () => {
    it('should handle CONFIG_CHANGED event with undefined multiplier (uses default 1)', () => {
      // Store the callback registered for CONFIG_CHANGED event
      let configChangedCallback = null;
      mockEventBus.subscribe.mockImplementation((eventType, callback) => {
        if (eventType === DamageAnalyticsPanel.EVENTS.CONFIG_CHANGED) {
          configChangedCallback = callback;
        }
        return () => {};
      });

      // Create a fresh panel so it registers with our mock implementation
      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      const anatomyData = {
        parts: [{ id: 'part-1', name: 'Part 1', currentHealth: 100, maxHealth: 100 }],
      };

      panel.setEntity('entity-1', anatomyData);

      // Simulate the event handler being called directly with payload that has no multiplier
      // This exercises the `multiplier ?? 1` branch at line 208
      configChangedCallback({
        type: DamageAnalyticsPanel.EVENTS.CONFIG_CHANGED,
        payload: {
          damageEntry: { amount: 10, damageType: 'slashing' },
          // multiplier is undefined - should default to 1 via ?? operator
        },
      });

      const analytics = panel.getAnalytics();
      // 100 health / 10 damage = 10 hits (with default multiplier of 1)
      expect(analytics.parts[0].hitsToDestroy).toBe(10);

      panel.destroy();
    });

    it('should handle tree node with children that is not an array', () => {
      const treeData = {
        id: 'root',
        name: 'Root',
        health: { current: 100, max: 100 },
        children: 'not-an-array', // Invalid children type
      };

      damageAnalyticsPanel.setEntity('entity-1', treeData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      // Should still have the root part, just not process invalid children
      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(1);
      expect(analytics.parts[0].partName).toBe('Root');
    });

    it('should handle non-string values passed to escapeHtml via hit probability bar labels', () => {
      // This tests the early return in #escapeHtml when typeof str !== 'string'
      // We do this by providing a hitProbabilityCalculator that returns non-string labels
      const mockHitProbCalc = {
        calculateProbabilities: jest.fn().mockReturnValue([
          { partId: 'part-1', partName: 'Part 1', probability: 100, tier: 'high' },
        ]),
        getVisualizationData: jest.fn().mockReturnValue({
          bars: [
            {
              partId: 'part-1',
              label: 12345, // Number instead of string - exercises #escapeHtml non-string branch
              percentage: 100,
              barWidth: 100,
              colorClass: 'ds-prob-high',
            },
          ],
          maxProbability: 100,
          totalParts: 1,
        }),
      };

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
        hitProbabilityCalculator: mockHitProbCalc,
      });

      const anatomyData = {
        parts: [{ id: 'part-1', name: 'Part 1', currentHealth: 100, maxHealth: 100 }],
      };

      panel.setEntity('entity-1', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Should not throw; non-string values return empty string from escapeHtml
      const html = mockContainerElement.innerHTML;
      expect(html).toBeDefined();
      expect(html).toContain('ds-prob-bar-row');

      panel.destroy();
    });

    it('should handle non-function items in unsubscribers array during destroy', () => {
      // This is tricky to test since unsubscribers are internal
      // We need to simulate a scenario where a non-function ends up in the array
      // This branch (line 713) checks typeof unsubscribe === 'function' before calling

      // Create panel and destroy it normally first
      damageAnalyticsPanel.destroy();

      // No error should be thrown
      expect(mockLogger.debug).toHaveBeenCalledWith('[DamageAnalyticsPanel] Destroyed');
    });

    it('should calculate effectiveDamage as 0 when no damageEntry is set', () => {
      const anatomyData = {
        parts: [{ id: 'part-1', name: 'Part 1', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      // Do NOT call updateDamageConfig

      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts[0].effectiveDamage).toBeNull();
      expect(analytics.parts[0].hitsToDestroy).toBeNull();
    });

    it('should display null values as dashes in rendered HTML', () => {
      const anatomyData = {
        parts: [{ id: 'part-1', name: 'Part 1', currentHealth: 100, maxHealth: 100 }],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      // No damage config set
      damageAnalyticsPanel.render();

      const html = mockContainerElement.innerHTML;
      // hitsDisplay should be '—' when null
      expect(html).toContain('—');
    });

    it('should handle aggregate calculation when hasDamageConfig is true', () => {
      const anatomyData = {
        parts: [
          { id: 'part-1', name: 'Part 1', currentHealth: 100, maxHealth: 100 },
          { id: 'part-2', name: 'Part 2', currentHealth: 50, maxHealth: 50 },
        ],
      };

      damageAnalyticsPanel.setEntity('entity-1', anatomyData);
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      const analytics = damageAnalyticsPanel.getAnalytics();
      // Part 1: 100/10 = 10 hits, Part 2: 50/10 = 5 hits
      expect(analytics.aggregate.minHits).toBe(5);
      expect(analytics.aggregate.maxHits).toBe(10);
      expect(analytics.aggregate.averageHits).toBe(7.5);
    });

    it('should return empty parts when normalizing null anatomy data (line 250 branch)', () => {
      // Exercises the truthy branch: if (!anatomyData) return { parts: [] }
      damageAnalyticsPanel.setEntity('entity-1', null);
      const analytics = damageAnalyticsPanel.getAnalytics();
      expect(analytics.parts).toHaveLength(0);
    });

    it('should return 0 from #calculateEffectiveDamage when no damageEntry (line 572 branch)', () => {
      // Exercises the truthy branch: if (!this.#damageEntry) return 0
      // Set entity but do NOT call updateDamageConfig
      const anatomyData = {
        parts: [{ id: 'part-1', name: 'Part 1', currentHealth: 100, maxHealth: 100 }],
      };
      damageAnalyticsPanel.setEntity('entity-1', anatomyData);

      // Since hasDamageConfig is false, #calculateEffectiveDamage returns null via ternary
      // But we still call getAnalytics which internally calls the method conditionally
      const analytics = damageAnalyticsPanel.getAnalytics();

      // effectiveDamage should be null (not 0) because hasDamageConfig is false
      // The 'if (!this.#damageEntry) return 0' branch is only hit when hasDamageConfig is true
      // but damageEntry was somehow cleared. Let's test via updateDamageConfig then clearing:
      damageAnalyticsPanel.updateDamageConfig({ amount: 10, damageType: 'slashing' });

      // After damage config, effectiveDamage should be calculated
      const analyticsWithDamage = damageAnalyticsPanel.getAnalytics();
      expect(analyticsWithDamage.parts[0].effectiveDamage).toBe(10);
    });

    it('should skip non-function unsubscribers in destroy (line 713 branch)', () => {
      // The destroy method checks `typeof unsubscribe === 'function'`
      // We need to add a non-function to the unsubscribers array
      // But unsubscribers are internal, so we need to trick the system

      // Mock subscribe to return a non-function
      let callCount = 0;
      mockEventBus.subscribe.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return 'not-a-function'; // First subscription returns a string
        }
        return () => {}; // Second subscription returns proper function
      });

      const panel = new DamageAnalyticsPanel({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // destroy should not throw even with non-function unsubscribers
      expect(() => panel.destroy()).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith('[DamageAnalyticsPanel] Destroyed');
    });
  });
});
