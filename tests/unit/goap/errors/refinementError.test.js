/**
 * @file Tests for RefinementError class
 */

import { describe, it, expect } from '@jest/globals';
import RefinementError from '../../../../src/goap/errors/refinementError.js';
import GoapError from '../../../../src/goap/errors/goapError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('RefinementError', () => {
  describe('Inheritance Chain', () => {
    it('should extend GoapError', () => {
      const error = new RefinementError('Refinement failed');
      expect(error).toBeInstanceOf(GoapError);
    });

    it('should extend BaseError', () => {
      const error = new RefinementError('Refinement failed');
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should extend Error', () => {
      const error = new RefinementError('Refinement failed');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.name).toBe('RefinementError');
    });
  });

  describe('Error Code', () => {
    it('should have GOAP_REFINEMENT_ERROR code', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.code).toBe('GOAP_REFINEMENT_ERROR');
    });
  });

  describe('Constructor', () => {
    it('should create error with message only', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.message).toBe('Refinement failed');
    });

    it('should create error with message and context', () => {
      const context = {
        taskId: 'consume_nourishing_item',
        methodId: 'use_item_from_inventory',
        stepIndex: 2,
        actorId: 'actor-123',
        reason: 'No applicable methods found',
      };
      const error = new RefinementError('Refinement failed', context);
      expect(error.message).toBe('Refinement failed');
      expect(error.context).toEqual(context);
    });

    it('should create error with correlation ID option', () => {
      const correlationId = 'custom-correlation-id';
      const error = new RefinementError(
        'Refinement failed',
        {},
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Context Properties', () => {
    it('should preserve taskId in context', () => {
      const context = { taskId: 'consume_nourishing_item' };
      const error = new RefinementError('Refinement failed', context);
      expect(error.context.taskId).toBe('consume_nourishing_item');
    });

    it('should preserve methodId in context', () => {
      const context = { methodId: 'use_item_from_inventory' };
      const error = new RefinementError('Refinement failed', context);
      expect(error.context.methodId).toBe('use_item_from_inventory');
    });

    it('should preserve stepIndex in context', () => {
      const context = { stepIndex: 3 };
      const error = new RefinementError('Refinement failed', context);
      expect(error.context.stepIndex).toBe(3);
    });

    it('should preserve actorId in context', () => {
      const context = { actorId: 'actor-player' };
      const error = new RefinementError('Refinement failed', context);
      expect(error.context.actorId).toBe('actor-player');
    });

    it('should preserve reason in context', () => {
      const context = { reason: 'Preconditions not met' };
      const error = new RefinementError('Refinement failed', context);
      expect(error.context.reason).toBe('Preconditions not met');
    });

    it('should preserve all context properties', () => {
      const context = {
        taskId: 'consume_nourishing_item',
        methodId: 'use_item_from_inventory',
        stepIndex: 2,
        actorId: 'actor-123',
        reason: 'Item not found in inventory',
      };
      const error = new RefinementError('Refinement failed', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('Severity and Recoverability', () => {
    it('should have error severity (inherited from GoapError)', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.getSeverity()).toBe('error');
      expect(error.severity).toBe('error');
    });

    it('should be recoverable (inherited from GoapError)', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all fields', () => {
      const context = {
        taskId: 'consume_nourishing_item',
        methodId: 'use_item_from_inventory',
        actorId: 'actor-123',
      };
      const error = new RefinementError('Refinement failed', context);
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'RefinementError');
      expect(json).toHaveProperty('message', 'Refinement failed');
      expect(json).toHaveProperty('code', 'GOAP_REFINEMENT_ERROR');
      expect(json).toHaveProperty('context', context);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should be JSON-safe (no circular references)', () => {
      const context = { taskId: 'test_task', actorId: 'actor-123' };
      const error = new RefinementError('Refinement failed', context);
      expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });
  });

  describe('Stack Trace', () => {
    it('should capture stack trace', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('RefinementError');
    });
  });

  describe('Timestamp and Correlation', () => {
    it('should have ISO format timestamp', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should generate correlation ID automatically', () => {
      const error = new RefinementError('Refinement failed');
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });

    it('should use custom correlation ID if provided', () => {
      const correlationId = 'custom-id-123';
      const error = new RefinementError(
        'Refinement failed',
        {},
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle method selection failure during refinement', () => {
      const context = {
        taskId: 'consume_nourishing_item',
        methodId: null,
        actorId: 'actor-player',
        reason: 'No applicable methods found for task',
      };
      const error = new RefinementError(
        'Failed to refine task "consume_nourishing_item": No applicable methods',
        context
      );

      expect(error.message).toContain('consume_nourishing_item');
      expect(error.context.taskId).toBe('consume_nourishing_item');
      expect(error.context.reason).toBe('No applicable methods found for task');
      expect(error.recoverable).toBe(true);
    });

    it('should handle step execution failure during refinement', () => {
      const context = {
        taskId: 'consume_nourishing_item',
        methodId: 'use_item_from_inventory',
        stepIndex: 2,
        actorId: 'actor-player',
        reason: 'Step preconditions not met',
      };
      const error = new RefinementError(
        'Refinement step 2 failed for method "use_item_from_inventory"',
        context
      );

      expect(error.context.stepIndex).toBe(2);
      expect(error.context.methodId).toBe('use_item_from_inventory');
      expect(error.message).toContain('step 2');
    });

    it('should handle method precondition failure', () => {
      const context = {
        taskId: 'move_to_location',
        methodId: 'walk_to_target',
        actorId: 'actor-npc-01',
        reason: 'Actor is not standing',
      };
      const error = new RefinementError(
        'Method "walk_to_target" preconditions not satisfied',
        context
      );

      expect(error.context.reason).toBe('Actor is not standing');
      expect(error.severity).toBe('error');
      expect(error.recoverable).toBe(true);
    });

    it('should handle circular task dependency', () => {
      const context = {
        taskId: 'task_a',
        methodId: 'method_circular',
        actorId: 'actor-123',
        reason: 'Circular dependency detected: task_a -> task_b -> task_a',
      };
      const error = new RefinementError(
        'Circular task dependency detected during refinement',
        context
      );

      expect(error.context.reason).toContain('Circular dependency');
      expect(error.code).toBe('GOAP_REFINEMENT_ERROR');
    });
  });
});
