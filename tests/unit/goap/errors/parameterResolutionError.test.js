/**
 * @file Tests for ParameterResolutionError class
 */

import { describe, it, expect } from '@jest/globals';
import ParameterResolutionError from '../../../../src/goap/errors/parameterResolutionError.js';
import GoapError from '../../../../src/goap/errors/goapError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('ParameterResolutionError', () => {
  describe('Inheritance Chain', () => {
    it('should extend GoapError', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error).toBeInstanceOf(GoapError);
    });

    it('should extend BaseError', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should extend Error', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.name).toBe('ParameterResolutionError');
    });
  });

  describe('Error Code', () => {
    it('should have GOAP_PARAMETER_RESOLUTION_ERROR code', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.code).toBe('GOAP_PARAMETER_RESOLUTION_ERROR');
    });
  });

  describe('Constructor - Basic Usage', () => {
    it('should create error with reference only', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.reference).toBe('actor.position');
      expect(error.message).toContain('actor.position');
      expect(error.message).toContain('not found in context');
    });

    it('should create error with all details', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.position.x',
        partialPath: 'actor.position',
        failedStep: 'x',
        availableKeys: ['y', 'z'],
        contextType: 'planning',
        stepIndex: 0
      });

      expect(error.reference).toBe('actor.position.x');
      expect(error.partialPath).toBe('actor.position');
      expect(error.failedStep).toBe('x');
      expect(error.availableKeys).toEqual(['y', 'z']);
      expect(error.contextType).toBe('planning');
      expect(error.stepIndex).toBe(0);
    });

    it('should create error with correlation ID option', () => {
      const correlationId = 'custom-correlation-id';
      const error = new ParameterResolutionError(
        { reference: 'actor.position' },
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Backward Compatibility - Property Access', () => {
    it('should provide reference property', () => {
      const error = new ParameterResolutionError({ reference: 'actor.health' });
      expect(error.reference).toBe('actor.health');
    });

    it('should provide partialPath property', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.inventory.items',
        partialPath: 'actor.inventory'
      });
      expect(error.partialPath).toBe('actor.inventory');
    });

    it('should provide failedStep property', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.stats.strength',
        failedStep: 'strength'
      });
      expect(error.failedStep).toBe('strength');
    });

    it('should provide availableKeys property', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.data.field',
        availableKeys: ['name', 'type', 'id']
      });
      expect(error.availableKeys).toEqual(['name', 'type', 'id']);
    });

    it('should provide contextType property', () => {
      const error = new ParameterResolutionError({
        reference: 'target.position',
        contextType: 'refinement'
      });
      expect(error.contextType).toBe('refinement');
    });

    it('should provide stepIndex property', () => {
      const error = new ParameterResolutionError({
        reference: 'binding.target',
        stepIndex: 2
      });
      expect(error.stepIndex).toBe(2);
    });
  });

  describe('Message Formatting', () => {
    it('should format message with reference only', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.message).toBe("Parameter 'actor.position' not found in context");
    });

    it('should format message with partialPath', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.position.x',
        partialPath: 'actor.position'
      });
      expect(error.message).toContain('actor.position.x');
      expect(error.message).toContain('Resolved: actor.position');
    });

    it('should format message with failedStep', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.stats.strength',
        failedStep: 'strength'
      });
      expect(error.message).toContain('Failed at: strength');
    });

    it('should format message with availableKeys', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.data.field',
        availableKeys: ['name', 'type', 'id']
      });
      expect(error.message).toContain('Available keys: ["name", "type", "id"]');
    });

    it('should format message with contextType', () => {
      const error = new ParameterResolutionError({
        reference: 'target.position',
        contextType: 'planning'
      });
      expect(error.message).toContain('Context: planning');
    });

    it('should format message with contextType and stepIndex', () => {
      const error = new ParameterResolutionError({
        reference: 'binding.target',
        contextType: 'refinement',
        stepIndex: 3
      });
      expect(error.message).toContain('Context: refinement step 3');
    });

    it('should format comprehensive message with all details', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.inventory.items[0].name',
        partialPath: 'actor.inventory.items[0]',
        failedStep: 'name',
        availableKeys: ['id', 'type', 'quantity'],
        contextType: 'refinement',
        stepIndex: 2
      });

      const message = error.message;
      expect(message).toContain("Parameter 'actor.inventory.items[0].name' not found in context");
      expect(message).toContain('Resolved: actor.inventory.items[0]');
      expect(message).toContain('Failed at: name');
      expect(message).toContain('Available keys: ["id", "type", "quantity"]');
      expect(message).toContain('Context: refinement step 2');
    });
  });

  describe('Context Integration', () => {
    it('should map all properties to context', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.position.x',
        partialPath: 'actor.position',
        failedStep: 'x',
        availableKeys: ['y', 'z'],
        contextType: 'planning',
        stepIndex: 0
      });

      const context = error.context;
      expect(context.reference).toBe('actor.position.x');
      expect(context.partialPath).toBe('actor.position');
      expect(context.failedStep).toBe('x');
      expect(context.availableKeys).toEqual(['y', 'z']);
      expect(context.contextType).toBe('planning');
      expect(context.stepIndex).toBe(0);
    });
  });

  describe('Severity and Recoverability', () => {
    it('should inherit error severity from GoapError', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.getSeverity()).toBe('error');
      expect(error.severity).toBe('error');
    });

    it('should be recoverable (inherited from GoapError)', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all fields', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.position',
        partialPath: 'actor',
        failedStep: 'position',
        availableKeys: ['name', 'id'],
        contextType: 'planning'
      });
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'ParameterResolutionError');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code', 'GOAP_PARAMETER_RESOLUTION_ERROR');
      expect(json).toHaveProperty('context');
      expect(json.context.reference).toBe('actor.position');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should be JSON-safe (no circular references)', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });
  });

  describe('Stack Trace', () => {
    it('should capture stack trace', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('ParameterResolutionError');
    });
  });

  describe('Timestamp and Correlation', () => {
    it('should have ISO format timestamp', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should generate correlation ID automatically', () => {
      const error = new ParameterResolutionError({ reference: 'actor.position' });
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle planning context parameter resolution failure', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.positioning:position',
        partialPath: 'actor',
        failedStep: 'positioning:position',
        availableKeys: ['core:actor', 'core:name'],
        contextType: 'planning'
      });

      expect(error.reference).toBe('actor.positioning:position');
      expect(error.message).toContain('positioning:position');
      expect(error.message).toContain('Available keys: ["core:actor", "core:name"]');
      expect(error.contextType).toBe('planning');
    });

    it('should handle refinement step parameter resolution failure', () => {
      const error = new ParameterResolutionError({
        reference: 'target.clothing:upper_body_covering',
        partialPath: 'target',
        failedStep: 'clothing:upper_body_covering',
        availableKeys: ['core:actor', 'positioning:position'],
        contextType: 'refinement',
        stepIndex: 5
      });

      expect(error.stepIndex).toBe(5);
      expect(error.message).toContain('Context: refinement step 5');
      expect(error.message).toContain('clothing:upper_body_covering');
    });

    it('should handle nested path resolution failure', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.inventory.items[0].properties.weight',
        partialPath: 'actor.inventory.items[0].properties',
        failedStep: 'weight',
        availableKeys: ['name', 'type', 'durability'],
        contextType: 'refinement',
        stepIndex: 2
      });

      expect(error.partialPath).toBe('actor.inventory.items[0].properties');
      expect(error.failedStep).toBe('weight');
      expect(error.message).toContain('Resolved: actor.inventory.items[0].properties');
      expect(error.message).toContain('Failed at: weight');
    });
  });
});
