/**
 * @file Integration tests for GOAP error hierarchy
 * @description Verifies the complete error inheritance chain and cross-cutting concerns
 */

import { describe, it, expect } from '@jest/globals';
import GoapError from '../../../../src/goap/errors/goapError.js';
import ContextAssemblyError from '../../../../src/goap/errors/contextAssemblyError.js';
import ParameterResolutionError from '../../../../src/goap/errors/parameterResolutionError.js';
import RefinementError from '../../../../src/goap/errors/refinementError.js';
import PlanningError from '../../../../src/goap/errors/planningError.js';
import MethodSelectionError from '../../../../src/goap/errors/methodSelectionError.js';
import StepExecutionError from '../../../../src/goap/errors/stepExecutionError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('GOAP Error Hierarchy Integration', () => {
  describe('Complete Inheritance Chain', () => {
    it('GoapError should extend BaseError', () => {
      const error = new GoapError('Test', 'TEST_ERROR');
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('ContextAssemblyError should extend GoapError and BaseError', () => {
      const error = new ContextAssemblyError('Test');
      expect(error).toBeInstanceOf(GoapError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('ParameterResolutionError should extend GoapError and BaseError', () => {
      const error = new ParameterResolutionError({ reference: 'test' });
      expect(error).toBeInstanceOf(GoapError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('RefinementError should extend GoapError and BaseError', () => {
      const error = new RefinementError('Test');
      expect(error).toBeInstanceOf(GoapError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('PlanningError should extend GoapError and BaseError', () => {
      const error = new PlanningError('Test');
      expect(error).toBeInstanceOf(GoapError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('MethodSelectionError should extend GoapError and BaseError', () => {
      const error = new MethodSelectionError('Test');
      expect(error).toBeInstanceOf(GoapError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('StepExecutionError should extend GoapError and BaseError', () => {
      const error = new StepExecutionError('Test');
      expect(error).toBeInstanceOf(GoapError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Error Code Consistency', () => {
    it('should have GOAP_ERROR code for base GoapError', () => {
      const error = new GoapError('Test', 'GOAP_ERROR');
      expect(error.code).toBe('GOAP_ERROR');
    });

    it('should have GOAP_CONTEXT_ASSEMBLY_ERROR code', () => {
      const error = new ContextAssemblyError('Test');
      expect(error.code).toBe('GOAP_CONTEXT_ASSEMBLY_ERROR');
    });

    it('should have GOAP_PARAMETER_RESOLUTION_ERROR code', () => {
      const error = new ParameterResolutionError({ reference: 'test' });
      expect(error.code).toBe('GOAP_PARAMETER_RESOLUTION_ERROR');
    });

    it('should have GOAP_REFINEMENT_ERROR code', () => {
      const error = new RefinementError('Test');
      expect(error.code).toBe('GOAP_REFINEMENT_ERROR');
    });

    it('should have GOAP_PLANNING_ERROR code', () => {
      const error = new PlanningError('Test');
      expect(error.code).toBe('GOAP_PLANNING_ERROR');
    });

    it('should have GOAP_METHOD_SELECTION_ERROR code', () => {
      const error = new MethodSelectionError('Test');
      expect(error.code).toBe('GOAP_METHOD_SELECTION_ERROR');
    });

    it('should have GOAP_STEP_EXECUTION_ERROR code', () => {
      const error = new StepExecutionError('Test');
      expect(error.code).toBe('GOAP_STEP_EXECUTION_ERROR');
    });

    it('should follow GOAP_*_ERROR naming pattern', () => {
      const errors = [
        new ContextAssemblyError('Test'),
        new ParameterResolutionError({ reference: 'test' }),
        new RefinementError('Test'),
        new PlanningError('Test'),
        new MethodSelectionError('Test'),
        new StepExecutionError('Test')
      ];

      errors.forEach(error => {
        expect(error.code).toMatch(/^GOAP_.*_ERROR$/);
      });
    });
  });

  describe('Serialization Consistency', () => {
    it('should serialize all GOAP errors to JSON with consistent structure', () => {
      const errors = [
        new GoapError('Test', 'GOAP_ERROR', { field: 'value' }),
        new ContextAssemblyError('Test', { field: 'value' }),
        new ParameterResolutionError({ reference: 'test', contextType: 'planning' }),
        new RefinementError('Test', { field: 'value' }),
        new PlanningError('Test', { field: 'value' }),
        new MethodSelectionError('Test', { field: 'value' }),
        new StepExecutionError('Test', { field: 'value' })
      ];

      errors.forEach(error => {
        const json = error.toJSON();

        expect(json).toHaveProperty('name');
        expect(json).toHaveProperty('message');
        expect(json).toHaveProperty('code');
        expect(json).toHaveProperty('context');
        expect(json).toHaveProperty('timestamp');
        expect(json).toHaveProperty('severity');
        expect(json).toHaveProperty('recoverable');
        expect(json).toHaveProperty('correlationId');
        expect(json).toHaveProperty('stack');
      });
    });

    it('should be JSON-safe for all error types', () => {
      const errors = [
        new GoapError('Test', 'GOAP_ERROR'),
        new ContextAssemblyError('Test'),
        new ParameterResolutionError({ reference: 'test' }),
        new RefinementError('Test'),
        new PlanningError('Test'),
        new MethodSelectionError('Test'),
        new StepExecutionError('Test')
      ];

      errors.forEach(error => {
        expect(() => JSON.stringify(error.toJSON())).not.toThrow();
      });
    });
  });

  describe('Severity Levels', () => {
    it('should have consistent severity levels', () => {
      expect(new GoapError('Test', 'TEST').severity).toBe('error');
      expect(new ContextAssemblyError('Test').severity).toBe('error');
      expect(new ParameterResolutionError({ reference: 'test' }).severity).toBe('error');
      expect(new RefinementError('Test').severity).toBe('error');
      expect(new PlanningError('Test').severity).toBe('warning'); // Special case
      expect(new MethodSelectionError('Test').severity).toBe('error');
      expect(new StepExecutionError('Test').severity).toBe('error');
    });

    it('should have PlanningError with warning severity', () => {
      const error = new PlanningError('Test');
      expect(error.getSeverity()).toBe('warning');
      expect(error.severity).toBe('warning');
    });
  });

  describe('Recoverability', () => {
    it('should have all GOAP errors as recoverable', () => {
      const errors = [
        new GoapError('Test', 'TEST'),
        new ContextAssemblyError('Test'),
        new ParameterResolutionError({ reference: 'test' }),
        new RefinementError('Test'),
        new PlanningError('Test'),
        new MethodSelectionError('Test'),
        new StepExecutionError('Test')
      ];

      errors.forEach(error => {
        expect(error.isRecoverable()).toBe(true);
        expect(error.recoverable).toBe(true);
      });
    });
  });

  describe('Context Preservation', () => {
    it('should preserve context across all error types', () => {
      const context = { actorId: 'actor-123', taskId: 'test-task' };

      const errors = [
        new GoapError('Test', 'TEST', context),
        new ContextAssemblyError('Test', context),
        new RefinementError('Test', context),
        new PlanningError('Test', context),
        new MethodSelectionError('Test', context),
        new StepExecutionError('Test', context)
      ];

      errors.forEach(error => {
        expect(error.context.actorId).toBe('actor-123');
        expect(error.context.taskId).toBe('test-task');
      });
    });

    it('should deep copy context to prevent external modification', () => {
      const context = { nested: { value: 'original' } };
      const error = new GoapError('Test', 'TEST', context);

      context.nested.value = 'modified';

      expect(error.context.nested.value).toBe('original');
    });
  });

  describe('Timestamp and Correlation', () => {
    it('should generate timestamps for all error types', () => {
      const errors = [
        new GoapError('Test', 'TEST'),
        new ContextAssemblyError('Test'),
        new ParameterResolutionError({ reference: 'test' }),
        new RefinementError('Test'),
        new PlanningError('Test'),
        new MethodSelectionError('Test'),
        new StepExecutionError('Test')
      ];

      errors.forEach(error => {
        expect(error.timestamp).toBeDefined();
        expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    it('should generate correlation IDs for all error types', () => {
      const errors = [
        new GoapError('Test', 'TEST'),
        new ContextAssemblyError('Test'),
        new ParameterResolutionError({ reference: 'test' }),
        new RefinementError('Test'),
        new PlanningError('Test'),
        new MethodSelectionError('Test'),
        new StepExecutionError('Test')
      ];

      errors.forEach(error => {
        expect(error.correlationId).toBeDefined();
        expect(typeof error.correlationId).toBe('string');
        expect(error.correlationId.length).toBeGreaterThan(0);
      });
    });

    it('should use custom correlation ID if provided', () => {
      const correlationId = 'custom-correlation-123';
      const errors = [
        new GoapError('Test', 'TEST', {}, { correlationId }),
        new ContextAssemblyError('Test', {}, { correlationId }),
        new RefinementError('Test', {}, { correlationId }),
        new PlanningError('Test', {}, { correlationId }),
        new MethodSelectionError('Test', {}, { correlationId }),
        new StepExecutionError('Test', {}, { correlationId })
      ];

      errors.forEach(error => {
        expect(error.correlationId).toBe(correlationId);
      });
    });
  });

  describe('Stack Trace Capture', () => {
    it('should capture stack traces for all error types', () => {
      const errors = [
        new GoapError('Test', 'TEST'),
        new ContextAssemblyError('Test'),
        new ParameterResolutionError({ reference: 'test' }),
        new RefinementError('Test'),
        new PlanningError('Test'),
        new MethodSelectionError('Test'),
        new StepExecutionError('Test')
      ];

      errors.forEach(error => {
        expect(error.stack).toBeDefined();
        expect(typeof error.stack).toBe('string');
        expect(error.stack.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve ContextAssemblyError details property', () => {
      const details = { actorId: 'actor-123', contextType: 'planning' };
      const error = new ContextAssemblyError('Test', details);
      expect(error.details).toEqual(details);
    });

    it('should preserve ParameterResolutionError individual properties', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.position',
        partialPath: 'actor',
        failedStep: 'position',
        availableKeys: ['name', 'id'],
        contextType: 'refinement',
        stepIndex: 2
      });

      expect(error.reference).toBe('actor.position');
      expect(error.partialPath).toBe('actor');
      expect(error.failedStep).toBe('position');
      expect(error.availableKeys).toEqual(['name', 'id']);
      expect(error.contextType).toBe('refinement');
      expect(error.stepIndex).toBe(2);
    });
  });

  describe('Error Message Formatting', () => {
    it('should preserve ParameterResolutionError sophisticated message formatting', () => {
      const error = new ParameterResolutionError({
        reference: 'actor.position.x',
        partialPath: 'actor.position',
        failedStep: 'x',
        availableKeys: ['y', 'z'],
        contextType: 'planning',
        stepIndex: 0
      });

      expect(error.message).toContain('actor.position.x');
      expect(error.message).toContain('Resolved: actor.position');
      expect(error.message).toContain('Failed at: x');
      expect(error.message).toContain('Available keys: ["y", "z"]');
      expect(error.message).toContain('Context: planning step 0');
    });
  });
});
