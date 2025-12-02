import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DeathCheckService from '../../../../src/anatomy/services/deathCheckService.js';

describe('DeathCheckService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;
  let mockInjuryAggregationService;

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
      addComponent: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockInjuryAggregationService = {
      aggregateInjuries: jest.fn().mockReturnValue({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        overallHealthPercentage: 100,
        destroyedParts: [],
        isDying: false,
        isDead: false,
      }),
    };

    service = new DeathCheckService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      injuryAggregationService: mockInjuryAggregationService,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new DeathCheckService({
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
          })
      ).toThrow();
    });

    it('should throw if eventBus is missing', () => {
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            injuryAggregationService: mockInjuryAggregationService,
          })
      ).toThrow();
    });

    it('should throw if injuryAggregationService is missing', () => {
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing getComponentData method', () => {
      const invalidEntityManager = {
        hasComponent: jest.fn(),
        addComponent: jest.fn(),
      };
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing hasComponent method', () => {
      const invalidEntityManager = {
        getComponentData: jest.fn(),
        addComponent: jest.fn(),
      };
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing addComponent method', () => {
      const invalidEntityManager = {
        getComponentData: jest.fn(),
        hasComponent: jest.fn(),
      };
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
          })
      ).toThrow();
    });

    it('should throw if eventBus missing dispatch method', () => {
      const invalidEventBus = {};
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: invalidEventBus,
            injuryAggregationService: mockInjuryAggregationService,
          })
      ).toThrow();
    });

    it('should throw if injuryAggregationService missing aggregateInjuries method', () => {
      const invalidService = {};
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: invalidService,
          })
      ).toThrow();
    });
  });

  describe('checkDeathConditions', () => {
    describe('when entity is already dead', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            return componentId === 'anatomy:dead';
          }
        );
      });

      it('should return isDead true without further checks', () => {
        const result = service.checkDeathConditions('entity-1');

        expect(result).toEqual({
          isDead: true,
          isDying: false,
          deathInfo: null,
        });
        expect(mockInjuryAggregationService.aggregateInjuries).not.toHaveBeenCalled();
      });
    });

    describe('vital organ destruction', () => {
      const setupVitalOrganDestruction = (organType) => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType };
            }
            if (entityId === 'entity-1' && componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });
      };

      it('should trigger immediate death on brain destruction', () => {
        setupVitalOrganDestruction('brain');

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.isDying).toBe(false);
        expect(result.deathInfo.causeOfDeath).toBe('vital_organ_destroyed');
        expect(result.deathInfo.vitalOrganDestroyed).toBe('brain');
        expect(result.deathInfo.killedBy).toBe('killer-1');
      });

      it('should trigger immediate death on heart destruction', () => {
        setupVitalOrganDestruction('heart');

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('heart');
      });

      it('should trigger immediate death on spine destruction', () => {
        setupVitalOrganDestruction('spine');

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('spine');
      });

      it('should add dead component on vital organ destruction', () => {
        setupVitalOrganDestruction('brain');

        service.checkDeathConditions('entity-1', 'killer-1');

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dead',
          expect.objectContaining({
            causeOfDeath: 'vital_organ_destroyed',
            vitalOrganDestroyed: 'brain',
            killedBy: 'killer-1',
          })
        );
      });

      it('should dispatch anatomy:entity_died event on vital organ destruction', () => {
        setupVitalOrganDestruction('brain');

        service.checkDeathConditions('entity-1', 'killer-1');

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:entity_died',
          expect.objectContaining({
            entityId: 'entity-1',
            entityName: 'Test Entity',
            causeOfDeath: 'vital_organ_destroyed',
            vitalOrganDestroyed: 'brain',
            killedBy: 'killer-1',
            finalMessage: expect.any(String),
            timestamp: expect.any(Number),
          })
        );
      });

      it('should not trigger death for non-immediate-death vital organs', () => {
        // Setup a vital organ type that is NOT in the immediate death list
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'kidney' }; // Not in immediate death list
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
      });
    });

    describe('critical overall health', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockReturnValue(false);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );
      });

      it('should enter dying state when overall health < 10%', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 5,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(true);
      });

      it('should add dying component when entering dying state', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 5,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        service.checkDeathConditions('entity-1');

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dying',
          expect.objectContaining({
            turnsRemaining: 3,
            causeOfDying: 'overall_health_critical',
            stabilizedBy: null,
          })
        );
      });

      it('should dispatch anatomy:entity_dying event when entering dying state', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 5,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        service.checkDeathConditions('entity-1');

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:entity_dying',
          expect.objectContaining({
            entityId: 'entity-1',
            entityName: 'Test Entity',
            turnsRemaining: 3,
            causeOfDying: 'overall_health_critical',
            timestamp: expect.any(Number),
          })
        );
      });

      it('should not re-add dying component if already dying', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            return componentId === 'anatomy:dying';
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 5,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDying).toBe(true);
        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dying',
          expect.anything()
        );
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
          'anatomy:entity_dying',
          expect.anything()
        );
      });

      it('should return healthy for entities above health threshold', () => {
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
        expect(result.deathInfo).toBeNull();
      });
    });

    describe('killedBy tracking', () => {
      it('should record killedBy when provided for vital organ death', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'brain' };
            }
            if (entityId === 'entity-1' && componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1', 'killer-entity');

        expect(result.deathInfo.killedBy).toBe('killer-entity');
      });

      it('should handle null killedBy', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'brain' };
            }
            if (entityId === 'entity-1' && componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1', null);

        expect(result.deathInfo.killedBy).toBeNull();
      });
    });

    describe('error handling', () => {
      it('should handle aggregateInjuries throwing error gracefully', () => {
        mockInjuryAggregationService.aggregateInjuries.mockImplementation(() => {
          throw new Error('Aggregation failed');
        });

        // Should not throw
        const result = service.checkDeathConditions('entity-1');

        // Should return healthy state (error handling returns false for checks)
        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      it('should log warning when aggregateInjuries fails', () => {
        mockInjuryAggregationService.aggregateInjuries.mockImplementation(() => {
          throw new Error('Aggregation failed');
        });

        service.checkDeathConditions('entity-1');

        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });
  });

  describe('processDyingTurn', () => {
    describe('when entity is not dying', () => {
      it('should return false if entity has no dying component', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        const result = service.processDyingTurn('entity-1');

        expect(result).toBe(false);
      });
    });

    describe('when entity is dying', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            return componentId === 'anatomy:dying';
          }
        );
      });

      it('should decrement turnsRemaining', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          turnsRemaining: 3,
          causeOfDying: 'overall_health_critical',
          stabilizedBy: null,
        });

        service.processDyingTurn('entity-1');

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dying',
          expect.objectContaining({
            turnsRemaining: 2,
            causeOfDying: 'overall_health_critical',
            stabilizedBy: null,
          })
        );
      });

      it('should return false when turns remaining > 0', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          turnsRemaining: 3,
          causeOfDying: 'overall_health_critical',
          stabilizedBy: null,
        });

        const result = service.processDyingTurn('entity-1');

        expect(result).toBe(false);
      });

      it('should trigger death when turnsRemaining reaches 0', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dying') {
              return {
                turnsRemaining: 1,
                causeOfDying: 'overall_health_critical',
                stabilizedBy: null,
              };
            }
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        const result = service.processDyingTurn('entity-1');

        expect(result).toBe(true);
      });

      it('should add dead component when dying countdown expires', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dying') {
              return {
                turnsRemaining: 1,
                causeOfDying: 'overall_health_critical',
                stabilizedBy: null,
              };
            }
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        service.processDyingTurn('entity-1');

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dead',
          expect.objectContaining({
            causeOfDeath: 'bleeding_out',
            vitalOrganDestroyed: null,
            killedBy: null,
          })
        );
      });

      it('should dispatch anatomy:entity_died event when dying countdown expires', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dying') {
              return {
                turnsRemaining: 1,
                causeOfDying: 'overall_health_critical',
                stabilizedBy: null,
              };
            }
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        service.processDyingTurn('entity-1');

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:entity_died',
          expect.objectContaining({
            entityId: 'entity-1',
            causeOfDeath: 'bleeding_out',
          })
        );
      });

      it('should skip processing if entity is stabilized', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          turnsRemaining: 1,
          causeOfDying: 'overall_health_critical',
          stabilizedBy: 'healer-entity',
        });

        const result = service.processDyingTurn('entity-1');

        expect(result).toBe(false);
        // Should not update the component
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });

      it('should return false when dying data is null', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);

        const result = service.processDyingTurn('entity-1');

        expect(result).toBe(false);
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            return componentId === 'anatomy:dying';
          }
        );
      });

      it('should handle turnsRemaining already at 0', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dying') {
              return {
                turnsRemaining: 0,
                causeOfDying: 'overall_health_critical',
                stabilizedBy: null,
              };
            }
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        const result = service.processDyingTurn('entity-1');

        expect(result).toBe(true);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dead',
          expect.anything()
        );
      });

      it('should handle negative turnsRemaining gracefully', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dying') {
              return {
                turnsRemaining: -5,
                causeOfDying: 'overall_health_critical',
                stabilizedBy: null,
              };
            }
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        const result = service.processDyingTurn('entity-1');

        expect(result).toBe(true);
      });
    });
  });

  describe('death message generation', () => {
    it('should generate appropriate message for brain destruction', () => {
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:dead') return false;
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return true;
          }
          return false;
        }
      );

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return { organType: 'brain' };
          }
          if (entityId === 'entity-1' && componentId === 'core:name') {
            return { text: 'Test Entity' };
          }
          return null;
        }
      );

      mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        overallHealthPercentage: 50,
        destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
        isDying: false,
        isDead: false,
      });

      service.checkDeathConditions('entity-1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          finalMessage: expect.stringContaining('massive head trauma'),
        })
      );
    });

    it('should generate appropriate message for heart destruction', () => {
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:dead') return false;
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return true;
          }
          return false;
        }
      );

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return { organType: 'heart' };
          }
          if (entityId === 'entity-1' && componentId === 'core:name') {
            return { text: 'Test Entity' };
          }
          return null;
        }
      );

      mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        overallHealthPercentage: 50,
        destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
        isDying: false,
        isDead: false,
      });

      service.checkDeathConditions('entity-1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          finalMessage: expect.stringContaining('heart'),
        })
      );
    });

    it('should generate appropriate message for bleeding out', () => {
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return componentId === 'anatomy:dying';
        }
      );

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:dying') {
            return {
              turnsRemaining: 1,
              causeOfDying: 'overall_health_critical',
              stabilizedBy: null,
            };
          }
          if (componentId === 'core:name') {
            return { text: 'Test Entity' };
          }
          return null;
        }
      );

      service.processDyingTurn('entity-1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          finalMessage: expect.stringContaining('blood loss'),
        })
      );
    });
  });

  describe('entity name handling', () => {
    it('should use Unknown when name component is missing', () => {
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:dead') return false;
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return true;
          }
          return false;
        }
      );

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return { organType: 'brain' };
          }
          // Return null for name component
          return null;
        }
      );

      mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        overallHealthPercentage: 50,
        destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
        isDying: false,
        isDead: false,
      });

      service.checkDeathConditions('entity-1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityName: 'Unknown',
        })
      );
    });

    it('should handle getComponentData throwing error for name', () => {
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:dead') return false;
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return true;
          }
          return false;
        }
      );

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'destroyed-part-1' &&
            componentId === 'anatomy:vital_organ'
          ) {
            return { organType: 'brain' };
          }
          if (componentId === 'core:name') {
            throw new Error('Component not found');
          }
          return null;
        }
      );

      mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        overallHealthPercentage: 50,
        destroyedParts: [{ partEntityId: 'destroyed-part-1', state: 'destroyed' }],
        isDying: false,
        isDead: false,
      });

      // Should not throw
      service.checkDeathConditions('entity-1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityName: 'Unknown',
        })
      );
    });
  });
});
