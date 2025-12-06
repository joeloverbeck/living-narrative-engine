/**
 * @file Unit tests for clothing error classes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import BaseError from '../../../../src/errors/baseError.js';
import {
  ClothingError,
  ClothingAccessibilityError,
  CoverageAnalysisError,
  PriorityCalculationError,
  ClothingServiceError,
  ClothingValidationError,
} from '../../../../src/clothing/errors/clothingErrors.js';

describe('Clothing Error Classes', () => {
  describe('ClothingError', () => {
    it('should extend BaseError', () => {
      const error = new ClothingError('Test message', { context: 'test' });
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const error = new ClothingError('Test message', { key: 'value' });

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('CLOTHING_ERROR');
      expect(error.context).toEqual({ key: 'value' });
      expect(error.timestamp).toBeDefined();
      expect(error.getSeverity()).toBe('warning');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should maintain backward compatibility with timestamp', () => {
      const error = new ClothingError('Test message');
      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('ClothingAccessibilityError', () => {
    it('should extend BaseError', () => {
      const error = new ClothingAccessibilityError(
        'Access error',
        'entity_1',
        'item_1'
      );
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const error = new ClothingAccessibilityError(
        'Access error',
        'entity_1',
        'item_1',
        { reason: 'blocked' }
      );

      expect(error.message).toBe('Access error');
      expect(error.code).toBe('CLOTHING_ACCESSIBILITY_ERROR');
      expect(error.context).toEqual({
        entityId: 'entity_1',
        itemId: 'item_1',
        reason: 'blocked',
      });
      expect(error.getSeverity()).toBe('warning');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should maintain backward compatibility', () => {
      const error = new ClothingAccessibilityError(
        'Test',
        'entity_1',
        'item_1'
      );
      expect(error.entityId).toBe('entity_1');
      expect(error.itemId).toBe('item_1');
    });
  });

  describe('CoverageAnalysisError', () => {
    it('should extend BaseError', () => {
      const error = new CoverageAnalysisError('Coverage error', {});
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const equipmentState = { torso: { base: 'shirt' } };
      const error = new CoverageAnalysisError(
        'Coverage error',
        equipmentState,
        { entityId: 'test' }
      );

      expect(error.message).toBe('Coverage error');
      expect(error.code).toBe('COVERAGE_ANALYSIS_ERROR');
      expect(error.context).toEqual({
        equipmentState,
        entityId: 'test',
      });
      expect(error.getSeverity()).toBe('warning');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should maintain backward compatibility', () => {
      const equipmentState = { test: 'state' };
      const error = new CoverageAnalysisError('Test', equipmentState);
      expect(error.equipmentState).toBe(equipmentState);
    });
  });

  describe('PriorityCalculationError', () => {
    it('should extend BaseError', () => {
      const error = new PriorityCalculationError(
        'Priority error',
        'base',
        {},
        []
      );
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const modifiers = ['modifier1', 'modifier2'];
      const error = new PriorityCalculationError(
        'Priority error',
        'outer',
        { additionalContext: 'test' },
        modifiers
      );

      expect(error.message).toBe('Priority error');
      expect(error.code).toBe('PRIORITY_CALCULATION_ERROR');
      expect(error.context).toEqual({
        layer: 'outer',
        modifiers,
        additionalContext: 'test',
      });
      expect(error.getSeverity()).toBe('warning');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should maintain backward compatibility', () => {
      const modifiers = ['mod1'];
      const error = new PriorityCalculationError(
        'Test',
        'layer1',
        {},
        modifiers
      );
      expect(error.layer).toBe('layer1');
      expect(error.modifiers).toBe(modifiers);
    });
  });

  describe('ClothingServiceError', () => {
    it('should extend BaseError', () => {
      const error = new ClothingServiceError('Service error', 'Service', 'op');
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const error = new ClothingServiceError(
        'Service error',
        'TestService',
        'testOp',
        { detail: 'test' }
      );

      expect(error.message).toBe('Service error');
      expect(error.code).toBe('CLOTHING_SERVICE_ERROR');
      expect(error.context).toEqual({
        serviceName: 'TestService',
        operation: 'testOp',
        detail: 'test',
      });
      expect(error.getSeverity()).toBe('error'); // Higher severity
      expect(error.isRecoverable()).toBe(true);
    });

    it('should maintain backward compatibility', () => {
      const error = new ClothingServiceError('Test', 'Service1', 'op1');
      expect(error.serviceName).toBe('Service1');
      expect(error.operation).toBe('op1');
    });
  });

  describe('ClothingValidationError', () => {
    it('should extend BaseError', () => {
      const error = new ClothingValidationError(
        'Validation error',
        'field',
        123,
        'string'
      );
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const error = new ClothingValidationError(
        'Validation error',
        'entityId',
        123,
        'string',
        { source: 'input' }
      );

      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('CLOTHING_VALIDATION_ERROR');
      expect(error.context).toEqual({
        field: 'entityId',
        value: 123,
        expectedType: 'string',
        source: 'input',
      });
      expect(error.getSeverity()).toBe('warning');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should maintain backward compatibility', () => {
      const error = new ClothingValidationError(
        'Test',
        'field1',
        'value1',
        'type1'
      );
      expect(error.field).toBe('field1');
      expect(error.value).toBe('value1');
      expect(error.expectedType).toBe('type1');
    });
  });

  describe('Error serialization', () => {
    it('should serialize to JSON properly', () => {
      const error = new ClothingServiceError('Test error', 'Service', 'op', {
        test: true,
      });
      const json = error.toJSON();

      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', 'CLOTHING_SERVICE_ERROR');
      expect(json).toHaveProperty('context');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should have unique correlation IDs', () => {
      const error1 = new ClothingError('Error 1');
      const error2 = new ClothingError('Error 2');

      expect(error1.correlationId).toBeDefined();
      expect(error2.correlationId).toBeDefined();
      expect(error1.correlationId).not.toBe(error2.correlationId);
    });
  });

  describe('Error inheritance chain', () => {
    it('should properly inherit from Error and BaseError', () => {
      const error = new ClothingError('Test');

      // Should have Error properties
      expect(error.message).toBe('Test');
      expect(error.stack).toBeDefined();
      expect(error.name).toBe('ClothingError');

      // Should have BaseError properties
      expect(error.code).toBeDefined();
      expect(error.context).toBeDefined();
      expect(error.timestamp).toBeDefined();
      expect(error.severity).toBeDefined();
      expect(error.recoverable).toBeDefined();
      expect(error.correlationId).toBeDefined();

      // Should have BaseError methods
      expect(typeof error.getSeverity).toBe('function');
      expect(typeof error.isRecoverable).toBe('function');
      expect(typeof error.toJSON).toBe('function');
      expect(typeof error.toString).toBe('function');
      expect(typeof error.addContext).toBe('function');
      expect(typeof error.getContext).toBe('function');
    });
  });
});
