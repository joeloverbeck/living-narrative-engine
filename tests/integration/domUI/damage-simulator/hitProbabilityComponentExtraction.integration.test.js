/**
 * @file hitProbabilityComponentExtraction.integration.test.js
 * @description Integration tests for hit probability component extraction in DamageAnalyticsPanel.
 * Tests verify that hit probabilities are correctly loaded from anatomy:part components
 * and displayed with proper weighted distribution.
 *
 * BUG REPRODUCTION:
 * In DamageAnalyticsPanel.js:#generateHitProbabilityHTML, the code passes the entire
 * AnatomyPart object as 'component' instead of extracting the 'anatomy:part' component.
 * This causes HitProbabilityCalculator to receive null/wrong data and default all
 * weights to 0, resulting in equal probability distribution (3.3% each for 30 parts).
 * @see DamageAnalyticsPanel.js - Bug location at lines 434-438
 * @see HitProbabilityCalculator.js - Expected component format
 * @see hitProbabilityWeightUtils.js - Weight extraction logic
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import DamageAnalyticsPanel from '../../../../src/domUI/damage-simulator/DamageAnalyticsPanel.js';
import HitProbabilityCalculator from '../../../../src/domUI/damage-simulator/HitProbabilityCalculator.js';
import * as hitProbabilityWeightUtils from '../../../../src/anatomy/utils/hitProbabilityWeightUtils.js';

/**
 * Creates a mock event bus for testing.
 *
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
        callbacks.forEach((cb) => cb(event));
      }
    }),
    _subscribers: subscribers,
  };
}

/**
 * Creates a mock logger for testing.
 *
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
 * Creates anatomy data with the tree structure that AnatomyDataExtractor produces.
 * This matches the real structure from entity loading where:
 * - Tree nodes have 'components' containing merged component data
 * - 'anatomy:part' is nested inside 'components' object
 *
 * @returns {object} Anatomy tree node with nested components
 */
function createRealisticAnatomyTreeData() {
  return {
    id: 'torso-001',
    name: 'torso',
    health: { current: 50, max: 50 },
    components: {
      'anatomy:part': {
        subType: 'torso',
        hit_probability_weight: 49.5,
        health_calculation_weight: 10,
      },
      'anatomy:part_health': {
        currentHealth: 50,
        maxHealth: 50,
        state: 'healthy',
      },
      'core:name': {
        text: 'torso',
      },
    },
    children: [
      {
        id: 'head-001',
        name: 'head',
        health: { current: 40, max: 40 },
        components: {
          'anatomy:part': {
            subType: 'head',
            hit_probability_weight: 18,
            health_calculation_weight: 8,
          },
          'anatomy:part_health': {
            currentHealth: 40,
            maxHealth: 40,
            state: 'healthy',
          },
          'core:name': {
            text: 'head',
          },
        },
        children: [],
      },
      {
        id: 'left-arm-001',
        name: 'left arm',
        health: { current: 25, max: 25 },
        components: {
          'anatomy:part': {
            subType: 'arm',
            hit_probability_weight: 8,
            health_calculation_weight: 3,
          },
          'anatomy:part_health': {
            currentHealth: 25,
            maxHealth: 25,
            state: 'healthy',
          },
          'core:name': {
            text: 'left arm',
          },
        },
        children: [],
      },
      {
        id: 'right-arm-001',
        name: 'right arm',
        health: { current: 25, max: 25 },
        components: {
          'anatomy:part': {
            subType: 'arm',
            hit_probability_weight: 8,
            health_calculation_weight: 3,
          },
          'anatomy:part_health': {
            currentHealth: 25,
            maxHealth: 25,
            state: 'healthy',
          },
          'core:name': {
            text: 'right arm',
          },
        },
        children: [],
      },
      {
        id: 'heart-001',
        name: 'heart',
        health: { current: 50, max: 50 },
        components: {
          'anatomy:part': {
            subType: 'heart',
            hit_probability_weight: 0, // Internal organ - not directly targetable
            health_calculation_weight: 15,
          },
          'anatomy:part_health': {
            currentHealth: 50,
            maxHealth: 50,
            state: 'healthy',
          },
          'core:name': {
            text: 'heart',
          },
        },
        children: [],
      },
    ],
  };
}

describe('Hit Probability Component Extraction Integration Tests', () => {
  let dom;
  let document;
  let window;
  let containerElement;
  let eventBus;
  let logger;

  beforeEach(() => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="test-container"></div></body></html>',
      {
        runScripts: 'dangerously',
      }
    );
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

  describe('Bug Reproduction: anatomy:part component not extracted correctly', () => {
    it('should extract hit_probability_weight from nested anatomy:part component', () => {
      // Arrange - Create panel with real HitProbabilityCalculator
      const calculator = new HitProbabilityCalculator({
        hitProbabilityWeightUtils,
        logger,
      });

      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: calculator,
      });

      // Create anatomy data with realistic nested structure
      const anatomyData = createRealisticAnatomyTreeData();

      // Act - Load entity with tree structure (triggers #normalizeAnatomyData)
      panel.setEntity('entity-123', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Assert - Get analytics and check probabilities
      const analytics = panel.getAnalytics();

      // Verify we have all parts
      expect(analytics.parts.length).toBe(5);

      // The key assertion: probabilities should NOT be equal
      // Total weight = 49.5 + 18 + 8 + 8 + 0 = 83.5
      // Torso expected probability: 49.5 / 83.5 * 100 ≈ 59.3%
      // Head expected probability: 18 / 83.5 * 100 ≈ 21.6%
      // Each arm expected: 8 / 83.5 * 100 ≈ 9.6%
      // Heart expected: 0% (weight 0)

      // Find torso part
      const torsoPart = analytics.parts.find(
        (p) => p.partId === 'torso-001' || p.partName === 'torso'
      );

      // If the bug exists, torso would have ~20% (1/5) probability
      // If the bug is fixed, torso should have ~59% probability
      expect(torsoPart).toBeDefined();

      // This is the critical assertion that proves the fix works
      // Bug behavior: all parts get equal probability (~20% for 5 parts)
      // Fixed behavior: torso gets ~59% (highest weighted part)
      expect(torsoPart.hitProbability || torsoPart.probability).toBeGreaterThan(
        50
      );

      panel.destroy();
    });

    it('should assign zero probability to parts with hit_probability_weight of 0', () => {
      // Arrange
      const calculator = new HitProbabilityCalculator({
        hitProbabilityWeightUtils,
        logger,
      });

      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: calculator,
      });

      const anatomyData = createRealisticAnatomyTreeData();

      // Act
      panel.setEntity('entity-123', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();

      // Heart has hit_probability_weight: 0, should have 0% probability
      const heartPart = analytics.parts.find(
        (p) => p.partId === 'heart-001' || p.partName === 'heart'
      );

      expect(heartPart).toBeDefined();
      expect(heartPart.hitProbability || heartPart.probability || 0).toBe(0);

      panel.destroy();
    });

    it('should display different probabilities for parts with different weights', () => {
      // Arrange
      const calculator = new HitProbabilityCalculator({
        hitProbabilityWeightUtils,
        logger,
      });

      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: calculator,
      });

      const anatomyData = createRealisticAnatomyTreeData();

      // Act
      panel.setEntity('entity-123', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();

      const torsoPart = analytics.parts.find(
        (p) => p.partId === 'torso-001' || p.partName === 'torso'
      );
      const headPart = analytics.parts.find(
        (p) => p.partId === 'head-001' || p.partName === 'head'
      );
      const leftArmPart = analytics.parts.find(
        (p) => p.partId === 'left-arm-001' || p.partName === 'left arm'
      );

      // Get probabilities (handle different property names in the codebase)
      const torsoProbability =
        torsoPart?.hitProbability ?? torsoPart?.probability ?? 0;
      const headProbability =
        headPart?.hitProbability ?? headPart?.probability ?? 0;
      const armProbability =
        leftArmPart?.hitProbability ?? leftArmPart?.probability ?? 0;

      // Torso (weight 49.5) should have higher probability than head (weight 18)
      expect(torsoProbability).toBeGreaterThan(headProbability);

      // Head (weight 18) should have higher probability than arm (weight 8)
      expect(headProbability).toBeGreaterThan(armProbability);

      panel.destroy();
    });

    it('should sum all probabilities to approximately 100%', () => {
      // Arrange
      const calculator = new HitProbabilityCalculator({
        hitProbabilityWeightUtils,
        logger,
      });

      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: calculator,
      });

      const anatomyData = createRealisticAnatomyTreeData();

      // Act
      panel.setEntity('entity-123', anatomyData);
      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();

      const totalProbability = analytics.parts.reduce((sum, part) => {
        const prob = part.hitProbability ?? part.probability ?? 0;
        return sum + prob;
      }, 0);

      // Allow for rounding errors
      expect(totalProbability).toBeGreaterThan(99);
      expect(totalProbability).toBeLessThan(101);

      panel.destroy();
    });
  });

  describe('Event-based entity loading', () => {
    it('should correctly extract components when entity is loaded via event', () => {
      // Arrange
      const calculator = new HitProbabilityCalculator({
        hitProbabilityWeightUtils,
        logger,
      });

      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: calculator,
      });

      const anatomyData = createRealisticAnatomyTreeData();

      // Act - Dispatch entity loaded event (how it works in real usage)
      eventBus.dispatch({
        type: 'core:damage_simulator_entity_loaded',
        payload: {
          definitionId: 'human_male',
          instanceId: 'entity-123',
          anatomyData,
        },
      });

      panel.updateDamageConfig({ amount: 10, damageType: 'slashing' });
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();

      // Verify parts were loaded
      expect(analytics.parts.length).toBe(5);

      // Verify weighted distribution (not equal)
      const probabilities = analytics.parts.map(
        (p) => p.hitProbability ?? p.probability ?? 0
      );
      const uniqueProbabilities = new Set(probabilities.filter((p) => p > 0));

      // With different weights, we should have different probabilities
      // (not all the same like 20% each)
      expect(uniqueProbabilities.size).toBeGreaterThan(1);

      panel.destroy();
    });
  });
});
