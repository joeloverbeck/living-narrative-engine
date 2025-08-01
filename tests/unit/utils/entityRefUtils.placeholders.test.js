// tests/unit/utils/entityRefUtils.placeholders.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validatePlaceholders,
  resolvePlaceholdersBatch,
  resolveEntityId,
  placeholderMetrics,
} from '../../../src/utils/entityRefUtils.js';
import { PlaceholderTestUtils } from '../../helpers/placeholderTestUtils.js';

describe('entityRefUtils - Placeholder Enhancements', () => {
  let mockEventPayload;

  beforeEach(() => {
    mockEventPayload = PlaceholderTestUtils.createMockEventPayload();
    // Reset metrics before each test
    placeholderMetrics.reset();
  });

  describe('validatePlaceholders', () => {
    it('should validate successful placeholder resolution', () => {
      const result = validatePlaceholders(
        ['primary', 'secondary'],
        mockEventPayload
      );

      PlaceholderTestUtils.assertValidationResult(result, {
        valid: true,
        resolved: ['primary', 'secondary'],
        missing: [],
        errorCount: 0,
      });
    });

    it('should detect missing placeholders', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        targets: {},
      });

      const result = validatePlaceholders(['primary'], eventPayload);

      PlaceholderTestUtils.assertValidationResult(result, {
        valid: false,
        resolved: [],
        missing: ['primary'],
        errorCount: 1,
      });

      expect(result.errors[0].errorType).toBe('PLACEHOLDER_NOT_RESOLVED');
    });

    it('should handle invalid placeholder names', () => {
      const result = validatePlaceholders(
        ['invalid_placeholder'],
        mockEventPayload
      );

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('invalid_placeholder');
      expect(result.errors[0].errorType).toBe('INVALID_PLACEHOLDER');
      expect(result.errors[0].validNames).toEqual([
        'primary',
        'secondary',
        'tertiary',
      ]);
    });

    it('should handle non-array input gracefully', () => {
      const result = validatePlaceholders('not-an-array', mockEventPayload);

      expect(result.valid).toBe(false);
      expect(result.errors[0].errorType).toBe('INVALID_INPUT');
      expect(result.errors[0].message).toBe('Placeholders must be an array');
    });

    it('should include available targets in validation result', () => {
      const result = validatePlaceholders(
        ['primary', 'secondary'],
        mockEventPayload
      );

      expect(result.available).toEqual(
        expect.arrayContaining(['primary', 'secondary'])
      );
    });

    it('should handle empty array of placeholders', () => {
      const result = validatePlaceholders([], mockEventPayload);

      expect(result.valid).toBe(true);
      expect(result.resolved).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should handle mixed valid and invalid placeholders', () => {
      const result = validatePlaceholders(
        ['primary', 'invalid', 'secondary'],
        mockEventPayload
      );

      expect(result.valid).toBe(false);
      expect(result.resolved).toEqual(['primary', 'secondary']);
      expect(result.missing).toEqual(['invalid']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errorType).toBe('INVALID_PLACEHOLDER');
    });

    it('should provide helpful error details for missing placeholders', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        secondaryId: 'exists',
        targets: {},
      });

      const result = validatePlaceholders(['primary'], eventPayload);

      expect(result.errors[0]).toMatchObject({
        placeholder: 'primary',
        errorType: 'PLACEHOLDER_NOT_RESOLVED',
        message: expect.stringContaining('could not be resolved'),
        available: expect.arrayContaining(['secondary']),
      });
    });
  });

  describe('resolvePlaceholdersBatch', () => {
    it('should resolve multiple placeholders efficiently', () => {
      const results = resolvePlaceholdersBatch(
        ['primary', 'secondary', 'tertiary'],
        mockEventPayload
      );

      expect(results.size).toBe(3);
      expect(results.get('primary')).toBe('test_primary_entity');
      expect(results.get('secondary')).toBe('test_secondary_entity');
      expect(results.get('tertiary')).toBeNull();
    });

    it('should handle invalid placeholders in batch', () => {
      const results = resolvePlaceholdersBatch(
        ['primary', 'invalid'],
        mockEventPayload
      );

      expect(results.get('primary')).toBe('test_primary_entity');
      expect(results.get('invalid')).toBeNull();
    });

    it('should return empty map for non-array input', () => {
      const results = resolvePlaceholdersBatch(
        'not-an-array',
        mockEventPayload
      );
      expect(results.size).toBe(0);
    });

    it('should handle empty array input', () => {
      const results = resolvePlaceholdersBatch([], mockEventPayload);
      expect(results.size).toBe(0);
    });

    it('should handle missing event payload', () => {
      const results = resolvePlaceholdersBatch(['primary', 'secondary'], null);

      expect(results.size).toBe(2);
      expect(results.get('primary')).toBeNull();
      expect(results.get('secondary')).toBeNull();
    });

    it('should resolve from targets object with string values', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        targets: {
          primary: 'string_id_123',
          secondary: 'string_id_456',
        },
      });

      const results = resolvePlaceholdersBatch(
        ['primary', 'secondary'],
        eventPayload
      );

      expect(results.get('primary')).toBe('string_id_123');
      expect(results.get('secondary')).toBe('string_id_456');
    });
  });

  describe('Enhanced Error Reporting', () => {
    it('should log detailed error with available targets', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      const result = resolveEntityId('primary', context);

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve placeholder'),
        expect.objectContaining({
          placeholder: 'primary',
          availableTargets: ['secondary'],
          suggestion: 'Available targets: secondary',
        })
      );
    });

    it('should suggest available targets when resolution fails', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        secondaryId: 'entity_2',
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      resolveEntityId('primary', context);

      expect(context.logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          availableTargets: ['secondary'],
          suggestion: 'Available targets: secondary',
        })
      );
    });

    it('should include event type and action ID in error context', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        type: 'core:custom_action',
        actionId: 'test:specific_action',
        primaryId: null,
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      resolveEntityId('primary', context);

      expect(context.logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventType: undefined,
          actionId: 'test:specific_action',
        })
      );
    });

    it('should handle multiple available targets in suggestion', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: 'id1',
        secondaryId: 'id2',
        tertiaryId: 'id3',
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      // Remove primary to test failure
      eventPayload.primaryId = null;

      resolveEntityId('primary', context);

      expect(context.logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          suggestion: expect.stringContaining('secondary, tertiary'),
        })
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should track successful resolutions', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload();
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      resolveEntityId('primary', context);
      resolveEntityId('secondary', context);

      const metrics = placeholderMetrics.getMetrics();
      expect(metrics.total).toBe(2);
      expect(metrics.success).toBe(2);
      expect(metrics.failure).toBe(0);
      expect(metrics.successRate).toBe(1);
    });

    it('should track failed resolutions', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      resolveEntityId('primary', context);

      const metrics = placeholderMetrics.getMetrics();
      expect(metrics.total).toBe(1);
      expect(metrics.success).toBe(0);
      expect(metrics.failure).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it('should track mixed success and failure', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: 'exists',
        secondaryId: null,
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      resolveEntityId('primary', context);
      resolveEntityId('secondary', context);

      const metrics = placeholderMetrics.getMetrics();
      expect(metrics.total).toBe(2);
      expect(metrics.success).toBe(1);
      expect(metrics.failure).toBe(1);
      expect(metrics.successRate).toBe(0.5);
    });

    it('should reset metrics correctly', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload();
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      // Add some metrics
      resolveEntityId('primary', context);
      resolveEntityId('secondary', context);

      // Reset
      placeholderMetrics.reset();

      const metrics = placeholderMetrics.getMetrics();
      expect(metrics.total).toBe(0);
      expect(metrics.success).toBe(0);
      expect(metrics.failure).toBe(0);
      expect(metrics.successRate).toBe(0);
    });

    it('should handle successRate when no resolutions attempted', () => {
      const metrics = placeholderMetrics.getMetrics();
      expect(metrics.successRate).toBe(0);
    });

    it('should track metrics for null event payload', () => {
      const context = PlaceholderTestUtils.createExecutionContext(null);
      context.evaluationContext.event = null;

      resolveEntityId('primary', context);

      const metrics = placeholderMetrics.getMetrics();
      expect(metrics.total).toBe(1);
      expect(metrics.failure).toBe(1);
    });
  });

  describe('Edge Cases and Comprehensive Coverage', () => {
    it('should handle whitespace in placeholder names', () => {
      const result = validatePlaceholders(
        ['  primary  ', 'secondary'],
        mockEventPayload
      );

      // Since we trim in resolveEntityId but not in validatePlaceholders,
      // '  primary  ' is not a valid placeholder name
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('  primary  ');
    });

    it('should handle null values in targets object', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        secondaryId: null,
        targets: {
          primary: null,
          secondary: { entityId: null },
        },
      });

      const result = validatePlaceholders(
        ['primary', 'secondary'],
        eventPayload
      );

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['primary', 'secondary']);
    });

    it('should handle undefined event payload gracefully', () => {
      const result = validatePlaceholders(['primary'], undefined);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['primary']);
      expect(result.available).toEqual([]);
    });

    it('should validate all three standard placeholders', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        tertiaryId: 'test_tertiary_entity',
      });

      const result = validatePlaceholders(
        ['primary', 'secondary', 'tertiary'],
        eventPayload
      );

      expect(result.valid).toBe(true);
      expect(result.resolved).toEqual(['primary', 'secondary', 'tertiary']);
    });
  });
});
