/**
 * @file Tests for GoapError base class
 */

import { describe, it, expect } from '@jest/globals';
import GoapError from '../../../../src/goap/errors/goapError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('GoapError', () => {
  describe('Inheritance Chain', () => {
    it('should extend BaseError', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should extend Error', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error.name).toBe('GoapError');
    });
  });

  describe('Constructor', () => {
    it('should create error with message and code', () => {
      const error = new GoapError('GOAP operation failed', 'GOAP_ERROR');
      expect(error.message).toBe('GOAP operation failed');
      expect(error.code).toBe('GOAP_ERROR');
    });

    it('should create error with context', () => {
      const context = { actorId: 'actor-123', taskId: 'task-456' };
      const error = new GoapError(
        'GOAP operation failed',
        'GOAP_ERROR',
        context
      );
      expect(error.context).toEqual(context);
    });

    it('should create error with correlation ID option', () => {
      const correlationId = 'custom-correlation-id';
      const error = new GoapError(
        'GOAP operation failed',
        'GOAP_ERROR',
        {},
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });

    it('should generate correlation ID if not provided', () => {
      const error = new GoapError('GOAP operation failed', 'GOAP_ERROR');
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });

    it('should throw error if message is not a non-blank string', () => {
      expect(() => new GoapError('', 'GOAP_ERROR')).toThrow();
      expect(() => new GoapError(null, 'GOAP_ERROR')).toThrow();
      expect(() => new GoapError(undefined, 'GOAP_ERROR')).toThrow();
    });

    it('should throw error if code is not a non-blank string', () => {
      expect(() => new GoapError('Test message', '')).toThrow();
      expect(() => new GoapError('Test message', null)).toThrow();
      expect(() => new GoapError('Test message', undefined)).toThrow();
    });

    it('should handle null/undefined context gracefully', () => {
      const error1 = new GoapError('Test message', 'GOAP_ERROR', null);
      expect(error1.context).toEqual({});

      const error2 = new GoapError('Test message', 'GOAP_ERROR', undefined);
      expect(error2.context).toEqual({});
    });
  });

  describe('Severity', () => {
    it('should have default severity of "error"', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error.getSeverity()).toBe('error');
      expect(error.severity).toBe('error');
    });
  });

  describe('Recoverability', () => {
    it('should be recoverable by default', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Context Management', () => {
    it('should preserve context properties', () => {
      const context = {
        actorId: 'actor-123',
        taskId: 'task-456',
        reason: 'No applicable methods',
      };
      const error = new GoapError('Test message', 'GOAP_ERROR', context);
      expect(error.context).toEqual(context);
    });

    it('should deep copy context to prevent external modification', () => {
      const context = { actorId: 'actor-123', nested: { value: 'test' } };
      const error = new GoapError('Test message', 'GOAP_ERROR', context);

      // Modify original context
      context.actorId = 'actor-456';
      context.nested.value = 'changed';

      // Error context should be unchanged
      expect(error.context.actorId).toBe('actor-123');
      expect(error.context.nested.value).toBe('test');
    });

    it('should allow adding context after construction', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      error.addContext('actorId', 'actor-123');
      expect(error.getContext('actorId')).toBe('actor-123');
    });

    it('should retrieve specific context by key', () => {
      const context = { actorId: 'actor-123', taskId: 'task-456' };
      const error = new GoapError('Test message', 'GOAP_ERROR', context);
      expect(error.getContext('actorId')).toBe('actor-123');
      expect(error.getContext('taskId')).toBe('task-456');
    });

    it('should retrieve entire context when no key provided', () => {
      const context = { actorId: 'actor-123', taskId: 'task-456' };
      const error = new GoapError('Test message', 'GOAP_ERROR', context);
      expect(error.getContext()).toEqual(context);
    });
  });

  describe('Timestamp', () => {
    it('should have ISO format timestamp', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
      // Verify ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should set timestamp at construction time', () => {
      const before = new Date().toISOString();
      const error = new GoapError('Test message', 'GOAP_ERROR');
      const after = new Date().toISOString();

      expect(error.timestamp >= before).toBe(true);
      expect(error.timestamp <= after).toBe(true);
    });
  });

  describe('Stack Trace', () => {
    it('should capture stack trace', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('GoapError');
    });

    it('should point to error creation location', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR');
      expect(error.stack).toContain('goapError.test.js');
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all BaseError fields', () => {
      const context = { actorId: 'actor-123', taskId: 'task-456' };
      const error = new GoapError(
        'GOAP operation failed',
        'GOAP_ERROR',
        context
      );
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'GoapError');
      expect(json).toHaveProperty('message', 'GOAP operation failed');
      expect(json).toHaveProperty('code', 'GOAP_ERROR');
      expect(json).toHaveProperty('context', context);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should include GOAP-specific context in serialization', () => {
      const context = {
        actorId: 'actor-123',
        taskId: 'task-456',
        reason: 'Planning failed',
      };
      const error = new GoapError('Test message', 'GOAP_ERROR', context);
      const json = error.toJSON();

      expect(json.context).toEqual(context);
    });

    it('should be JSON-safe (no circular references)', () => {
      const error = new GoapError('Test message', 'GOAP_ERROR', {
        actorId: 'actor-123',
      });
      expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });
  });

  describe('String Representation', () => {
    it('should have meaningful toString representation', () => {
      const error = new GoapError('GOAP operation failed', 'GOAP_ERROR');
      const str = error.toString();

      expect(str).toContain('GoapError');
      expect(str).toContain('GOAP_ERROR');
      expect(str).toContain('GOAP operation failed');
      expect(str).toContain('severity: error');
      expect(str).toContain('recoverable: true');
    });
  });

  describe('Error Code Pattern', () => {
    it('should accept GOAP_* error code pattern', () => {
      const error1 = new GoapError('Test', 'GOAP_ERROR');
      expect(error1.code).toBe('GOAP_ERROR');

      const error2 = new GoapError('Test', 'GOAP_REFINEMENT_ERROR');
      expect(error2.code).toBe('GOAP_REFINEMENT_ERROR');

      const error3 = new GoapError('Test', 'GOAP_PLANNING_ERROR');
      expect(error3.code).toBe('GOAP_PLANNING_ERROR');
    });
  });
});
