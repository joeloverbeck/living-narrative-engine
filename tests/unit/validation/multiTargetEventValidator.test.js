/**
 * @file Tests for multi-target event validator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/entities/testBed.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import MultiTargetEventValidator from '../../../src/validation/multiTargetEventValidator.js';

describe('MultiTargetEventValidator', () => {
  let testBed;
  let validator;
  let logger;

  beforeEach(() => {
    testBed = new TestBedClass();
    logger = createMockLogger();
    validator = new MultiTargetEventValidator({ logger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Basic Validation', () => {
    it('should validate correct legacy events', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(false);
    });

    it('should validate correct multi-target events', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'knife_123',
          target: 'goblin_456',
        },
        targetId: 'knife_123',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(true);
      expect(result.details.targetCount).toBe(2);
    });

    it('should reject events with empty targets object', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {},
        targetId: 'target_456',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targets object cannot be empty');
    });
  });

  describe('Target Consistency Validation', () => {
    it('should require target values to be non-empty strings', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: '   ',
          target: 'valid_target',
        },
        targetId: 'valid_target',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Target "item" must have a non-empty string value'
      );
    });

    it('should warn when a target uses an invalid entity id format', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'invalid id!',
        },
        targetId: 'invalid id!',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.warnings).toContain(
        'Target "item" ID "invalid id!" should follow entity ID format (letters, numbers, underscore, colon)'
      );
    });

    it('should warn when targetId does not match any target', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'knife_123',
          target: 'goblin_456',
        },
        targetId: 'different_id',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'targetId "different_id" does not match any target in targets object'
      );
      expect(result.details.consistencyIssues).toContain('targetId_mismatch');
    });

    it('should warn about duplicate targets', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'same_id',
          target: 'same_id',
        },
        targetId: 'same_id',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'targets object contains duplicate target IDs'
      );
      expect(result.details.consistencyIssues).toContain('duplicate_targets');
    });

    it('should determine primary target correctly', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          primary: 'primary_target',
          secondary: 'secondary_target',
        },
        targetId: 'primary_target',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.details.primaryTarget).toBe('primary_target');
    });

    it('should fallback to first target when no primary', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'item_id',
          recipient: 'recipient_id',
        },
        targetId: 'recipient_id',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      // The primary target should be 'recipient_id' since 'recipient' comes before 'item' in the priority list
      expect(result.details.primaryTarget).toBe('recipient_id');
    });
  });

  describe('Business Rule Validation', () => {
    it('should warn about excessive target count', () => {
      const targets = {};
      for (let i = 1; i <= 12; i++) {
        targets[`target${i}`] = `id_${i}`;
      }

      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets,
        targetId: 'id_1',
        originalInput: 'test action',
      };
      const result = validator.validateEvent(event);

      expect(result.warnings).toContain(
        'Event has 12 targets - consider if this is necessary for performance'
      );
    });

    it('should warn when actor and primary target are the same', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          primary: 'actor_123',
        },
        targetId: 'actor_123',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.warnings).toContain(
        'Actor and primary target are the same entity - verify this is intentional'
      );
    });

    it('should validate target key naming patterns', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          'invalid-key': 'target_1',
          '123numeric': 'target_2',
        },
        targetId: 'target_1',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.warnings).toContain(
        'Target key "invalid-key" should follow naming conventions (alphanumeric with underscores)'
      );
      expect(result.warnings).toContain(
        'Target key "123numeric" should follow naming conventions (alphanumeric with underscores)'
      );
    });

    it('should warn when primary and target entries refer to the same entity', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          primary: 'shared_target',
          target: 'shared_target',
        },
        targetId: 'shared_target',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.warnings).toContain(
        'primary and target refer to the same entity - consider using just one'
      );
    });

    it('should suggest descriptive target names', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          t1: 'target_1',
          t2: 'target_2',
          obj: 'target_3',
        },
        targetId: 'target_1',
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.warnings).toContain(
        'Consider using descriptive target names (e.g., "item", "recipient") instead of generic names'
      );
    });
  });

  describe('Legacy Compatibility', () => {
    it('should reject legacy events with non-string targetId values', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 42,
        originalInput: 'test action',
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Legacy targetId must be a string or null');
    });

    it('should require targetId when targets object exists', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'item_123',
        },
        originalInput: 'test action',
        // Missing targetId
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'targetId is required for backward compatibility when targets object is present'
      );
    });

    it('should handle null targetId for actions without targets', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:emote',
        targetId: null,
        originalInput: 'test emote',
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should warn when validation exceeds expected duration threshold', () => {
      const performanceSpy = jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(25);

      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };

      validator.validateEvent(event);

      expect(logger.warn).toHaveBeenCalledWith(
        'Multi-target validation took longer than expected',
        expect.objectContaining({ duration: expect.any(String), target: '< 10ms' })
      );

      performanceSpy.mockRestore();
    });

    it('should track validation performance metrics', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };

      // Perform several validations
      for (let i = 0; i < 5; i++) {
        validator.validateEvent(event);
      }

      const metrics = validator.getPerformanceMetrics();

      expect(metrics.validationCount).toBe(5);
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.averageTime).toBeGreaterThan(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should reset performance metrics', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targetId: 'target_456',
        originalInput: 'test action',
      };
      validator.validateEvent(event);

      validator.resetPerformanceMetrics();
      const metrics = validator.getPerformanceMetrics();

      expect(metrics.validationCount).toBe(0);
      expect(metrics.totalTime).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', () => {
      const result = validator.validateEvent(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Validation error: Event payload is required'
      );
    });

    it('should handle malformed event objects', () => {
      const result = validator.validateEvent({});

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
