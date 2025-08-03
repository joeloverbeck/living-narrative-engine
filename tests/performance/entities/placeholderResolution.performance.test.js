/**
 * @file Performance tests for placeholder resolution using TargetManager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import TargetManager from '../../../src/entities/multiTarget/targetManager.js';
import { TargetExtractionResult } from '../../../src/entities/multiTarget/targetExtractionResult.js';

describe('Placeholder Resolution Performance', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Performance Comparison', () => {
    it('should demonstrate O(1) vs O(n) performance improvement', () => {
      // Arrange: Create large target set for performance testing
      const largeTargets = {};
      for (let i = 0; i < 1000; i++) {
        largeTargets[`target_${i}`] = `entity_${i}`;
      }

      const targetManager = new TargetManager({
        targets: largeTargets,
        logger,
      });

      const targetExtractionResult = new TargetExtractionResult({
        targetManager,
        extractionMetadata: { source: 'performance_test' },
      });

      // Simulate old O(n) approach
      const oldApproach = (placeholderName, targets) => {
        for (const [key, entityId] of Object.entries(targets)) {
          if (key === placeholderName) {
            return entityId;
          }
        }
        return null;
      };

      const iterations = 10000;

      // Act: Measure O(n) performance
      const oldStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        oldApproach('target_500', largeTargets); // Middle of the list
      }
      const oldEnd = performance.now();
      const oldTime = oldEnd - oldStart;

      // Act: Measure O(1) performance
      const newStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        targetExtractionResult.getEntityIdByPlaceholder('target_500');
      }
      const newEnd = performance.now();
      const newTime = newEnd - newStart;

      // Assert: New approach should be significantly faster
      expect(newTime).toBeLessThan(oldTime);

      // Log performance improvement for visibility
      const improvementRatio = oldTime / newTime;
      logger.info(
        `Performance improvement: ${improvementRatio.toFixed(2)}x faster`
      );
      logger.info(
        `Old approach: ${oldTime.toFixed(3)}ms, New approach: ${newTime.toFixed(3)}ms`
      );

      // Should be at least 2x faster for large datasets
      expect(improvementRatio).toBeGreaterThanOrEqual(2);
    });
  });
});
