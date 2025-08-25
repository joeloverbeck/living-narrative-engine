/**
 * @file Performance tests for placeholder resolution using TargetManager getEntityIdByPlaceholder
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import TargetManager from '../../../src/entities/multiTarget/targetManager.js';
import { TargetExtractionResult } from '../../../src/entities/multiTarget/targetExtractionResult.js';

describe('Placeholder Resolution Integration Performance', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('TargetManager getEntityIdByPlaceholder Performance', () => {
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

      const primaryId =
        targetExtractionResult.getEntityIdByPlaceholder('primary');
      const secondaryId =
        targetExtractionResult.getEntityIdByPlaceholder('secondary');
      const tertiaryId =
        targetExtractionResult.getEntityIdByPlaceholder('tertiary');
      const invalidId =
        targetExtractionResult.getEntityIdByPlaceholder('invalid');

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
      expect(singleResult.getEntityIdByPlaceholder('primary')).toBe(
        'single_entity'
      );
      expect(singleResult.hasTarget('primary')).toBe(true);
      expect(singleResult.isMultiTarget()).toBe(false);
      expect(singleResult.getTargetCount()).toBe(1);
    });
  });
});
