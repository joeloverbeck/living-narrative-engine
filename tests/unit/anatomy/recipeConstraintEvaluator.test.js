// tests/unit/anatomy/recipeConstraintEvaluator.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RecipeConstraintEvaluator } from '../../../src/anatomy/recipeConstraintEvaluator.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  createMockEntityManager,
  createMockLogger,
} from '../../common/mockFactories/index.js';

describe('RecipeConstraintEvaluator', () => {
  let mockEntityManager;
  let mockLogger;
  let evaluator;

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();
    mockLogger = createMockLogger();
  });

  describe('constructor', () => {
    it('should throw InvalidArgumentError when entityManager is missing', () => {
      expect(() => {
        new RecipeConstraintEvaluator({ logger: mockLogger });
      }).toThrow(InvalidArgumentError);
      expect(() => {
        new RecipeConstraintEvaluator({ logger: mockLogger });
      }).toThrow('entityManager is required');
    });

    it('should throw InvalidArgumentError when logger is missing', () => {
      expect(() => {
        new RecipeConstraintEvaluator({ entityManager: mockEntityManager });
      }).toThrow(InvalidArgumentError);
      expect(() => {
        new RecipeConstraintEvaluator({ entityManager: mockEntityManager });
      }).toThrow('logger is required');
    });

    it('should construct successfully with all dependencies', () => {
      expect(() => {
        new RecipeConstraintEvaluator({
          entityManager: mockEntityManager,
          logger: mockLogger,
        });
      }).not.toThrow();
    });
  });

  describe('evaluateConstraints', () => {
    beforeEach(() => {
      evaluator = new RecipeConstraintEvaluator({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
    });

    describe('basic functionality', () => {
      it('should return valid result with no constraints', () => {
        const recipe = {};
        const entityIds = ['entity1', 'entity2'];

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result).toEqual({
          valid: true,
          errors: [],
          warnings: [],
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'RecipeConstraintEvaluator: All constraints satisfied'
        );
      });

      it('should log error when constraints fail', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head'],
                components: ['anatomy:brain'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        // Mock entity has head part but no brain component
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'head' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'RecipeConstraintEvaluator: Constraints failed with 1 errors'
        );
      });

      it('should log warning when constraints pass with warnings', () => {
        const recipe = {
          slots: {
            arm: {
              type: 'arm',
              count: { recommended: 2 },
            },
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'arm' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toEqual([
          "Slot 'arm': recommended 2 parts of type 'arm' but found 1",
        ]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'RecipeConstraintEvaluator: Constraints passed with 1 warnings'
        );
      });
    });

    describe('requires constraints', () => {
      it('should pass when required constraints are satisfied', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head'],
                components: ['anatomy:brain', 'anatomy:skull'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'head' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
          'anatomy:brain',
          'anatomy:skull',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail when required components are missing', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head'],
                components: ['anatomy:brain'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'head' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Required constraint not satisfied');
        expect(result.errors[0]).toContain('has part types [head]');
        expect(result.errors[0]).toContain(
          'missing required components [anatomy:brain]'
        );
      });

      it('should handle multiple required part types', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head', 'neck'],
                components: ['anatomy:spine'],
              },
            ],
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return entityId === 'entity1'
                ? { subType: 'head' }
                : { subType: 'neck' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('has part types [head, neck]');
        expect(result.errors[0]).toContain(
          'missing required components [anatomy:spine]'
        );
      });

      it('should skip constraint check when no required part types are present', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['wing'],
                components: ['anatomy:feathers'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'arm' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('excludes constraints', () => {
      it('should pass when no excluded components are present', () => {
        const recipe = {
          constraints: {
            excludes: [
              {
                components: ['anatomy:wings', 'anatomy:arms'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:legs',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should pass when only one excluded component is present', () => {
        const recipe = {
          constraints: {
            excludes: [
              {
                components: ['anatomy:wings', 'anatomy:arms'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:arms',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail when multiple excluded components are present', () => {
        const recipe = {
          constraints: {
            excludes: [
              {
                components: ['anatomy:wings', 'anatomy:arms'],
              },
            ],
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
          (entityId) => {
            return entityId === 'entity1'
              ? ['anatomy:wings']
              : ['anatomy:arms'];
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Exclusion constraint violated');
        expect(result.errors[0]).toContain(
          'mutually exclusive components [anatomy:wings, anatomy:arms]'
        );
      });

      it('should handle array format for excludes constraints', () => {
        const recipe = {
          constraints: {
            excludes: [['anatomy:fur', 'anatomy:scales']],
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
          (entityId) => {
            return entityId === 'entity1'
              ? ['anatomy:fur']
              : ['anatomy:scales'];
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(
          'mutually exclusive components [anatomy:fur, anatomy:scales]'
        );
      });
    });

    describe('slot count constraints', () => {
      it('should pass when exact count matches (number format)', () => {
        const recipe = {
          slots: {
            arm: {
              type: 'arm',
              count: 2,
            },
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'arm' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail when exact count does not match (number format)', () => {
        const recipe = {
          slots: {
            arm: {
              type: 'arm',
              count: 2,
            },
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'arm' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(
          "Slot 'arm': expected exactly 2 parts of type 'arm' but found 1"
        );
      });

      it('should pass when exact count matches (object format)', () => {
        const recipe = {
          slots: {
            head: {
              type: 'head',
              count: { exact: 1 },
            },
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'head' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail when exact count does not match (object format)', () => {
        const recipe = {
          slots: {
            head: {
              type: 'head',
              count: { exact: 1 },
            },
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'head' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toBe(
          "Slot 'head': expected exactly 1 parts of type 'head' but found 2"
        );
      });

      it('should fail when count is below minimum', () => {
        const recipe = {
          slots: {
            leg: {
              type: 'leg',
              count: { min: 2 },
            },
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'leg' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toBe(
          "Slot 'leg': expected at least 2 parts of type 'leg' but found 1"
        );
      });

      it('should fail when count exceeds maximum', () => {
        const recipe = {
          slots: {
            eye: {
              type: 'eye',
              count: { max: 2 },
            },
          },
        };
        const entityIds = ['entity1', 'entity2', 'entity3'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'eye' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toBe(
          "Slot 'eye': expected at most 2 parts of type 'eye' but found 3"
        );
      });

      it('should pass when count is within min/max range', () => {
        const recipe = {
          slots: {
            finger: {
              type: 'finger',
              count: { min: 8, max: 10 },
            },
          },
        };
        const entityIds = Array.from({ length: 9 }, (_, i) => `entity${i + 1}`);

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'finger' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle missing part types with count of 0', () => {
        const recipe = {
          slots: {
            wing: {
              type: 'wing',
              count: 0,
            },
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'arm' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle partType alias for type in slot definition', () => {
        const recipe = {
          slots: {
            tail: {
              partType: 'tail', // using partType instead of type
              count: 1,
            },
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'tail' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should record warnings when recommended count does not match and no errors exist', () => {
        const recipe = {
          slots: {
            tail: {
              type: 'tail',
              count: { recommended: 1 },
            },
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'tail' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toEqual([
          "Slot 'tail': recommended 1 parts of type 'tail' but found 2",
        ]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'RecipeConstraintEvaluator: Constraints passed with 1 warnings'
        );
      });
    });

    describe('complex scenarios', () => {
      it('should handle multiple constraint types together', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['torso'],
                components: ['anatomy:spine'],
              },
            ],
            excludes: [
              {
                components: ['anatomy:exoskeleton', 'anatomy:endoskeleton'],
              },
            ],
          },
          slots: {
            arm: {
              type: 'arm',
              count: { min: 2, max: 4 },
            },
          },
        };
        const entityIds = ['entity1', 'entity2', 'entity3'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              if (entityId === 'entity1') return { subType: 'torso' };
              return { subType: 'arm' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
          (entityId) => {
            if (entityId === 'entity1') {
              return ['anatomy:part', 'anatomy:spine', 'anatomy:endoskeleton'];
            }
            return ['anatomy:part'];
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle entities with no anatomy:part component', () => {
        const recipe = {
          slots: {
            head: {
              type: 'head',
              count: 1,
            },
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part' && entityId === 'entity1') {
              return { subType: 'head' };
            }
            return null;
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle entities with no components at all', () => {
        const recipe = {
          constraints: {
            excludes: [
              {
                components: ['anatomy:forbidden'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(null);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});
