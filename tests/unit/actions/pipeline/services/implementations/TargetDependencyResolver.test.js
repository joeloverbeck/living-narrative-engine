import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TargetDependencyResolver } from '../../../../../../src/actions/pipeline/services/implementations/TargetDependencyResolver.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { createMockLogger } from '../../../../../common/mockFactories/loggerMocks.js';

describe('TargetDependencyResolver', () => {
  let mockLogger;
  let resolver;

  beforeEach(() => {
    mockLogger = createMockLogger();
    resolver = new TargetDependencyResolver({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getResolutionOrder', () => {
    it('should resolve simple dependencies', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
        },
        secondary: {
          scope: 'primary.items',
          placeholder: 'secondary_target',
          contextFrom: 'primary',
        },
      };

      const order = resolver.getResolutionOrder(targetDefs);
      expect(order).toEqual(['primary', 'secondary']);
    });

    it('should detect circular dependencies', () => {
      const targetDefs = {
        primary: {
          scope: 'secondary.items',
          placeholder: 'primary_target',
          contextFrom: 'secondary',
        },
        secondary: {
          scope: 'primary.items',
          placeholder: 'secondary_target',
          contextFrom: 'primary',
        },
      };

      expect(() => resolver.getResolutionOrder(targetDefs)).toThrow(
        'Circular dependency detected'
      );
    });

    it('should handle complex dependency chains', () => {
      const targetDefs = {
        root: {
          scope: 'actor.partners',
          placeholder: 'root',
        },
        level1a: {
          scope: 'root.items',
          placeholder: 'level1a',
          contextFrom: 'root',
        },
        level1b: {
          scope: 'root.followers',
          placeholder: 'level1b',
          contextFrom: 'root',
        },
        level2: {
          scope: 'level1a.equipment',
          placeholder: 'level2',
          contextFrom: 'level1a',
        },
      };

      const order = resolver.getResolutionOrder(targetDefs);
      expect(order).toEqual(['root', 'level1a', 'level1b', 'level2']);
    });

    it('should handle targets with no dependencies', () => {
      const targetDefs = {
        independent1: {
          scope: 'actor.items',
          placeholder: 'ind1',
        },
        independent2: {
          scope: 'actor.followers',
          placeholder: 'ind2',
        },
      };

      const order = resolver.getResolutionOrder(targetDefs);
      expect(order).toHaveLength(2);
      expect(order).toContain('independent1');
      expect(order).toContain('independent2');
    });

    it('should handle empty input', () => {
      const order = resolver.getResolutionOrder({});
      expect(order).toEqual([]);
    });

    it('should throw error for invalid input', () => {
      expect(() => resolver.getResolutionOrder(null)).toThrow(ServiceError);

      expect(() => resolver.getResolutionOrder('invalid')).toThrow(
        ServiceError
      );
    });

    it('should handle mixed dependent and independent targets', () => {
      const targetDefs = {
        independent: {
          scope: 'actor.items',
          placeholder: 'independent',
        },
        parent: {
          scope: 'actor.partners',
          placeholder: 'parent',
        },
        child: {
          scope: 'parent.items',
          placeholder: 'child',
          contextFrom: 'parent',
        },
      };

      const order = resolver.getResolutionOrder(targetDefs);
      expect(order).toHaveLength(3);
      expect(order.indexOf('parent')).toBeLessThan(order.indexOf('child'));
    });

    it('should handle deep dependency chain', () => {
      const targetDefs = {
        a: { scope: 'actor', placeholder: 'a' },
        b: { scope: 'a.items', placeholder: 'b', contextFrom: 'a' },
        c: { scope: 'b.items', placeholder: 'c', contextFrom: 'b' },
        d: { scope: 'c.items', placeholder: 'd', contextFrom: 'c' },
        e: { scope: 'd.items', placeholder: 'e', contextFrom: 'd' },
      };

      const order = resolver.getResolutionOrder(targetDefs);
      expect(order).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('should detect three-way circular dependency', () => {
      const targetDefs = {
        a: { scope: 'b.items', placeholder: 'a', contextFrom: 'b' },
        b: { scope: 'c.items', placeholder: 'b', contextFrom: 'c' },
        c: { scope: 'a.items', placeholder: 'c', contextFrom: 'a' },
      };

      expect(() => resolver.getResolutionOrder(targetDefs)).toThrow(
        ServiceError
      );
      expect(() => resolver.getResolutionOrder(targetDefs)).toThrow(
        /Circular dependency detected/
      );
    });

    it('should validate target definitions before sorting', () => {
      const targetDefs = {
        invalid: {
          // Missing required fields
        },
      };

      expect(() => resolver.getResolutionOrder(targetDefs)).toThrow(
        /Invalid target definitions/
      );
    });
  });

  describe('validateDependencies', () => {
    it('should validate correct definitions', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
          description: 'Primary target',
        },
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const targetDefs = {
        invalid: {
          // missing scope and placeholder
        },
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Target 'invalid' must have a valid scope string"
      );
      expect(result.errors).toContain(
        "Target 'invalid' must have a valid placeholder string"
      );
    });

    it('should detect invalid contextFrom references', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
          contextFrom: 'nonexistent',
        },
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Target 'primary' references unknown contextFrom: 'nonexistent'"
      );
    });

    it('should detect self-referencing contextFrom', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
          contextFrom: 'primary',
        },
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Target 'primary' cannot reference itself in contextFrom"
      );
    });

    it('should handle null input', () => {
      const result = resolver.validateDependencies(null);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Target definitions must be a non-null object'
      );
    });

    it('should validate target is an object', () => {
      const targetDefs = {
        invalid: 'not an object',
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(false);
      expect(result.errors).toContain("Target 'invalid' must be an object");
    });

    it('should validate contextFrom is a string', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
          contextFrom: 123,
        },
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Target 'primary' contextFrom must be a string"
      );
    });

    it('should provide warnings for invalid optional fields', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
          description: 123, // Should be string
        },
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(true); // Optional fields don't fail validation
      expect(result.warnings).toContain(
        "Target 'primary' description should be a string"
      );
    });

    it('should handle completely valid complex definitions', () => {
      const targetDefs = {
        root: {
          scope: 'actor.partners',
          placeholder: 'root_target',
          description: 'Root target',
          optional: false,
        },
        child: {
          scope: 'root.items',
          placeholder: 'child_target',
          description: 'Child target',
          contextFrom: 'root',
          optional: true,
        },
      };

      const result = resolver.validateDependencies(targetDefs);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('getDependencyGraph', () => {
    it('should return dependency information for all targets', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
        },
        secondary: {
          scope: 'primary.items',
          placeholder: 'secondary_target',
          contextFrom: 'primary',
        },
        tertiary: {
          scope: 'secondary.equipment',
          placeholder: 'tertiary_target',
          contextFrom: 'secondary',
        },
      };

      const graph = resolver.getDependencyGraph(targetDefs);

      expect(graph).toHaveLength(3);
      expect(graph[0]).toEqual({
        targetKey: 'primary',
        dependencies: [],
        isOptional: false,
      });
      expect(graph[1]).toEqual({
        targetKey: 'secondary',
        dependencies: ['primary'],
        isOptional: false,
      });
      expect(graph[2]).toEqual({
        targetKey: 'tertiary',
        dependencies: ['secondary'],
        isOptional: false,
      });
    });

    it('should handle targets with no dependencies', () => {
      const targetDefs = {
        independent: {
          scope: 'actor.items',
          placeholder: 'independent_target',
        },
      };

      const graph = resolver.getDependencyGraph(targetDefs);

      expect(graph).toEqual([
        {
          targetKey: 'independent',
          dependencies: [],
          isOptional: false,
        },
      ]);
    });

    it('should handle invalid contextFrom references gracefully', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
          contextFrom: 'nonexistent', // Invalid reference
        },
      };

      const graph = resolver.getDependencyGraph(targetDefs);

      expect(graph).toEqual([
        {
          targetKey: 'primary',
          dependencies: [], // Empty because contextFrom target doesn't exist
          isOptional: false,
        },
      ]);
    });

    it('should handle missing parameters', () => {
      expect(() => resolver.getDependencyGraph()).toThrow(ServiceError);
    });

    it('should preserve entry order', () => {
      const targetDefs = {
        z: { scope: 'actor.z', placeholder: 'z' },
        a: { scope: 'actor.a', placeholder: 'a' },
        m: { scope: 'actor.m', placeholder: 'm' },
      };

      const graph = resolver.getDependencyGraph(targetDefs);

      expect(graph[0].targetKey).toBe('z');
      expect(graph[1].targetKey).toBe('a');
      expect(graph[2].targetKey).toBe('m');
    });
  });

  describe('hasCircularDependency', () => {
    it('should detect direct circular dependency', () => {
      const targetDefs = {
        primary: {
          scope: 'secondary.items',
          placeholder: 'primary_target',
          contextFrom: 'secondary',
        },
        secondary: {
          scope: 'primary.items',
          placeholder: 'secondary_target',
          contextFrom: 'primary',
        },
      };

      expect(resolver.hasCircularDependency('primary', targetDefs)).toBe(true);
      expect(resolver.hasCircularDependency('secondary', targetDefs)).toBe(
        true
      );
    });

    it('should detect indirect circular dependency', () => {
      const targetDefs = {
        a: {
          scope: 'b.items',
          placeholder: 'a_target',
          contextFrom: 'b',
        },
        b: {
          scope: 'c.items',
          placeholder: 'b_target',
          contextFrom: 'c',
        },
        c: {
          scope: 'a.items',
          placeholder: 'c_target',
          contextFrom: 'a',
        },
      };

      expect(resolver.hasCircularDependency('a', targetDefs)).toBe(true);
      expect(resolver.hasCircularDependency('b', targetDefs)).toBe(true);
      expect(resolver.hasCircularDependency('c', targetDefs)).toBe(true);
    });

    it('should return false for valid dependencies', () => {
      const targetDefs = {
        root: {
          scope: 'actor.partners',
          placeholder: 'root',
        },
        child: {
          scope: 'root.items',
          placeholder: 'child',
          contextFrom: 'root',
        },
      };

      expect(resolver.hasCircularDependency('root', targetDefs)).toBe(false);
      expect(resolver.hasCircularDependency('child', targetDefs)).toBe(false);
    });

    it('should throw error for non-existent target', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
        },
      };

      expect(() =>
        resolver.hasCircularDependency('nonexistent', targetDefs)
      ).toThrow(ServiceError);
      expect(() =>
        resolver.hasCircularDependency('nonexistent', targetDefs)
      ).toThrow("Target 'nonexistent' not found in definitions");
    });

    it('should validate targetKey is non-blank string', () => {
      const targetDefs = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'primary_target',
        },
      };

      expect(() => resolver.hasCircularDependency('', targetDefs)).toThrow(
        ServiceError
      );
      expect(() => resolver.hasCircularDependency(null, targetDefs)).toThrow(
        ServiceError
      );
    });

    it('should handle self-referencing targets', () => {
      const targetDefs = {
        selfish: {
          scope: 'selfish.items',
          placeholder: 'selfish_target',
          contextFrom: 'selfish',
        },
      };

      expect(resolver.hasCircularDependency('selfish', targetDefs)).toBe(true);
    });

    it('should handle targets with no dependencies', () => {
      const targetDefs = {
        independent: {
          scope: 'actor.items',
          placeholder: 'independent_target',
        },
      };

      expect(resolver.hasCircularDependency('independent', targetDefs)).toBe(
        false
      );
    });

    it('should handle invalid contextFrom references', () => {
      const targetDefs = {
        broken: {
          scope: 'actor.items',
          placeholder: 'broken_target',
          contextFrom: 'nonexistent',
        },
      };

      expect(resolver.hasCircularDependency('broken', targetDefs)).toBe(false);
    });

    it('should handle long dependency chains without cycles', () => {
      const targetDefs = {
        a: { scope: 'actor', placeholder: 'a' },
        b: { scope: 'a.items', placeholder: 'b', contextFrom: 'a' },
        c: { scope: 'b.items', placeholder: 'c', contextFrom: 'b' },
        d: { scope: 'c.items', placeholder: 'd', contextFrom: 'c' },
        e: { scope: 'd.items', placeholder: 'e', contextFrom: 'd' },
      };

      expect(resolver.hasCircularDependency('e', targetDefs)).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle maximum iterations protection', () => {
      // Create a scenario that would exceed max iterations
      const targetDefs = {};

      // Create many independent targets that would take many iterations
      for (let i = 0; i < 100; i++) {
        targetDefs[`target_${i}`] = {
          scope: `actor.${i}`,
          placeholder: `target_${i}`,
        };
      }

      // This should complete without hitting max iterations
      const order = resolver.getResolutionOrder(targetDefs);
      expect(order).toHaveLength(100);
    });

    it('should provide detailed error for circular dependencies', () => {
      const targetDefs = {
        a: { scope: 'b.items', placeholder: 'a', contextFrom: 'b' },
        b: { scope: 'a.items', placeholder: 'b', contextFrom: 'a' },
      };

      try {
        resolver.getResolutionOrder(targetDefs);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.code).toBe(ServiceErrorCodes.CIRCULAR_DEPENDENCY);
        expect(error.value).toHaveProperty('dependencyMap');
        expect(error.value).toHaveProperty('remaining');
        expect(error.message).toContain('Dependency chains:');
      }
    });

    it('should wrap unexpected errors in ServiceError with operation failed code', () => {
      const unexpectedError = new Error('Unexpected failure');
      const dependencyValidationSpy = jest
        .spyOn(resolver, 'validateDependencies')
        .mockImplementation(() => {
          throw unexpectedError;
        });

      const targetDefs = {
        primary: { scope: 'actor', placeholder: 'primary' },
      };

      let thrownError;
      try {
        resolver.getResolutionOrder(targetDefs);
      } catch (error) {
        thrownError = error;
      } finally {
        dependencyValidationSpy.mockRestore();
      }

      expect(thrownError).toBeInstanceOf(ServiceError);
      expect(thrownError.code).toBe(ServiceErrorCodes.OPERATION_FAILED);
      expect(thrownError.value).toBe(unexpectedError);
      expect(thrownError.message).toBe(
        `Resolution order calculation failed: ${unexpectedError.message}`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to determine resolution order',
        expect.objectContaining({ error: unexpectedError.message })
      );
    });

    it('should throw an error when resolution exceeds maximum iterations', () => {
      const originalDelete = Set.prototype.delete;
      Set.prototype.delete = () => true; // Prevent pending set from shrinking

      const targetDefs = {
        primary: { scope: 'actor', placeholder: 'primary' },
        secondary: { scope: 'actor', placeholder: 'secondary' },
      };

      let thrownError;
      try {
        resolver.getResolutionOrder(targetDefs);
      } catch (error) {
        thrownError = error;
      } finally {
        Set.prototype.delete = originalDelete;
      }

      expect(thrownError).toBeInstanceOf(ServiceError);
      expect(thrownError.code).toBe(ServiceErrorCodes.OPERATION_FAILED);
      expect(thrownError.message).toContain('exceeded maximum iterations');
      expect(thrownError.value).toEqual(
        expect.objectContaining({
          maxIterations: Object.keys(targetDefs).length * 2,
        })
      );
    });

    it('should analyze dependency chains for unresolved references', () => {
      const targetDefs = {
        a: { scope: 'actor.a', placeholder: 'a', contextFrom: 'missing' },
        b: { scope: 'actor.b', placeholder: 'b', contextFrom: 'a' },
      };

      const dependencyValidationSpy = jest
        .spyOn(resolver, 'validateDependencies')
        .mockReturnValue({ success: true, errors: [], warnings: [] });

      let thrownError;
      try {
        resolver.getResolutionOrder(targetDefs);
      } catch (error) {
        thrownError = error;
      } finally {
        dependencyValidationSpy.mockRestore();
      }

      expect(thrownError).toBeInstanceOf(ServiceError);
      expect(thrownError.code).toBe(ServiceErrorCodes.CIRCULAR_DEPENDENCY);
      expect(thrownError.value.dependencyMap).toEqual({
        a: { fullChain: ['a', 'missing'], cycle: null },
        b: { fullChain: ['b', 'a', 'missing'], cycle: null },
      });
    });

    it('should log operations correctly', () => {
      const targetDefs = {
        primary: { scope: 'actor', placeholder: 'primary' },
      };

      resolver.getResolutionOrder(targetDefs);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('getResolutionOrder'),
        expect.objectContaining({
          targetCount: 1,
          targets: ['primary'],
        })
      );
    });
  });
});
