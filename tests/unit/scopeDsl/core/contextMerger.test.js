// tests/unit/scopeDsl/core/contextMerger.test.js

import { jest } from '@jest/globals';
import ContextMerger from '../../../../src/scopeDsl/core/contextMerger.js';
import ContextValidator from '../../../../src/scopeDsl/core/contextValidator.js';

describe('ContextMerger', () => {
  let contextMerger;
  let mockValidator;
  let mockBaseCtx;
  let mockOverlayCtx;
  let mockActorEntity;
  let mockRuntimeCtx;
  let mockDispatcher;
  let mockCycleDetector;
  let mockDepthGuard;

  beforeEach(() => {
    // Create mock objects
    mockActorEntity = { id: 'actor123' };
    mockRuntimeCtx = { entityManager: {}, location: { id: 'loc1' } };
    mockDispatcher = { resolve: jest.fn() };
    mockCycleDetector = { enter: jest.fn(), leave: jest.fn() };
    mockDepthGuard = { ensure: jest.fn() };

    mockBaseCtx = {
      actorEntity: mockActorEntity,
      runtimeCtx: mockRuntimeCtx,
      dispatcher: mockDispatcher,
      cycleDetector: mockCycleDetector,
      depthGuard: mockDepthGuard,
      depth: 0,
      trace: { addLog: jest.fn() },
    };

    mockOverlayCtx = {
      depth: 1,
      customProp: 'test-value',
    };

    mockValidator = {
      validateForMerging: jest.fn(),
      validate: jest.fn(),
    };

    contextMerger = new ContextMerger(undefined, mockValidator);
  });

  describe('constructor', () => {
    it('should use default critical properties when none provided', () => {
      const merger = new ContextMerger();
      const expectedProperties = [
        'actorEntity',
        'runtimeCtx',
        'dispatcher',
        'cycleDetector',
        'depthGuard',
      ];
      expect(merger.getCriticalProperties()).toEqual(expectedProperties);
    });

    it('should use custom critical properties when provided', () => {
      const customProperties = ['prop1', 'prop2'];
      const merger = new ContextMerger(customProperties);
      expect(merger.getCriticalProperties()).toEqual(customProperties);
    });

    it('should create default validator when none provided', () => {
      const merger = new ContextMerger();
      expect(merger.getValidator()).toBeInstanceOf(ContextValidator);
    });

    it('should use provided validator', () => {
      const merger = new ContextMerger(undefined, mockValidator);
      expect(merger.getValidator()).toBe(mockValidator);
    });
  });

  describe('merge', () => {
    it('should validate inputs before merging', () => {
      contextMerger.merge(mockBaseCtx, mockOverlayCtx);
      expect(mockValidator.validateForMerging).toHaveBeenCalledWith(
        mockBaseCtx,
        mockOverlayCtx
      );
    });

    it('should return copy of base context when overlay is null', () => {
      const result = contextMerger.merge(mockBaseCtx, null);
      expect(result).toEqual(mockBaseCtx);
      expect(result).not.toBe(mockBaseCtx); // Should be a copy
    });

    it('should return copy of base context when overlay is undefined', () => {
      const result = contextMerger.merge(mockBaseCtx, undefined);
      expect(result).toEqual(mockBaseCtx);
      expect(result).not.toBe(mockBaseCtx); // Should be a copy
    });

    it('should merge non-critical properties from overlay', () => {
      const result = contextMerger.merge(mockBaseCtx, mockOverlayCtx);
      expect(result.customProp).toBe('test-value');
    });

    it('should preserve critical properties from base context', () => {
      const result = contextMerger.merge(mockBaseCtx, mockOverlayCtx);
      expect(result.actorEntity).toBe(mockActorEntity);
      expect(result.runtimeCtx).toBe(mockRuntimeCtx);
      expect(result.dispatcher).toBe(mockDispatcher);
      expect(result.cycleDetector).toBe(mockCycleDetector);
      expect(result.depthGuard).toBe(mockDepthGuard);
    });

    it('should override critical properties with overlay values when provided', () => {
      const overlayActor = { id: 'overlay-actor' };
      const overlayWithCritical = {
        ...mockOverlayCtx,
        actorEntity: overlayActor,
      };

      const result = contextMerger.merge(mockBaseCtx, overlayWithCritical);
      expect(result.actorEntity).toBe(overlayActor);
    });

    it('should handle depth merging correctly', () => {
      const result = contextMerger.merge(mockBaseCtx, mockOverlayCtx);
      expect(result.depth).toBe(1); // Max of overlay (1) and base+1 (0+1)
    });

    it('should handle depth merging when overlay has no depth', () => {
      const overlayWithoutDepth = { customProp: 'test' };
      const result = contextMerger.merge(mockBaseCtx, overlayWithoutDepth);
      expect(result.depth).toBe(1); // base depth (0) + 1
    });

    it('should handle depth merging when base has no depth', () => {
      const baseWithoutDepth = { ...mockBaseCtx };
      delete baseWithoutDepth.depth;

      const result = contextMerger.merge(baseWithoutDepth, mockOverlayCtx);
      expect(result.depth).toBe(1); // Max of overlay (1) and default (1)
    });

    it('should preserve trace from overlay when available', () => {
      const overlayTrace = { addLog: jest.fn(), id: 'overlay-trace' };
      const overlayWithTrace = {
        ...mockOverlayCtx,
        trace: overlayTrace,
      };

      const result = contextMerger.merge(mockBaseCtx, overlayWithTrace);
      expect(result.trace).toBe(overlayTrace);
    });

    it('should preserve trace from base when overlay has no trace', () => {
      const result = contextMerger.merge(mockBaseCtx, mockOverlayCtx);
      expect(result.trace).toBe(mockBaseCtx.trace);
    });

    it('should validate final merged context', () => {
      const result = contextMerger.merge(mockBaseCtx, mockOverlayCtx);
      expect(mockValidator.validate).toHaveBeenCalledWith(result);
    });

    it('should not skip critical properties during non-critical merge', () => {
      const overlayWithCritical = {
        actorEntity: { id: 'new-actor' },
        dispatcher: { resolve: jest.fn() },
        customProp: 'test',
      };

      const result = contextMerger.merge(mockBaseCtx, overlayWithCritical);

      // Critical properties should be handled explicitly, not in non-critical merge
      expect(result.actorEntity).toBe(overlayWithCritical.actorEntity);
      expect(result.dispatcher).toBe(overlayWithCritical.dispatcher);
      expect(result.customProp).toBe('test');
    });

    it('should handle all base properties being preserved', () => {
      const baseWithExtra = {
        ...mockBaseCtx,
        baseProp: 'base-value',
        anotherProp: 42,
      };

      const result = contextMerger.merge(baseWithExtra, mockOverlayCtx);
      expect(result.baseProp).toBe('base-value');
      expect(result.anotherProp).toBe(42);
    });
  });

  describe('_mergeNonCriticalProperties', () => {
    it('should filter out critical properties', () => {
      const overlayWithMixed = {
        actorEntity: { id: 'should-be-filtered' },
        dispatcher: { resolve: jest.fn() },
        customProp: 'should-be-kept',
        anotherProp: 'also-kept',
      };

      const result =
        contextMerger._mergeNonCriticalProperties(overlayWithMixed);
      expect(result.actorEntity).toBeUndefined();
      expect(result.dispatcher).toBeUndefined();
      expect(result.customProp).toBe('should-be-kept');
      expect(result.anotherProp).toBe('also-kept');
    });

    it('should return empty object when all properties are critical', () => {
      const onlyCritical = {
        actorEntity: mockActorEntity,
        runtimeCtx: mockRuntimeCtx,
        dispatcher: mockDispatcher,
      };

      const result = contextMerger._mergeNonCriticalProperties(onlyCritical);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('_mergeCriticalProperties', () => {
    it('should prefer overlay values when present', () => {
      const overlayActor = { id: 'overlay-actor' };
      const overlayCtx = { actorEntity: overlayActor };

      const result = contextMerger._mergeCriticalProperties(
        mockBaseCtx,
        overlayCtx
      );
      expect(result.actorEntity).toBe(overlayActor);
    });

    it('should fallback to base values when overlay values are missing', () => {
      const emptyOverlay = {};

      const result = contextMerger._mergeCriticalProperties(
        mockBaseCtx,
        emptyOverlay
      );
      expect(result.actorEntity).toBe(mockActorEntity);
      expect(result.runtimeCtx).toBe(mockRuntimeCtx);
      expect(result.dispatcher).toBe(mockDispatcher);
    });

    it('should handle custom critical properties', () => {
      const customMerger = new ContextMerger(['prop1', 'prop2'], mockValidator);
      const baseCtx = { prop1: 'base1', prop2: 'base2' };
      const overlayCtx = { prop1: 'overlay1' };

      const result = customMerger._mergeCriticalProperties(baseCtx, overlayCtx);
      expect(result.prop1).toBe('overlay1');
      expect(result.prop2).toBe('base2');
    });
  });

  describe('_mergeDepth', () => {
    it('should return max of overlay depth and base depth + 1', () => {
      const baseCtx = { depth: 2 };
      const overlayCtx = { depth: 1 };

      const result = contextMerger._mergeDepth(baseCtx, overlayCtx);
      expect(result).toBe(3); // Max of 1 and 2+1
    });

    it('should handle missing overlay depth', () => {
      const baseCtx = { depth: 2 };
      const overlayCtx = {};

      const result = contextMerger._mergeDepth(baseCtx, overlayCtx);
      expect(result).toBe(3); // Max of 0 and 2+1
    });

    it('should handle missing base depth', () => {
      const baseCtx = {};
      const overlayCtx = { depth: 2 };

      const result = contextMerger._mergeDepth(baseCtx, overlayCtx);
      expect(result).toBe(2); // Max of 2 and 1
    });

    it('should handle both depths missing', () => {
      const baseCtx = {};
      const overlayCtx = {};

      const result = contextMerger._mergeDepth(baseCtx, overlayCtx);
      expect(result).toBe(1); // Max of 0 and 1
    });
  });

  describe('getCriticalProperties', () => {
    it('should return copy of critical properties array', () => {
      const properties = contextMerger.getCriticalProperties();
      expect(properties).toEqual([
        'actorEntity',
        'runtimeCtx',
        'dispatcher',
        'cycleDetector',
        'depthGuard',
      ]);

      // Should be a copy, not reference
      properties.push('newProp');
      expect(contextMerger.getCriticalProperties()).not.toContain('newProp');
    });
  });

  describe('getValidator', () => {
    it('should return the validator instance', () => {
      expect(contextMerger.getValidator()).toBe(mockValidator);
    });
  });

  describe('error handling', () => {
    it('should propagate validation errors from validateForMerging', () => {
      const validationError = new Error('Validation failed');
      mockValidator.validateForMerging.mockImplementation(() => {
        throw validationError;
      });

      expect(() => contextMerger.merge(mockBaseCtx, mockOverlayCtx)).toThrow(
        validationError
      );
    });

    it('should propagate validation errors from final validation', () => {
      const validationError = new Error('Final validation failed');
      mockValidator.validate.mockImplementation(() => {
        throw validationError;
      });

      expect(() => contextMerger.merge(mockBaseCtx, mockOverlayCtx)).toThrow(
        validationError
      );
    });
  });

  describe('integration with real validator', () => {
    it('should work with real ContextValidator instance', () => {
      const realMerger = new ContextMerger();
      const result = realMerger.merge(mockBaseCtx, mockOverlayCtx);

      expect(result.actorEntity).toBe(mockActorEntity);
      expect(result.customProp).toBe('test-value');
      expect(result.depth).toBe(1);
    });
  });
});
