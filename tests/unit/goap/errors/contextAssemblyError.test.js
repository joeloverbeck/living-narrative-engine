/**
 * @file Tests for ContextAssemblyError class
 */

import { describe, it, expect } from '@jest/globals';
import ContextAssemblyError from '../../../../src/goap/errors/contextAssemblyError.js';
import GoapError from '../../../../src/goap/errors/goapError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('ContextAssemblyError', () => {
  describe('Inheritance Chain', () => {
    it('should extend GoapError', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error).toBeInstanceOf(GoapError);
    });

    it('should extend BaseError', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should extend Error', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.name).toBe('ContextAssemblyError');
    });
  });

  describe('Error Code', () => {
    it('should have GOAP_CONTEXT_ASSEMBLY_ERROR code', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.code).toBe('GOAP_CONTEXT_ASSEMBLY_ERROR');
    });
  });

  describe('Constructor - Basic Usage', () => {
    it('should create error with message only', () => {
      const error = new ContextAssemblyError('Context assembly failed');
      expect(error.message).toBe('Context assembly failed');
      expect(error.details).toEqual({});
    });

    it('should create error with message and details', () => {
      const details = {
        actorId: 'actor-123',
        contextType: 'planning',
        missingData: 'actor position',
      };
      const error = new ContextAssemblyError(
        'Context assembly failed',
        details
      );
      expect(error.message).toBe('Context assembly failed');
      expect(error.details).toEqual(details);
    });

    it('should create error with correlation ID option', () => {
      const correlationId = 'custom-correlation-id';
      const error = new ContextAssemblyError(
        'Context assembly failed',
        {},
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Backward Compatibility - Details Property', () => {
    it('should preserve details property for backward compatibility', () => {
      const details = {
        actorId: 'actor-123',
        contextType: 'refinement',
        missingData: 'target entity',
        reason: 'Target not found in world state',
      };
      const error = new ContextAssemblyError('Test message', details);
      expect(error.details).toEqual(details);
    });

    it('should allow empty details object', () => {
      const error = new ContextAssemblyError('Test message', {});
      expect(error.details).toEqual({});
    });

    it('should default to empty details if not provided', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.details).toEqual({});
    });

    it('should make details accessible via property', () => {
      const details = { actorId: 'actor-123', contextType: 'planning' };
      const error = new ContextAssemblyError('Test message', details);
      expect(error.details.actorId).toBe('actor-123');
      expect(error.details.contextType).toBe('planning');
    });
  });

  describe('Context Integration', () => {
    it('should map details to context for BaseError', () => {
      const details = {
        actorId: 'actor-123',
        contextType: 'planning',
        missingData: 'actor position',
        reason: 'No position component',
      };
      const error = new ContextAssemblyError('Test message', details);

      const context = error.context;
      expect(context.actorId).toBe('actor-123');
      expect(context.contextType).toBe('planning');
      expect(context.missingData).toBe('actor position');
      expect(context.reason).toBe('No position component');
    });

    it('should include all details properties in context', () => {
      const details = {
        actorId: 'actor-123',
        contextType: 'refinement',
        customField: 'custom value',
        anotherField: 'another value',
      };
      const error = new ContextAssemblyError('Test message', details);

      const context = error.context;
      expect(context.actorId).toBe('actor-123');
      expect(context.contextType).toBe('refinement');
      expect(context.customField).toBe('custom value');
      expect(context.anotherField).toBe('another value');
    });
  });

  describe('Severity and Recoverability', () => {
    it('should inherit error severity from GoapError', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.getSeverity()).toBe('error');
      expect(error.severity).toBe('error');
    });

    it('should be recoverable (inherited from GoapError)', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all fields', () => {
      const details = {
        actorId: 'actor-123',
        contextType: 'planning',
        missingData: 'position',
        reason: 'No position component',
      };
      const error = new ContextAssemblyError(
        'Context assembly failed',
        details
      );
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'ContextAssemblyError');
      expect(json).toHaveProperty('message', 'Context assembly failed');
      expect(json).toHaveProperty('code', 'GOAP_CONTEXT_ASSEMBLY_ERROR');
      expect(json).toHaveProperty('context');
      expect(json.context).toEqual(details);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should be JSON-safe (no circular references)', () => {
      const details = { actorId: 'actor-123' };
      const error = new ContextAssemblyError('Test message', details);
      expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });
  });

  describe('Stack Trace', () => {
    it('should capture stack trace', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('ContextAssemblyError');
    });
  });

  describe('Timestamp and Correlation', () => {
    it('should have ISO format timestamp', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should generate correlation ID automatically', () => {
      const error = new ContextAssemblyError('Test message');
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });

    it('should use custom correlation ID if provided', () => {
      const correlationId = 'custom-id-123';
      const error = new ContextAssemblyError(
        'Test message',
        {},
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle planning context assembly failure', () => {
      const details = {
        actorId: 'actor-npc-01',
        contextType: 'planning',
        missingData: 'actor position',
        reason: 'Actor has no positioning:position component',
      };
      const error = new ContextAssemblyError(
        'Failed to assemble planning context for actor-npc-01',
        details
      );

      expect(error.message).toContain('actor-npc-01');
      expect(error.details.contextType).toBe('planning');
      expect(error.details.reason).toContain('positioning:position');
      expect(error.code).toBe('GOAP_CONTEXT_ASSEMBLY_ERROR');
    });

    it('should handle refinement context assembly failure', () => {
      const details = {
        actorId: 'actor-player',
        contextType: 'refinement',
        missingData: 'target entity',
        reason: 'Target entity not found in world state',
      };
      const error = new ContextAssemblyError(
        'Failed to assemble refinement context',
        details
      );

      expect(error.details.contextType).toBe('refinement');
      expect(error.details.missingData).toBe('target entity');
      expect(error.recoverable).toBe(true);
    });

    it('should handle condition context assembly failure', () => {
      const details = {
        actorId: 'actor-guard',
        contextType: 'condition',
        missingData: 'world state snapshot',
        reason: 'World state not provided to condition evaluator',
      };
      const error = new ContextAssemblyError(
        'Failed to assemble condition context',
        details
      );

      expect(error.details.contextType).toBe('condition');
      expect(error.severity).toBe('error');
    });
  });
});
