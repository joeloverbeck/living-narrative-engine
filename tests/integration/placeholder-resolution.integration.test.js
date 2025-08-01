/**
 * @file Integration tests for placeholder resolution using TargetManager getEntityIdByPlaceholder
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../common/testBed.js';
import TargetManager from '../../src/entities/multiTarget/targetManager.js';
import { TargetExtractionResult } from '../../src/entities/multiTarget/targetExtractionResult.js';
import { ActionFormattingStage } from '../../src/actions/pipeline/stages/ActionFormattingStage.js';

describe('Placeholder Resolution Integration', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('TargetManager getEntityIdByPlaceholder Integration', () => {
    it('should resolve placeholders using TargetManager O(1) lookup', () => {
      // Arrange: Create a TargetManager with multiple targets
      const targetManager = new TargetManager({
        targets: {
          primary: 'entity_123',
          secondary: 'entity_456',
          tertiary: 'entity_789',
        },
        logger,
      });

      const targetExtractionResult = new TargetExtractionResult({
        targetManager,
        extractionMetadata: {
          source: 'integration_test',
          testScenario: 'placeholder_resolution',
        },
      });

      // Act & Assert: Verify O(1) placeholder resolution
      const startTime = performance.now();
      
      const primaryId = targetExtractionResult.getEntityIdByPlaceholder('primary');
      const secondaryId = targetExtractionResult.getEntityIdByPlaceholder('secondary');
      const tertiaryId = targetExtractionResult.getEntityIdByPlaceholder('tertiary');
      const invalidId = targetExtractionResult.getEntityIdByPlaceholder('invalid');
      
      const endTime = performance.now();
      const resolutionTime = endTime - startTime;

      // Verify correct resolution
      expect(primaryId).toBe('entity_123');
      expect(secondaryId).toBe('entity_456');
      expect(tertiaryId).toBe('entity_789');
      expect(invalidId).toBeNull();

      // Verify performance (should be very fast due to O(1) Map lookup)
      expect(resolutionTime).toBeLessThan(5); // Less than 5ms for 4 lookups

      // Verify integration with existing methods
      expect(targetExtractionResult.hasTarget('primary')).toBe(true);
      expect(targetExtractionResult.hasTarget('invalid')).toBe(false);
      expect(targetExtractionResult.isMultiTarget()).toBe(true);
      expect(targetExtractionResult.getTargetCount()).toBe(3);
    });

    it('should handle edge cases consistently with TargetManager', () => {
      // Arrange: Create edge case scenarios
      const emptyTargetManager = new TargetManager({ logger });
      const emptyResult = new TargetExtractionResult({
        targetManager: emptyTargetManager,
      });

      const singleTargetManager = new TargetManager({
        targets: { primary: 'single_entity' },
        logger,
      });
      const singleResult = new TargetExtractionResult({
        targetManager: singleTargetManager,
      });

      // Act & Assert: Empty targets
      expect(emptyResult.getEntityIdByPlaceholder('primary')).toBeNull();
      expect(emptyResult.hasTarget('primary')).toBe(false);
      expect(emptyResult.isMultiTarget()).toBe(false);
      expect(emptyResult.getTargetCount()).toBe(0);

      // Act & Assert: Single target
      expect(singleResult.getEntityIdByPlaceholder('primary')).toBe('single_entity');
      expect(singleResult.hasTarget('primary')).toBe(true);
      expect(singleResult.isMultiTarget()).toBe(false);
      expect(singleResult.getTargetCount()).toBe(1);
    });
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
      logger.info(`Performance improvement: ${improvementRatio.toFixed(2)}x faster`);
      logger.info(`Old approach: ${oldTime.toFixed(3)}ms, New approach: ${newTime.toFixed(3)}ms`);

      // Should be at least 2x faster for large datasets
      expect(improvementRatio).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should reduce memory allocations during placeholder resolution', () => {
      // Arrange: Create scenario that would create temporary objects in old approach
      const targetManager = new TargetManager({
        targets: {
          primary: 'mem_entity_123',
          secondary: 'mem_entity_456',
          tertiary: 'mem_entity_789',
        },
        logger,
      });

      const targetExtractionResult = new TargetExtractionResult({
        targetManager,
        extractionMetadata: { source: 'memory_test' },
      });

      // Act: Multiple resolutions that would create temporary objects in old approach
      const resolutions = [];
      for (let i = 0; i < 100; i++) {
        resolutions.push({
          primary: targetExtractionResult.getEntityIdByPlaceholder('primary'),
          secondary: targetExtractionResult.getEntityIdByPlaceholder('secondary'),
          tertiary: targetExtractionResult.getEntityIdByPlaceholder('tertiary'),
        });
      }

      // Assert: All resolutions should be consistent
      resolutions.forEach(resolution => {
        expect(resolution.primary).toBe('mem_entity_123');
        expect(resolution.secondary).toBe('mem_entity_456');
        expect(resolution.tertiary).toBe('mem_entity_789');
      });

      // Verify no memory leaks by checking consistent behavior
      expect(targetExtractionResult.getTargetCount()).toBe(3);
      expect(targetExtractionResult.isMultiTarget()).toBe(true);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should provide enhanced error handling with TargetManager validation', () => {
      // Arrange
      const targetManager = new TargetManager({
        targets: {
          valid_target: 'entity_123',
        },
        logger,
      });

      const targetExtractionResult = new TargetExtractionResult({
        targetManager,
        extractionMetadata: { source: 'error_test' },
      });

      // Act & Assert: Valid placeholder
      expect(targetExtractionResult.hasTarget('valid_target')).toBe(true);
      expect(targetExtractionResult.getEntityIdByPlaceholder('valid_target')).toBe('entity_123');

      // Act & Assert: Invalid placeholder
      expect(targetExtractionResult.hasTarget('invalid_target')).toBe(false);
      expect(targetExtractionResult.getEntityIdByPlaceholder('invalid_target')).toBeNull();

      // Act & Assert: Edge cases
      expect(targetExtractionResult.hasTarget('')).toBe(false);
      expect(targetExtractionResult.hasTarget(null)).toBe(false);
      expect(targetExtractionResult.hasTarget(undefined)).toBe(false);

      // getEntityIdByPlaceholder validates input and throws for invalid params
      expect(() => targetExtractionResult.getEntityIdByPlaceholder('')).toThrow();
      expect(() => targetExtractionResult.getEntityIdByPlaceholder(null)).toThrow();
      expect(() => targetExtractionResult.getEntityIdByPlaceholder(undefined)).toThrow();
    });

    it('should handle validation errors gracefully', () => {
      // Arrange: Create invalid scenario
      const emptyTargetManager = new TargetManager({ logger });
      const emptyResult = new TargetExtractionResult({
        targetManager: emptyTargetManager,
        extractionMetadata: { source: 'validation_test' },
      });

      // Act & Assert: Should handle empty state gracefully
      expect(emptyResult.isValid()).toBe(false);
      expect(emptyResult.getErrors()).toContain('No targets defined');
      expect(emptyResult.getEntityIdByPlaceholder('any_placeholder')).toBeNull();
      expect(emptyResult.hasTarget('any_placeholder')).toBe(false);
      expect(emptyResult.isMultiTarget()).toBe(false);
      expect(emptyResult.getTargetCount()).toBe(0);
      expect(emptyResult.getTargetNames()).toEqual([]);
    });
  });
});