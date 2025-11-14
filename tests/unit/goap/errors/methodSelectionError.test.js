/**
 * @file Tests for MethodSelectionError class
 */

import { describe, it, expect } from '@jest/globals';
import MethodSelectionError from '../../../../src/goap/errors/methodSelectionError.js';
import GoapError from '../../../../src/goap/errors/goapError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('MethodSelectionError', () => {
  describe('Inheritance Chain', () => {
    it('should extend GoapError', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error).toBeInstanceOf(GoapError);
    });

    it('should extend BaseError', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should extend Error', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.name).toBe('MethodSelectionError');
    });
  });

  describe('Error Code', () => {
    it('should have GOAP_METHOD_SELECTION_ERROR code', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.code).toBe('GOAP_METHOD_SELECTION_ERROR');
    });
  });

  describe('Constructor', () => {
    it('should create error with message only', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.message).toBe('Method selection failed');
    });

    it('should create error with message and context', () => {
      const context = {
        taskId: 'consume_nourishing_item',
        methodIds: ['method_1', 'method_2', 'method_3'],
        evaluationResults: [
          { methodId: 'method_1', applicable: false, reason: 'No food available' },
          { methodId: 'method_2', applicable: false, reason: 'Not in kitchen' },
          { methodId: 'method_3', applicable: false, reason: 'Inventory full' }
        ],
        actorId: 'actor-123'
      };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(error.message).toBe('Method selection failed');
      expect(error.context).toEqual(context);
    });

    it('should create error with correlation ID option', () => {
      const correlationId = 'custom-correlation-id';
      const error = new MethodSelectionError('Method selection failed', {}, { correlationId });
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Context Properties', () => {
    it('should preserve taskId in context', () => {
      const context = { taskId: 'consume_nourishing_item' };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(error.context.taskId).toBe('consume_nourishing_item');
    });

    it('should preserve methodIds in context', () => {
      const context = { methodIds: ['method_1', 'method_2'] };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(error.context.methodIds).toEqual(['method_1', 'method_2']);
    });

    it('should preserve evaluationResults in context', () => {
      const evaluationResults = [
        { methodId: 'method_1', applicable: false, reason: 'Precondition not met' }
      ];
      const context = { evaluationResults };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(error.context.evaluationResults).toEqual(evaluationResults);
    });

    it('should preserve actorId in context', () => {
      const context = { actorId: 'actor-player' };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(error.context.actorId).toBe('actor-player');
    });

    it('should preserve reason in context', () => {
      const context = { reason: 'All methods failed applicability check' };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(error.context.reason).toBe('All methods failed applicability check');
    });

    it('should preserve all context properties', () => {
      const context = {
        taskId: 'test_task',
        methodIds: ['m1', 'm2'],
        actorId: 'actor-123',
        reason: 'No applicable methods'
      };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('Severity and Recoverability', () => {
    it('should have error severity (inherited from GoapError)', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.getSeverity()).toBe('error');
      expect(error.severity).toBe('error');
    });

    it('should be recoverable (inherited from GoapError)', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all fields', () => {
      const context = {
        taskId: 'test_task',
        methodIds: ['m1', 'm2'],
        actorId: 'actor-123'
      };
      const error = new MethodSelectionError('Method selection failed', context);
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'MethodSelectionError');
      expect(json).toHaveProperty('message', 'Method selection failed');
      expect(json).toHaveProperty('code', 'GOAP_METHOD_SELECTION_ERROR');
      expect(json).toHaveProperty('context', context);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should be JSON-safe (no circular references)', () => {
      const context = { taskId: 'test_task', actorId: 'actor-123' };
      const error = new MethodSelectionError('Method selection failed', context);
      expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });
  });

  describe('Stack Trace', () => {
    it('should capture stack trace', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('MethodSelectionError');
    });
  });

  describe('Timestamp and Correlation', () => {
    it('should have ISO format timestamp', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should generate correlation ID automatically', () => {
      const error = new MethodSelectionError('Method selection failed');
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });

    it('should use custom correlation ID if provided', () => {
      const correlationId = 'custom-id-789';
      const error = new MethodSelectionError('Method selection failed', {}, { correlationId });
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle no applicable methods scenario', () => {
      const context = {
        taskId: 'consume_nourishing_item',
        methodIds: ['use_from_inventory', 'pick_up_and_consume', 'receive_from_npc'],
        evaluationResults: [
          { methodId: 'use_from_inventory', applicable: false, reason: 'Inventory empty' },
          { methodId: 'pick_up_and_consume', applicable: false, reason: 'No food nearby' },
          { methodId: 'receive_from_npc', applicable: false, reason: 'No friendly NPCs nearby' }
        ],
        actorId: 'actor-player',
        reason: 'All methods failed applicability check'
      };
      const error = new MethodSelectionError(
        'No applicable method found for task "consume_nourishing_item"',
        context
      );

      expect(error.context.taskId).toBe('consume_nourishing_item');
      expect(error.context.methodIds).toHaveLength(3);
      expect(error.context.evaluationResults).toHaveLength(3);
      expect(error.recoverable).toBe(true);
    });

    it('should handle precondition failures', () => {
      const context = {
        taskId: 'move_to_location',
        methodIds: ['walk', 'run', 'teleport'],
        evaluationResults: [
          { methodId: 'walk', applicable: false, reason: 'Actor is sitting' },
          { methodId: 'run', applicable: false, reason: 'Actor is sitting' },
          { methodId: 'teleport', applicable: false, reason: 'No teleport ability' }
        ],
        actorId: 'actor-npc-01'
      };
      const error = new MethodSelectionError(
        'Cannot move: Actor must be standing',
        context
      );

      expect(error.context.evaluationResults[0].reason).toBe('Actor is sitting');
      expect(error.severity).toBe('error');
    });

    it('should handle empty method list', () => {
      const context = {
        taskId: 'perform_impossible_action',
        methodIds: [],
        actorId: 'actor-123',
        reason: 'No methods registered for this task'
      };
      const error = new MethodSelectionError(
        'No methods registered for task "perform_impossible_action"',
        context
      );

      expect(error.context.methodIds).toEqual([]);
      expect(error.context.reason).toBe('No methods registered for this task');
    });
  });
});
