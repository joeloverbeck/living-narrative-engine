import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DeathCheckService from '../../../../src/anatomy/services/deathCheckService.js';

describe('DeathCheckService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;
  let mockInjuryAggregationService;
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

    mockBodyGraphService = {
      getAllDescendants: jest.fn().mockReturnValue([]),
      getAllParts: jest.fn().mockReturnValue([]),
    };

    service = new DeathCheckService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      injuryAggregationService: mockInjuryAggregationService,
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
          new DeathCheckService({
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
            bodyGraphService: mockBodyGraphService,
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
            bodyGraphService: mockBodyGraphService,
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
            bodyGraphService: mockBodyGraphService,
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
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if bodyGraphService is missing', () => {
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
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
            bodyGraphService: mockBodyGraphService,
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
            bodyGraphService: mockBodyGraphService,
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
            bodyGraphService: mockBodyGraphService,
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
            bodyGraphService: mockBodyGraphService,
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
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if bodyGraphService missing getAllDescendants method', () => {
      const invalidBodyGraphService = {};
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
            bodyGraphService: invalidBodyGraphService,
          })
      ).toThrow();
    });

    it('should throw if bodyGraphService missing getAllParts method', () => {
      const invalidBodyGraphService = {
        getAllDescendants: jest.fn(),
      };
      expect(
        () =>
          new DeathCheckService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            injuryAggregationService: mockInjuryAggregationService,
            bodyGraphService: invalidBodyGraphService,
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
        expect(
          mockInjuryAggregationService.aggregateInjuries
        ).not.toHaveBeenCalled();
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
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
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

      it('should not trigger death when killOnDestroy is false', () => {
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
              return { organType: 'heart', killOnDestroy: false };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
      });

      it('should allow new vital organ types to trigger death when killOnDestroy is true', () => {
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
              return { organType: 'kidney', killOnDestroy: true };
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
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('kidney');
        expect(result.deathInfo.killedBy).toBe('killer-1');
      });
    });

    describe('collective vital organ destruction', () => {
      const setupCollectiveLungs = ({
        leftHealth,
        rightHealth,
        destroyedParts,
      }) => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              (entityId === 'lung-left' || entityId === 'lung-right') &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'anatomy:body') {
              return { body: { root: 'root-1' } };
            }
            if (
              (entityId === 'lung-left' || entityId === 'lung-right') &&
              componentId === 'anatomy:vital_organ'
            ) {
              return {
                organType: 'lung',
                requiresAllDestroyed: true,
              };
            }
            if (entityId === 'lung-left' && componentId === 'anatomy:part_health') {
              return { currentHealth: leftHealth };
            }
            if (entityId === 'lung-right' && componentId === 'anatomy:part_health') {
              return { currentHealth: rightHealth };
            }
            if (entityId === 'entity-1' && componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        mockBodyGraphService.getAllParts.mockReturnValue([
          'lung-left',
          'lung-right',
        ]);

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts,
          isDying: false,
          isDead: false,
        });
      };

      it('should not trigger death when only one collective organ is destroyed', () => {
        setupCollectiveLungs({
          leftHealth: 0,
          rightHealth: 10,
          destroyedParts: [
            { partEntityId: 'lung-left', state: 'destroyed' },
          ],
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      it('should trigger death when all collective organs are destroyed', () => {
        setupCollectiveLungs({
          leftHealth: 0,
          rightHealth: 0,
          destroyedParts: [
            { partEntityId: 'lung-left', state: 'destroyed' },
            { partEntityId: 'lung-right', state: 'destroyed' },
          ],
        });

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.causeOfDeath).toBe('vital_organ_destroyed');
        expect(result.deathInfo.vitalOrganDestroyed).toBe('lung');
        expect(result.deathInfo.killedBy).toBe('killer-1');
      });

      it('should trigger death when actor has only one lung entity that is destroyed', () => {
        // Edge case: Actor with single lung (unusual anatomy)
        // When that single lung is destroyed, death should be triggered
        // because all respiratory organs (1 of 1) are destroyed
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'lung-single' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'anatomy:body') {
              return { body: { root: 'root-1' } };
            }
            if (
              entityId === 'lung-single' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return {
                organType: 'lung',
                requiresAllDestroyed: true,
              };
            }
            if (entityId === 'lung-single' && componentId === 'anatomy:part_health') {
              return { currentHealth: 0 }; // Destroyed
            }
            if (entityId === 'entity-1' && componentId === 'core:name') {
              return { text: 'One-Lunged Entity' };
            }
            return null;
          }
        );

        mockBodyGraphService.getAllParts.mockReturnValue(['lung-single']);

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'One-Lunged Entity',
          overallHealthPercentage: 50,
          destroyedParts: [{ partEntityId: 'lung-single', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.causeOfDeath).toBe('vital_organ_destroyed');
        expect(result.deathInfo.vitalOrganDestroyed).toBe('lung');
      });

      it('should return no death when actor has no body data', () => {
        // Edge case: Entity without anatomy:body component
        // Should handle gracefully without error
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'anatomy:body') {
              return null; // No body data
            }
            if (entityId === 'entity-1' && componentId === 'core:name') {
              return { text: 'Bodiless Entity' };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Bodiless Entity',
          overallHealthPercentage: 100,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });
    });

    describe('descendant vital organ detection', () => {
      it('should trigger death when vital organ is in descendant of destroyed part (e.g., brain inside dismembered head)', () => {
        // Scenario: Head is destroyed, brain is a descendant of head
        // Head itself does NOT have vital_organ, but brain does
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            // Brain has vital_organ, head does not
            if (
              entityId === 'brain-1' &&
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
              entityId === 'brain-1' &&
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

        // Head is in destroyedParts
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [{ partEntityId: 'head-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        // Brain is a descendant of head
        mockBodyGraphService.getAllDescendants.mockReturnValue([
          'brain-1',
          'eye-1',
          'eye-2',
        ]);

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.causeOfDeath).toBe('vital_organ_destroyed');
        expect(result.deathInfo.vitalOrganDestroyed).toBe('brain');
        expect(result.deathInfo.killedBy).toBe('killer-1');
        expect(mockBodyGraphService.getAllDescendants).toHaveBeenCalledWith(
          'head-1'
        );
      });

      it('should call getAllDescendants for each destroyed part', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'part-1', state: 'destroyed' },
            { partEntityId: 'part-2', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });
        mockBodyGraphService.getAllDescendants.mockReturnValue([]);

        service.checkDeathConditions('entity-1');

        expect(mockBodyGraphService.getAllDescendants).toHaveBeenCalledWith(
          'part-1'
        );
        expect(mockBodyGraphService.getAllDescendants).toHaveBeenCalledWith(
          'part-2'
        );
      });

      it('should trigger death when vital organ is deeply nested in destroyed part hierarchy', () => {
        // Scenario: Torso destroyed → contains chest → contains heart
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'heart-1' &&
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
              entityId === 'heart-1' &&
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
          destroyedParts: [{ partEntityId: 'torso-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        // Heart is somewhere in the torso's descendant tree
        mockBodyGraphService.getAllDescendants.mockReturnValue([
          'chest-1',
          'abdomen-1',
          'heart-1',
          'lung-1',
          'lung-2',
        ]);

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('heart');
      });

      it('should check direct part before descendants', () => {
        // Scenario: Part itself has vital organ - should find it without checking descendants
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'heart-1' &&
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
              entityId === 'heart-1' &&
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
          destroyedParts: [{ partEntityId: 'heart-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('heart');
        // getAllDescendants should not be called if direct part has vital organ
        expect(mockBodyGraphService.getAllDescendants).not.toHaveBeenCalled();
      });

      it('should return first vital organ found in descendants', () => {
        // Scenario: Multiple vital organs in descendants - should return first found
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'brain-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            if (
              entityId === 'spine-1' &&
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
              entityId === 'brain-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'brain' };
            }
            if (
              entityId === 'spine-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'spine' };
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
          destroyedParts: [{ partEntityId: 'head-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        // Brain comes first in descendants list
        mockBodyGraphService.getAllDescendants.mockReturnValue([
          'brain-1',
          'spine-1',
        ]);

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('brain');
      });

      it('should handle empty descendants list gracefully', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [{ partEntityId: 'part-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });
        mockBodyGraphService.getAllDescendants.mockReturnValue([]);

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      it('should log debug message when vital organ found in descendant', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'brain-1' &&
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
              entityId === 'brain-1' &&
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
          destroyedParts: [{ partEntityId: 'head-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        mockBodyGraphService.getAllDescendants.mockReturnValue(['brain-1']);

        service.checkDeathConditions('entity-1');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Found vital organ 'brain' destroyed in descendant 'brain-1'"
          )
        );
      });

      it('should NOT trigger death when vital organ descendant has health > 0 (e.g., brain scratched but head destroyed)', () => {
        // Scenario: Head destroyed (0 health), brain scratched (32/40 = 80% health)
        // The brain is still functional even though the head is destroyed
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'brain-1' &&
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
              entityId === 'brain-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'brain' };
            }
            if (
              entityId === 'brain-1' &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 32, maxHealth: 40 }; // 80% health - NOT destroyed
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 79,
          destroyedParts: [{ partEntityId: 'head-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        mockBodyGraphService.getAllDescendants.mockReturnValue([
          'brain-1',
          'eye-1',
        ]);

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      it('should trigger death when vital organ descendant is also destroyed (health = 0)', () => {
        // Scenario: Head destroyed AND brain destroyed (0 health)
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'brain-1' &&
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
              entityId === 'brain-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'brain' };
            }
            if (
              entityId === 'brain-1' &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 0, maxHealth: 40 }; // DESTROYED
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
          destroyedParts: [{ partEntityId: 'head-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        mockBodyGraphService.getAllDescendants.mockReturnValue(['brain-1']);

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.causeOfDeath).toBe('vital_organ_destroyed');
        expect(result.deathInfo.vitalOrganDestroyed).toBe('brain');
        expect(result.deathInfo.killedBy).toBe('killer-1');
      });

      it('should treat vital organ descendant with no health component as destroyed (defensive)', () => {
        // Scenario: Brain has no anatomy:part_health component - treat as destroyed
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'brain-1' &&
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
              entityId === 'brain-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'brain' };
            }
            // No anatomy:part_health for brain - returns null
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
          destroyedParts: [{ partEntityId: 'head-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        mockBodyGraphService.getAllDescendants.mockReturnValue(['brain-1']);

        const result = service.checkDeathConditions('entity-1', 'killer-1');

        // Should die because we defensively treat missing health as destroyed
        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('brain');
      });

      it('should NOT die when deeply nested vital organ has health > 0', () => {
        // Scenario: Torso destroyed → chest inside → heart inside with 50% health
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              entityId === 'heart-1' &&
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
              entityId === 'heart-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return { organType: 'heart' };
            }
            if (
              entityId === 'heart-1' &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 20, maxHealth: 40 }; // 50% health - NOT destroyed
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 60,
          destroyedParts: [{ partEntityId: 'torso-1', state: 'destroyed' }],
          isDying: false,
          isDead: false,
        });

        mockBodyGraphService.getAllDescendants.mockReturnValue([
          'chest-1',
          'abdomen-1',
          'heart-1',
          'lung-1',
          'lung-2',
        ]);

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
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions(
          'entity-1',
          'killer-entity'
        );

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
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1', null);

        expect(result.deathInfo.killedBy).toBeNull();
      });
    });

    describe('error handling', () => {
      it('should handle aggregateInjuries throwing error gracefully', () => {
        mockInjuryAggregationService.aggregateInjuries.mockImplementation(
          () => {
            throw new Error('Aggregation failed');
          }
        );

        // Should not throw
        const result = service.checkDeathConditions('entity-1');

        // Should return healthy state (error handling returns false for checks)
        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      it('should log warning when aggregateInjuries fails', () => {
        mockInjuryAggregationService.aggregateInjuries.mockImplementation(
          () => {
            throw new Error('Aggregation failed');
          }
        );

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
        destroyedParts: [
          { partEntityId: 'destroyed-part-1', state: 'destroyed' },
        ],
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
        destroyedParts: [
          { partEntityId: 'destroyed-part-1', state: 'destroyed' },
        ],
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

    it('should generate appropriate message for respiratory organ collective destruction', () => {
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:dead') return false;
          if (componentId === 'anatomy:dying') return false;
          if (
            (entityId === 'lung-left' || entityId === 'lung-right') &&
            componentId === 'anatomy:vital_organ'
          ) {
            return true;
          }
          return false;
        }
      );

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'entity-1' && componentId === 'anatomy:body') {
            return { body: { root: 'torso' } };
          }
          if (
            (entityId === 'lung-left' || entityId === 'lung-right') &&
            componentId === 'anatomy:vital_organ'
          ) {
            return {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
            };
          }
          if (
            (entityId === 'lung-left' || entityId === 'lung-right') &&
            componentId === 'anatomy:part_health'
          ) {
            return { currentHealth: 0 };
          }
          if (entityId === 'entity-1' && componentId === 'core:name') {
            return { text: 'Test Entity' };
          }
          return null;
        }
      );

      mockBodyGraphService.getAllParts.mockReturnValue([
        'lung-left',
        'lung-right',
      ]);

      mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        overallHealthPercentage: 50,
        destroyedParts: [
          { partEntityId: 'lung-left', state: 'destroyed' },
          { partEntityId: 'lung-right', state: 'destroyed' },
        ],
        isDying: false,
        isDead: false,
      });

      service.checkDeathConditions('entity-1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          finalMessage: expect.stringContaining('suffocates'),
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
        destroyedParts: [
          { partEntityId: 'destroyed-part-1', state: 'destroyed' },
        ],
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
        destroyedParts: [
          { partEntityId: 'destroyed-part-1', state: 'destroyed' },
        ],
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

  describe('evaluateDeathConditions', () => {
    describe('when entity is already dead', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            return componentId === 'anatomy:dead';
          }
        );
      });

      it('should return isDead true with shouldFinalize false', () => {
        const result = service.evaluateDeathConditions('entity-1');

        expect(result).toEqual({
          isDead: true,
          isDying: false,
          shouldFinalize: false,
          finalizationParams: null,
          deathInfo: null,
        });
      });

      it('should not dispatch any events', () => {
        service.evaluateDeathConditions('entity-1');

        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
      });
    });

    describe('when vital organ is destroyed', () => {
      beforeEach(() => {
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
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });
      });

      it('should return shouldFinalize true with finalization params', () => {
        const result = service.evaluateDeathConditions('entity-1', 'killer-1');

        expect(result.shouldFinalize).toBe(true);
        expect(result.finalizationParams).toEqual({
          entityId: 'entity-1',
          causeOfDeath: 'vital_organ_destroyed',
          damageCauserId: 'killer-1',
          vitalOrganDestroyed: 'brain',
        });
      });

      it('should return deathInfo for compatibility', () => {
        const result = service.evaluateDeathConditions('entity-1', 'killer-1');

        expect(result.deathInfo).toEqual({
          causeOfDeath: 'vital_organ_destroyed',
          vitalOrganDestroyed: 'brain',
          killedBy: 'killer-1',
        });
      });

      it('should NOT dispatch any events', () => {
        service.evaluateDeathConditions('entity-1', 'killer-1');

        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
      });

      it('should NOT add dead component', () => {
        service.evaluateDeathConditions('entity-1', 'killer-1');

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dead',
          expect.anything()
        );
      });
    });

    describe('when collective vital organs are all destroyed', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (
              (entityId === 'lung-left' || entityId === 'lung-right') &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'anatomy:body') {
              return { body: { root: 'root-1' } };
            }
            if (
              (entityId === 'lung-left' || entityId === 'lung-right') &&
              componentId === 'anatomy:vital_organ'
            ) {
              return {
                organType: 'lung',
                requiresAllDestroyed: true,
              };
            }
            if (
              (entityId === 'lung-left' || entityId === 'lung-right') &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 0 };
            }
            return null;
          }
        );

        mockBodyGraphService.getAllParts.mockReturnValue([
          'lung-left',
          'lung-right',
        ]);

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'lung-left', state: 'destroyed' },
            { partEntityId: 'lung-right', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });
      });

      it('should return shouldFinalize true with vital organ info', () => {
        const result = service.evaluateDeathConditions('entity-1', 'killer-1');

        expect(result.shouldFinalize).toBe(true);
        expect(result.finalizationParams).toEqual({
          entityId: 'entity-1',
          causeOfDeath: 'vital_organ_destroyed',
          damageCauserId: 'killer-1',
          vitalOrganDestroyed: 'lung',
        });
      });
    });

    describe('when critical health causes dying state', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockReturnValue(false);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
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
      });

      it('should return isDying true with shouldFinalize false', () => {
        const result = service.evaluateDeathConditions('entity-1');

        expect(result).toEqual({
          isDead: false,
          isDying: true,
          shouldFinalize: false,
          finalizationParams: null,
          deathInfo: null,
        });
      });

      it('should still add dying component', () => {
        service.evaluateDeathConditions('entity-1');

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dying',
          expect.objectContaining({
            turnsRemaining: 3,
            causeOfDying: 'overall_health_critical',
          })
        );
      });

      it('should still dispatch dying event', () => {
        service.evaluateDeathConditions('entity-1');

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:entity_dying',
          expect.objectContaining({
            entityId: 'entity-1',
            entityName: 'Test Entity',
          })
        );
      });
    });

    describe('when entity is healthy', () => {
      beforeEach(() => {
        mockEntityManager.hasComponent.mockReturnValue(false);
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 80,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });
      });

      it('should return all false values', () => {
        const result = service.evaluateDeathConditions('entity-1');

        expect(result).toEqual({
          isDead: false,
          isDying: false,
          shouldFinalize: false,
          finalizationParams: null,
          deathInfo: null,
        });
      });

      it('should not dispatch any events', () => {
        service.evaluateDeathConditions('entity-1');

        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
      });
    });
  });

  describe('finalizeDeathFromEvaluation', () => {
    describe('with valid evaluation', () => {
      it('should call finalizeDeath with correct parameters', () => {
        const evaluation = {
          shouldFinalize: true,
          finalizationParams: {
            entityId: 'entity-1',
            causeOfDeath: 'vital_organ_destroyed',
            damageCauserId: 'killer-1',
            vitalOrganDestroyed: 'brain',
          },
        };

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        service.finalizeDeathFromEvaluation(evaluation);

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

      it('should dispatch death events', () => {
        const evaluation = {
          shouldFinalize: true,
          finalizationParams: {
            entityId: 'entity-1',
            causeOfDeath: 'vital_organ_destroyed',
            damageCauserId: 'killer-1',
            vitalOrganDestroyed: 'brain',
          },
        };

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        service.finalizeDeathFromEvaluation(evaluation);

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:entity_died',
          expect.objectContaining({
            entityId: 'entity-1',
            causeOfDeath: 'vital_organ_destroyed',
            vitalOrganDestroyed: 'brain',
          })
        );
      });
    });

    describe('with invalid evaluation', () => {
      it('should do nothing when evaluation is null', () => {
        service.finalizeDeathFromEvaluation(null);

        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
      });

      it('should do nothing when shouldFinalize is false', () => {
        const evaluation = {
          shouldFinalize: false,
          finalizationParams: null,
        };

        service.finalizeDeathFromEvaluation(evaluation);

        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
      });

      it('should log warning when called with invalid evaluation', () => {
        service.finalizeDeathFromEvaluation(null);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'DeathCheckService: finalizeDeathFromEvaluation called with invalid or non-finalizable evaluation'
        );
      });
    });
  });

  describe('coverage gaps', () => {
    describe('Line 297 - evaluateDeathConditions with already dying entity and critical health', () => {
      it('should return isDying true with shouldFinalize false when entity is already in dying state with critical health', () => {
        // Setup: entity is already dying AND has critical health
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return true;
            return false;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 5, // Critical health < 10%
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        const result = service.evaluateDeathConditions('entity-1');

        expect(result).toEqual({
          isDead: false,
          isDying: true,
          shouldFinalize: false,
          finalizationParams: null,
          deathInfo: null,
        });

        // Should NOT add dying component since already dying
        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'entity-1',
          'anatomy:dying',
          expect.anything()
        );
      });
    });

    describe('Line 423 - #checkVitalOrganDestruction with null summary or no destroyedParts', () => {
      it('should return isDead false when aggregateInjuries returns null summary', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return false;
            return false;
          }
        );

        // Return null from aggregateInjuries
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue(null);

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      it('should return isDead false when aggregateInjuries returns summary with null destroyedParts', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: null, // Explicitly null
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });
    });

    describe('Line 493 - #checkPartForVitalOrgan with null vitalOrganData after hasComponent returns true', () => {
      it('should not trigger death when getComponentData returns null for vital organ after hasComponent returns true', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return false;
            // hasComponent returns true for vital organ
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return true;
            }
            return false;
          }
        );

        // But getComponentData returns null (edge case, inconsistent state)
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'destroyed-part-1' &&
              componentId === 'anatomy:vital_organ'
            ) {
              return null; // Line 493: null vitalOrganData
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        mockBodyGraphService.getAllDescendants.mockReturnValue([]);

        const result = service.checkDeathConditions('entity-1');

        // Should NOT die because vitalOrganData is null
        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });
    });

    describe('Line 549 - #checkCollectiveVitalOrganDestruction with missing requiresAllDestroyed', () => {
      it('should skip parts without requiresAllDestroyed property in collective check', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return false;
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'anatomy:body') {
              return { body: { root: 'root-1' } };
            }
            if (entityId === 'part-1' && componentId === 'anatomy:vital_organ') {
              // Line 549: missing requiresAllDestroyed (or false), should be skipped
              return {
                organType: 'lung',
                // requiresAllDestroyed is not present
                killOnDestroy: true,
              };
            }
            if (entityId === 'part-1' && componentId === 'anatomy:part_health') {
              return { currentHealth: 0 };
            }
            return null;
          }
        );

        mockBodyGraphService.getAllParts.mockReturnValue(['part-1']);

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        // Should NOT die because the organ doesn't have requiresAllDestroyed: true
        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });
    });

    describe('Line 560 - #checkCollectiveVitalOrganDestruction with killOnDestroy false', () => {
      it('should skip collective organs with killOnDestroy false', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return false;
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'anatomy:body') {
              return { body: { root: 'root-1' } };
            }
            if (
              (entityId === 'lung-left' || entityId === 'lung-right') &&
              componentId === 'anatomy:vital_organ'
            ) {
              return {
                organType: 'lung',
                requiresAllDestroyed: true, // Collective organ
                killOnDestroy: false, // Line 560: killOnDestroy is false
              };
            }
            if (
              (entityId === 'lung-left' || entityId === 'lung-right') &&
              componentId === 'anatomy:part_health'
            ) {
              return { currentHealth: 0 }; // Both destroyed
            }
            return null;
          }
        );

        mockBodyGraphService.getAllParts.mockReturnValue([
          'lung-left',
          'lung-right',
        ]);

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'lung-left', state: 'destroyed' },
            { partEntityId: 'lung-right', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        // Should NOT die because killOnDestroy is false
        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });
    });

    describe('Lines 589-592 - #checkCollectiveVitalOrganDestruction error handling', () => {
      it('should log warning and return null when getAllParts throws error', () => {
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return false;
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'entity-1' && componentId === 'anatomy:body') {
              return { body: { root: 'root-1' } };
            }
            return null;
          }
        );

        // Lines 589-592: getAllParts throws error
        mockBodyGraphService.getAllParts.mockImplementation(() => {
          throw new Error('Body graph failure');
        });

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        const result = service.checkDeathConditions('entity-1');

        // Should NOT die, error should be caught
        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);

        // Should log warning
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to check collective vital organ destruction'
          )
        );
      });
    });

    describe('Line 608 - #checkOverallHealthCritical with null summary', () => {
      it('should return isDying false when aggregateInjuries returns null for health check', () => {
        mockEntityManager.hasComponent.mockReturnValue(false);

        // First call for vital organ check returns null
        // Second call for health check also returns null
        mockInjuryAggregationService.aggregateInjuries.mockReturnValue(null);

        const result = service.checkDeathConditions('entity-1');

        // Should NOT enter dying state when summary is null
        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });
    });

    describe('Line 666 - perceptible event dispatch with position', () => {
      it('should dispatch core:perceptible_event when entity has position with locationId', () => {
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
            // Line 666: Entity has position with locationId
            if (entityId === 'entity-1' && componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        service.checkDeathConditions('entity-1', 'killer-1');

        // Should dispatch core:perceptible_event
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'core:perceptible_event',
          expect.objectContaining({
            eventName: 'core:perceptible_event',
            locationId: 'location-1',
            perceptionType: 'entity_died',
            actorId: 'entity-1',
          })
        );
      });

      it('should NOT dispatch core:perceptible_event when entity has no position', () => {
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
            // No position data returned
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 50,
          destroyedParts: [
            { partEntityId: 'destroyed-part-1', state: 'destroyed' },
          ],
          isDying: false,
          isDead: false,
        });

        service.checkDeathConditions('entity-1', 'killer-1');

        // Should NOT dispatch core:perceptible_event
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
          'core:perceptible_event',
          expect.anything()
        );
      });
    });

    describe('Line 765 - default death message fallback', () => {
      it('should use fallback message for unknown causeOfDeath', () => {
        // We need to test finalizeDeathFromEvaluation with an unusual causeOfDeath
        const evaluation = {
          shouldFinalize: true,
          finalizationParams: {
            entityId: 'entity-1',
            causeOfDeath: 'unknown_cause', // Not 'vital_organ_destroyed' or 'bleeding_out'
            damageCauserId: null,
            vitalOrganDestroyed: null,
          },
        };

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:name') {
              return { text: 'Test Entity' };
            }
            return null;
          }
        );

        service.finalizeDeathFromEvaluation(evaluation);

        // Line 765: Should use fallback message
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:entity_died',
          expect.objectContaining({
            finalMessage: 'Test Entity falls dead from their injuries.',
          })
        );
      });

      it('should use fallback message when causeOfDeath is completely undefined', () => {
        const evaluation = {
          shouldFinalize: true,
          finalizationParams: {
            entityId: 'entity-1',
            causeOfDeath: undefined, // Undefined cause
            damageCauserId: null,
            vitalOrganDestroyed: null,
          },
        };

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:name') {
              return { text: 'Mysterious Entity' };
            }
            return null;
          }
        );

        service.finalizeDeathFromEvaluation(evaluation);

        // Should use fallback message
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:entity_died',
          expect.objectContaining({
            finalMessage: 'Mysterious Entity falls dead from their injuries.',
          })
        );
      });
    });

    describe('Line 509 - organType fallback to unknown in checkPartForVitalOrgan', () => {
      it('should use "unknown" as organType when vitalOrganData.organType is undefined', () => {
        // Setup: destroyed vital organ with killOnDestroy but no organType
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return false;
            if (componentId === 'anatomy:vital_organ') return true;
            if (componentId === 'anatomy:part_health') return true;
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:vital_organ') {
              // No organType property - should fall back to 'unknown'
              return {
                killOnDestroy: true,
                // organType is intentionally missing
              };
            }
            if (componentId === 'anatomy:part_health') {
              return { destroyed: true };
            }
            if (componentId === 'core:name') {
              return { name: 'Test Entity' };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 100,
          destroyedParts: [{ partEntityId: 'part-1', partName: 'Some Organ' }],
          isDying: false,
          isDead: false,
        });

        mockBodyGraphService.getAllDescendants.mockReturnValue(
          new Set(['part-1'])
        );

        const result = service.checkDeathConditions('entity-1');

        // Should trigger death with 'unknown' organ type
        expect(result).toEqual(
          expect.objectContaining({
            isDead: true,
            deathInfo: expect.objectContaining({
              causeOfDeath: 'vital_organ_destroyed',
              vitalOrganDestroyed: 'unknown',
            }),
          })
        );
      });
    });

    describe('Line 563 - organType fallback to unknown in checkCollectiveVitalOrganDestruction', () => {
      it('should use "unknown" as organType when collective vital organ has no organType', () => {
        // Setup: collective vital organ with requiresAllDestroyed but no organType
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:dead') return false;
            if (componentId === 'anatomy:dying') return false;
            if (componentId === 'anatomy:vital_organ') return true;
            if (componentId === 'anatomy:part_health') return true;
            if (componentId === 'anatomy:body') return true;
            return false;
          }
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:body') {
              return { rootPartEntityId: 'root-part' };
            }
            if (componentId === 'anatomy:vital_organ') {
              // requiresAllDestroyed but no organType
              return {
                requiresAllDestroyed: true,
                killOnDestroy: true,
                // organType is intentionally missing - will fall back to 'unknown'
              };
            }
            if (componentId === 'anatomy:part_health') {
              // Use currentHealth <= 0 to mark as destroyed (line 576)
              return { currentHealth: 0 };
            }
            if (componentId === 'core:name') {
              return { name: 'Test Entity' };
            }
            return null;
          }
        );

        mockInjuryAggregationService.aggregateInjuries.mockReturnValue({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          overallHealthPercentage: 100,
          destroyedParts: [],
          isDying: false,
          isDead: false,
        });

        // Single collective organ that is destroyed
        mockBodyGraphService.getAllParts.mockReturnValue(
          new Set(['collective-organ-1'])
        );

        const result = service.checkDeathConditions('entity-1');

        // Should trigger death from collective organs with 'unknown' type
        expect(result).toEqual(
          expect.objectContaining({
            isDead: true,
            deathInfo: expect.objectContaining({
              causeOfDeath: 'vital_organ_destroyed',
              vitalOrganDestroyed: 'unknown',
            }),
          })
        );
      });
    });
  });
});
