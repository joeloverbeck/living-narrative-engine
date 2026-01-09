/**
 * @file damageAnalyticsPanelTreeData.integration.test.js
 * @description Integration tests proving that DamageAnalyticsPanel fails to process
 * the tree format data returned by AnatomyDataExtractor.extractFromEntity().
 *
 * Root Cause:
 * - AnatomyDataExtractor returns: { id, name, health: {current, max}, children: [...] }
 * - DamageAnalyticsPanel expects: { parts: [{ id, name, currentHealth, maxHealth }, ...] }
 *
 * The mismatch causes analytics to show "No anatomy data available" even after
 * entity selection because this.#anatomyData.parts is undefined on tree data.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import DamageAnalyticsPanel from '../../../../src/domUI/damage-simulator/DamageAnalyticsPanel.js';

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
 * Creates a mock HitProbabilityCalculator for testing.
 *
 * @returns {object} Mock calculator with expected methods.
 */
function createMockHitProbabilityCalculator() {
  return {
    calculateProbabilities: jest.fn((parts) => {
      if (!parts || parts.length === 0) return [];
      const totalWeight = parts.length * 10;
      return parts.map((part) => ({
        partId: part.id,
        partName: part.name || part.id,
        weight: 10,
        probability: (10 / totalWeight) * 100,
        tier: 'medium',
      }));
    }),
    getVisualizationData: jest.fn((probabilities) => {
      if (!probabilities || probabilities.length === 0) {
        return { bars: [], maxProbability: 0, totalParts: 0 };
      }
      const maxProbability = Math.max(...probabilities.map((p) => p.probability));
      return {
        bars: probabilities.map((p) => ({
          partId: p.partId,
          label: p.partName,
          percentage: p.probability,
          barWidth: maxProbability > 0 ? (p.probability / maxProbability) * 100 : 0,
          colorClass: 'ds-prob-medium',
        })),
        maxProbability,
        totalParts: probabilities.length,
      };
    }),
  };
}

/**
 * Creates tree-format anatomy data matching AnatomyDataExtractor output.
 * This is the ACTUAL format returned by extractFromEntity().
 *
 * @returns {object} AnatomyTreeNode structure with nested health and children.
 */
function createTreeFormatAnatomyData() {
  return {
    id: 'part_torso_001',
    name: 'Torso',
    components: {
      'anatomy:part': { subType: 'torso' },
      'anatomy:part_health': { currentHealth: 150, maxHealth: 150 },
    },
    health: { current: 150, max: 150 },
    children: [
      {
        id: 'part_head_001',
        name: 'Head',
        components: {
          'anatomy:part': { subType: 'head' },
          'anatomy:part_health': { currentHealth: 100, maxHealth: 100 },
        },
        health: { current: 100, max: 100 },
        children: [],
      },
      {
        id: 'part_left_arm_001',
        name: 'Left Arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:part_health': { currentHealth: 80, maxHealth: 80 },
        },
        health: { current: 80, max: 80 },
        children: [],
      },
      {
        id: 'part_right_arm_001',
        name: 'Right Arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:part_health': { currentHealth: 80, maxHealth: 80 },
        },
        health: { current: 80, max: 80 },
        children: [],
      },
    ],
  };
}

/**
 * Creates flat-format anatomy data matching the panel's expected format.
 * This is what SHOULD be stored internally after normalization.
 *
 * @returns {object} Flat structure with parts array.
 */
function createFlatFormatAnatomyData() {
  return {
    parts: [
      {
        id: 'part_torso_001',
        name: 'Torso',
        currentHealth: 150,
        maxHealth: 150,
      },
      {
        id: 'part_head_001',
        name: 'Head',
        currentHealth: 100,
        maxHealth: 100,
      },
      {
        id: 'part_left_arm_001',
        name: 'Left Arm',
        currentHealth: 80,
        maxHealth: 80,
      },
      {
        id: 'part_right_arm_001',
        name: 'Right Arm',
        currentHealth: 80,
        maxHealth: 80,
      },
    ],
  };
}

describe('DamageAnalyticsPanel - Tree Data Format Handling', () => {
  let dom;
  let document;
  let window;
  let containerElement;
  let eventBus;
  let logger;

  beforeEach(() => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="test-container"></div></body></html>',
      { runScripts: 'dangerously' }
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

  describe('Data Structure Mismatch', () => {
    it('should correctly identify tree format data structure', () => {
      // Demonstrates the data structure returned by AnatomyDataExtractor
      const treeData = createTreeFormatAnatomyData();

      // Tree format has these properties:
      expect(treeData.id).toBe('part_torso_001');
      expect(treeData.name).toBe('Torso');
      expect(treeData.health).toEqual({ current: 150, max: 150 });
      expect(treeData.children).toHaveLength(3);

      // Tree format does NOT have a 'parts' array at root
      expect(treeData.parts).toBeUndefined();
    });

    it('should correctly identify flat format data structure', () => {
      // Demonstrates the format expected by DamageAnalyticsPanel
      const flatData = createFlatFormatAnatomyData();

      // Flat format has a 'parts' array at root
      expect(flatData.parts).toBeDefined();
      expect(flatData.parts).toHaveLength(4);

      // Each part has health at top level, not nested
      expect(flatData.parts[0].currentHealth).toBe(150);
      expect(flatData.parts[0].maxHealth).toBe(150);

      // Flat format does NOT have 'health' nested object
      expect(flatData.parts[0].health).toBeUndefined();
    });
  });

  describe('Analytics Calculation with Tree Data', () => {
    it('should populate parts when setEntity receives tree-format data', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });
      const treeData = createTreeFormatAnatomyData();

      // Act - Pass tree data (as returned by AnatomyDataExtractor)
      panel.setEntity('entity-123', treeData);
      panel.render();

      // Assert - Analytics should find parts from tree data
      const analytics = panel.getAnalytics();

      // Tree has 4 parts: torso + head + left_arm + right_arm
      expect(analytics.parts.length).toBe(4);
      expect(analytics.aggregate.totalParts).toBe(4);

      panel.destroy();
    });

    it('should NOT show "No anatomy data available" when tree data is provided', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });
      const treeData = createTreeFormatAnatomyData();

      // Act - Pass tree data
      panel.setEntity('entity-123', treeData);
      panel.render();

      // Assert - Should NOT show the error message
      const renderedHTML = containerElement.innerHTML;
      expect(renderedHTML).not.toContain('No anatomy data available');

      panel.destroy();
    });

    it('should correctly map nested health to flat currentHealth/maxHealth', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });
      const treeData = createTreeFormatAnatomyData();

      // Act
      panel.setEntity('entity-123', treeData);
      panel.render();

      // Assert - Parts should have currentHealth/maxHealth at top level
      const analytics = panel.getAnalytics();

      const torsoPart = analytics.parts.find((p) => p.partId === 'part_torso_001');
      expect(torsoPart).toBeDefined();
      expect(torsoPart.currentHealth).toBe(150);
      expect(torsoPart.maxHealth).toBe(150);

      const headPart = analytics.parts.find((p) => p.partId === 'part_head_001');
      expect(headPart).toBeDefined();
      expect(headPart.currentHealth).toBe(100);
      expect(headPart.maxHealth).toBe(100);

      panel.destroy();
    });
  });

  describe('Event-Based Entity Loading with Tree Data', () => {
    it('should process tree data from ENTITY_LOADED event', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });
      const treeData = createTreeFormatAnatomyData();

      // Act - Simulate event from DamageSimulatorUI with tree data
      eventBus.dispatch({
        type: 'core:damage_simulator_entity_loaded',
        payload: {
          definitionId: 'human_male',
          instanceId: 'entity-123',
          anatomyData: treeData,
        },
      });
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();
      expect(analytics.parts.length).toBe(4);

      panel.destroy();
    });

    it('should show hit probability data when tree data is provided', () => {
      // Arrange
      const mockCalculator = createMockHitProbabilityCalculator();
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: mockCalculator,
      });
      const treeData = createTreeFormatAnatomyData();

      // Act
      panel.setEntity('entity-123', treeData);
      panel.render();

      // Assert - Hit probability should be calculated and displayed
      const renderedHTML = containerElement.innerHTML;
      expect(renderedHTML).not.toContain('Hit probability data not available');

      // The calculator should have been called with parts
      expect(mockCalculator.calculateProbabilities).toHaveBeenCalled();

      panel.destroy();
    });
  });

  describe('Backward Compatibility with Flat Data', () => {
    it('should still work when flat-format data is provided', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });
      const flatData = createFlatFormatAnatomyData();

      // Act
      panel.setEntity('entity-123', flatData);
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();
      expect(analytics.parts.length).toBe(4);
      expect(analytics.aggregate.totalParts).toBe(4);

      panel.destroy();
    });

    it('should handle null anatomy data gracefully', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });

      // Act
      panel.setEntity('entity-123', null);
      panel.render();

      // Assert - Should not throw, should show empty state
      const analytics = panel.getAnalytics();
      expect(analytics.parts.length).toBe(0);

      panel.destroy();
    });

    it('should handle undefined anatomy data gracefully', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });

      // Act
      panel.setEntity('entity-123', undefined);
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();
      expect(analytics.parts.length).toBe(0);

      panel.destroy();
    });

    it('should handle empty object anatomy data gracefully', () => {
      // Arrange
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: createMockHitProbabilityCalculator(),
      });

      // Act
      panel.setEntity('entity-123', {});
      panel.render();

      // Assert
      const analytics = panel.getAnalytics();
      expect(analytics.parts.length).toBe(0);

      panel.destroy();
    });
  });
});
