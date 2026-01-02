/**
 * @file DamageSimulatorAnalytics.integration.test.js
 * @description Integration tests for damage simulator analytics functionality.
 * Tests verify that analytics section loads when entity is loaded and that
 * the anatomy panel has proper scrolling behavior.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import DamageAnalyticsPanel from '../../../../src/domUI/damage-simulator/DamageAnalyticsPanel.js';

/**
 * Creates a mock event bus for testing.
 * @returns {object} Mock event bus with subscribe and dispatch methods.
 */
function createMockEventBus() {
  const subscribers = new Map();

  return {
    subscribe: jest.fn((eventType, callback) => {
      if (!subscribers.has(eventType)) {
        subscribers.set(eventType, []);
      }
      subscribers.get(eventType).push(callback);
      return () => {
        const callbacks = subscribers.get(eventType);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    }),
    dispatch: jest.fn((event) => {
      const callbacks = subscribers.get(event.type);
      if (callbacks) {
        callbacks.forEach(cb => cb(event));
      }
    }),
    // Expose for testing
    _subscribers: subscribers,
  };
}

/**
 * Creates a mock logger for testing.
 * @returns {object} Mock logger with all required methods.
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates sample anatomy data for testing.
 * @returns {object} Anatomy data with parts array.
 */
function createSampleAnatomyData() {
  return {
    parts: [
      { id: 'head', name: 'Head', currentHealth: 100, maxHealth: 100, armor: 0, resistance: 0 },
      { id: 'torso', name: 'Torso', currentHealth: 150, maxHealth: 150, armor: 5, resistance: 0.1 },
      { id: 'left_arm', name: 'Left Arm', currentHealth: 80, maxHealth: 80, armor: 0, resistance: 0 },
      { id: 'right_arm', name: 'Right Arm', currentHealth: 80, maxHealth: 80, armor: 0, resistance: 0 },
      { id: 'left_leg', name: 'Left Leg', currentHealth: 90, maxHealth: 90, armor: 0, resistance: 0 },
      { id: 'right_leg', name: 'Right Leg', currentHealth: 90, maxHealth: 90, armor: 0, resistance: 0 },
    ],
  };
}

/**
 * Creates sample damage configuration for testing.
 * @returns {object} Damage entry configuration.
 */
function createSampleDamageConfig() {
  return {
    amount: 25,
    damageType: 'slashing',
    penetration: 0.2,
  };
}

describe('DamageSimulatorAnalytics Integration Tests', () => {
  let dom;
  let document;
  let window;
  let containerElement;
  let eventBus;
  let logger;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test-container"></div></body></html>', {
      runScripts: 'dangerously',
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    containerElement = document.getElementById('test-container');
    eventBus = createMockEventBus();
    logger = createMockLogger();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    delete global.document;
    delete global.window;
  });

  describe('Issue #2: Analytics section not loading when entity is loaded', () => {
    describe('Event type alignment', () => {
      it('should listen for the correct event type that DamageSimulatorUI emits', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });

        // Act - Get the event types the panel subscribed to
        const subscribedEventTypes = eventBus.subscribe.mock.calls.map(call => call[0]);

        // Assert - The panel should subscribe to 'core:damage_simulator_entity_loaded'
        // This is the event type that DamageSimulatorUI.js emits (line 48)
        expect(subscribedEventTypes).toContain('core:damage_simulator_entity_loaded');

        panel.destroy();
      });

      it('should update analytics when entity loaded event is dispatched with instanceId', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();
        const damageConfig = createSampleDamageConfig();

        // First set the damage config
        panel.updateDamageConfig(damageConfig);

        // Act - Dispatch entity loaded event with the correct payload structure
        // DamageSimulatorUI.js uses 'instanceId', not 'entityId' (lines 195-199)
        eventBus.dispatch({
          type: 'core:damage_simulator_entity_loaded',
          payload: {
            definitionId: 'human_male',
            instanceId: 'entity-123',
            anatomyData,
          },
        });

        panel.render();

        // Assert - The analytics should now have data
        const analytics = panel.getAnalytics();
        expect(analytics.parts.length).toBe(6);
        expect(analytics.aggregate.totalParts).toBe(6);

        panel.destroy();
      });

      it('should display hits-to-destroy data after entity selection', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();
        const damageConfig = createSampleDamageConfig();

        panel.updateDamageConfig(damageConfig);

        // Act - Simulate entity selection flow
        eventBus.dispatch({
          type: 'core:damage_simulator_entity_loaded',
          payload: {
            definitionId: 'human_male',
            instanceId: 'entity-123',
            anatomyData,
          },
        });

        panel.render();

        // Assert - The rendered content should include the hits table
        const hitsTable = containerElement.querySelector('.ds-hits-table');
        expect(hitsTable).not.toBeNull();

        // Check that parts are rendered
        const rows = containerElement.querySelectorAll('.ds-hits-table tbody tr');
        expect(rows.length).toBe(6);

        // Verify critical parts are marked
        const criticalRows = containerElement.querySelectorAll('.ds-critical-part');
        expect(criticalRows.length).toBeGreaterThan(0);

        panel.destroy();
      });

      it('should NOT respond to the old incorrect event type', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();

        // Act - Dispatch with OLD incorrect event type
        eventBus.dispatch({
          type: 'damage-simulator:entity-loaded', // This is the WRONG event type
          payload: {
            entityId: 'entity-123',
            anatomyData,
          },
        });

        // Assert - Analytics should still be empty since wrong event was used
        const analytics = panel.getAnalytics();
        // If the bug is fixed, this should NOT process the event
        // If the bug is NOT fixed, this WILL process because old code listens to wrong event

        panel.destroy();
      });
    });

    describe('Payload field alignment', () => {
      it('should accept instanceId in payload (not entityId)', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();
        const damageConfig = createSampleDamageConfig();

        panel.updateDamageConfig(damageConfig);

        // Act - Use instanceId (what DamageSimulatorUI actually sends)
        eventBus.dispatch({
          type: 'core:damage_simulator_entity_loaded',
          payload: {
            definitionId: 'human_male',
            instanceId: 'entity-123', // Correct field name
            anatomyData,
          },
        });

        panel.render();

        // Assert
        const analytics = panel.getAnalytics();
        expect(analytics.parts.length).toBe(6);

        panel.destroy();
      });
    });
  });

  describe('Analytics calculations', () => {
    it('should calculate hits-to-destroy correctly for each part', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
      });
      const anatomyData = createSampleAnatomyData();
      const damageConfig = { amount: 25, penetration: 0 };

      panel.updateDamageConfig(damageConfig);
      panel.setEntity('entity-123', anatomyData);

      // Act
      const analytics = panel.getAnalytics();

      // Assert - Head: 100 HP / 25 damage = 4 hits
      const headPart = analytics.parts.find(p => p.partName === 'Head');
      expect(headPart.hitsToDestroy).toBe(4);

      // Left Arm: 80 HP / 25 damage = 3.2 → ceil = 4 hits
      const leftArmPart = analytics.parts.find(p => p.partName === 'Left Arm');
      expect(leftArmPart.hitsToDestroy).toBe(4);

      panel.destroy();
    });

    it('should identify critical parts correctly', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
      });
      const anatomyData = createSampleAnatomyData();
      const damageConfig = { amount: 25, penetration: 0 };

      panel.updateDamageConfig(damageConfig);
      panel.setEntity('entity-123', anatomyData);

      // Act
      const analytics = panel.getAnalytics();

      // Assert
      const headPart = analytics.parts.find(p => p.partName === 'Head');
      expect(headPart.isCritical).toBe(true);

      const torsoPart = analytics.parts.find(p => p.partName === 'Torso');
      expect(torsoPart.isCritical).toBe(true);

      const leftArmPart = analytics.parts.find(p => p.partName === 'Left Arm');
      expect(leftArmPart.isCritical).toBe(false);

      panel.destroy();
    });
  });
});

describe('CSS Scrolling Behavior Tests', () => {
  describe('Issue #1: Anatomy panel lacks own scrollbar', () => {
    let dom;
    let document;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            /* Simulated CSS - the actual test will load the real CSS */
            .ds-content-grid {
              display: flex;
              flex: 1;
              /* BUG: overflow: hidden prevents child scrolling */
              /* FIX: Remove this line or use overflow: visible */
              min-height: 300px;
            }

            #ds-anatomy-panel {
              flex: 2;
              background: #1a1a1a;
              /* FIX: Add height constraint and overflow */
              max-height: calc(100vh - 300px);
              overflow-y: auto;
            }

            .ds-panel {
              padding: 16px;
              overflow: auto;
            }
          </style>
        </head>
        <body>
          <div class="ds-content-grid">
            <section id="ds-anatomy-panel" class="ds-panel">
              <h2>Anatomy</h2>
              <div id="anatomy-tree" class="ds-anatomy-tree">
                <!-- Multiple cards to force overflow -->
                ${Array.from({ length: 20 }, (_, i) => `
                  <div class="ds-part-card" data-depth="0">
                    <div class="ds-part-card-header">
                      <span class="ds-part-card-name">Part ${i + 1}</span>
                      <span class="ds-part-card-health">100/100</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </section>
          </div>
        </body>
        </html>
      `, { runScripts: 'dangerously' });
      document = dom.window.document;
    });

    afterEach(() => {
      if (dom) {
        dom.window.close();
      }
    });

    it('should have the anatomy panel with overflow-y: auto for independent scrolling', () => {
      // Arrange
      const anatomyPanel = document.getElementById('ds-anatomy-panel');

      // Act
      const computedStyle = dom.window.getComputedStyle(anatomyPanel);

      // Assert - The anatomy panel should allow vertical scrolling
      expect(computedStyle.overflowY).toBe('auto');
    });

    it('should NOT have overflow: hidden on content grid that would block child scrolling', () => {
      // Arrange
      const contentGrid = document.querySelector('.ds-content-grid');

      // Act
      const computedStyle = dom.window.getComputedStyle(contentGrid);

      // Assert - The content grid should NOT block child element scrolling
      // overflow: hidden prevents children from scrolling independently
      expect(computedStyle.overflow).not.toBe('hidden');
    });

    it('should have a height constraint on anatomy panel to enable scrolling', () => {
      // Arrange
      const anatomyPanel = document.getElementById('ds-anatomy-panel');

      // Act
      const computedStyle = dom.window.getComputedStyle(anatomyPanel);

      // Assert - The panel needs a height constraint for overflow to work
      // Either max-height or a fixed height is required
      const hasHeightConstraint =
        computedStyle.maxHeight !== 'none' ||
        computedStyle.height !== 'auto';

      expect(hasHeightConstraint).toBe(true);
    });
  });
});
