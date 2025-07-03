import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('GraphIntegrityValidator', () => {
  let validator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getAllComponentTypesForEntity: jest.fn().mockReturnValue([]),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create validator instance
    validator = new GraphIntegrityValidator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should throw error if entityManager is not provided', () => {
      expect(() => new GraphIntegrityValidator({ logger: mockLogger })).toThrow(
        InvalidArgumentError
      );
    });

    it('should throw error if logger is not provided', () => {
      expect(
        () => new GraphIntegrityValidator({ entityManager: mockEntityManager })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('validateGraph', () => {
    it('should return valid result for empty graph', async () => {
      const result = await validator.validateGraph([], {}, new Set());

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validation passed without issues'
      );
    });

    it('should log error when validation throws exception', async () => {
      const error = new Error('Unexpected error');
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw error;
      });

      const result = await validator.validateGraph(['entity-1'], {}, new Set());

      expect(result.valid).toBe(false);
      // The error will be wrapped by the validation rules that fail
      expect(result.errors.some(e => e.includes('failed: Unexpected error'))).toBe(true);
      // The ValidationRuleChain will log errors for each rule that fails
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log when validation fails with errors', async () => {
      // Setup to trigger missing socket error
      const socketOccupancy = new Set(['parent-1:nonexistent-socket']);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'parent-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'socket-1' }],
            };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1'],
        {},
        socketOccupancy
      );

      expect(result.valid).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validation failed with 1 errors'
      );
    });

    it('should log when validation passes with warnings', async () => {
      // Test with multiple roots which generates warnings
      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockReturnValue(null); // No joints means roots
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const result = await validator.validateGraph(
        ['entity-1', 'entity-2'],
        {},
        new Set()
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Multiple root entities found');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'GraphIntegrityValidator: Validation passed with 1 warnings'
      );
    });
  });

  describe('validateSocketLimits', () => {
    it('should validate socket occupancy exists', async () => {
      const socketOccupancy = new Set(['parent-1:socket-1']);

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'parent-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'socket-1' }],
            };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1'],
        {},
        socketOccupancy
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error when socket not found', async () => {
      const socketOccupancy = new Set(['parent-1:missing-socket']);

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'parent-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'other-socket' }],
            };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1'],
        {},
        socketOccupancy
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Socket 'missing-socket' not found on entity 'parent-1'"
      );
    });
  });

  describe('validateRecipeConstraints', () => {
    it('should skip validation if recipe has no constraints', async () => {
      const recipe = {}; // No constraints

      const result = await validator.validateGraph(
        ['entity-1'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(true);
    });

    it('should validate requires constraints - success', async () => {
      const recipe = {
        constraints: {
          requires: [['tag-1', 'tag-2']],
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockReturnValue(null);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'tag-1',
        'tag-2',
      ]);

      const result = await validator.validateGraph(
        ['entity-1'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(true);
    });

    it('should validate requires constraints - failure', async () => {
      const recipe = {
        constraints: {
          requires: [
            {
              components: ['tag-1', 'tag-2'],
              partTypes: ['special'],
            },
          ],
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'special' };
          }
          return null;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'tag-1', // Only has tag-1, missing tag-2
      ]);

      const result = await validator.validateGraph(
        ['entity-1'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(false);
      // The RecipeConstraintEvaluator provides more detailed error messages
      expect(result.errors.some(e => e.includes('Required constraint not satisfied'))).toBe(true);
    });

    it('should validate excludes constraints - success', async () => {
      const recipe = {
        constraints: {
          excludes: [['tag-1', 'tag-2']],
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockReturnValue(null);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'tag-1', // Only has one of the excluded tags
      ]);

      const result = await validator.validateGraph(
        ['entity-1'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(true);
    });

    it('should validate excludes constraints - failure', async () => {
      const recipe = {
        constraints: {
          excludes: [
            {
              components: ['tag-1', 'tag-2'],
            },
          ],
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockReturnValue(null);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'tag-1',
        'tag-2', // Has both excluded tags
      ]);

      const result = await validator.validateGraph(
        ['entity-1'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Exclusion constraint violated'))).toBe(true);
    });

    it('should validate part type constraints with anatomy:part', async () => {
      const recipe = {
        constraints: {
          requires: [['arm', 'hand']],
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:part') {
            if (entityId === 'entity-1') return { subType: 'arm' };
            if (entityId === 'entity-2') return { subType: 'hand' };
          }
          return null;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const result = await validator.validateGraph(
        ['entity-1', 'entity-2'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(true);
    });

    it('should error about exact count mismatch', async () => {
      const recipe = {
        slots: {
          arm: {
            type: 'arm',
            count: { exact: 2 },
          },
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:part' && entityId === 'entity-1') {
            return { subType: 'arm' };
          }
          return null;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const result = await validator.validateGraph(
        ['entity-1'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("expected exactly 2 parts of type 'arm'"))).toBe(true);
    });

    it('should error about min count not met', async () => {
      const recipe = {
        slots: {
          arm: {
            type: 'arm',
            count: { min: 2 },
          },
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:part' && entityId === 'entity-1') {
            return { subType: 'arm' };
          }
          return null;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const result = await validator.validateGraph(
        ['entity-1'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("expected at least 2 parts of type 'arm'"))).toBe(true);
    });

    it('should error about max count exceeded', async () => {
      const recipe = {
        slots: {
          arm: {
            type: 'arm',
            count: { max: 1 },
          },
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          return null;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const result = await validator.validateGraph(
        ['entity-1', 'entity-2'],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("expected at most 1 parts of type 'arm'"))).toBe(true);
    });
  });

  describe('validateNoCycles', () => {
    it('should pass for acyclic graph', async () => {
      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (entityId === 'child-1')
              return {
                parentId: 'parent-1',
                socketId: 'socket-1',
                jointType: 'fixed',
              };
            if (entityId === 'child-2')
              return {
                parentId: 'parent-1',
                socketId: 'socket-2',
                jointType: 'fixed',
              };
          }
          if (componentId === 'anatomy:sockets' && entityId === 'parent-1') {
            return {
              sockets: [
                { id: 'socket-1', allowedTypes: ['child'], jointType: 'fixed' },
                { id: 'socket-2', allowedTypes: ['child'], jointType: 'fixed' },
              ],
            };
          }
          if (componentId === 'anatomy:part') {
            return { subType: 'child' };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1', 'child-1', 'child-2'],
        {},
        new Set()
      );

      expect(result.valid).toBe(true);
    });

    it('should detect direct cycle', async () => {
      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (entityId === 'entity-1')
              return {
                parentId: 'entity-2',
                socketId: 'socket-1',
                jointType: 'fixed',
              };
            if (entityId === 'entity-2')
              return {
                parentId: 'entity-1',
                socketId: 'socket-2',
                jointType: 'fixed',
              };
          }
          if (componentId === 'anatomy:sockets') {
            return {
              sockets: [
                {
                  id: 'socket-1',
                  allowedTypes: ['entity'],
                  jointType: 'fixed',
                },
                {
                  id: 'socket-2',
                  allowedTypes: ['entity'],
                  jointType: 'fixed',
                },
              ],
            };
          }
          if (componentId === 'anatomy:part') {
            return { subType: 'entity' };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['entity-1', 'entity-2'],
        {},
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Cycle detected in anatomy graph'))
      ).toBe(true);
    });

    it('should detect indirect cycle', async () => {
      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (entityId === 'entity-1')
              return {
                parentId: 'entity-3',
                socketId: 'socket-1',
                jointType: 'fixed',
              };
            if (entityId === 'entity-2')
              return {
                parentId: 'entity-1',
                socketId: 'socket-2',
                jointType: 'fixed',
              };
            if (entityId === 'entity-3')
              return {
                parentId: 'entity-2',
                socketId: 'socket-3',
                jointType: 'fixed',
              };
          }
          if (componentId === 'anatomy:sockets') {
            return {
              sockets: [
                {
                  id: 'socket-1',
                  allowedTypes: ['entity'],
                  jointType: 'fixed',
                },
                {
                  id: 'socket-2',
                  allowedTypes: ['entity'],
                  jointType: 'fixed',
                },
                {
                  id: 'socket-3',
                  allowedTypes: ['entity'],
                  jointType: 'fixed',
                },
              ],
            };
          }
          if (componentId === 'anatomy:part') {
            return { subType: 'entity' };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['entity-1', 'entity-2', 'entity-3'],
        {},
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Cycle detected'))).toBe(
        true
      );
    });
  });

  describe('validateJointConsistency', () => {
    it('should pass for valid joints', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'child-1' && componentId === 'anatomy:joint') {
            return {
              parentId: 'parent-1',
              socketId: 'socket-1',
              jointType: 'ball',
            };
          }
          if (entityId === 'parent-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'socket-1', jointType: 'ball' }],
            };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1', 'child-1'],
        {},
        new Set()
      );

      expect(result.valid).toBe(true);
    });

    it('should error for non-existent parent', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'child-1' && componentId === 'anatomy:joint') {
            return { parentId: 'missing-parent', socketId: 'socket-1' };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(['child-1'], {}, new Set());

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Entity 'child-1' has joint referencing non-existent parent 'missing-parent'"
      );
    });

    it('should error for non-existent socket', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'child-1' && componentId === 'anatomy:joint') {
            return { parentId: 'parent-1', socketId: 'missing-socket' };
          }
          if (entityId === 'parent-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'other-socket' }],
            };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1', 'child-1'],
        {},
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Entity 'child-1' attached to non-existent socket 'missing-socket' on parent 'parent-1'"
      );
    });
  });

  describe('validateNoOrphans', () => {
    it('should not warn for connected parts', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'child-1' && componentId === 'anatomy:joint') {
            return { parentId: 'parent-1', socketId: 'socket-1' };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1', 'child-1'],
        {},
        new Set()
      );

      expect(result.warnings).toEqual([]);
    });

    it('should error for orphaned parts', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'orphan-1' && componentId === 'anatomy:joint') {
            return { parentId: 'missing-parent', socketId: 'socket-1' };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(['orphan-1'], {}, new Set());

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Orphaned part 'orphan-1' has parent 'missing-parent' not in graph"
      );
    });
  });

  describe('validatePartTypeCompatibility', () => {
    it('should pass for compatible part types', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'arm-1' && componentId === 'anatomy:joint') {
            return { parentId: 'torso-1', socketId: 'shoulder' };
          }
          if (entityId === 'arm-1' && componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'shoulder', allowedTypes: ['arm', 'wing'] }],
            };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['torso-1', 'arm-1'],
        {},
        new Set()
      );

      expect(result.valid).toBe(true);
    });

    it('should error for incompatible part types', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'leg-1' && componentId === 'anatomy:joint') {
            return { parentId: 'torso-1', socketId: 'shoulder' };
          }
          if (entityId === 'leg-1' && componentId === 'anatomy:part') {
            return { subType: 'leg' };
          }
          if (entityId === 'torso-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'shoulder', allowedTypes: ['arm', 'wing'] }],
            };
          }
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['torso-1', 'leg-1'],
        {},
        new Set()
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Part type 'leg' not allowed in socket 'shoulder' on entity 'torso-1'"
      );
    });

    it('should skip validation for missing data', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'part-1' && componentId === 'anatomy:joint') {
            return {
              parentId: 'parent-1',
              socketId: 'socket-1',
              jointType: 'fixed',
            };
          }
          if (entityId === 'parent-1' && componentId === 'anatomy:sockets') {
            return {
              sockets: [{ id: 'socket-1', allowedTypes: ['any'] }],
            };
          }
          // No anatomy:part component
          return null;
        }
      );

      const result = await validator.validateGraph(
        ['parent-1', 'part-1'],
        {},
        new Set()
      );

      expect(result.valid).toBe(true); // Should not error on missing data
    });
  });
});
