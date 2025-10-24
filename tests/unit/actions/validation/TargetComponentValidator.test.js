/**
 * @file Unit tests for TargetComponentValidator
 * @see src/actions/validation/TargetComponentValidator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetComponentValidator } from '../../../../src/actions/validation/TargetComponentValidator.js';

describe('TargetComponentValidator', () => {
  let validator;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
      getAllComponentTypesForEntity: jest.fn()
    };

    validator = new TargetComponentValidator({
      logger: mockLogger,
      entityManager: mockEntityManager
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(validator).toBeInstanceOf(TargetComponentValidator);
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new TargetComponentValidator({
          logger: null,
          entityManager: mockEntityManager
        });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new TargetComponentValidator({
          logger: mockLogger,
          entityManager: null
        });
      }).toThrow('Missing required dependency: IEntityManager');
    });

    it('should throw error when logger lacks required methods', () => {
      expect(() => {
        new TargetComponentValidator({
          logger: { info: jest.fn() }, // Missing other methods
          entityManager: mockEntityManager
        });
      }).toThrow("Invalid or missing method 'warn' on dependency 'ILogger'");
    });

    it('should throw error when entityManager lacks required methods', () => {
      expect(() => {
        new TargetComponentValidator({
          logger: mockLogger,
          entityManager: { getEntityInstance: jest.fn() } // Missing other methods
        });
      }).toThrow("Invalid or missing method 'hasComponent' on dependency 'IEntityManager'");
    });
  });

  describe('validateTargetComponents', () => {
    describe('with no forbidden_components', () => {
      it('should allow action when forbidden_components is not defined', () => {
        const actionDef = { id: 'test-action' };
        const targetEntities = { target: { id: 'entity-1' } };

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
      });

      it('should allow action when forbidden_components is null', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: null
        };
        const targetEntities = { target: { id: 'entity-1' } };

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
      });
    });

    describe('with null/undefined target entities', () => {
      it('should handle null target entities gracefully', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            target: ['core:forbidden']
          }
        };

        const result = validator.validateTargetComponents(actionDef, null);

        expect(result).toEqual({ valid: true });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "No target entities provided for action 'test-action', validation passes"
        );
      });

      it('should handle undefined target entities gracefully', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            target: ['core:forbidden']
          }
        };

        const result = validator.validateTargetComponents(actionDef, undefined);

        expect(result).toEqual({ valid: true });
      });
    });

    describe('actor-only forbidden components', () => {
      it('should bypass validation when only actor constraints are defined', () => {
        const actionDef = {
          id: 'actor-only-action',
          forbidden_components: {
            actor: ['core:actor-only'],
          },
        };

        const targetEntities = {
          target: { id: 'target-entity' },
        };

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
        expect(mockEntityManager.getAllComponentTypesForEntity).not.toHaveBeenCalled();
      });
    });

    describe('legacy single-target format', () => {
      it('should allow action when target lacks forbidden components', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            target: ['core:forbidden', 'core:restricted']
          }
        };

        const targetEntities = {
          target: { id: 'entity-1' }
        };

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'core:actor',
          'core:position'
        ]);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
        expect(mockEntityManager.getAllComponentTypesForEntity).toHaveBeenCalledWith('entity-1');
      });

      it('should reject action when target has forbidden component', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            target: ['core:forbidden', 'core:restricted']
          }
        };

        const targetEntities = {
          target: { id: 'entity-1' }
        };

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'core:actor',
          'core:forbidden',
          'core:position'
        ]);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("target entity 'entity-1' has forbidden component 'core:forbidden'");
      });

      it('should handle missing target entity in legacy format', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            target: ['core:forbidden']
          }
        };

        const targetEntities = {}; // No target property

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
      });
    });

    describe('multi-target format', () => {
      it('should validate primary target correctly', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            primary: ['core:forbidden']
          }
        };

        const targetEntities = {
          primary: { id: 'primary-entity' }
        };

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'core:forbidden'
        ]);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("primary target 'primary-entity' has forbidden component");
      });

      it('should validate secondary target correctly', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            secondary: ['core:restricted']
          }
        };

        const targetEntities = {
          primary: { id: 'primary-entity' },
          secondary: { id: 'secondary-entity' }
        };

        // Only secondary will be checked since only secondary has forbidden components
        mockEntityManager.getAllComponentTypesForEntity
          .mockReturnValue(['core:restricted']); // Secondary has forbidden

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("secondary target 'secondary-entity' has forbidden component");
      });

      it('should validate tertiary target correctly', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            tertiary: ['core:blocked']
          }
        };

        const targetEntities = {
          primary: { id: 'primary-entity' },
          secondary: { id: 'secondary-entity' },
          tertiary: { id: 'tertiary-entity' }
        };

        mockEntityManager.getAllComponentTypesForEntity
          .mockReturnValue(['core:blocked']);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("tertiary target 'tertiary-entity' has forbidden component");
      });

      it('should reject arrays when any candidate has forbidden component', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            primary: ['core:forbidden']
          }
        };

        const targetEntities = {
          primary: [
            { id: 'safe-entity' },
            { id: 'forbidden-entity' }
          ]
        };

        mockEntityManager.getAllComponentTypesForEntity
          .mockReturnValueOnce(['core:allowed'])
          .mockReturnValueOnce(['core:forbidden']);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("primary target 'forbidden-entity' has forbidden component 'core:forbidden'");
        expect(mockEntityManager.getAllComponentTypesForEntity).toHaveBeenCalledTimes(2);
      });

      it('should short-circuit on first validation failure', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            primary: ['core:forbidden'],
            secondary: ['core:restricted'],
            tertiary: ['core:blocked']
          }
        };

        const targetEntities = {
          primary: { id: 'primary-entity' },
          secondary: { id: 'secondary-entity' },
          tertiary: { id: 'tertiary-entity' }
        };

        // Primary has forbidden component
        mockEntityManager.getAllComponentTypesForEntity
          .mockReturnValueOnce(['core:forbidden']);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result.valid).toBe(false);
        // Should only check primary, not secondary or tertiary
        expect(mockEntityManager.getAllComponentTypesForEntity).toHaveBeenCalledTimes(1);
      });

      it('should handle mixed legacy and modern formats', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            primary: ['core:forbidden'],
            secondary: ['core:restricted']
          }
        };

        const targetEntities = {
          primary: { id: 'primary-entity' },
          secondary: { id: 'secondary-entity' }
        };

        mockEntityManager.getAllComponentTypesForEntity
          .mockReturnValue([]);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
      });

      it('should allow action when all targets lack forbidden components', () => {
        const actionDef = {
          id: 'test-action',
          forbidden_components: {
            primary: ['core:forbidden'],
            secondary: ['core:restricted'],
            tertiary: ['core:blocked']
          }
        };

        const targetEntities = {
          primary: { id: 'primary-entity' },
          secondary: { id: 'secondary-entity' },
          tertiary: { id: 'tertiary-entity' }
        };

        mockEntityManager.getAllComponentTypesForEntity
          .mockReturnValue(['core:safe', 'core:allowed']);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
      });

      it('should fall back to primary targets when legacy target role is empty', () => {
        const actionDef = {
          id: 'legacy-fallback-action',
          forbidden_components: {
            actor: ['core:actor-component'],
            target: ['core:blocked'],
          },
        };

        const targetEntities = {
          primary: { id: 'primary-entity' },
        };

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:safe']);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Action 'legacy-fallback-action': Using primary targets for legacy 'target' role validation"
        );
        expect(mockEntityManager.getAllComponentTypesForEntity).toHaveBeenCalledWith('primary-entity');
      });

      it('should continue when no entities exist for a role with forbidden components', () => {
        const actionDef = {
          id: 'empty-role-action',
          forbidden_components: {
            primary: ['core:restricted'],
            secondary: ['core:blocked'],
          },
        };

        const targetEntities = {
          primary: { id: 'primary-entity' },
        };

        const validateSpy = jest.spyOn(validator, 'validateEntityComponents');

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:safe']);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
        expect(validateSpy).toHaveBeenCalledTimes(1);
      });

      it('should skip validation when a role has an empty candidate array', () => {
        const actionDef = {
          id: 'empty-array-action',
          forbidden_components: {
            primary: ['core:restricted'],
          },
        };

        const targetEntities = {
          primary: [],
        };

        const validateSpy = jest.spyOn(validator, 'validateEntityComponents');

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
        expect(validateSpy).not.toHaveBeenCalled();
      });

      it('should ignore candidates without entities and continue validation', () => {
        const actionDef = {
          id: 'null-candidate-action',
          forbidden_components: {
            primary: ['core:restricted'],
          },
        };

        const targetEntities = {
          primary: [null, { id: 'valid-entity' }],
        };

        const validateSpy = jest.spyOn(validator, 'validateEntityComponents');

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(['core:safe']);

        const result = validator.validateTargetComponents(actionDef, targetEntities);

        expect(result).toEqual({ valid: true });
        expect(validateSpy).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getAllComponentTypesForEntity).toHaveBeenCalledWith('valid-entity');
      });
    });

    describe('performance', () => {
      it('should log warning when validation takes too long', () => {
        jest.spyOn(performance, 'now')
          .mockReturnValueOnce(0)    // Start time
          .mockReturnValueOnce(10);  // End time (10ms)

        const actionDef = {
          id: 'slow-action',
          forbidden_components: {
            target: ['core:forbidden']
          }
        };

        const targetEntities = {
          target: { id: 'entity-1' }
        };

        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

        validator.validateTargetComponents(actionDef, targetEntities);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Target validation for action 'slow-action' took 10.00ms")
        );
      });

      it('should validate 100 targets efficiently', () => {
        const startTime = performance.now();

        const actionDef = {
          id: 'bulk-action',
          forbidden_components: {
            primary: ['core:forbidden']
          }
        };

        // Simulate validating 100 times
        for (let i = 0; i < 100; i++) {
          const targetEntities = {
            primary: { id: `entity-${i}` }
          };

          mockEntityManager.getAllComponentTypesForEntity
            .mockReturnValue(['core:allowed']);

          validator.validateTargetComponents(actionDef, targetEntities);
        }

        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      });
    });
  });

  describe('validateEntityComponents', () => {
    it('should return valid when entity has no forbidden components', () => {
      const entity = { id: 'entity-1' };
      const forbiddenComponents = ['core:forbidden', 'core:restricted'];

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:position'
      ]);

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({ valid: true });
    });

    it('should return invalid with specific component when found', () => {
      const entity = { id: 'entity-1' };
      const forbiddenComponents = ['core:forbidden', 'core:restricted'];

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:forbidden',
        'core:position'
      ]);

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({
        valid: false,
        component: 'core:forbidden'
      });
    });

    it('should handle empty forbidden components list', () => {
      const entity = { id: 'entity-1' };
      const forbiddenComponents = [];

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({ valid: true });
    });

    it('should handle null forbidden components list', () => {
      const entity = { id: 'entity-1' };
      const forbiddenComponents = null;

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({ valid: true });
    });

    it('should handle null entity', () => {
      const entity = null;
      const forbiddenComponents = ['core:forbidden'];

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({ valid: true });
    });

    it('should handle undefined entity', () => {
      const entity = undefined;
      const forbiddenComponents = ['core:forbidden'];

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({ valid: true });
    });

    it('should handle entity without id property', () => {
      const entity = { components: ['core:actor'] };
      const forbiddenComponents = ['core:forbidden'];

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({ valid: true });
    });

    it('should fallback to entity components property when manager fails', () => {
      const entity = {
        id: 'entity-1',
        components: ['core:actor', 'core:forbidden']
      };
      const forbiddenComponents = ['core:forbidden'];

      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(() => {
        throw new Error('Entity manager error');
      });

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({
        valid: false,
        component: 'core:forbidden'
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get components for entity validation: Entity manager error'
      );
    });

    it('should validate multiple forbidden components', () => {
      const entity = { id: 'entity-1' };
      const forbiddenComponents = [
        'core:forbidden1',
        'core:forbidden2',
        'core:forbidden3'
      ];

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:forbidden2',
        'core:position'
      ]);

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({
        valid: false,
        component: 'core:forbidden2'
      });
    });

    it('should use O(1) lookups for component checking', () => {
      const entity = { id: 'entity-1' };
      // Large list of forbidden components
      const forbiddenComponents = Array.from({ length: 1000 }, (_, i) => `core:forbidden${i}`);

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:position'
      ]);

      const startTime = performance.now();
      const result = validator.validateEntityComponents(entity, forbiddenComponents);
      const duration = performance.now() - startTime;

      expect(result).toEqual({ valid: true });
      expect(duration).toBeLessThan(50); // Should remain fast even on slower CI
    });
  });

  describe('edge cases', () => {
    it('should handle malformed component data', () => {
      const entity = { id: 'entity-1' };
      const forbiddenComponents = ['core:forbidden'];

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(null);

      const result = validator.validateEntityComponents(entity, forbiddenComponents);

      expect(result).toEqual({ valid: true });
    });

    it('should handle very large forbidden component lists', () => {
      const actionDef = {
        id: 'test-action',
        forbidden_components: {
          target: Array.from({ length: 1000 }, (_, i) => `core:forbidden${i}`)
        }
      };

      const targetEntities = {
        target: { id: 'entity-1' }
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor'
      ]);

      const result = validator.validateTargetComponents(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should handle entity without id in error messages', () => {
      const actionDef = {
        id: 'test-action',
        forbidden_components: {
          target: ['core:forbidden']
        }
      };

      const targetEntities = {
        target: { components: ['core:forbidden'] } // No id property
      };

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const result = validator.validateTargetComponents(actionDef, targetEntities);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("target entity 'unknown' has forbidden component");
    });
  });
});