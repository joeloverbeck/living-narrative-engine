/**
 * @file Integration tests for Damage Analytics accuracy
 * @description Validates hits-to-destroy calculations, probability distributions,
 * death condition detection, and aggregate statistics accuracy.
 * @see DamageAnalyticsPanel.js - Analytics panel component
 * @see HitProbabilityCalculator.js - Probability calculation service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import DamageAnalyticsPanel from '../../../src/domUI/damage-simulator/DamageAnalyticsPanel.js';
import HitProbabilityCalculator from '../../../src/domUI/damage-simulator/HitProbabilityCalculator.js';

import {
  createMockLogger,
  createMockDispatcher,
  createMockAnatomyData,
  createMockHitProbabilityWeightUtils,
  SAMPLE_DAMAGE_ENTRY,
  TEST_ENTITY_IDS,
} from '../../common/damage-simulator/damageSimulatorTestFixtures.js';

describe('Analytics Accuracy', () => {
  /** @type {Object} */
  let logger;
  /** @type {Object} */
  let dispatcher;
  /** @type {DamageAnalyticsPanel} */
  let analyticsPanel;
  /** @type {HitProbabilityCalculator} */
  let hitCalculator;
  /** @type {Object} */
  let anatomyData;
  /** @type {HTMLElement} */
  let container;
  /** @type {Object} */
  let hitProbabilityWeightUtils;

  beforeEach(() => {
    logger = createMockLogger();
    dispatcher = createMockDispatcher();
    anatomyData = createMockAnatomyData();
    hitProbabilityWeightUtils = createMockHitProbabilityWeightUtils();

    // Create DOM container
    container = document.createElement('div');
    container.id = 'analytics-container';
    document.body.appendChild(container);

    // Create HitProbabilityCalculator
    hitCalculator = new HitProbabilityCalculator({
      hitProbabilityWeightUtils,
      logger,
    });

    // Create DamageAnalyticsPanel
    analyticsPanel = new DamageAnalyticsPanel({
      containerElement: container,
      eventBus: dispatcher,
      logger,
    });
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (analyticsPanel && typeof analyticsPanel.destroy === 'function') {
      analyticsPanel.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Hits-to-Destroy Calculations', () => {
    it('should calculate hits-to-destroy within 10% accuracy for simple damage', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      const damageEntry = { amount: 10, name: 'slashing', penetration: 0 };
      analyticsPanel.updateDamageConfig(damageEntry);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert - Torso: 100 HP / 10 damage = 10 hits expected
      const torsoPart = analytics.parts.find(
        (p) => p.partId === TEST_ENTITY_IDS.torso
      );

      if (torsoPart) {
        const expectedHits = 10;
        const accuracy =
          Math.abs(torsoPart.hitsToDestroy - expectedHits) / expectedHits;
        expect(accuracy).toBeLessThanOrEqual(0.1); // Within 10%
      }
    });

    it('should calculate hits-to-destroy correctly for high damage', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      const damageEntry = { amount: 50, name: 'crushing', penetration: 0 };
      analyticsPanel.updateDamageConfig(damageEntry);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert - Head: 50 HP / 50 damage = 1 hit expected
      const headPart = analytics.parts.find(
        (p) => p.partId === TEST_ENTITY_IDS.head
      );

      if (headPart) {
        expect(headPart.hitsToDestroy).toBe(1);
      }
    });

    it('should handle edge case of 0 damage', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      const damageEntry = { amount: 0, name: 'slashing', penetration: 0 };
      analyticsPanel.updateDamageConfig(damageEntry);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert - should handle gracefully (infinite hits or special value)
      expect(analytics).toBeDefined();
      if (analytics.parts.length > 0) {
        const torsoPart = analytics.parts.find(
          (p) => p.partId === TEST_ENTITY_IDS.torso
        );
        if (torsoPart) {
          // 0 damage should result in very high or infinite hits
          expect(torsoPart.hitsToDestroy).toBeGreaterThanOrEqual(100);
        }
      }
    });

    it('should handle edge case of max health parts', () => {
      // Arrange - use anatomy data as-is (already at max health)
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      const damageEntry = { amount: 25, name: 'slashing', penetration: 0 };
      analyticsPanel.updateDamageConfig(damageEntry);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert - calculations should work on max health parts
      expect(analytics.parts.length).toBeGreaterThan(0);
      analytics.parts.forEach((part) => {
        expect(part.hitsToDestroy).toBeGreaterThan(0);
        expect(Number.isFinite(part.hitsToDestroy)).toBe(true);
      });
    });
  });

  describe('Hit Probability Distributions', () => {
    it('should sum hit probabilities to 100%', () => {
      // Arrange
      const parts = anatomyData.parts;

      // Act
      const probabilities = hitCalculator.calculateProbabilities(parts);

      // Assert
      const totalProbability = probabilities.reduce(
        (sum, p) => sum + p.probability,
        0
      );
      expect(totalProbability).toBeCloseTo(100, 0); // 100% ± 1%
    });

    it('should assign higher probability to parts with higher weights', () => {
      // Arrange
      const parts = anatomyData.parts;

      // Act
      const probabilities = hitCalculator.calculateProbabilities(parts);

      // Assert - Torso (weight 50) should have higher probability than arms (weight 10)
      const torsoProbability = probabilities.find(
        (p) => p.partId === TEST_ENTITY_IDS.torso
      );
      const armProbability = probabilities.find(
        (p) => p.partId === TEST_ENTITY_IDS.leftArm
      );

      if (torsoProbability && armProbability) {
        expect(torsoProbability.probability).toBeGreaterThan(
          armProbability.probability
        );
      }
    });

    it('should classify probability tiers correctly', () => {
      // Arrange
      const parts = anatomyData.parts;

      // Act
      const probabilities = hitCalculator.calculateProbabilities(parts);

      // Assert - each probability should have a valid tier
      probabilities.forEach((p) => {
        expect(['high', 'medium', 'low', 'none']).toContain(p.tier);
      });
    });

    it('should handle empty parts array', () => {
      // Arrange
      const emptyParts = [];

      // Act
      const probabilities = hitCalculator.calculateProbabilities(emptyParts);

      // Assert
      expect(probabilities).toEqual([]);
    });

    it('should provide visualization data', () => {
      // Arrange
      const parts = anatomyData.parts;
      const probabilities = hitCalculator.calculateProbabilities(parts);

      // Act
      const vizData = hitCalculator.getVisualizationData(probabilities);

      // Assert
      expect(vizData.bars).toBeDefined();
      expect(vizData.maxProbability).toBeGreaterThan(0);
      expect(vizData.totalParts).toBe(parts.length);
    });
  });

  describe('Death Condition Monitoring', () => {
    it('should correctly identify critical parts', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      analyticsPanel.updateDamageConfig(SAMPLE_DAMAGE_ENTRY);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert - head and torso are typically critical
      const criticalParts = analytics.parts.filter((p) => p.isCritical);
      const headPart = analytics.parts.find(
        (p) => p.partName.toLowerCase().includes('head')
      );
      const torsoPart = analytics.parts.find(
        (p) => p.partName.toLowerCase().includes('torso')
      );

      // At least head or torso should be marked critical
      if (headPart || torsoPart) {
        expect(
          (headPart && headPart.isCritical) || (torsoPart && torsoPart.isCritical)
        ).toBe(true);
      }
    });

    it('should provide effect thresholds', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      analyticsPanel.updateDamageConfig(SAMPLE_DAMAGE_ENTRY);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert
      expect(analytics.effectThresholds).toBeDefined();
      expect(Array.isArray(analytics.effectThresholds)).toBe(true);
      analytics.effectThresholds.forEach((threshold) => {
        expect(threshold.effectType).toBeDefined();
        expect(threshold.threshold).toBeDefined();
        expect(typeof threshold.threshold).toBe('number');
      });
    });
  });

  describe('Real-Time Analytics Updates', () => {
    it('should update analytics when damage config changes', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);

      // Act - first config
      analyticsPanel.updateDamageConfig({
        amount: 10,
        name: 'slashing',
        penetration: 0,
      });
      const analytics1 = analyticsPanel.getAnalytics();

      // Act - second config with higher damage
      analyticsPanel.updateDamageConfig({
        amount: 50,
        name: 'crushing',
        penetration: 0,
      });
      const analytics2 = analyticsPanel.getAnalytics();

      // Assert - higher damage should result in fewer hits to destroy
      const part1 = analytics1.parts.find((p) => p.partId === TEST_ENTITY_IDS.torso);
      const part2 = analytics2.parts.find((p) => p.partId === TEST_ENTITY_IDS.torso);

      if (part1 && part2) {
        expect(part2.hitsToDestroy).toBeLessThan(part1.hitsToDestroy);
      }
    });

    it('should update analytics when entity changes', () => {
      // Arrange - first entity
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      analyticsPanel.updateDamageConfig(SAMPLE_DAMAGE_ENTRY);
      const analytics1 = analyticsPanel.getAnalytics();

      // Act - change to different anatomy
      const newAnatomyData = {
        parts: [
          {
            id: 'new-part-1',
            name: 'New Part',
            currentHealth: 200,
            maxHealth: 200,
            weight: 100,
            component: { subType: 'body', hit_probability_weight: 100 },
          },
        ],
      };
      analyticsPanel.setEntity('new-entity-1', newAnatomyData);
      const analytics2 = analyticsPanel.getAnalytics();

      // Assert - analytics should reflect new entity
      expect(analytics2.parts.length).toBe(1);
      expect(analytics2.parts[0].maxHealth).toBe(200);
    });
  });

  describe('Aggregate Statistics', () => {
    it('should calculate aggregate statistics correctly', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      analyticsPanel.updateDamageConfig(SAMPLE_DAMAGE_ENTRY);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert
      expect(analytics.aggregate).toBeDefined();
      expect(analytics.aggregate.totalParts).toBe(anatomyData.parts.length);
      expect(analytics.aggregate.averageHits).toBeGreaterThan(0);
      expect(analytics.aggregate.minHits).toBeLessThanOrEqual(
        analytics.aggregate.maxHits
      );
    });

    it('should correctly calculate min and max hits', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      analyticsPanel.updateDamageConfig(SAMPLE_DAMAGE_ENTRY);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert - min should be the smallest, max should be the largest
      const hits = analytics.parts.map((p) => p.hitsToDestroy);
      if (hits.length > 0) {
        expect(analytics.aggregate.minHits).toBe(Math.min(...hits));
        expect(analytics.aggregate.maxHits).toBe(Math.max(...hits));
      }
    });

    it('should calculate average hits correctly', () => {
      // Arrange
      analyticsPanel.setEntity(TEST_ENTITY_IDS.actor, anatomyData);
      analyticsPanel.updateDamageConfig(SAMPLE_DAMAGE_ENTRY);

      // Act
      const analytics = analyticsPanel.getAnalytics();

      // Assert - average should be between min and max
      expect(analytics.aggregate.averageHits).toBeGreaterThanOrEqual(
        analytics.aggregate.minHits
      );
      expect(analytics.aggregate.averageHits).toBeLessThanOrEqual(
        analytics.aggregate.maxHits
      );
    });
  });

  describe('High Probability Parts', () => {
    it('should identify high probability parts', () => {
      // Arrange
      const parts = anatomyData.parts;
      const probabilities = hitCalculator.calculateProbabilities(parts);

      // Act
      const highProbParts = hitCalculator.getHighProbabilityParts(
        probabilities,
        20
      ); // threshold 20%

      // Assert - torso (50 weight) should be high probability
      expect(highProbParts.length).toBeGreaterThan(0);
      expect(highProbParts.some((p) => p.partId === TEST_ENTITY_IDS.torso)).toBe(
        true
      );
    });

    it('should calculate cumulative probability', () => {
      // Arrange
      const parts = anatomyData.parts;
      const probabilities = hitCalculator.calculateProbabilities(parts);
      const partIds = [TEST_ENTITY_IDS.torso, TEST_ENTITY_IDS.head];

      // Act
      const cumulative = hitCalculator.getCumulativeProbability(
        probabilities,
        partIds
      );

      // Assert
      expect(cumulative).toBeGreaterThan(0);
      expect(cumulative).toBeLessThanOrEqual(100);
    });
  });
});
