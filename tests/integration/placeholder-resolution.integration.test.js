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
      expect(
        targetExtractionResult.getEntityIdByPlaceholder('valid_target')
      ).toBe('entity_123');

      // Act & Assert: Invalid placeholder
      expect(targetExtractionResult.hasTarget('invalid_target')).toBe(false);
      expect(
        targetExtractionResult.getEntityIdByPlaceholder('invalid_target')
      ).toBeNull();

      // Act & Assert: Edge cases
      expect(targetExtractionResult.hasTarget('')).toBe(false);
      expect(targetExtractionResult.hasTarget(null)).toBe(false);
      expect(targetExtractionResult.hasTarget(undefined)).toBe(false);

      // getEntityIdByPlaceholder validates input and throws for invalid params
      expect(() =>
        targetExtractionResult.getEntityIdByPlaceholder('')
      ).toThrow();
      expect(() =>
        targetExtractionResult.getEntityIdByPlaceholder(null)
      ).toThrow();
      expect(() =>
        targetExtractionResult.getEntityIdByPlaceholder(undefined)
      ).toThrow();
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
      expect(
        emptyResult.getEntityIdByPlaceholder('any_placeholder')
      ).toBeNull();
      expect(emptyResult.hasTarget('any_placeholder')).toBe(false);
      expect(emptyResult.isMultiTarget()).toBe(false);
      expect(emptyResult.getTargetCount()).toBe(0);
      expect(emptyResult.getTargetNames()).toEqual([]);
    });
  });
});
