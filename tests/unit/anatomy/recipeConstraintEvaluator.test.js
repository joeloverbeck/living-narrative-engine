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

      it('should honor minItems for co-presence constraints - should NOT fire with only 1 part type when minItems is 2', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['dragon_wing', 'dragon_tail'],
                components: ['anatomy:flight_membrane'],
                validation: {
                  minItems: 2,
                  errorMessage:
                    'Dragons require both wings and tail for flight',
                },
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        // Only dragon_wing is present, not dragon_tail
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return { subType: 'dragon_wing' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        // Should pass because minItems: 2 requires at least 2 part types
        // Only 1 part type (dragon_wing) is present, so constraint should not apply
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should honor minItems for co-presence constraints - SHOULD fire with 2+ part types when minItems is 2', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['dragon_wing', 'dragon_tail'],
                components: ['anatomy:flight_membrane'],
                validation: {
                  minItems: 2,
                  errorMessage:
                    'Dragons require both wings and tail for flight',
                },
              },
            ],
          },
        };
        const entityIds = ['entity1', 'entity2'];

        // Both dragon_wing and dragon_tail are present
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return entityId === 'entity1'
                ? { subType: 'dragon_wing' }
                : { subType: 'dragon_tail' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        // Should fail because both part types are present but flight_membrane is missing
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(
          'Dragons require both wings and tail for flight'
        );
      });

      it('should default to minItems: 1 when not specified - constraint fires with 1 part type', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head', 'torso'],
                components: ['anatomy:brain'],
              },
            ],
          },
        };
        const entityIds = ['entity1'];

        // Only head is present, not torso
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

        // Should fail because default minItems is 1, so constraint applies
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Required constraint not satisfied');
        expect(result.errors[0]).toContain('has part types [head]');
        expect(result.errors[0]).toContain(
          'missing required components [anatomy:brain]'
        );
      });

      it('should honor minItems: 3 for complex co-presence constraints', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['wing', 'tail', 'beak', 'feathers'],
                components: ['anatomy:flight_capable'],
                validation: {
                  minItems: 3,
                  errorMessage: 'Birds need at least 3 avian features to fly',
                },
              },
            ],
          },
        };
        const entityIds = ['entity1', 'entity2'];

        // Only 2 part types present: wing and tail (not enough for minItems: 3)
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return entityId === 'entity1'
                ? { subType: 'wing' }
                : { subType: 'tail' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        // Should pass because only 2 part types present (less than minItems: 3)
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fire constraint when minItems threshold is met with 3 out of 4 part types', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['wing', 'tail', 'beak', 'feathers'],
                components: ['anatomy:flight_capable'],
                validation: {
                  minItems: 3,
                  errorMessage: 'Birds need at least 3 avian features to fly',
                },
              },
            ],
          },
        };
        const entityIds = ['entity1', 'entity2', 'entity3'];

        // 3 part types present: wing, tail, beak (meets minItems: 3)
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              if (entityId === 'entity1') return { subType: 'wing' };
              if (entityId === 'entity2') return { subType: 'tail' };
              return { subType: 'beak' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'anatomy:part',
        ]);

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        // Should fail because 3 part types present (meets minItems: 3) but missing component
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(
          'Birds need at least 3 avian features to fly'
        );
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

    describe('validation metadata', () => {
      it('should use custom error message from requires constraint validation metadata', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head'],
                components: ['anatomy:brain'],
                validation: {
                  errorMessage:
                    'Dragons require both wings and tail for flight stability',
                },
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
        expect(result.errors[0]).toBe(
          'Dragons require both wings and tail for flight stability'
        );
      });

      it('should use custom error message from excludes constraint validation metadata', () => {
        const recipe = {
          constraints: {
            excludes: [
              {
                components: ['anatomy:wings', 'anatomy:arms'],
                validation: {
                  errorMessage: 'Cannot have both gills and lungs',
                },
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
        expect(result.errors[0]).toBe('Cannot have both gills and lungs');
      });

      it('should log explanation when validation.explanation is provided for requires constraint', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head'],
                components: ['anatomy:brain'],
                validation: {
                  explanation:
                    'Flight mechanics require wing-tail coordination for balance',
                },
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

        evaluator.evaluateConstraints(entityIds, recipe);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Constraint explanation: Flight mechanics require wing-tail coordination for balance'
        );
      });

      it('should log explanation when validation.explanation is provided for excludes constraint', () => {
        const recipe = {
          constraints: {
            excludes: [
              {
                components: ['anatomy:wings', 'anatomy:arms'],
                validation: {
                  explanation:
                    'Choose either aquatic (gills) or terrestrial (lungs)',
                },
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

        evaluator.evaluateConstraints(entityIds, recipe);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Constraint explanation: Choose either aquatic (gills) or terrestrial (lungs)'
        );
      });

      it('should use default error message when validation metadata is not provided', () => {
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

      it('should support both custom error message and explanation together', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['dragon_wing', 'dragon_tail'],
                components: [],
                validation: {
                  minItems: 2,
                  errorMessage:
                    'Co-presence constraint requires at least 2 part types',
                  explanation:
                    'Dragons need both wings and tail for flight balance',
                },
              },
            ],
            excludes: [
              {
                components: ['anatomy:gills', 'anatomy:lungs'],
                validation: {
                  mutuallyExclusive: true,
                  errorMessage: 'Cannot have both gills and lungs',
                  explanation:
                    'Choose either aquatic (gills) or terrestrial (lungs)',
                },
              },
            ],
          },
        };
        const entityIds = ['entity1', 'entity2'];

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'anatomy:part') {
              return entityId === 'entity1'
                ? { subType: 'dragon_wing' }
                : { subType: 'other' };
            }
            return null;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
          (entityId) => {
            return entityId === 'entity1'
              ? ['anatomy:part', 'anatomy:gills']
              : ['anatomy:part', 'anatomy:lungs'];
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe('Cannot have both gills and lungs');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Constraint explanation: Choose either aquatic (gills) or terrestrial (lungs)'
        );
      });

      it('should maintain backward compatibility with constraints without validation metadata', () => {
        const recipe = {
          constraints: {
            requires: [
              {
                partTypes: ['head'],
                components: ['anatomy:brain'],
              },
            ],
            excludes: [
              {
                components: ['anatomy:wings', 'anatomy:arms'],
              },
            ],
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
        mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
          (entityId) => {
            return entityId === 'entity1'
              ? ['anatomy:part', 'anatomy:wings']
              : ['anatomy:part', 'anatomy:arms'];
          }
        );

        const result = evaluator.evaluateConstraints(entityIds, recipe);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain('Required constraint not satisfied');
        expect(result.errors[1]).toContain('Exclusion constraint violated');
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
