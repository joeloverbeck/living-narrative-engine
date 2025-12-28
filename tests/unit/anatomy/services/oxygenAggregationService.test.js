import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import OxygenAggregationService from '../../../../src/anatomy/services/oxygenAggregationService.js';

describe('OxygenAggregationService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;

  // Component IDs
  const RESPIRATORY_ORGAN_ID = 'breathing-states:respiratory_organ';
  const ANATOMY_PART_ID = 'anatomy:part';

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

    service = new OxygenAggregationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new OxygenAggregationService({
            entityManager: mockEntityManager,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new OxygenAggregationService({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing getComponentData method', () => {
      const invalidEntityManager = {
        hasComponent: jest.fn(),
        getEntitiesWithComponent: jest.fn(),
      };
      expect(
        () =>
          new OxygenAggregationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing hasComponent method', () => {
      const invalidEntityManager = {
        getComponentData: jest.fn(),
        getEntitiesWithComponent: jest.fn(),
      };
      expect(
        () =>
          new OxygenAggregationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
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
          new OxygenAggregationService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
          })
      ).toThrow();
    });
  });

  describe('aggregateOxygen', () => {
    const entityId = 'entity:player';

    describe('T-1.1 Basic aggregation tests', () => {
      it('T-1.1.1: should aggregate oxygen from single respiratory organ', () => {
        const lungEntityId = 'part:lung-left';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungEntityId },
        ]);
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => {
            if (id === lungEntityId && componentId === ANATOMY_PART_ID) {
              return true;
            }
            return false;
          }
        );
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (id === lungEntityId && componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (id === lungEntityId && componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 8,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).not.toBeNull();
        expect(result.organCount).toBe(1);
        expect(result.totalCurrentOxygen).toBe(8);
        expect(result.totalOxygenCapacity).toBe(10);
        expect(result.percentage).toBe(80);
        expect(result.hasRespiratoryOrgans).toBe(true);
      });

      it('T-1.1.2: should aggregate oxygen from two respiratory organs (human lungs)', () => {
        const leftLungId = 'part:lung-left';
        const rightLungId = 'part:lung-right';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: leftLungId },
          { id: rightLungId },
        ]);
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return id === leftLungId || id === rightLungId;
            }
            return false;
          }
        );
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              if (id === leftLungId || id === rightLungId) {
                return { ownerEntityId: entityId, subType: 'lung' };
              }
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              if (id === leftLungId) {
                return {
                  respirationType: 'pulmonary',
                  oxygenCapacity: 10,
                  currentOxygen: 10,
                };
              }
              if (id === rightLungId) {
                return {
                  respirationType: 'pulmonary',
                  oxygenCapacity: 10,
                  currentOxygen: 10,
                };
              }
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).not.toBeNull();
        expect(result.organCount).toBe(2);
        expect(result.totalCurrentOxygen).toBe(20);
        expect(result.totalOxygenCapacity).toBe(20);
        expect(result.percentage).toBe(100);
      });

      it('T-1.1.3: should aggregate oxygen from three or more respiratory organs', () => {
        const organ1Id = 'part:gill-left';
        const organ2Id = 'part:gill-right';
        const organ3Id = 'part:gill-back';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: organ1Id },
          { id: organ2Id },
          { id: organ3Id },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'gill' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'branchial',
                oxygenCapacity: 5,
                currentOxygen: 3,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).not.toBeNull();
        expect(result.organCount).toBe(3);
        expect(result.totalCurrentOxygen).toBe(9);
        expect(result.totalOxygenCapacity).toBe(15);
        expect(result.percentage).toBe(60);
      });

      it('T-1.1.4: should calculate percentage accurately (e.g., 15/20 = 75%)', () => {
        const leftLungId = 'part:lung-left';
        const rightLungId = 'part:lung-right';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: leftLungId },
          { id: rightLungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              if (id === leftLungId) {
                return {
                  respirationType: 'pulmonary',
                  oxygenCapacity: 10,
                  currentOxygen: 8,
                };
              }
              if (id === rightLungId) {
                return {
                  respirationType: 'pulmonary',
                  oxygenCapacity: 10,
                  currentOxygen: 7,
                };
              }
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        // 15/20 = 75%
        expect(result.percentage).toBe(75);
        expect(result.totalCurrentOxygen).toBe(15);
        expect(result.totalOxygenCapacity).toBe(20);
      });
    });

    describe('T-1.2 Edge case tests', () => {
      it('T-1.2.1: should return null when entity has no respiratory organs', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

        const result = service.aggregateOxygen(entityId);

        expect(result).toBeNull();
      });

      it('T-1.2.2: should handle zero total capacity gracefully', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 0,
                currentOxygen: 0,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).not.toBeNull();
        expect(result.percentage).toBe(0);
        expect(result.hasRespiratoryOrgans).toBe(true);
      });

      it('T-1.2.3: should return 0% when currentOxygen = 0', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 0,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result.percentage).toBe(0);
        expect(result.totalCurrentOxygen).toBe(0);
      });

      it('T-1.2.4: should return 100% when currentOxygen = oxygenCapacity', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 10,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result.percentage).toBe(100);
      });

      it('T-1.2.5: should clamp to 100% when currentOxygen > oxygenCapacity', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 15, // Data corruption: more oxygen than capacity
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result.percentage).toBe(100);
      });

      it('should use safe defaults when component data has missing fields', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              // Missing currentOxygen and oxygenCapacity
              return { respirationType: 'pulmonary' };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).not.toBeNull();
        // Safe defaults: currentOxygen=0, oxygenCapacity=1
        expect(result.totalCurrentOxygen).toBe(0);
        expect(result.totalOxygenCapacity).toBe(1);
        expect(result.percentage).toBe(0);
      });
    });

    describe('T-1.3 Ownership validation tests', () => {
      it('T-1.3.1: should only aggregate organs owned by specified entity', () => {
        const playerLungId = 'part:player-lung';
        const npcLungId = 'part:npc-lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: playerLungId },
          { id: npcLungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              if (id === playerLungId) {
                return { ownerEntityId: entityId, subType: 'lung' };
              }
              if (id === npcLungId) {
                return { ownerEntityId: 'entity:npc', subType: 'lung' };
              }
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 10,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).not.toBeNull();
        expect(result.organCount).toBe(1); // Only player's organ
        expect(result.totalOxygenCapacity).toBe(10);
      });

      it('T-1.3.2: should ignore organs owned by other entities', () => {
        const npcLungLeftId = 'part:npc-lung-left';
        const npcLungRightId = 'part:npc-lung-right';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: npcLungLeftId },
          { id: npcLungRightId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: 'entity:npc', subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 10,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        // No organs belong to player
        expect(result).toBeNull();
      });

      it('T-1.3.3: should handle organs with missing ownerEntityId gracefully', () => {
        const validLungId = 'part:valid-lung';
        const invalidLungId = 'part:invalid-lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: validLungId },
          { id: invalidLungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              if (id === validLungId) {
                return { ownerEntityId: entityId, subType: 'lung' };
              }
              if (id === invalidLungId) {
                // Missing ownerEntityId
                return { subType: 'lung' };
              }
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 5,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).not.toBeNull();
        expect(result.organCount).toBe(1); // Only valid organ counted
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('missing ownerEntityId')
        );
      });
    });

    describe('error handling', () => {
      it('should handle getEntitiesWithComponent throwing an error', () => {
        mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        const result = service.aggregateOxygen(entityId);

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to find respiratory organs')
        );
      });
    });

    describe('DTO structure', () => {
      it('should return correct DTO structure with all required fields', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 7,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result).toEqual({
          entityId,
          totalCurrentOxygen: 7,
          totalOxygenCapacity: 10,
          percentage: 70,
          organCount: 1,
          hasRespiratoryOrgans: true,
        });
      });

      it('should include entityId in the result', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 10,
                currentOxygen: 10,
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result.entityId).toBe(entityId);
      });
    });

    describe('percentage rounding', () => {
      it('should round percentage to nearest integer', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 3,
                currentOxygen: 1, // 33.33...%
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result.percentage).toBe(33); // Rounded from 33.33...
        expect(Number.isInteger(result.percentage)).toBe(true);
      });

      it('should round 66.67% to 67%', () => {
        const lungId = 'part:lung';

        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: lungId },
        ]);
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === ANATOMY_PART_ID) {
              return { ownerEntityId: entityId, subType: 'lung' };
            }
            if (componentId === RESPIRATORY_ORGAN_ID) {
              return {
                respirationType: 'pulmonary',
                oxygenCapacity: 3,
                currentOxygen: 2, // 66.67%
              };
            }
            return null;
          }
        );

        const result = service.aggregateOxygen(entityId);

        expect(result.percentage).toBe(67); // Rounded from 66.67
      });
    });
  });
});
