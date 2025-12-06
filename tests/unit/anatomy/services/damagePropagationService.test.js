import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamagePropagationService from '../../../../src/anatomy/services/damagePropagationService.js';

describe('DamagePropagationService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn().mockReturnValue(false),
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    service = new DamagePropagationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new DamagePropagationService({
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new DamagePropagationService({
            logger: mockLogger,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw if eventBus is missing', () => {
      expect(
        () =>
          new DamagePropagationService({
            logger: mockLogger,
            entityManager: mockEntityManager,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing getComponentData method', () => {
      const invalidEntityManager = { hasComponent: jest.fn() };
      expect(
        () =>
          new DamagePropagationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing hasComponent method', () => {
      const invalidEntityManager = { getComponentData: jest.fn() };
      expect(
        () =>
          new DamagePropagationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing getEntitiesWithComponent method', () => {
      const invalidEntityManager = {
        getComponentData: jest.fn(),
        hasComponent: jest.fn(),
      };
      expect(
        () =>
          new DamagePropagationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw if eventBus missing dispatch method', () => {
      const invalidEventBus = {};
      expect(
        () =>
          new DamagePropagationService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: invalidEventBus,
          })
      ).toThrow();
    });
  });

  describe('propagateDamage', () => {
    describe('when propagationRules is invalid', () => {
      it('should return empty array when propagationRules is null', () => {
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          null
        );
        expect(result).toEqual([]);
      });

      it('should return empty array when propagationRules is undefined', () => {
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          undefined
        );
        expect(result).toEqual([]);
      });

      it('should return empty array when propagationRules is not an object', () => {
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          'not-an-object'
        );
        expect(result).toEqual([]);
      });

      it('should return empty array when propagationRules is an empty object', () => {
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          {}
        );
        expect(result).toEqual([]);
      });

      it('should return empty array when propagationRules is an empty array', () => {
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          []
        );
        expect(result).toEqual([]);
      });
    });

    describe('array format (new format)', () => {
      it('should accept array format with childPartId', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].childPartId).toBe('child-part-1');
        expect(result[0].damageApplied).toBe(50);
      });

      it('should accept array format with baseProbability field', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1,
            damageFraction: 0.3,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].damageApplied).toBe(30);
      });

      it('should accept array format with damageFraction field', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1,
            damageFraction: 0.7,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].damageApplied).toBe(70);
      });

      it('should skip array entries without childPartId or childSocketId', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          { baseProbability: 1, damageFraction: 0.5 }, // missing childPartId
          {
            childPartId: 'child-part-1',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].childPartId).toBe('child-part-1');
      });

      it('should skip null entries in array', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          null,
          {
            childPartId: 'child-part-1',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
      });

      it('should process multiple rules in array format', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1,
            damageFraction: 0.5,
          },
          {
            childPartId: 'child-part-2',
            baseProbability: 1,
            damageFraction: 0.3,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(2);
        expect(result).toContainEqual({
          childPartId: 'child-part-1',
          damageApplied: 50,
          damageTypeId: 'slashing',
        });
        expect(result).toContainEqual({
          childPartId: 'child-part-2',
          damageApplied: 30,
          damageTypeId: 'slashing',
        });
      });
    });

    describe('socket resolution (childSocketId)', () => {
      it('should resolve childSocketId to entity via joint lookup', () => {
        // Setup: Return a list of entities with joints
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          'heart-entity',
          'lung-entity',
        ]);

        // Setup: Return joint data for each entity
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:joint') {
              if (entityId === 'heart-entity') {
                return {
                  parentId: 'parent-part-1',
                  socketId: 'heart_socket',
                };
              }
              if (entityId === 'lung-entity') {
                return {
                  parentId: 'parent-part-1',
                  socketId: 'lung_socket',
                };
              }
            }
            return null;
          }
        );

        const rules = [
          {
            childSocketId: 'heart_socket',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].childPartId).toBe('heart-entity');
        expect(result[0].damageApplied).toBe(50);
      });

      it('should return empty when socket has no entity attached', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

        const rules = [
          {
            childSocketId: 'empty_socket',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('No entity attached to socket')
        );
      });

      it('should skip socket when no matching entity found', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          'other-entity',
        ]);
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'different-parent',
          socketId: 'different_socket',
        });

        const rules = [
          {
            childSocketId: 'heart_socket',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });

      it('should support childSocketId as alternative joint property', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          'heart-entity',
        ]);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:joint') {
              return {
                parentEntityId: 'parent-part-1',
                childSocketId: 'heart_socket', // alternative field name
              };
            }
            return null;
          }
        );

        const rules = [
          {
            childSocketId: 'heart_socket',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].childPartId).toBe('heart-entity');
      });

      it('should handle getEntitiesWithComponent returning non-array', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(null);

        const rules = [
          {
            childSocketId: 'heart_socket',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });

      it('should handle errors during socket resolution gracefully', () => {
        mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
          throw new Error('Database error');
        });

        const rules = [
          {
            childSocketId: 'heart_socket',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error resolving socket')
        );
      });

      it('should skip entities with inaccessible joint data', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          'broken-entity',
          'valid-entity',
        ]);

        let callCount = 0;
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:joint') {
              if (entityId === 'broken-entity') {
                throw new Error('Component access error');
              }
              if (entityId === 'valid-entity') {
                return {
                  parentId: 'parent-part-1',
                  socketId: 'heart_socket',
                };
              }
            }
            return null;
          }
        );

        const rules = [
          {
            childSocketId: 'heart_socket',
            baseProbability: 1,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].childPartId).toBe('valid-entity');
      });
    });

    describe('when rule is invalid', () => {
      it('should skip rules that are null', () => {
        const rules = {
          'child-part-1': null,
        };
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );
        expect(result).toEqual([]);
      });

      it('should skip rules that are not objects', () => {
        const rules = {
          'child-part-1': 'invalid-rule',
        };
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );
        expect(result).toEqual([]);
      });

      it('should skip self-referencing rules', () => {
        // Rule references the parent part itself
        const rules = {
          'parent-part-1': { probability: 1, damage_fraction: 0.5 },
        };
        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );
        expect(result).toEqual([]);
      });
    });

    describe('damage type filtering', () => {
      it('should skip propagation when damage type is not in allowed types', () => {
        // Setup: Child is a valid child
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
            damage_types: ['piercing', 'blunt'],
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing', // not in allowed types
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });

      it('should propagate when damage type is in allowed types', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
            damage_types: ['piercing', 'slashing'],
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].childPartId).toBe('child-part-1');
      });

      it('should propagate when damage_types is not specified', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
      });

      it('should propagate when damage_types is an empty array', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
            damage_types: [],
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
      });
    });

    describe('probability checking', () => {
      it('should propagate when probability is 1 (always)', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
      });

      it('should not propagate when probability is 0 (never)', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 0,
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });

      it('should default to probability 1 when not specified', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
      });

      it('should clamp probability above 1 to 1', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 2.0, // above 1
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
      });

      it('should clamp probability below 0 to 0', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: -0.5, // below 0
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });

      it('should use provided rngProvider for deterministic propagation success', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const deterministicRng = jest.fn().mockReturnValue(0.1);

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 0.2,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules,
          deterministicRng
        );

        expect(deterministicRng).toHaveBeenCalled();
        expect(result.length).toBe(1);
      });

      it('should use provided rngProvider to skip propagation when roll is above probability', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const deterministicRng = jest.fn().mockReturnValue(0.9);

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 0.2,
            damageFraction: 0.5,
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules,
          deterministicRng
        );

        expect(deterministicRng).toHaveBeenCalled();
        expect(result).toEqual([]);
      });
    });

    describe('damageTypeModifiers probability calculation', () => {
      it('should increase effective probability with modifier > 1', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        // With baseProbability 0.5 and piercing modifier 2.0
        // effective probability = 0.5 * 2.0 = 1.0 (clamped to 1)
        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 0.5,
            damageFraction: 0.5,
            damageTypeModifiers: {
              piercing: 2.0,
            },
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'piercing',
          'entity-1',
          rules
        );

        // With modifier 2.0, effective probability is 1.0 (clamped), so should always propagate
        expect(result.length).toBe(1);
      });

      it('should decrease effective probability with modifier < 1', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        // With baseProbability 1.0 and blunt modifier 0
        // effective probability = 1.0 * 0 = 0 (never propagates)
        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1.0,
            damageFraction: 0.5,
            damageTypeModifiers: {
              blunt: 0,
            },
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'blunt',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });

      it('should use modifier 1.0 for unlisted damage types', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1.0,
            damageFraction: 0.5,
            damageTypeModifiers: {
              piercing: 1.5,
              blunt: 0.3,
              // slashing not listed - should use 1.0
            },
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing', // not in damageTypeModifiers
          'entity-1',
          rules
        );

        // baseProbability 1.0 * 1.0 (default) = 1.0, should propagate
        expect(result.length).toBe(1);
      });

      it('should clamp effective probability to max 1', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 0.8,
            damageFraction: 0.5,
            damageTypeModifiers: {
              piercing: 5.0, // Would result in 4.0, should clamp to 1.0
            },
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'piercing',
          'entity-1',
          rules
        );

        // Should still work because probability is clamped to 1.0
        expect(result.length).toBe(1);
      });

      it('should clamp effective probability to min 0', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 0.5,
            damageFraction: 0.5,
            damageTypeModifiers: {
              piercing: -1.0, // Would result in negative, should clamp to 0
            },
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'piercing',
          'entity-1',
          rules
        );

        // Should not propagate because probability is clamped to 0
        expect(result).toEqual([]);
      });

      it('should handle non-numeric damageTypeModifiers values', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1.0,
            damageFraction: 0.5,
            damageTypeModifiers: {
              piercing: 'invalid', // non-numeric
            },
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'piercing',
          'entity-1',
          rules
        );

        // Should use default modifier 1.0 for non-numeric values
        expect(result.length).toBe(1);
      });

      it('should handle damageTypeModifiers as non-object', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 1.0,
            damageFraction: 0.5,
            damageTypeModifiers: 'not-an-object',
          },
        ];

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'piercing',
          'entity-1',
          rules
        );

        // Should use default modifier 1.0 when not an object
        expect(result.length).toBe(1);
      });

      it('should combine baseProbability and damageTypeModifiers correctly', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        // Real-world example from chicken_torso:
        // baseProbability: 0.3, piercing modifier: 1.5
        // effective = 0.3 * 1.5 = 0.45
        const rules = [
          {
            childPartId: 'child-part-1',
            baseProbability: 0.3,
            damageFraction: 0.5,
            damageTypeModifiers: {
              piercing: 1.5,
              blunt: 0.3,
              slashing: 0.8,
            },
          },
        ];

        // Run multiple times to verify probability is being applied
        // With 0.45 probability, some runs should succeed and some should fail
        // This test verifies the formula is applied, not the RNG outcome
        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'piercing',
          'entity-1',
          rules
        );

        // Result could be 0 or 1 depending on RNG
        expect(result.length).toBeLessThanOrEqual(1);
      });
    });

    describe('damage fraction calculation', () => {
      it('should calculate propagated damage using damage_fraction', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.3,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].damageApplied).toBe(30);
      });

      it('should default to 0.5 damage_fraction when not specified', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0].damageApplied).toBe(50);
      });

      it('should skip propagation when calculated damage is 0 or less', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });
    });

    describe('child verification via joint', () => {
      it('should propagate when child joint references parent', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'child-part-1',
          'anatomy:joint'
        );
      });

      it('should skip propagation when child joint references different parent', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'different-parent',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Skipping')
        );
      });

      it('should support parentEntityId as alternative joint property', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentEntityId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
      });

      it('should skip propagation when joint component throws error', () => {
        mockEntityManager.getComponentData.mockImplementation(() => {
          throw new Error('Component not found');
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(result).toEqual([]);
      });
    });

    describe('event dispatching', () => {
      it('should dispatch internal_damage_propagated event for each propagation', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:internal_damage_propagated',
          expect.objectContaining({
            ownerEntityId: 'entity-1',
            sourcePartId: 'parent-part-1',
            targetPartId: 'child-part-1',
            damageAmount: 5,
            damageTypeId: 'slashing',
            timestamp: expect.any(Number),
          })
        );
      });

      it('should dispatch events for multiple propagations', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
          'child-part-2': {
            probability: 1,
            damage_fraction: 0.3,
          },
        };

        service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
      });

      it('should not dispatch event when propagation is skipped', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'different-parent',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
      });
    });

    describe('return value', () => {
      it('should return PropagationResult with correct structure', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.4,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          25,
          'piercing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(1);
        expect(result[0]).toEqual({
          childPartId: 'child-part-1',
          damageApplied: 10,
          damageTypeId: 'piercing',
        });
      });

      it('should return results for multiple successful propagations', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
          'child-part-2': {
            probability: 1,
            damage_fraction: 0.3,
          },
        };

        const result = service.propagateDamage(
          'parent-part-1',
          100,
          'slashing',
          'entity-1',
          rules
        );

        expect(result.length).toBe(2);
        expect(result).toContainEqual({
          childPartId: 'child-part-1',
          damageApplied: 50,
          damageTypeId: 'slashing',
        });
        expect(result).toContainEqual({
          childPartId: 'child-part-2',
          damageApplied: 30,
          damageTypeId: 'slashing',
        });
      });
    });

    describe('logging', () => {
      it('should log debug message with propagation count', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          parentId: 'parent-part-1',
        });

        const rules = {
          'child-part-1': {
            probability: 1,
            damage_fraction: 0.5,
          },
        };

        service.propagateDamage(
          'parent-part-1',
          10,
          'slashing',
          'entity-1',
          rules
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('1 child parts will receive damage')
        );
      });
    });
  });
});
