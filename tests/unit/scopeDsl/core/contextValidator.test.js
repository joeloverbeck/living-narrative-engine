// tests/unit/scopeDsl/core/contextValidator.test.js

import { jest } from '@jest/globals';
import ContextValidator from '../../../../src/scopeDsl/core/contextValidator.js';

describe('ContextValidator', () => {
  let contextValidator;
  let validContext;
  let mockActorEntity;
  let mockRuntimeCtx;
  let mockDispatcher;
  let mockCycleDetector;
  let mockDepthGuard;

  beforeEach(() => {
    // Create valid mock objects
    mockActorEntity = { id: 'actor123' };
    mockRuntimeCtx = { entityManager: {}, location: { id: 'loc1' } };
    mockDispatcher = { resolve: jest.fn() };
    mockCycleDetector = { enter: jest.fn(), leave: jest.fn() };
    mockDepthGuard = { ensure: jest.fn() };

    validContext = {
      actorEntity: mockActorEntity,
      runtimeCtx: mockRuntimeCtx,
      dispatcher: mockDispatcher,
      cycleDetector: mockCycleDetector,
      depthGuard: mockDepthGuard,
      depth: 0,
      trace: { addLog: jest.fn() },
    };

    contextValidator = new ContextValidator();
  });

  describe('constructor', () => {
    it('should use default critical properties when none provided', () => {
      const validator = new ContextValidator();
      const expectedProperties = [
        'actorEntity',
        'runtimeCtx',
        'dispatcher',
        'cycleDetector',
        'depthGuard',
      ];
      expect(validator.getCriticalProperties()).toEqual(expectedProperties);
    });

    it('should use custom critical properties when provided', () => {
      const customProperties = ['prop1', 'prop2'];
      const validator = new ContextValidator(customProperties);
      expect(validator.getCriticalProperties()).toEqual(customProperties);
    });
  });

  describe('validate', () => {
    it('should return true for valid context', () => {
      expect(contextValidator.validate(validContext)).toBe(true);
    });

    it('should throw error for null context', () => {
      expect(() => contextValidator.validate(null)).toThrow(
        '[CRITICAL] Context must be a valid object'
      );
    });

    it('should throw error for undefined context', () => {
      expect(() => contextValidator.validate(undefined)).toThrow(
        '[CRITICAL] Context must be a valid object'
      );
    });

    it('should throw error for non-object context', () => {
      expect(() => contextValidator.validate('not an object')).toThrow(
        '[CRITICAL] Context must be a valid object'
      );
      expect(() => contextValidator.validate(123)).toThrow(
        '[CRITICAL] Context must be a valid object'
      );
      expect(() => contextValidator.validate([])).toThrow(
        '[CRITICAL] Context is missing required properties'
      );
    });

    it('should throw error for missing actorEntity', () => {
      const contextWithoutActor = { ...validContext };
      delete contextWithoutActor.actorEntity;

      expect(() => contextValidator.validate(contextWithoutActor)).toThrow(
        '[CRITICAL] Context is missing required properties: actorEntity'
      );
    });

    it('should throw error for missing runtimeCtx', () => {
      const contextWithoutRuntime = { ...validContext };
      delete contextWithoutRuntime.runtimeCtx;

      expect(() => contextValidator.validate(contextWithoutRuntime)).toThrow(
        '[CRITICAL] Context is missing required properties: runtimeCtx'
      );
    });

    it('should throw error for missing dispatcher', () => {
      const contextWithoutDispatcher = { ...validContext };
      delete contextWithoutDispatcher.dispatcher;

      expect(() => contextValidator.validate(contextWithoutDispatcher)).toThrow(
        '[CRITICAL] Context is missing required properties: dispatcher'
      );
    });

    it('should throw error for missing multiple properties', () => {
      const contextWithoutMultiple = { ...validContext };
      delete contextWithoutMultiple.actorEntity;
      delete contextWithoutMultiple.dispatcher;

      expect(() => contextValidator.validate(contextWithoutMultiple)).toThrow(
        '[CRITICAL] Context is missing required properties: actorEntity, dispatcher'
      );
    });

    it('should throw error for actorEntity without id', () => {
      const contextWithInvalidActor = {
        ...validContext,
        actorEntity: { name: 'actor' }, // Missing id
      };

      expect(() => contextValidator.validate(contextWithInvalidActor)).toThrow(
        '[CRITICAL] actorEntity must have an id property'
      );
    });

    it('should throw error for non-object runtimeCtx', () => {
      const contextWithInvalidRuntime = {
        ...validContext,
        runtimeCtx: 'not an object',
      };

      expect(() =>
        contextValidator.validate(contextWithInvalidRuntime)
      ).toThrow('[CRITICAL] runtimeCtx must be an object');
    });

    it('should throw error for dispatcher without resolve method', () => {
      const contextWithInvalidDispatcher = {
        ...validContext,
        dispatcher: { someOtherMethod: jest.fn() },
      };

      expect(() =>
        contextValidator.validate(contextWithInvalidDispatcher)
      ).toThrow('[CRITICAL] dispatcher must have a resolve method');
    });

    it('should throw error for invalid depth', () => {
      const contextWithInvalidDepth = {
        ...validContext,
        depth: -1,
      };

      expect(() => contextValidator.validate(contextWithInvalidDepth)).toThrow(
        '[CRITICAL] depth must be a non-negative number'
      );
    });

    it('should throw error for non-number depth', () => {
      const contextWithInvalidDepth = {
        ...validContext,
        depth: 'not a number',
      };

      expect(() => contextValidator.validate(contextWithInvalidDepth)).toThrow(
        '[CRITICAL] depth must be a non-negative number'
      );
    });

    it('should throw error for cycleDetector without required methods', () => {
      const contextWithInvalidCycleDetector = {
        ...validContext,
        cycleDetector: { enter: jest.fn() }, // Missing leave method
      };

      expect(() =>
        contextValidator.validate(contextWithInvalidCycleDetector)
      ).toThrow('[CRITICAL] cycleDetector must have enter and leave methods');
    });

    it('should throw error for depthGuard without ensure method', () => {
      const contextWithInvalidDepthGuard = {
        ...validContext,
        depthGuard: { someOtherMethod: jest.fn() },
      };

      expect(() =>
        contextValidator.validate(contextWithInvalidDepthGuard)
      ).toThrow('[CRITICAL] depthGuard must have an ensure method');
    });

    it('should allow undefined depth', () => {
      const contextWithUndefinedDepth = { ...validContext };
      delete contextWithUndefinedDepth.depth;

      expect(() =>
        contextValidator.validate(contextWithUndefinedDepth)
      ).not.toThrow();
    });

    it('should allow zero depth', () => {
      const contextWithZeroDepth = {
        ...validContext,
        depth: 0,
      };

      expect(() =>
        contextValidator.validate(contextWithZeroDepth)
      ).not.toThrow();
    });
  });

  describe('validateForMerging', () => {
    it('should validate base context fully', () => {
      expect(() =>
        contextValidator.validateForMerging(validContext, null)
      ).not.toThrow();
    });

    it('should allow null overlay context', () => {
      expect(() =>
        contextValidator.validateForMerging(validContext, null)
      ).not.toThrow();
    });

    it('should allow undefined overlay context', () => {
      expect(() =>
        contextValidator.validateForMerging(validContext, undefined)
      ).not.toThrow();
    });

    it('should validate overlay context when provided', () => {
      const validOverlay = { depth: 1, customProp: 'test' };
      expect(() =>
        contextValidator.validateForMerging(validContext, validOverlay)
      ).not.toThrow();
    });

    it('should throw error for invalid base context', () => {
      const invalidBase = { ...validContext };
      delete invalidBase.actorEntity;

      expect(() =>
        contextValidator.validateForMerging(invalidBase, null)
      ).toThrow(
        '[CRITICAL] Context is missing required properties: actorEntity'
      );
    });

    it('should throw error for invalid overlay context', () => {
      const invalidOverlay = { actorEntity: { name: 'no-id' } };

      expect(() =>
        contextValidator.validateForMerging(validContext, invalidOverlay)
      ).toThrow('[CRITICAL] actorEntity must have an id property');
    });
  });

  describe('_validatePartialContext', () => {
    it('should throw error for non-object context', () => {
      expect(() =>
        contextValidator._validatePartialContext('not an object')
      ).toThrow('[CRITICAL] Overlay context must be an object');
    });

    it('should validate actorEntity when present', () => {
      const partialContext = { actorEntity: { name: 'no-id' } };

      expect(() =>
        contextValidator._validatePartialContext(partialContext)
      ).toThrow('[CRITICAL] actorEntity must have an id property');
    });

    it('should validate runtimeCtx when present', () => {
      const partialContext = { runtimeCtx: 'not an object' };

      expect(() =>
        contextValidator._validatePartialContext(partialContext)
      ).toThrow('[CRITICAL] runtimeCtx must be an object');
    });

    it('should validate dispatcher when present', () => {
      const partialContext = { dispatcher: { notResolve: jest.fn() } };

      expect(() =>
        contextValidator._validatePartialContext(partialContext)
      ).toThrow('[CRITICAL] dispatcher must have a resolve method');
    });

    it('should validate depth when present', () => {
      const partialContext = { depth: -1 };

      expect(() =>
        contextValidator._validatePartialContext(partialContext)
      ).toThrow('[CRITICAL] depth must be a non-negative number');
    });

    it('should not throw for valid partial context', () => {
      const validPartialContext = {
        actorEntity: { id: 'actor123' },
        depth: 1,
        customProp: 'test',
      };

      expect(() =>
        contextValidator._validatePartialContext(validPartialContext)
      ).not.toThrow();
    });

    it('should not throw for empty object', () => {
      expect(() => contextValidator._validatePartialContext({})).not.toThrow();
    });
  });

  describe('_findMissingCriticalProperties', () => {
    it('should return empty array for context with all properties', () => {
      const missing =
        contextValidator._findMissingCriticalProperties(validContext);
      expect(missing).toEqual([]);
    });

    it('should return missing properties', () => {
      const contextWithMissing = { ...validContext };
      delete contextWithMissing.actorEntity;
      delete contextWithMissing.dispatcher;

      const missing =
        contextValidator._findMissingCriticalProperties(contextWithMissing);
      expect(missing).toEqual(['actorEntity', 'dispatcher']);
    });

    it('should work with custom critical properties', () => {
      const customValidator = new ContextValidator(['prop1', 'prop2']);
      const contextWithCustom = { prop1: 'value1' };

      const missing =
        customValidator._findMissingCriticalProperties(contextWithCustom);
      expect(missing).toEqual(['prop2']);
    });
  });

  describe('hasAllCriticalProperties', () => {
    it('should return true for context with all properties', () => {
      expect(contextValidator.hasAllCriticalProperties(validContext)).toBe(
        true
      );
    });

    it('should return false for context missing properties', () => {
      const contextWithMissing = { ...validContext };
      delete contextWithMissing.actorEntity;

      expect(
        contextValidator.hasAllCriticalProperties(contextWithMissing)
      ).toBe(false);
    });
  });

  describe('getCriticalProperties', () => {
    it('should return copy of critical properties array', () => {
      const properties = contextValidator.getCriticalProperties();
      expect(properties).toEqual([
        'actorEntity',
        'runtimeCtx',
        'dispatcher',
        'cycleDetector',
        'depthGuard',
      ]);

      // Should be a copy, not reference
      properties.push('newProp');
      expect(contextValidator.getCriticalProperties()).not.toContain('newProp');
    });
  });

  describe('withCriticalProperties', () => {
    it('should create validator with custom properties', () => {
      const customProperties = ['custom1', 'custom2'];
      const customValidator =
        ContextValidator.withCriticalProperties(customProperties);

      expect(customValidator.getCriticalProperties()).toEqual(customProperties);
    });

    it('should create independent validator instance', () => {
      const customValidator = ContextValidator.withCriticalProperties([
        'custom1',
      ]);

      expect(customValidator).toBeInstanceOf(ContextValidator);
      expect(customValidator).not.toBe(contextValidator);
    });
  });

  describe('edge cases', () => {
    it('should handle context with null properties', () => {
      const contextWithNulls = {
        ...validContext,
        actorEntity: null,
        runtimeCtx: null,
      };

      expect(() => contextValidator.validate(contextWithNulls)).toThrow(
        '[CRITICAL] Context is missing required properties: actorEntity, runtimeCtx'
      );
    });

    it('should handle context with undefined properties', () => {
      const contextWithUndefined = {
        ...validContext,
        actorEntity: undefined,
        dispatcher: undefined,
      };

      expect(() => contextValidator.validate(contextWithUndefined)).toThrow(
        '[CRITICAL] Context is missing required properties: actorEntity, dispatcher'
      );
    });

    it('should handle actorEntity with id as empty string', () => {
      const contextWithEmptyId = {
        ...validContext,
        actorEntity: { id: '' },
      };

      // Empty string is still a valid id
      expect(() => contextValidator.validate(contextWithEmptyId)).not.toThrow();
    });

    it('should handle dispatcher with resolve as non-function', () => {
      const contextWithInvalidResolve = {
        ...validContext,
        dispatcher: { resolve: 'not a function' },
      };

      expect(() =>
        contextValidator.validate(contextWithInvalidResolve)
      ).toThrow('[CRITICAL] dispatcher must have a resolve method');
    });

    it('should handle cycleDetector with partial methods', () => {
      const contextWithPartialCycleDetector = {
        ...validContext,
        cycleDetector: { enter: jest.fn(), leave: 'not a function' },
      };

      expect(() =>
        contextValidator.validate(contextWithPartialCycleDetector)
      ).toThrow('[CRITICAL] cycleDetector must have enter and leave methods');
    });
  });
});
