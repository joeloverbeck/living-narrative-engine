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
