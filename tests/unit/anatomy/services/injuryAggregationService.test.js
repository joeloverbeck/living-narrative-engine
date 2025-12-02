import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InjuryAggregationService from '../../../../src/anatomy/services/injuryAggregationService.js';

describe('InjuryAggregationService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;

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

    mockBodyGraphService = {
      getAllParts: jest.fn().mockReturnValue([]),
    };

    service = new InjuryAggregationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new InjuryAggregationService({
            entityManager: mockEntityManager,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new InjuryAggregationService({
            logger: mockLogger,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if bodyGraphService is missing', () => {
      expect(
        () =>
          new InjuryAggregationService({
            logger: mockLogger,
            entityManager: mockEntityManager,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing getComponentData method', () => {
      const invalidEntityManager = { hasComponent: jest.fn() };
      expect(
        () =>
          new InjuryAggregationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing hasComponent method', () => {
      const invalidEntityManager = { getComponentData: jest.fn() };
      expect(
        () =>
          new InjuryAggregationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if bodyGraphService missing getAllParts method', () => {
      const invalidBodyGraphService = {};
      expect(
        () =>
          new InjuryAggregationService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            bodyGraphService: invalidBodyGraphService,
          })
      ).toThrow();
    });
  });

  describe('aggregateInjuries', () => {
    const entityId = 'entity:player';

    describe('entity metadata', () => {
      it('should return entity name from core:name component', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'core:name') return { text: 'Hero' };
            if (componentId === 'anatomy:body') return { partIds: [] };
            return null;
          }
        );

        const result = service.aggregateInjuries(entityId);

        expect(result.entityName).toBe('Hero');
      });

      it('should return Unknown for missing name component', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);

        const result = service.aggregateInjuries(entityId);

        expect(result.entityName).toBe('Unknown');
      });

      it('should return correct pronoun for male gender', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'core:gender') return { value: 'male' };
            return null;
          }
        );

        const result = service.aggregateInjuries(entityId);

        expect(result.entityPronoun).toBe('he');
      });

      it('should return correct pronoun for female gender', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'core:gender') return { value: 'female' };
            return null;
          }
        );

        const result = service.aggregateInjuries(entityId);

        expect(result.entityPronoun).toBe('she');
      });

      it('should return they for neutral gender', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'core:gender') return { value: 'neutral' };
            return null;
          }
        );

        const result = service.aggregateInjuries(entityId);

        expect(result.entityPronoun).toBe('they');
      });

      it('should return they for missing gender component', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);

        const result = service.aggregateInjuries(entityId);

        expect(result.entityPronoun).toBe('they');
      });
    });

    describe('dying state', () => {
      it('should detect dying state with turnsRemaining and cause', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:dying'
        );
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:dying') {
              return { turnsRemaining: 3, causeOfDying: 'bleeding_out' };
            }
            return null;
          }
        );

        const result = service.aggregateInjuries(entityId);

        expect(result.isDying).toBe(true);
        expect(result.dyingTurnsRemaining).toBe(3);
        expect(result.dyingCause).toBe('bleeding_out');
      });

      it('should return isDying false when no dying component', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        const result = service.aggregateInjuries(entityId);

        expect(result.isDying).toBe(false);
        expect(result.dyingTurnsRemaining).toBeNull();
        expect(result.dyingCause).toBeNull();
      });
    });

    describe('dead state', () => {
      it('should detect dead state with cause', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:dead'
        );
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:dead') {
              return { causeOfDeath: 'heart_destroyed' };
            }
            return null;
          }
        );

        const result = service.aggregateInjuries(entityId);

        expect(result.isDead).toBe(true);
        expect(result.causeOfDeath).toBe('heart_destroyed');
      });

      it('should return isDead false when no dead component', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        const result = service.aggregateInjuries(entityId);

        expect(result.isDead).toBe(false);
        expect(result.causeOfDeath).toBeNull();
      });
    });

    describe('body parts aggregation', () => {
      it('should return empty arrays when no body parts exist', () => {
        mockBodyGraphService.getAllParts.mockReturnValue([]);

        const result = service.aggregateInjuries(entityId);

        expect(result.injuredParts).toEqual([]);
        expect(result.bleedingParts).toEqual([]);
        expect(result.burningParts).toEqual([]);
        expect(result.poisonedParts).toEqual([]);
        expect(result.fracturedParts).toEqual([]);
        expect(result.destroyedParts).toEqual([]);
      });

      it('should aggregate single injured part', () => {
        const partId = 'part:left_arm';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 50, maxHealth: 100, state: 'wounded' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'arm', orientation: 'left' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) =>
            id === partId && componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.injuredParts).toHaveLength(1);
        expect(result.injuredParts[0]).toMatchObject({
          partEntityId: partId,
          partType: 'arm',
          orientation: 'left',
          state: 'wounded',
          healthPercentage: 50,
          currentHealth: 50,
          maxHealth: 100,
        });
      });

      it('should not include healthy parts in injuredParts', () => {
        const partId = 'part:torso';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'torso', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) =>
            id === partId && componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.injuredParts).toHaveLength(0);
      });

      it('should detect bleeding parts with severity', () => {
        const partId = 'part:leg';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 60, maxHealth: 100, state: 'bruised' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'leg', orientation: 'right' };
            }
            if (id === partId && componentId === 'anatomy:bleeding') {
              return { severity: 'moderate' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === partId && componentId === 'anatomy:part_health')
            return true;
          if (id === partId && componentId === 'anatomy:bleeding') return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.bleedingParts).toHaveLength(1);
        expect(result.bleedingParts[0].isBleeding).toBe(true);
        expect(result.bleedingParts[0].bleedingSeverity).toBe('moderate');
      });

      it('should detect burning parts', () => {
        const partId = 'part:hand';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 80, maxHealth: 100, state: 'bruised' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'hand', orientation: 'left' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === partId && componentId === 'anatomy:part_health')
            return true;
          if (id === partId && componentId === 'anatomy:burning') return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.burningParts).toHaveLength(1);
        expect(result.burningParts[0].isBurning).toBe(true);
      });

      it('should detect poisoned parts', () => {
        const partId = 'part:torso';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 70, maxHealth: 100, state: 'bruised' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'torso', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === partId && componentId === 'anatomy:part_health')
            return true;
          if (id === partId && componentId === 'anatomy:poisoned') return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.poisonedParts).toHaveLength(1);
        expect(result.poisonedParts[0].isPoisoned).toBe(true);
      });

      it('should detect fractured parts', () => {
        const partId = 'part:arm';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return {
                currentHealth: 30,
                maxHealth: 100,
                state: 'badly_damaged',
              };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'arm', orientation: 'right' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === partId && componentId === 'anatomy:part_health')
            return true;
          if (id === partId && componentId === 'anatomy:fractured') return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.fracturedParts).toHaveLength(1);
        expect(result.fracturedParts[0].isFractured).toBe(true);
      });

      it('should detect destroyed parts', () => {
        const partId = 'part:hand';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 0, maxHealth: 100, state: 'destroyed' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'hand', orientation: 'left' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) =>
            id === partId && componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.destroyedParts).toHaveLength(1);
        expect(result.destroyedParts[0].state).toBe('destroyed');
        expect(result.destroyedParts[0].healthPercentage).toBe(0);
      });

      it('should detect stunned parts', () => {
        const partId = 'part:head';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 40, maxHealth: 100, state: 'wounded' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'head', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === partId && componentId === 'anatomy:part_health')
            return true;
          if (id === partId && componentId === 'anatomy:stunned') return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        expect(result.injuredParts).toHaveLength(1);
        expect(result.injuredParts[0].isStunned).toBe(true);
      });
    });

    describe('overall health calculation', () => {
      it('should return 100% for entity with no body parts', () => {
        mockBodyGraphService.getAllParts.mockReturnValue([]);

        const result = service.aggregateInjuries(entityId);

        expect(result.overallHealthPercentage).toBe(100);
      });

      it('should return 100% for fully healthy entity', () => {
        const partIds = ['part:torso', 'part:head', 'part:arm'];
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds };
            if (componentId === 'anatomy:part_health') {
              return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
            }
            if (componentId === 'anatomy:part') {
              if (id === 'part:torso')
                return { subType: 'torso', orientation: null };
              if (id === 'part:head')
                return { subType: 'head', orientation: null };
              if (id === 'part:arm')
                return { subType: 'arm', orientation: 'right' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue(partIds);

        const result = service.aggregateInjuries(entityId);

        expect(result.overallHealthPercentage).toBe(100);
      });

      it('should apply correct weights (torso=3, head=2, limbs=1)', () => {
        // Torso: 50% health, weight 3, weighted = 150
        // Head: 100% health, weight 2, weighted = 200
        // Arm: 0% health, weight 1, weighted = 0
        // Total: 150 + 200 + 0 = 350, weights = 6
        // Average: 350 / 6 = 58.33... rounded to 58
        const partIds = ['part:torso', 'part:head', 'part:arm'];
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds };
            if (id === 'part:torso' && componentId === 'anatomy:part_health') {
              return { currentHealth: 50, maxHealth: 100, state: 'wounded' };
            }
            if (id === 'part:head' && componentId === 'anatomy:part_health') {
              return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
            }
            if (id === 'part:arm' && componentId === 'anatomy:part_health') {
              return { currentHealth: 0, maxHealth: 100, state: 'destroyed' };
            }
            if (componentId === 'anatomy:part') {
              if (id === 'part:torso')
                return { subType: 'torso', orientation: null };
              if (id === 'part:head')
                return { subType: 'head', orientation: null };
              if (id === 'part:arm')
                return { subType: 'arm', orientation: 'left' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue(partIds);

        const result = service.aggregateInjuries(entityId);

        expect(result.overallHealthPercentage).toBe(58);
      });

      it('should apply 0.5 weight to internal organs', () => {
        // Heart: 100% health, weight 0.5, weighted = 50
        // Total: 50, weights = 0.5
        // Average: 50 / 0.5 = 100
        const partIds = ['part:heart'];
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds };
            if (id === 'part:heart' && componentId === 'anatomy:part_health') {
              return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
            }
            if (id === 'part:heart' && componentId === 'anatomy:part') {
              return { subType: 'heart', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue(partIds);

        const result = service.aggregateInjuries(entityId);

        expect(result.overallHealthPercentage).toBe(100);
      });

      it('should return 0% for entity with all destroyed parts', () => {
        const partIds = ['part:torso', 'part:head'];
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds };
            if (componentId === 'anatomy:part_health') {
              return { currentHealth: 0, maxHealth: 100, state: 'destroyed' };
            }
            if (componentId === 'anatomy:part') {
              if (id === 'part:torso')
                return { subType: 'torso', orientation: null };
              if (id === 'part:head')
                return { subType: 'head', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue(partIds);

        const result = service.aggregateInjuries(entityId);

        expect(result.overallHealthPercentage).toBe(0);
      });

      it('should use default weight of 1 for unknown part types', () => {
        const partIds = ['part:unknown'];
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds };
            if (
              id === 'part:unknown' &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 50, maxHealth: 100, state: 'wounded' };
            }
            if (id === 'part:unknown' && componentId === 'anatomy:part') {
              return { subType: 'unknown_type', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue(partIds);

        const result = service.aggregateInjuries(entityId);

        expect(result.overallHealthPercentage).toBe(50);
      });
    });

    describe('edge cases', () => {
      it('should handle missing body component gracefully', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);
        mockBodyGraphService.getAllParts.mockImplementation(() => {
          throw new Error('No body component');
        });

        const result = service.aggregateInjuries(entityId);

        expect(result.injuredParts).toEqual([]);
        expect(result.overallHealthPercentage).toBe(100);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should skip parts without part_health component', () => {
        const partIds = ['part:no_health', 'part:with_health'];
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds };
            if (
              id === 'part:with_health' &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 80, maxHealth: 100, state: 'bruised' };
            }
            if (
              id === 'part:with_health' &&
              componentId === 'anatomy:part'
            ) {
              return { subType: 'arm', orientation: 'left' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) =>
            id === 'part:with_health' && componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue(partIds);

        const result = service.aggregateInjuries(entityId);

        // Only one part should be included
        expect(result.injuredParts).toHaveLength(1);
        expect(result.injuredParts[0].partEntityId).toBe('part:with_health');
      });

      it('should handle maxHealth of 0 gracefully', () => {
        const partIds = ['part:zero_max'];
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds };
            if (
              id === 'part:zero_max' &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 0, maxHealth: 0, state: 'destroyed' };
            }
            if (id === 'part:zero_max' && componentId === 'anatomy:part') {
              return { subType: 'arm', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue(partIds);

        const result = service.aggregateInjuries(entityId);

        expect(result.destroyedParts[0].healthPercentage).toBe(0);
      });

      it('should handle getComponentData throwing errors', () => {
        mockEntityManager.getComponentData.mockImplementation(() => {
          throw new Error('Database error');
        });

        const result = service.aggregateInjuries(entityId);

        expect(result.entityName).toBe('Unknown');
        expect(result.entityPronoun).toBe('they');
      });

      it('should handle hasComponent throwing errors for dying check', () => {
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:dying') {
            throw new Error('Component check failed');
          }
          return false;
        });

        const result = service.aggregateInjuries(entityId);

        expect(result.isDying).toBe(false);
        expect(result.dyingTurnsRemaining).toBeNull();
      });

      it('should handle hasComponent throwing errors for dead check', () => {
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:dead') {
            throw new Error('Component check failed');
          }
          return false;
        });

        const result = service.aggregateInjuries(entityId);

        expect(result.isDead).toBe(false);
        expect(result.causeOfDeath).toBeNull();
      });

      it('should handle getComponentData throwing for part_health', () => {
        const partId = 'part:error_health';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              throw new Error('Part health error');
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === partId && componentId === 'anatomy:part_health')
            return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        // Part should be skipped when getPartHealthData throws
        expect(result.injuredParts).toEqual([]);
      });

      it('should handle getComponentData throwing for part metadata', () => {
        const partId = 'part:error_metadata';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 50, maxHealth: 100, state: 'wounded' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              throw new Error('Part metadata error');
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        // Part should have default 'unknown' subType
        expect(result.injuredParts[0].partType).toBe('unknown');
        expect(result.injuredParts[0].orientation).toBeNull();
      });

      it('should handle getComponentData throwing for bleeding data', () => {
        const partId = 'part:error_bleeding';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 50, maxHealth: 100, state: 'wounded' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'arm', orientation: 'left' };
            }
            if (id === partId && componentId === 'anatomy:bleeding') {
              throw new Error('Bleeding data error');
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:part_health') return true;
          if (id === partId && componentId === 'anatomy:bleeding') return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        // Bleeding should be false due to error handling
        expect(result.injuredParts[0].isBleeding).toBe(false);
        expect(result.injuredParts[0].bleedingSeverity).toBeNull();
      });

      it('should handle totalWeight of 0 in health calculation', () => {
        // This edge case happens when parts have null/undefined subType
        // and the weight lookup fails
        const partId = 'part:null_type';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return { currentHealth: 50, maxHealth: 100, state: 'wounded' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: null, orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        // Should use default weight of 1 for null subType
        expect(result.overallHealthPercentage).toBe(50);
      });

      it('should clamp health percentage to 0-100 range', () => {
        const partId = 'part:over_health';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              // Simulating corrupted data with health > max but wounded state
              return { currentHealth: 150, maxHealth: 100, state: 'wounded' };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'arm', orientation: null };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => componentId === 'anatomy:part_health'
        );
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        // Health percentage should be clamped to 100
        expect(result.injuredParts[0].healthPercentage).toBe(100);
      });

      it('should handle multiple status effects on a single part', () => {
        const partId = 'part:multi_effect';
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:body') return { partIds: [partId] };
            if (id === partId && componentId === 'anatomy:part_health') {
              return {
                currentHealth: 30,
                maxHealth: 100,
                state: 'badly_damaged',
              };
            }
            if (id === partId && componentId === 'anatomy:part') {
              return { subType: 'arm', orientation: 'left' };
            }
            if (id === partId && componentId === 'anatomy:bleeding') {
              return { severity: 'severe' };
            }
            return null;
          }
        );
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === partId && componentId === 'anatomy:part_health')
            return true;
          if (id === partId && componentId === 'anatomy:bleeding') return true;
          if (id === partId && componentId === 'anatomy:burning') return true;
          if (id === partId && componentId === 'anatomy:poisoned') return true;
          if (id === partId && componentId === 'anatomy:fractured') return true;
          return false;
        });
        mockBodyGraphService.getAllParts.mockReturnValue([partId]);

        const result = service.aggregateInjuries(entityId);

        const part = result.injuredParts[0];
        expect(part.isBleeding).toBe(true);
        expect(part.bleedingSeverity).toBe('severe');
        expect(part.isBurning).toBe(true);
        expect(part.isPoisoned).toBe(true);
        expect(part.isFractured).toBe(true);

        // Part should appear in all category arrays
        expect(result.bleedingParts).toHaveLength(1);
        expect(result.burningParts).toHaveLength(1);
        expect(result.poisonedParts).toHaveLength(1);
        expect(result.fracturedParts).toHaveLength(1);
      });
    });

    describe('logging', () => {
      it('should log debug messages during aggregation', () => {
        const result = service.aggregateInjuries(entityId);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Aggregating injuries for entity')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Injury aggregation complete')
        );
      });
    });
  });
});
