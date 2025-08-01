/**
 * @file Tests for TargetExtractionResult class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import TargetManager from '../../../../src/entities/multiTarget/targetManager.js';
import TargetExtractionResult from '../../../../src/entities/multiTarget/targetExtractionResult.js';

describe('TargetExtractionResult', () => {
  let testBed;
  let logger;
  let targetManager;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
    targetManager = new TargetManager({
      targets: { item: 'knife_123', target: 'goblin_456' },
      logger,
    });
  });

  describe('Construction', () => {
    it('should create with target manager', () => {
      const result = new TargetExtractionResult({ targetManager });

      expect(result.getTargetManager()).toBe(targetManager);
      expect(result.hasMultipleTargets()).toBe(true);
      expect(result.getTargetCount()).toBe(2);
    });

    it('should create with extraction metadata', () => {
      const metadata = { source: 'test', extractionTime: Date.now() };
      const result = new TargetExtractionResult({
        targetManager,
        extractionMetadata: metadata,
      });

      expect(result.getExtractionMetadata()).toEqual(metadata);
    });

    it('should create with validation result', () => {
      const validationResult = { isValid: true, errors: [], warnings: [] };
      const result = new TargetExtractionResult({
        targetManager,
        validationResult,
      });

      expect(result.getValidationResult()).toEqual(validationResult);
      expect(result.isValid()).toBe(true);
    });

    it('should throw error for missing target manager', () => {
      expect(() => {
        new TargetExtractionResult({});
      }).toThrow('TargetManager is required');
    });

    it('should throw error for invalid target manager', () => {
      expect(() => {
        new TargetExtractionResult({ targetManager: {} });
      }).toThrow('targetManager must be a TargetManager instance');
    });

    it('should auto-validate target manager if no validation result provided', () => {
      const result = new TargetExtractionResult({ targetManager });

      expect(result.isValid()).toBe(true); // Valid targets
    });
  });

  describe('Target Access', () => {
    let result;

    beforeEach(() => {
      result = new TargetExtractionResult({ targetManager });
    });

    it('should get targets object', () => {
      expect(result.getTargets()).toEqual({
        item: 'knife_123',
        target: 'goblin_456',
      });
    });

    it('should get primary target', () => {
      expect(result.getPrimaryTarget()).toBe('goblin_456'); // 'target' has priority
    });

    it('should check multiple targets', () => {
      expect(result.hasMultipleTargets()).toBe(true);
    });

    it('should get target count', () => {
      expect(result.getTargetCount()).toBe(2);
    });

    it('should get specific target', () => {
      expect(result.getTarget('item')).toBe('knife_123');
      expect(result.getTarget('nonexistent')).toBe(null);
    });

    it('should get target names', () => {
      expect(result.getTargetNames()).toEqual(['item', 'target']);
    });

    it('should get entity IDs', () => {
      expect(result.getEntityIds()).toEqual(['knife_123', 'goblin_456']);
    });
  });

  describe('Metadata Management', () => {
    let result;

    beforeEach(() => {
      result = new TargetExtractionResult({
        targetManager,
        extractionMetadata: { source: 'test' },
      });
    });

    it('should add metadata', () => {
      result.addMetadata('extractionTime', 12345);

      expect(result.getMetadata('extractionTime')).toBe(12345);
    });

    it('should get existing metadata', () => {
      expect(result.getMetadata('source')).toBe('test');
    });

    it('should return undefined for missing metadata', () => {
      expect(result.getMetadata('nonexistent')).toBe(undefined);
    });

    it('should get all metadata', () => {
      result.addMetadata('extractionTime', 12345);

      expect(result.getExtractionMetadata()).toEqual({
        source: 'test',
        extractionTime: 12345,
      });
    });
  });

  describe('Validation', () => {
    it('should get validation errors', () => {
      const validationResult = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: [],
      };
      const result = new TargetExtractionResult({
        targetManager,
        validationResult,
      });

      expect(result.getErrors()).toEqual(['Error 1', 'Error 2']);
      expect(result.isValid()).toBe(false);
    });

    it('should get validation warnings', () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: ['Warning 1', 'Warning 2'],
      };
      const result = new TargetExtractionResult({
        targetManager,
        validationResult,
      });

      expect(result.getWarnings()).toEqual(['Warning 1', 'Warning 2']);
    });

    it('should handle missing errors/warnings arrays', () => {
      const validationResult = { isValid: true };
      const result = new TargetExtractionResult({
        targetManager,
        validationResult,
      });

      expect(result.getErrors()).toEqual([]);
      expect(result.getWarnings()).toEqual([]);
    });
  });

  describe('Legacy Format Conversion', () => {
    it('should convert to legacy format', () => {
      const result = new TargetExtractionResult({ targetManager });

      const legacy = result.toLegacyFormat();

      expect(legacy).toEqual({
        hasMultipleTargets: true,
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'goblin_456',
        targetId: 'goblin_456',
      });
    });

    it('should handle single target in legacy format', () => {
      const singleTargetManager = new TargetManager({
        targets: { item: 'knife_123' },
        logger,
      });
      const result = new TargetExtractionResult({
        targetManager: singleTargetManager,
      });

      const legacy = result.toLegacyFormat();

      expect(legacy.hasMultipleTargets).toBe(false);
      expect(legacy.targetId).toBe('knife_123');
    });
  });

  describe('JSON Serialization', () => {
    it('should convert to JSON', () => {
      const result = new TargetExtractionResult({
        targetManager,
        extractionMetadata: { source: 'test' },
      });

      const json = result.toJSON();

      expect(json).toMatchObject({
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'goblin_456',
        hasMultipleTargets: true,
        targetCount: 2,
        extractionMetadata: { source: 'test' },
        validationResult: expect.any(Object),
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Summary Creation', () => {
    it('should create summary', () => {
      const result = new TargetExtractionResult({
        targetManager,
        extractionMetadata: { source: 'test_source' },
      });

      const summary = result.createSummary();

      expect(summary).toEqual({
        targetCount: 2,
        hasMultipleTargets: true,
        primaryTarget: 'goblin_456',
        targetNames: ['item', 'target'],
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        extractionSource: 'test_source',
      });
    });

    it('should handle unknown source in summary', () => {
      const result = new TargetExtractionResult({ targetManager });

      const summary = result.createSummary();

      expect(summary.extractionSource).toBe('unknown');
    });
  });

  describe('Static Factory Methods', () => {
    describe('fromLegacyData', () => {
      it('should create from legacy single target', () => {
        const legacyData = { targetId: 'goblin_123' };

        const result = TargetExtractionResult.fromLegacyData(
          legacyData,
          logger
        );

        expect(result.getPrimaryTarget()).toBe('goblin_123');
        expect(result.hasMultipleTargets()).toBe(false);
        expect(result.getMetadata('source')).toBe('legacy_conversion');
      });

      it('should create from legacy targets object', () => {
        const legacyData = {
          targets: { item: 'knife_123', target: 'goblin_456' },
          targetId: 'goblin_456',
        };

        const result = TargetExtractionResult.fromLegacyData(
          legacyData,
          logger
        );

        expect(result.getTargets()).toEqual(legacyData.targets);
        expect(result.hasMultipleTargets()).toBe(true);
      });

      it('should prioritize targets object over targetId', () => {
        const legacyData = {
          targetId: 'old_target',
          targets: { primary: 'new_target' },
        };

        const result = TargetExtractionResult.fromLegacyData(
          legacyData,
          logger
        );

        expect(result.getPrimaryTarget()).toBe('new_target');
      });
    });

    describe('fromResolvedParameters', () => {
      it('should create from multi-target resolved parameters', () => {
        const resolvedParameters = {
          isMultiTarget: true,
          targetIds: {
            item: ['knife_123'],
            target: ['goblin_456'],
          },
        };

        const result = TargetExtractionResult.fromResolvedParameters(
          resolvedParameters,
          logger
        );

        expect(result.hasMultipleTargets()).toBe(true);
        expect(result.getTarget('item')).toBe('knife_123');
        expect(result.getTarget('target')).toBe('goblin_456');
        expect(result.getMetadata('source')).toBe('resolved_parameters');
        expect(result.getMetadata('isMultiTarget')).toBe(true);
      });

      it('should create from single target resolved parameters', () => {
        const resolvedParameters = {
          targetId: 'goblin_123',
        };

        const result = TargetExtractionResult.fromResolvedParameters(
          resolvedParameters,
          logger
        );

        expect(result.getPrimaryTarget()).toBe('goblin_123');
        expect(result.hasMultipleTargets()).toBe(false);
        expect(result.getMetadata('isMultiTarget')).toBe(false);
      });

      it('should handle string targetIds in resolved parameters', () => {
        const resolvedParameters = {
          isMultiTarget: true,
          targetIds: {
            item: 'knife_123',
            target: 'goblin_456',
          },
        };

        const result = TargetExtractionResult.fromResolvedParameters(
          resolvedParameters,
          logger
        );

        expect(result.getTarget('item')).toBe('knife_123');
        expect(result.getTarget('target')).toBe('goblin_456');
      });

      it('should handle empty targetIds arrays', () => {
        const resolvedParameters = {
          isMultiTarget: true,
          targetIds: {
            item: [],
            target: ['goblin_456'],
          },
        };

        const result = TargetExtractionResult.fromResolvedParameters(
          resolvedParameters,
          logger
        );

        expect(result.getTarget('item')).toBe(null);
        expect(result.getTarget('target')).toBe('goblin_456');
      });
    });

    describe('createEmpty', () => {
      it('should create empty result', () => {
        const result = TargetExtractionResult.createEmpty(logger);

        expect(result.getTargetCount()).toBe(0);
        expect(result.hasMultipleTargets()).toBe(false);
        expect(result.getPrimaryTarget()).toBe(null);
        expect(result.getMetadata('source')).toBe('empty');
        expect(result.getMetadata('reason')).toBe('no_targets_required');
      });

      it('should mark empty result as invalid', () => {
        const result = TargetExtractionResult.createEmpty(logger);

        expect(result.isValid()).toBe(false);
        expect(result.getErrors()).toContain('No targets defined');
      });
    });
  });

  describe('TargetManager Delegation Methods', () => {
    let result;

    beforeEach(() => {
      const multiTargetManager = new TargetManager({
        targets: {
          primary: 'entity_123',
          secondary: 'entity_456',
          tertiary: 'entity_789',
        },
        logger,
      });
      result = new TargetExtractionResult({
        targetManager: multiTargetManager,
      });
    });

    describe('getEntityIdByPlaceholder', () => {
      it('should expose TargetManager getEntityIdByPlaceholder method', () => {
        const entityId = result.getEntityIdByPlaceholder('primary');

        expect(entityId).toBe('entity_123');
      });

      it('should return entity ID for valid placeholders', () => {
        expect(result.getEntityIdByPlaceholder('primary')).toBe('entity_123');
        expect(result.getEntityIdByPlaceholder('secondary')).toBe('entity_456');
        expect(result.getEntityIdByPlaceholder('tertiary')).toBe('entity_789');
      });

      it('should return null for invalid placeholder names', () => {
        const entityId = result.getEntityIdByPlaceholder('invalid');

        expect(entityId).toBeNull();
      });

      it('should handle case-sensitive placeholder names', () => {
        const entityId = result.getEntityIdByPlaceholder('Primary');

        expect(entityId).toBeNull(); // Case sensitive
      });

      it('should work with all standard placeholder names', () => {
        const placeholders = ['primary', 'secondary', 'tertiary'];

        placeholders.forEach((placeholder) => {
          if (result.hasTarget(placeholder)) {
            const entityId = result.getEntityIdByPlaceholder(placeholder);
            expect(entityId).toBeTruthy();
            expect(typeof entityId).toBe('string');
          }
        });
      });

      it('should throw error for empty placeholder name', () => {
        expect(() => {
          result.getEntityIdByPlaceholder('');
        }).toThrow();
      });

      it('should throw error for null/undefined placeholder name', () => {
        expect(() => {
          result.getEntityIdByPlaceholder(null);
        }).toThrow();

        expect(() => {
          result.getEntityIdByPlaceholder(undefined);
        }).toThrow();
      });
    });

    describe('hasTarget', () => {
      it('should expose TargetManager hasTarget method', () => {
        expect(result.hasTarget('primary')).toBe(true);
        expect(result.hasTarget('secondary')).toBe(true);
        expect(result.hasTarget('tertiary')).toBe(true);
      });

      it('should return false for invalid target names', () => {
        expect(result.hasTarget('invalid')).toBe(false);
        expect(result.hasTarget('nonexistent')).toBe(false);
      });

      it('should handle case-sensitive target names', () => {
        expect(result.hasTarget('Primary')).toBe(false); // Case sensitive
      });

      it('should handle empty and null names gracefully', () => {
        // hasTarget doesn't validate input, just checks Map.has()
        expect(result.hasTarget('')).toBe(false);
        expect(result.hasTarget(null)).toBe(false);
        expect(result.hasTarget(undefined)).toBe(false);
      });
    });

    describe('isMultiTarget', () => {
      it('should expose TargetManager isMultiTarget method', () => {
        expect(result.isMultiTarget()).toBe(true);
      });

      it('should return false for single target scenarios', () => {
        const singleTargetManager = new TargetManager({
          targets: { primary: 'entity_123' },
          logger,
        });
        const singleResult = new TargetExtractionResult({
          targetManager: singleTargetManager,
        });

        expect(singleResult.isMultiTarget()).toBe(false);
      });

      it('should return false for empty target scenarios', () => {
        const emptyTargetManager = new TargetManager({ logger });
        const emptyResult = new TargetExtractionResult({
          targetManager: emptyTargetManager,
        });

        expect(emptyResult.isMultiTarget()).toBe(false);
      });
    });

    describe('Integration with existing methods', () => {
      it('should work consistently with hasMultipleTargets', () => {
        expect(result.isMultiTarget()).toBe(result.hasMultipleTargets());
      });

      it('should work consistently with getTarget', () => {
        const placeholders = ['primary', 'secondary', 'tertiary'];

        placeholders.forEach((placeholder) => {
          const entityIdFromPlaceholder =
            result.getEntityIdByPlaceholder(placeholder);
          const entityIdFromGetTarget = result.getTarget(placeholder);

          expect(entityIdFromPlaceholder).toBe(entityIdFromGetTarget);
        });
      });

      it('should validate placeholder existence before resolution', () => {
        const placeholder = 'primary';

        if (result.hasTarget(placeholder)) {
          const entityId = result.getEntityIdByPlaceholder(placeholder);
          expect(entityId).toBeTruthy();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null primary target', () => {
      const emptyTargetManager = new TargetManager({ logger });
      const result = new TargetExtractionResult({
        targetManager: emptyTargetManager,
      });

      expect(result.getPrimaryTarget()).toBe(null);
    });

    it('should handle metadata immutability', () => {
      const originalMetadata = { source: 'test' };
      const result = new TargetExtractionResult({
        targetManager,
        extractionMetadata: originalMetadata,
      });

      const retrievedMetadata = result.getExtractionMetadata();
      retrievedMetadata.source = 'modified';

      expect(result.getMetadata('source')).toBe('test');
    });

    it('should handle validation result immutability', () => {
      const validationResult = { isValid: true, errors: [], warnings: [] };
      const result = new TargetExtractionResult({
        targetManager,
        validationResult,
      });

      const retrieved = result.getValidationResult();
      retrieved.isValid = false;

      expect(result.isValid()).toBe(true);
    });
  });
});
